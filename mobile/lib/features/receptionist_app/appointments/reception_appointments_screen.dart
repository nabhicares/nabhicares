import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/empty_state.dart';
import '../../../core/widgets/loading_indicator.dart';
import '../../../core/widgets/status_chip.dart';
import '../../../shared_models/appointment.dart';
import '../../../shared_models/doctor_profile.dart';
import '../../../shared_models/patient_record.dart';
import '../../care/data/care_repository.dart';

final _receptionDoctorsPrv = FutureProvider.autoDispose<List<DoctorProfile>>((ref) {
  return ref.watch(careRepositoryPrv).fetchDoctors();
});

final _deskAppointmentsPrv =
    FutureProvider.autoDispose.family<List<Appointment>, String>((ref, doctorId) {
  return ref.watch(careRepositoryPrv).fetchDoctorAppointments(doctorId);
});

class ReceptionAppointmentsScreen extends ConsumerStatefulWidget {
  const ReceptionAppointmentsScreen({super.key});

  @override
  ConsumerState<ReceptionAppointmentsScreen> createState() =>
      _ReceptionAppointmentsScreenState();
}

class _ReceptionAppointmentsScreenState
    extends ConsumerState<ReceptionAppointmentsScreen> {
  String? _selectedDoctorId;

  @override
  Widget build(BuildContext context) {
    final doctorsAsync = ref.watch(_receptionDoctorsPrv);
    final patientsAsync = ref.watch(patientsRegistryPrv);

    return Scaffold(
      appBar: AppBar(title: const Text('Appointments')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          final doctors = doctorsAsync.valueOrNull ?? const <DoctorProfile>[];
          final patients = patientsAsync.valueOrNull ?? const <PatientRecord>[];
          if (doctors.isEmpty || patients.isEmpty) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Need at least one patient and one doctor to book.'),
              ),
            );
            return;
          }
          _openBookSheet(context, patients, doctors);
        },
        icon: const Icon(Icons.event_available_rounded),
        label: const Text('Book'),
      ),
      body: doctorsAsync.when(
        loading: () => const LoadingIndicator(message: 'Loading doctors...'),
        error: (e, _) => EmptyState(
          title: 'Could not load doctors',
          description: '$e',
          icon: Icons.cloud_off_rounded,
          actionLabel: 'Retry',
          onActionPressed: () => ref.invalidate(_receptionDoctorsPrv),
        ),
        data: (doctors) {
          if (doctors.isEmpty) {
            return const EmptyState(
              title: 'No doctors',
              description: 'Doctor profiles are required to book appointments.',
              icon: Icons.medical_services_outlined,
            );
          }
          final doctorId = _selectedDoctorId ??
              (doctors.first.registrationNumber.isNotEmpty
                  ? doctors.first.registrationNumber
                  : doctors.first.id);
          if (_selectedDoctorId == null) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (mounted) setState(() => _selectedDoctorId = doctorId);
            });
          }

          final apptsAsync = ref.watch(_deskAppointmentsPrv(doctorId));

          return Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                child: DropdownButtonFormField<String>(
                  value: doctorId,
                  decoration: const InputDecoration(
                    labelText: 'Doctor calendar',
                    border: OutlineInputBorder(),
                  ),
                  items: doctors
                      .map(
                        (d) => DropdownMenuItem(
                          value: d.id,
                          child: Text('${d.name} · ${d.specialty}'),
                        ),
                      )
                      .toList(),
                  onChanged: (v) => setState(() => _selectedDoctorId = v),
                ),
              ),
              Expanded(
                child: RefreshIndicator(
                  onRefresh: () async {
                    ref.invalidate(_deskAppointmentsPrv(doctorId));
                    await ref.read(_deskAppointmentsPrv(doctorId).future);
                  },
                  child: apptsAsync.when(
                    loading: () =>
                        const LoadingIndicator(message: 'Loading appointments...'),
                    error: (e, _) => EmptyState(
                      title: 'Could not load appointments',
                      description: '$e',
                      icon: Icons.cloud_off_rounded,
                      actionLabel: 'Retry',
                      onActionPressed: () =>
                          ref.invalidate(_deskAppointmentsPrv(doctorId)),
                    ),
                    data: (appts) {
                      final sorted = [...appts]
                        ..sort((a, b) {
                          final c = b.date.compareTo(a.date);
                          return c != 0 ? c : b.timeSlot.compareTo(a.timeSlot);
                        });
                      if (sorted.isEmpty) {
                        return ListView(
                          children: const [
                            SizedBox(height: 80),
                            EmptyState(
                              title: 'No appointments',
                              description: 'Book a slot for this doctor to get started.',
                              icon: Icons.event_busy_outlined,
                            ),
                          ],
                        );
                      }
                      return ListView.separated(
                        padding: const EdgeInsets.fromLTRB(16, 8, 16, 88),
                        itemCount: sorted.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 10),
                        itemBuilder: (context, i) {
                          final a = sorted[i];
                          return Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: AppColors.surface,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: AppColors.border),
                            ),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        a.patientName,
                                        style: const TextStyle(fontWeight: FontWeight.w700),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        '${a.date} · ${a.timeSlot}',
                                        style: const TextStyle(
                                          color: AppColors.textSecondary,
                                        ),
                                      ),
                                      const SizedBox(height: 6),
                                      StatusChip(
                                        label: a.status,
                                        tone: a.status == 'booked'
                                            ? StatusTone.info
                                            : a.status == 'cancelled'
                                                ? StatusTone.critical
                                                : StatusTone.success,
                                      ),
                                    ],
                                  ),
                                ),
                                if (a.status == 'booked')
                                  TextButton(
                                    onPressed: () => _cancel(a),
                                    child: const Text('Cancel'),
                                  ),
                              ],
                            ),
                          );
                        },
                      );
                    },
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _cancel(Appointment appointment) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cancel appointment?'),
        content: Text(
          'Cancel ${appointment.patientName} on ${appointment.date} at ${appointment.timeSlot}?',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Keep')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(foregroundColor: AppColors.critical),
            child: const Text('Cancel booking'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(careRepositoryPrv).cancelAppointment(appointment.id);
      ref.invalidate(_deskAppointmentsPrv(appointment.doctorId));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Appointment cancelled.')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Cancel failed: $e')),
        );
      }
    }
  }

  Future<void> _openBookSheet(
    BuildContext context,
    List<PatientRecord> patients,
    List<DoctorProfile> doctors,
  ) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => _BookAppointmentSheet(
        patients: patients,
        doctors: doctors,
        initialDoctorId: _selectedDoctorId ?? doctors.first.id,
        onBooked: (doctorId) {
          ref.invalidate(_deskAppointmentsPrv(doctorId));
          setState(() => _selectedDoctorId = doctorId);
        },
      ),
    );
  }
}

