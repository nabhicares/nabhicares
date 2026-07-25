import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/admin_app/inventory/screens/add_batch_screen.dart';
import '../../features/admin_app/inventory/screens/adjust_stock_screen.dart';
import '../../features/admin_app/inventory/screens/inventory_dashboard_screen.dart';
import '../../features/admin_app/inventory/screens/medicine_detail_screen.dart';
import '../../features/admin_app/inventory/screens/medicine_form_screen.dart';
import '../../features/admin_app/inventory/screens/medicines_catalog_screen.dart';
import '../../features/admin_app/inventory/screens/stock_alerts_screen.dart';
import '../../features/admin_app/inventory/screens/stock_history_screen.dart';
import '../../features/admin_app/more/more_screen.dart';
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

/// Roles that get the inventory workspace.
const inventoryRoles = ['hospital_admin', 'super_admin', 'pharmacist', 'receptionist'];

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
  return '/admin/inventory';
}

final appRouterPrv = Provider<GoRouter>((ref) {
  final authState = ref.watch(authStatePrv);

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
      if (location.startsWith('/admin') && !inventoryRoles.contains(authState.role)) {
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
        builder: (context, state, navigationShell) =>
            AdminShell(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/admin/inventory',
                builder: (context, state) => const InventoryDashboardScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/admin/inventory/medicines',
                builder: (context, state) => const MedicinesCatalogScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/admin/purchases',
                builder: (context, state) => const PurchaseOrdersScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(path: '/admin/more', builder: (context, state) => const MoreScreen()),
            ],
          ),
        ],
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
