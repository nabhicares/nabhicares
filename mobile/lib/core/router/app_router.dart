import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/admin_app/admin/admin_dashboard_screen.dart';
import '../../features/admin_app/admin/staff_management_screen.dart';
import '../../features/admin_app/inventory/screens/add_batch_screen.dart';
import '../../features/admin_app/inventory/screens/adjust_stock_screen.dart';
import '../../features/admin_app/inventory/screens/inventory_dashboard_screen.dart';
import '../../features/admin_app/inventory/screens/medicine_detail_screen.dart';
import '../../features/admin_app/inventory/screens/medicine_form_screen.dart';
import '../../features/admin_app/inventory/screens/medicines_catalog_screen.dart';
import '../../features/admin_app/inventory/screens/stock_alerts_screen.dart';
import '../../features/admin_app/inventory/screens/stock_history_screen.dart';
import '../../features/admin_app/more/more_screen.dart';
import '../../features/admin_app/pharmacy/pharmacy_pos_screen.dart';
import '../../features/admin_app/purchases/screens/create_purchase_order_screen.dart';
import '../../features/admin_app/purchases/screens/purchase_order_detail_screen.dart';
import '../../features/admin_app/purchases/screens/purchase_orders_screen.dart';
import '../../features/admin_app/purchases/screens/receive_stock_screen.dart';
import '../../features/admin_app/purchases/screens/supplier_form_screen.dart';
import '../../features/admin_app/purchases/screens/suppliers_screen.dart';
import '../../features/admin_app/shell/admin_shell.dart';
import '../../features/auth/presentation/screens/login_screen.dart';
import '../../features/doctor_app/dashboard/doctor_dashboard_screen.dart';
import '../../features/patient_app/home/patient_home_screen.dart';
import '../../features/receptionist_app/appointments/reception_appointments_screen.dart';
import '../../features/receptionist_app/billing/reception_billing_screen.dart';
import '../../features/receptionist_app/more/reception_more_screen.dart';
import '../../features/receptionist_app/patients/reception_patients_screen.dart';

/// Roles allowed into the staff-facing workspaces (/admin and /pharmacy).
const inventoryRoles = ['hospital_admin', 'super_admin', 'pharmacist'];

/// Full administrative access (hospital command center + staff management).
const adminRoles = ['hospital_admin', 'super_admin'];

class AuthUserState {
  final bool isAuthenticated;
  final String role; // patient | doctor | hospital_admin | pharmacist | receptionist
  final String email;

  const AuthUserState({
    required this.isAuthenticated,
    required this.role,
    required this.email,
  });
}

class AuthStateNotifier extends StateNotifier<AuthUserState> {
  AuthStateNotifier()
      : super(const AuthUserState(isAuthenticated: false, role: 'patient', email: ''));

  void login(String role, String email) {
    state = AuthUserState(isAuthenticated: true, role: role, email: email);
  }

  void logout() {
    state = const AuthUserState(isAuthenticated: false, role: 'patient', email: '');
  }
}

final authStatePrv = StateNotifierProvider<AuthStateNotifier, AuthUserState>((ref) {
  return AuthStateNotifier();
});

String _homeFor(String role) {
  if (role == 'patient') return '/patient/home';
  if (role == 'doctor') return '/doctor/dashboard';
  if (role == 'receptionist') return '/reception/patients';
  if (adminRoles.contains(role)) return '/admin/overview';
  if (role == 'pharmacist') return '/pharmacy/dispense';
  return '/admin/inventory';
}

/// A single tab within a staff workspace shell.
class _WorkspaceTab {
  final String path;
  final Widget Function(BuildContext, GoRouterState) builder;
  final NavigationDestination destination;

  const _WorkspaceTab({
    required this.path,
    required this.builder,
    required this.destination,
  });
}

