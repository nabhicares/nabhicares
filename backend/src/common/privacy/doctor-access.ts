import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { FirestoreService } from '../../database/firestore.service';
import { AuthUser } from './patient-access';

/**
 * Doctors may only mutate resources linked to their own doctor profile uid,
 * unless they are hospital/super admins.
 */
export async function assertDoctorResourceAccess(
  firestore: FirestoreService,
  doctorId: string,
  user: AuthUser,
): Promise<Record<string, any>> {
  const doc = await firestore.collection('doctors').doc(doctorId).get();
  if (!doc.exists) {
    throw new NotFoundException(`Doctor with ID ${doctorId} does not exist.`);
  }
  const data = doc.data()!;
  if (user.role === 'doctor' && data.uid && data.uid !== user.uid) {
    throw new ForbiddenException('You can only access your own doctor resources.');
  }
  // Doctor role with no uid link on the profile: deny mutating other doctors by id.
  if (user.role === 'doctor' && !data.uid) {
    throw new ForbiddenException('Doctor profile is not linked to your account.');
  }
  return data;
}

/** When completing an appointment, ensure the doctor owns it (or is admin). */
export function assertAppointmentDoctorAccess(
  appointment: Record<string, any>,
  doctorProfileId: string | null,
  user: AuthUser,
): void {
  if (user.role !== 'doctor') return;
  if (!doctorProfileId || appointment.doctorId !== doctorProfileId) {
    throw new ForbiddenException('You can only complete your own appointments.');
  }
}
