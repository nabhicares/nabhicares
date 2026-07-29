import { Injectable, NotFoundException } from '@nestjs/common';
import { FirestoreService } from '../../database/firestore.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { assertPatientRecordAccess, AuthUser } from '../../common/privacy/patient-access';
import { staffPatientView } from '../../common/privacy/sanitize';

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
    return staffPatientView(patient);
  }

  async findOne(id: string, user: AuthUser) {
    const data = await assertPatientRecordAccess(this.firestore, id, user);
    return staffPatientView(data);
  }

  async findAll() {
    const snapshot = await this.firestore.collection('patients').get();
    return snapshot.docs.map((doc) => staffPatientView(doc.data()));
  }

  async update(id: string, dto: UpdatePatientDto) {
    const docRef = this.firestore.collection('patients').doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      throw new NotFoundException(`Patient with ID ${id} does not exist.`);
    }
    const safe: Record<string, unknown> = {};
    for (const key of [
      'name',
      'email',
      'phone',
      'dateOfBirth',
      'gender',
      'allergies',
      'medicalHistory',
    ] as const) {
      if (dto[key] !== undefined) safe[key] = dto[key];
    }
    await docRef.update(safe);
    return staffPatientView({ id, ...doc.data(), ...safe });
  }
}
