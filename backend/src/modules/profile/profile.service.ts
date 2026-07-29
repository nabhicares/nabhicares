import { Injectable } from '@nestjs/common';
import { FirestoreService } from '../../database/firestore.service';
import { UpsertProfileDto } from './dto/upsert-profile.dto';

const DEFAULT_PROFILE = {
  shopName: 'PharmaStore',
  address: '',
  phone: '',
  logoUrl: null,
  signatureText: '',
  signatureUrl: null,
  gstin: null,
};

@Injectable()
export class ProfileService {
  constructor(private firestore: FirestoreService) {}

  async getProfile(hospitalId: string) {
    const doc = await this.firestore.collection('shopProfiles').doc(hospitalId).get();
    if (!doc.exists) {
      return { hospitalId, ...DEFAULT_PROFILE };
    }
    return doc.data();
  }

  async upsertProfile(dto: UpsertProfileDto) {
    const ref = this.firestore.collection('shopProfiles').doc(dto.hospitalId);
    const existing = await ref.get();
    const prev = existing.exists ? existing.data()! : { hospitalId: dto.hospitalId, ...DEFAULT_PROFILE };
    const next = {
      ...prev,
      ...dto,
      hospitalId: dto.hospitalId,
      updatedAt: new Date().toISOString(),
    };
    await ref.set(next);
    return next;
  }
}
