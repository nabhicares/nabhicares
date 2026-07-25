import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/form_widgets.dart';
import '../../../../shared_models/medicine.dart';
import '../../../../shared_models/supplier.dart';
import '../../inventory/providers/inventory_providers.dart';
import '../data/purchases_repository.dart';
import '../providers/purchases_providers.dart';

class _OrderLine {
  String? medicineId;
  final TextEditingController quantity = TextEditingController();
  final TextEditingController unitPrice = TextEditingController();

  void dispose() {
    quantity.dispose();
    unitPrice.dispose();
  }

  double get lineTotal {
    final qty = int.tryParse(quantity.text.trim()) ?? 0;
    final price = double.tryParse(unitPrice.text.trim()) ?? 0;
    return qty * price;
  }
}

class CreatePurchaseOrderScreen extends ConsumerStatefulWidget {
  const CreatePurchaseOrderScreen({super.key});

  @override
  ConsumerState<CreatePurchaseOrderScreen> createState() =>
      _CreatePurchaseOrderScreenState();
}

class _CreatePurchaseOrderScreenState extends ConsumerState<CreatePurchaseOrderScreen> {
  final _formKey = GlobalKey<FormState>();
  final List<_OrderLine> _lines = [_OrderLine()];
  String? _supplierId;
  bool _isSaving = false;

  @override
  void dispose() {
    for (final line in _lines) {
      line.dispose();
    }
    super.dispose();
  }

  double get _orderTotal => _lines.fold(0, (sum, line) => sum + line.lineTotal);

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSaving = true);
    final messenger = ScaffoldMessenger.of(context);
    final router = GoRouter.of(context);

    try {
      final order = await ref.read(purchasesRepositoryPrv).createOrder(
            supplierId: _supplierId!,
            items: _lines
                .map((line) => {
                      'medicineId': line.medicineId,
                      'quantity': int.parse(line.quantity.text.trim()),
                      'unitPrice': double.parse(line.unitPrice.text.trim()),
                    })
                .toList(),
          );

      invalidatePurchases(ref);
      messenger.showSnackBar(SnackBar(content: Text('Purchase order ${order.id} created')));
      router.pushReplacement('/admin/purchases/orders/${order.id}');
    } catch (error) {
      messenger.showSnackBar(SnackBar(content: Text('$error')));
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final suppliersAsync = ref.watch(suppliersPrv);
    final medicinesAsync = ref.watch(medicineDirectoryPrv);
    final suppliers =
        (suppliersAsync.value ?? const <Supplier>[]).where((s) => s.isActive).toList();
    final medicines = medicinesAsync.value ?? const <Medicine>[];

    return Scaffold(
      appBar: AppBar(title: const Text('New purchase order')),
      bottomNavigationBar: Container(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 20),
        decoration: const BoxDecoration(
          color: AppColors.surface,
          border: Border(top: BorderSide(color: AppColors.border)),
        ),
        child: SafeArea(
          top: false,
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text(
                      'ORDER TOTAL',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 0.6,
                        color: AppColors.textSecondary,
                      ),
                    ),
                    Text(
                      formatCurrency(_orderTotal),
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w700,
                        color: AppColors.primaryDark,
                      ),
                    ),
                  ],
                ),
              ),
              SizedBox(
                width: 170,
                child: AppButton(
                  label: 'Create order',
                  isLoading: _isSaving,
                  onPressed: _isSaving ? null : _submit,
                ),
              ),
            ],
          ),
        ),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
          children: [
            FormSection(
              title: 'Supplier',
              icon: Icons.storefront_outlined,
              children: [
                LabeledField(
                  label: 'Order from',
                  isRequired: true,
                  child: DropdownButtonFormField<String>(
                    initialValue: _supplierId,
                    isExpanded: true,
                    hint: Text(
                      suppliersAsync.isLoading
                          ? 'Loading suppliers...'
                          : suppliers.isEmpty
                              ? 'No active suppliers'
                              : 'Select a supplier',
                    ),
                    items: [
                      for (final supplier in suppliers)
                        DropdownMenuItem(
                          value: supplier.id,
                          child: Text(supplier.name, overflow: TextOverflow.ellipsis),
                        ),
                    ],
                    onChanged: (value) => setState(() => _supplierId = value),
                    validator: (value) => value == null ? 'Select a supplier' : null,
                  ),
                ),
                if (suppliers.isEmpty && !suppliersAsync.isLoading)
                  FormHint(
                    icon: Icons.warning_amber_rounded,
                    color: AppColors.warning,
                    message: 'Add a supplier first — tap here to create one.',
                  ),
              ],
            ),
            const SizedBox(height: 20),
            FormSection(
              title: 'Line items',
              icon: Icons.list_alt_rounded,
              children: [
                for (var index = 0; index < _lines.length; index++)
                  _LineEditor(
                    line: _lines[index],
                    index: index,
                    medicines: medicines,
                    onRemove: _lines.length == 1
                        ? null
                        : () => setState(() => _lines.removeAt(index).dispose()),
                    onChanged: () => setState(() {}),
                  ),
                const SizedBox(height: 4),
                OutlinedButton.icon(
                  onPressed: () => setState(() => _lines.add(_OrderLine())),
                  icon: const Icon(Icons.add, size: 18),
                  label: const Text('Add another line'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.primary,
                    side: const BorderSide(color: AppColors.primary),
                    minimumSize: const Size(double.infinity, 48),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _LineEditor extends StatelessWidget {
  final _OrderLine line;
  final int index;
  final List<Medicine> medicines;
  final VoidCallback? onRemove;
  final VoidCallback onChanged;

  const _LineEditor({
    required this.line,
    required this.index,
    required this.medicines,
    required this.onRemove,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surfaceMuted,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                'Line ${index + 1}',
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textSecondary,
                ),
              ),
              const Spacer(),
              if (onRemove != null)
                IconButton(
                  onPressed: onRemove,
                  icon: const Icon(Icons.delete_outline, size: 20),
                  color: AppColors.critical,
                  visualDensity: VisualDensity.compact,
                ),
            ],
          ),
          const SizedBox(height: 4),
          DropdownButtonFormField<String>(
            initialValue: line.medicineId,
            isExpanded: true,
            hint: const Text('Select a medicine'),
            items: [
              for (final medicine in medicines)
                DropdownMenuItem(
                  value: medicine.id,
                  child: Text(medicine.name, overflow: TextOverflow.ellipsis),
                ),
            ],
            onChanged: (value) {
              line.medicineId = value;
              onChanged();
            },
            validator: (value) => value == null ? 'Select a medicine' : null,
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextFormField(
                  controller: line.quantity,
                  keyboardType: TextInputType.number,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  decoration: const InputDecoration(labelText: 'Quantity', hintText: '100'),
                  onChanged: (_) => onChanged(),
                  validator: (value) {
                    final parsed = int.tryParse(value?.trim() ?? '');
                    if (parsed == null) return 'Required';
                    if (parsed <= 0) return 'Must be > 0';
                    return null;
                  },
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextFormField(
                  controller: line.unitPrice,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(
                    labelText: 'Unit price',
                    hintText: '0.00',
                    prefixText: '₹ ',
                  ),
                  onChanged: (_) => onChanged(),
                  validator: (value) {
                    final parsed = double.tryParse(value?.trim() ?? '');
                    if (parsed == null) return 'Required';
                    if (parsed < 0) return 'Invalid';
                    return null;
                  },
                ),
              ),
            ],
          ),
          if (line.lineTotal > 0) ...[
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerRight,
              child: Text(
                'Line total ${formatCurrency(line.lineTotal)}',
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textSecondary,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
