import { Module } from '@nestjs/common';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';
import { FirestoreService } from '../../database/firestore.service';

@Module({
  controllers: [PatientsController],
  providers: [PatientsService, FirestoreService],
  exports: [PatientsService],
})
export class PatientsModule {}
