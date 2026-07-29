import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/empty_state.dart';
import '../../../core/widgets/loading_indicator.dart';
import '../../care/data/care_repository.dart';

class PatientInvoicesScreen extends ConsumerWidget {
  const PatientInvoicesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final invoices = ref.watch(patientInvoicesPrv);

    return Scaffold(
      appBar: AppBar(title: const Text('Billing Invoices')),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(patientInvoicesPrv);
          await ref.read(patientInvoicesPrv.future);
        },
        child: invoices.when(
          loading: () => const LoadingIndicator(message: 'Loading invoices...'),
          error: (error, _) => ListView(
            children: [
              const SizedBox(height: 100),
              EmptyState(
                title: 'Could not load invoices',
                description: '$error',
                icon: Icons.cloud_off_outlined,
                actionLabel: 'Retry',
                onActionPressed: () => ref.invalidate(patientInvoicesPrv),
              ),
            ],
          ),
          data: (rows) {
            if (rows.isEmpty) {
              return ListView(
                children: const [
                  SizedBox(height: 100),
                  EmptyState(
                    title: 'No invoices',
                    description: 'Consultation and pharmacy invoices will appear here.',
                    icon: Icons.receipt_long_outlined,
                  ),
                ],
              );
            }
            return ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: rows.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (_, index) {
                final invoice = rows[index];
                final paid = invoice.status == 'paid';
                return Card(
                  child: ExpansionTile(
                    leading: CircleAvatar(
                      backgroundColor: (paid ? AppColors.success : AppColors.warning)
                          .withValues(alpha: 0.12),
                      child: Icon(
                        paid ? Icons.check_rounded : Icons.receipt_long_outlined,
                        color: paid ? AppColors.success : AppColors.warning,
                      ),
                    ),
                    title: Text(
                      formatCurrency(invoice.totalAmount),
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    subtitle: Text(
                      '${formatDate(invoice.createdAt)} · ${invoice.status.toUpperCase()}',
                    ),
                    children: [
                      for (final item in invoice.items)
                        ListTile(
                          dense: true,
                          title: Text(item.description),
                          trailing: Text(formatCurrency(item.amount)),
                        ),
                    ],
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }
}
