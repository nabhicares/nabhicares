import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { FirestoreService } from '../../database/firestore.service';

@Module({
  controllers: [SettingsController],
  providers: [SettingsService, FirestoreService],
  exports: [SettingsService],
})
export class SettingsModule {}
