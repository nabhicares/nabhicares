import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart' show TargetPlatform, defaultTargetPlatform;

/// Firebase project the API verifies ID tokens against. These values are public
/// client identifiers, not secrets — access is decided by Firebase rules and by
/// the hospital user record the API resolves from the token.
class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (defaultTargetPlatform == TargetPlatform.android) return android;
    throw UnsupportedError(
      'Nabhi Care is released for Android only. Add the platform in the Firebase '
      'console and extend DefaultFirebaseOptions before building for it.',
    );
  }

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyBJPeld5pur59lnmrqs15W3CJPfg3PuuiE',
    appId: '1:177244651907:android:38b7b2dc3296e27bc636b6',
    messagingSenderId: '177244651907',
    projectId: 'nabhi-cares',
    storageBucket: 'nabhi-cares.firebasestorage.app',
  );
}
