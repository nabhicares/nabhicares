class DaySchedule {
  final String dayOfWeek;
  final String startTime;
  final String endTime;

  const DaySchedule({
    required this.dayOfWeek,
    required this.startTime,
    required this.endTime,
  });

  factory DaySchedule.fromJson(Map<String, dynamic> json) {
    return DaySchedule(
      dayOfWeek: json['dayOfWeek'] as String? ?? '',
      startTime: json['startTime'] as String? ?? '',
      endTime: json['endTime'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() => {
        'dayOfWeek': dayOfWeek,
        'startTime': startTime,
        'endTime': endTime,
      };

  String get label => '$dayOfWeek  $startTime–$endTime';
}

class DoctorSchedule {
  final int slotDurationMinutes;
  final List<DaySchedule> weeklySchedules;

  const DoctorSchedule({
    required this.slotDurationMinutes,
    required this.weeklySchedules,
  });

  factory DoctorSchedule.fromJson(Map<String, dynamic> json) {
    return DoctorSchedule(
      slotDurationMinutes: (json['slotDurationMinutes'] as num?)?.toInt() ?? 30,
      weeklySchedules: (json['weeklySchedules'] as List<dynamic>? ?? [])
          .map((e) => DaySchedule.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}

class DoctorProfile {
  final String id;
  final String? uid;
  final String name;
  final String email;
  final String specialty;
  final double consultationFee;
  final String? qualifications;

  const DoctorProfile({
    required this.id,
    required this.name,
    required this.email,
    required this.specialty,
    required this.consultationFee,
    this.uid,
    this.qualifications,
  });

  factory DoctorProfile.fromJson(Map<String, dynamic> json) {
    return DoctorProfile(
      id: json['id'] as String? ?? '',
      uid: json['uid'] as String?,
      name: json['name'] as String? ?? '',
      email: json['email'] as String? ?? '',
      specialty: json['specialty'] as String? ?? '',
      consultationFee: (json['consultationFee'] as num?)?.toDouble() ?? 0,
      qualifications: json['qualifications'] as String?,
    );
  }
}
