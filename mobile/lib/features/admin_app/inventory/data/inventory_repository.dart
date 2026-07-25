import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_client.dart';
import '../../../../shared_models/inventory_alerts.dart';
import '../../../../shared_models/inventory_summary.dart';
import '../../../../shared_models/medicine.dart';
import '../../../../shared_models/stock_transaction.dart';

class PagedMedicines {
  final List<Medicine> items;
  final int totalCount;
  final int page;
  final int totalPages;

  const PagedMedicines({
    required this.items,
    required this.totalCount,
    required this.page,
    required this.totalPages,
  });

  bool get hasMore => page < totalPages;
}

class InventoryRepository {
  final ApiClient _api;

  InventoryRepository(this._api);

  Future<PagedMedicines> fetchMedicines({
    String? query,
    String? category,
    String? status,
    int page = 1,
    int limit = 20,
    bool includeInactive = false,
  }) async {
    final result = await _api.get('/inventory/medicines', query: {
      'q': query,
      'category': category,
      'status': status,
      'page': page,
      'limit': limit,
      if (includeInactive) 'includeInactive': 'true',
    });

    final meta = result.meta ?? const {};
    return PagedMedicines(
      items: result.list.map(Medicine.fromJson).toList(),
      totalCount: (meta['totalCount'] as num?)?.toInt() ?? result.list.length,
      page: (meta['page'] as num?)?.toInt() ?? page,
      totalPages: (meta['totalPages'] as num?)?.toInt() ?? 1,
    );
  }

  Future<Medicine> fetchMedicine(String id) async {
    final result = await _api.get('/inventory/medicines/$id');
    return Medicine.fromJson(result.map);
  }

  Future<List<BatchItem>> fetchBatches(String medicineId) async {
    final result = await _api.get('/inventory/medicines/$medicineId/batches');
    return result.list.map(BatchItem.fromJson).toList();
  }

  Future<Medicine> createMedicine(Map<String, dynamic> payload) async {
    final result = await _api.post('/inventory/medicines', body: payload);
    return Medicine.fromJson(result.map);
  }

  Future<Medicine> updateMedicine(String id, Map<String, dynamic> payload) async {
    final result = await _api.patch('/inventory/medicines/$id', body: payload);
    return Medicine.fromJson(result.map);
  }

  Future<void> addBatch({
    required String medicineId,
    required String batchNo,
    required String expiryDate,
    required int quantity,
    required double unitPrice,
  }) {
    return _api.post('/inventory/medicines/$medicineId/batch', body: {
      'batchNo': batchNo,
      'expiryDate': expiryDate,
      'quantity': quantity,
      'unitPrice': unitPrice,
    });
  }

  Future<void> adjustStock({
    required String medicineId,
    required String batchNo,
    required int quantityChange,
    required String reason,
  }) {
    return _api.post('/inventory/adjust', body: {
      'medicineId': medicineId,
      'batchNo': batchNo,
      'quantityChange': quantityChange,
      'reason': reason,
    });
  }

  Future<InventorySummary> fetchSummary() async {
    final result = await _api.get('/inventory/summary');
    return InventorySummary.fromJson(result.map);
  }

  Future<InventoryAlerts> fetchAlerts({int withinDays = 30}) async {
    final result = await _api.get('/inventory/alerts', query: {'withinDays': withinDays});
    return InventoryAlerts.fromJson(result.map);
  }

  Future<List<StockTransaction>> fetchTransactions({
    String? medicineId,
    String? type,
    String? from,
    String? to,
  }) async {
    final result = await _api.get('/inventory/transactions', query: {
      'medicineId': medicineId,
      'type': type,
      'from': from,
      'to': to,
      'limit': 100,
    });
    return result.list.map(StockTransaction.fromJson).toList();
  }
}

final inventoryRepositoryPrv = Provider<InventoryRepository>(
  (ref) => InventoryRepository(ref.watch(apiClientPrv)),
);
