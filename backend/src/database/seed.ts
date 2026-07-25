import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { FirestoreService } from './firestore.service';

@Injectable()
export class DatabaseSeeder implements OnApplicationBootstrap {
  constructor(private firestore: FirestoreService) {}

  async onApplicationBootstrap() {
    console.log('[DatabaseSeeder] Checking database seeding...');

    // 1. Seed Settings Configuration
    const settingsRef = this.firestore.collection('settings').doc('systemConfiguration');
    const settingsDoc = await settingsRef.get();
    if (!settingsDoc.exists) {
      console.log('[DatabaseSeeder] Seeding default hospital settings...');
      await settingsRef.set({
        hospitalName: 'Pharma Store General Hospital',
        taxPercentage: 18,
        lowStockThreshold: 15,
        updatedAt: new Date().toISOString(),
      });
    }

    // 2. Seed Medicines Catalog
    const medicinesCollection = this.firestore.collection('medicines');
    const medicinesSnapshot = await medicinesCollection.get();
    if (medicinesSnapshot.empty) {
      console.log('[DatabaseSeeder] Seeding default medicine SKUs...');
      const defaultMeds = [
        {
          id: 'MED-ASP-100',
          name: 'Aspirin 100mg',
          genericName: 'Aspirin',
          category: 'Analgesics',
          reorderLevel: 50,
          totalQuantity: 200,
        },
        {
          id: 'MED-PAR-500',
          name: 'Paracetamol 500mg',
          genericName: 'Acetaminophen',
          category: 'Analgesics',
          reorderLevel: 100,
          totalQuantity: 500,
        },
        {
          id: 'MED-IBU-400',
          name: 'Ibuprofen 400mg',
          genericName: 'Ibuprofen',
          category: 'NSAIDs',
          reorderLevel: 30,
          totalQuantity: 150,
        },
        {
          id: 'MED-AMO-250',
          name: 'Amoxicillin 250mg',
          genericName: 'Amoxicillin',
          category: 'Antibiotics',
          reorderLevel: 40,
          totalQuantity: 0,
        },
      ];

      for (const med of defaultMeds) {
        const medRef = medicinesCollection.doc(med.id);
        await medRef.set({
          id: med.id,
          name: med.name,
          genericName: med.genericName,
          category: med.category,
          reorderLevel: med.reorderLevel,
          totalQuantity: med.totalQuantity,
          createdAt: new Date().toISOString(),
        });

        if (med.totalQuantity > 0) {
          const batchRef = medRef.collection('batches').doc('BATCH-INITIAL-01');
          await batchRef.set({
            batchNo: 'BATCH-INITIAL-01',
            expiryDate: '2029-12-31',
            quantity: med.totalQuantity,
            unitPrice: med.id === 'MED-ASP-100' ? 0.5 : 0.2,
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }

    // 3. Seed User Profiles
    const usersCollection = this.firestore.collection('users');
    const usersSnapshot = await usersCollection.get();
    if (usersSnapshot.empty) {
      console.log('[DatabaseSeeder] Seeding user access accounts...');
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
          uid: user.uid,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          status: user.status,
          createdAt: new Date().toISOString(),
        });
      }
    }

    // 4. Seed Doctors Registry
    const doctorsCollection = this.firestore.collection('doctors');
    const doctorsSnapshot = await doctorsCollection.get();
    if (doctorsSnapshot.empty) {
      console.log('[DatabaseSeeder] Seeding doctor profile configurations...');
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
    }

    // 5. Seed Patients Registry
    const patientsCollection = this.firestore.collection('patients');
    const patientsSnapshot = await patientsCollection.get();
    if (patientsSnapshot.empty) {
      console.log('[DatabaseSeeder] Seeding patient medical directories...');
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
    }

    console.log('[DatabaseSeeder] Seeding verification complete.');
  }
}
