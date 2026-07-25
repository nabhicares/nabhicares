import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_card.dart';

class BookingScreen extends ConsumerStatefulWidget {
  final String doctorId;
  final String doctorName;
  final String specialty;
  final double fee;

  const BookingScreen({
    super.key,
    required this.doctorId,
    required this.doctorName,
    required this.specialty,
    required this.fee,
  });

  @override
  ConsumerState<BookingScreen> createState() => _BookingScreenState();
}

class _BookingScreenState extends ConsumerState<BookingScreen> {
  DateTime _selectedDate = DateTime.now().add(const Duration(days: 1));
  String? _selectedTimeSlot;
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  bool _isSubmitting = false;

  final List<String> _timeSlots = [
    '09:00',
    '10:00',
    '11:00',
    '12:00',
    '14:00',
    '15:00',
    '16:00',
  ];

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _handleBooking() async {
    if (_selectedTimeSlot == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select an appointment time slot.')),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      final dio = ref.read(dioClientPrv);
      final formattedDate = "${_selectedDate.year}-${_selectedDate.month.toString().padLeft(2, '0')}-${_selectedDate.day.toString().padLeft(2, '0')}";
      
      final response = await dio.post('/appointments', data: {
        'patientId': 'BADP1K3A', // Matches default seeded patient ID
        'doctorId': widget.doctorId,
        'date': formattedDate,
        'timeSlot': _selectedTimeSlot,
      });

      if (mounted) {
        setState(() => _isSubmitting = false);
        if (response.data != null && response.data['success'] == true) {
          _showSuccessDialog();
        } else {
          _showError(response.data['error']?['message'] ?? 'Failed to book slot.');
        }
      }
    } on DioException catch (e) {
      if (mounted) {
        setState(() => _isSubmitting = false);
        final errorMsg = e.response?.data?['error']?['message'] ?? 'Conflict: Slot already occupied.';
        _showError(errorMsg);
      }
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: AppColors.critical,
      ),
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
            Text('Booking Confirmed!'),
          ],
        ),
        content: Text(
          'Your appointment with ${widget.doctorName} is successfully booked for ${_selectedDate.day}/${_selectedDate.month}/${_selectedDate.year} at $_selectedTimeSlot.',
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(context); // Pop dialog
              Navigator.pop(context); // Pop booking screen
            },
            child: const Text('OK', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  Future<void> _selectDate() async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime.now().add(const Duration(days: 1)),
      lastDate: DateTime.now().add(const Duration(days: 30)),
    );
    if (picked != null && picked != _selectedDate) {
      setState(() {
        _selectedDate = picked;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
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
            // Selected Doctor Summary Card
            AppCard(
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 24,
                    backgroundColor: AppColors.primary.withOpacity(0.1),
                    child: const Icon(Icons.person, color: AppColors.primary),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.doctorName,
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                        ),
                        Text(
                          '${widget.specialty} • consultation fee \$${widget.fee.toStringAsFixed(0)}',
                          style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Step 1: Select Date
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '1. Choose Date',
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
                              const Icon(Icons.calendar_today, color: AppColors.primary, size: 20),
                              const SizedBox(width: 12),
                              Text(
                                '${_selectedDate.day}/${_selectedDate.month}/${_selectedDate.year}',
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.textPrimary,
                                ),
                              ),
                            ],
                          ),
                          const Text(
                            'Change Date',
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

            // Step 2: Select Time Slot
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '2. Choose Time Slot',
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 12,
                    runSpacing: 12,
                    children: _timeSlots.map((slot) {
                      final isSelected = _selectedTimeSlot == slot;
                      return ChoiceChip(
                        label: Text(slot),
                        selected: isSelected,
                        onSelected: (selected) {
                          setState(() {
                            _selectedTimeSlot = selected ? slot : null;
                          });
                        },
                        selectedColor: AppColors.primary,
                        backgroundColor: AppColors.background,
                        labelStyle: TextStyle(
                          color: isSelected ? Colors.white : AppColors.textPrimary,
                          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8),
                          side: BorderSide(
                            color: isSelected ? AppColors.primary : Colors.grey.shade200,
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 28),

            // Book Button
            AppButton(
              label: 'Confirm and Book Slot',
              isLoading: _isSubmitting,
              onPressed: _handleBooking,
            ),
          ],
        ),
      ),
    );
  }
}
