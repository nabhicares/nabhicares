import { Injectable, NotFoundException } from '@nestjs/common';
import { FirestoreService } from '../../database/firestore.service';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { SetScheduleDto } from './dto/set-schedule.dto';

@Injectable()
export class DoctorsService {
  constructor(private firestore: FirestoreService) {}

  async create(dto: CreateDoctorDto) {
    const doctorsRef = this.firestore.collection('doctors');
    const newDocRef = doctorsRef.doc();

    const doctor = {
      id: newDocRef.id,
      name: dto.name,
      email: dto.email,
      specialty: dto.specialty,
      consultationFee: dto.consultationFee,
      qualifications: dto.qualifications || null,
      createdAt: new Date().toISOString(),
    };

    await newDocRef.set(doctor);
    return doctor;
  }

  async findOne(id: string) {
    const doc = await this.firestore.collection('doctors').doc(id).get();
    if (!doc.exists) {
      throw new NotFoundException(`Doctor with ID ${id} does not exist.`);
    }
    return doc.data();
  }

  async findAll() {
    const snapshot = await this.firestore.collection('doctors').get();
    return snapshot.docs.map((doc) => doc.data());
  }

  async setSchedule(id: string, dto: SetScheduleDto) {
    await this.findOne(id);

    const scheduleRef = this.firestore
      .collection('doctors')
      .doc(id)
      .collection('schedule')
      .doc('template');

    await scheduleRef.set({
      slotDurationMinutes: dto.slotDurationMinutes,
      weeklySchedules: dto.weeklySchedules,
      updatedAt: new Date().toISOString(),
    });

    return { doctorId: id, ...dto };
  }

  async getSchedule(id: string) {
    const doc = await this.firestore
      .collection('doctors')
      .doc(id)
      .collection('schedule')
      .doc('template')
      .get();

    if (!doc.exists) {
      return { slotDurationMinutes: 30, weeklySchedules: [] };
    }
    return doc.data();
  }

  async getAvailableSlots(id: string, date: string) {
    await this.findOne(id);

    const schedule = await this.getSchedule(id);
    const parsedDate = new Date(date);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const targetDay = dayNames[parsedDate.getDay()];

    const dayRule = schedule.weeklySchedules.find(
      (s: any) => s.dayOfWeek.toLowerCase() === targetDay.toLowerCase(),
    );
    if (!dayRule) {
      return [];
    }

    const slots: string[] = [];
    const [startH, startM] = dayRule.startTime.split(':').map(Number);
    const [endH, endM] = dayRule.endTime.split(':').map(Number);

    let current = new Date(parsedDate);
    current.setHours(startH, startM, 0, 0);

    const end = new Date(parsedDate);
    end.setHours(endH, endM, 0, 0);

    const durationMs = schedule.slotDurationMinutes * 60 * 1000;

    while (current.getTime() + durationMs <= end.getTime()) {
      const hh = String(current.getHours()).padStart(2, '0');
      const mm = String(current.getMinutes()).padStart(2, '0');
      slots.push(`${hh}:${mm}`);
      current = new Date(current.getTime() + durationMs);
    }

    // Read existing appointments to exclude booked slots
    const appointmentsSnapshot = await this.firestore
      .collection('appointments')
      .where('doctorId', '==', id)
      .where('date', '==', date)
      .get();

    const bookedSlots = appointmentsSnapshot.docs
      .map((doc) => doc.data())
      .filter((app) => app.status === 'booked' || app.status === 'completed')
      .map((app) => app.timeSlot);

    return slots.map((slot) => ({
      time: slot,
      available: !bookedSlots.includes(slot),
    }));
  }
}
