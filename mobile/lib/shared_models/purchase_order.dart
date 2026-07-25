class PurchaseOrderItem {
  final String medicineId;
  final String medicineName;
  final int quantity;
  final double unitPrice;
  final int quantityReceived;

  const PurchaseOrderItem({
    required this.medicineId,
    required this.medicineName,
    required this.quantity,
    required this.unitPrice,
    required this.quantityReceived,
  });

  factory PurchaseOrderItem.fromJson(Map<String, dynamic> json) {
    return PurchaseOrderItem(
      medicineId: json['medicineId'] as String? ?? '',
      medicineName: json['medicineName'] as String? ?? '',
      quantity: (json['quantity'] as num?)?.toInt() ?? 0,
      unitPrice: (json['unitPrice'] as num?)?.toDouble() ?? 0,
      quantityReceived: (json['quantityReceived'] as num?)?.toInt() ?? 0,
    );
  }

  int get outstanding => (quantity - quantityReceived).clamp(0, quantity);

  bool get isFullyReceived => outstanding == 0;

  double get lineTotal => quantity * unitPrice;
}

class PurchaseOrder {
  final String id;
  final String supplierId;
  final String supplierName;
  final List<PurchaseOrderItem> items;
  final String status; // pending | partial | received | cancelled
  final String createdAt;
  final String? receivedAt;

  const PurchaseOrder({
    required this.id,
    required this.supplierId,
    required this.supplierName,
    required this.items,
    required this.status,
    required this.createdAt,
    this.receivedAt,
  });

  factory PurchaseOrder.fromJson(Map<String, dynamic> json) {
    return PurchaseOrder(
      id: json['id'] as String? ?? '',
      supplierId: json['supplierId'] as String? ?? '',
      supplierName: json['supplierName'] as String? ?? '',
      items: (json['items'] as List<dynamic>? ?? [])
          .map((e) => PurchaseOrderItem.fromJson(e as Map<String, dynamic>))
          .toList(),
      status: json['status'] as String? ?? 'pending',
      createdAt: json['createdAt'] as String? ?? '',
      receivedAt: json['receivedAt'] as String?,
    );
  }

  bool get isOpen => status == 'pending' || status == 'partial';

  bool get canCancel => isOpen && items.every((item) => item.quantityReceived == 0);

  double get totalValue => items.fold(0, (sum, item) => sum + item.lineTotal);
}
