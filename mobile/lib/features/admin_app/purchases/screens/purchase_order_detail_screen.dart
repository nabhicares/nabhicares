import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/loading_indicator.dart';
import '../../../../shared_models/purchase_order.dart';
import '../data/purchases_repository.dart';
import '../providers/purchases_providers.dart';
import 'purchase_orders_screen.dart';

class PurchaseOrderDetailScreen extends ConsumerWidget {
  final String orderId;

  const PurchaseOrderDetailScreen({super.key, required this.orderId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final orderAsync = ref.watch(purchaseOrderPrv(orderId));

    return Scaffold(
      appBar: AppBar(title: const Text('Purchase order')),
      body: orderAsync.when(
        loading: () => const LoadingIndicator(message: 'Loading order...'),
        error: (error, _) => EmptyState(
          title: 'Could not load order',
          description: '$error',
          icon: Icons.cloud_off_rounded,
          actionLabel: 'Retry',
          onActionPressed: () => ref.invalidate(purchaseOrderPrv(orderId)),
        ),
        data: (order) => ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
          children: [
            Container(
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
                        child: Text(order.id, style: Theme.of(context).textTheme.headlineSmall),
                      ),
                      purchaseOrderChip(order.status),
                    ],
                  ),
                  const SizedBox(height: 8),
                  _MetaRow(label: 'Supplier', value: order.supplierName),
                  _MetaRow(label: 'Created', value: formatDateTime(order.createdAt)),
                  if (order.receivedAt != null)
                    _MetaRow(label: 'Received', value: formatDateTime(order.receivedAt!)),
                  _MetaRow(label: 'Order value', value: formatCurrency(order.totalValue)),
                ],
              ),
            ),
            const SizedBox(height: 20),
            Text('Line items', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 12),
            for (final item in order.items)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: _LineItemCard(item: item),
              ),
            const SizedBox(height: 12),
            if (order.isOpen)
              AppButton(
                label: 'Receive stock',
                icon: Icons.inventory_rounded,
                onPressed: () => context.push('/admin/purchases/orders/$orderId/receive'),
              ),
            if (order.canCancel) ...[
              const SizedBox(height: 12),
              AppButton(
                label: 'Cancel order',
                type: AppButtonType.outline,
                onPressed: () => _confirmCancel(context, ref, order),
              ),
            ] else if (order.isOpen) ...[
              const SizedBox(height: 12),
              const Text(
                'This order has partial receipts and can no longer be cancelled.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12, color: AppColors.textMuted),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Future<void> _confirmCancel(
    BuildContext context,
    WidgetRef ref,
    PurchaseOrder order,
  ) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Cancel this order?'),
        content: Text(
          'Order ${order.id} for ${order.supplierName} will be marked cancelled. This cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Keep order'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.critical),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Cancel order'),
          ),
        ],
      ),
    );

    if (confirmed != true || !context.mounted) return;

    final messenger = ScaffoldMessenger.of(context);
    try {
      await ref.read(purchasesRepositoryPrv).cancelOrder(order.id);
      invalidatePurchases(ref);
      messenger.showSnackBar(const SnackBar(content: Text('Purchase order cancelled')));
    } catch (error) {
      messenger.showSnackBar(SnackBar(content: Text('$error')));
    }
  }
}

class _MetaRow extends StatelessWidget {
  final String label;
  final String value;

  const _MetaRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: AppColors.textPrimary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _LineItemCard extends StatelessWidget {
  final PurchaseOrderItem item;

  const _LineItemCard({required this.item});

  @override
  Widget build(BuildContext context) {
    final progress = item.quantity == 0 ? 0.0 : item.quantityReceived / item.quantity;

    return Container(
      padding: const EdgeInsets.all(14),
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
                  item.medicineName,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
              Text(
                '${item.quantityReceived}/${item.quantity}',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: item.isFullyReceived ? AppColors.success : AppColors.warning,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: progress.clamp(0.0, 1.0),
              minHeight: 6,
              backgroundColor: AppColors.surfaceMuted,
              valueColor: AlwaysStoppedAnimation(
                item.isFullyReceived ? AppColors.success : AppColors.primary,
              ),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            '${formatCurrency(item.unitPrice)}/unit · line total ${formatCurrency(item.lineTotal)}',
            style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
          ),
        ],
      ),
    );
  }
}
