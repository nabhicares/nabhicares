import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../shared_models/inventory_alerts.dart';
import '../../../../shared_models/inventory_summary.dart';
import '../../../../shared_models/medicine.dart';
import '../../../../shared_models/stock_transaction.dart';
import '../data/inventory_repository.dart';

class MedicineFilter {
  final String query;
  final String category;
  final String status;

  const MedicineFilter({
    this.query = '',
    this.category = 'All',
    this.status = 'all',
  });

  MedicineFilter copyWith({String? query, String? category, String? status}) {
    return MedicineFilter(
      query: query ?? this.query,
      category: category ?? this.category,
      status: status ?? this.status,
    );
  }

  @override
  bool operator ==(Object other) =>
      other is MedicineFilter &&
      other.query == query &&
      other.category == category &&
      other.status == status;

  @override
  int get hashCode => Object.hash(query, category, status);
}

final medicineFilterPrv = StateProvider<MedicineFilter>((ref) => const MedicineFilter());

final medicinesPrv = FutureProvider.autoDispose<PagedMedicines>((ref) {
  final filter = ref.watch(medicineFilterPrv);
  return ref.watch(inventoryRepositoryPrv).fetchMedicines(
        query: filter.query,
        category: filter.category == 'All' ? null : filter.category,
        status: filter.status == 'all' ? null : filter.status,
        limit: 50,
      );
});

final medicineDetailPrv =
    FutureProvider.autoDispose.family<Medicine, String>((ref, medicineId) {
  return ref.watch(inventoryRepositoryPrv).fetchMedicine(medicineId);
});

final medicineBatchesPrv =
    FutureProvider.autoDispose.family<List<BatchItem>, String>((ref, medicineId) {
  return ref.watch(inventoryRepositoryPrv).fetchBatches(medicineId);
});

/// Unfiltered medicine list backing the pickers on the adjust and order forms.
final medicineDirectoryPrv = FutureProvider<List<Medicine>>((ref) async {
  final paged = await ref.watch(inventoryRepositoryPrv).fetchMedicines(limit: 200);
  return paged.items;
});

/// Distinct categories already in use, for autocomplete on the medicine form.
final medicineCategoriesPrv = FutureProvider<List<String>>((ref) async {
  final medicines = await ref.watch(medicineDirectoryPrv.future);
  final categories = medicines
      .map((m) => m.category)
      .where((c) => c.isNotEmpty)
      .toSet()
      .toList()
    ..sort();
  return categories;
});

final inventorySummaryPrv = FutureProvider.autoDispose<InventorySummary>((ref) {
  return ref.watch(inventoryRepositoryPrv).fetchSummary();
});

final inventoryAlertsPrv = FutureProvider.autoDispose<InventoryAlerts>((ref) {
  return ref.watch(inventoryRepositoryPrv).fetchAlerts();
});

/// Pass an empty string for the full ledger, or a medicine id to scope it.
final stockTransactionsPrv =
    FutureProvider.autoDispose.family<List<StockTransaction>, String>((ref, medicineId) {
  return ref.watch(inventoryRepositoryPrv).fetchTransactions(
        medicineId: medicineId.isEmpty ? null : medicineId,
      );
});

/// Refreshes every inventory read after a write, so counts and lists stay in sync.
void invalidateInventory(WidgetRef ref) {
  ref.invalidate(medicinesPrv);
  ref.invalidate(inventorySummaryPrv);
  ref.invalidate(inventoryAlertsPrv);
  ref.invalidate(medicineDetailPrv);
  ref.invalidate(medicineBatchesPrv);
  ref.invalidate(stockTransactionsPrv);
  ref.invalidate(medicineDirectoryPrv);
}
