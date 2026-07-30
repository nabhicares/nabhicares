import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:table_calendar/table_calendar.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/empty_state.dart';
import '../../../core/widgets/loading_indicator.dart';
import '../../../core/widgets/status_chip.dart';
import '../../../shared_models/appointment.dart';
import '../../care/data/care_repository.dart';

class DoctorQueueScreen extends ConsumerStatefulWidget {
  const DoctorQueueScreen({super.key});

  @override
  ConsumerState<DoctorQueueScreen> createState() => _DoctorQueueScreenState();
}

class _DoctorQueueScreenState extends ConsumerState<DoctorQueueScreen> {
  DateTime _focusedDay = DateTime.now();
  DateTime _selectedDay = DateTime.now();

  String _dayKey(DateTime day) =>
      '${day.year}-${day.month.toString().padLeft(2, '0')}-${day.day.toString().padLeft(2, '0')}';

  Map<String, List<Appointment>> _groupByDate(List<Appointment> appointments) {
    final map = <String, List<Appointment>>{};
    for (final a in appointments) {
      map.putIfAbsent(a.date, () => []).add(a);
    }
    for (final list in map.values) {
      list.sort((a, b) => a.timeSlot.compareTo(b.timeSlot));
    }
    return map;
  }

  @override
  Widget build(BuildContext context) {
    final appointmentsAsync = ref.watch(doctorAppointmentsPrv);

    return appointmentsAsync.when(
      loading: () => const LoadingIndicator(message: 'Loading calendar...'),
      error: (error, _) => EmptyState(
        title: 'Could not load appointments',
        description: '$error',
        icon: Icons.cloud_off_rounded,
        actionLabel: 'Retry',
        onActionPressed: () => ref.invalidate(doctorAppointmentsPrv),
      ),
      data: (appointments) {
        final byDate = _groupByDate(appointments);
        final selectedKey = _dayKey(_selectedDay);
        final dayAppointments = byDate[selectedKey] ?? [];

        return RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(doctorAppointmentsPrv);
            await ref.read(doctorAppointmentsPrv.future);
          },
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
            children: [
              Container(
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.border),
                ),
                child: TableCalendar<Appointment>(
                  firstDay: DateTime.utc(2025, 1, 1),
                  lastDay: DateTime.utc(2030, 12, 31),
                  focusedDay: _focusedDay,
                  selectedDayPredicate: (day) => isSameDay(_selectedDay, day),
                  calendarFormat: CalendarFormat.month,
                  startingDayOfWeek: StartingDayOfWeek.monday,
                  availableGestures: AvailableGestures.horizontalSwipe,
                  eventLoader: (day) => byDate[_dayKey(day)] ?? const [],
                  onDaySelected: (selected, focused) {
                    setState(() {
                      _selectedDay = selected;
                      _focusedDay = focused;
                    });
                  },
                  onPageChanged: (focused) => _focusedDay = focused,
                  headerStyle: const HeaderStyle(
                    formatButtonVisible: false,
                    titleCentered: true,
                    titleTextStyle: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                    leftChevronIcon: Icon(Icons.chevron_left, color: AppColors.primary),
                    rightChevronIcon: Icon(Icons.chevron_right, color: AppColors.primary),
                  ),
                  calendarStyle: CalendarStyle(
                    todayDecoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.18),
                      shape: BoxShape.circle,
                    ),
                    todayTextStyle: const TextStyle(
                      color: AppColors.primaryDark,
                      fontWeight: FontWeight.w700,
                    ),
                    selectedDecoration: const BoxDecoration(
                      color: AppColors.primary,
                      shape: BoxShape.circle,
                    ),
                    markerDecoration: const BoxDecoration(
                      color: AppColors.warning,
                      shape: BoxShape.circle,
                    ),
                    markersMaxCount: 3,
                    outsideDaysVisible: false,
                  ),
                  calendarBuilders: CalendarBuilders(
                    markerBuilder: (context, day, events) {
                      if (events.isEmpty) return null;
                      final booked = events.where((e) => e.status == 'booked').length;
                      final color = booked > 0 ? AppColors.primary : AppColors.textMuted;
                      return Positioned(
                        bottom: 4,
                        child: Container(
                          width: 6,
                          height: 6,
                          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
                        ),
                      );
                    },
                  ),
                ),
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      formatDate(selectedKey),
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                  ),
                  Text(
                    '${dayAppointments.length} visit${dayAppointments.length == 1 ? '' : 's'}',
                    style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              if (dayAppointments.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 32),
                  child: EmptyState(
                    title: 'No visits this day',
                    description: 'Pick another date on the calendar to review your schedule.',
                    icon: Icons.event_available_outlined,
                  ),
                )
              else
                ...dayAppointments.map(
                  (appointment) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: _AppointmentCard(
                      appointment: appointment,
                      onComplete: appointment.status == 'booked'
                          ? () => _complete(appointment)
                          : null,
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _complete(Appointment appointment) async {
    final messenger = ScaffoldMessenger.of(context);
    try {
      await ref.read(careRepositoryPrv).setAppointmentStatus(appointment.id, 'completed');
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
          Row(
            children: [
              const Icon(Icons.access_time, size: 16, color: AppColors.textSecondary),
              const SizedBox(width: 6),
              Text(
                appointment.timeSlot,
                style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
              ),
            ],
          ),
          if (onComplete != null) ...[
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
