import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { FirestoreService } from '../../database/firestore.service';
import { BookAppointmentDto } from './dto/book-appointment.dto';

@Injectable()
export class AppointmentsService {
  constructor(private firestore: FirestoreService) {}

  async bookAppointment(dto: BookAppointmentDto) {
    const { patientId, doctorId, date, timeSlot } = dto;

    return this.firestore.runTransaction(async (transaction) => {
      // 1. Validate Patient Profile
      const patientRef = this.firestore.collection('patients').doc(patientId);
      const patientDoc = await transaction.get(patientRef);
      if (!patientDoc.exists) {
        throw new NotFoundException(`Patient with ID ${patientId} does not exist.`);
      }
      const patientData = patientDoc.data()!;

      // 2. Validate Doctor Profile
      const doctorRef = this.firestore.collection('doctors').doc(doctorId);
      const doctorDoc = await transaction.get(doctorRef);
      if (!doctorDoc.exists) {
        throw new NotFoundException(`Doctor with ID ${doctorId} does not exist.`);
      }
      const doctorData = doctorDoc.data()!;

      // 3. Prevent Double Booking
      const existingQuery = this.firestore.collection('appointments')
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

      // 4. Save Appointment Document
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

  async findOne(id: string) {
    const doc = await this.firestore.collection('appointments').doc(id).get();
    if (!doc.exists) {
      throw new NotFoundException(`Appointment with ID ${id} does not exist.`);
    }
    return doc.data();
  }

  async findDoctorCalendar(doctorId: string) {
    const snapshot = await this.firestore
      .collection('appointments')
      .where('doctorId', '==', doctorId)
      .get();
    return snapshot.docs.map((doc) => doc.data());
  }

  async findPatientHistory(patientId: string) {
    const snapshot = await this.firestore
      .collection('appointments')
      .where('patientId', '==', patientId)
      .get();
    return snapshot.docs.map((doc) => doc.data());
  }

  async updateStatus(id: string, status: 'booked' | 'cancelled' | 'completed') {
    const docRef = this.firestore.collection('appointments').doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      throw new NotFoundException(`Appointment with ID ${id} does not exist.`);
    }
    await docRef.update({ status });
    return { id, ...doc.data(), status };
  }
}
