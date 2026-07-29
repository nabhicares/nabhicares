import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { FirestoreService } from './firestore.service';
import { isProductionRuntime, isDemoMode } from '../common/config/env.validation';

@Injectable()
export class DatabaseSeeder implements OnApplicationBootstrap {
  constructor(private firestore: FirestoreService) {}

  async onApplicationBootstrap() {
    if (process.env.SEED_ON_BOOT?.trim() !== 'true') {
      return;
    }
    if (isProductionRuntime() && !isDemoMode()) {
      throw new Error('SEED_ON_BOOT is forbidden in production (set ALLOW_DEMO_MODE=true for demos).');
    }

    try {
      const now = new Date();
      const iso = now.toISOString();
      const today = iso.slice(0, 10);
      const d = (offset: number) =>
        new Date(now.getTime() + offset * 86400000).toISOString().slice(0, 10);
      const expiryIn = (days: number) => d(days);

      // 1. Settings
      await this.firestore.collection('settings').doc('systemConfiguration').set({
        hospitalName: 'Pharma Store General Hospital',
        taxPercentage: 18,
        lowStockThreshold: 15,
        currency: 'INR',
        updatedAt: iso,
      });

      // 2. Medicines (+ batches) — mix of healthy / low / out / expiring
      const medicines = [
        {
          id: 'MED-ASP-100', name: 'Aspirin 100mg', genericName: 'Aspirin', category: 'Analgesics',
          reorderLevel: 50, totalQuantity: 200, brand: 'Bayer', form: 'tablet', strength: '100mg',
          unit: 'strip', packSize: 10, mrp: 25, gstPercent: 12, barcode: '8901000000001',
          location: 'Rack A-1', status: 'active', unitPrice: 8,
        },
        {
          id: 'MED-PAR-500', name: 'Paracetamol 500mg', genericName: 'Acetaminophen', category: 'Analgesics',
          reorderLevel: 100, totalQuantity: 520, brand: 'Crocin', form: 'tablet', strength: '500mg',
          unit: 'strip', packSize: 15, mrp: 30, gstPercent: 12, barcode: '8901000000002',
          location: 'Rack A-2', status: 'active', unitPrice: 5,
        },
        {
          id: 'MED-IBU-400', name: 'Ibuprofen 400mg', genericName: 'Ibuprofen', category: 'NSAIDs',
          reorderLevel: 30, totalQuantity: 18, brand: 'Brufen', form: 'tablet', strength: '400mg',
          unit: 'strip', packSize: 10, mrp: 45, gstPercent: 12, barcode: '8901000000003',
          location: 'Rack B-1', status: 'active', unitPrice: 12, // low stock
        },
        {
          id: 'MED-AMO-250', name: 'Amoxicillin 250mg', genericName: 'Amoxicillin', category: 'Antibiotics',
          reorderLevel: 40, totalQuantity: 0, brand: 'Novamox', form: 'capsule', strength: '250mg',
          unit: 'strip', packSize: 10, mrp: 85, gstPercent: 18, barcode: '8901000000004',
          location: 'Rack C-1', status: 'active', unitPrice: 28, // out of stock
        },
        {
          id: 'MED-MET-500', name: 'Metformin 500mg', genericName: 'Metformin', category: 'Antidiabetics',
          reorderLevel: 60, totalQuantity: 340, brand: 'Glycomet', form: 'tablet', strength: '500mg',
          unit: 'strip', packSize: 15, mrp: 40, gstPercent: 12, barcode: '8901000000005',
          location: 'Rack D-1', status: 'active', unitPrice: 10,
        },
        {
          id: 'MED-ATO-10', name: 'Atorvastatin 10mg', genericName: 'Atorvastatin', category: 'Cardiology',
          reorderLevel: 40, totalQuantity: 12, brand: 'Atorva', form: 'tablet', strength: '10mg',
          unit: 'strip', packSize: 10, mrp: 95, gstPercent: 12, barcode: '8901000000006',
          location: 'Rack D-2', status: 'active', unitPrice: 32, // low stock
        },
        {
          id: 'MED-CET-10', name: 'Cetirizine 10mg', genericName: 'Cetirizine', category: 'Antihistamines',
          reorderLevel: 50, totalQuantity: 280, brand: 'Okacet', form: 'tablet', strength: '10mg',
          unit: 'strip', packSize: 10, mrp: 18, gstPercent: 12, barcode: '8901000000007',
          location: 'Rack E-1', status: 'active', unitPrice: 4,
        },
        {
          id: 'MED-OMZ-20', name: 'Omeprazole 20mg', genericName: 'Omeprazole', category: 'Gastroenterology',
          reorderLevel: 45, totalQuantity: 190, brand: 'Omez', form: 'capsule', strength: '20mg',
          unit: 'strip', packSize: 15, mrp: 55, gstPercent: 12, barcode: '8901000000008',
          location: 'Rack E-2', status: 'active', unitPrice: 14,
        },
        {
          id: 'MED-AZI-500', name: 'Azithromycin 500mg', genericName: 'Azithromycin', category: 'Antibiotics',
          reorderLevel: 25, totalQuantity: 75, brand: 'Azithral', form: 'tablet', strength: '500mg',
          unit: 'strip', packSize: 3, mrp: 75, gstPercent: 18, barcode: '8901000000009',
          location: 'Rack C-2', status: 'active', unitPrice: 22,
        },
        {
          id: 'MED-ORS-200', name: 'ORS Sachet', genericName: 'Oral Rehydration Salts', category: 'Electrolytes',
          reorderLevel: 80, totalQuantity: 400, brand: 'Electral', form: 'sachet', strength: '21.8g',
          unit: 'box', packSize: 20, mrp: 22, gstPercent: 12, barcode: '8901000000010',
          location: 'Rack F-1', status: 'active', unitPrice: 6,
        },
      ];

      for (const med of medicines) {
        const { unitPrice, ...doc } = med;
        const medRef = this.firestore.collection('medicines').doc(med.id);
        await medRef.set({
          ...doc,
          normalizedName: `${med.name}${med.form}`.toLowerCase().replace(/\s+/g, ''),
          createdAt: iso,
        });

        if (med.totalQuantity <= 0) continue;

        // Main batch
        const mainQty = Math.max(1, med.totalQuantity - (med.id === 'MED-ASP-100' ? 30 : 0));
        await medRef.collection('batches').doc('BATCH-A').set({
          batchNo: 'BATCH-A',
          expiryDate: '2028-12-31',
          quantity: mainQty,
          unitPrice,
          updatedAt: iso,
        });

        // Expiring-soon batch for Aspirin (alerts demo)
        if (med.id === 'MED-ASP-100') {
          await medRef.collection('batches').doc('BATCH-EXPIRING').set({
            batchNo: 'BATCH-EXPIRING',
            expiryDate: expiryIn(12),
            quantity: 30,
            unitPrice,
            updatedAt: iso,
          });
        }
      }

      // A few stock transactions for history screens
      const tx = this.firestore.collection('stockTransactions');
      await tx.doc('tx-001').set({
        id: 'tx-001', medicineId: 'MED-PAR-500', medicineName: 'Paracetamol 500mg',
        batchNo: 'BATCH-A', type: 'receive', quantityChange: 200, reason: 'PO receive',
        createdAt: d(-5) + 'T10:00:00.000Z',
      });
      await tx.doc('tx-002').set({
        id: 'tx-002', medicineId: 'MED-IBU-400', medicineName: 'Ibuprofen 400mg',
        batchNo: 'BATCH-A', type: 'dispense', quantityChange: -20, reason: 'Pharmacy dispense',
        createdAt: d(-2) + 'T14:30:00.000Z',
      });
      await tx.doc('tx-003').set({
        id: 'tx-003', medicineId: 'MED-ATO-10', medicineName: 'Atorvastatin 10mg',
        batchNo: 'BATCH-A', type: 'adjust', quantityChange: -5, reason: 'Damaged stock write-off',
        createdAt: d(-1) + 'T09:15:00.000Z',
      });

      // 3. Users — include opaque mock-* UIDs used by demo login tokens
      const users = [
        { uid: 'mock-super_admin', name: 'Demo Super Admin', email: 'super_admin@pharmastore.com', phone: '+919800000000', role: 'super_admin' },
        { uid: 'mock-hospital_admin', name: 'Demo Admin', email: 'hospital_admin@pharmastore.com', phone: '+919800000011', role: 'hospital_admin' },
        { uid: 'mock-doctor', name: 'Demo Doctor', email: 'doctor@pharmastore.com', phone: '+919800000010', role: 'doctor' },
        { uid: 'mock-pharmacist', name: 'Demo Pharmacist', email: 'pharmacist@pharmastore.com', phone: '+919800000012', role: 'pharmacist' },
        { uid: 'mock-receptionist', name: 'Demo Receptionist', email: 'receptionist@pharmastore.com', phone: '+919800000015', role: 'receptionist' },
        { uid: 'mock-patient', name: 'Demo Patient', email: 'patient@pharmastore.com', phone: '+919800000009', role: 'patient' },
        { uid: 'mock-admin-999', name: 'Super Administrator', email: 'admin@pharmastore.com', phone: '+919800000001', role: 'super_admin' },
        { uid: 'mock-doctor-abc', name: 'Dr. Gregory House', email: 'house@pharmastore.com', phone: '+919800000002', role: 'doctor' },
        { uid: 'mock-doctor-foreman', name: 'Dr. Eric Foreman', email: 'foreman@pharmastore.com', phone: '+919800000003', role: 'doctor' },
        { uid: 'mock-doctor-cameron', name: 'Dr. Allison Cameron', email: 'cameron@pharmastore.com', phone: '+919800000004', role: 'doctor' },
        { uid: 'mock-pharmacist-001', name: 'Philip Pharmacist', email: 'philip@pharmastore.com', phone: '+919800000005', role: 'pharmacist' },
        { uid: 'mock-patient-123', name: 'Alice Patient', email: 'alice@pharmastore.com', phone: '+919800000006', role: 'patient' },
        { uid: 'mock-patient-ravi', name: 'Ravi Kumar', email: 'ravi@pharmastore.com', phone: '+919800000007', role: 'patient' },
        { uid: 'mock-patient-priya', name: 'Priya Sharma', email: 'priya@pharmastore.com', phone: '+919800000008', role: 'patient' },
      ];
      for (const u of users) {
        await this.firestore.collection('users').doc(u.uid).set({ ...u, status: 'active', createdAt: iso });
      }

      // 4. Doctors (3 specialists)
      const doctors = [
        {
          id: '5D4181ZA', uid: 'mock-doctor', name: 'Dr. Gregory House', email: 'house@pharmastore.com',
          specialty: 'Diagnostics', consultationFee: 1200, qualifications: 'MD, FACP',
          weeklySchedule: { Monday: ['09:00-12:00', '14:00-17:00'], Wednesday: ['09:00-12:00'], Friday: ['09:00-12:00', '14:00-17:00'] },
        },
        {
          id: 'DOC-FOREMAN', uid: 'mock-doctor-foreman', name: 'Dr. Eric Foreman', email: 'foreman@pharmastore.com',
          specialty: 'Neurology', consultationFee: 1500, qualifications: 'MD, PhD',
          weeklySchedule: { Tuesday: ['10:00-13:00', '15:00-18:00'], Thursday: ['10:00-13:00'], Saturday: ['09:00-12:00'] },
        },
        {
          id: 'DOC-CAMERON', uid: 'mock-doctor-cameron', name: 'Dr. Allison Cameron', email: 'cameron@pharmastore.com',
          specialty: 'Immunology', consultationFee: 1000, qualifications: 'MD',
          weeklySchedule: { Monday: ['10:00-13:00'], Wednesday: ['14:00-18:00'], Friday: ['10:00-13:00'] },
        },
      ];
      for (const doc of doctors) {
        await this.firestore.collection('doctors').doc(doc.id).set({ ...doc, createdAt: iso });
        const days = Object.entries(doc.weeklySchedule).flatMap(([day, ranges]) =>
          ranges.map((range) => {
            const [startTime, endTime] = range.split('-');
            return { dayOfWeek: day, startTime, endTime };
          }),
        );
        await this.firestore
          .collection('doctors').doc(doc.id).collection('schedule').doc('template')
          .set({ slotDurationMinutes: 30, weeklySchedules: days, updatedAt: iso });
      }

      // 5. Patients
      const patients = [
        {
          id: 'BADP1K3A', uid: 'mock-patient', name: 'Alice Patient', email: 'alice@pharmastore.com',
          phone: '+919800000006', dateOfBirth: '1992-08-24', gender: 'Female',
          allergies: ['Penicillin'], medicalHistory: ['Asthma (mild)'],
        },
        {
          id: 'PAT-RAVI', uid: 'mock-patient-ravi', name: 'Ravi Kumar', email: 'ravi@pharmastore.com',
          phone: '+919800000007', dateOfBirth: '1985-03-12', gender: 'Male',
          allergies: [], medicalHistory: ['Type 2 Diabetes', 'Hypertension'],
        },
        {
          id: 'PAT-PRIYA', uid: 'mock-patient-priya', name: 'Priya Sharma', email: 'priya@pharmastore.com',
          phone: '+919800000008', dateOfBirth: '1998-11-05', gender: 'Female',
          allergies: ['Sulfa drugs'], medicalHistory: [],
        },
        {
          id: 'PAT-ANIL', uid: 'mock-patient-anil', name: 'Anil Mehta', email: 'anil@pharmastore.com',
          phone: '+919800000013', dateOfBirth: '1974-06-18', gender: 'Male',
          allergies: [], medicalHistory: ['Hyperlipidemia'],
        },
        {
          id: 'PAT-SNEHA', uid: 'mock-patient-sneha', name: 'Sneha Reddy', email: 'sneha@pharmastore.com',
          phone: '+919800000014', dateOfBirth: '2001-01-30', gender: 'Female',
          allergies: ['Dust mites'], medicalHistory: ['Seasonal rhinitis'],
        },
      ];
      for (const p of patients) {
        await this.firestore.collection('patients').doc(p.id).set({ ...p, createdAt: iso });
      }

      // 6. Suppliers + purchase orders
      await this.firestore.collection('suppliers').doc('sup-pharmacorp').set({
        id: 'sup-pharmacorp', name: 'PharmaCorp Distributors', contactEmail: 'orders@pharmacorp.in',
        address: 'Plot 12, IDA Nacharam, Hyderabad', phone: '+919999900001',
        gstin: '36AAAAA0000A1Z5', contactPerson: 'Rajesh Kumar', status: 'active', createdAt: iso,
      });
      await this.firestore.collection('suppliers').doc('sup-medilife').set({
        id: 'sup-medilife', name: 'MediLife Wholesale', contactEmail: 'sales@medilife.in',
        address: '45 Pharma Hub, Bengaluru', phone: '+919999900002',
        gstin: '29BBBBB1111B2Z6', contactPerson: 'Suresh Nair', status: 'active', createdAt: iso,
      });

      await this.firestore.collection('purchaseOrders').doc('po-101').set({
        id: 'po-101', supplierId: 'sup-pharmacorp', supplierName: 'PharmaCorp Distributors',
        items: [
          { medicineId: 'MED-ASP-100', medicineName: 'Aspirin 100mg', quantity: 200, unitPrice: 8, quantityReceived: 0 },
          { medicineId: 'MED-PAR-500', medicineName: 'Paracetamol 500mg', quantity: 300, unitPrice: 5, quantityReceived: 0 },
        ],
        status: 'pending', createdAt: iso,
      });
      await this.firestore.collection('purchaseOrders').doc('po-102').set({
        id: 'po-102', supplierId: 'sup-medilife', supplierName: 'MediLife Wholesale',
        items: [
          { medicineId: 'MED-AMO-250', medicineName: 'Amoxicillin 250mg', quantity: 150, unitPrice: 28, quantityReceived: 0 },
          { medicineId: 'MED-ATO-10', medicineName: 'Atorvastatin 10mg', quantity: 100, unitPrice: 32, quantityReceived: 0 },
        ],
        status: 'pending', createdAt: d(-1) + 'T08:00:00.000Z',
      });
      await this.firestore.collection('purchaseOrders').doc('po-103').set({
        id: 'po-103', supplierId: 'sup-pharmacorp', supplierName: 'PharmaCorp Distributors',
        items: [
          { medicineId: 'MED-MET-500', medicineName: 'Metformin 500mg', quantity: 250, unitPrice: 10, quantityReceived: 250 },
        ],
        status: 'received', createdAt: d(-7) + 'T11:00:00.000Z',
      });

      // 7. Appointments — fill doctor queue + patient bookings
      const appointments = [
        // Alice (demo patient) — past / today / tomorrow
        { id: 'apt-001', patientId: 'BADP1K3A', patientName: 'Alice Patient', doctorId: '5D4181ZA', doctorName: 'Dr. Gregory House', date: d(-5), timeSlot: '11:00', status: 'completed' },
        { id: 'apt-002', patientId: 'BADP1K3A', patientName: 'Alice Patient', doctorId: '5D4181ZA', doctorName: 'Dr. Gregory House', date: today, timeSlot: '09:00', status: 'booked' },
        { id: 'apt-003', patientId: 'BADP1K3A', patientName: 'Alice Patient', doctorId: 'DOC-FOREMAN', doctorName: 'Dr. Eric Foreman', date: d(2), timeSlot: '10:30', status: 'booked' },
        { id: 'apt-004', patientId: 'BADP1K3A', patientName: 'Alice Patient', doctorId: 'DOC-CAMERON', doctorName: 'Dr. Allison Cameron', date: d(-12), timeSlot: '14:00', status: 'completed' },
        // Doctor House queue for today/tomorrow
        { id: 'apt-005', patientId: 'PAT-RAVI', patientName: 'Ravi Kumar', doctorId: '5D4181ZA', doctorName: 'Dr. Gregory House', date: today, timeSlot: '09:30', status: 'booked' },
        { id: 'apt-006', patientId: 'PAT-PRIYA', patientName: 'Priya Sharma', doctorId: '5D4181ZA', doctorName: 'Dr. Gregory House', date: today, timeSlot: '10:00', status: 'booked' },
        { id: 'apt-007', patientId: 'PAT-ANIL', patientName: 'Anil Mehta', doctorId: '5D4181ZA', doctorName: 'Dr. Gregory House', date: today, timeSlot: '10:30', status: 'booked' },
        { id: 'apt-008', patientId: 'PAT-SNEHA', patientName: 'Sneha Reddy', doctorId: '5D4181ZA', doctorName: 'Dr. Gregory House', date: d(1), timeSlot: '09:00', status: 'booked' },
        { id: 'apt-009', patientId: 'PAT-RAVI', patientName: 'Ravi Kumar', doctorId: '5D4181ZA', doctorName: 'Dr. Gregory House', date: d(-3), timeSlot: '15:00', status: 'completed' },
        { id: 'apt-010', patientId: 'PAT-PRIYA', patientName: 'Priya Sharma', doctorId: 'DOC-CAMERON', doctorName: 'Dr. Allison Cameron', date: d(1), timeSlot: '11:00', status: 'booked' },
        { id: 'apt-011', patientId: 'PAT-ANIL', patientName: 'Anil Mehta', doctorId: 'DOC-FOREMAN', doctorName: 'Dr. Eric Foreman', date: today, timeSlot: '15:00', status: 'booked' },
        { id: 'apt-012', patientId: 'PAT-SNEHA', patientName: 'Sneha Reddy', doctorId: 'DOC-CAMERON', doctorName: 'Dr. Allison Cameron', date: d(-8), timeSlot: '10:00', status: 'cancelled' },
      ];
      for (const a of appointments) {
        await this.firestore.collection('appointments').doc(a.id).set({ ...a, createdAt: iso });
      }

      // 8. Prescriptions — pending ones feed pharmacist POS + patient Rx / pill reminders
      const prescriptions = [
        {
          id: 'rx-001', consultationId: 'consult-001', patientId: 'BADP1K3A', doctorId: 'mock-doctor-abc', status: 'pending',
          items: [
            { medicineId: 'MED-PAR-500', medicineName: 'Paracetamol 500mg', dosage: '1-0-1', duration: '5 days', instructions: 'After food', status: 'pending' },
            { medicineId: 'MED-IBU-400', medicineName: 'Ibuprofen 400mg', dosage: '1 tablet as needed', duration: '3 days', instructions: 'Max 3/day', status: 'pending' },
          ],
        },
        {
          id: 'rx-002', consultationId: 'consult-002', patientId: 'PAT-RAVI', doctorId: 'mock-doctor-abc', status: 'pending',
          items: [
            { medicineId: 'MED-MET-500', medicineName: 'Metformin 500mg', dosage: '1-0-1', duration: '30 days', instructions: 'With meals', status: 'pending' },
            { medicineId: 'MED-ATO-10', medicineName: 'Atorvastatin 10mg', dosage: '0-0-1', duration: '30 days', instructions: 'At night', status: 'pending' },
          ],
        },
        {
          id: 'rx-003', consultationId: 'consult-003', patientId: 'PAT-PRIYA', doctorId: 'mock-doctor-cameron', status: 'pending',
          items: [
            { medicineId: 'MED-CET-10', medicineName: 'Cetirizine 10mg', dosage: '0-0-1', duration: '7 days', instructions: 'At bedtime', status: 'pending' },
          ],
        },
        {
          id: 'rx-004', consultationId: 'consult-004', patientId: 'PAT-ANIL', doctorId: 'mock-doctor-foreman', status: 'pending',
          items: [
            { medicineId: 'MED-OMZ-20', medicineName: 'Omeprazole 20mg', dosage: '1-0-0', duration: '14 days', instructions: 'Before breakfast', status: 'pending' },
            { medicineId: 'MED-ASP-100', medicineName: 'Aspirin 100mg', dosage: '0-0-1', duration: '30 days', instructions: 'After dinner', status: 'pending' },
          ],
        },
        {
          id: 'rx-005', consultationId: 'consult-005', patientId: 'BADP1K3A', doctorId: 'mock-doctor-abc', status: 'dispensed',
          items: [
            { medicineId: 'MED-PAR-500', medicineName: 'Paracetamol 500mg', dosage: '1-1-1', duration: '3 days', instructions: 'After food', status: 'dispensed' },
          ],
        },
        {
          id: 'rx-006', consultationId: 'consult-006', patientId: 'PAT-SNEHA', doctorId: 'mock-doctor-cameron', status: 'pending',
          items: [
            { medicineId: 'MED-CET-10', medicineName: 'Cetirizine 10mg', dosage: '0-0-1', duration: '5 days', instructions: 'At night', status: 'pending' },
            { medicineId: 'MED-ORS-200', medicineName: 'ORS Sachet', dosage: '1 sachet', duration: '2 days', instructions: 'Dissolve in water', status: 'pending' },
          ],
        },
      ];
      for (const rx of prescriptions) {
        await this.firestore.collection('prescriptions').doc(rx.id).set({ ...rx, createdAt: iso });
      }

      // 9. Invoices — patient billing + admin revenue
      const invoices = [
        {
          id: 'inv-001', patientId: 'BADP1K3A', patientName: 'Alice Patient', appointmentId: 'apt-001',
          items: [
            { description: 'Consultation — Diagnostics', amount: 1200 },
            { description: 'Lab: CBC panel', amount: 450 },
          ],
          totalAmount: 1650, status: 'paid', paidAt: iso,
        },
        {
          id: 'inv-002', patientId: 'BADP1K3A', patientName: 'Alice Patient', appointmentId: 'apt-004',
          items: [{ description: 'Consultation — Immunology', amount: 1000 }],
          totalAmount: 1000, status: 'unpaid',
        },
        {
          id: 'inv-003', patientId: 'PAT-RAVI', patientName: 'Ravi Kumar', appointmentId: 'apt-009',
          items: [
            { description: 'Consultation — Diagnostics', amount: 1200 },
            { description: 'Pharmacy dispense', amount: 380 },
          ],
          totalAmount: 1580, status: 'paid', paidAt: iso,
        },
        {
          id: 'inv-004', patientId: 'PAT-PRIYA', patientName: 'Priya Sharma', appointmentId: null,
          items: [{ description: 'Pharmacy dispense — Cetirizine', amount: 90 }],
          totalAmount: 90, status: 'paid', paidAt: iso,
        },
        {
          id: 'inv-005', patientId: 'PAT-ANIL', patientName: 'Anil Mehta', appointmentId: 'apt-011',
          items: [
            { description: 'Consultation — Neurology', amount: 1500 },
            { description: 'MRI screening fee', amount: 3500 },
          ],
          totalAmount: 5000, status: 'unpaid',
        },
        {
          id: 'inv-006', patientId: 'PAT-SNEHA', patientName: 'Sneha Reddy', appointmentId: null,
          items: [{ description: 'Pharmacy dispense — Allergy pack', amount: 160 }],
          totalAmount: 160, status: 'paid', paidAt: iso,
        },
      ];
      for (const inv of invoices) {
        await this.firestore.collection('invoices').doc(inv.id).set({ ...inv, createdAt: iso });
      }

      // 10. Notifications for each portal's opaque mock-login UID
      const notifications = [
        { userId: 'mock-patient', title: 'Appointment tomorrow', body: 'Neurology consult with Dr. Eric Foreman at 10:30 AM.' },
        { userId: 'mock-patient', title: 'Prescription ready', body: 'Your Paracetamol + Ibuprofen Rx is waiting at pharmacy.' },
        { userId: 'mock-patient', title: 'Invoice due', body: 'Immunology consultation invoice of ₹1,000 is unpaid.' },
        { userId: 'mock-patient', title: 'Appointment today', body: 'Diagnostics consult with Dr. Gregory House at 09:00 AM.' },
        { userId: 'mock-doctor', title: 'Queue update', body: '4 patients booked for today in your Diagnostics clinic.' },
        { userId: 'mock-doctor', title: 'Schedule reminder', body: 'Friday afternoon slots 14:00–17:00 are open.' },
        { userId: 'mock-doctor-abc', title: 'New booking', body: 'Patient booked for tomorrow 09:00.' },
        { userId: 'mock-pharmacist', title: 'Dispense queue', body: '5 pending prescriptions are waiting in POS.' },
        { userId: 'mock-pharmacist', title: 'Low stock', body: 'Ibuprofen 400mg and Atorvastatin 10mg are below reorder level.' },
        { userId: 'mock-hospital_admin', title: 'Daily summary', body: '₹3,480 collected today. 2 unpaid invoices outstanding.' },
        { userId: 'mock-hospital_admin', title: 'Stock alert', body: 'Amoxicillin is out of stock. 2 SKUs are low.' },
        { userId: 'mock-receptionist', title: 'Check-in queue', body: '3 patients are waiting at the front desk for today’s appointments.' },
        { userId: 'mock-receptionist', title: 'Unpaid invoice', body: 'Immunology consult invoice is still unpaid — collect payment at billing.' },
      ];
      let n = 0;
      for (const note of notifications) {
        n += 1;
        await this.firestore.collection('notifications').doc(`notif-${n}`).set({
          id: `notif-${n}`,
          ...note,
          status: 'sent_mock',
          createdAt: iso,
        });
      }

      console.warn('[DatabaseSeeder] Demo seed complete.');
    } catch (err: any) {
      console.error('[DatabaseSeeder] Seeding failed:', err?.message ? '[REDACTED]' : 'unknown');
    }
  }
}
