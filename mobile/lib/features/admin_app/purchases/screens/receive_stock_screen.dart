import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/form_widgets.dart';
import '../../../../core/widgets/loading_indicator.dart';
import '../../../../shared_models/purchase_order.dart';
import '../../inventory/providers/inventory_providers.dart';
import '../data/purchases_repository.dart';
import '../providers/purchases_providers.dart';

class ReceiveStockScreen extends ConsumerWidget {
  final String orderId;

  const ReceiveStockScreen({super.key, required this.orderId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final orderAsync = ref.watch(purchaseOrderPrv(orderId));

    return orderAsync.when(
      loading: () => const Scaffold(body: LoadingIndicator(message: 'Loading order...')),
      error: (error, _) => Scaffold(
        appBar: AppBar(title: const Text('Receive stock')),
        body: EmptyState(
          title: 'Could not load order',
          description: '$error',
          icon: Icons.cloud_off_rounded,
        ),
      ),
      data: (order) => _ReceiveForm(order: order),
    );
  }
}

/// Editable state for a single outstanding purchase order line.
class _LineDraft {
  final PurchaseOrderItem item;
  final TextEditingController batchNo = TextEditingController();
  final TextEditingController quantity;
  DateTime? expiryDate;
  bool included = true;

  _LineDraft(this.item) : quantity = TextEditingController(text: '${item.outstanding}');

  void dispose() {
    batchNo.dispose();
    quantity.dispose();
  }
}

class _ReceiveForm extends ConsumerStatefulWidget {
  final PurchaseOrder order;

  const _ReceiveForm({required this.order});

  @override
  ConsumerState<_ReceiveForm> createState() => _ReceiveFormState();
}

class _ReceiveFormState extends ConsumerState<_ReceiveForm> {
  final _formKey = GlobalKey<FormState>();
  late final List<_LineDraft> _drafts;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    _drafts = widget.order.items
        .where((item) => !item.isFullyReceived)
        .map(_LineDraft.new)
        .toList();
  }

  @override
  void dispose() {
    for (final draft in _drafts) {
      draft.dispose();
    }
    super.dispose();
  }

  Future<void> _pickExpiry(_LineDraft draft) async {
    final today = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: draft.expiryDate ?? DateTime(today.year + 1, today.month, today.day),
      firstDate: today,
      lastDate: DateTime(today.year + 15),
      helpText: 'Batch expiry for ${draft.item.medicineName}',
    );
    if (picked != null) setState(() => draft.expiryDate = picked);
  }

  Future<void> _submit() async {
    final included = _drafts.where((d) => d.included).toList();
    final messenger = ScaffoldMessenger.of(context);

    if (included.isEmpty) {
      messenger.showSnackBar(
        const SnackBar(content: Text('Include at least one line to receive')),
      );
      return;
    }
    if (!_formKey.currentState!.validate()) return;

    final missingExpiry = included.where((d) => d.expiryDate == null).toList();
    if (missingExpiry.isNotEmpty) {
      messenger.showSnackBar(
        SnackBar(
          content: Text('Set an expiry date for ${missingExpiry.first.item.medicineName}'),
        ),
      );
      return;
    }

    setState(() => _isSaving = true);

    try {
      await ref.read(purchasesRepositoryPrv).receiveOrder(
            widget.order.id,
            included
                .map(
                  (draft) => ReceiptLine(
                    medicineId: draft.item.medicineId,
                    batchNo: draft.batchNo.text.trim(),
                    expiryDate: toApiDate(draft.expiryDate!),
                    quantityReceived: int.parse(draft.quantity.text.trim()),
                  ),
                )
                .toList(),
          );

      invalidatePurchases(ref);
      invalidateInventory(ref);
      if (mounted) await _showSuccessDialog();
    } catch (error) {
      messenger.showSnackBar(SnackBar(content: Text('$error')));
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  Future<void> _showSuccessDialog() async {
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: const BoxDecoration(
                color: AppColors.primary,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.check, size: 34, color: Colors.white),
            ),
            const SizedBox(height: 20),
            Text('Stock updated', style: Theme.of(dialogContext).textTheme.headlineSmall),
            const SizedBox(height: 8),
            const Text(
              'Inventory has been successfully logged and updated.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
            ),
          ],
        ),
        actions: [
          Center(
            child: OutlinedButton(
              onPressed: () => Navigator.pop(dialogContext),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.primaryDark,
                side: const BorderSide(color: AppColors.border),
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              ),
              child: const Text('RETURN TO ORDER'),
            ),
          ),
        ],
      ),
    );

    if (mounted) context.pop();
  }

  @override
  Widget build(BuildContext context) {
    if (_drafts.isEmpty) {
      return Scaffold(
        appBar: AppBar(title: const Text('Receive stock')),
        body: const EmptyState(
          title: 'Nothing left to receive',
          description: 'Every line on this order has already been fully received.',
          icon: Icons.task_alt_rounded,
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Receive stock')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
          children: [
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.surfaceMuted,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'PURCHASE ORDER',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 0.6,
                      color: AppColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    widget.order.id,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  Text(
                    widget.order.supplierName,
                    style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            const FormHint(
              message:
                  'Each received line creates a stock batch. You can receive partially — '
                  'the remaining quantity stays open on the order.',
            ),
            const SizedBox(height: 20),
            for (final draft in _drafts) ...[
              _LineForm(
                draft: draft,
                onToggle: (value) => setState(() => draft.included = value),
                onPickExpiry: () => _pickExpiry(draft),
              ),
              const SizedBox(height: 16),
            ],
            AppButton(
              label: 'Confirm receipt',
              icon: Icons.check_circle_outline,
              isLoading: _isSaving,
              onPressed: _isSaving ? null : _submit,
            ),
            const SizedBox(height: 8),
            TextButton(
              onPressed: _isSaving ? null : () => context.pop(),
              style: TextButton.styleFrom(foregroundColor: AppColors.textSecondary),
              child: const Text('Cancel'),
            ),
          ],
        ),
      ),
    );
  }
}

