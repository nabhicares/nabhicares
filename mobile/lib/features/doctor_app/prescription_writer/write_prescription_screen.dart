import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/empty_state.dart';
import '../../../core/widgets/loading_indicator.dart';

class FormPrescriptionItem {
  String medicineId;
  String medicineName;
  String dosage;
  String duration;
  String instructions;

  FormPrescriptionItem({
    required this.medicineId,
    required this.medicineName,
    this.dosage = '1-0-1',
    this.duration = '5 days',
    this.instructions = 'Take after meals',
  });

  Map<String, dynamic> toJson() {
    return {
      'medicineId': medicineId,
      'medicineName': medicineName,
      'dosage': dosage,
      'duration': duration,
      'instructions': instructions,
    };
  }
}

// Fetch medicines list for dropdown selection
final medicineDropdownListProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
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
  ConsumerState<WritePrescriptionScreen> createState() => _WritePrescriptionScreenState();
}

class _WritePrescriptionScreenState extends ConsumerState<WritePrescriptionScreen> {
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

  void _removeItem(int index) {
    setState(() {
      _items.removeAt(index);
    });
  }

  Future<void> _submitPrescription() async {
    if (_items.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please add at least one medicine to the prescription.')),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      final dio = ref.read(dioClientPrv);
      final uniqueConsultId = "consult-${DateTime.now().millisecondsSinceEpoch}";
      
      final response = await dio.post('/prescriptions', data: {
        'consultationId': uniqueConsultId,
        'patientId': 'BADP1K3A', // Matches default seeded patient ID
        'items': _items.map((e) => e.toJson()).toList(),
      });

      if (mounted) {
        setState(() => _isSubmitting = false);
        if (response.data != null && response.data['success'] == true) {
          _showSuccessDialog();
        } else {
          _showError(response.data['error']?['message'] ?? 'Failed to submit prescription.');
        }
      }
    } on DioException catch (e) {
      if (mounted) {
        setState(() => _isSubmitting = false);
        _showError(e.response?.data?['error']?['message'] ?? 'Failed to connect to prescriptions API.');
      }
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: AppColors.critical,
      ),
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
          'Prescription has been recorded and pushed to the pharmacy billing logs. The pharmacist can now fulfill this order.',
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(context); // Pop dialog
              Navigator.pop(context); // Pop screen
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
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header Patient summary info
          Container(
            color: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            child: AppCard(
              backgroundColor: AppColors.background,
              hasBorder: false,
              child: const Row(
                children: [
                  Icon(Icons.person, color: AppColors.primary),
                  SizedBox(width: 12),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Alice Patient',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                      ),
                      Text(
                        'Allergies: Penicillin • Age: 33',
                        style: TextStyle(color: AppColors.textSecondary, fontSize: 11),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          
          // Prescription Item builder list
          Expanded(
            child: _items.isEmpty
                ? const EmptyState(
                    title: 'Prescription is Empty',
                    description: 'Search and select medicines from the catalog to build this prescription.',
                    icon: Icons.medication_outlined,
                  )
                : ListView.builder(
                    padding: const EdgeInsets.all(20),
                    itemCount: _items.length,
                    itemBuilder: (context, index) {
                      final item = _items[index];
                      return _buildPrescriptionItemCard(item, index);
                    },
                  ),
          ),
          
          // Selection and Submission actions footer
          Container(
            color: Colors.white,
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                medicinesAsync.when(
                  data: (meds) {
                    return AppButton(
                      label: 'Add Medicine Row',
                      type: AppButtonType.outline,
                      icon: Icons.add,
                      onPressed: () => _showAddMedicineBottomSheet(meds),
                    );
                  },
                  loading: () => const Center(child: CircularProgressIndicator()),
                  error: (_, __) => AppButton(
                    label: 'Add Row (Offline Mode)',
                    type: AppButtonType.outline,
                    icon: Icons.add,
                    onPressed: () => _addItem({'id': 'MED-ASP-100', 'name': 'Aspirin 100mg'}),
                  ),
                ),
                const SizedBox(height: 12),
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

  Widget _buildPrescriptionItemCard(FormPrescriptionItem item, int index) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      child: AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    item.medicineName,
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: AppColors.primary),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.delete_outline, color: AppColors.critical, size: 20),
                  onPressed: () => _removeItem(index),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    onChanged: (val) => item.dosage = val,
                    decoration: InputDecoration(
                      labelText: 'Dosage',
                      hintText: 'e.g. 1-0-1',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    ),
                    controller: TextEditingController(text: item.dosage),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextField(
                    onChanged: (val) => item.duration = val,
                    decoration: InputDecoration(
                      labelText: 'Duration',
                      hintText: 'e.g. 5 days',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    ),
                    controller: TextEditingController(text: item.duration),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              onChanged: (val) => item.instructions = val,
              decoration: InputDecoration(
                labelText: 'Special Instructions',
                hintText: 'e.g. Take after breakfast and dinner',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              ),
              controller: TextEditingController(text: item.instructions),
            ),
          ],
        ),
      ),
    );
  }

  void _showAddMedicineBottomSheet(List<Map<String, dynamic>> meds) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) {
        return Container(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Select Medicine SKU',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 16),
              Expanded(
                child: ListView.builder(
                  itemCount: meds.length,
                  itemBuilder: (context, index) {
                    final med = meds[index];
                    return ListTile(
                      leading: const Icon(Icons.medication, color: AppColors.primary),
                      title: Text(med['name'] as String, style: const TextStyle(fontWeight: FontWeight.w600)),
                      subtitle: Text(med['category'] as String),
                      onTap: () {
                        _addItem(med);
                        Navigator.pop(context); // Close bottom sheet
                      },
                    );
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
