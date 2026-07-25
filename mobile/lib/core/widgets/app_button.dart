import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

enum AppButtonType { primary, secondary, outline }

class AppButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final AppButtonType type;
  final bool isLoading;
  final double? width;
  final double height;
  final IconData? icon;

  const AppButton({
    super.key,
    required this.label,
    this.onPressed,
    this.type = AppButtonType.primary,
    this.isLoading = false,
    this.width,
    this.height = 48,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isButtonEnabled = onPressed != null && !isLoading;

    Color getBackgroundColor() {
      if (!isButtonEnabled) return Colors.grey.shade300;
      switch (type) {
        case AppButtonType.primary:
          return AppColors.primary;
        case AppButtonType.secondary:
          return AppColors.secondary;
        case AppButtonType.outline:
          return Colors.transparent;
      }
    }

    Color getTextColor() {
      if (!isButtonEnabled) return Colors.grey.shade500;
      switch (type) {
        case AppButtonType.primary:
        case AppButtonType.secondary:
          return Colors.white;
        case AppButtonType.outline:
          return AppColors.primary;
      }
    }

    BorderSide getBorderSide() {
      if (type == AppButtonType.outline && isButtonEnabled) {
        return const BorderSide(color: AppColors.primary, width: 2);
      }
      if (type == AppButtonType.outline && !isButtonEnabled) {
        return BorderSide(color: Colors.grey.shade300, width: 2);
      }
      return BorderSide.none;
    }

    return SizedBox(
      width: width ?? double.infinity,
      height: height,
      child: ElevatedButton(
        style: ElevatedButton.styleFrom(
          backgroundColor: getBackgroundColor(),
          foregroundColor: getTextColor(),
          elevation: type == AppButtonType.outline ? 0 : 2,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: getBorderSide(),
          ),
        ).copyWith(
          overlayColor: WidgetStateProperty.resolveWith<Color?>(
            (states) {
              if (states.contains(WidgetState.pressed)) {
                return getTextColor().withValues(alpha: 0.12);
              }
              return null;
            },
          ),
        ),
        onPressed: isButtonEnabled ? onPressed : null,
        child: isLoading
            ? SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor: AlwaysStoppedAnimation<Color>(getTextColor()),
                ),
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (icon != null) ...[
                    Icon(icon, size: 20, color: getTextColor()),
                    const SizedBox(width: 8),
                  ],
                  Text(
                    label,
                    style: theme.textTheme.labelLarge?.copyWith(
                      color: getTextColor(),
                      fontWeight: FontWeight.w600,
                      letterSpacing: 0.5,
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}
