import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/form_widgets.dart';
import '../data/inventory_repository.dart';
import '../providers/inventory_providers.dart';

class AddBatchScreen extends ConsumerStatefulWidget {
  final String medicineId;

  const AddBatchScreen({super.key, required this.medicineId});

  @override
  ConsumerState<AddBatchScreen> createState() => _AddBatchScreenState();
}

class _AddBatchScreenState extends ConsumerState<AddBatchScreen> {
  final _formKey = GlobalKey<FormState>();
  final _batchNoController = TextEditingController();
  final _quantityController = TextEditingController();
  final _unitPriceController = TextEditingController();
  DateTime? _expiryDate;
  bool _isSaving = false;

  @override
  void dispose() {
    _batchNoController.dispose();
    _quantityController.dispose();
    _unitPriceController.dispose();
    super.dispose();
  }

  Future<void> _pickExpiry() async {
    final today = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _expiryDate ?? DateTime(today.year + 1, today.month, today.day),
      firstDate: today,
      lastDate: DateTime(today.year + 15),
      helpText: 'Select batch expiry date',
    );
    if (picked != null) setState(() => _expiryDate = picked);
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    if (_expiryDate == null) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Select an expiry date')));
      return;
    }

    setState(() => _isSaving = true);
    final messenger = ScaffoldMessenger.of(context);
    final router = GoRouter.of(context);

    try {
      await ref.read(inventoryRepositoryPrv).addBatch(
            medicineId: widget.medicineId,
            batchNo: _batchNoController.text.trim(),
            expiryDate: toApiDate(_expiryDate!),
            quantity: int.parse(_quantityController.text.trim()),
            unitPrice: double.parse(_unitPriceController.text.trim()),
          );

      invalidateInventory(ref);
      messenger.showSnackBar(const SnackBar(content: Text('Batch added to stock')));
      router.pop();
    } catch (error) {
      messenger.showSnackBar(SnackBar(content: Text('$error')));
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final medicineAsync = ref.watch(medicineDetailPrv(widget.medicineId));

    return Scaffold(
      appBar: AppBar(title: const Text('Add stock batch')),
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
              child: Row(
                children: [
                  const Icon(Icons.medication_outlined, size: 20, color: AppColors.primary),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'MEDICINE',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 0.6,
                            color: AppColors.textSecondary,
                          ),
                        ),
                        Text(
                          medicineAsync.value?.name ?? 'Loading...',
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: AppColors.textPrimary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            FormSection(
              title: 'Batch details',
              icon: Icons.qr_code_2_outlined,
              children: [
                LabeledField(
                  label: 'Batch number',
                  isRequired: true,
                  child: TextFormField(
                    controller: _batchNoController,
                    textCapitalization: TextCapitalization.characters,
                    decoration: const InputDecoration(hintText: 'e.g. BATCH-2026-001'),
                    validator: (value) =>
                        (value == null || value.trim().isEmpty) ? 'Required' : null,
                  ),
                ),
                LabeledField(
                  label: 'Expiry date',
                  isRequired: true,
                  child: InkWell(
                    onTap: _pickExpiry,
                    borderRadius: BorderRadius.circular(8),
                    child: InputDecorator(
                      decoration: const InputDecoration(
                        suffixIcon: Icon(Icons.calendar_today_outlined, size: 18),
                      ),
                      child: Text(
                        _expiryDate == null
                            ? 'Select a date'
                            : formatDate(toApiDate(_expiryDate!)),
                        style: TextStyle(
                          fontSize: 15,
                          color: _expiryDate == null
                              ? AppColors.textMuted
                              : AppColors.textPrimary,
                        ),
                      ),
                    ),
                  ),
                ),
                Row(
                  children: [
                    Expanded(
                      child: LabeledField(
                        label: 'Quantity',
                        isRequired: true,
                        child: TextFormField(
                          controller: _quantityController,
                          keyboardType: TextInputType.number,
                          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                          decoration: const InputDecoration(hintText: '500'),
                          validator: (value) {
                            final parsed = int.tryParse(value?.trim() ?? '');
                            if (parsed == null) return 'Required';
                            if (parsed <= 0) return 'Must be > 0';
                            return null;
                          },
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: LabeledField(
                        label: 'Unit price',
                        isRequired: true,
                        child: TextFormField(
                          controller: _unitPriceController,
                          keyboardType:
                              const TextInputType.numberWithOptions(decimal: true),
                          decoration: const InputDecoration(
                            hintText: '0.00',
                            prefixText: '₹ ',
                          ),
                          validator: (value) {
                            final parsed = double.tryParse(value?.trim() ?? '');
                            if (parsed == null) return 'Required';
                            if (parsed < 0) return 'Cannot be negative';
                            return null;
                          },
                        ),
                      ),
                    ),
                  ],
                ),
                const FormHint(
                  message:
                      'This increases total stock and logs a purchase receipt in the audit ledger. '
                      'Re-using an existing batch number requires the same expiry date and unit price.',
                ),
              ],
            ),
            const SizedBox(height: 20),
            AppButton(
              label: 'Add batch',
              icon: Icons.add,
              isLoading: _isSaving,
              onPressed: _isSaving ? null : _save,
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
