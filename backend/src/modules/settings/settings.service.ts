import { Injectable } from '@nestjs/common';
import { FirestoreService } from '../../database/firestore.service';
import { SystemSettingsDto } from './dto/system-settings.dto';

@Injectable()
export class SettingsService {
  constructor(private firestore: FirestoreService) {}

  async getSettings() {
    const docRef = this.firestore.collection('settings').doc('systemConfiguration');
    const doc = await docRef.get();
    if (!doc.exists) {
      return {
        hospitalName: 'General Hospital Pharma Store',
        taxPercentage: 15,
        lowStockThreshold: 20,
      };
    }
    return doc.data();
  }

  async updateSettings(dto: SystemSettingsDto) {
    const docRef = this.firestore.collection('settings').doc('systemConfiguration');
    const updatedData = {
      ...dto,
      updatedAt: new Date().toISOString(),
    };
    await docRef.set(updatedData);
    return updatedData;
  }
}
