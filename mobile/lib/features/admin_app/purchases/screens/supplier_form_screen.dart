import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/form_widgets.dart';
import '../../../../core/widgets/loading_indicator.dart';
import '../../../../shared_models/supplier.dart';
import '../data/purchases_repository.dart';
import '../providers/purchases_providers.dart';

class SupplierFormScreen extends ConsumerWidget {
  final String? supplierId;

  const SupplierFormScreen({super.key, this.supplierId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (supplierId == null) return const _SupplierForm();

    final suppliersAsync = ref.watch(suppliersPrv);
    return suppliersAsync.when(
      loading: () => const Scaffold(body: LoadingIndicator(message: 'Loading supplier...')),
      error: (error, _) => Scaffold(
        appBar: AppBar(title: const Text('Edit supplier')),
        body: EmptyState(
          title: 'Could not load supplier',
          description: '$error',
          icon: Icons.cloud_off_rounded,
        ),
      ),
      data: (suppliers) {
        Supplier? existing;
        for (final supplier in suppliers) {
          if (supplier.id == supplierId) existing = supplier;
        }
        if (existing == null) {
          return Scaffold(
            appBar: AppBar(title: const Text('Edit supplier')),
            body: const EmptyState(
              title: 'Supplier not found',
              description: 'This supplier may have been removed.',
              icon: Icons.search_off_rounded,
            ),
          );
        }
        return _SupplierForm(existing: existing);
      },
    );
  }
}

class _SupplierForm extends ConsumerStatefulWidget {
  final Supplier? existing;

  const _SupplierForm({this.existing});

  @override
  ConsumerState<_SupplierForm> createState() => _SupplierFormState();
}

class _SupplierFormState extends ConsumerState<_SupplierForm> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name;
  late final TextEditingController _email;
  late final TextEditingController _address;
  late final TextEditingController _phone;
  late final TextEditingController _gstin;
  late final TextEditingController _contactPerson;
  late bool _isActive;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    final existing = widget.existing;
    _name = TextEditingController(text: existing?.name ?? '');
    _email = TextEditingController(text: existing?.contactEmail ?? '');
    _address = TextEditingController(text: existing?.address ?? '');
    _phone = TextEditingController(text: existing?.phone ?? '');
    _gstin = TextEditingController(text: existing?.gstin ?? '');
    _contactPerson = TextEditingController(text: existing?.contactPerson ?? '');
    _isActive = existing?.isActive ?? true;
  }

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _address.dispose();
    _phone.dispose();
    _gstin.dispose();
    _contactPerson.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSaving = true);
    final messenger = ScaffoldMessenger.of(context);
    final router = GoRouter.of(context);
    final repository = ref.read(purchasesRepositoryPrv);
    final existing = widget.existing;

    final payload = <String, dynamic>{
      'name': _name.text.trim(),
      'contactEmail': _email.text.trim(),
      'address': _address.text.trim(),
      if (_phone.text.trim().isNotEmpty) 'phone': _phone.text.trim(),
      if (_gstin.text.trim().isNotEmpty) 'gstin': _gstin.text.trim(),
      if (_contactPerson.text.trim().isNotEmpty) 'contactPerson': _contactPerson.text.trim(),
      if (existing != null) 'status': _isActive ? 'active' : 'inactive',
    };

    try {
      if (existing == null) {
        await repository.createSupplier(payload);
      } else {
        await repository.updateSupplier(existing.id, payload);
      }
      invalidatePurchases(ref);
      messenger.showSnackBar(
        SnackBar(content: Text(existing == null ? 'Supplier added' : 'Supplier updated')),
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
    final isEditing = widget.existing != null;

    return Scaffold(
      appBar: AppBar(title: Text(isEditing ? 'Edit supplier' : 'Add supplier')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
          children: [
            FormSection(
              title: 'Supplier details',
              icon: Icons.storefront_outlined,
              children: [
                LabeledField(
                  label: 'Name',
                  isRequired: true,
                  child: TextFormField(
                    controller: _name,
                    textCapitalization: TextCapitalization.words,
                    decoration: const InputDecoration(hintText: 'e.g. MedPlus Distributors'),
                    validator: _required,
                  ),
                ),
                LabeledField(
                  label: 'Contact email',
                  isRequired: true,
                  child: TextFormField(
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(hintText: 'orders@supplier.com'),
                    validator: (value) {
                      final text = value?.trim() ?? '';
                      if (text.isEmpty) return 'This field is required';
                      if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(text)) {
                        return 'Enter a valid email';
                      }
                      return null;
                    },
                  ),
                ),
                LabeledField(
                  label: 'Address',
                  isRequired: true,
                  child: TextFormField(
                    controller: _address,
                    maxLines: 2,
                    decoration: const InputDecoration(hintText: 'Street, city, PIN'),
                    validator: _required,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            FormSection(
              title: 'Contact & compliance',
              icon: Icons.badge_outlined,
              children: [
                LabeledField(
                  label: 'Phone',
                  child: TextFormField(
                    controller: _phone,
                    keyboardType: TextInputType.phone,
                    decoration: const InputDecoration(hintText: '+91 98765 43210'),
                  ),
                ),
                LabeledField(
                  label: 'Contact person',
                  child: TextFormField(
                    controller: _contactPerson,
                    textCapitalization: TextCapitalization.words,
                    decoration: const InputDecoration(hintText: 'e.g. Ramesh Kumar'),
                  ),
                ),
                LabeledField(
                  label: 'GSTIN',
                  child: TextFormField(
                    controller: _gstin,
                    textCapitalization: TextCapitalization.characters,
                    decoration: const InputDecoration(hintText: '29ABCDE1234F1Z5'),
                  ),
                ),
              ],
            ),
            if (isEditing)
              SwitchListTile(
                value: _isActive,
                onChanged: (value) => setState(() => _isActive = value),
                contentPadding: EdgeInsets.zero,
                activeThumbColor: AppColors.primary,
                title: const Text('Active supplier'),
                subtitle: const Text(
                  'Inactive suppliers cannot be selected on new purchase orders.',
                  style: TextStyle(fontSize: 12),
                ),
              ),
            const SizedBox(height: 20),
            AppButton(
              label: isEditing ? 'Save changes' : 'Add supplier',
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
}
