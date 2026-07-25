import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/form_widgets.dart';
import '../../../../shared_models/medicine.dart';
import '../data/inventory_repository.dart';
import '../providers/inventory_providers.dart';

BatchItem? _findBatch(List<BatchItem> batches, String? batchNo) {
  for (final batch in batches) {
    if (batch.batchNo == batchNo) return batch;
  }
  return null;
}

const _reasons = <({String value, String label, IconData icon})>[
  (value: 'correction', label: 'Correction', icon: Icons.rule_rounded),
  (value: 'damaged', label: 'Damaged', icon: Icons.broken_image_outlined),
  (value: 'expired', label: 'Expired', icon: Icons.event_busy_outlined),
  (value: 'loss', label: 'Loss', icon: Icons.report_gmailerrorred_outlined),
];

class AdjustStockScreen extends ConsumerStatefulWidget {
  final String? medicineId;
  final String? batchNo;

  const AdjustStockScreen({super.key, this.medicineId, this.batchNo});

  @override
  ConsumerState<AdjustStockScreen> createState() => _AdjustStockScreenState();
}

class _AdjustStockScreenState extends ConsumerState<AdjustStockScreen> {
  final _formKey = GlobalKey<FormState>();
  final _quantityController = TextEditingController();
  String? _medicineId;
  String? _batchNo;
  String _reason = 'correction';
  bool _confirmed = false;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    _medicineId = widget.medicineId;
    _batchNo = widget.batchNo;
  }

  @override
  void dispose() {
    _quantityController.dispose();
    super.dispose();
  }

  Future<void> _submit(List<BatchItem> batches) async {
    if (!_formKey.currentState!.validate()) return;

    final messenger = ScaffoldMessenger.of(context);
    if (_medicineId == null || _batchNo == null) {
      messenger.showSnackBar(
        const SnackBar(content: Text('Select a medicine and batch first')),
      );
      return;
    }

    final change = int.parse(_quantityController.text.trim());
    final batch = _findBatch(batches, _batchNo);
    if (batch != null && batch.quantity + change < 0) {
      messenger.showSnackBar(
        SnackBar(
          content: Text(
            'Batch only has ${batch.quantity} units. Reduce the adjustment.',
          ),
        ),
      );
      return;
    }

    setState(() => _isSaving = true);
    final router = GoRouter.of(context);

    try {
      await ref.read(inventoryRepositoryPrv).adjustStock(
            medicineId: _medicineId!,
            batchNo: _batchNo!,
            quantityChange: change,
            reason: _reason,
          );

      invalidateInventory(ref);
      messenger.showSnackBar(
        SnackBar(
          content: Text(
            change >= 0 ? 'Added $change units to stock' : 'Removed ${-change} units from stock',
          ),
        ),
      );
      router.pop();
    } catch (error) {
      messenger.showSnackBar(SnackBar(content: Text('$error')));
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final directoryAsync = ref.watch(medicineDirectoryPrv);
    final batchesAsync = _medicineId == null
        ? const AsyncValue<List<BatchItem>>.data([])
        : ref.watch(medicineBatchesPrv(_medicineId!));
    final batches = batchesAsync.value ?? const <BatchItem>[];
    final selectedBatch = _findBatch(batches, _batchNo);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Adjust stock'),
        actions: [
          IconButton(
            tooltip: 'Stock history',
            icon: const Icon(Icons.history_rounded),
            onPressed: () => context.push(
              '/admin/inventory/history${_medicineId == null ? '' : '?medicineId=$_medicineId'}',
            ),
          ),
        ],
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
          children: [
            FormSection(
              title: 'Audit context',
              icon: Icons.fact_check_outlined,
              children: [
                LabeledField(
                  label: 'Medicine',
                  isRequired: true,
                  child: DropdownButtonFormField<String>(
                    initialValue: _medicineId,
                    isExpanded: true,
                    hint: Text(
                      directoryAsync.isLoading ? 'Loading medicines...' : 'Select a medicine',
                    ),
                    items: [
                      for (final medicine in directoryAsync.value ?? const <Medicine>[])
                        DropdownMenuItem(
                          value: medicine.id,
                          child: Text(medicine.name, overflow: TextOverflow.ellipsis),
                        ),
                    ],
                    onChanged: (value) => setState(() {
                      _medicineId = value;
                      _batchNo = null;
                    }),
                    validator: (value) => value == null ? 'Select a medicine' : null,
                  ),
                ),
                LabeledField(
                  label: 'Batch number',
                  isRequired: true,
                  child: DropdownButtonFormField<String>(
                    initialValue: batches.any((b) => b.batchNo == _batchNo) ? _batchNo : null,
                    isExpanded: true,
                    hint: Text(
                      _medicineId == null
                          ? 'Select a medicine first'
                          : batchesAsync.isLoading
                              ? 'Loading batches...'
                              : batches.isEmpty
                                  ? 'No batches available'
                                  : 'Select a batch',
                    ),
                    items: [
                      for (final batch in batches)
                        DropdownMenuItem(
                          value: batch.batchNo,
                          child: Text(
                            '${batch.batchNo} · ${batch.quantity} units',
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                    ],
                    onChanged: batches.isEmpty
                        ? null
                        : (value) => setState(() => _batchNo = value),
                    validator: (value) => value == null ? 'Select a batch' : null,
                  ),
                ),
                if (selectedBatch != null)
                  FormHint(
                    icon: Icons.inventory_2_outlined,
                    message:
                        'On hand: ${formatNumber(selectedBatch.quantity)} units · expires ${formatDate(selectedBatch.expiryDate)}',
                    color: AppColors.primary,
                  ),
              ],
            ),
            const SizedBox(height: 20),
            FormSection(
              title: 'Adjustment details',
              icon: Icons.tune_rounded,
              children: [
                LabeledField(
                  label: 'Quantity change',
                  isRequired: true,
                  child: TextFormField(
                    controller: _quantityController,
                    keyboardType: const TextInputType.numberWithOptions(signed: true),
                    inputFormatters: [
                      FilteringTextInputFormatter.allow(RegExp(r'^-?\d*')),
                    ],
                    style: const TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                    decoration: const InputDecoration(
                      hintText: '0',
                      suffixText: 'Units',
                      contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 18),
                    ),
                    validator: (value) {
                      final parsed = int.tryParse(value?.trim() ?? '');
                      if (parsed == null) return 'Enter a whole number';
                      if (parsed == 0) return 'Adjustment cannot be zero';
                      return null;
                    },
                    onChanged: (_) => setState(() {}),
                  ),
                ),
                const Padding(
                  padding: EdgeInsets.only(bottom: 16),
                  child: Text(
                    'Use a negative value to reduce stock, e.g. -10 for a loss.',
                    style: TextStyle(fontSize: 12, color: AppColors.textMuted),
                  ),
                ),
                const Text(
                  'Reason for adjustment',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    color: AppColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: [
                    for (final reason in _reasons)
                      _ReasonChip(
                        label: reason.label,
                        icon: reason.icon,
                        selected: _reason == reason.value,
                        onTap: () => setState(() => _reason = reason.value),
                      ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 24),
            FormSection(
              title: 'Security & compliance',
              icon: Icons.shield_outlined,
              children: [
                CheckboxListTile(
                  value: _confirmed,
                  onChanged: (value) => setState(() => _confirmed = value ?? false),
                  controlAffinity: ListTileControlAffinity.leading,
                  contentPadding: EdgeInsets.zero,
                  dense: true,
                  title: const Text(
                    'I confirm this audit correction is accurate and follows clinical safety protocols.',
                    style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            AppButton(
              label: 'Confirm adjustment',
              isLoading: _isSaving,
              onPressed: (!_confirmed || _isSaving) ? null : () => _submit(batches),
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

class _ReasonChip extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  const _ReasonChip({
    required this.label,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final width = (MediaQuery.sizeOf(context).width - 32 - 10) / 2;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        width: width,
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: selected ? AppColors.primary : AppColors.surface,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: selected ? AppColors.primary : AppColors.border),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 16, color: selected ? Colors.white : AppColors.textSecondary),
            const SizedBox(width: 8),
            Text(
              label,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: selected ? Colors.white : AppColors.textPrimary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
