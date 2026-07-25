import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/loading_indicator.dart';
import '../../../../shared_models/stock_transaction.dart';
import '../providers/inventory_providers.dart';

/// Read-only audit ledger from `GET /inventory/transactions`.
class StockHistoryScreen extends ConsumerStatefulWidget {
  final String? medicineId;

  const StockHistoryScreen({super.key, this.medicineId});

  @override
  ConsumerState<StockHistoryScreen> createState() => _StockHistoryScreenState();
}

class _StockHistoryScreenState extends ConsumerState<StockHistoryScreen> {
  String _typeFilter = 'all';

  @override
  Widget build(BuildContext context) {
    final transactionsAsync = ref.watch(stockTransactionsPrv(widget.medicineId ?? ''));

    return Scaffold(
      appBar: AppBar(title: const Text('Stock history')),
      body: Column(
        children: [
          SizedBox(
            height: 38,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              children: [
                for (final option in const [
                  ('all', 'All'),
                  ('purchase', 'Purchases'),
                  ('adjustment', 'Adjustments'),
                  ('sale', 'Dispensed'),
                ])
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(option.$2),
                      selected: _typeFilter == option.$1,
                      showCheckmark: false,
                      selectedColor: AppColors.primary,
                      labelStyle: TextStyle(
                        fontSize: 13,
                        fontWeight:
                            _typeFilter == option.$1 ? FontWeight.w600 : FontWeight.w500,
                        color: _typeFilter == option.$1 ? Colors.white : AppColors.textPrimary,
                      ),
                      onSelected: (_) => setState(() => _typeFilter = option.$1),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: transactionsAsync.when(
              loading: () => const LoadingIndicator(message: 'Loading ledger...'),
              error: (error, _) => EmptyState(
                title: 'Could not load history',
                description: '$error',
                icon: Icons.cloud_off_rounded,
                actionLabel: 'Retry',
                onActionPressed: () =>
                    ref.invalidate(stockTransactionsPrv(widget.medicineId ?? '')),
              ),
              data: (transactions) {
                final filtered = _typeFilter == 'all'
                    ? transactions
                    : transactions.where((t) => t.type == _typeFilter).toList();

                if (filtered.isEmpty) {
                  return const EmptyState(
                    title: 'No movements recorded',
                    description: 'Stock changes will appear here as they happen.',
                    icon: Icons.receipt_long_outlined,
                  );
                }

                return ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                  itemCount: filtered.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (context, index) => _TransactionRow(
                    transaction: filtered[index],
                    showMedicineName: widget.medicineId == null,
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _TransactionRow extends StatelessWidget {
  final StockTransaction transaction;
  final bool showMedicineName;

  const _TransactionRow({required this.transaction, required this.showMedicineName});

  @override
  Widget build(BuildContext context) {
    final isIncrease = transaction.isIncrease;
    final color = isIncrease ? AppColors.success : AppColors.critical;

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
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(
              isIncrease ? Icons.south_west_rounded : Icons.north_east_rounded,
              size: 18,
              color: color,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  showMedicineName && transaction.medicineName.isNotEmpty
                      ? transaction.medicineName
                      : transaction.readableReason,
                  style: const TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '${transaction.batchNo} · ${transaction.type} · ${formatDateTime(transaction.createdAt)}',
                  style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                ),
              ],
            ),
          ),
          Text(
            '${isIncrease ? '+' : ''}${transaction.quantityChange}',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: color),
          ),
        ],
      ),
    );
  }
}
