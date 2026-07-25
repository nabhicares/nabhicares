import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/empty_state.dart';
import '../../../core/widgets/loading_indicator.dart';
import '../../../shared_models/doctor_profile.dart';
import '../../care/data/care_repository.dart';

const _weekDays = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

class DoctorHoursScreen extends ConsumerStatefulWidget {
  const DoctorHoursScreen({super.key});

  @override
  ConsumerState<DoctorHoursScreen> createState() => _DoctorHoursScreenState();
}

class _DoctorHoursScreenState extends ConsumerState<DoctorHoursScreen> {
  List<DaySchedule>? _draft;
  int _slotMinutes = 30;
  bool _saving = false;
  bool _hydrated = false;

  void _hydrate(DoctorSchedule schedule) {
    if (_hydrated) return;
    _draft = List.of(schedule.weeklySchedules);
    _slotMinutes = schedule.slotDurationMinutes;
    _hydrated = true;
  }

  Future<void> _save() async {
    final draft = _draft;
    if (draft == null) return;
    setState(() => _saving = true);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await ref.read(careRepositoryPrv).saveSchedule(
            doctorId: CareDemoIds.doctorId,
            slotDurationMinutes: _slotMinutes,
            weeklySchedules: draft,
          );
      ref.invalidate(doctorSchedulePrv);
      messenger.showSnackBar(const SnackBar(content: Text('Schedule saved')));
    } catch (error) {
      messenger.showSnackBar(SnackBar(content: Text('$error')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _addBlock() async {
    String day = _weekDays.first;
    TimeOfDay start = const TimeOfDay(hour: 9, minute: 0);
    TimeOfDay end = const TimeOfDay(hour: 12, minute: 0);

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setLocal) {
            return AlertDialog(
              title: const Text('Add consultation block'),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  DropdownButtonFormField<String>(
                    initialValue: day,
                    items: [
                      for (final d in _weekDays)
                        DropdownMenuItem(value: d, child: Text(d)),
                    ],
                    onChanged: (value) => setLocal(() => day = value ?? day),
                    decoration: const InputDecoration(labelText: 'Day'),
                  ),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Start'),
                    trailing: Text(start.format(context)),
                    onTap: () async {
                      final picked = await showTimePicker(context: context, initialTime: start);
                      if (picked != null) setLocal(() => start = picked);
                    },
                  ),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('End'),
                    trailing: Text(end.format(context)),
                    onTap: () async {
                      final picked = await showTimePicker(context: context, initialTime: end);
                      if (picked != null) setLocal(() => end = picked);
                    },
                  ),
                ],
              ),
              actions: [
                TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
                FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Add')),
              ],
            );
          },
        );
      },
    );

    if (confirmed != true) return;
    String fmt(TimeOfDay t) =>
        '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';
    setState(() {
      _draft = [
        ...?_draft,
        DaySchedule(dayOfWeek: day, startTime: fmt(start), endTime: fmt(end)),
      ];
    });
  }

  @override
  Widget build(BuildContext context) {
    final scheduleAsync = ref.watch(doctorSchedulePrv);

    return scheduleAsync.when(
      loading: () => const LoadingIndicator(message: 'Loading schedule...'),
      error: (error, _) => EmptyState(
        title: 'Could not load schedule',
        description: '$error',
        icon: Icons.cloud_off_rounded,
        actionLabel: 'Retry',
        onActionPressed: () {
          _hydrated = false;
          ref.invalidate(doctorSchedulePrv);
        },
      ),
      data: (schedule) {
        _hydrate(schedule);
        final draft = _draft ?? const <DaySchedule>[];

        return ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
          children: [
            Text('Weekly hours', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 4),
            const Text(
              'Patients book into these consultation windows.',
              style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
            ),
            const SizedBox(height: 16),
            InputDecorator(
              decoration: const InputDecoration(labelText: 'Slot duration (minutes)'),
              child: DropdownButtonHideUnderline(
                child: DropdownButton<int>(
                  value: _slotMinutes,
                  isExpanded: true,
                  items: const [
                    DropdownMenuItem(value: 15, child: Text('15')),
                    DropdownMenuItem(value: 30, child: Text('30')),
                    DropdownMenuItem(value: 45, child: Text('45')),
                    DropdownMenuItem(value: 60, child: Text('60')),
                  ],
                  onChanged: (value) => setState(() => _slotMinutes = value ?? 30),
                ),
              ),
            ),
            const SizedBox(height: 16),
            if (draft.isEmpty)
              const EmptyState(
                title: 'No hours configured',
                description: 'Add at least one consultation block for the week.',
                icon: Icons.schedule_outlined,
              )
            else
              ...draft.asMap().entries.map((entry) {
                final index = entry.key;
                final block = entry.value;
                return Container(
                  margin: const EdgeInsets.only(bottom: 10),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          block.label,
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.delete_outline, color: AppColors.critical),
                        onPressed: () => setState(() {
                          _draft = [...draft]..removeAt(index);
                        }),
                      ),
                    ],
                  ),
                );
              }),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: _addBlock,
              icon: const Icon(Icons.add),
              label: const Text('Add block'),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.primary,
                minimumSize: const Size(double.infinity, 48),
              ),
            ),
            const SizedBox(height: 12),
            AppButton(
              label: 'Save schedule',
              isLoading: _saving,
              onPressed: _saving ? null : _save,
            ),
          ],
        );
      },
    );
  }
}
