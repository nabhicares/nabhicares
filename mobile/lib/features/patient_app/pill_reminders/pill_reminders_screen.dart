import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/empty_state.dart';
import '../../../core/widgets/loading_indicator.dart';
import '../../care/data/care_repository.dart';

class PillRemindersScreen extends ConsumerWidget {
  const PillRemindersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final prescriptions = ref.watch(patientPrescriptionsPrv);

    return Scaffold(
      appBar: AppBar(title: const Text('Pill Reminders')),
      body: prescriptions.when(
        loading: () => const LoadingIndicator(message: 'Loading medicines...'),
        error: (error, _) => EmptyState(
          title: 'Could not load reminders',
          description: '$error',
          icon: Icons.cloud_off_outlined,
          actionLabel: 'Retry',
          onActionPressed: () => ref.invalidate(patientPrescriptionsPrv),
        ),
        data: (rows) {
          final items = rows
              .where((rx) => rx.status != 'completed' && rx.status != 'cancelled')
              .expand((rx) => rx.items)
              .toList();
          if (items.isEmpty) {
            return const EmptyState(
              title: 'No active pill reminders',
              description: 'Medicines from active prescriptions will appear here.',
              icon: Icons.notifications_none_rounded,
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: items.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (_, index) {
              final item = items[index];
              return Card(
                child: ListTile(
                  onTap: () => showModalBottomSheet(
                    context: context,
                    shape: const RoundedRectangleBorder(
                      borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
                    ),
                    builder: (_) => Padding(
                      padding: const EdgeInsets.fromLTRB(20, 20, 20, 28),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(item.medicineName,
                              style: const TextStyle(
                                  fontSize: 18, fontWeight: FontWeight.w700)),
                          const SizedBox(height: 8),
                          Text('Dosage: ${item.dosage}'),
                          Text('Duration: ${item.duration}'),
                          if (item.instructions.isNotEmpty) ...[
                            const SizedBox(height: 8),
                            Text(item.instructions,
                                style: const TextStyle(color: AppColors.textSecondary)),
                          ],
                        ],
                      ),
                    ),
                  ),
                  leading: CircleAvatar(
                    backgroundColor: AppColors.warning.withValues(alpha: 0.12),
                    child: const Icon(Icons.medication_outlined, color: AppColors.warning),
                  ),
                  title: Text(item.medicineName,
                      style: const TextStyle(fontWeight: FontWeight.w600)),
                  subtitle: Text(
                    '${item.dosage} · ${item.duration}\n${item.instructions}',
                  ),
                  isThreeLine: true,
                  trailing: const Icon(Icons.chevron_right, color: AppColors.textMuted),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
