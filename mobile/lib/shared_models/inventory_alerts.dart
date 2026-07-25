import 'medicine.dart';

/// A batch nearing expiry, as returned inside `GET /inventory/alerts`.
class ExpiringBatch {
  final String medicineId;
  final String medicineName;
  final String batchNo;
  final int quantity;
  final String expiryDate;
  final double unitPrice;

  const ExpiringBatch({
    required this.medicineId,
    required this.medicineName,
    required this.batchNo,
    required this.quantity,
    required this.expiryDate,
    required this.unitPrice,
  });

  factory ExpiringBatch.fromJson(Map<String, dynamic> json) {
    return ExpiringBatch(
      medicineId: json['medicineId'] as String? ?? '',
      medicineName: json['medicineName'] as String? ?? '',
      batchNo: json['batchNo'] as String? ?? '',
      quantity: (json['quantity'] as num?)?.toInt() ?? 0,
      expiryDate: json['expiryDate'] as String? ?? '',
      unitPrice: (json['unitPrice'] as num?)?.toDouble() ?? 0,
    );
  }

  /// Days remaining until expiry, or null when the date cannot be parsed.
  int? get daysToExpiry {
    final parsed = DateTime.tryParse(expiryDate);
    if (parsed == null) return null;
    final today = DateTime.now();
    return DateTime(parsed.year, parsed.month, parsed.day)
        .difference(DateTime(today.year, today.month, today.day))
        .inDays;
  }
}

class InventoryAlerts {
  final List<Medicine> lowStock;
  final List<Medicine> outOfStock;
  final List<ExpiringBatch> expiring;

  const InventoryAlerts({
    required this.lowStock,
    required this.outOfStock,
    required this.expiring,
  });

  factory InventoryAlerts.fromJson(Map<String, dynamic> json) {
    List<Medicine> meds(String key) => (json[key] as List<dynamic>? ?? [])
        .map((e) => Medicine.fromJson(e as Map<String, dynamic>))
        .toList();

    return InventoryAlerts(
      lowStock: meds('lowStock'),
      outOfStock: meds('outOfStock'),
      expiring: (json['expiring'] as List<dynamic>? ?? [])
          .map((e) => ExpiringBatch.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }

  int get total => lowStock.length + outOfStock.length + expiring.length;
}
