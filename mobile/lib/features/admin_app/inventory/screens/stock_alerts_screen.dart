import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/loading_indicator.dart';
import '../../../../core/widgets/status_chip.dart';
import '../../../../shared_models/inventory_alerts.dart';
import '../../../../shared_models/medicine.dart';
import '../providers/inventory_providers.dart';

class StockAlertsScreen extends ConsumerStatefulWidget {
  final int initialTab;

  const StockAlertsScreen({super.key, this.initialTab = 0});

  @override
  ConsumerState<StockAlertsScreen> createState() => _StockAlertsScreenState();
}

class _StockAlertsScreenState extends ConsumerState<StockAlertsScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(
      length: 3,
      vsync: this,
      initialIndex: widget.initialTab.clamp(0, 2),
    );
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final alertsAsync = ref.watch(inventoryAlertsPrv);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Stock alerts'),
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppColors.primary,
          unselectedLabelColor: AppColors.textSecondary,
          indicatorColor: AppColors.primary,
          indicatorSize: TabBarIndicatorSize.tab,
          labelStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
          tabs: const [
            Tab(text: 'Low stock'),
            Tab(text: 'Expiring soon'),
            Tab(text: 'Out of stock'),
          ],
        ),
      ),
      body: alertsAsync.when(
        loading: () => const LoadingIndicator(message: 'Checking stock levels...'),
        error: (error, _) => EmptyState(
          title: 'Could not load alerts',
          description: '$error',
          icon: Icons.cloud_off_rounded,
          actionLabel: 'Retry',
          onActionPressed: () => ref.invalidate(inventoryAlertsPrv),
        ),
        data: (alerts) => RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(inventoryAlertsPrv);
            await ref.read(inventoryAlertsPrv.future);
          },
          child: TabBarView(
            controller: _tabController,
            children: [
              _MedicineAlertList(
                medicines: alerts.lowStock,
                tone: StatusTone.warning,
                chipLabel: 'LOW',
                emptyTitle: 'No low stock items',
                emptyDescription: 'Every medicine is above its reorder level.',
                subtitleBuilder: (medicine) =>
                    'Stock: ${medicine.totalQuantity} units · reorder at ${medicine.reorderLevel}',
              ),
              _ExpiringList(batches: alerts.expiring),
              _MedicineAlertList(
                medicines: alerts.outOfStock,
                tone: StatusTone.critical,
                chipLabel: 'OUT',
                emptyTitle: 'Nothing out of stock',
                emptyDescription: 'All medicines currently have units available.',
                subtitleBuilder: (_) => 'No units available for dispensing',
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MedicineAlertList extends StatelessWidget {
  final List<Medicine> medicines;
  final StatusTone tone;
  final String chipLabel;
  final String emptyTitle;
  final String emptyDescription;
  final String Function(Medicine medicine) subtitleBuilder;

  const _MedicineAlertList({
    required this.medicines,
    required this.tone,
    required this.chipLabel,
    required this.emptyTitle,
    required this.emptyDescription,
    required this.subtitleBuilder,
  });

  @override
  Widget build(BuildContext context) {
    if (medicines.isEmpty) {
      return ListView(
        children: [
          const SizedBox(height: 40),
          EmptyState(
            title: emptyTitle,
            description: emptyDescription,
            icon: Icons.verified_outlined,
          ),
        ],
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: medicines.length,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        final medicine = medicines[index];
        return _AlertCard(
          title: medicine.name,
          subtitle: subtitleBuilder(medicine),
          chipLabel: chipLabel,
          tone: tone,
          onTitleTap: () => context.push('/admin/inventory/medicines/${medicine.id}'),
          onActionPressed: () =>
              context.push('/admin/inventory/medicines/${medicine.id}/add-batch'),
        );
      },
    );
  }
}

class _ExpiringList extends StatelessWidget {
  final List<ExpiringBatch> batches;

  const _ExpiringList({required this.batches});

  @override
  Widget build(BuildContext context) {
    if (batches.isEmpty) {
      return ListView(
        children: const [
          SizedBox(height: 40),
          EmptyState(
            title: 'Nothing expiring soon',
            description: 'No batches expire within the next 30 days.',
            icon: Icons.event_available_outlined,
          ),
        ],
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: batches.length,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        final batch = batches[index];
        final days = batch.daysToExpiry;
        return _AlertCard(
          title: batch.medicineName,
          subtitle:
              '${batch.batchNo} · ${batch.quantity} units · ${expiryLabel(days)}',
          chipLabel: (days != null && days < 0) ? 'EXPIRED' : 'EXPIRING',
          tone: (days != null && days < 0) ? StatusTone.critical : StatusTone.warning,
          onTitleTap: () => context.push('/admin/inventory/medicines/${batch.medicineId}'),
          actionLabel: 'Write off',
          onActionPressed: () => context.push(
            '/admin/inventory/adjust?medicineId=${batch.medicineId}&batchNo=${Uri.encodeComponent(batch.batchNo)}',
          ),
        );
      },
    );
  }
}

class _AlertCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final String chipLabel;
  final StatusTone tone;
  final VoidCallback onTitleTap;
  final VoidCallback onActionPressed;
  final String actionLabel;

  const _AlertCard({
    required this.title,
    required this.subtitle,
    required this.chipLabel,
    required this.tone,
    required this.onTitleTap,
    required this.onActionPressed,
    this.actionLabel = 'Add batch',
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTitleTap,
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
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary),
                  ),
                  const SizedBox(height: 8),
                  StatusChip(label: chipLabel, tone: tone),
                ],
              ),
            ),
            const SizedBox(width: 12),
            FilledButton(
              onPressed: onActionPressed,
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.primary,
                shape: const StadiumBorder(),
                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
              ),
              child: Text(actionLabel),
            ),
          ],
        ),
      ),
    );
  }
}
