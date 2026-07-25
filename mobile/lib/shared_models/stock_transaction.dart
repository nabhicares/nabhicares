/// Entry from `stockTransactions` — the inventory audit ledger.
class StockTransaction {
  final String id;
  final String medicineId;
  final String medicineName;
  final String batchNo;
  final String type; // purchase | adjustment | sale
  final int quantityChange;
  final String reason;
  final String? userId;
  final String createdAt;

  const StockTransaction({
    required this.id,
    required this.medicineId,
    required this.medicineName,
    required this.batchNo,
    required this.type,
    required this.quantityChange,
    required this.reason,
    required this.createdAt,
    this.userId,
  });

  factory StockTransaction.fromJson(Map<String, dynamic> json) {
    return StockTransaction(
      id: json['id'] as String? ?? '',
      medicineId: json['medicineId'] as String? ?? '',
      medicineName: json['medicineName'] as String? ?? '',
      batchNo: json['batchNo'] as String? ?? '',
      type: json['type'] as String? ?? '',
      quantityChange: (json['quantityChange'] as num?)?.toInt() ?? 0,
      reason: json['reason'] as String? ?? '',
      userId: json['userId'] as String?,
      createdAt: json['createdAt'] as String? ?? '',
    );
  }

  bool get isIncrease => quantityChange >= 0;

  String get readableReason => reason.replaceAll('_', ' ');
}
