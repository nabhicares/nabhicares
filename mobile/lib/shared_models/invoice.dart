import '../core/utils/parsers.dart';

class InvoiceItem {
  final String description;
  final double amount;

  const InvoiceItem({required this.description, required this.amount});

  factory InvoiceItem.fromJson(Map<String, dynamic> json) => InvoiceItem(
        description: json['description'] as String? ?? '',
        amount: asDouble(json['totalAmount'] ?? json['amount']),
      );
}

class Invoice {
  final String id;
  final String invoiceNumber;
  final List<InvoiceItem> items;
  final double totalAmount;
  final double paidAmount;
  final String status;
  final String createdAt;

  const Invoice({
    required this.id,
    required this.items,
    required this.totalAmount,
    required this.status,
    required this.createdAt,
    this.invoiceNumber = '',
    this.paidAmount = 0,
  });

  double get balance => totalAmount - paidAmount;

  factory Invoice.fromJson(Map<String, dynamic> json) => Invoice(
        id: json['id'] as String? ?? '',
        invoiceNumber: json['invoiceNumber'] as String? ?? '',
        items: (json['items'] as List<dynamic>? ?? [])
            .map((e) => InvoiceItem.fromJson(e as Map<String, dynamic>))
            .toList(),
        totalAmount: asDouble(json['totalAmount']),
        paidAmount: asDouble(json['paidAmount']),
        status: json['status'] as String? ?? 'unpaid',
        createdAt: json['createdAt'] as String? ?? '',
      );
}
