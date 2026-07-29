import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/dio_client.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/empty_state.dart';
import '../../care/data/care_repository.dart';

const _dosagePresets = ['1-0-0', '0-1-0', '0-0-1', '1-0-1', '1-1-0', '0-1-1', '1-1-1', 'SOS'];
const _durationPresets = [3, 5, 7, 10, 14, 30];
const _instructionPresets = [
  'After food',
  'Before food',
  'With water',
  'At bedtime',
  'As needed',
  'Empty stomach',
];

class FormPrescriptionItem {
  final String medicineId;
  final String medicineName;
  String dosage;
  int durationDays;
  String instructions;

  FormPrescriptionItem({
    required this.medicineId,
    required this.medicineName,
    this.dosage = '1-0-1',
    this.durationDays = 5,
    this.instructions = 'After food',
  });

  Map<String, dynamic> toJson() => {
        'medicineId': medicineId,
        'medicineName': medicineName,
        'dosage': dosage,
        'duration': '$durationDays days',
        'instructions': instructions,
      };
}

final medicineDropdownListProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final dio = ref.watch(dioClientPrv);
  final response = await dio.get('/inventory/medicines');
  if (response.data != null && response.data['success'] == true) {
    final list = response.data['data'] as List<dynamic>? ?? [];
    return list.map((e) => e as Map<String, dynamic>).toList();
  }
  return [];
});

class WritePrescriptionScreen extends ConsumerStatefulWidget {
  const WritePrescriptionScreen({super.key});

  @override
  ConsumerState<WritePrescriptionScreen> createState() =>
      _WritePrescriptionScreenState();
}

