import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/api_client.dart';

/// The signed-in hospital user, as the API reports them from `GET /me`.
///
/// Ids come from the user's own record, so every screen queries its own data
/// instead of a fixed identifier.
class AuthUserState {
  /// False until the first Firebase session check finishes, so the router does
  /// not bounce a returning user to the login screen.
  final bool ready;
  final bool isAuthenticated;
  final String role;
  final String email;
  final String displayName;
  final String hospitalName;

  /// Medical record number, set only for patient accounts.
  final String patientId;

  /// Registration number, set only for doctor accounts.
  final String doctorId;

  /// Set when a valid Firebase sign-in has no usable hospital account.
  final String error;

  const AuthUserState({
    this.ready = false,
    this.isAuthenticated = false,
    this.role = 'patient',
    this.email = '',
    this.displayName = '',
    this.hospitalName = '',
    this.patientId = '',
    this.doctorId = '',
    this.error = '',
  });

  const AuthUserState.signedOut({this.error = ''})
      : ready = true,
        isAuthenticated = false,
        role = 'patient',
        email = '',
        displayName = '',
        hospitalName = '',
        patientId = '',
        doctorId = '';

  /// Display name where available, e-mail local part otherwise.
  String get shortName {
    if (displayName.isNotEmpty) return displayName;
    return email.contains('@') ? email.split('@').first : email;
  }
}

class AuthStateNotifier extends StateNotifier<AuthUserState> {
  AuthStateNotifier(this._ref) : super(const AuthUserState()) {
    _subscribe();
  }

  final Ref _ref;
  FirebaseAuth get _auth => FirebaseAuth.instance;

  void _subscribe() {
    _auth.authStateChanges().listen((account) async {
      if (account == null) {
        state = const AuthUserState.signedOut();
        return;
      }
      try {
        final result = await _ref.read(apiClientPrv).get('/me');
        final profile = result.map;
        state = AuthUserState(
          ready: true,
          isAuthenticated: true,
          role: profile['role'] as String? ?? 'patient',
          email: profile['email'] as String? ?? account.email ?? '',
          displayName: profile['displayName'] as String? ?? '',
          hospitalName: profile['hospitalName'] as String? ?? '',
          patientId: profile['patientId'] as String? ?? '',
          doctorId: profile['doctorId'] as String? ?? '',
        );
      } catch (error) {
        // Firebase accepts the credentials but this hospital has no active user
        // for them. Staying signed in would leave every screen failing.
        await _auth.signOut();
        state = AuthUserState.signedOut(
          error: 'Signed in, but this account has no portal access. $error',
        );
      }
    });
  }

  /// Throws a message fit for display when the credentials are refused.
  Future<void> signIn(String email, String password) async {
    state = const AuthUserState(ready: true);
    try {
      await _auth.signInWithEmailAndPassword(
        email: email.trim(),
        password: password,
      );
    } on FirebaseAuthException catch (error) {
      state = const AuthUserState.signedOut();
      throw Exception(_readable(error.code));
    }
  }

  Future<void> logout() => _auth.signOut();

  String _readable(String code) {
    switch (code) {
      case 'invalid-email':
        return 'That email address is not valid.';
      case 'invalid-credential':
      case 'wrong-password':
      case 'user-not-found':
        return 'Email or password is incorrect.';
      case 'user-disabled':
        return 'This account has been disabled. Contact your hospital administrator.';
      case 'too-many-requests':
        return 'Too many attempts. Try again in a few minutes.';
      case 'network-request-failed':
        return 'Cannot reach the sign-in service. Check your connection.';
      default:
        return 'Sign-in failed. Try again or contact your hospital administrator.';
    }
  }
}

final authStatePrv = StateNotifierProvider<AuthStateNotifier, AuthUserState>(
  AuthStateNotifier.new,
);
