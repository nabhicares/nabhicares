import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/empty_state.dart';
import '../../../core/widgets/loading_indicator.dart';
import '../../../core/widgets/metric_card.dart';
import '../../../core/widgets/section_header.dart';
import 'admin_providers.dart';

/// Hospital-wide command center for hospital_admin / super_admin roles.
/// This is distinct from the pharmacist and inventory-operator workspaces.
class AdminDashboardScreen extends ConsumerWidget {
  const AdminDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authStatePrv);
    final dashAsync = ref.watch(adminDashboardPrv);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Hospital Overview'),
        actions: [
          IconButton(
            tooltip: 'Sign out',
            icon: const Icon(Icons.logout_rounded),
            onPressed: () => ref.read(authStatePrv.notifier).logout(),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(adminDashboardPrv);
          await ref.read(adminDashboardPrv.future);
        },
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
          children: [
            _WelcomeBanner(email: auth.email),
            const SizedBox(height: 20),
            dashAsync.when(
              data: (data) => _MetricsGrid(data: data),
              loading: () => const SizedBox(
                height: 200,
                child: LoadingIndicator(message: 'Loading hospital analytics...'),
              ),
              error: (error, _) => EmptyState(
                title: 'Could not load analytics',
                description: '$error',
                icon: Icons.cloud_off_rounded,
                actionLabel: 'Retry',
                onActionPressed: () => ref.invalidate(adminDashboardPrv),
              ),
            ),
            const SizedBox(height: 24),
            Text('Administration', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 12),
            const _AdminActions(),
            const SizedBox(height: 24),
            dashAsync.maybeWhen(
              data: (data) => _FastMovers(medicines: data.fastMovingMedicines),
              orElse: () => const SizedBox.shrink(),
            ),
          ],
        ),
      ),
    );
  }
}

class _WelcomeBanner extends StatelessWidget {
  final String email;

  const _WelcomeBanner({required this.email});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.primary, AppColors.primaryDark],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.admin_panel_settings_rounded, color: Colors.white, size: 22),
              SizedBox(width: 8),
              Text(
                'Administrator Console',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            email.isEmpty ? 'Signed in' : email,
            style: const TextStyle(color: Colors.white70, fontSize: 13),
          ),
          const SizedBox(height: 4),
          const Text(
            'Full oversight of staff, inventory, procurement and revenue.',
            style: TextStyle(color: Colors.white70, fontSize: 12),
          ),
        ],
      ),
    );
  }
}

class _MetricsGrid extends StatelessWidget {
  final AdminDashboard data;

  const _MetricsGrid({required this.data});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: MetricCard(
                label: 'Revenue (paid)',
                value: formatCurrency(data.totalRevenue),
                icon: Icons.payments_outlined,
                accent: AppColors.success,
                onTap: () => context.go('/admin/inventory'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: MetricCard(
                label: 'Appointments',
                value: formatNumber(data.appointmentsCount),
                icon: Icons.event_available_outlined,
                onTap: () => context.go('/admin/staff'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: MetricCard(
                label: 'Units in stock',
                value: formatNumber(data.totalStockItems),
                icon: Icons.inventory_2_outlined,
                onTap: () => context.go('/admin/inventory'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: MetricCard(
                label: 'Low stock SKUs',
                value: formatNumber(data.lowStockItemsCount),
                icon: Icons.warning_amber_rounded,
                accent: AppColors.warning,
                onTap: () => context.push('/admin/inventory/alerts'),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _AdminActions extends StatelessWidget {
  const _AdminActions();

  @override
  Widget build(BuildContext context) {
    final actions = <(IconData, String, VoidCallback)>[
      (Icons.groups_outlined, 'Manage staff', () => context.go('/admin/staff')),
      (Icons.inventory_2_outlined, 'Inventory', () => context.go('/admin/inventory')),
      (Icons.local_shipping_outlined, 'Procurement', () => context.push('/admin/purchases')),
      (Icons.storefront_outlined, 'Suppliers', () => context.push('/admin/purchases/suppliers')),
    ];

    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 12,
      crossAxisSpacing: 12,
      childAspectRatio: 2.6,
      children: [
        for (final action in actions)
          InkWell(
            onTap: action.$3,
            borderRadius: BorderRadius.circular(12),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.border),
              ),
              child: Row(
                children: [
                  Icon(action.$1, size: 22, color: AppColors.primary),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      action.$2,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

class _FastMovers extends StatelessWidget {
  final List<String> medicines;

  const _FastMovers({required this.medicines});

  @override
  Widget build(BuildContext context) {
    if (medicines.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionHeader(title: 'Fast-moving medicines'),
        const SizedBox(height: 8),
        Container(
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.border),
          ),
          child: Column(
            children: [
              for (var i = 0; i < medicines.length; i++) ...[
                ListTile(
                  onTap: () => context.go('/admin/inventory/medicines'),
                  leading: CircleAvatar(
                    radius: 14,
                    backgroundColor: AppColors.primary.withValues(alpha: 0.12),
                    child: Text(
                      '${i + 1}',
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: AppColors.primary,
                      ),
                    ),
                  ),
                  title: Text(medicines[i]),
                  trailing: const Icon(Icons.chevron_right_rounded,
                      color: AppColors.textMuted, size: 20),
                ),
                if (i != medicines.length - 1)
                  const Divider(height: 1, indent: 56),
              ],
            ],
          ),
        ),
      ],
    );
  }
}
