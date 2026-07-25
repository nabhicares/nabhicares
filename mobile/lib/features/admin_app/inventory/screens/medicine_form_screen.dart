import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/form_widgets.dart';
import '../../../../core/widgets/loading_indicator.dart';
import '../../../../shared_models/medicine.dart';
import '../data/inventory_repository.dart';
import '../providers/inventory_providers.dart';

const _forms = ['tablet', 'capsule', 'syrup', 'injection', 'ointment', 'drops'];
const _units = ['strip', 'bottle', 'vial', 'tube', 'box', 'piece'];

/// Handles both "Add medicine" and "Edit medicine" — the backend exposes
/// POST /inventory/medicines and PATCH /inventory/medicines/:id.
class MedicineFormScreen extends ConsumerWidget {
  final String? medicineId;

  const MedicineFormScreen({super.key, this.medicineId});

  bool get isEditing => medicineId != null;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!isEditing) return const _MedicineForm();

    final medicineAsync = ref.watch(medicineDetailPrv(medicineId!));
    return medicineAsync.when(
      loading: () => const Scaffold(body: LoadingIndicator(message: 'Loading medicine...')),
      error: (error, _) => Scaffold(
        appBar: AppBar(title: const Text('Edit medicine')),
        body: EmptyState(
          title: 'Could not load medicine',
          description: '$error',
          icon: Icons.cloud_off_rounded,
        ),
      ),
      data: (medicine) => _MedicineForm(existing: medicine),
    );
  }
}

class _MedicineForm extends ConsumerStatefulWidget {
  final Medicine? existing;

  const _MedicineForm({this.existing});

  @override
  ConsumerState<_MedicineForm> createState() => _MedicineFormState();
}

class _MedicineFormState extends ConsumerState<_MedicineForm> {
  final _formKey = GlobalKey<FormState>();
  late final Map<String, TextEditingController> _controllers;
  String? _form;
  String? _unit;
  bool _showOptional = false;
  bool _isSaving = false;

  Medicine? get _existing => widget.existing;

  @override
  void initState() {
    super.initState();
    final existing = _existing;
    _controllers = {
      for (final key in [
        'name',
        'genericName',
        'category',
        'reorderLevel',
        'brand',
        'strength',
        'packSize',
        'mrp',
        'gstPercent',
        'barcode',
        'location',
      ])
        key: TextEditingController(),
    };

    if (existing != null) {
      _controllers['name']!.text = existing.name;
      _controllers['genericName']!.text = existing.genericName;
      _controllers['category']!.text = existing.category;
      _controllers['reorderLevel']!.text = '${existing.reorderLevel}';
      _controllers['brand']!.text = existing.brand ?? '';
      _controllers['strength']!.text = existing.strength ?? '';
      _controllers['packSize']!.text = existing.packSize?.toString() ?? '';
      _controllers['mrp']!.text = existing.mrp?.toString() ?? '';
      _controllers['gstPercent']!.text = existing.gstPercent?.toString() ?? '';
      _controllers['barcode']!.text = existing.barcode ?? '';
      _controllers['location']!.text = existing.location ?? '';
      _form = existing.form;
      _unit = existing.unit;
      _showOptional = existing.brand != null ||
          existing.mrp != null ||
          existing.barcode != null ||
          existing.location != null;
    }
  }

