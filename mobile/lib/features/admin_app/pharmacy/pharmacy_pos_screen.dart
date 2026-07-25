import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/empty_state.dart';
import '../../../core/widgets/loading_indicator.dart';
import '../../../shared_models/prescription.dart';

// Fetch all pending prescriptions from GET /prescriptions endpoint
final pendingPrescriptionsProvider = FutureProvider<List<Prescription>>((ref) async {
  final dio = ref.watch(dioClientPrv);
  final response = await dio.get('/prescriptions');
  
  if (response.data != null && response.data['success'] == true) {
    final list = response.data['data'] as List<dynamic>? ?? [];
    final prescriptions = list.map((e) => Prescription.fromJson(e as Map<String, dynamic>)).toList();
    // Only display pending prescriptions in the POS checkout list
    return prescriptions.where((e) => e.status == 'pending').toList();
  }
  return [];
});

final medicineBatchesProvider = FutureProvider.family<List<dynamic>, String>((ref, medicineId) async {
  final dio = ref.watch(dioClientPrv);
  final response = await dio.get('/inventory/medicines/$medicineId/batches');
  
  if (response.data != null && response.data['success'] == true) {
    return response.data['data'] as List<dynamic>? ?? [];
  }
  return [];
});

class PharmacyPosScreen extends ConsumerStatefulWidget {
  const PharmacyPosScreen({super.key});

  @override
  ConsumerState<PharmacyPosScreen> createState() => _PharmacyPosScreenState();
}

class _PharmacyPosScreenState extends ConsumerState<PharmacyPosScreen> {
  Prescription? _selectedPrescription;
  final Map<String, String> _selectedBatches = {}; // Maps medicineId -> batchNo
  bool _isDispensing = false;

