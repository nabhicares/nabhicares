import { Module } from '@nestjs/common';
import { DoctorsController } from './doctors.controller';
import { DoctorsService } from './doctors.service';
import { FirestoreService } from '../../database/firestore.service';

@Module({
  controllers: [DoctorsController],
  providers: [DoctorsService, FirestoreService],
  exports: [DoctorsService],
})
export class DoctorsModule {}
