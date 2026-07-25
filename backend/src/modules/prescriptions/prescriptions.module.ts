import { Module } from '@nestjs/common';
import { PrescriptionsController } from './prescriptions.controller';
import { PrescriptionsService } from './prescriptions.service';
import { FirestoreService } from '../../database/firestore.service';

@Module({
  controllers: [PrescriptionsController],
  providers: [PrescriptionsService, FirestoreService],
  exports: [PrescriptionsService],
})
export class PrescriptionsModule {}
