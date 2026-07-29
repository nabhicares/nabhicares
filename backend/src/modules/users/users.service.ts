import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import * as admin from 'firebase-admin';
import { FirestoreService } from '../../database/firestore.service';
import { AssignRoleDto } from './dto/assign-role.dto';
import { CreateUserProfileDto } from './dto/create-user-profile.dto';
import { UserBootstrapDto } from './dto/user-bootstrap.dto';
import { publicUserView } from '../../common/privacy/sanitize';

@Injectable()
export class UsersService {
  constructor(private firestore: FirestoreService) {}
  async createUserProfile(uid: string, dto: CreateUserProfileDto) {
    const userRef = this.firestore.collection('users').doc(uid);
    const doc = await userRef.get();

    if (doc.exists) {
      return publicUserView(doc.data());
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
    return publicUserView(profile);
  }

  async assignRole(dto: AssignRoleDto, actor: { uid: string; role: string }) {
    if (dto.role === 'super_admin' && actor.role !== 'super_admin') {
      throw new ForbiddenException('Only a super_admin can assign the super_admin role.');
    }

    const isMock =
      !process.env.FIREBASE_PRIVATE_KEY ||
      process.env.FIREBASE_PRIVATE_KEY.includes('MOCK_KEY');

    if (!isMock) {
      try {
        await admin.auth().setCustomUserClaims(dto.uid, { role: dto.role });
      } catch {
        throw new BadRequestException('Unable to update authentication role claims.');
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
    return publicUserView(doc.data());
  }

  /**
   * Soft-delete / anonymize the caller's personal data across linked collections.
   * Passwords never live in Firestore; Firebase Auth user is deleted when configured.
   */
  async deleteMyAccount(uid: string) {
    const userRef = this.firestore.collection('users').doc(uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      throw new NotFoundException('User profile does not exist.');
    }

    const anonymizedEmail = `deleted-${uid}@anonymized.local`;
    const now = new Date().toISOString();

    await userRef.set(
      {
        uid,
        name: 'Deleted User',
        email: anonymizedEmail,
        phone: null,
        role: userDoc.data()?.role ?? 'patient',
        status: 'deleted',
        fcmToken: null,
        deletedAt: now,
        createdAt: userDoc.data()?.createdAt ?? now,
      },
      { merge: false },
    );

    const patientsSnap = await this.firestore
      .collection('patients')
      .where('uid', '==', uid)
      .get();

    const patientIds: string[] = [];
    for (const p of patientsSnap.docs) {
      patientIds.push(p.id);
      await p.ref.set(
        {
          id: p.id,
          uid,
          name: 'Deleted Patient',
          email: anonymizedEmail,
          phone: null,
          dateOfBirth: null,
          gender: null,
          allergies: [],
          medicalHistory: [],
          status: 'deleted',
          deletedAt: now,
          createdAt: p.data()?.createdAt ?? now,
        },
        { merge: false },
      );
    }

    for (const patientId of patientIds) {
      const appts = await this.firestore
        .collection('appointments')
        .where('patientId', '==', patientId)
        .get();
      for (const a of appts.docs) {
        await a.ref.update({ patientName: 'Deleted Patient' });
      }

      const invoices = await this.firestore
        .collection('invoices')
        .where('patientId', '==', patientId)
        .get();
      for (const inv of invoices.docs) {
        await inv.ref.update({ patientName: 'Deleted Patient' });
      }
    }

    const notifs = await this.firestore
      .collection('notifications')
      .where('userId', '==', uid)
      .get();
    for (const n of notifs.docs) {
      await n.ref.delete();
    }

    const isMock =
      !process.env.FIREBASE_PRIVATE_KEY ||
      process.env.FIREBASE_PRIVATE_KEY.includes('MOCK_KEY');

    if (!isMock && !uid.startsWith('mock-')) {
      try {
        await admin.auth().deleteUser(uid);
      } catch {
        // Auth user may already be gone; Firestore anonymization is the source of truth.
      }
    }

    return { status: 'deleted', anonymizedAt: now };
  }

  async bootstrapUser(dto: UserBootstrapDto, secretHeader?: string) {
    const bootstrapSecret = process.env.BOOTSTRAP_SECRET?.trim();

    // Always require a configured secret — never leave first-boot open to the internet.
    if (!bootstrapSecret || bootstrapSecret.length < 16) {
      throw new ForbiddenException(
        'Bootstrap is disabled: set a BOOTSTRAP_SECRET (min 16 characters).',
      );
    }
    if (secretHeader !== bootstrapSecret) {
      throw new ForbiddenException(
        'A valid x-bootstrap-secret header is required to bootstrap users.',
      );
    }

    const isMock =
      !process.env.FIREBASE_PRIVATE_KEY ||
      process.env.FIREBASE_PRIVATE_KEY.includes('MOCK_KEY');

    let uid = `mock-uid-${dto.role}-${dto.email.replace('@', '_')}`;

    if (!isMock) {
      try {
        // Password is handed only to Firebase Auth (scrypt). Never persisted in Firestore.
        const userRecord = await admin.auth().createUser({
          email: dto.email,
          password: dto.password,
          displayName: dto.name,
        });
        uid = userRecord.uid;
        await admin.auth().setCustomUserClaims(uid, { role: dto.role });
      } catch (err: any) {
        if (err.code === 'auth/email-already-exists') {
          // Do not silently re-privilege existing accounts via bootstrap.
          throw new BadRequestException(
            'A user with this email already exists. Use assign-role instead of bootstrap.',
          );
        } else {
          throw new BadRequestException('Unable to bootstrap user credentials.');
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
    // Never echo password back.
    return { uid, role: dto.role, email: dto.email, status: 'bootstrapped' };
  }

  /** Invalidate Firebase refresh tokens for this user (ID tokens fail verify after clock skew). */
  async logout(uid: string) {
    const isMock =
      !process.env.FIREBASE_PRIVATE_KEY ||
      process.env.FIREBASE_PRIVATE_KEY.includes('MOCK_KEY') ||
      uid.startsWith('mock-');

    if (!isMock) {
      try {
        await admin.auth().revokeRefreshTokens(uid);
      } catch {
        throw new BadRequestException('Unable to revoke session tokens.');
      }
    }
    return { status: 'logged_out', uid };
  }
}
