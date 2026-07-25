class Supplier {
  final String id;
  final String name;
  final String contactEmail;
  final String address;
  final String? phone;
  final String? gstin;
  final String? contactPerson;
  final String? status;

  const Supplier({
    required this.id,
    required this.name,
    required this.contactEmail,
    required this.address,
    this.phone,
    this.gstin,
    this.contactPerson,
    this.status,
  });

  factory Supplier.fromJson(Map<String, dynamic> json) {
    return Supplier(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      contactEmail: json['contactEmail'] as String? ?? '',
      address: json['address'] as String? ?? '',
      phone: json['phone'] as String?,
      gstin: json['gstin'] as String?,
      contactPerson: json['contactPerson'] as String?,
      status: json['status'] as String?,
    );
  }

  bool get isActive => status != 'inactive';
}
