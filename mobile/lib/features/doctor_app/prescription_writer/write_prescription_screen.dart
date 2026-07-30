import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/empty_state.dart';
import '../../../core/widgets/form_hint_box.dart';

/// Prescription writing is not on the live API yet. Opening this screen with a
/// patient still shows who the visit is for, so the doctor is not left guessing.
class WritePrescriptionScreen extends ConsumerWidget {
  final String? patientId;
  final String? patientName;

  const WritePrescriptionScreen({
    super.key,
    this.patientId,
    this.patientName,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final name = (patientName == null || patientName!.isEmpty)
        ? 'a patient'
        : patientName!;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Write prescription'),
        backgroundColor: Colors.white,
        elevation: 0,
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          if (patientId != null || patientName != null)
            AppCard(
              child: Row(
                children: [
                  const Icon(Icons.person, color: AppColors.primary),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          name,
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                        if (patientId != null && patientId!.isNotEmpty)
                          Text(
                            patientId!,
                            style: const TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 12,
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          if (patientId != null || patientName != null) const SizedBox(height: 16),
          const EmptyState(
            title: 'Prescription writing is not available yet',
            description:
                'The hospital API does not accept new prescriptions from this app yet. '
                'Use the web clinic tools once your hospital enables them, or ask your '
                'administrator.',
            icon: Icons.edit_note_outlined,
          ),
          const SizedBox(height: 16),
          const FormHintBox(
            message:
                'Patients can still open prescriptions that staff have already issued.',
          ),
        ],
      ),
    );
  }
}