class _BookAppointmentSheet extends ConsumerStatefulWidget {
  final List<PatientRecord> patients;
  final List<DoctorProfile> doctors;
  final String initialDoctorId;
  final void Function(String doctorId) onBooked;

  const _BookAppointmentSheet({
    required this.patients,
    required this.doctors,
    required this.initialDoctorId,
    required this.onBooked,
  });

  @override
  ConsumerState<_BookAppointmentSheet> createState() => _BookAppointmentSheetState();
}

class _BookAppointmentSheetState extends ConsumerState<_BookAppointmentSheet> {
  late String _patientId;
  late String _doctorId;
  DateTime _date = DateTime.now().add(const Duration(days: 1));
  String? _slot;
  List<String> _slots = const [];
  bool _loadingSlots = false;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _patientId = widget.patients.first.bookingId;
    _doctorId = widget.initialDoctorId;
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadSlots());
  }

  String get _dateStr {
    final y = _date.year.toString().padLeft(4, '0');
    final m = _date.month.toString().padLeft(2, '0');
    final d = _date.day.toString().padLeft(2, '0');
    return '$y-$m-$d';
  }

  Future<void> _loadSlots() async {
    setState(() {
      _loadingSlots = true;
      _slot = null;
    });
    try {
      final slots =
          await ref.read(careRepositoryPrv).fetchFreeSlots(_doctorId, _dateStr);
      if (mounted) {
        setState(() {
          _slots = slots;
          _loadingSlots = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _slots = const [];
          _loadingSlots = false;
        });
      }
    }
  }

  Future<void> _book() async {
    if (_slot == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Select an available time slot.')),
      );
      return;
    }
    setState(() => _submitting = true);
    try {
      await ref.read(careRepositoryPrv).bookAppointment(
            patientId: _patientId,
            doctorId: _doctorId,
            date: _dateStr,
            timeSlot: _slot!,
          );
      widget.onBooked(_doctorId);
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Appointment booked.')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Booking failed: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final available = _slots;

    return Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Book appointment', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              value: _patientId,
              decoration: const InputDecoration(labelText: 'Patient'),
              items: widget.patients
                  .map(
                    (p) => DropdownMenuItem(
                      value: p.bookingId,
                      child: Text(
                        p.medicalRecordNumber.isEmpty
                            ? p.name
                            : '${p.name} · ${p.medicalRecordNumber}',
                      ),
                    ),
                  )
                  .toList(),
              onChanged: (v) => setState(() => _patientId = v ?? _patientId),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              value: _doctorId,
              decoration: const InputDecoration(labelText: 'Doctor'),
              items: widget.doctors
                  .map(
                    (d) => DropdownMenuItem(
                      value: d.registrationNumber.isNotEmpty
                          ? d.registrationNumber
                          : d.id,
                      child: Text(
                        '${d.name}${d.specialty.isEmpty ? '' : ' · ${d.specialty}'}',
                      ),
                    ),
                  )
                  .toList(),
              onChanged: (v) {
                setState(() => _doctorId = v ?? _doctorId);
                _loadSlots();
              },
            ),
            const SizedBox(height: 12),
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Date'),
              subtitle: Text(_dateStr),
              trailing: const Icon(Icons.calendar_today_outlined),
              onTap: () async {
                final picked = await showDatePicker(
                  context: context,
                  initialDate: _date,
                  firstDate: DateTime.now(),
                  lastDate: DateTime.now().add(const Duration(days: 90)),
                );
                if (picked != null) {
                  setState(() => _date = picked);
                  await _loadSlots();
                }
              },
            ),
            const SizedBox(height: 8),
            const Text('Available slots', style: TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            if (_loadingSlots)
              const Padding(
                padding: EdgeInsets.all(16),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (available.isEmpty)
              const Text(
                'No open slots for this day.',
                style: TextStyle(color: AppColors.textSecondary),
              )
            else
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: available.map((t) {
                  final selected = _slot == t;
                  return ChoiceChip(
                    label: Text(t),
                    selected: selected,
                    onSelected: (_) => setState(() => _slot = t),
                  );
                }).toList(),
              ),
            const SizedBox(height: 20),
            AppButton(
              label: 'Confirm booking',
              isLoading: _submitting,
              onPressed: _book,
            ),
          ],
        ),
      ),
    );
  }
}
