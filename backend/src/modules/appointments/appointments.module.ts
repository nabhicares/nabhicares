import { Module } from '@nestjs/common';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { FirestoreService } from '../../database/firestore.service';

@Module({
  controllers: [AppointmentsController],
  providers: [AppointmentsService, FirestoreService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
