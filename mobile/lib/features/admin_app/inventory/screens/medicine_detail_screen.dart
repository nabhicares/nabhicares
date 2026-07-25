import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/loading_indicator.dart';
import '../../../../core/widgets/section_header.dart';
import '../../../../core/widgets/status_chip.dart';
import '../../../../shared_models/medicine.dart';
import '../../../../shared_models/stock_status.dart';
import '../data/inventory_repository.dart';
import '../providers/inventory_providers.dart';

class MedicineDetailScreen extends ConsumerWidget {
  final String medicineId;

  const MedicineDetailScreen({super.key, required this.medicineId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final medicineAsync = ref.watch(medicineDetailPrv(medicineId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Medicine'),
        actions: [
          medicineAsync.maybeWhen(
            data: (medicine) => PopupMenuButton<String>(
              icon: const Icon(Icons.more_vert),
              onSelected: (value) async {
                if (value == 'edit') {
                  context.push('/admin/inventory/medicines/$medicineId/edit');
                } else if (value == 'history') {
                  context.push('/admin/inventory/history?medicineId=$medicineId');
                } else if (value == 'toggle') {
                  await _toggleStatus(context, ref, medicine);
                }
              },
              itemBuilder: (context) => [
                const PopupMenuItem(value: 'edit', child: Text('Edit details')),
                const PopupMenuItem(value: 'history', child: Text('Stock history')),
                PopupMenuItem(
                  value: 'toggle',
                  child: Text(medicine.isActive ? 'Deactivate' : 'Reactivate'),
                ),
              ],
            ),
            orElse: () => const SizedBox.shrink(),
          ),
        ],
      ),
      body: medicineAsync.when(
        loading: () => const LoadingIndicator(message: 'Loading medicine...'),
        error: (error, _) => EmptyState(
          title: 'Could not load medicine',
          description: '$error',
          icon: Icons.cloud_off_rounded,
          actionLabel: 'Retry',
          onActionPressed: () => ref.invalidate(medicineDetailPrv(medicineId)),
        ),
        data: (medicine) => RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(medicineDetailPrv(medicineId));
            await ref.read(medicineDetailPrv(medicineId).future);
          },
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
            children: [
              if (medicine.stockStatus != StockStatus.ok)
                _StatusBanner(status: medicine.stockStatus),
              if (!medicine.isActive)
                const _Banner(
                  color: AppColors.textSecondary,
                  icon: Icons.visibility_off_outlined,
                  message: 'This medicine is deactivated and hidden from the catalog.',
                ),
              _Header(medicine: medicine),
              const SizedBox(height: 16),
              _TotalsCard(medicine: medicine),
              const SizedBox(height: 20),
              _DetailsCard(medicine: medicine),
              const SizedBox(height: 24),
              SectionHeader(
                title: 'Batches',
                actionLabel: 'Stock history',
                onActionPressed: () =>
                    context.push('/admin/inventory/history?medicineId=$medicineId'),
              ),
              const SizedBox(height: 8),
              if (medicine.batches.isEmpty)
                const EmptyState(
                  title: 'No batches yet',
                  description: 'Add a batch to bring this medicine into stock.',
                  icon: Icons.inventory_outlined,
                )
              else
                ...medicine.batches.map(
                  (batch) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: _BatchCard(medicine: medicine, batch: batch),
                  ),
                ),
              const SizedBox(height: 8),
              AppButton(
                label: 'Add batch',
                icon: Icons.add,
                onPressed: () =>
                    context.push('/admin/inventory/medicines/$medicineId/add-batch'),
              ),
              const SizedBox(height: 12),
              AppButton(
                label: 'Adjust stock',
                icon: Icons.tune_rounded,
                type: AppButtonType.outline,
                onPressed: medicine.batches.isEmpty
                    ? null
                    : () => context.push('/admin/inventory/adjust?medicineId=$medicineId'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _toggleStatus(BuildContext context, WidgetRef ref, Medicine medicine) async {
    final nextStatus = medicine.isActive ? 'inactive' : 'active';
    final messenger = ScaffoldMessenger.of(context);
    try {
      await ref
          .read(inventoryRepositoryPrv)
          .updateMedicine(medicine.id, {'status': nextStatus});
      invalidateInventory(ref);
      messenger.showSnackBar(
        SnackBar(
          content: Text(
            nextStatus == 'inactive' ? 'Medicine deactivated' : 'Medicine reactivated',
          ),
        ),
      );
    } catch (error) {
      messenger.showSnackBar(SnackBar(content: Text('$error')));
    }
  }
}

class _StatusBanner extends StatelessWidget {
  final StockStatus status;

  const _StatusBanner({required this.status});

  @override
  Widget build(BuildContext context) {
    final isOut = status == StockStatus.out;
    return _Banner(
      color: isOut ? AppColors.critical : AppColors.warning,
      icon: isOut ? Icons.error_outline : Icons.warning_amber_rounded,
      message: isOut
          ? 'OUT OF STOCK: no units available for dispensing.'
          : 'LOW STOCK: inventory is at or below the reorder threshold.',
    );
  }
}

class _Banner extends StatelessWidget {
  final Color color;
  final IconData icon;
  final String message;

  const _Banner({required this.color, required this.icon, required this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          Icon(icon, size: 18, color: color),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: color),
            ),
          ),
        ],
      ),
    );
  }
}