class _LineForm extends StatelessWidget {
  final _LineDraft draft;
  final ValueChanged<bool> onToggle;
  final VoidCallback onPickExpiry;

  const _LineForm({
    required this.draft,
    required this.onToggle,
    required this.onPickExpiry,
  });

  @override
  Widget build(BuildContext context) {
    final item = draft.item;

    return Container(
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
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.medicineName,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    Text(
                      'Outstanding: ${item.outstanding} of ${item.quantity} units',
                      style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                    ),
                  ],
                ),
              ),
              Switch(
                value: draft.included,
                activeThumbColor: AppColors.primary,
                onChanged: onToggle,
              ),
            ],
          ),
          if (draft.included) ...[
            const SizedBox(height: 12),
            LabeledField(
              label: 'Batch number',
              isRequired: true,
              child: TextFormField(
                controller: draft.batchNo,
                textCapitalization: TextCapitalization.characters,
                decoration: const InputDecoration(hintText: 'e.g. BATCH-2026-014'),
                validator: (value) => (draft.included && (value == null || value.trim().isEmpty))
                    ? 'Required'
                    : null,
              ),
            ),
            Row(
              children: [
                Expanded(
                  child: LabeledField(
                    label: 'Expiry date',
                    isRequired: true,
                    child: InkWell(
                      onTap: onPickExpiry,
                      borderRadius: BorderRadius.circular(8),
                      child: InputDecorator(
                        decoration: const InputDecoration(
                          suffixIcon: Icon(Icons.calendar_today_outlined, size: 18),
                        ),
                        child: Text(
                          draft.expiryDate == null
                              ? 'Select'
                              : formatMonthYear(toApiDate(draft.expiryDate!)),
                          style: TextStyle(
                            fontSize: 14,
                            color: draft.expiryDate == null
                                ? AppColors.textMuted
                                : AppColors.textPrimary,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: LabeledField(
                    label: 'Qty received',
                    isRequired: true,
                    child: TextFormField(
                      controller: draft.quantity,
                      keyboardType: TextInputType.number,
                      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                      decoration: const InputDecoration(hintText: '0'),
                      validator: (value) {
                        if (!draft.included) return null;
                        final parsed = int.tryParse(value?.trim() ?? '');
                        if (parsed == null) return 'Required';
                        if (parsed <= 0) return 'Must be > 0';
                        if (parsed > item.outstanding) return 'Max ${item.outstanding}';
                        return null;
                      },
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
