import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { FirestoreService } from '../../database/firestore.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';

@Injectable()
export class PrescriptionsService {
  constructor(private firestore: FirestoreService) {}

  async create(doctorId: string, dto: CreatePrescriptionDto) {
    const consultRef = this.firestore.collection('consultations').doc(dto.consultationId);
    const consultDoc = await consultRef.get();
    if (!consultDoc.exists) {
      throw new NotFoundException(`Consultation EMR with ID ${dto.consultationId} does not exist.`);
    }

    const prescriptionRef = this.firestore.collection('prescriptions').doc();
    const prescription = {
      id: prescriptionRef.id,
      consultationId: dto.consultationId,
      patientId: dto.patientId,
      doctorId,
      items: dto.items.map((item) => ({
        ...item,
        status: 'pending',
      })),
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    await prescriptionRef.set(prescription);
    return prescription;
  }

  async findOne(id: string) {
    const doc = await this.firestore.collection('prescriptions').doc(id).get();
    if (!doc.exists) {
      throw new NotFoundException(`Prescription with ID ${id} does not exist.`);
    }
    return doc.data();
  }

  async findPending() {
    const snapshot = await this.firestore
      .collection('prescriptions')
      .where('status', 'in', ['pending', 'partial'])
      .get();
    return snapshot.docs.map((doc) => doc.data());
  }

  async findPatientPrescriptions(patientId: string) {
    const snapshot = await this.firestore
      .collection('prescriptions')
      .where('patientId', '==', patientId)
      .get();
    return snapshot.docs.map((doc) => doc.data());
  }

  async dispenseItem(id: string, itemIndex: number) {
    const docRef = this.firestore.collection('prescriptions').doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      throw new NotFoundException(`Prescription with ID ${id} does not exist.`);
    }

    const data = doc.data()!;
    if (!data.items[itemIndex]) {
      throw new BadRequestException(`Prescribed medicine index ${itemIndex} is out of bounds.`);
    }

    data.items[itemIndex].status = 'dispensed';

    const allDispensed = data.items.every((item: any) => item.status === 'dispensed');
    const status = allDispensed ? 'dispensed' : 'partial';

    await docRef.update({
      items: data.items,
      status,
    });

    return { id, items: data.items, status };
  }
}
