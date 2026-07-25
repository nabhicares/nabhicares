import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/empty_state.dart';
import '../../../core/widgets/loading_indicator.dart';
import '../../../core/widgets/status_chip.dart';
import '../../care/data/care_repository.dart';

class DoctorProfileScreen extends ConsumerWidget {
  const DoctorProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final doctorAsync = ref.watch(doctorProfilePrv);

    return doctorAsync.when(
      loading: () => const LoadingIndicator(message: 'Loading profile...'),
      error: (error, _) => EmptyState(
        title: 'Could not load profile',
        description: '$error',
        icon: Icons.cloud_off_rounded,
        actionLabel: 'Retry',
        onActionPressed: () => ref.invalidate(doctorProfilePrv),
      ),
      data: (doctor) {
        return ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.border),
              ),
              child: Column(
                children: [
                  CircleAvatar(
                    radius: 36,
                    backgroundColor: AppColors.primary.withValues(alpha: 0.12),
                    child: const Icon(Icons.medical_services, color: AppColors.primary, size: 32),
                  ),
                  const SizedBox(height: 12),
                  Text(doctor.name, style: Theme.of(context).textTheme.headlineSmall),
                  const SizedBox(height: 4),
                  StatusChip(label: doctor.specialty, tone: StatusTone.info),
                ],
              ),
            ),
            const SizedBox(height: 16),
            _ProfileRow(label: 'Email', value: doctor.email),
            _ProfileRow(
              label: 'Consultation fee',
              value: formatCurrency(doctor.consultationFee),
            ),
            _ProfileRow(
              label: 'Qualifications',
              value: doctor.qualifications?.isNotEmpty == true
                  ? doctor.qualifications!
                  : 'Not listed',
            ),
            _ProfileRow(label: 'Doctor ID', value: doctor.id),
            const SizedBox(height: 12),
            const FormHintBox(
              message:
                  'Profile editing is not exposed by the API yet. Contact an administrator to update specialty or fees.',
            ),
          ],
        );
      },
    );
  }
}

class _ProfileRow extends StatelessWidget {
  final String label;
  final String value;

  const _ProfileRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(label, style: const TextStyle(color: AppColors.textSecondary)),
          ),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}

class FormHintBox extends StatelessWidget {
  final String message;

  const FormHintBox({super.key, required this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surfaceMuted,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.info_outline, size: 16, color: AppColors.textSecondary),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary, height: 1.4),
            ),
          ),
        ],
      ),
    );
  }
}
