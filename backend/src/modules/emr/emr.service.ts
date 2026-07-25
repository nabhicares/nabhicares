import { Injectable, NotFoundException } from '@nestjs/common';
import { FirestoreService } from '../../database/firestore.service';
import { CreateConsultationDto } from './dto/create-consultation.dto';

@Injectable()
export class EMRService {
  constructor(private firestore: FirestoreService) {}

  async createConsultation(doctorId: string, dto: CreateConsultationDto) {
    const { appointmentId, patientId } = dto;

    const appRef = this.firestore.collection('appointments').doc(appointmentId);
    const appDoc = await appRef.get();
    if (!appDoc.exists) {
      throw new NotFoundException(`Appointment with ID ${appointmentId} does not exist.`);
    }

    const consultRef = this.firestore.collection('consultations').doc();
    const consultation = {
      id: consultRef.id,
      appointmentId,
      patientId,
      doctorId,
      symptoms: dto.symptoms,
      diagnosis: dto.diagnosis,
      vitals: dto.vitals,
      clinicalNotes: dto.clinicalNotes || null,
      createdAt: new Date().toISOString(),
    };

    // Update appointment status to completed inside this consult trigger
    await appRef.update({ status: 'completed' });
    await consultRef.set(consultation);

    return consultation;
  }

  async findOne(id: string) {
    const doc = await this.firestore.collection('consultations').doc(id).get();
    if (!doc.exists) {
      throw new NotFoundException(`Consultation record with ID ${id} does not exist.`);
    }
    return doc.data();
  }

  async findPatientEMR(patientId: string) {
    const snapshot = await this.firestore
      .collection('consultations')
      .where('patientId', '==', patientId)
      .get();
    return snapshot.docs.map((doc) => doc.data());
  }
}
