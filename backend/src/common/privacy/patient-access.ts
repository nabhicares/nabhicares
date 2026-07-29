import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { FirestoreService } from '../../database/firestore.service';

export type AuthUser = { uid: string; role: string };

/**
 * Patients may only access records linked to their own auth uid.
 * Staff roles are unrestricted by this helper (route Roles still apply).
 */
export async function assertPatientRecordAccess(
  firestore: FirestoreService,
  patientId: string,
  user: AuthUser,
): Promise<Record<string, any>> {
  const doc = await firestore.collection('patients').doc(patientId).get();
  if (!doc.exists) {
    throw new NotFoundException(`Patient with ID ${patientId} does not exist.`);
  }
  const data = doc.data()!;
  if (user.role === 'patient' && data.uid !== user.uid) {
    throw new ForbiddenException('You can only access your own patient record.');
  }
  return data;
}
