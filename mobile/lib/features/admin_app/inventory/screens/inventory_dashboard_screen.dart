import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/loading_indicator.dart';
import '../../../../core/widgets/metric_card.dart';
import '../../../../core/widgets/section_header.dart';
import '../../../../core/widgets/status_chip.dart';
import '../../../../shared_models/inventory_alerts.dart';
import '../../../../shared_models/inventory_summary.dart';
import '../providers/inventory_providers.dart';

class InventoryDashboardScreen extends ConsumerWidget {
  const InventoryDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final summaryAsync = ref.watch(inventorySummaryPrv);
    final alertsAsync = ref.watch(inventoryAlertsPrv);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Inventory'),
        actions: [
          IconButton(
            tooltip: 'Stock alerts',
            icon: const Icon(Icons.notifications_none_rounded),
            onPressed: () => context.push('/admin/inventory/alerts'),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(inventorySummaryPrv);
          ref.invalidate(inventoryAlertsPrv);
          await Future.wait([
            ref.read(inventorySummaryPrv.future),
            ref.read(inventoryAlertsPrv.future),
          ]);
        },
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
          children: [
            summaryAsync.when(
              data: (summary) => _SummaryGrid(summary: summary),
              loading: () => const SizedBox(
                height: 180,
                child: LoadingIndicator(message: 'Loading inventory summary...'),
              ),
              error: (error, _) => EmptyState(
                title: 'Could not load summary',
                description: '$error',
                icon: Icons.cloud_off_rounded,
                actionLabel: 'Retry',
                onActionPressed: () => ref.invalidate(inventorySummaryPrv),
              ),
            ),
            const SizedBox(height: 24),
            Text('Quick actions', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 12),
            const _QuickActions(),
            const SizedBox(height: 24),
            SectionHeader(
              title: 'Needs attention',
              actionLabel: 'View all',
              onActionPressed: () => context.push('/admin/inventory/alerts'),
            ),
            const SizedBox(height: 8),
            alertsAsync.when(
              data: (alerts) => _AttentionList(alerts: alerts),
              loading: () => const Padding(
                padding: EdgeInsets.symmetric(vertical: 32),
                child: LoadingIndicator(),
              ),
              error: (error, _) => EmptyState(
                title: 'Could not load alerts',
                description: '$error',
                icon: Icons.cloud_off_rounded,
                actionLabel: 'Retry',
                onActionPressed: () => ref.invalidate(inventoryAlertsPrv),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SummaryGrid extends StatelessWidget {
  final InventorySummary summary;

  const _SummaryGrid({required this.summary});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: MetricCard(
                label: 'Total medicines',
                value: formatNumber(summary.totalSKUs),
                icon: Icons.medication_outlined,
                onTap: () => context.go('/admin/inventory/medicines'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: MetricCard(
                label: 'Low stock',
                value: formatNumber(summary.lowStockCount),
                icon: Icons.warning_amber_rounded,
                accent: AppColors.warning,
                onTap: () => context.push('/admin/inventory/alerts'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: MetricCard(
                label: 'Out of stock',
                value: formatNumber(summary.outOfStockCount),
                icon: Icons.error_outline,
                accent: AppColors.critical,
                onTap: () => context.push('/admin/inventory/alerts?tab=2'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: MetricCard(
                label: 'Expiring (30d)',
                value: formatNumber(summary.expiringCount),
                icon: Icons.event_busy_outlined,
                accent: AppColors.warning,
                onTap: () => context.push('/admin/inventory/alerts?tab=1'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.primary.withValues(alpha: 0.06),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.primary.withValues(alpha: 0.15)),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'STOCK VALUE ON HAND',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 0.6,
                        color: AppColors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      formatCurrency(summary.totalValue),
                      style: const TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w700,
                        color: AppColors.primaryDark,
                      ),
                    ),
                    Text(
                      '${formatNumber(summary.totalUnits)} units across active SKUs',
                      style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.savings_outlined, size: 32, color: AppColors.primary),
            ],
          ),
        ),
      ],
    );
  }
}

class _QuickActions extends StatelessWidget {
  const _QuickActions();

  @override
  Widget build(BuildContext context) {
    final actions = [
      (Icons.add_circle_outline, 'Add medicine', '/admin/inventory/add-medicine'),
      (Icons.tune_rounded, 'Adjust stock', '/admin/inventory/adjust'),
      (Icons.local_shipping_outlined, 'Purchases', '/admin/purchases'),
      (Icons.history_rounded, 'Stock history', '/admin/inventory/history'),
    ];

    return Row(
      children: [
        for (final action in actions) ...[
          Expanded(
            child: InkWell(
              onTap: () => context.push(action.$3),
              borderRadius: BorderRadius.circular(12),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 6),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.border),
                ),
                child: Column(
                  children: [
                    Icon(action.$1, size: 22, color: AppColors.primary),
                    const SizedBox(height: 8),
                    Text(
                      action.$2,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          if (action != actions.last) const SizedBox(width: 10),
        ],
      ],
    );
  }
}

class _AttentionList extends StatelessWidget {
  final InventoryAlerts alerts;

  const _AttentionList({required this.alerts});

  @override
  Widget build(BuildContext context) {
    final rows = <Widget>[
      for (final medicine in alerts.outOfStock.take(3))
        _AttentionRow(
          title: medicine.name,
          subtitle: 'Stock: ${medicine.totalQuantity} units',
          chip: const StatusChip(label: 'OUT', tone: StatusTone.critical),
          onTap: () => context.push('/admin/inventory/medicines/${medicine.id}'),
        ),
      for (final medicine in alerts.lowStock.take(3))
        _AttentionRow(
          title: medicine.name,
          subtitle:
              'Stock: ${medicine.totalQuantity} units · reorder at ${medicine.reorderLevel}',
          chip: const StatusChip(label: 'LOW', tone: StatusTone.warning),
          onTap: () => context.push('/admin/inventory/medicines/${medicine.id}'),
        ),
      for (final batch in alerts.expiring.take(3))
        _AttentionRow(
          title: batch.medicineName,
          subtitle: '${batch.batchNo} · ${expiryLabel(batch.daysToExpiry)}',
          chip: const StatusChip(label: 'EXPIRING', tone: StatusTone.warning),
          onTap: () => context.push('/admin/inventory/medicines/${batch.medicineId}'),
        ),
    ];

    if (rows.isEmpty) {
      return const EmptyState(
        title: 'All stock levels look healthy',
        description: 'No low stock, expiring, or out-of-stock items right now.',
        icon: Icons.verified_outlined,
      );
    }

    return Column(
      children: [
        for (final row in rows) ...[
          row,
          if (row != rows.last) const SizedBox(height: 10),
        ],
      ],
    );
  }
}

class _AttentionRow extends StatelessWidget {
  final String title;
  final String subtitle;
  final Widget chip;
  final VoidCallback onTap;

  const _AttentionRow({
    required this.title,
    required this.subtitle,
    required this.chip,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.border),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                  ),
                ],
              ),
            ),
            chip,
          ],
        ),
      ),
    );
  }
}
