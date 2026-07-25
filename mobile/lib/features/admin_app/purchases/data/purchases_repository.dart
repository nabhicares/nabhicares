import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_client.dart';
import '../../../../shared_models/purchase_order.dart';
import '../../../../shared_models/supplier.dart';

/// One line of a goods receipt against a purchase order.
class ReceiptLine {
  final String medicineId;
  final String batchNo;
  final String expiryDate;
  final int quantityReceived;

  const ReceiptLine({
    required this.medicineId,
    required this.batchNo,
    required this.expiryDate,
    required this.quantityReceived,
  });

  Map<String, dynamic> toJson() => {
        'medicineId': medicineId,
        'batchNo': batchNo,
        'expiryDate': expiryDate,
        'quantityReceived': quantityReceived,
      };
}

class PurchasesRepository {
  final ApiClient _api;

  PurchasesRepository(this._api);

  Future<List<Supplier>> fetchSuppliers({bool includeInactive = false}) async {
    final result = await _api.get('/purchases/suppliers', query: {
      'limit': 100,
      if (includeInactive) 'includeInactive': 'true',
    });
    return result.list.map(Supplier.fromJson).toList();
  }

  Future<Supplier> createSupplier(Map<String, dynamic> payload) async {
    final result = await _api.post('/purchases/suppliers', body: payload);
    return Supplier.fromJson(result.map);
  }

  Future<Supplier> updateSupplier(String id, Map<String, dynamic> payload) async {
    final result = await _api.patch('/purchases/suppliers/$id', body: payload);
    return Supplier.fromJson(result.map);
  }

  Future<List<PurchaseOrder>> fetchOrders() async {
    final result = await _api.get('/purchases/orders', query: {'limit': 100});
    return result.list.map(PurchaseOrder.fromJson).toList();
  }

  Future<PurchaseOrder> fetchOrder(String id) async {
    final result = await _api.get('/purchases/orders/$id');
    return PurchaseOrder.fromJson(result.map);
  }

  Future<PurchaseOrder> createOrder({
    required String supplierId,
    required List<Map<String, dynamic>> items,
  }) async {
    final result = await _api.post('/purchases/orders', body: {
      'supplierId': supplierId,
      'items': items,
    });
    return PurchaseOrder.fromJson(result.map);
  }

  Future<void> cancelOrder(String id) => _api.patch('/purchases/orders/$id/cancel');

  Future<void> receiveOrder(String id, List<ReceiptLine> lines) {
    return _api.put('/purchases/orders/$id/receive', body: {
      'items': lines.map((line) => line.toJson()).toList(),
    });
  }
}

final purchasesRepositoryPrv = Provider<PurchasesRepository>(
  (ref) => PurchasesRepository(ref.watch(apiClientPrv)),
);