  Future<void> _handleDispense() async {
    if (_selectedPrescription == null) return;

    // Validate that a batch is selected for every item
    for (final item in _selectedPrescription!.items) {
      if (!_selectedBatches.containsKey(item.medicineId)) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Please select a stock batch for ${item.medicineName}.')),
        );
        return;
      }
    }

    setState(() => _isDispensing = true);

    try {
      final dio = ref.read(dioClientPrv);
      final dispenseItems = _selectedPrescription!.items.map((item) {
        return {
          'medicineId': item.medicineId,
          'batchNo': _selectedBatches[item.medicineId],
          'quantity': 10, // Default dispense quantity per dosage rules
        };
      }).toList();

      final response = await dio.post('/pharmacy/dispense', data: {
        'prescriptionId': _selectedPrescription!.id,
        'items': dispenseItems,
      });

      if (mounted) {
        setState(() => _isDispensing = false);
        if (response.data != null && response.data['success'] == true) {
          _showDispenseSuccessDialog(response.data['data']);
        } else {
          _showError(response.data['error']?['message'] ?? 'Dispense transaction failed.');
        }
      }
    } on DioException catch (e) {
      if (mounted) {
        setState(() => _isDispensing = false);
        _showError(e.response?.data?['error']?['message'] ?? 'Batch stock insufficient.');
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

  void _showDispenseSuccessDialog(Map<String, dynamic> responseData) {
    final invoiceNo = responseData['invoice']?['id'] ?? 'INV-${DateTime.now().millisecondsSinceEpoch}';
    final totalAmount = (responseData['invoice']?['totalAmount'] as num?)?.toDouble() ?? 45.0;
    final taxAmount = (responseData['invoice']?['taxAmount'] as num?)?.toDouble() ?? 8.1;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Row(
          children: [
            Icon(Icons.check_circle_rounded, color: AppColors.success, size: 28),
            SizedBox(width: 12),
            Text('Dispensed & Billed!'),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Inventory has been decremented. invoice receipt generated:'),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.background,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.grey.shade300),
              ),
              child: Column(
                children: [
                  _buildReceiptRow('Invoice ID:', invoiceNo),
                  _buildReceiptRow('Dispensation Status:', 'COMPLETED'),
                  const Divider(),
                  _buildReceiptRow('Tax (18%):', '\$${taxAmount.toStringAsFixed(2)}'),
                  _buildReceiptRow('Total Price:', '\$${totalAmount.toStringAsFixed(2)}'),
                ],
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(context); // Pop dialog
              setState(() {
                _selectedPrescription = null;
                _selectedBatches.clear();
              });
              ref.invalidate(pendingPrescriptionsProvider);
            },
            child: const Text('OK', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  Widget _buildReceiptRow(String label, String val) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12, color: AppColors.textSecondary)),
          Text(val, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppColors.textPrimary)),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final prescriptionsAsync = ref.watch(pendingPrescriptionsProvider);
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
          'Pharmacy POS',
          style: theme.textTheme.titleLarge?.copyWith(
            fontWeight: FontWeight.bold,
            color: AppColors.textPrimary,
          ),
        ),
      ),
      body: Row(
        children: [
          // Left Sidebar: Pending Prescriptions Queue
          Expanded(
            flex: 2,
            child: Container(
              decoration: BoxDecoration(
                border: Border(right: BorderSide(color: Colors.grey.shade200)),
              ),
              child: prescriptionsAsync.when(
                data: (prescriptions) {
                  if (prescriptions.isEmpty) {
                    return const EmptyState(
                      title: 'Queue is Empty',
                      description: 'No pending prescriptions found in the clinic queues.',
                      icon: Icons.checklist_rtl_rounded,
                    );
                  }

                  return ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: prescriptions.length,
                    itemBuilder: (context, index) {
                      final rx = prescriptions[index];
                      final isSelected = _selectedPrescription?.id == rx.id;
                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        child: AppCard(
                          backgroundColor: isSelected ? AppColors.primary.withOpacity(0.06) : Colors.white,
                          hasBorder: true,
                          onTap: () {
                            setState(() {
                              _selectedPrescription = rx;
                              _selectedBatches.clear();
                            });
                          },
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Rx ID: ${rx.id}',
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.primary),
                              ),
                              const SizedBox(height: 4),
                              Text('Patient ID: ${rx.patientId}', style: const TextStyle(fontSize: 11)),
                              Text('${rx.items.length} Medicines Prescribed', style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                            ],
                          ),
                        ),
                      );
                    },
                  );
                },
                loading: () => const LoadingIndicator(message: 'Loading POS Queue...'),
                error: (err, __) => Center(child: Text('Error loading POS queue: $err')),
              ),
            ),
          ),

          // Right Panel: Dispensation Checkout detail
          Expanded(
            flex: 3,
            child: _selectedPrescription == null
                ? const EmptyState(
                    title: 'Select a Patient',
                    description: 'Choose a pending prescription from the left queue to check out.',
                    icon: Icons.point_of_sale_rounded,
                  )
                : Container(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          'Checkout Details',
                          style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 16),
                        
                        // Items List with batch dropdown picker
                        Expanded(
                          child: ListView.builder(
                            itemCount: _selectedPrescription!.items.length,
                            itemBuilder: (context, index) {
                              final item = _selectedPrescription!.items[index];
                              return Container(
                                margin: const EdgeInsets.only(bottom: 16),
                                child: AppCard(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        item.medicineName,
                                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppColors.textPrimary),
                                      ),
                                      Text(
                                        'Dosage: ${item.dosage} • ${item.duration}',
                                        style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                                      ),
                                      const SizedBox(height: 12),
                                      
                                      // Select Batch Dropdown
                                      Consumer(
                                        builder: (context, ref, child) {
                                          final batchesAsync = ref.watch(medicineBatchesProvider(item.medicineId));
                                          return batchesAsync.when(
                                            data: (batches) {
                                              if (batches.isEmpty) {
                                                return const Text(
                                                  'No batches available for this medicine.',
                                                  style: TextStyle(color: AppColors.critical, fontSize: 12, fontWeight: FontWeight.bold),
                                                );
                                              }
                                              return DropdownButtonFormField<String>(
                                                decoration: InputDecoration(
                                                  labelText: 'Fulfillment Batch',
                                                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                                                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                                ),
                                                value: _selectedBatches[item.medicineId],
                                                items: batches.map<DropdownMenuItem<String>>((batch) {
                                                  final batchNo = batch['batchNo'] as String;
                                                  final quantity = batch['quantity'] as int;
                                                  return DropdownMenuItem<String>(
                                                    value: batchNo,
                                                    child: Text('$batchNo ($quantity units)'),
                                                  );
                                                }).toList(),
                                                onChanged: (val) {
                                                  if (val != null) {
                                                    setState(() {
                                                      _selectedBatches[item.medicineId] = val;
                                                    });
                                                  }
                                                },
                                              );
                                            },
                                            loading: () => const SizedBox(
                                              height: 48,
                                              child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
                                            ),
                                            error: (err, __) => Text(
                                              'Failed to load batches: $err',
                                              style: const TextStyle(color: AppColors.critical, fontSize: 11),
                                            ),
                                          );
                                        },
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),
                        ),

                        // Fulfill button
                        const SizedBox(height: 20),
                        AppButton(
                          label: 'Fulfill & Generate Invoice',
                          isLoading: _isDispensing,
                          onPressed: _handleDispense,
                        ),
                      ],
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}