  @override
  void dispose() {
    for (final controller in _controllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  String _text(String key) => _controllers[key]!.text.trim();

  Map<String, dynamic> _buildPayload() {
    final payload = <String, dynamic>{
      'name': _text('name'),
      'genericName': _text('genericName'),
      'category': _text('category'),
      'reorderLevel': int.parse(_text('reorderLevel')),
    };

    void addText(String key) {
      if (_text(key).isNotEmpty) payload[key] = _text(key);
    }

    void addNumber(String key, {bool asInt = false}) {
      final raw = _text(key);
      if (raw.isEmpty) return;
      final parsed = num.tryParse(raw);
      if (parsed == null) return;
      payload[key] = asInt ? parsed.toInt() : parsed.toDouble();
    }

    addText('brand');
    addText('strength');
    addText('barcode');
    addText('location');
    addNumber('packSize', asInt: true);
    addNumber('mrp');
    addNumber('gstPercent');
    if (_form != null) payload['form'] = _form;
    if (_unit != null) payload['unit'] = _unit;

    return payload;
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSaving = true);
    final messenger = ScaffoldMessenger.of(context);
    final router = GoRouter.of(context);
    final repository = ref.read(inventoryRepositoryPrv);
    final existing = _existing;

    try {
      final payload = _buildPayload();
      final saved = existing == null
          ? await repository.createMedicine(payload)
          : await repository.updateMedicine(existing.id, payload);

      invalidateInventory(ref);
      messenger.showSnackBar(
        SnackBar(
          content: Text(existing == null ? 'Medicine added' : 'Medicine updated'),
        ),
      );

      if (existing == null) {
        router.pushReplacement('/admin/inventory/medicines/${saved.id}');
      } else {
        router.pop();
      }
    } catch (error) {
      messenger.showSnackBar(SnackBar(content: Text('$error')));
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final categoriesAsync = ref.watch(medicineCategoriesPrv);
    final categories = categoriesAsync.value ?? const <String>[];

    return Scaffold(
      appBar: AppBar(
        title: Text(_existing == null ? 'Add medicine' : 'Edit medicine'),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => context.pop(),
        ),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
          children: [
            FormSection(
              title: 'Basic details',
              icon: Icons.info_outline,
              children: [
                LabeledField(
                  label: 'Name',
                  isRequired: true,
                  child: TextFormField(
                    controller: _controllers['name'],
                    textCapitalization: TextCapitalization.words,
                    decoration: const InputDecoration(hintText: 'e.g. Paracetamol 500mg'),
                    validator: _required,
                  ),
                ),
                LabeledField(
                  label: 'Generic name',
                  isRequired: true,
                  child: TextFormField(
                    controller: _controllers['genericName'],
                    textCapitalization: TextCapitalization.words,
                    decoration: const InputDecoration(hintText: 'e.g. Acetaminophen'),
                    validator: _required,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            FormSection(
              title: 'Classification',
              icon: Icons.category_outlined,
              children: [
                LabeledField(
                  label: 'Category',
                  isRequired: true,
                  child: Autocomplete<String>(
                    initialValue: TextEditingValue(text: _controllers['category']!.text),
                    optionsBuilder: (value) {
                      if (value.text.isEmpty) return categories;
                      return categories.where(
                        (c) => c.toLowerCase().contains(value.text.toLowerCase()),
                      );
                    },
                    onSelected: (value) => _controllers['category']!.text = value,
                    fieldViewBuilder: (context, controller, focusNode, onSubmitted) {
                      controller.addListener(
                        () => _controllers['category']!.text = controller.text,
                      );
                      return TextFormField(
                        controller: controller,
                        focusNode: focusNode,
                        textCapitalization: TextCapitalization.words,
                        decoration: const InputDecoration(
                          hintText: 'e.g. Analgesics',
                          suffixIcon: Icon(Icons.arrow_drop_down),
                        ),
                        validator: _required,
                      );
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            FormSection(
              title: 'Inventory thresholds',
              icon: Icons.inventory_2_outlined,
              children: [
                LabeledField(
                  label: 'Reorder level',
                  isRequired: true,
                  child: TextFormField(
                    controller: _controllers['reorderLevel'],
                    keyboardType: TextInputType.number,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    decoration: const InputDecoration(hintText: 'e.g. 100'),
                    validator: (value) {
                      if (value == null || value.trim().isEmpty) return 'Required';
                      if (int.tryParse(value.trim()) == null) return 'Enter a whole number';
                      return null;
                    },
                  ),
                ),
                if (_existing == null)
                  const FormHint(
                    message:
                        'Stock starts at 0. Add a batch after creating the medicine to bring it into inventory.',
                  ),
              ],
            ),
            const SizedBox(height: 20),
            _OptionalToggle(
              expanded: _showOptional,
              onTap: () => setState(() => _showOptional = !_showOptional),
            ),
            if (_showOptional) ...[
              const SizedBox(height: 16),
              FormSection(
                title: 'Product & pricing',
                icon: Icons.sell_outlined,
                children: [
                  LabeledField(
                    label: 'Brand',
                    child: TextFormField(
                      controller: _controllers['brand'],
                      decoration: const InputDecoration(hintText: 'e.g. Crocin'),
                    ),
                  ),
                  Row(
                    children: [
                      Expanded(
                        child: LabeledField(
                          label: 'Form',
                          child: DropdownButtonFormField<String>(
                            initialValue: _form,
                            isExpanded: true,
                            hint: const Text('Select'),
                            items: [
                              for (final value in _forms)
                                DropdownMenuItem(value: value, child: Text(value)),
                            ],
                            onChanged: (value) => setState(() => _form = value),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: LabeledField(
                          label: 'Strength',
                          child: TextFormField(
                            controller: _controllers['strength'],
                            decoration: const InputDecoration(hintText: '500mg'),
                          ),
                        ),
                      ),
                    ],
                  ),
                  Row(
                    children: [
                      Expanded(
                        child: LabeledField(
                          label: 'Unit',
                          child: DropdownButtonFormField<String>(
                            initialValue: _unit,
                            isExpanded: true,
                            hint: const Text('Select'),
                            items: [
                              for (final value in _units)
                                DropdownMenuItem(value: value, child: Text(value)),
                            ],
                            onChanged: (value) => setState(() => _unit = value),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: LabeledField(
                          label: 'Pack size',
                          child: TextFormField(
                            controller: _controllers['packSize'],
                            keyboardType: TextInputType.number,
                            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                            decoration: const InputDecoration(hintText: '10'),
                          ),
                        ),
                      ),
                    ],
                  ),
                  Row(
                    children: [
                      Expanded(
                        child: LabeledField(
                          label: 'MRP',
                          child: TextFormField(
                            controller: _controllers['mrp'],
                            keyboardType:
                                const TextInputType.numberWithOptions(decimal: true),
                            decoration: const InputDecoration(
                              hintText: '0.00',
                              prefixText: '₹ ',
                            ),
                            validator: _optionalNumber,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: LabeledField(
                          label: 'GST %',
                          child: TextFormField(
                            controller: _controllers['gstPercent'],
                            keyboardType:
                                const TextInputType.numberWithOptions(decimal: true),
                            decoration: const InputDecoration(hintText: '12'),
                            validator: _optionalNumber,
                          ),
                        ),
                      ),
                    ],
                  ),
                  LabeledField(
                    label: 'Barcode',
                    child: TextFormField(
                      controller: _controllers['barcode'],
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(hintText: '8901234567890'),
                    ),
                  ),
                  LabeledField(
                    label: 'Shelf location',
                    child: TextFormField(
                      controller: _controllers['location'],
                      decoration: const InputDecoration(hintText: 'e.g. Rack A-1'),
                    ),
                  ),
                ],
              ),
            ],
            const SizedBox(height: 12),
            AppButton(
              label: _existing == null ? 'Save medicine' : 'Save changes',
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

  String? _required(String? value) =>
      (value == null || value.trim().isEmpty) ? 'This field is required' : null;

  String? _optionalNumber(String? value) {
    if (value == null || value.trim().isEmpty) return null;
    return num.tryParse(value.trim()) == null ? 'Enter a valid number' : null;
  }
}

class _OptionalToggle extends StatelessWidget {
  final bool expanded;
  final VoidCallback onTap;

  const _OptionalToggle({required this.expanded, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(
          children: [
            Icon(
              expanded ? Icons.expand_less : Icons.expand_more,
              size: 20,
              color: AppColors.primary,
            ),
            const SizedBox(width: 6),
            Text(
              expanded ? 'Hide optional details' : 'Add optional details (MRP, barcode, shelf)',
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: AppColors.primary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
