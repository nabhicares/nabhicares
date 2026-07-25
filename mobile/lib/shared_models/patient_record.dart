class PatientRecord {
  final String id;
  final String? uid;
  final String name;
  final String email;
  final String phone;
  final String dateOfBirth;
  final String gender;
  final List<String> allergies;
  final List<String> medicalHistory;

  const PatientRecord({
    required this.id,
    required this.name,
    required this.email,
    required this.phone,
    required this.dateOfBirth,
    required this.gender,
    required this.allergies,
    required this.medicalHistory,
    this.uid,
  });

  factory PatientRecord.fromJson(Map<String, dynamic> json) {
    return PatientRecord(
      id: json['id'] as String? ?? '',
      uid: json['uid'] as String?,
      name: json['name'] as String? ?? '',
      email: json['email'] as String? ?? '',
      phone: json['phone'] as String? ?? '',
      dateOfBirth: json['dateOfBirth'] as String? ?? '',
      gender: json['gender'] as String? ?? '',
      allergies: List<String>.from(json['allergies'] ?? const []),
      medicalHistory: List<String>.from(json['medicalHistory'] ?? const []),
    );
  }
}
