import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/empty_state.dart';
import '../../../core/widgets/loading_indicator.dart';
import '../../../core/widgets/status_chip.dart';
import '../../../shared_models/invoice.dart';
import '../../care/data/care_repository.dart';

final _patientInvoicesPrv =
    FutureProvider.autoDispose.family<List<Invoice>, String>((ref, patientId) {
  return ref.watch(careRepositoryPrv).fetchPatientInvoices(patientId);
});

class ReceptionBillingScreen extends ConsumerStatefulWidget {
  const ReceptionBillingScreen({super.key});

  @override
  ConsumerState<ReceptionBillingScreen> createState() =>
      _ReceptionBillingScreenState();
}

class _ReceptionBillingScreenState extends ConsumerState<ReceptionBillingScreen> {
  String? _patientId;

  @override
  Widget build(BuildContext context) {
    final patientsAsync = ref.watch(patientsRegistryPrv);

    return Scaffold(
      appBar: AppBar(title: const Text('Billing')),
      body: patientsAsync.when(
        loading: () => const LoadingIndicator(message: 'Loading patients...'),
        error: (e, _) => EmptyState(
          title: 'Could not load patients',
          description: '$e',
          icon: Icons.cloud_off_rounded,
          actionLabel: 'Retry',
          onActionPressed: () => ref.invalidate(patientsRegistryPrv),
        ),
        data: (patients) {
          if (patients.isEmpty) {
            return const EmptyState(
              title: 'No patients',
              description: 'Register a patient before recording payments.',
              icon: Icons.receipt_long_outlined,
            );
          }
          final selected = _patientId ?? patients.first.id;
          if (_patientId == null) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (mounted) setState(() => _patientId = selected);
            });
          }

          final invoicesAsync = ref.watch(_patientInvoicesPrv(selected));

          return Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                child: DropdownButtonFormField<String>(
                  value: selected,
                  decoration: const InputDecoration(
                    labelText: 'Patient',
                    border: OutlineInputBorder(),
                  ),
                  items: patients
                      .map((p) => DropdownMenuItem(value: p.id, child: Text(p.name)))
                      .toList(),
                  onChanged: (v) => setState(() => _patientId = v),
                ),
              ),
              Expanded(
                child: RefreshIndicator(
                  onRefresh: () async {
                    ref.invalidate(_patientInvoicesPrv(selected));
                    await ref.read(_patientInvoicesPrv(selected).future);
                  },
                  child: invoicesAsync.when(
                    loading: () =>
                        const LoadingIndicator(message: 'Loading invoices...'),
                    error: (e, _) => EmptyState(
                      title: 'Could not load invoices',
                      description: '$e',
                      icon: Icons.cloud_off_rounded,
                      actionLabel: 'Retry',
                      onActionPressed: () =>
                          ref.invalidate(_patientInvoicesPrv(selected)),
                    ),
                    data: (invoices) {
                      if (invoices.isEmpty) {
                        return ListView(
                          children: const [
                            SizedBox(height: 80),
                            EmptyState(
                              title: 'No invoices',
                              description: 'This patient has no billing records yet.',
                              icon: Icons.receipt_outlined,
                            ),
                          ],
                        );
                      }
                      return ListView.separated(
                        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                        itemCount: invoices.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 10),
                        itemBuilder: (context, i) {
                          final inv = invoices[i];
                          final unpaid = inv.status == 'unpaid';
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
                                        inv.id,
                                        style: const TextStyle(fontWeight: FontWeight.w700),
                                      ),
                                    ),
                                    StatusChip(
                                      label: inv.status,
                                      tone: unpaid
                                          ? StatusTone.warning
                                          : inv.status == 'paid'
                                              ? StatusTone.success
                                              : StatusTone.neutral,
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  formatCurrency(inv.totalAmount),
                                  style: const TextStyle(
                                    fontSize: 18,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.textPrimary,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  inv.createdAt.isEmpty
                                      ? '—'
                                      : inv.createdAt.substring(0, inv.createdAt.length.clamp(0, 10)),
                                  style: const TextStyle(color: AppColors.textSecondary),
                                ),
                                if (inv.items.isNotEmpty) ...[
                                  const SizedBox(height: 8),
                                  ...inv.items.take(3).map(
                                        (item) => Text(
                                          '• ${item.description} (${formatCurrency(item.amount)})',
                                          style: const TextStyle(
                                            fontSize: 12,
                                            color: AppColors.textSecondary,
                                          ),
                                        ),
                                      ),
                                ],
                                if (unpaid) ...[
                                  const SizedBox(height: 12),
                                  AppButton(
                                    label: 'Record payment',
                                    height: 42,
                                    onPressed: () => _pay(inv, selected),
                                  ),
                                ],
                              ],
                            ),
                          );
                        },
                      );
                    },
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _pay(Invoice invoice, String patientId) async {
    String method = 'cash';
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setLocal) {
            return AlertDialog(
              title: const Text('Record payment'),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Amount due: ${formatCurrency(invoice.totalAmount)}'),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    value: method,
                    decoration: const InputDecoration(labelText: 'Method'),
                    items: const [
                      DropdownMenuItem(value: 'cash', child: Text('Cash')),
                      DropdownMenuItem(value: 'card', child: Text('Card')),
                      DropdownMenuItem(value: 'upi', child: Text('UPI')),
                      DropdownMenuItem(value: 'other', child: Text('Other')),
                    ],
                    onChanged: (v) => setLocal(() => method = v ?? 'cash'),
                  ),
                ],
              ),
              actions: [
                TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
                TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Confirm')),
              ],
            );
          },
        );
      },
    );
    if (confirmed != true) return;

    try {
      await ref.read(careRepositoryPrv).recordPayment(
            invoiceId: invoice.id,
            amount: invoice.totalAmount,
            method: method,
          );
      ref.invalidate(_patientInvoicesPrv(patientId));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Payment recorded.')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Payment failed: $e')),
        );
      }
    }
  }
}
