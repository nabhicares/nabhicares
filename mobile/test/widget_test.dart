import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pharma_store_mobile/app.dart';
import 'package:pharma_store_mobile/features/auth/presentation/screens/login_screen.dart';

void main() {
  testWidgets('CareFlow HMS App Launch & Login Portal Test', (WidgetTester tester) async {
    // 1. Boot the application inside a ProviderScope container
    await tester.pumpWidget(
      const ProviderScope(
        child: MyApp(),
      ),
    );

    // Let the router resolve the initial location (/login)
    await tester.pumpAndSettle();

    // 2. Verify that we are on the LoginScreen
    expect(find.byType(LoginScreen), findsOneWidget);
    expect(find.text('PharmaStore CareFlow'), findsOneWidget);
    expect(find.text('Unified Hospital Operations Portal'), findsOneWidget);

    // 3. Verify that the Portal Selection ChoiceChips exist
    expect(find.text('Patient'), findsOneWidget);
    expect(find.text('Doctor'), findsOneWidget);
    expect(find.text('Pharmacist'), findsOneWidget);
    expect(find.text('Admin'), findsOneWidget);

    // 4. Verify that Input Fields exist
    expect(find.byType(TextField), findsNWidgets(2)); // Email & Password
    expect(find.text('Email Address'), findsOneWidget);
    expect(find.text('Password'), findsOneWidget);

    // 5. Verify Developer Bypass Options exist
    expect(find.text('Developer Quick Bypass Options'), findsOneWidget);
    expect(find.widgetWithText(OutlinedButton, 'Patient'), findsOneWidget);
    expect(find.widgetWithText(OutlinedButton, 'Doctor'), findsOneWidget);
    expect(find.widgetWithText(OutlinedButton, 'Pharmacist'), findsOneWidget);
    expect(find.widgetWithText(OutlinedButton, 'Admin'), findsOneWidget);
  });
}