class _WritePrescriptionScreenState
    extends ConsumerState<WritePrescriptionScreen> {
  final List<FormPrescriptionItem> _items = [];
  bool _isSubmitting = false;

  void _addItem(Map<String, dynamic> medicine) {
    setState(() {
      _items.add(FormPrescriptionItem(
        medicineId: medicine['id'] as String,
        medicineName: medicine['name'] as String,
      ));
    });
  }

  void _removeItem(int index) => setState(() => _items.removeAt(index));

  Future<void> _submitPrescription() async {
    if (_items.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Add at least one medicine.')),
      );
      return;
    }

    setState(() => _isSubmitting = true);
    try {
      final dio = ref.read(dioClientPrv);
      final response = await dio.post('/prescriptions', data: {
        'consultationId': 'consult-${DateTime.now().millisecondsSinceEpoch}',
        'patientId': CareDemoIds.patientId,
        'items': _items.map((e) => e.toJson()).toList(),
      });

      if (!mounted) return;
      setState(() => _isSubmitting = false);
      if (response.data != null && response.data['success'] == true) {
        _showSuccessDialog();
      } else {
        _showError(response.data['error']?['message'] ?? 'Failed to submit.');
      }
    } on DioException catch (e) {
      if (!mounted) return;
      setState(() => _isSubmitting = false);
      _showError(
        e.response?.data?['error']?['message'] ??
            'Failed to connect to prescriptions API.',
      );
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: AppColors.critical),
    );
  }

  void _showSuccessDialog() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Row(
          children: [
            Icon(Icons.check_circle_rounded, color: AppColors.success, size: 28),
            SizedBox(width: 12),
            Text('Prescription Saved'),
          ],
        ),
        content: const Text(
          'Sent to pharmacy. The pharmacist can fulfill this order now.',
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              Navigator.pop(context);
            },
            child: const Text('OK', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final medicinesAsync = ref.watch(medicineDropdownListProvider);
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'Issue Prescription',
          style: theme.textTheme.titleLarge?.copyWith(
            fontWeight: FontWeight.bold,
            color: AppColors.textPrimary,
          ),
        ),
      ),
      body: Column(
        children: [
          Container(
            width: double.infinity,
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
            child: AppCard(
              backgroundColor: AppColors.background,
              hasBorder: false,
              padding: const EdgeInsets.all(12),
              child: const Row(
                children: [
                  Icon(Icons.person, color: AppColors.primary),
                  SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Alice Patient',
                            style: TextStyle(
                                fontWeight: FontWeight.bold, fontSize: 14)),
                        Text(
                          'Allergies: Penicillin · Age: 33',
                          style: TextStyle(
                              color: AppColors.textSecondary, fontSize: 11),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          Expanded(
            child: _items.isEmpty
                ? const EmptyState(
                    title: 'No medicines yet',
                    description:
                        'Tap Add Medicine, then pick dosage / duration / instructions with one tap.',
                    icon: Icons.medication_outlined,
                  )
                : ListView.builder(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
                    itemCount: _items.length,
                    itemBuilder: (_, index) =>
                        _MedicineCard(
                          item: _items[index],
                          onChanged: () => setState(() {}),
                          onRemove: () => _removeItem(index),
                        ),
                  ),
          ),
          Container(
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                medicinesAsync.when(
                  data: (meds) => AppButton(
                    label: 'Add Medicine',
                    type: AppButtonType.outline,
                    icon: Icons.add,
                    onPressed: () => _showMedicinePicker(meds),
                  ),
                  loading: () => const Center(child: CircularProgressIndicator()),
                  error: (_, __) => AppButton(
                    label: 'Add Medicine',
                    type: AppButtonType.outline,
                    icon: Icons.add,
                    onPressed: () => _addItem(
                        {'id': 'MED-PAR-500', 'name': 'Paracetamol 500mg'}),
                  ),
                ),
                const SizedBox(height: 10),
                AppButton(
                  label: 'Publish Prescription',
                  isLoading: _isSubmitting,
                  onPressed: _submitPrescription,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _showMedicinePicker(List<Map<String, dynamic>> meds) {
    var query = '';
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (context, setSheet) {
            final filtered = meds.where((m) {
              final name = (m['name'] as String? ?? '').toLowerCase();
              return name.contains(query.toLowerCase());
            }).toList();
            return SizedBox(
              height: MediaQuery.of(context).size.height * 0.7,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'Select medicine',
                      style: Theme.of(context)
                          .textTheme
                          .titleMedium
                          ?.copyWith(fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      autofocus: true,
                      onChanged: (v) => setSheet(() => query = v),
                      decoration: InputDecoration(
                        hintText: 'Search catalog…',
                        prefixIcon: const Icon(Icons.search),
                        filled: true,
                        fillColor: AppColors.background,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide.none,
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Expanded(
                      child: ListView.builder(
                        itemCount: filtered.length,
                        itemBuilder: (_, i) {
                          final med = filtered[i];
                          final already = _items.any((e) => e.medicineId == med['id']);
                          return ListTile(
                            enabled: !already,
                            leading: const Icon(Icons.medication, color: AppColors.primary),
                            title: Text(
                              med['name'] as String? ?? '',
                              style: const TextStyle(fontWeight: FontWeight.w600),
                            ),
                            subtitle: Text(med['category'] as String? ?? ''),
                            trailing: already
                                ? const Text('Added',
                                    style: TextStyle(color: AppColors.textMuted, fontSize: 12))
                                : const Icon(Icons.add_circle_outline,
                                    color: AppColors.primary),
                            onTap: already
                                ? null
                                : () {
                                    _addItem(med);
                                    Navigator.pop(sheetContext);
                                  },
                          );
                        },
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }
}

class _MedicineCard extends StatelessWidget {
  final FormPrescriptionItem item;
  final VoidCallback onChanged;
  final VoidCallback onRemove;

  const _MedicineCard({
    required this.item,
    required this.onChanged,
    required this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      child: AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    item.medicineName,
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 15,
                      color: AppColors.primary,
                    ),
                  ),
                ),
                IconButton(
                  tooltip: 'Remove',
                  icon: const Icon(Icons.delete_outline,
                      color: AppColors.critical, size: 20),
                  onPressed: onRemove,
                ),
              ],
            ),
            const _Label('Dosage (M-A-N)'),
            const SizedBox(height: 6),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final dosage in _dosagePresets)
                  ChoiceChip(
                    label: Text(dosage),
                    selected: item.dosage == dosage,
                    onSelected: (_) {
                      item.dosage = dosage;
                      onChanged();
                    },
                    selectedColor: AppColors.primary,
                    labelStyle: TextStyle(
                      color: item.dosage == dosage
                          ? Colors.white
                          : AppColors.textPrimary,
                      fontWeight: FontWeight.w600,
                      fontSize: 13,
                    ),
                    backgroundColor: AppColors.background,
                    side: BorderSide(
                      color: item.dosage == dosage
                          ? AppColors.primary
                          : AppColors.border,
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 14),
            const _Label('Duration'),
            const SizedBox(height: 6),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final days in _durationPresets)
                  ChoiceChip(
                    label: Text('$days d'),
                    selected: item.durationDays == days,
                    onSelected: (_) {
                      item.durationDays = days;
                      onChanged();
                    },
                    selectedColor: AppColors.primary,
                    labelStyle: TextStyle(
                      color: item.durationDays == days
                          ? Colors.white
                          : AppColors.textPrimary,
                      fontWeight: FontWeight.w600,
                      fontSize: 13,
                    ),
                    backgroundColor: AppColors.background,
                    side: BorderSide(
                      color: item.durationDays == days
                          ? AppColors.primary
                          : AppColors.border,
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 14),
            const _Label('Instructions'),
            const SizedBox(height: 6),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final note in _instructionPresets)
                  ChoiceChip(
                    label: Text(note),
                    selected: item.instructions == note,
                    onSelected: (_) {
                      item.instructions = note;
                      onChanged();
                    },
                    selectedColor: AppColors.primary,
                    labelStyle: TextStyle(
                      color: item.instructions == note
                          ? Colors.white
                          : AppColors.textPrimary,
                      fontWeight: FontWeight.w600,
                      fontSize: 12,
                    ),
                    backgroundColor: AppColors.background,
                    side: BorderSide(
                      color: item.instructions == note
                          ? AppColors.primary
                          : AppColors.border,
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

class _Label extends StatelessWidget {
  final String text;
  const _Label(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text.toUpperCase(),
      style: const TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.5,
        color: AppColors.textSecondary,
      ),
    );
  }
}
