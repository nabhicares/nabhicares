import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/auth/auth_controller.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_card.dart';
import '../../../shared_models/appointment.dart';
import '../../care/data/care_repository.dart';
import '../../patient_app/notifications/notifications_hub_screen.dart';
import '../patients/doctor_patients_screen.dart';
import '../prescription_writer/write_prescription_screen.dart';
import '../profile/doctor_profile_screen.dart';
import '../queue/doctor_queue_screen.dart';

class DoctorDashboardScreen extends ConsumerStatefulWidget {
  const DoctorDashboardScreen({super.key});

  @override
  ConsumerState<DoctorDashboardScreen> createState() => _DoctorDashboardScreenState();
}

class _DoctorDashboardScreenState extends ConsumerState<DoctorDashboardScreen> {
  int _currentIndex = 0;
  DateTime? _lastBackPress;

  String get _today {
    final now = DateTime.now();
    return '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final authUser = ref.watch(authStatePrv);
    final theme = Theme.of(context);

    final screens = [
      _buildDashboard(authUser, theme),
      const DoctorQueueScreen(),
      const DoctorPatientsScreen(),
      const WritePrescriptionScreen(),
      const DoctorProfileScreen(),
    ];

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        if (_currentIndex != 0) {
          setState(() => _currentIndex = 0);
          return;
        }
        final now = DateTime.now();
        if (_lastBackPress != null &&
            now.difference(_lastBackPress!) < const Duration(seconds: 2)) {
          SystemNavigator.pop();
          return;
        }
        _lastBackPress = now;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Press back again to exit')),
        );
      },
      child: Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(
          backgroundColor: Colors.white,
          elevation: 0,
          title: Row(
            children: [
              CircleAvatar(
                backgroundColor: AppColors.primary.withValues(alpha: 0.12),
                child: const Icon(Icons.medical_services, color: AppColors.primary),
              ),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    authUser.hospitalName.isEmpty ? 'Nabhi Care' : authUser.hospitalName,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: AppColors.textSecondary,
                    ),
                  ),
                  Text(
                    authUser.shortName,
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
              icon: const Icon(Icons.notifications_outlined, color: AppColors.textPrimary),
              onPressed: () => Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const NotificationsHubScreen()),
              ),
            ),
            IconButton(
              icon: const Icon(Icons.logout_rounded, color: AppColors.textPrimary),
              onPressed: () => ref.read(authStatePrv.notifier).logout(),
            ),
          ],
        ),
        body: screens[_currentIndex],
        bottomNavigationBar: NavigationBar(
          selectedIndex: _currentIndex,
          onDestinationSelected: (index) => setState(() => _currentIndex = index),
          backgroundColor: Colors.white,
          elevation: 8,
          destinations: const [
            NavigationDestination(
              icon: Icon(Icons.dashboard_customize_outlined),
              selectedIcon: Icon(Icons.dashboard_customize, color: AppColors.primary),
              label: 'Dashboard',
            ),
            NavigationDestination(
              icon: Icon(Icons.calendar_today_outlined),
              selectedIcon: Icon(Icons.calendar_today, color: AppColors.primary),
              label: 'Queue',
            ),
            NavigationDestination(
              icon: Icon(Icons.people_outline),
              selectedIcon: Icon(Icons.people, color: AppColors.primary),
              label: 'Patients',
            ),
            NavigationDestination(
              icon: Icon(Icons.edit_note_outlined),
              selectedIcon: Icon(Icons.edit_note, color: AppColors.primary),
              label: 'Rx',
            ),
            NavigationDestination(
              icon: Icon(Icons.person_outline),
              selectedIcon: Icon(Icons.person, color: AppColors.primary),
              label: 'Profile',
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDashboard(AuthUserState authUser, ThemeData theme) {
    final appointmentsAsync = ref.watch(doctorAppointmentsPrv);

    return appointmentsAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => Center(child: Text('$error')),
      data: (appointments) {
        final today = appointments.where((a) => a.date == _today).toList();
        final open = today.where((a) => a.status != 'cancelled' && a.status != 'completed');
        final completed = today.where((a) => a.status == 'completed');

        return RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(doctorAppointmentsPrv);
            await ref.read(doctorAppointmentsPrv.future);
          },
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              Row(
                children: [
                  Expanded(
                    child: _metric(
                      'Today',
                      '${today.length}',
                      'Scheduled visits',
                      AppColors.primary,
                      Icons.calendar_month,
                      () => setState(() => _currentIndex = 1),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: _metric(
                      'Waiting',
                      '${open.length}',
                      'Still to see',
                      AppColors.warning,
                      Icons.hourglass_top_rounded,
                      () => setState(() => _currentIndex = 1),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: _metric(
                      'Done',
                      '${completed.length}',
                      'Completed today',
                      AppColors.success,
                      Icons.check_circle_outline,
                      () => setState(() => _currentIndex = 1),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: _metric(
                      'Write Rx',
                      '→',
                      'Open prescription pad',
                      AppColors.secondary,
                      Icons.edit_note,
                      () => setState(() => _currentIndex = 3),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 28),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    "Today's queue",
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  TextButton(
                    onPressed: () => setState(() => _currentIndex = 1),
                    child: const Text('Full calendar'),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              if (today.isEmpty)
                const AppCard(child: Text('No visits scheduled for today.'))
              else
                for (final appointment in today.take(5))
                  _queueRow(appointment),
            ],
          ),
        );
      },
    );
  }

  Widget _metric(
    String title,
    String value,
    String caption,
    Color color,
    IconData icon,
    VoidCallback onTap,
  ) {
    return AppCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: AppColors.textSecondary,
                ),
              ),
              Icon(icon, color: color, size: 18),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            value,
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            caption,
            style: const TextStyle(fontSize: 10, color: AppColors.textMuted),
          ),
        ],
      ),
    );
  }

  Widget _queueRow(Appointment appointment) {
    final active = appointment.status != 'cancelled' && appointment.status != 'completed';
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      child: AppCard(
        onTap: () => setState(() => _currentIndex = 1),
        child: Row(
          children: [
            Text(
              appointment.timeSlot,
              style: const TextStyle(
                fontWeight: FontWeight.bold,
                color: AppColors.primary,
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    appointment.patientName.isEmpty ? 'Patient' : appointment.patientName,
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                  Text(
                    appointment.status.replaceAll('_', ' '),
                    style: TextStyle(
                      fontSize: 12,
                      color: active ? AppColors.textSecondary : AppColors.textMuted,
                    ),
                  ),
                ],
              ),
            ),
            if (active)
              TextButton(
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => WritePrescriptionScreen(
                        patientId: appointment.patientId,
                        patientName: appointment.patientName,
                      ),
                    ),
                  );
                },
                child: const Text('Write Rx'),
              ),
          ],
        ),
      ),
    );
  }
}