class _Header extends StatelessWidget {
  final Medicine medicine;

  const _Header({required this.medicine});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Text(
                medicine.name,
                style: Theme.of(context).textTheme.displayLarge,
              ),
            ),
            const SizedBox(width: 12),
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: StatusChip(label: medicine.category, tone: StatusTone.info),
            ),
          ],
        ),
        if (medicine.genericName.isNotEmpty)
          Text(
            medicine.genericName,
            style: const TextStyle(fontSize: 15, color: AppColors.textMuted),
          ),
      ],
    );
  }
}

class _TotalsCard extends StatelessWidget {
  final Medicine medicine;

  const _TotalsCard({required this.medicine});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surfaceMuted,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'TOTAL INVENTORY',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.6,
                    color: AppColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 6),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    Text(
                      formatNumber(medicine.totalQuantity),
                      style: const TextStyle(
                        fontSize: 30,
                        fontWeight: FontWeight.w700,
                        color: AppColors.primaryDark,
                      ),
                    ),
                    const SizedBox(width: 6),
                    const Text(
                      'units',
                      style: TextStyle(fontSize: 14, color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ],
            ),
          ),
          StatusChip(
            label: 'Reorder at ${medicine.reorderLevel}',
            tone: StatusTone.neutral,
          ),
        ],
      ),
    );
  }
}

class _DetailsCard extends StatelessWidget {
  final Medicine medicine;

  const _DetailsCard({required this.medicine});

  @override
  Widget build(BuildContext context) {
    final rows = <(String, String)>[
      if (medicine.brand != null && medicine.brand!.isNotEmpty) ('Brand', medicine.brand!),
      if (medicine.form != null && medicine.form!.isNotEmpty) ('Form', medicine.form!),
      if (medicine.strength != null && medicine.strength!.isNotEmpty)
        ('Strength', medicine.strength!),
      if (medicine.unit != null && medicine.unit!.isNotEmpty) ('Unit', medicine.unit!),
      if (medicine.packSize != null) ('Pack size', '${medicine.packSize}'),
      if (medicine.mrp != null) ('MRP', formatCurrency(medicine.mrp!)),
      if (medicine.gstPercent != null) ('GST', '${medicine.gstPercent!.toStringAsFixed(0)}%'),
      if (medicine.barcode != null && medicine.barcode!.isNotEmpty)
        ('Barcode', medicine.barcode!),
      if (medicine.location != null && medicine.location!.isNotEmpty)
        ('Location', medicine.location!),
    ];

    if (rows.isEmpty) return const SizedBox.shrink();

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          for (final row in rows)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    row.$1,
                    style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                  ),
                  Text(
                    row.$2,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _BatchCard extends StatelessWidget {
  final Medicine medicine;
  final BatchItem batch;

  const _BatchCard({required this.medicine, required this.batch});

  @override
  Widget build(BuildContext context) {
    final days = batch.daysToExpiry;
    final expiringSoon = days != null && days <= 30;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(Icons.inventory_2_outlined, size: 20, color: AppColors.primary),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  batch.batchNo,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 8,
                  runSpacing: 4,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    StatusChip(
                      label: 'Exp. ${formatMonthYear(batch.expiryDate)}',
                      tone: batch.isExpired
                          ? StatusTone.critical
                          : expiringSoon
                              ? StatusTone.warning
                              : StatusTone.neutral,
                    ),
                    Text(
                      '${formatCurrency(batch.unitPrice)}/unit',
                      style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Text(
            formatNumber(batch.quantity),
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
          IconButton(
            tooltip: 'Adjust this batch',
            icon: const Icon(Icons.more_vert, size: 20),
            onPressed: () => context.push(
              '/admin/inventory/adjust?medicineId=${medicine.id}&batchNo=${Uri.encodeComponent(batch.batchNo)}',
            ),
          ),
        ],
      ),
    );
  }
}
