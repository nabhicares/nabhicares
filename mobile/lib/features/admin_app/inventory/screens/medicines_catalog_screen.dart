import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/loading_indicator.dart';
import '../providers/inventory_providers.dart';
import '../widgets/medicine_tile.dart';

const _statusFilters = <({String label, String value})>[
  (label: 'All', value: 'all'),
  (label: 'In stock', value: 'ok'),
  (label: 'Low stock', value: 'low'),
  (label: 'Out of stock', value: 'out'),
];

class MedicinesCatalogScreen extends ConsumerStatefulWidget {
  const MedicinesCatalogScreen({super.key});

  @override
  ConsumerState<MedicinesCatalogScreen> createState() => _MedicinesCatalogScreenState();
}

class _MedicinesCatalogScreenState extends ConsumerState<MedicinesCatalogScreen> {
  final _searchController = TextEditingController();
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _searchController.text = ref.read(medicineFilterPrv).query;
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      ref.read(medicineFilterPrv.notifier).update((f) => f.copyWith(query: value.trim()));
    });
  }

  @override
  Widget build(BuildContext context) {
    final filter = ref.watch(medicineFilterPrv);
    final medicinesAsync = ref.watch(medicinesPrv);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Medicines'),
        actions: [
          IconButton(
            tooltip: 'Stock alerts',
            icon: const Icon(Icons.notifications_none_rounded),
            onPressed: () => context.push('/admin/inventory/alerts'),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/admin/inventory/add-medicine'),
        icon: const Icon(Icons.add),
        label: const Text('Add medicine'),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
            child: TextField(
              controller: _searchController,
              onChanged: _onSearchChanged,
              textInputAction: TextInputAction.search,
              decoration: InputDecoration(
                hintText: 'Search name, generic, brand or barcode',
                prefixIcon: const Icon(Icons.search, color: AppColors.textMuted),
                suffixIcon: filter.query.isEmpty
                    ? null
                    : IconButton(
                        icon: const Icon(Icons.close, size: 18),
                        onPressed: () {
                          _searchController.clear();
                          _debounce?.cancel();
                          ref
                              .read(medicineFilterPrv.notifier)
                              .update((f) => f.copyWith(query: ''));
                        },
                      ),
              ),
            ),
          ),
          SizedBox(
            height: 38,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: _statusFilters.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, index) {
                final option = _statusFilters[index];
                final selected = filter.status == option.value;
                return ChoiceChip(
                  label: Text(option.label),
                  selected: selected,
                  showCheckmark: false,
                  selectedColor: AppColors.primary,
                  labelStyle: TextStyle(
                    fontSize: 13,
                    fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                    color: selected ? Colors.white : AppColors.textPrimary,
                  ),
                  onSelected: (_) => ref
                      .read(medicineFilterPrv.notifier)
                      .update((f) => f.copyWith(status: option.value)),
                );
              },
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: medicinesAsync.when(
              data: (paged) {
                if (paged.items.isEmpty) {
                  return EmptyState(
                    title: 'No medicines found',
                    description: filter.query.isEmpty
                        ? 'Add your first medicine to start tracking stock.'
                        : 'Nothing matches "${filter.query}". Try a different search.',
                    icon: Icons.inventory_2_outlined,
                    actionLabel: 'Add medicine',
                    onActionPressed: () => context.push('/admin/inventory/add-medicine'),
                  );
                }

                return RefreshIndicator(
                  onRefresh: () async {
                    ref.invalidate(medicinesPrv);
                    await ref.read(medicinesPrv.future);
                  },
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
                    itemCount: paged.items.length + 1,
                    separatorBuilder: (_, __) => const SizedBox(height: 12),
                    itemBuilder: (context, index) {
                      if (index == paged.items.length) {
                        return Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Text(
                            'Showing ${paged.items.length} of ${paged.totalCount} medicines',
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppColors.textMuted,
                            ),
                          ),
                        );
                      }

                      final medicine = paged.items[index];
                      return MedicineTile(
                        medicine: medicine,
                        onTap: () =>
                            context.push('/admin/inventory/medicines/${medicine.id}'),
                      );
                    },
                  ),
                );
              },
              loading: () => const LoadingIndicator(message: 'Loading medicines...'),
              error: (error, _) => EmptyState(
                title: 'Could not load medicines',
                description: '$error',
                icon: Icons.cloud_off_rounded,
                actionLabel: 'Retry',
                onActionPressed: () => ref.invalidate(medicinesPrv),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
