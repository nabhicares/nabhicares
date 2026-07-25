import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../../shared_models/stock_status.dart';

enum StatusTone { success, warning, critical, neutral, info }

/// Pill indicator with a 10% tinted background, per the design system.
class StatusChip extends StatelessWidget {
  final String label;
  final StatusTone tone;
  final IconData? icon;

  const StatusChip({
    super.key,
    required this.label,
    this.tone = StatusTone.neutral,
    this.icon,
  });

  factory StatusChip.forStock(StockStatus status) {
    switch (status) {
      case StockStatus.ok:
        return const StatusChip(
          label: 'OK',
          tone: StatusTone.success,
          icon: Icons.check_circle_outline,
        );
      case StockStatus.low:
        return const StatusChip(
          label: 'Low',
          tone: StatusTone.warning,
          icon: Icons.warning_amber_rounded,
        );
      case StockStatus.out:
        return const StatusChip(
          label: 'Out',
          tone: StatusTone.critical,
          icon: Icons.error_outline,
        );
    }
  }

  Color get _color {
    switch (tone) {
      case StatusTone.success:
        return AppColors.success;
      case StatusTone.warning:
        return AppColors.warning;
      case StatusTone.critical:
        return AppColors.critical;
      case StatusTone.info:
        return AppColors.primary;
      case StatusTone.neutral:
        return AppColors.textSecondary;
    }
  }

  @override
  Widget build(BuildContext context) {
    final color = _color;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 13, color: color),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 11,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.2,
            ),
          ),
        ],
      ),
    );
  }
}
