class BatchItem {
  final String batchNo;
  final String expiryDate;
  final int quantity;
  final double unitPrice;

  BatchItem({
    required this.batchNo,
    required this.expiryDate,
    required this.quantity,
    required this.unitPrice,
  });

  factory BatchItem.fromJson(Map<String, dynamic> json) {
    return BatchItem(
      batchNo: json['batchNo'] as String? ?? '',
      expiryDate: json['expiryDate'] as String? ?? '',
      quantity: json['quantity'] as int? ?? 0,
      unitPrice: (json['unitPrice'] as num?)?.toDouble() ?? 0.0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'batchNo': batchNo,
      'expiryDate': expiryDate,
      'quantity': quantity,
      'unitPrice': unitPrice,
    };
  }
}

class Medicine {
  final String id;
  final String name;
  final String genericName;
  final String category;
  final int reorderLevel;
  final int totalQuantity;
  final List<BatchItem> batches;
  final String? brand;
  final String? form;
  final String? strength;
  final String? unit;
  final int? packSize;
  final double? mrp;
  final double? gstPercent;
  final String? barcode;
  final String? location;
  final String? status;

  Medicine({
    required this.id,
    required this.name,
    required this.genericName,
    required this.category,
    required this.reorderLevel,
    required this.totalQuantity,
    required this.batches,
    this.brand,
    this.form,
    this.strength,
    this.unit,
    this.packSize,
    this.mrp,
    this.gstPercent,
    this.barcode,
    this.location,
    this.status,
  });

  factory Medicine.fromJson(Map<String, dynamic> json) {
    final list = json['batches'] as List<dynamic>? ?? [];
    final batchList = list.map((e) => BatchItem.fromJson(e as Map<String, dynamic>)).toList();
    
    return Medicine(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      genericName: json['genericName'] as String? ?? '',
      category: json['category'] as String? ?? '',
      reorderLevel: json['reorderLevel'] as int? ?? 0,
      totalQuantity: json['totalQuantity'] as int? ?? 0,
      batches: batchList,
      brand: json['brand'] as String?,
      form: json['form'] as String?,
      strength: json['strength'] as String?,
      unit: json['unit'] as String?,
      packSize: json['packSize'] as int?,
      mrp: (json['mrp'] as num?)?.toDouble(),
      gstPercent: (json['gstPercent'] as num?)?.toDouble(),
      barcode: json['barcode'] as String?,
      location: json['location'] as String?,
      status: json['status'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'genericName': genericName,
      'category': category,
      'reorderLevel': reorderLevel,
      'totalQuantity': totalQuantity,
      'batches': batches.map((e) => e.toJson()).toList(),
      'brand': brand,
      'form': form,
      'strength': strength,
      'unit': unit,
      'packSize': packSize,
      'mrp': mrp,
      'gstPercent': gstPercent,
      'barcode': barcode,
      'location': location,
      'status': status,
    };
  }
}
