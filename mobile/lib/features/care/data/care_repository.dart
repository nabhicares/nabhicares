import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_controller.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_exception.dart';
import '../../../shared_models/app_notification.dart';
import '../../../shared_models/appointment.dart';
import '../../../shared_models/doctor_profile.dart';
import '../../../shared_models/invoice.dart';
import '../../../shared_models/patient_record.dart';
import '../../../shared_models/prescription.dart';

/// Consultation slots offered to patients, matching the web portal.
const consultationSlots = [
  '09:00',
  '09:30',
  '10:00',
  '10:30',
  '11:00',
  '11:30',
  '14:00',
  '14:30',
  '15:00',
  '15:30',
  '16:00',
  '16:30',
];

class CareRepository {
  final ApiClient _api;

  CareRepository(this._api);

  Future<List<Appointment>> fetchDoctorAppointments(String registration) async {
    final result = await _api.get(
      '/appointments',
      query: {'doctorId': registration, 'limit': 100},
    );
    return result.list.map(Appointment.fromJson).toList();
  }

  Future<List<Appointment>> fetchPatientAppointments(String recordNumber) async {
    final result = await _api.get(
      '/appointments',
      query: {'patientId': recordNumber, 'limit': 100},
    );
    return result.list.map(Appointment.fromJson).toList();
  }

  /// Statuses a visit moves through, in order. The API rejects a jump.
  static const visitStages = [
    'booked',
    'confirmed',
    'checked_in',
    'consultation',
    'completed',
  ];

  Future<void> setAppointmentStatus(String id, String status, {String? note}) {
    return _api.patch(
      '/appointments/$id/status',
      body: {'status': status, if (note != null) 'note': note},
    );
  }

  Future<void> cancelAppointment(String id) =>
      setAppointmentStatus(id, 'cancelled');

  Future<List<PatientRecord>> fetchPatients({String? query}) async {
    final result = await _api.get('/patients', query: {'q': query, 'limit': 100});
    return result.list.map(PatientRecord.fromJson).toList();
  }

  Future<PatientRecord> createPatient(Map<String, dynamic> body) async {
    final result = await _api.post('/patients', body: body);
    return PatientRecord.fromJson(result.map);
  }

  Future<PatientRecord> updatePatient(String id, Map<String, dynamic> body) async {
    final result = await _api.patch('/patients/$id', body: body);
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

  /// Slots the doctor still has free on [date].
  Future<List<String>> fetchFreeSlots(String registration, String date) async {
    final booked = (await fetchDoctorAppointments(registration))
        .where((a) => a.date == date && a.status != 'cancelled')
        .map((a) => a.timeSlot)
        .toSet();
    return consultationSlots.where((slot) => !booked.contains(slot)).toList();
  }

  Future<void> recordPayment({
    required String invoiceId,
    required double amount,
    required String method,
    String? reference,
  }) async {
    await _api.post('/billing/payments', body: {
      'invoice_id': invoiceId,
      'amount': amount,
      'payment_method': method,
      if (reference != null) 'transaction_reference': reference,
    });
  }

  Future<List<DoctorProfile>> fetchDoctors() async {
    final result = await _api.get('/doctors', query: {'limit': 100});
    return result.list.map(DoctorProfile.fromJson).toList();
  }

  Future<List<Prescription>> fetchPatientPrescriptions(String recordNumber) async {
    final result = await _api.get(
      '/prescriptions',
      query: {'patientId': recordNumber, 'limit': 100},
    );
    return result.list.map(Prescription.fromJson).toList();
  }

  Future<List<Invoice>> fetchPatientInvoices(String recordNumber) async {
    final result = await _api.get('/billing/invoices/patient/$recordNumber');
    return result.list.map(Invoice.fromJson).toList();
  }

  Future<List<AppNotification>> fetchNotifications() async {
    final result = await _api.get('/notifications');
    return result.list.map(AppNotification.fromJson).toList();
  }
}

final careRepositoryPrv = Provider<CareRepository>(
  (ref) => CareRepository(ref.watch(apiClientPrv)),
);

/// The record number of the signed-in patient, or a message explaining why the
/// hospital has not linked one yet.
String _ownRecordNumber(Ref ref) {
  final recordNumber = ref.watch(authStatePrv).patientId;
  if (recordNumber.isEmpty) {
    throw const ApiException(
      code: 'NO_PATIENT_RECORD',
      message: 'This login is not linked to a patient record yet. '
          'Ask the hospital front desk to link it.',
    );
  }
  return recordNumber;
}

String _ownRegistration(Ref ref) {
  final registration = ref.watch(authStatePrv).doctorId;
  if (registration.isEmpty) {
    throw const ApiException(
      code: 'NO_DOCTOR_RECORD',
      message: 'This login is not linked to a doctor record yet. '
          'Ask your hospital administrator to link it.',
    );
  }
  return registration;
}

final doctorAppointmentsPrv = FutureProvider.autoDispose<List<Appointment>>((ref) {
  return ref.watch(careRepositoryPrv).fetchDoctorAppointments(_ownRegistration(ref));
});

final patientAppointmentsPrv = FutureProvider.autoDispose<List<Appointment>>((ref) {
  return ref.watch(careRepositoryPrv).fetchPatientAppointments(_ownRecordNumber(ref));
});

final patientsRegistryPrv = FutureProvider.autoDispose<List<PatientRecord>>((ref) {
  return ref.watch(careRepositoryPrv).fetchPatients();
});

final doctorsListPrv = FutureProvider.autoDispose<List<DoctorProfile>>((ref) {
  return ref.watch(careRepositoryPrv).fetchDoctors();
});

/// The doctor record behind the signed-in doctor account.
final doctorProfilePrv = FutureProvider.autoDispose<DoctorProfile>((ref) async {
  final registration = _ownRegistration(ref);
  final doctors = await ref.watch(careRepositoryPrv).fetchDoctors();
  return doctors.firstWhere(
    (doctor) => doctor.id == registration || doctor.registrationNumber == registration,
    orElse: () => throw const ApiException(
      code: 'DOCTOR_NOT_FOUND',
      message: 'Your doctor record is no longer listed for this hospital.',
    ),
  );
});

final patientPrescriptionsPrv = FutureProvider.autoDispose<List<Prescription>>((ref) {
  return ref.watch(careRepositoryPrv).fetchPatientPrescriptions(_ownRecordNumber(ref));
});

final patientInvoicesPrv = FutureProvider.autoDispose<List<Invoice>>((ref) {
  return ref.watch(careRepositoryPrv).fetchPatientInvoices(_ownRecordNumber(ref));
});

final notificationsPrv = FutureProvider.autoDispose<List<AppNotification>>((ref) {
  return ref.watch(careRepositoryPrv).fetchNotifications();
});
