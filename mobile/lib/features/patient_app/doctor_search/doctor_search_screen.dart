import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/empty_state.dart';
import '../../../core/widgets/loading_indicator.dart';
import '../appointment_booking/booking_screen.dart';

class DoctorProfileModel {
  final String id;
  final String name;
  final String specialty;
  final double consultationFee;
  final Map<String, dynamic> weeklySchedule;

  DoctorProfileModel({
    required this.id,
    required this.name,
    required this.specialty,
    required this.consultationFee,
    required this.weeklySchedule,
  });

  factory DoctorProfileModel.fromJson(Map<String, dynamic> json) {
    return DoctorProfileModel(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? 'Unknown Doctor',
      specialty: json['specialty'] as String? ?? 'General Practitioner',
      consultationFee: (json['consultationFee'] as num?)?.toDouble() ?? 50.0,
      weeklySchedule: json['weeklySchedule'] as Map<String, dynamic>? ?? {},
    );
  }
}

// Fetch list of doctors from GET /doctors endpoint
final doctorsListProvider = FutureProvider<List<DoctorProfileModel>>((ref) async {
  final dio = ref.watch(dioClientPrv);
  final response = await dio.get('/doctors');
  
  if (response.data != null && response.data['success'] == true) {
    final list = response.data['data'] as List<dynamic>? ?? [];
    return list.map((e) => DoctorProfileModel.fromJson(e as Map<String, dynamic>)).toList();
  }
  return [];
});

class DoctorSearchScreen extends ConsumerStatefulWidget {
  const DoctorSearchScreen({super.key});

  @override
  ConsumerState<DoctorSearchScreen> createState() => _DoctorSearchScreenState();
}

class _DoctorSearchScreenState extends ConsumerState<DoctorSearchScreen> {
  String _searchQuery = '';
  String _selectedSpecialty = 'All';

  @override
  Widget build(BuildContext context) {
    final doctorsAsync = ref.watch(doctorsListProvider);
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
          'Find a Specialist',
          style: theme.textTheme.titleLarge?.copyWith(
            fontWeight: FontWeight.bold,
            color: AppColors.textPrimary,
          ),
        ),
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Search & Filter Panel
          Container(
            color: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            child: Column(
              children: [
                TextField(
                  onChanged: (val) => setState(() => _searchQuery = val),
                  decoration: InputDecoration(
                    hintText: 'Search by specialist name...',
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
                const SizedBox(height: 12),
                
                // Specialty filters list
                SizedBox(
                  height: 38,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    children: [
                      _buildFilterChip('All'),
                      _buildFilterChip('Diagnostics'),
                      _buildFilterChip('Neurology'),
                      _buildFilterChip('Immunology'),
                      _buildFilterChip('Pediatrics'),
                    ],
                  ),
                ),
              ],
            ),
          ),
          
          // Doctor List View
          Expanded(
            child: doctorsAsync.when(
              data: (doctors) {
                // Apply Search query & Specialty filter tags
                final filteredDoctors = doctors.where((doc) {
                  final matchesSearch = doc.name.toLowerCase().contains(_searchQuery.toLowerCase());
                  final matchesSpecialty = _selectedSpecialty == 'All' || doc.specialty == _selectedSpecialty;
                  return matchesSearch && matchesSpecialty;
                }).toList();

                if (filteredDoctors.isEmpty) {
                  return const EmptyState(
                    title: 'No Specialists Found',
                    description: 'Try adjusting your search query parameters or department filters.',
                    icon: Icons.person_search_outlined,
                  );
                }

                return ListView.builder(
                  padding: const EdgeInsets.all(20),
                  itemCount: filteredDoctors.length,
                  itemBuilder: (context, index) {
                    final doc = filteredDoctors[index];
                    return _buildDoctorListItem(doc, context);
                  },
                );
              },
              loading: () => const LoadingIndicator(message: 'Loading hospital registry...'),
              error: (err, stack) => EmptyState(
                title: 'Connection Error',
                description: 'Failed to retrieve doctor listings: ${err.toString()}',
                icon: Icons.wifi_off_rounded,
                actionLabel: 'Retry Connection',
                onActionPressed: () => ref.refresh(doctorsListProvider),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChip(String label) {
    final isSelected = _selectedSpecialty == label;
    return Padding(
      padding: const EdgeInsets.only(right: 8.0),
      child: ChoiceChip(
        label: Text(label),
        selected: isSelected,
        onSelected: (selected) {
          if (selected) {
            setState(() => _selectedSpecialty = label);
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

  void _openBooking(DoctorProfileModel doc) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => BookingScreen(
          doctorId: doc.id,
          doctorName: doc.name,
          specialty: doc.specialty,
          fee: doc.consultationFee,
        ),
      ),
    );
  }

  Widget _buildDoctorListItem(DoctorProfileModel doc, BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      child: AppCard(
        onTap: () => _openBooking(doc),
        child: Column(
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                CircleAvatar(
                  radius: 28,
                  backgroundColor: AppColors.primary.withOpacity(0.1),
                  child: const Icon(Icons.person, color: AppColors.primary, size: 28),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        doc.name,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        doc.specialty,
                        style: const TextStyle(
                          fontSize: 13,
                          color: AppColors.primary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          const Icon(Icons.star, color: AppColors.warning, size: 16),
                          const SizedBox(width: 4),
                          const Text(
                            '4.9',
                            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                          ),
                          const SizedBox(width: 16),
                          Icon(Icons.monetization_on_outlined, color: Colors.grey.shade600, size: 16),
                          const SizedBox(width: 4),
                          Text(
                            formatCurrency(doc.consultationFee),
                            style: TextStyle(
                              color: Colors.grey.shade700,
                              fontWeight: FontWeight.w600,
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ),
                    ],
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
                Text(
                  'Available Next: Monday',
                  style: TextStyle(fontSize: 12, color: Colors.grey.shade500),
                ),
                AppButton(
                  label: 'Book Consultation',
                  width: 150,
                  height: 38,
                  onPressed: () => _openBooking(doc),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
