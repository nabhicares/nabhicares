import 'package:dio/dio.dart';

/// Mirrors the backend error envelope:
/// `{ success: false, error: { code, message, field, request_id } }`
class ApiException implements Exception {
  final String code;
  final String message;
  final String? field;
  final int? statusCode;

  const ApiException({
    required this.code,
    required this.message,
    this.field,
    this.statusCode,
  });

  factory ApiException.fromDio(DioException error) {
    final response = error.response;
    final body = response?.data;

    if (body is Map && body['error'] is Map) {
      final err = body['error'] as Map;
      return ApiException(
        code: err['code']?.toString() ?? 'UNKNOWN',
        message: err['message']?.toString() ?? 'Something went wrong.',
        field: err['field']?.toString(),
        statusCode: response?.statusCode,
      );
    }

    final isTimeout = error.type == DioExceptionType.connectionTimeout ||
        error.type == DioExceptionType.receiveTimeout ||
        error.type == DioExceptionType.sendTimeout;

    return ApiException(
      code: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
      message: isTimeout
          ? 'The server took too long to respond. Check your connection and try again.'
          : 'Could not reach the server. Check your connection and try again.',
      statusCode: response?.statusCode,
    );
  }

  bool get isAuthError => code == 'UNAUTHENTICATED' || code == 'FORBIDDEN';

  @override
  String toString() => message;
}
