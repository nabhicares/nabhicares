import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/empty_state.dart';
import '../../../core/widgets/loading_indicator.dart';
import 'admin_providers.dart';

/// Admin-only staff directory and role administration.
class StaffManagementScreen extends ConsumerWidget {
  const StaffManagementScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final doctorsAsync = ref.watch(staffDoctorsPrv);

    return Scaffold(
      appBar: AppBar(title: const Text('Staff & Access')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showAssignRoleSheet(context, ref),
        icon: const Icon(Icons.manage_accounts_outlined),
        label: const Text('Assign role'),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(staffDoctorsPrv);
          await ref.read(staffDoctorsPrv.future);
        },
        child: doctorsAsync.when(
          data: (doctors) {
            if (doctors.isEmpty) {
              return ListView(
                children: const [
                  SizedBox(height: 120),
                  EmptyState(
                    title: 'No medical staff yet',
                    description:
                        'Registered doctors will appear here. Use "Assign role" to grant portal access.',
                    icon: Icons.badge_outlined,
                  ),
                ],
              );
            }
            return ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
              children: [
                Text(
                  'MEDICAL STAFF (${doctors.length})',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.6,
                    color: AppColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 10),
                for (final doctor in doctors) ...[
                  _StaffCard(doctor: doctor),
                  const SizedBox(height: 10),
                ],
              ],
            );
          },
          loading: () => const LoadingIndicator(message: 'Loading staff directory...'),
          error: (error, _) => EmptyState(
            title: 'Could not load staff',
            description: '$error',
            icon: Icons.cloud_off_rounded,
            actionLabel: 'Retry',
            onActionPressed: () => ref.invalidate(staffDoctorsPrv),
          ),
        ),
      ),
    );
  }

  void _showAssignRoleSheet(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => const _AssignRoleSheet(),
    );
  }
}

class _StaffCard extends StatelessWidget {
  final StaffMember doctor;

  const _StaffCard({required this.doctor});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(12),
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
              Text(doctor.name,
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
              const SizedBox(height: 6),
              Text(doctor.specialty,
                  style: const TextStyle(color: AppColors.textSecondary)),
              const SizedBox(height: 12),
              Text('Consultation fee: ${formatCurrency(doctor.consultationFee)}',
                  style: const TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 4),
              Text('Staff ID: ${doctor.id}',
                  style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
            ],
          ),
        ),
      ),
      child: Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 22,
            backgroundColor: AppColors.primary.withValues(alpha: 0.12),
            child: const Icon(Icons.medical_services_outlined,
                color: AppColors.primary),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  doctor.name,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  doctor.specialty,
                  style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                formatCurrency(doctor.consultationFee),
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppColors.primaryDark,
                ),
              ),
              const Text('consult fee',
                  style: TextStyle(fontSize: 10, color: AppColors.textMuted)),
            ],
          ),
          const SizedBox(width: 4),
          const Icon(Icons.chevron_right, color: AppColors.textMuted),
        ],
      ),
    ),
    );
  }
}

class _AssignRoleSheet extends ConsumerStatefulWidget {
  const _AssignRoleSheet();

  @override
  ConsumerState<_AssignRoleSheet> createState() => _AssignRoleSheetState();
}

class _AssignRoleSheetState extends ConsumerState<_AssignRoleSheet> {
  final _uidController = TextEditingController();
  String _role = 'doctor';
  bool _submitting = false;

  static const _roles = [
    'hospital_admin',
    'doctor',
    'pharmacist',
    'receptionist',
    'patient',
  ];

  @override
  void dispose() {
    _uidController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final uid = _uidController.text.trim();
    if (uid.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter the user UID to assign a role.')),
      );
      return;
    }
    setState(() => _submitting = true);
    try {
      await assignStaffRole(ref, uid, _role);
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Assigned "$_role" to $uid.'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } on DioException catch (e) {
      if (mounted) {
        setState(() => _submitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${e.error ?? 'Failed to assign role.'}'),
            backgroundColor: AppColors.critical,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _submitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$e'), backgroundColor: AppColors.critical),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Assign portal role',
            style: Theme.of(context)
                .textTheme
                .titleMedium
                ?.copyWith(fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 4),
          const Text(
            'Grant a Firebase user the custom-claim role that controls which portal they can access.',
            style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _uidController,
            decoration: InputDecoration(
              labelText: 'User UID',
              hintText: 'e.g. mock-uid-doctor',
              prefixIcon: const Icon(Icons.person_outline, size: 20),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
          const SizedBox(height: 14),
          DropdownButtonFormField<String>(
            initialValue: _role,
            decoration: InputDecoration(
              labelText: 'Role',
              prefixIcon: const Icon(Icons.security_outlined, size: 20),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            ),
            items: _roles
                .map((r) => DropdownMenuItem(
                      value: r,
                      child: Text(r.replaceAll('_', ' ')),
                    ))
                .toList(),
            onChanged: (val) => setState(() => _role = val ?? 'doctor'),
          ),
          const SizedBox(height: 20),
          AppButton(
            label: 'Assign role',
            isLoading: _submitting,
            onPressed: _submit,
          ),
        ],
      ),
    );
  }
}
