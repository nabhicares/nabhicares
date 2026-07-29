import { Injectable, NotFoundException } from '@nestjs/common';
import { FirestoreService } from '../../database/firestore.service';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { SetScheduleDto } from './dto/set-schedule.dto';
import { doctorViewForRole, staffDoctorView } from '../../common/privacy/sanitize';
import { assertDoctorResourceAccess } from '../../common/privacy/doctor-access';
import { AuthUser } from '../../common/privacy/patient-access';

@Injectable()
export class DoctorsService {
  constructor(private firestore: FirestoreService) {}

  async create(dto: CreateDoctorDto) {
    const doctorsRef = this.firestore.collection('doctors');
    const newDocRef = doctorsRef.doc();

    const doctor = {
      id: newDocRef.id,
      name: dto.name,
      email: dto.email || '',
      specialty: dto.specialty || dto.specialization || '',
      specialization: dto.specialization || dto.specialty || '',
      consultationFee: dto.consultationFee ?? 0,
      qualifications: dto.qualifications || null,
      hospitalId: dto.hospitalId || 'default',
      phone: dto.phone || null,
      commissionRate: dto.commissionRate ?? 0,
      creditBalance: 0,
      createdAt: new Date().toISOString(),
    };

    await newDocRef.set(doctor);
    return staffDoctorView(doctor);
  }

  async findOne(id: string, role = 'hospital_admin') {
    const doc = await this.firestore.collection('doctors').doc(id).get();
    if (!doc.exists) {
      throw new NotFoundException(`Doctor with ID ${id} does not exist.`);
    }
    return doctorViewForRole(doc.data(), role);
  }

  /** Internal raw read for schedule/slots — not returned to clients directly. */
  private async findOneRaw(id: string) {
    const doc = await this.firestore.collection('doctors').doc(id).get();
    if (!doc.exists) {
      throw new NotFoundException(`Doctor with ID ${id} does not exist.`);
    }
    return doc.data()!;
  }

  async findAll(
    role = 'hospital_admin',
    hospitalId?: string,
    page?: number,
    limit?: number,
  ) {
    const snapshot = await this.firestore.collection('doctors').get();
    let list = snapshot.docs.map((doc) => doctorViewForRole(doc.data(), role));
    if (hospitalId) {
      list = list.filter((d: any) => !d.hospitalId || d.hospitalId === hospitalId);
    }

    // Paginate when page/limit requested; otherwise keep legacy array for CareFlow clients.
    if (page == null && limit == null) {
      return list;
    }

    const pageNum = Number(page) > 0 ? Number(page) : 1;
    const limitNum = Number(limit) > 0 ? Number(limit) : 20;
    const start = (pageNum - 1) * limitNum;
    return {
      items: list.slice(start, start + limitNum),
      meta: {
        totalCount: list.length,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(list.length / limitNum),
      },
    };
  }

  async getCredits(doctorId: string, hospitalId?: string) {
    await this.findOneRaw(doctorId);
    const snap = await this.firestore.collection('creditLedger').get();
    let list = snap.docs
      .map((d) => d.data())
      .filter((e: any) => e.doctorId === doctorId);
    if (hospitalId) {
      list = list.filter((e: any) => e.hospitalId === hospitalId);
    }
    list.sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    const openBalance = list
      .filter((e: any) => e.status === 'open')
      .reduce((s: number, e: any) => s + Number(e.balance || e.amount || 0), 0);
    return { doctorId, openBalance, entries: list };
  }

  async setSchedule(id: string, dto: SetScheduleDto, user: AuthUser) {
    await assertDoctorResourceAccess(this.firestore, id, user);

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
    await this.findOneRaw(id);

    const doc = await this.firestore
      .collection('doctors')
      .doc(id)
      .collection('schedule')
      .doc('template')
      .get();

    if (doc.exists) {
      return doc.data();
    }

    // Fall back to legacy weeklySchedule map seeded on the doctor document.
    const doctor = await this.findOneRaw(id);
    const legacy = doctor?.weeklySchedule as Record<string, string[]> | undefined;
    if (legacy && typeof legacy === 'object') {
      const weeklySchedules: Array<{ dayOfWeek: string; startTime: string; endTime: string }> = [];
      for (const [day, ranges] of Object.entries(legacy)) {
        for (const range of ranges || []) {
          const [startTime, endTime] = range.split('-');
          if (startTime && endTime) {
            weeklySchedules.push({ dayOfWeek: day, startTime, endTime });
          }
        }
      }
      return { slotDurationMinutes: 30, weeklySchedules };
    }

    return { slotDurationMinutes: 30, weeklySchedules: [] };
  }

  async getAvailableSlots(id: string, date: string) {
    await this.findOneRaw(id);

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
