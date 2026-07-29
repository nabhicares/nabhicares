import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../shared_models/app_notification.dart';
import '../../../shared_models/appointment.dart';
import '../../../shared_models/doctor_profile.dart';
import '../../../shared_models/invoice.dart';
import '../../../shared_models/patient_record.dart';
import '../../../shared_models/prescription.dart';
import '../../../shared_models/user_profile.dart';

/// Seeded demo IDs used when the mock login token does not map 1:1 to Firestore.
class CareDemoIds {
  static const doctorId = '5D4181ZA';
  static const patientId = 'BADP1K3A';
}

class CareRepository {
  final ApiClient _api;

  CareRepository(this._api);

  Future<List<Appointment>> fetchDoctorAppointments(String doctorId) async {
    final result = await _api.get('/appointments/doctor/$doctorId');
    return result.list.map(Appointment.fromJson).toList();
  }

  Future<List<Appointment>> fetchPatientAppointments(String patientId) async {
    final result = await _api.get('/appointments/patient/$patientId');
    return result.list.map(Appointment.fromJson).toList();
  }

  Future<void> completeAppointment(String id) =>
      _api.put('/appointments/$id/complete');

  Future<void> cancelAppointment(String id) =>
      _api.put('/appointments/$id/cancel');

  Future<List<PatientRecord>> fetchPatients() async {
    final result = await _api.get('/patients');
    return result.list.map(PatientRecord.fromJson).toList();
  }

  Future<PatientRecord> fetchPatient(String id) async {
    final result = await _api.get('/patients/$id');
    return PatientRecord.fromJson(result.map);
  }

  Future<PatientRecord> createPatient(Map<String, dynamic> body) async {
    final result = await _api.post('/patients', body: body);
    return PatientRecord.fromJson(result.map);
  }

  Future<PatientRecord> updatePatient(String id, Map<String, dynamic> body) async {
    final result = await _api.put('/patients/$id', body: body);
    return PatientRecord.fromJson(result.map);
  }

  Future<Appointment> bookAppointment({
    required String patientId,
    required String doctorId,
    required String date,
    required String timeSlot,
  }) async {
    final result = await _api.post('/appointments', body: {
      'patientId': patientId,
      'doctorId': doctorId,
      'date': date,
      'timeSlot': timeSlot,
    });
    return Appointment.fromJson(result.map);
  }

  Future<List<Map<String, dynamic>>> fetchDoctorSlots(String doctorId, String date) async {
    final result = await _api.get('/doctors/$doctorId/slots', query: {'date': date});
    return (result.data as List<dynamic>? ?? [])
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
  }

  Future<void> recordPayment({
    required String invoiceId,
    required double amount,
    required String method,
  }) async {
    await _api.post('/billing/invoices/$invoiceId/pay', body: {
      'amount': amount,
      'method': method,
    });
  }

  Future<List<DoctorProfile>> fetchDoctors() async {
    final result = await _api.get('/doctors');
    return result.list.map(DoctorProfile.fromJson).toList();
  }

  Future<DoctorProfile> fetchDoctor(String id) async {
    final result = await _api.get('/doctors/$id');
    return DoctorProfile.fromJson(result.map);
  }

  Future<DoctorSchedule> fetchSchedule(String doctorId) async {
    final result = await _api.get('/doctors/$doctorId/schedule');
    return DoctorSchedule.fromJson(result.map);
  }

  Future<void> saveSchedule({
    required String doctorId,
    required int slotDurationMinutes,
    required List<DaySchedule> weeklySchedules,
  }) {
    return _api.put('/doctors/$doctorId/schedule', body: {
      'slotDurationMinutes': slotDurationMinutes,
      'weeklySchedules': weeklySchedules.map((e) => e.toJson()).toList(),
    });
  }

  Future<List<Prescription>> fetchPatientPrescriptions(String patientId) async {
    final result = await _api.get('/prescriptions/patient/$patientId');
    return result.list.map(Prescription.fromJson).toList();
  }

  Future<List<Invoice>> fetchPatientInvoices(String patientId) async {
    final result = await _api.get('/billing/invoices/patient/$patientId');
    return result.list.map(Invoice.fromJson).toList();
  }

  Future<List<AppNotification>> fetchNotifications() async {
    final result = await _api.get('/notifications');
    return result.list.map(AppNotification.fromJson).toList();
  }

  Future<UserProfile> fetchMe() async {
    final result = await _api.get('/users/me');
    return UserProfile.fromJson(result.map);
  }

  Future<void> deleteMyAccount() async {
    await _api.delete('/users/me');
  }
}

final careRepositoryPrv = Provider<CareRepository>(
  (ref) => CareRepository(ref.watch(apiClientPrv)),
);

final doctorAppointmentsPrv = FutureProvider.autoDispose<List<Appointment>>((ref) {
  return ref.watch(careRepositoryPrv).fetchDoctorAppointments(CareDemoIds.doctorId);
});

final patientAppointmentsPrv = FutureProvider.autoDispose<List<Appointment>>((ref) {
  return ref.watch(careRepositoryPrv).fetchPatientAppointments(CareDemoIds.patientId);
});

final patientsRegistryPrv = FutureProvider.autoDispose<List<PatientRecord>>((ref) {
  return ref.watch(careRepositoryPrv).fetchPatients();
});

final doctorSchedulePrv = FutureProvider.autoDispose<DoctorSchedule>((ref) {
  return ref.watch(careRepositoryPrv).fetchSchedule(CareDemoIds.doctorId);
});

final doctorProfilePrv = FutureProvider.autoDispose<DoctorProfile>((ref) {
  return ref.watch(careRepositoryPrv).fetchDoctor(CareDemoIds.doctorId);
});

final patientPrescriptionsPrv = FutureProvider.autoDispose<List<Prescription>>((ref) {
  return ref.watch(careRepositoryPrv).fetchPatientPrescriptions(CareDemoIds.patientId);
});

final patientInvoicesPrv = FutureProvider.autoDispose<List<Invoice>>((ref) {
  return ref.watch(careRepositoryPrv).fetchPatientInvoices(CareDemoIds.patientId);
});

final notificationsPrv = FutureProvider.autoDispose<List<AppNotification>>((ref) {
  return ref.watch(careRepositoryPrv).fetchNotifications();
});

final myProfilePrv = FutureProvider.autoDispose<UserProfile>((ref) {
  return ref.watch(careRepositoryPrv).fetchMe();
});
