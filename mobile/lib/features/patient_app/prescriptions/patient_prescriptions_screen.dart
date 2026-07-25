import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/empty_state.dart';
import '../../../core/widgets/loading_indicator.dart';
import '../../../core/widgets/status_chip.dart';
import '../../../shared_models/prescription.dart';
import '../../care/data/care_repository.dart';

class PatientPrescriptionsScreen extends ConsumerWidget {
  const PatientPrescriptionsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final rxAsync = ref.watch(patientPrescriptionsPrv);

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(patientPrescriptionsPrv);
        await ref.read(patientPrescriptionsPrv.future);
      },
      child: rxAsync.when(
        loading: () => const LoadingIndicator(message: 'Loading prescriptions...'),
        error: (error, _) => EmptyState(
          title: 'Could not load prescriptions',
          description: '$error',
          icon: Icons.cloud_off_rounded,
          actionLabel: 'Retry',
          onActionPressed: () => ref.invalidate(patientPrescriptionsPrv),
        ),
        data: (prescriptions) {
          if (prescriptions.isEmpty) {
            return ListView(
              children: const [
                SizedBox(height: 80),
                EmptyState(
                  title: 'No prescriptions',
                  description: 'Prescriptions issued by your doctor will show up here.',
                  icon: Icons.medication_outlined,
                ),
              ],
            );
          }

          return ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            itemCount: prescriptions.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (context, index) => _RxCard(prescription: prescriptions[index]),
          );
        },
      ),
    );
  }
}

class _RxCard extends StatelessWidget {
  final Prescription prescription;

  const _RxCard({required this.prescription});

  @override
  Widget build(BuildContext context) {
    final tone = switch (prescription.status) {
      'dispensed' => StatusTone.success,
      'partial' => StatusTone.warning,
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
                  'Rx ${prescription.id}',
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                ),
              ),
              StatusChip(label: prescription.status.toUpperCase(), tone: tone),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            formatDateTime(prescription.createdAt),
            style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
          ),
          const SizedBox(height: 12),
          for (final item in prescription.items)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.medicineName,
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                  Text(
                    '${item.dosage} · ${item.duration}',
                    style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary),
                  ),
                  if (item.instructions.isNotEmpty)
                    Text(
                      item.instructions,
                      style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
