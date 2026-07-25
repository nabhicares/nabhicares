/// Response of `GET /inventory/summary`.
class InventorySummary {
  final int totalSKUs;
  final int totalUnits;
  final int lowStockCount;
  final int outOfStockCount;
  final int expiringCount;
  final double totalValue;

  const InventorySummary({
    required this.totalSKUs,
    required this.totalUnits,
    required this.lowStockCount,
    required this.outOfStockCount,
    required this.expiringCount,
    required this.totalValue,
  });

  factory InventorySummary.fromJson(Map<String, dynamic> json) {
    return InventorySummary(
      totalSKUs: (json['totalSKUs'] as num?)?.toInt() ?? 0,
      totalUnits: (json['totalUnits'] as num?)?.toInt() ?? 0,
      lowStockCount: (json['lowStockCount'] as num?)?.toInt() ?? 0,
      outOfStockCount: (json['outOfStockCount'] as num?)?.toInt() ?? 0,
      expiringCount: (json['expiringCount'] as num?)?.toInt() ?? 0,
      totalValue: (json['totalValue'] as num?)?.toDouble() ?? 0,
    );
  }
}
