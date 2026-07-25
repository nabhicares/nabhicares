import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { FirestoreService } from '../../database/firestore.service';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, FirestoreService],
  exports: [ReportsService],
})
export class ReportsModule {}
