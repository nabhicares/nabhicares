import { Injectable, ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { FirestoreService } from '../../database/firestore.service';
import { BookAppointmentDto } from './dto/book-appointment.dto';
import { assertPatientRecordAccess, AuthUser } from '../../common/privacy/patient-access';
import { assertDoctorResourceAccess } from '../../common/privacy/doctor-access';

@Injectable()
export class AppointmentsService {
  constructor(private firestore: FirestoreService) {}

  async bookAppointment(dto: BookAppointmentDto, user?: AuthUser) {
    const { patientId, doctorId, date, timeSlot } = dto;

    if (user?.role === 'patient') {
      await assertPatientRecordAccess(this.firestore, patientId, user);
    }

    return this.firestore.runTransaction(async (transaction) => {
      const patientRef = this.firestore.collection('patients').doc(patientId);
      const patientDoc = await transaction.get(patientRef);
      if (!patientDoc.exists) {
        throw new NotFoundException(`Patient with ID ${patientId} does not exist.`);
      }
      const patientData = patientDoc.data()!;

      const doctorRef = this.firestore.collection('doctors').doc(doctorId);
      const doctorDoc = await transaction.get(doctorRef);
      if (!doctorDoc.exists) {
        throw new NotFoundException(`Doctor with ID ${doctorId} does not exist.`);
      }
      const doctorData = doctorDoc.data()!;

      const existingQuery = this.firestore
        .collection('appointments')
        .where('doctorId', '==', doctorId)
        .where('date', '==', date)
        .where('timeSlot', '==', timeSlot)
        .where('status', '==', 'booked');

      const existingDocs = await transaction.get(existingQuery);
      if (!existingDocs.empty) {
        throw new ConflictException(
          `The selected slot ${timeSlot} on ${date} is already booked for Doctor ${doctorData.name}.`,
        );
      }

      const appointmentRef = this.firestore.collection('appointments').doc();
      const appointment = {
        id: appointmentRef.id,
        patientId,
        patientName: patientData.name,
        doctorId,
        doctorName: doctorData.name,
        date,
        timeSlot,
        status: 'booked',
        createdAt: new Date().toISOString(),
      };

      transaction.set(appointmentRef, appointment);
      return appointment;
    });
  }

  async findOne(id: string, user?: AuthUser) {
    const doc = await this.firestore.collection('appointments').doc(id).get();
    if (!doc.exists) {
      throw new NotFoundException(`Appointment with ID ${id} does not exist.`);
    }
    const data = doc.data()!;
    if (user?.role === 'patient') {
      await assertPatientRecordAccess(this.firestore, data.patientId, user);
    }
    if (user?.role === 'doctor') {
      await assertDoctorResourceAccess(this.firestore, data.doctorId, user);
    }
    return data;
  }

  async findDoctorCalendar(doctorId: string, user?: AuthUser) {
    if (user?.role === 'doctor') {
      await assertDoctorResourceAccess(this.firestore, doctorId, user);
    }
    const snapshot = await this.firestore
      .collection('appointments')
      .where('doctorId', '==', doctorId)
      .get();
    return snapshot.docs.map((doc) => doc.data());
  }

  async findPatientHistory(patientId: string, user?: AuthUser) {
    if (user) {
      await assertPatientRecordAccess(this.firestore, patientId, user);
    }
    const snapshot = await this.firestore
      .collection('appointments')
      .where('patientId', '==', patientId)
      .get();
    return snapshot.docs.map((doc) => doc.data());
  }

  async updateStatus(id: string, status: 'booked' | 'cancelled' | 'completed', user?: AuthUser) {
    const docRef = this.firestore.collection('appointments').doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      throw new NotFoundException(`Appointment with ID ${id} does not exist.`);
    }
    const data = doc.data()!;
    if (user?.role === 'patient') {
      if (status !== 'cancelled') {
        throw new ForbiddenException('Patients may only cancel their appointments.');
      }
      await assertPatientRecordAccess(this.firestore, data.patientId, user);
    }
    if (user?.role === 'doctor') {
      if (status !== 'completed' && status !== 'cancelled') {
        throw new ForbiddenException('Doctors may only complete or cancel their appointments.');
      }
      await assertDoctorResourceAccess(this.firestore, data.doctorId, user);
    }
    await docRef.update({ status });
    return { id, ...data, status };
  }
}
