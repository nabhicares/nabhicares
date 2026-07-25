import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/loading_indicator.dart';
import '../../../../core/widgets/status_chip.dart';
import '../providers/purchases_providers.dart';

class SuppliersScreen extends ConsumerWidget {
  const SuppliersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final suppliersAsync = ref.watch(suppliersPrv);

    return Scaffold(
      appBar: AppBar(title: const Text('Suppliers')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/admin/purchases/suppliers/new'),
        icon: const Icon(Icons.add),
        label: const Text('Add supplier'),
      ),
      body: suppliersAsync.when(
        loading: () => const LoadingIndicator(message: 'Loading suppliers...'),
        error: (error, _) => EmptyState(
          title: 'Could not load suppliers',
          description: '$error',
          icon: Icons.cloud_off_rounded,
          actionLabel: 'Retry',
          onActionPressed: () => ref.invalidate(suppliersPrv),
        ),
        data: (suppliers) {
          if (suppliers.isEmpty) {
            return EmptyState(
              title: 'No suppliers yet',
              description: 'Add a supplier before raising your first purchase order.',
              icon: Icons.storefront_outlined,
              actionLabel: 'Add supplier',
              onActionPressed: () => context.push('/admin/purchases/suppliers/new'),
            );
          }

          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(suppliersPrv);
              await ref.read(suppliersPrv.future);
            },
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
              itemCount: suppliers.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (context, index) {
                final supplier = suppliers[index];
                return InkWell(
                  onTap: () =>
                      context.push('/admin/purchases/suppliers/${supplier.id}/edit'),
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
                                supplier.name,
                                style: const TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.textPrimary,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                supplier.contactEmail,
                                style: const TextStyle(
                                  fontSize: 12.5,
                                  color: AppColors.textSecondary,
                                ),
                              ),
                              if (supplier.phone != null && supplier.phone!.isNotEmpty)
                                Text(
                                  supplier.phone!,
                                  style: const TextStyle(
                                    fontSize: 12.5,
                                    color: AppColors.textMuted,
                                  ),
                                ),
                            ],
                          ),
                        ),
                        if (!supplier.isActive)
                          const StatusChip(label: 'Inactive', tone: StatusTone.neutral),
                        const SizedBox(width: 4),
                        const Icon(Icons.chevron_right, color: AppColors.textMuted),
                      ],
                    ),
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }
}
