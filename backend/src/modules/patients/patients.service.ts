import { Injectable, NotFoundException } from '@nestjs/common';
import { FirestoreService } from '../../database/firestore.service';
import { CreatePatientDto } from './dto/create-patient.dto';

@Injectable()
export class PatientsService {
  constructor(private firestore: FirestoreService) {}

  async create(dto: CreatePatientDto) {
    const patientsRef = this.firestore.collection('patients');
    const newDocRef = patientsRef.doc();

    const patient = {
      id: newDocRef.id,
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      dateOfBirth: dto.dateOfBirth,
      gender: dto.gender,
      allergies: dto.allergies || [],
      medicalHistory: dto.medicalHistory || [],
      createdAt: new Date().toISOString(),
    };

    await newDocRef.set(patient);
    return patient;
  }

  async findOne(id: string) {
    const doc = await this.firestore.collection('patients').doc(id).get();
    if (!doc.exists) {
      throw new NotFoundException(`Patient with ID ${id} does not exist.`);
    }
    return doc.data();
  }

  async findAll() {
    const snapshot = await this.firestore.collection('patients').get();
    return snapshot.docs.map((doc) => doc.data());
  }

  async update(id: string, updateData: Partial<CreatePatientDto>) {
    const docRef = this.firestore.collection('patients').doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      throw new NotFoundException(`Patient with ID ${id} does not exist.`);
    }
    await docRef.update(updateData);
    return { id, ...doc.data(), ...updateData };
  }
}
