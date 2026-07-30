class PatientRecord {
  final String id;
  final String medicalRecordNumber;
  final String name;
  final String email;
  final String phone;
  final String dateOfBirth;
  final String gender;
  final String bloodGroup;
  final String status;

  const PatientRecord({
    required this.id,
    required this.name,
    required this.email,
    required this.phone,
    required this.dateOfBirth,
    required this.gender,
    this.medicalRecordNumber = '',
    this.bloodGroup = '',
    this.status = 'active',
  });

  /// Prefer the hospital's own record number when talking to the API.
  String get bookingId =>
      medicalRecordNumber.isNotEmpty ? medicalRecordNumber : id;

  factory PatientRecord.fromJson(Map<String, dynamic> json) {
    return PatientRecord(
      id: json['id'] as String? ?? '',
      medicalRecordNumber: json['medicalRecordNumber'] as String? ?? '',
      name: json['name'] as String? ?? '',
      email: json['email'] as String? ?? '',
      phone: json['phone'] as String? ?? '',
      dateOfBirth: json['dateOfBirth'] as String? ?? '',
      gender: json['gender'] as String? ?? '',
      bloodGroup: json['bloodGroup'] as String? ?? '',
      status: json['status'] as String? ?? 'active',
    );
  }
}
