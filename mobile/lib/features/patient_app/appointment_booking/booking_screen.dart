import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/auth/auth_controller.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_card.dart';
import '../../../shared_models/doctor_profile.dart';
import '../../care/data/care_repository.dart';

/// Slots the doctor still has free on a given day.
final _freeSlotsPrv = FutureProvider.autoDispose
    .family<List<String>, ({String doctor, String date})>((ref, key) {
  return ref.watch(careRepositoryPrv).fetchFreeSlots(key.doctor, key.date);
});

String _isoDate(DateTime day) =>
    '${day.year}-${day.month.toString().padLeft(2, '0')}-${day.day.toString().padLeft(2, '0')}';

class BookingScreen extends ConsumerStatefulWidget {
  final DoctorProfile doctor;

  const BookingScreen({super.key, required this.doctor});

  @override
  ConsumerState<BookingScreen> createState() => _BookingScreenState();
}

class _BookingScreenState extends ConsumerState<BookingScreen> {
  DateTime _selectedDate = DateTime.now().add(const Duration(days: 1));
  String? _selectedTimeSlot;
  bool _isSubmitting = false;

  String get _doctorKey => widget.doctor.registrationNumber.isNotEmpty
      ? widget.doctor.registrationNumber
      : widget.doctor.id;

  Future<void> _handleBooking() async {
    final recordNumber = ref.read(authStatePrv).patientId;
    if (recordNumber.isEmpty) {
      _showError(
        'This login is not linked to a patient record yet. '
        'Ask the hospital front desk to link it.',
      );
      return;
    }
    if (_selectedTimeSlot == null) {
      _showError('Choose an appointment time.');
      return;
    }

    setState(() => _isSubmitting = true);
    try {
      await ref.read(careRepositoryPrv).bookAppointment(
            patientId: recordNumber,
            doctorId: _doctorKey,
            date: _isoDate(_selectedDate),
            timeSlot: _selectedTimeSlot!,
          );
      ref.invalidate(patientAppointmentsPrv);
      if (mounted) {
        setState(() => _isSubmitting = false);
        _showSuccessDialog();
      }
    } catch (error) {
      if (mounted) {
        setState(() => _isSubmitting = false);
        _showError('$error');
      }
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: AppColors.critical),
    );
  }

  void _showSuccessDialog() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Row(
          children: [
            Icon(Icons.check_circle_rounded, color: AppColors.success, size: 28),
            SizedBox(width: 12),
            Text('Visit booked'),
          ],
        ),
        content: Text(
          'Your appointment with ${widget.doctor.name} is booked for '
          '${formatDate(_isoDate(_selectedDate))} at $_selectedTimeSlot.',
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              Navigator.pop(context);
            },
            child: const Text('OK', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  Future<void> _selectDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime.now().add(const Duration(days: 1)),
      lastDate: DateTime.now().add(const Duration(days: 60)),
    );
    if (picked != null && picked != _selectedDate) {
      setState(() {
        _selectedDate = picked;
        _selectedTimeSlot = null;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final slotsAsync = ref.watch(
      _freeSlotsPrv((doctor: _doctorKey, date: _isoDate(_selectedDate))),
    );

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: Text(
          'Schedule Visit',
          style: theme.textTheme.titleLarge?.copyWith(
            fontWeight: FontWeight.bold,
            color: AppColors.textPrimary,
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AppCard(
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 24,
                    backgroundColor: AppColors.primary.withValues(alpha: 0.1),
                    child: const Icon(Icons.person, color: AppColors.primary),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.doctor.name,
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                          ),
                        ),
                        Text(
                          '${widget.doctor.specialty.isEmpty ? 'General medicine' : widget.doctor.specialty}'
                          ' • ${formatCurrency(widget.doctor.consultationFee)}',
                          style: const TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '1. Choose date',
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 12),
                  InkWell(
                    onTap: _selectDate,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                      decoration: BoxDecoration(
                        color: AppColors.background,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.grey.shade200),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              const Icon(
                                Icons.calendar_today,
                                color: AppColors.primary,
                                size: 20,
                              ),
                              const SizedBox(width: 12),
                              Text(
                                formatDate(_isoDate(_selectedDate)),
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.textPrimary,
                                ),
                              ),
                            ],
                          ),
                          const Text(
                            'Change',
                            style: TextStyle(
                              color: AppColors.primary,
                              fontWeight: FontWeight.bold,
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '2. Choose time',
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 12),
                  slotsAsync.when(
                    loading: () => const Center(
                      child: Padding(
                        padding: EdgeInsets.all(12),
                        child: CircularProgressIndicator(),
                      ),
                    ),
                    error: (error, _) => Text(
                      'Could not check availability: $error',
                      style: const TextStyle(color: AppColors.critical, fontSize: 13),
                    ),
                    data: (slots) => slots.isEmpty
                        ? const Text(
                            'Fully booked on this date. Pick another day.',
                            style: TextStyle(color: AppColors.textSecondary),
                          )
                        : Wrap(
                            spacing: 12,
                            runSpacing: 12,
                            children: [
                              for (final slot in slots)
                                ChoiceChip(
                                  label: Text(slot),
                                  selected: _selectedTimeSlot == slot,
                                  onSelected: (selected) => setState(
                                    () => _selectedTimeSlot = selected ? slot : null,
                                  ),
                                  selectedColor: AppColors.primary,
                                  backgroundColor: AppColors.background,
                                  labelStyle: TextStyle(
                                    color: _selectedTimeSlot == slot
                                        ? Colors.white
                                        : AppColors.textPrimary,
                                    fontWeight: _selectedTimeSlot == slot
                                        ? FontWeight.bold
                                        : FontWeight.normal,
                                  ),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(8),
                                    side: BorderSide(
                                      color: _selectedTimeSlot == slot
                                          ? AppColors.primary
                                          : Colors.grey.shade200,
                                    ),
                                  ),
                                ),
                            ],
                          ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 28),
            AppButton(
              label: 'Confirm booking',
              isLoading: _isSubmitting,
              onPressed: _handleBooking,
            ),
          ],
        ),
      ),
    );
  }
}
