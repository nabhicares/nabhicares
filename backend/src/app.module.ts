import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module';
import { PatientsModule } from './modules/patients/patients.module';
import { DoctorsModule } from './modules/doctors/doctors.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { EMRModule } from './modules/emr/emr.module';
import { PrescriptionsModule } from './modules/prescriptions/prescriptions.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { PurchasesModule } from './modules/purchases/purchases.module';
import { BillingModule } from './modules/billing/billing.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ReportsModule } from './modules/reports/reports.module';
import { PharmacyModule } from './modules/pharmacy/pharmacy.module';
import { SettingsModule } from './modules/settings/settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    HealthModule,
    UsersModule,
    PatientsModule,
    DoctorsModule,
    AppointmentsModule,
    EMRModule,
    PrescriptionsModule,
    InventoryModule,
    PurchasesModule,
    BillingModule,
    NotificationsModule,
    ReportsModule,
    PharmacyModule,
    SettingsModule,
  ],
})
export class AppModule {}
