import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_card.dart';
import 'providers/admin_dashboard_provider.dart';
import '../pharmacy/pharmacy_pos_screen.dart';
import '../inventory/inventory_list_screen.dart';

class AdminDashboardScreen extends ConsumerStatefulWidget {
  const AdminDashboardScreen({super.key});

  @override
  ConsumerState<AdminDashboardScreen> createState() => _AdminDashboardScreenState();
}

class _AdminDashboardScreenState extends ConsumerState<AdminDashboardScreen> {
  int _currentIndex = 0;

  @override
  Widget build(BuildContext context) {
    final authUser = ref.watch(authStatePrv);
    final theme = Theme.of(context);
    final metricsAsync = ref.watch(adminDashboardMetricsProvider);

    // Navigation Pages
    final List<Widget> screens = [
      _buildDashboard(authUser, theme, metricsAsync),
      const Center(child: Text('Patient Records Registry')),
      const PharmacyPosScreen(),
      const InventoryListScreen(),
      const Center(child: Text('Financial Reports & Analytics')),
    ];

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: Row(
          children: [
            CircleAvatar(
              backgroundColor: AppColors.primary.withOpacity(0.12),
              child: const Icon(Icons.shield, color: AppColors.primary),
            ),
            const SizedBox(width: 12),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Operations Portal,',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
                Text(
                  'Hospital Administrator',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: AppColors.textPrimary,
                  ),
                ),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings_outlined, color: AppColors.textPrimary),
            onPressed: () {},
          ),
          IconButton(
            icon: const Icon(Icons.logout_rounded, color: AppColors.textPrimary),
            onPressed: () {
              ref.read(authStatePrv.notifier).logout();
            },
          ),
        ],
      ),
      body: screens[_currentIndex],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (index) {
          setState(() => _currentIndex = index);
        },
        backgroundColor: Colors.white,
        elevation: 8,
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.analytics_outlined),
            selectedIcon: Icon(Icons.analytics, color: AppColors.primary),
            label: 'Overview',
          ),
          NavigationDestination(
            icon: Icon(Icons.people_outline),
            selectedIcon: Icon(Icons.people, color: AppColors.primary),
            label: 'Patients',
          ),
          NavigationDestination(
            icon: Icon(Icons.point_of_sale_outlined),
            selectedIcon: Icon(Icons.point_of_sale, color: AppColors.primary),
            label: 'POS',
          ),
          NavigationDestination(
            icon: Icon(Icons.inventory_2_outlined),
            selectedIcon: Icon(Icons.inventory_2, color: AppColors.primary),
            label: 'Stock',
          ),
          NavigationDestination(
            icon: Icon(Icons.bar_chart_outlined),
            selectedIcon: Icon(Icons.bar_chart, color: AppColors.primary),
            label: 'Ledgers',
          ),
        ],
      ),
    );
  }

  Widget _buildDashboard(AuthState authUser, ThemeData theme, AsyncValue<AdminDashboardMetrics> metricsAsync) {
    final metrics = metricsAsync.asData?.value;
    final totalRevenue = metrics != null ? '\$${metrics.totalRevenue.toStringAsFixed(0)}' : '\$0';
    final lowStockCount = metrics != null ? '${metrics.lowStockItemsCount} items' : '0 items';
    final appointmentsCount = metrics != null ? '${metrics.appointmentsCount}' : '0';
    final stockItemsCount = metrics != null ? '${metrics.totalStockItems} items' : '0 items';

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Operational Metrics Grid
          GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 2,
            crossAxisSpacing: 16,
            mainAxisSpacing: 16,
            childAspectRatio: 1.5,
            children: [
              _buildMiniMetric('Today\'s Revenue', totalRevenue, 'Live database sync', AppColors.success, Icons.trending_up),
              _buildMiniMetric('Appointments', appointmentsCount, 'Booked slot queue', AppColors.primary, Icons.calendar_month),
              _buildMiniMetric('Low Stock SKUs', lowStockCount, 'Threshold alert levels', AppColors.critical, Icons.warning_amber),
              _buildMiniMetric('Total Stock SKUs', stockItemsCount, 'Unique medicine catalog', AppColors.secondary, Icons.receipt),
            ],
          ),
          const SizedBox(height: 28),

          // Inventory Alerts Board
          Text(
            'Inventory & Dispatch Warnings',
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.bold,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 12),
          AppCard(
            child: Column(
              children: [
                _buildAlertItem(
                  'Aspirin 100mg (MED-ASP-100)',
                  'Critical stock levels (Remaining: 20 units, Min required: 50)',
                  'Restock',
                  AppColors.critical,
                ),
                const Divider(height: 24),
                _buildAlertItem(
                  'Amoxicillin 250mg (MED-AMO-250)',
                  'Out of stock. 4 prescriptions backordered.',
                  'Procure',
                  AppColors.critical,
                ),
                const Divider(height: 24),
                _buildAlertItem(
                  'Paracetamol Batch B2',
                  'Expiry warning: Expiries on August 15, 2026.',
                  'Dispose',
                  AppColors.warning,
                ),
              ],
            ),
          ),
          const SizedBox(height: 28),

          // Recent Activity Log
          Text(
            'Recent Operations Activity',
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.bold,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 12),
          AppCard(
            child: ListView(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              children: [
                _buildActivityRow('03:45 PM', 'Invoice #INV-9281 created', 'Patient Alice Patient • Amount: \$45.00'),
                _buildActivityRow('03:12 PM', 'Doctor Check-in recorded', 'Dr. Gregory House checked into Consultation Room 304'),
                _buildActivityRow('02:30 PM', 'Stock received', '500 units Ibuprofen checked into Batch B5'),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMiniMetric(
    String label,
    String value,
    String caption,
    Color accentColor,
    IconData icon,
  ) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                label,
                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textSecondary),
              ),
              Icon(icon, color: accentColor, size: 16),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
          ),
          const SizedBox(height: 2),
          Text(
            caption,
            style: TextStyle(fontSize: 9, color: accentColor, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }

  Widget _buildAlertItem(String title, String description, String actionText, Color color) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(Icons.error_outline, color: color, size: 20),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.textPrimary),
              ),
              const SizedBox(height: 2),
              Text(
                description,
                style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
              ),
            ],
          ),
        ),
        const SizedBox(width: 12),
        TextButton(
          style: TextButton.styleFrom(
            foregroundColor: color,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            minimumSize: Size.zero,
            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          ),
          onPressed: () {},
          child: Text(
            actionText,
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
          ),
        ),
      ],
    );
  }

  Widget _buildActivityRow(String time, String title, String subtitle) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            time,
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11, color: AppColors.textMuted),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.textPrimary),
                ),
                Text(
                  subtitle,
                  style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
