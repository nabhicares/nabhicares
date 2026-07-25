import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/empty_state.dart';
import '../../../core/widgets/loading_indicator.dart';
import '../../../core/widgets/status_chip.dart';
import '../../../shared_models/appointment.dart';
import '../../care/data/care_repository.dart';

class PatientAppointmentsScreen extends ConsumerWidget {
  const PatientAppointmentsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final appointmentsAsync = ref.watch(patientAppointmentsPrv);

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(patientAppointmentsPrv);
        await ref.read(patientAppointmentsPrv.future);
      },
      child: appointmentsAsync.when(
        loading: () => const LoadingIndicator(message: 'Loading appointments...'),
        error: (error, _) => EmptyState(
          title: 'Could not load bookings',
          description: '$error',
          icon: Icons.cloud_off_rounded,
          actionLabel: 'Retry',
          onActionPressed: () => ref.invalidate(patientAppointmentsPrv),
        ),
        data: (appointments) {
          if (appointments.isEmpty) {
            return ListView(
              children: const [
                SizedBox(height: 80),
                EmptyState(
                  title: 'No appointments yet',
                  description: 'Book a specialist from Home to see bookings here.',
                  icon: Icons.event_busy_outlined,
                ),
              ],
            );
          }

          final upcoming = appointments.where((a) => a.status == 'booked').toList();
          final history = appointments.where((a) => a.status != 'booked').toList();

          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            children: [
              Text('Upcoming', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 8),
              if (upcoming.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 16),
                  child: Text('No upcoming bookings.', style: TextStyle(color: AppColors.textMuted)),
                )
              else
                ...upcoming.map(
                  (appointment) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: _BookingCard(
                      appointment: appointment,
                      onCancel: () => _cancel(context, ref, appointment),
                    ),
                  ),
                ),
              if (history.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text('History', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 8),
                ...history.map(
                  (appointment) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: _BookingCard(appointment: appointment),
                  ),
                ),
              ],
            ],
          );
        },
      ),
    );
  }

  Future<void> _cancel(BuildContext context, WidgetRef ref, Appointment appointment) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Cancel appointment?'),
        content: Text(
          'Cancel ${appointment.doctorName} on ${formatDate(appointment.date)} at ${appointment.timeSlot}?',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Keep')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.critical),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Cancel booking'),
          ),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;

    final messenger = ScaffoldMessenger.of(context);
    try {
      await ref.read(careRepositoryPrv).cancelAppointment(appointment.id);
      ref.invalidate(patientAppointmentsPrv);
      messenger.showSnackBar(const SnackBar(content: Text('Appointment cancelled')));
    } catch (error) {
      messenger.showSnackBar(SnackBar(content: Text('$error')));
    }
  }
}

class _BookingCard extends StatelessWidget {
  final Appointment appointment;
  final VoidCallback? onCancel;

  const _BookingCard({required this.appointment, this.onCancel});

  @override
  Widget build(BuildContext context) {
    final tone = switch (appointment.status) {
      'completed' => StatusTone.success,
      'cancelled' => StatusTone.neutral,
      _ => StatusTone.info,
    };

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  appointment.doctorName,
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                ),
              ),
              StatusChip(label: appointment.status.toUpperCase(), tone: tone),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '${formatDate(appointment.date)} · ${appointment.timeSlot}',
            style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
          ),
          if (onCancel != null && appointment.status == 'booked') ...[
            const SizedBox(height: 12),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: onCancel,
                style: TextButton.styleFrom(foregroundColor: AppColors.critical),
                child: const Text('Cancel'),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
