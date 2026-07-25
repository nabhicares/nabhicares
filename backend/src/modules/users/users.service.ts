import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { FirestoreService } from '../../database/firestore.service';
import { AssignRoleDto } from './dto/assign-role.dto';
import { CreateUserProfileDto } from './dto/create-user-profile.dto';

@Injectable()
export class UsersService {
  constructor(private firestore: FirestoreService) {}

  async createUserProfile(uid: string, dto: CreateUserProfileDto) {
    const userRef = this.firestore.collection('users').doc(uid);
    const doc = await userRef.get();

    if (doc.exists) {
      return doc.data();
    }

    const profile = {
      uid,
      name: dto.name,
      email: dto.email,
      phone: dto.phone || null,
      role: 'patient',
      createdAt: new Date().toISOString(),
      status: 'active',
    };

    await userRef.set(profile);
    return profile;
  }

  async assignRole(dto: AssignRoleDto) {
    const isMock =
      !process.env.FIREBASE_PRIVATE_KEY ||
      process.env.FIREBASE_PRIVATE_KEY.includes('MOCK_KEY');

    if (!isMock) {
      try {
        await admin.auth().setCustomUserClaims(dto.uid, { role: dto.role });
      } catch (err) {
        throw new BadRequestException(`Firebase Auth custom claims error: ${err.message}`);
      }
    }

    const userRef = this.firestore.collection('users').doc(dto.uid);
    const doc = await userRef.get();
    if (!doc.exists) {
      // If profile does not exist in mock, create it dynamically for convenience
      if (isMock) {
        const profile = {
          uid: dto.uid,
          name: `Mock ${dto.role.toUpperCase()}`,
          email: `${dto.uid}@hospital.com`,
          phone: null,
          role: dto.role,
          createdAt: new Date().toISOString(),
          status: 'active',
        };
        await userRef.set(profile);
        return { uid: dto.uid, role: dto.role, status: 'created_and_assigned' };
      }
      throw new NotFoundException(`User profile with UID ${dto.uid} does not exist.`);
    }

    await userRef.update({ role: dto.role });
    return { uid: dto.uid, role: dto.role, status: 'assigned' };
  }

  async getProfile(uid: string) {
    const doc = await this.firestore.collection('users').doc(uid).get();
    if (!doc.exists) {
      throw new NotFoundException(`User profile with UID ${uid} does not exist.`);
    }
    return doc.data();
  }
}
