import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/dio_client.dart';

/// Hospital-wide analytics returned by GET /reports/dashboard (admin only).
class AdminDashboard {
  final int appointmentsCount;
  final int totalStockItems;
  final int lowStockItemsCount;
  final double totalRevenue;
  final List<String> fastMovingMedicines;

  const AdminDashboard({
    required this.appointmentsCount,
    required this.totalStockItems,
    required this.lowStockItemsCount,
    required this.totalRevenue,
    required this.fastMovingMedicines,
  });

  factory AdminDashboard.fromJson(Map<String, dynamic> json) {
    return AdminDashboard(
      appointmentsCount: (json['appointmentsCount'] as num?)?.toInt() ?? 0,
      totalStockItems: (json['totalStockItems'] as num?)?.toInt() ?? 0,
      lowStockItemsCount: (json['lowStockItemsCount'] as num?)?.toInt() ?? 0,
      totalRevenue: (json['totalRevenue'] as num?)?.toDouble() ?? 0,
      fastMovingMedicines:
          (json['fastMovingMedicines'] as List<dynamic>? ?? [])
              .map((e) => e.toString())
              .toList(),
    );
  }
}

class StaffMember {
  final String id;
  final String name;
  final String specialty;
  final double consultationFee;

  const StaffMember({
    required this.id,
    required this.name,
    required this.specialty,
    required this.consultationFee,
  });

  factory StaffMember.fromJson(Map<String, dynamic> json) {
    return StaffMember(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? 'Unknown',
      specialty: json['specialty'] as String? ?? 'General',
      consultationFee: (json['consultationFee'] as num?)?.toDouble() ?? 0,
    );
  }
}

final adminDashboardPrv = FutureProvider.autoDispose<AdminDashboard>((ref) async {
  final dio = ref.watch(dioClientPrv);
  final response = await dio.get('/reports/dashboard');
  if (response.data != null && response.data['success'] == true) {
    return AdminDashboard.fromJson(response.data['data'] as Map<String, dynamic>);
  }
  throw Exception('Failed to load dashboard analytics.');
});

final staffDoctorsPrv = FutureProvider.autoDispose<List<StaffMember>>((ref) async {
  final dio = ref.watch(dioClientPrv);
  final response = await dio.get('/doctors');
  if (response.data != null && response.data['success'] == true) {
    final list = response.data['data'] as List<dynamic>? ?? [];
    return list
        .map((e) => StaffMember.fromJson(e as Map<String, dynamic>))
        .toList();
  }
  return [];
});

/// Assigns a role custom-claim to a user. POST /users/assign-role (admin only).
Future<void> assignStaffRole(WidgetRef ref, String uid, String role) async {
  final dio = ref.read(dioClientPrv);
  final response = await dio.post('/users/assign-role', data: {
    'uid': uid,
    'role': role,
  });
  if (response.data == null || response.data['success'] != true) {
    throw DioException(
      requestOptions: RequestOptions(path: '/users/assign-role'),
      error: response.data?['error']?['message'] ?? 'Role assignment failed.',
    );
  }
}
