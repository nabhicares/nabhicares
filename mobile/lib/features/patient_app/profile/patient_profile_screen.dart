import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/loading_indicator.dart';
import '../../../core/widgets/status_chip.dart';
import '../../care/data/care_repository.dart';
import '../../doctor_app/profile/doctor_profile_screen.dart';

class PatientProfileScreen extends ConsumerWidget {
  const PatientProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authStatePrv);
    final profileAsync = ref.watch(myProfilePrv);

    return profileAsync.when(
      loading: () => const LoadingIndicator(message: 'Loading profile...'),
      error: (error, _) {
        // Mock tokens often have no Firestore user doc — fall back to session info.
        return _ProfileBody(
          name: auth.email.split('@').first,
          email: auth.email,
          phone: '—',
          role: auth.role,
          status: 'active',
          uid: 'session',
          onSignOut: () => ref.read(authStatePrv.notifier).logout(),
          onDeleteAccount: () => _confirmDelete(context, ref),
        );
      },
      data: (profile) => _ProfileBody(
        name: profile.name.isEmpty ? auth.email.split('@').first : profile.name,
        email: profile.email.isEmpty ? auth.email : profile.email,
        phone: profile.phone.isEmpty ? '—' : profile.phone,
        role: profile.role,
        status: profile.status,
        uid: profile.uid,
        onSignOut: () => ref.read(authStatePrv.notifier).logout(),
        onDeleteAccount: () => _confirmDelete(context, ref),
      ),
    );
  }

  Future<void> _confirmDelete(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete account?'),
        content: const Text(
          'This permanently anonymizes your name, email, phone, clinical history, '
          'and notifications. This cannot be undone.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(foregroundColor: AppColors.critical),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;

    try {
      await ref.read(careRepositoryPrv).deleteMyAccount();
      ref.read(authStatePrv.notifier).logout();
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Account deleted. Personal data anonymized.')),
        );
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not delete account: $e')),
        );
      }
    }
  }
}

class _ProfileBody extends StatelessWidget {
  final String name;
  final String email;
  final String phone;
  final String role;
  final String status;
  final String uid;
  final VoidCallback onSignOut;
  final VoidCallback onDeleteAccount;

  const _ProfileBody({
    required this.name,
    required this.email,
    required this.phone,
    required this.role,
    required this.status,
    required this.uid,
    required this.onSignOut,
    required this.onDeleteAccount,
  });

  @override
  Widget build(BuildContext context) {
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
                child: Text(
                  name.isEmpty ? '?' : name[0].toUpperCase(),
                  style: const TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.w700,
                    color: AppColors.primary,
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Text(name, style: Theme.of(context).textTheme.headlineSmall),
              const SizedBox(height: 6),
              StatusChip(label: role.replaceAll('_', ' '), tone: StatusTone.info),
            ],
          ),
        ),
        const SizedBox(height: 16),
        _row('Email', email),
        _row('Phone', phone),
        _row('Status', status),
        const SizedBox(height: 12),
        const FormHintBox(
          message:
              'You can delete your account below. Passwords are never stored in this app — '
              'they are handled only by Firebase Auth when real login is enabled.',
        ),
        const SizedBox(height: 20),
        OutlinedButton.icon(
          onPressed: onSignOut,
          icon: const Icon(Icons.logout_rounded, size: 18),
          label: const Text('Sign out'),
          style: OutlinedButton.styleFrom(
            foregroundColor: AppColors.critical,
            side: const BorderSide(color: AppColors.critical),
            minimumSize: const Size(double.infinity, 48),
          ),
        ),
        const SizedBox(height: 12),
        TextButton.icon(
          onPressed: onDeleteAccount,
          icon: const Icon(Icons.delete_forever_rounded, size: 18),
          label: const Text('Delete my account'),
          style: TextButton.styleFrom(
            foregroundColor: AppColors.critical,
            minimumSize: const Size(double.infinity, 48),
          ),
        ),
      ],
    );
  }

  Widget _row(String label, String value) {
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
          Expanded(child: Text(label, style: const TextStyle(color: AppColors.textSecondary))),
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
