import '../core/utils/parsers.dart';

class DoctorProfile {
  final String id;
  final String registrationNumber;
  final String name;
  final String email;
  final String phone;
  final String specialty;
  final double consultationFee;

  const DoctorProfile({
    required this.id,
    required this.name,
    required this.email,
    required this.specialty,
    required this.consultationFee,
    this.registrationNumber = '',
    this.phone = '',
  });

  factory DoctorProfile.fromJson(Map<String, dynamic> json) {
    return DoctorProfile(
      id: json['id'] as String? ?? '',
      registrationNumber: json['registrationNumber'] as String? ?? '',
      name: json['name'] as String? ?? '',
      email: json['email'] as String? ?? '',
      phone: json['phone'] as String? ?? '',
      specialty: json['specialty'] as String? ?? json['specialization'] as String? ?? '',
      consultationFee: asDouble(json['consultationFee']),
    );
  }
}
