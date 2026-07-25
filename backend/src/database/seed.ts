import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { FirestoreService } from './firestore.service';

@Injectable()
export class DatabaseSeeder implements OnApplicationBootstrap {
  constructor(private firestore: FirestoreService) {}

  async onApplicationBootstrap() {
    if (process.env.SEED_ON_BOOT?.trim() !== 'true') {
      console.log('[DatabaseSeeder] Seeding is gated by SEED_ON_BOOT. Skipping seed.');
      return;
    }
    console.log('[DatabaseSeeder] Force seeding database configurations...');

    try {
      // 1. Seed Settings Configuration
      const settingsRef = this.firestore.collection('settings').doc('systemConfiguration');
      await settingsRef.set({
        hospitalName: 'Pharma Store General Hospital',
        taxPercentage: 18,
        lowStockThreshold: 15,
        updatedAt: new Date().toISOString(),
      });

      // 2. Seed Medicines Catalog
      const medicinesCollection = this.firestore.collection('medicines');
      const defaultMeds = [
        {
          id: 'MED-ASP-100',
          name: 'Aspirin 100mg',
          genericName: 'Aspirin',
          category: 'Analgesics',
          reorderLevel: 50,
          totalQuantity: 200,
          brand: 'Bayer',
          form: 'tablet',
          strength: '100mg',
          unit: 'strip',
          packSize: 10,
          mrp: 1.50,
          gstPercent: 12,
          barcode: '8901234567890',
          location: 'Rack A-1',
          status: 'active',
          normalizedName: 'aspirin100mgtablet',
        },
        {
          id: 'MED-PAR-500',
          name: 'Paracetamol 500mg',
          genericName: 'Acetaminophen',
          category: 'Analgesics',
          reorderLevel: 100,
          totalQuantity: 500,
          brand: 'Crocin',
          form: 'tablet',
          strength: '500mg',
          unit: 'strip',
          packSize: 15,
          mrp: 2.00,
          gstPercent: 12,
          barcode: '8901234567891',
          location: 'Rack A-2',
          status: 'active',
          normalizedName: 'paracetamol500mgtablet',
        },
        {
          id: 'MED-IBU-400',
          name: 'Ibuprofen 400mg',
          genericName: 'Ibuprofen',
          category: 'NSAIDs',
          reorderLevel: 30,
          totalQuantity: 150,
          brand: 'Brufen',
          form: 'tablet',
          strength: '400mg',
          unit: 'strip',
          packSize: 10,
          mrp: 2.50,
          gstPercent: 12,
          barcode: '8901234567892',
          location: 'Rack B-1',
          status: 'active',
          normalizedName: 'ibuprofen400mgtablet',
        },
        {
          id: 'MED-AMO-250',
          name: 'Amoxicillin 250mg',
          genericName: 'Amoxicillin',
          category: 'Antibiotics',
          reorderLevel: 40,
          totalQuantity: 0,
          brand: 'Novamox',
          form: 'capsule',
          strength: '250mg',
          unit: 'strip',
          packSize: 10,
          mrp: 5.00,
          gstPercent: 18,
          barcode: '8901234567893',
          location: 'Rack C-1',
          status: 'active',
          normalizedName: 'amoxicillin250mgcapsule',
        },
      ];

      for (const med of defaultMeds) {
        const medRef = medicinesCollection.doc(med.id);
        await medRef.set({
          ...med,
          createdAt: new Date().toISOString(),
        });

        if (med.totalQuantity > 0) {
          if (med.id === 'MED-ASP-100') {
            const soonExpiry = new Date();
            soonExpiry.setDate(soonExpiry.getDate() + 15);
            const formattedSoonExpiry = soonExpiry.toISOString().split('T')[0];

            await medRef.collection('batches').doc('BATCH-INITIAL-01').set({
              batchNo: 'BATCH-INITIAL-01',
              expiryDate: '2029-12-31',
              quantity: med.totalQuantity - 30,
              unitPrice: 0.5,
              updatedAt: new Date().toISOString(),
            });

            await medRef.collection('batches').doc('BATCH-EXPIRING-SOON').set({
              batchNo: 'BATCH-EXPIRING-SOON',
              expiryDate: formattedSoonExpiry,
              quantity: 30,
              unitPrice: 0.5,
              updatedAt: new Date().toISOString(),
            });
          } else {
            const batchRef = medRef.collection('batches').doc('BATCH-INITIAL-01');
            await batchRef.set({
              batchNo: 'BATCH-INITIAL-01',
              expiryDate: '2029-12-31',
              quantity: med.totalQuantity,
              unitPrice: med.id === 'MED-PAR-500' ? 0.2 : 0.4,
              updatedAt: new Date().toISOString(),
            });
          }
        }
      }

      // 3. Seed User Profiles
      const usersCollection = this.firestore.collection('users');
      const defaultUsers = [
        {
          uid: 'mock-admin-999',
          name: 'Super Administrator',
          email: 'admin@pharmastore.com',
          phone: '+18005550199',
          role: 'super_admin',
          status: 'active',
        },
        {
          uid: 'mock-doctor-abc',
          name: 'Dr. Gregory House',
          email: 'house@pharmastore.com',
          phone: '+18005550188',
          role: 'doctor',
          status: 'active',
        },
        {
          uid: 'mock-pharmacist-001',
          name: 'Philip Pharmacist',
          email: 'philip@pharmastore.com',
          phone: '+18005550177',
          role: 'pharmacist',
          status: 'active',
        },
        {
          uid: 'mock-patient-123',
          name: 'Alice Patient',
          email: 'alice@pharmastore.com',
          phone: '+18005550166',
          role: 'patient',
          status: 'active',
        },
      ];

      for (const user of defaultUsers) {
        await usersCollection.doc(user.uid).set({
          ...user,
          createdAt: new Date().toISOString(),
        });
      }

      // 4. Seed Doctors Registry
      const doctorsCollection = this.firestore.collection('doctors');
      await doctorsCollection.doc('5D4181ZA').set({
        id: '5D4181ZA',
        uid: 'mock-doctor-abc',
        name: 'Dr. Gregory House',
        email: 'house@pharmastore.com',
        specialty: 'Diagnostics',
        consultationFee: 150,
        qualifications: 'MD, FACP',
        weeklySchedule: {
          Monday: ['09:00-12:00', '14:00-17:00'],
          Wednesday: ['09:00-12:00'],
          Friday: ['09:00-12:00', '14:00-17:00'],
        },
        createdAt: new Date().toISOString(),
      });

      // 5. Seed Patients Registry
      const patientsCollection = this.firestore.collection('patients');
      await patientsCollection.doc('BADP1K3A').set({
        id: 'BADP1K3A',
        uid: 'mock-patient-123',
        name: 'Alice Patient',
        email: 'alice@pharmastore.com',
        phone: '+18005550166',
        dateOfBirth: '1992-08-24',
        gender: 'Female',
        allergies: ['Penicillin'],
        medicalHistory: ['Asthma (mild)'],
        createdAt: new Date().toISOString(),
      });

      // 6. Seed Suppliers Registry
      const suppliersCollection = this.firestore.collection('suppliers');
      await suppliersCollection.doc('mock-supplier-abc').set({
        id: 'mock-supplier-abc',
        name: 'PharmaCorp Distributors',
        contactEmail: 'contacts@pharmacorp.com',
        address: '123 Industrial Parkway',
        phone: '+919999999999',
        gstin: '36AAAAA0000A1Z5',
        contactPerson: 'Mr. Rajesh Kumar',
        status: 'active',
        createdAt: new Date().toISOString(),
      });

      // 7. Seed Sample Purchase Order
      const purchaseOrdersCollection = this.firestore.collection('purchaseOrders');
      await purchaseOrdersCollection.doc('po-sample-101').set({
        id: 'po-sample-101',
        supplierId: 'mock-supplier-abc',
        supplierName: 'PharmaCorp Distributors',
        items: [
          {
            medicineId: 'MED-ASP-100',
            medicineName: 'Aspirin 100mg',
            quantity: 100,
            unitPrice: 0.5,
            quantityReceived: 0,
          },
          {
            medicineId: 'MED-PAR-500',
            medicineName: 'Paracetamol 500mg',
            quantity: 200,
            unitPrice: 0.2,
            quantityReceived: 0,
          },
        ],
        status: 'pending',
        createdAt: new Date().toISOString(),
      });

      // 8. Seed appointments / EMR / prescriptions / notifications for UI demos
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const tomorrow = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);

      const appointmentsCollection = this.firestore.collection('appointments');
      await appointmentsCollection.doc('apt-demo-001').set({
        id: 'apt-demo-001',
        patientId: 'BADP1K3A',
        patientName: 'Alice Patient',
        doctorId: '5D4181ZA',
        doctorName: 'Dr. Gregory House',
        date: today,
        timeSlot: '09:00',
        status: 'booked',
        createdAt: now.toISOString(),
      });
      await appointmentsCollection.doc('apt-demo-002').set({
        id: 'apt-demo-002',
        patientId: 'BADP1K3A',
        patientName: 'Alice Patient',
        doctorId: '5D4181ZA',
        doctorName: 'Dr. Gregory House',
        date: tomorrow,
        timeSlot: '10:30',
        status: 'booked',
        createdAt: now.toISOString(),
      });
      await appointmentsCollection.doc('apt-demo-003').set({
        id: 'apt-demo-003',
        patientId: 'BADP1K3A',
        patientName: 'Alice Patient',
        doctorId: '5D4181ZA',
        doctorName: 'Dr. Gregory House',
        date: '2026-07-20',
        timeSlot: '11:00',
        status: 'completed',
        createdAt: '2026-07-20T05:00:00.000Z',
      });

      await this.firestore
        .collection('doctors')
        .doc('5D4181ZA')
        .collection('schedule')
        .doc('template')
        .set({
          slotDurationMinutes: 30,
          weeklySchedules: [
            { dayOfWeek: 'Monday', startTime: '09:00', endTime: '12:00' },
            { dayOfWeek: 'Monday', startTime: '14:00', endTime: '17:00' },
            { dayOfWeek: 'Wednesday', startTime: '09:00', endTime: '12:00' },
            { dayOfWeek: 'Friday', startTime: '09:00', endTime: '12:00' },
            { dayOfWeek: 'Friday', startTime: '14:00', endTime: '17:00' },
          ],
          updatedAt: now.toISOString(),
        });

      const prescriptionsCollection = this.firestore.collection('prescriptions');
      await prescriptionsCollection.doc('rx-demo-001').set({
        id: 'rx-demo-001',
        consultationId: 'consult-demo-001',
        patientId: 'BADP1K3A',
        doctorId: 'mock-doctor-abc',
        items: [
          {
            medicineId: 'MED-PAR-500',
            medicineName: 'Paracetamol 500mg',
            dosage: '1 tablet twice daily',
            duration: '5 days',
            instructions: 'After food',
            status: 'pending',
          },
          {
            medicineId: 'MED-IBU-400',
            medicineName: 'Ibuprofen 400mg',
            dosage: '1 tablet as needed',
            duration: '3 days',
            instructions: 'Max 3 per day',
            status: 'pending',
          },
        ],
        status: 'pending',
        createdAt: now.toISOString(),
      });

      // Match Flutter mock-login token UIDs so Notifications Hub has rows.
      const notificationsCollection = this.firestore.collection('notifications');
      const notifyTargets = [
        'mock-patient-demo_patient_pharmastore.com',
        'mock-patient-123',
        'mock-doctor-demo_doctor_pharmastore.com',
        'mock-doctor-abc',
      ];
      let n = 0;
      for (const userId of notifyTargets) {
        n += 1;
        await notificationsCollection.doc(`notif-demo-${n}`).set({
          id: `notif-demo-${n}`,
          userId,
          title: n % 2 === 0 ? 'Appointment reminder' : 'Prescription update',
          body:
            n % 2 === 0
              ? 'You have an upcoming consultation with Dr. Gregory House.'
              : 'Your pharmacy has an active prescription ready for review.',
          status: 'sent_mock',
          createdAt: now.toISOString(),
        });
      }

      console.log('[DatabaseSeeder] Seeding verification complete.');
    } catch (err: any) {
      console.error('[DatabaseSeeder] Seeding failed:', err.message);
    }
  }
}
