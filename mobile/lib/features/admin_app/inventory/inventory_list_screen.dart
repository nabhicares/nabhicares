import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/empty_state.dart';
import '../../../core/widgets/loading_indicator.dart';
import '../../../shared_models/medicine.dart';

// Fetch all medicines from GET /inventory/medicines endpoint
final inventoryMedicinesProvider = FutureProvider<List<Medicine>>((ref) async {
  final dio = ref.watch(dioClientPrv);
  final response = await dio.get('/inventory/medicines');
  
  if (response.data != null && response.data['success'] == true) {
    final list = response.data['data'] as List<dynamic>? ?? [];
    return list.map((e) => Medicine.fromJson(e as Map<String, dynamic>)).toList();
  }
  return [];
});

class InventoryListScreen extends ConsumerStatefulWidget {
  const InventoryListScreen({super.key});

  @override
  ConsumerState<InventoryListScreen> createState() => _InventoryListScreenState();
}

class _InventoryListScreenState extends ConsumerState<InventoryListScreen> {
  String _searchQuery = '';
  String _selectedFilter = 'All';

  @override
  Widget build(BuildContext context) {
    final medicinesAsync = ref.watch(inventoryMedicinesProvider);
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header search & filter controls panel
            Container(
              color: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              child: Column(
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          onChanged: (val) => setState(() => _searchQuery = val),
                          decoration: InputDecoration(
                            hintText: 'Search SKU catalog...',
                            prefixIcon: const Icon(Icons.search, color: AppColors.textMuted),
                            filled: true,
                            fillColor: AppColors.background,
                            contentPadding: const EdgeInsets.symmetric(vertical: 0, horizontal: 16),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                              borderSide: BorderSide.none,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  
                  // Simple filter category chips
                  SizedBox(
                    height: 38,
                    child: ListView(
                      scrollDirection: Axis.horizontal,
                      children: [
                        _buildFilterChip('All'),
                        _buildFilterChip('Analgesics'),
                        _buildFilterChip('NSAIDs'),
                        _buildFilterChip('Antibiotics'),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // Medicines List View
            Expanded(
              child: medicinesAsync.when(
                data: (medicines) {
                  final filtered = medicines.where((med) {
                    final matchesQuery = med.name.toLowerCase().contains(_searchQuery.toLowerCase()) || 
                                         med.id.toLowerCase().contains(_searchQuery.toLowerCase());
                    final matchesFilter = _selectedFilter == 'All' || med.category == _selectedFilter;
                    return matchesQuery && matchesFilter;
                  }).toList();

                  if (filtered.isEmpty) {
                    return const EmptyState(
                      title: 'No Medicines Found',
                      description: 'Try adjusting your search filters or add new inventory batches.',
                      icon: Icons.inventory_outlined,
                    );
                  }

                  return ListView.builder(
                    padding: const EdgeInsets.all(20),
                    itemCount: filtered.length,
                    itemBuilder: (context, index) {
                      final med = filtered[index];
                      return _buildMedicineItemCard(med, theme);
                    },
                  );
                },
                loading: () => const LoadingIndicator(message: 'Loading medicine list...'),
                error: (err, __) => EmptyState(
                  title: 'Connection Error',
                  description: 'Failed to retrieve medicine list: $err',
                  icon: Icons.wifi_off_rounded,
                  actionLabel: 'Retry',
                  onActionPressed: () => ref.refresh(inventoryMedicinesProvider),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFilterChip(String label) {
    final isSelected = _selectedFilter == label;
    return Padding(
      padding: const EdgeInsets.only(right: 8.0),
      child: ChoiceChip(
        label: Text(label),
        selected: isSelected,
        onSelected: (selected) {
          if (selected) {
            setState(() => _selectedFilter = label);
          }
        },
        selectedColor: AppColors.primary,
        backgroundColor: AppColors.background,
        labelStyle: TextStyle(
          color: isSelected ? Colors.white : AppColors.textPrimary,
          fontSize: 12,
          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
          side: BorderSide(color: isSelected ? AppColors.primary : Colors.grey.shade200),
        ),
      ),
    );
  }

  Widget _buildMedicineItemCard(Medicine med, ThemeData theme) {
    final isLowStock = med.totalQuantity <= med.reorderLevel;
    
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      child: AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      med.name,
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: AppColors.textPrimary),
                    ),
                    Text(
                      'Category: ${med.category} • SKU: ${med.id}',
                      style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                    ),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: isLowStock ? AppColors.critical.withOpacity(0.12) : AppColors.success.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    isLowStock ? 'Low Stock' : 'In Stock',
                    style: TextStyle(
                      color: isLowStock ? AppColors.critical : AppColors.success,
                      fontWeight: FontWeight.bold,
                      fontSize: 11,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            const Divider(height: 1),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Total Quantity', style: TextStyle(fontSize: 11, color: AppColors.textMuted)),
                    Text(
                      '${med.totalQuantity} units',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                        color: isLowStock ? AppColors.critical : AppColors.textPrimary,
                      ),
                    ),
                  ],
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Min Alert Level', style: TextStyle(fontSize: 11, color: AppColors.textMuted)),
                    Text(
                      '${med.reorderLevel} units',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppColors.textPrimary),
                    ),
                  ],
                ),
                AppButton(
                  label: 'Add Stock',
                  width: 100,
                  height: 36,
                  onPressed: () {},
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
