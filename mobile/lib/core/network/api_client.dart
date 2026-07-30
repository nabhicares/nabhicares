import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api_exception.dart';
import 'dio_client.dart';

/// A response already unwrapped from the backend `{ success, data, meta }` envelope.
class ApiResult {
  final dynamic data;
  final Map<String, dynamic>? _meta;

  const ApiResult(this.data, this._meta);

  /// Collection endpoints answer with a bare array, or with `{ items, meta }`
  /// when they page.
  List<Map<String, dynamic>> get list {
    final payload = data is Map<String, dynamic> ? data['items'] : data;
    return (payload as List<dynamic>? ?? const []).cast<Map<String, dynamic>>();
  }

  Map<String, dynamic> get map => (data as Map<String, dynamic>? ?? {});

  Map<String, dynamic>? get meta {
    if (_meta != null) return _meta;
    final nested = data is Map<String, dynamic> ? data['meta'] : null;
    return nested as Map<String, dynamic>?;
  }
}

/// Thin wrapper over Dio that unwraps the response envelope and converts
/// transport/HTTP failures into [ApiException].
class ApiClient {
  final Dio _dio;

  ApiClient(this._dio);

  Future<ApiResult> get(String path, {Map<String, dynamic>? query}) =>
      _send(() => _dio.get(path, queryParameters: _clean(query)));

  Future<ApiResult> post(String path, {Object? body}) =>
      _send(() => _dio.post(path, data: body));

  Future<ApiResult> patch(String path, {Object? body}) =>
      _send(() => _dio.patch(path, data: body));

  Future<ApiResult> put(String path, {Object? body}) =>
      _send(() => _dio.put(path, data: body));

  Future<ApiResult> delete(String path) =>
      _send(() => _dio.delete(path));

  Future<ApiResult> _send(Future<Response<dynamic>> Function() request) async {
    try {
      final response = await request();
      final body = response.data;

      if (body is Map<String, dynamic>) {
        if (body['success'] == false) {
          final err = body['error'] as Map<String, dynamic>? ?? const {};
          throw ApiException(
            code: err['code']?.toString() ?? 'UNKNOWN',
            message: err['message']?.toString() ?? 'Request failed.',
            field: err['field']?.toString(),
            statusCode: response.statusCode,
          );
        }
        return ApiResult(body['data'], body['meta'] as Map<String, dynamic>?);
      }

      return ApiResult(body, null);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Map<String, dynamic>? _clean(Map<String, dynamic>? query) {
    if (query == null) return null;
    final cleaned = <String, dynamic>{};
    query.forEach((key, value) {
      if (value == null) return;
      if (value is String && value.isEmpty) return;
      cleaned[key] = value;
    });
    return cleaned.isEmpty ? null : cleaned;
  }
}

final apiClientPrv = Provider<ApiClient>((ref) => ApiClient(ref.watch(dioClientPrv)));
