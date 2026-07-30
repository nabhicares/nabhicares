/// API and runtime configuration.
///
/// Repositories always use relative paths (e.g. `/inventory/medicines`).
/// This base URL is the single place that decides which host they hit.
///
/// Default: your deployed Vercel API.
/// Override only for a local Nest backend:
///   flutter run --dart-define=API_BASE_URL=http://localhost:3000/api/v1
class AppConfig {
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://nabhicares.vercel.app/api/v1',
  );
}
