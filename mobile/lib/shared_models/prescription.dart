class PrescriptionItem {
  final String medicineId;
  final String medicineName;
  final String dosage;
  final String duration;
  final String instructions;
  final String status;

  PrescriptionItem({
    required this.medicineId,
    required this.medicineName,
    required this.dosage,
    required this.duration,
    required this.instructions,
    required this.status,
  });

  factory PrescriptionItem.fromJson(Map<String, dynamic> json) {
    return PrescriptionItem(
      medicineId: json['medicineId'] as String? ?? '',
      medicineName: json['medicineName'] as String? ?? '',
      dosage: json['dosage'] as String? ?? '',
      duration: json['duration'] as String? ?? '',
      instructions: json['instructions'] as String? ?? '',
      status: json['status'] as String? ?? 'pending',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'medicineId': medicineId,
      'medicineName': medicineName,
      'dosage': dosage,
      'duration': duration,
      'instructions': instructions,
      'status': status,
    };
  }
}

class Prescription {
  final String id;
  final String consultationId;
  final String patientId;
  final String doctorId;
  final List<PrescriptionItem> items;
  final String status;
  final String createdAt;

  Prescription({
    required this.id,
    required this.consultationId,
    required this.patientId,
    required this.doctorId,
    required this.items,
    required this.status,
    required this.createdAt,
  });

  factory Prescription.fromJson(Map<String, dynamic> json) {
    final list = json['items'] as List<dynamic>? ?? [];
    final itemsList = list.map((e) => PrescriptionItem.fromJson(e as Map<String, dynamic>)).toList();
    
    return Prescription(
      id: json['id'] as String? ?? '',
      consultationId: json['consultationId'] as String? ?? '',
      patientId: json['patientId'] as String? ?? '',
      doctorId: json['doctorId'] as String? ?? '',
      items: itemsList,
      status: json['status'] as String? ?? 'pending',
      createdAt: json['createdAt'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'consultationId': consultationId,
      'patientId': patientId,
      'doctorId': doctorId,
      'items': items.map((e) => e.toJson()).toList(),
      'status': status,
      'createdAt': createdAt,
    };
  }
}
