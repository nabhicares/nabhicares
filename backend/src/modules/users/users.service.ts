import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { FirestoreService } from '../../database/firestore.service';
import { AssignRoleDto } from './dto/assign-role.dto';
import { CreateUserProfileDto } from './dto/create-user-profile.dto';
import { UserBootstrapDto } from './dto/user-bootstrap.dto';

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

  async bootstrapUser(dto: UserBootstrapDto, secretHeader?: string) {
    const bootstrapSecret = process.env.BOOTSTRAP_SECRET || 'CareFlowDefaultSecret2026';

    const superAdminSnapshot = await this.firestore.collection('users')
      .where('role', '==', 'super_admin')
      .get();
    
    if (!superAdminSnapshot.empty && secretHeader !== bootstrapSecret) {
      throw new ForbiddenException('Bootstrap is locked down. A valid secret header is required to register new users via bootstrap.');
    }

    const isMock =
      !process.env.FIREBASE_PRIVATE_KEY ||
      process.env.FIREBASE_PRIVATE_KEY.includes('MOCK_KEY');

    let uid = `mock-uid-${dto.role}-${dto.email.replace('@', '_')}`;

    if (!isMock) {
      try {
        const userRecord = await admin.auth().createUser({
          email: dto.email,
          password: dto.password,
          displayName: dto.name,
        });
        uid = userRecord.uid;
        await admin.auth().setCustomUserClaims(uid, { role: dto.role });
      } catch (err: any) {
        if (err.code === 'auth/email-already-exists') {
          const userRecord = await admin.auth().getUserByEmail(dto.email);
          uid = userRecord.uid;
          await admin.auth().setCustomUserClaims(uid, { role: dto.role });
        } else {
          throw new BadRequestException(`Firebase User bootstrap error: ${err.message}`);
        }
      }
    }

    const userRef = this.firestore.collection('users').doc(uid);
    const profile = {
      uid,
      name: dto.name,
      email: dto.email,
      phone: null,
      role: dto.role,
      createdAt: new Date().toISOString(),
      status: 'active',
    };

    await userRef.set(profile);
    return { uid, role: dto.role, email: dto.email, status: 'bootstrapped' };
  }
}
