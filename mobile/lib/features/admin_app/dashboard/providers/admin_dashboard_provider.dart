import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/network/dio_client.dart';

class AdminDashboardMetrics {
  final int appointmentsCount;
  final int totalStockItems;
  final int lowStockItemsCount;
  final double totalRevenue;
  final List<String> fastMovingMedicines;

  AdminDashboardMetrics({
    required this.appointmentsCount,
    required this.totalStockItems,
    required this.lowStockItemsCount,
    required this.totalRevenue,
    required this.fastMovingMedicines,
  });

  factory AdminDashboardMetrics.fromJson(Map<String, dynamic> json) {
    return AdminDashboardMetrics(
      appointmentsCount: json['appointmentsCount'] as int? ?? 0,
      totalStockItems: json['totalStockItems'] as int? ?? 0,
      lowStockItemsCount: json['lowStockItemsCount'] as int? ?? 0,
      totalRevenue: (json['totalRevenue'] as num?)?.toDouble() ?? 0.0,
      fastMovingMedicines: List<String>.from(json['fastMovingMedicines'] ?? []),
    );
  }
}

final adminDashboardMetricsProvider = FutureProvider<AdminDashboardMetrics>((ref) async {
  final dio = ref.watch(dioClientPrv);
  final response = await dio.get('/reports/dashboard');
  
  if (response.data != null && response.data['success'] == true) {
    return AdminDashboardMetrics.fromJson(response.data['data'] as Map<String, dynamic>);
  }
  
  // Default fallback if endpoint fails
  return AdminDashboardMetrics(
    appointmentsCount: 0,
    totalStockItems: 0,
    lowStockItemsCount: 0,
    totalRevenue: 0.0,
    fastMovingMedicines: [],
  );
});