/// Bottom-navigation layout tailored to each staff role.
List<_WorkspaceTab> _workspaceTabs(String role) {
  if (adminRoles.contains(role)) {
    return [
      _WorkspaceTab(
        path: '/admin/overview',
        builder: (_, __) => const AdminDashboardScreen(),
        destination: const NavigationDestination(
          icon: Icon(Icons.space_dashboard_outlined),
          selectedIcon: Icon(Icons.space_dashboard_rounded),
          label: 'Overview',
        ),
      ),
      _WorkspaceTab(
        path: '/admin/inventory',
        builder: (_, __) => const InventoryDashboardScreen(),
        destination: const NavigationDestination(
          icon: Icon(Icons.inventory_2_outlined),
          selectedIcon: Icon(Icons.inventory_2_rounded),
          label: 'Inventory',
        ),
      ),
      _WorkspaceTab(
        path: '/admin/staff',
        builder: (_, __) => const StaffManagementScreen(),
        destination: const NavigationDestination(
          icon: Icon(Icons.groups_outlined),
          selectedIcon: Icon(Icons.groups_rounded),
          label: 'Staff',
        ),
      ),
      _WorkspaceTab(
        path: '/admin/more',
        builder: (_, __) => const MoreScreen(),
        destination: const NavigationDestination(
          icon: Icon(Icons.more_horiz_rounded),
          selectedIcon: Icon(Icons.more_horiz_rounded),
          label: 'More',
        ),
      ),
    ];
  }

  if (role == 'pharmacist') {
    return [
      _WorkspaceTab(
        path: '/pharmacy/dispense',
        builder: (_, __) => const PharmacyPosScreen(),
        destination: const NavigationDestination(
          icon: Icon(Icons.point_of_sale_outlined),
          selectedIcon: Icon(Icons.point_of_sale_rounded),
          label: 'Dispense',
        ),
      ),
      _WorkspaceTab(
        path: '/admin/inventory/medicines',
        builder: (_, __) => const MedicinesCatalogScreen(),
        destination: const NavigationDestination(
          icon: Icon(Icons.medication_outlined),
          selectedIcon: Icon(Icons.medication_rounded),
          label: 'Medicines',
        ),
      ),
      _WorkspaceTab(
        path: '/admin/purchases',
        builder: (_, __) => const PurchaseOrdersScreen(),
        destination: const NavigationDestination(
          icon: Icon(Icons.local_shipping_outlined),
          selectedIcon: Icon(Icons.local_shipping_rounded),
          label: 'Purchases',
        ),
      ),
      _WorkspaceTab(
        path: '/admin/more',
        builder: (_, __) => const MoreScreen(),
        destination: const NavigationDestination(
          icon: Icon(Icons.more_horiz_rounded),
          selectedIcon: Icon(Icons.more_horiz_rounded),
          label: 'More',
        ),
      ),
    ];
  }

  if (role == 'receptionist') {
    return [
      _WorkspaceTab(
        path: '/reception/patients',
        builder: (_, __) => const ReceptionPatientsScreen(),
        destination: const NavigationDestination(
          icon: Icon(Icons.people_outline_rounded),
          selectedIcon: Icon(Icons.people_rounded),
          label: 'Patients',
        ),
      ),
      _WorkspaceTab(
        path: '/reception/appointments',
        builder: (_, __) => const ReceptionAppointmentsScreen(),
        destination: const NavigationDestination(
          icon: Icon(Icons.event_available_outlined),
          selectedIcon: Icon(Icons.event_available_rounded),
          label: 'Appointments',
        ),
      ),
      _WorkspaceTab(
        path: '/reception/billing',
        builder: (_, __) => const ReceptionBillingScreen(),
        destination: const NavigationDestination(
          icon: Icon(Icons.receipt_long_outlined),
          selectedIcon: Icon(Icons.receipt_long_rounded),
          label: 'Billing',
        ),
      ),
      _WorkspaceTab(
        path: '/reception/more',
        builder: (_, __) => const ReceptionMoreScreen(),
        destination: const NavigationDestination(
          icon: Icon(Icons.more_horiz_rounded),
          selectedIcon: Icon(Icons.more_horiz_rounded),
          label: 'More',
        ),
      ),
    ];
  }

  // Inventory operator fallback for other ops roles.
  return [
    _WorkspaceTab(
      path: '/admin/inventory',
      builder: (_, __) => const InventoryDashboardScreen(),
      destination: const NavigationDestination(
        icon: Icon(Icons.dashboard_outlined),
        selectedIcon: Icon(Icons.dashboard_rounded),
        label: 'Dashboard',
      ),
    ),
    _WorkspaceTab(
      path: '/admin/inventory/medicines',
      builder: (_, __) => const MedicinesCatalogScreen(),
      destination: const NavigationDestination(
        icon: Icon(Icons.medication_outlined),
        selectedIcon: Icon(Icons.medication_rounded),
        label: 'Medicines',
      ),
    ),
    _WorkspaceTab(
      path: '/admin/purchases',
      builder: (_, __) => const PurchaseOrdersScreen(),
      destination: const NavigationDestination(
        icon: Icon(Icons.local_shipping_outlined),
        selectedIcon: Icon(Icons.local_shipping_rounded),
        label: 'Purchases',
      ),
    ),
    _WorkspaceTab(
      path: '/admin/more',
      builder: (_, __) => const MoreScreen(),
      destination: const NavigationDestination(
        icon: Icon(Icons.more_horiz_rounded),
        selectedIcon: Icon(Icons.more_horiz_rounded),
        label: 'More',
      ),
    ),
  ];
}

