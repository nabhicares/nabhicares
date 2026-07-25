import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/loading_indicator.dart';
import '../../../../core/widgets/status_chip.dart';
import '../../../../shared_models/purchase_order.dart';
import '../providers/purchases_providers.dart';

StatusChip purchaseOrderChip(String status) {
  switch (status) {
    case 'received':
      return const StatusChip(label: 'Received', tone: StatusTone.success);
    case 'partial':
      return const StatusChip(label: 'Partial', tone: StatusTone.warning);
    case 'cancelled':
      return const StatusChip(label: 'Cancelled', tone: StatusTone.neutral);
    default:
      return const StatusChip(label: 'Pending', tone: StatusTone.info);
  }
}

class PurchaseOrdersScreen extends ConsumerStatefulWidget {
  const PurchaseOrdersScreen({super.key});

  @override
  ConsumerState<PurchaseOrdersScreen> createState() => _PurchaseOrdersScreenState();
}

class _PurchaseOrdersScreenState extends ConsumerState<PurchaseOrdersScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController = TabController(length: 2, vsync: this);

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ordersAsync = ref.watch(purchaseOrdersPrv);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Purchase orders'),
        actions: [
          IconButton(
            tooltip: 'Suppliers',
            icon: const Icon(Icons.storefront_outlined),
            onPressed: () => context.push('/admin/purchases/suppliers'),
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppColors.primary,
          unselectedLabelColor: AppColors.textSecondary,
          indicatorColor: AppColors.primary,
          labelStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
          tabs: const [Tab(text: 'Open'), Tab(text: 'Closed')],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/admin/purchases/new'),
        icon: const Icon(Icons.add),
        label: const Text('New order'),
      ),
      body: ordersAsync.when(
        loading: () => const LoadingIndicator(message: 'Loading purchase orders...'),
        error: (error, _) => EmptyState(
          title: 'Could not load orders',
          description: '$error',
          icon: Icons.cloud_off_rounded,
          actionLabel: 'Retry',
          onActionPressed: () => ref.invalidate(purchaseOrdersPrv),
        ),
        data: (orders) {
          final open = orders.where((o) => o.isOpen).toList();
          final closed = orders.where((o) => !o.isOpen).toList();

          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(purchaseOrdersPrv);
              await ref.read(purchaseOrdersPrv.future);
            },
            child: TabBarView(
              controller: _tabController,
              children: [
                _OrderList(
                  orders: open,
                  emptyTitle: 'No open orders',
                  emptyDescription: 'Create a purchase order to restock from a supplier.',
                ),
                _OrderList(
                  orders: closed,
                  emptyTitle: 'No closed orders',
                  emptyDescription: 'Received and cancelled orders will appear here.',
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _OrderList extends StatelessWidget {
  final List<PurchaseOrder> orders;
  final String emptyTitle;
  final String emptyDescription;

  const _OrderList({
    required this.orders,
    required this.emptyTitle,
    required this.emptyDescription,
  });

  @override
  Widget build(BuildContext context) {
    if (orders.isEmpty) {
      return ListView(
        children: [
          const SizedBox(height: 40),
          EmptyState(
            title: emptyTitle,
            description: emptyDescription,
            icon: Icons.local_shipping_outlined,
          ),
        ],
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
      itemCount: orders.length,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        final order = orders[index];
        final receivedLines = order.items.where((i) => i.isFullyReceived).length;

        return InkWell(
          onTap: () => context.push('/admin/purchases/orders/${order.id}'),
          borderRadius: BorderRadius.circular(12),
          child: Container(
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
                      child: Text(
                        order.id,
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ),
                    purchaseOrderChip(order.status),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  order.supplierName,
                  style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        '$receivedLines of ${order.items.length} lines received',
                        style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                      ),
                    ),
                    Text(
                      formatCurrency(order.totalValue),
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: AppColors.primaryDark,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
