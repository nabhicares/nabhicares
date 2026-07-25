import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/empty_state.dart';
import '../../../core/widgets/loading_indicator.dart';
import '../../../core/widgets/status_chip.dart';
import '../../../shared_models/appointment.dart';
import '../../care/data/care_repository.dart';

class DoctorQueueScreen extends ConsumerWidget {
  const DoctorQueueScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final appointmentsAsync = ref.watch(doctorAppointmentsPrv);

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(doctorAppointmentsPrv);
        await ref.read(doctorAppointmentsPrv.future);
      },
      child: appointmentsAsync.when(
        loading: () => const LoadingIndicator(message: 'Loading queue...'),
        error: (error, _) => EmptyState(
          title: 'Could not load appointments',
          description: '$error',
          icon: Icons.cloud_off_rounded,
          actionLabel: 'Retry',
          onActionPressed: () => ref.invalidate(doctorAppointmentsPrv),
        ),
        data: (appointments) {
          final booked = appointments.where((a) => a.status == 'booked').toList()
            ..sort((a, b) => '${a.date}${a.timeSlot}'.compareTo('${b.date}${b.timeSlot}'));
          final past = appointments.where((a) => a.status != 'booked').toList();

          if (appointments.isEmpty) {
            return ListView(
              children: const [
                SizedBox(height: 80),
                EmptyState(
                  title: 'Queue is clear',
                  description: 'No appointments are scheduled for your calendar yet.',
                  icon: Icons.event_available_outlined,
                ),
              ],
            );
          }

          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            children: [
              Text('Today\'s queue', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 8),
              if (booked.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: Text(
                    'No upcoming booked appointments.',
                    style: TextStyle(color: AppColors.textMuted),
                  ),
                )
              else
                ...booked.map(
                  (appointment) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: _AppointmentCard(
                      appointment: appointment,
                      onComplete: () => _complete(context, ref, appointment),
                    ),
                  ),
                ),
              if (past.isNotEmpty) ...[
                const SizedBox(height: 12),
                Text('Recent history', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 8),
                ...past.map(
                  (appointment) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: _AppointmentCard(appointment: appointment),
                  ),
                ),
              ],
            ],
          );
        },
      ),
    );
  }

  Future<void> _complete(
    BuildContext context,
    WidgetRef ref,
    Appointment appointment,
  ) async {
    final messenger = ScaffoldMessenger.of(context);
    try {
      await ref.read(careRepositoryPrv).completeAppointment(appointment.id);
      ref.invalidate(doctorAppointmentsPrv);
      messenger.showSnackBar(
        SnackBar(content: Text('Marked ${appointment.patientName} as completed')),
      );
    } catch (error) {
      messenger.showSnackBar(SnackBar(content: Text('$error')));
    }
  }
}

class _AppointmentCard extends StatelessWidget {
  final Appointment appointment;
  final VoidCallback? onComplete;

  const _AppointmentCard({required this.appointment, this.onComplete});

  StatusTone get _tone {
    switch (appointment.status) {
      case 'completed':
        return StatusTone.success;
      case 'cancelled':
        return StatusTone.neutral;
      default:
        return StatusTone.info;
    }
  }

  @override
  Widget build(BuildContext context) {
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
                  appointment.patientName,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
              StatusChip(label: appointment.status.toUpperCase(), tone: _tone),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            '${formatDate(appointment.date)} · ${appointment.timeSlot}',
            style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
          ),
          if (onComplete != null && appointment.status == 'booked') ...[
            const SizedBox(height: 12),
            Align(
              alignment: Alignment.centerRight,
              child: FilledButton(
                onPressed: onComplete,
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  shape: const StadiumBorder(),
                ),
                child: const Text('Complete'),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
