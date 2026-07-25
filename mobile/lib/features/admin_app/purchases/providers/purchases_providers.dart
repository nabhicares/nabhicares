import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../shared_models/purchase_order.dart';
import '../../../../shared_models/supplier.dart';
import '../data/purchases_repository.dart';

final suppliersPrv = FutureProvider.autoDispose<List<Supplier>>((ref) {
  return ref.watch(purchasesRepositoryPrv).fetchSuppliers();
});

final purchaseOrdersPrv = FutureProvider.autoDispose<List<PurchaseOrder>>((ref) {
  return ref.watch(purchasesRepositoryPrv).fetchOrders();
});

final purchaseOrderPrv =
    FutureProvider.autoDispose.family<PurchaseOrder, String>((ref, orderId) {
  return ref.watch(purchasesRepositoryPrv).fetchOrder(orderId);
});

void invalidatePurchases(WidgetRef ref) {
  ref.invalidate(purchaseOrdersPrv);
  ref.invalidate(purchaseOrderPrv);
  ref.invalidate(suppliersPrv);
}
