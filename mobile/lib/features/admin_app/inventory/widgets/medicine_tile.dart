import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/status_chip.dart';
import '../../../../shared_models/medicine.dart';
import '../../../../shared_models/stock_status.dart';

class MedicineTile extends StatelessWidget {
  final Medicine medicine;
  final VoidCallback? onTap;
  final Widget? trailingAction;

  const MedicineTile({
    super.key,
    required this.medicine,
    this.onTap,
    this.trailingAction,
  });

  @override
  Widget build(BuildContext context) {
    final status = medicine.stockStatus;
    final quantityColor = switch (status) {
      StockStatus.out => AppColors.critical,
      StockStatus.low => AppColors.warning,
      StockStatus.ok => AppColors.textPrimary,
    };

    return InkWell(
      onTap: onTap,
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
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        medicine.name,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      if (medicine.subtitle.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(
                          medicine.subtitle,
                          style: const TextStyle(fontSize: 13, color: AppColors.textMuted),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      '${formatNumber(medicine.totalQuantity)} units',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: quantityColor,
                      ),
                    ),
                    const SizedBox(height: 6),
                    StatusChip.forStock(status),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                _Meta(icon: Icons.category_outlined, label: medicine.category),
                if (medicine.location != null && medicine.location!.isNotEmpty) ...[
                  const SizedBox(width: 14),
                  _Meta(icon: Icons.shelves, label: medicine.location!),
                ],
                const Spacer(),
                if (trailingAction != null) trailingAction!,
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Meta extends StatelessWidget {
  final IconData icon;
  final String label;

  const _Meta({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: AppColors.textMuted),
        const SizedBox(width: 4),
        Text(label, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
      ],
    );
  }
}
