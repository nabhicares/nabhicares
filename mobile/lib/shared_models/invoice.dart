class InvoiceItem {
  final String description;
  final double amount;

  const InvoiceItem({required this.description, required this.amount});

  factory InvoiceItem.fromJson(Map<String, dynamic> json) => InvoiceItem(
        description: json['description'] as String? ?? '',
        amount: (json['amount'] as num?)?.toDouble() ?? 0,
      );
}

class Invoice {
  final String id;
  final List<InvoiceItem> items;
  final double totalAmount;
  final String status;
  final String createdAt;

  const Invoice({
    required this.id,
    required this.items,
    required this.totalAmount,
    required this.status,
    required this.createdAt,
  });

  factory Invoice.fromJson(Map<String, dynamic> json) => Invoice(
        id: json['id'] as String? ?? '',
        items: (json['items'] as List<dynamic>? ?? [])
            .map((e) => InvoiceItem.fromJson(e as Map<String, dynamic>))
            .toList(),
        totalAmount: (json['totalAmount'] as num?)?.toDouble() ?? 0,
        status: json['status'] as String? ?? 'unpaid',
        createdAt: json['createdAt'] as String? ?? '',
      );
}
