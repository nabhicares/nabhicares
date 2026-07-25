import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/empty_state.dart';
import '../../../core/widgets/loading_indicator.dart';
import '../../../core/widgets/status_chip.dart';
import '../../../shared_models/patient_record.dart';
import '../../care/data/care_repository.dart';

class DoctorPatientsScreen extends ConsumerWidget {
  const DoctorPatientsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final patientsAsync = ref.watch(patientsRegistryPrv);

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(patientsRegistryPrv);
        await ref.read(patientsRegistryPrv.future);
      },
      child: patientsAsync.when(
        loading: () => const LoadingIndicator(message: 'Loading patients...'),
        error: (error, _) => EmptyState(
          title: 'Could not load patients',
          description: '$error',
          icon: Icons.cloud_off_rounded,
          actionLabel: 'Retry',
          onActionPressed: () => ref.invalidate(patientsRegistryPrv),
        ),
        data: (patients) {
          if (patients.isEmpty) {
            return ListView(
              children: const [
                SizedBox(height: 80),
                EmptyState(
                  title: 'No patients yet',
                  description: 'Registered patient records will appear here.',
                  icon: Icons.people_outline,
                ),
              ],
            );
          }

          return ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            itemCount: patients.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (context, index) {
              final patient = patients[index];
              return _PatientCard(
                patient: patient,
                onTap: () => _showDetail(context, patient),
              );
            },
          );
        },
      ),
    );
  }

  void _showDetail(BuildContext context, PatientRecord patient) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) {
        return Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(patient.name, style: Theme.of(context).textTheme.headlineSmall),
              const SizedBox(height: 4),
              Text(patient.email, style: const TextStyle(color: AppColors.textSecondary)),
              const SizedBox(height: 16),
              _DetailRow(label: 'Phone', value: patient.phone),
              _DetailRow(label: 'Date of birth', value: patient.dateOfBirth),
              _DetailRow(label: 'Gender', value: patient.gender),
              const SizedBox(height: 12),
              const Text(
                'Allergies',
                style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.textPrimary),
              ),
              const SizedBox(height: 6),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: patient.allergies.isEmpty
                    ? [const StatusChip(label: 'None recorded', tone: StatusTone.neutral)]
                    : patient.allergies
                        .map((a) => StatusChip(label: a, tone: StatusTone.warning))
                        .toList(),
              ),
              const SizedBox(height: 12),
              const Text(
                'Medical history',
                style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.textPrimary),
              ),
              const SizedBox(height: 6),
              Text(
                patient.medicalHistory.isEmpty
                    ? 'No history recorded'
                    : patient.medicalHistory.join('\n'),
                style: const TextStyle(color: AppColors.textSecondary, height: 1.4),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _PatientCard extends StatelessWidget {
  final PatientRecord patient;
  final VoidCallback onTap;

  const _PatientCard({required this.patient, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.border),
        ),
        child: Row(
          children: [
            CircleAvatar(
              backgroundColor: AppColors.primary.withValues(alpha: 0.12),
              child: Text(
                patient.name.isEmpty ? '?' : patient.name[0].toUpperCase(),
                style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w700),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    patient.name,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  Text(
                    '${patient.gender} · DOB ${patient.dateOfBirth}',
                    style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                  ),
                  if (patient.allergies.isNotEmpty)
                    Text(
                      'Allergies: ${patient.allergies.join(', ')}',
                      style: const TextStyle(fontSize: 12, color: AppColors.warning),
                    ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: AppColors.textMuted),
          ],
        ),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final String label;
  final String value;

  const _DetailRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: AppColors.textSecondary)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