final appRouterPrv = Provider<GoRouter>((ref) {
  final authState = ref.watch(authStatePrv);
  final tabs = _workspaceTabs(authState.role);
  final shellPaths = tabs.map((t) => t.path).toSet();

  return GoRouter(
    initialLocation: '/login',
    redirect: (context, state) {
      final location = state.matchedLocation;

      if (!authState.isAuthenticated) {
        return location == '/login' ? null : '/login';
      }

      if (location == '/login') return _homeFor(authState.role);

      if (location.startsWith('/patient') && authState.role != 'patient') {
        return _homeFor(authState.role);
      }
      if (location.startsWith('/doctor') && authState.role != 'doctor') {
        return _homeFor(authState.role);
      }
      if (location.startsWith('/reception') && authState.role != 'receptionist') {
        return _homeFor(authState.role);
      }
      if ((location.startsWith('/admin') || location.startsWith('/pharmacy')) &&
          !inventoryRoles.contains(authState.role)) {
        return _homeFor(authState.role);
      }

      return null;
    },
    routes: [
      GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),
      GoRoute(
        path: '/patient/home',
        builder: (context, state) => const PatientHomeScreen(),
      ),
      GoRoute(
        path: '/doctor/dashboard',
        builder: (context, state) => const DoctorDashboardScreen(),
      ),

      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) => AdminShell(
          navigationShell: navigationShell,
          destinations: [for (final tab in tabs) tab.destination],
        ),
        branches: [
          for (final tab in tabs)
            StatefulShellBranch(
              routes: [
                GoRoute(path: tab.path, builder: tab.builder),
              ],
            ),
        ],
      ),

      // Catalog + procurement roots that the admin workspace links to but does
      // not host as bottom-nav tabs (other workspaces expose them as tabs).
      if (!shellPaths.contains('/admin/inventory/medicines'))
        GoRoute(
          path: '/admin/inventory/medicines',
          builder: (context, state) => const MedicinesCatalogScreen(),
        ),
      if (!shellPaths.contains('/admin/purchases'))
        GoRoute(
          path: '/admin/purchases',
          builder: (context, state) => const PurchaseOrdersScreen(),
        ),

      // Full-screen routes pushed above the shell.
      GoRoute(
        path: '/admin/inventory/alerts',
        builder: (context, state) => StockAlertsScreen(
          initialTab: int.tryParse(state.uri.queryParameters['tab'] ?? '') ?? 0,
        ),
      ),
      GoRoute(
        path: '/admin/inventory/history',
        builder: (context, state) => StockHistoryScreen(
          medicineId: state.uri.queryParameters['medicineId'],
        ),
      ),
      GoRoute(
        path: '/admin/inventory/adjust',
        builder: (context, state) => AdjustStockScreen(
          medicineId: state.uri.queryParameters['medicineId'],
          batchNo: state.uri.queryParameters['batchNo'],
        ),
      ),
      GoRoute(
        path: '/admin/inventory/add-medicine',
        builder: (context, state) => const MedicineFormScreen(),
      ),
      GoRoute(
        path: '/admin/inventory/medicines/:id',
        builder: (context, state) =>
            MedicineDetailScreen(medicineId: state.pathParameters['id']!),
        routes: [
          GoRoute(
            path: 'edit',
            builder: (context, state) =>
                MedicineFormScreen(medicineId: state.pathParameters['id']!),
          ),
          GoRoute(
            path: 'add-batch',
            builder: (context, state) =>
                AddBatchScreen(medicineId: state.pathParameters['id']!),
          ),
        ],
      ),
      GoRoute(
        path: '/admin/purchases/new',
        builder: (context, state) => const CreatePurchaseOrderScreen(),
      ),
      GoRoute(
        path: '/admin/purchases/suppliers',
        builder: (context, state) => const SuppliersScreen(),
        routes: [
          GoRoute(
            path: 'new',
            builder: (context, state) => const SupplierFormScreen(),
          ),
          GoRoute(
            path: ':id/edit',
            builder: (context, state) =>
                SupplierFormScreen(supplierId: state.pathParameters['id']!),
          ),
        ],
      ),
      GoRoute(
        path: '/admin/purchases/orders/:id',
        builder: (context, state) =>
            PurchaseOrderDetailScreen(orderId: state.pathParameters['id']!),
        routes: [
          GoRoute(
            path: 'receive',
            builder: (context, state) =>
                ReceiveStockScreen(orderId: state.pathParameters['id']!),
          ),
        ],
      ),
    ],
    errorBuilder: (context, state) => Scaffold(
      appBar: AppBar(title: const Text('Page not found')),
      body: Center(child: Text('No route for ${state.uri}')),
    ),
  );
});
