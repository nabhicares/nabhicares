import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../features/auth/presentation/screens/login_screen.dart';
import '../../features/patient_app/home/patient_home_screen.dart';
import '../../features/doctor_app/dashboard/doctor_dashboard_screen.dart';
import '../../features/admin_app/dashboard/admin_dashboard_screen.dart';

// User structure matching role configurations
class AuthUserState {
  final bool isAuthenticated;
  final String role; // 'patient' | 'doctor' | 'hospital_admin' | 'pharmacist' | 'receptionist'
  final String email;

  const AuthUserState({
    required this.isAuthenticated,
    required this.role,
    required this.email,
  });
}

class AuthStateNotifier extends StateNotifier<AuthUserState> {
  AuthStateNotifier()
      : super(const AuthUserState(isAuthenticated: false, role: 'patient', email: ''));

  void login(String role, String email) {
    state = AuthUserState(isAuthenticated: true, role: role, email: email);
  }

  void logout() {
    state = const AuthUserState(isAuthenticated: false, role: 'patient', email: '');
  }
}

final authStatePrv = StateNotifierProvider<AuthStateNotifier, AuthUserState>((ref) {
  return AuthStateNotifier();
});

final appRouterPrv = Provider<GoRouter>((ref) {
  final authState = ref.watch(authStatePrv);

  return GoRouter(
    initialLocation: '/login',
    redirect: (context, state) {
      final currentLoc = state.matchedLocation;
      final loggedIn = authState.isAuthenticated;

      if (!loggedIn) {
        if (currentLoc == '/login') return null;
        return '/login';
      }

      if (currentLoc == '/login') {
        if (authState.role == 'patient') return '/patient/home';
        if (authState.role == 'doctor') return '/doctor/dashboard';
        return '/admin/dashboard';
      }

      // Check routes matching specific folder patterns from Vol.5 routing guidelines
      if (currentLoc.startsWith('/patient') && authState.role != 'patient') {
        return '/login';
      }
      if (currentLoc.startsWith('/doctor') && authState.role != 'doctor') {
        return '/login';
      }
      if (currentLoc.startsWith('/admin') &&
          !['hospital_admin', 'super_admin', 'receptionist', 'pharmacist']
              .contains(authState.role)) {
        return '/login';
      }

      return null;
    },
    routes: [
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/patient/home',
        builder: (context, state) => const PatientHomeScreen(),
      ),
      GoRoute(
        path: '/doctor/dashboard',
        builder: (context, state) => const DoctorDashboardScreen(),
      ),
      GoRoute(
        path: '/admin/dashboard',
        builder: (context, state) => const AdminDashboardScreen(),
      ),
    ],
  );
});
