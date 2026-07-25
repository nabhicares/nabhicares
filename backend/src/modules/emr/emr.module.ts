import { Module } from '@nestjs/common';
import { EMRController } from './emr.controller';
import { EMRService } from './emr.service';
import { FirestoreService } from '../../database/firestore.service';

@Module({
  controllers: [EMRController],
  providers: [EMRService, FirestoreService],
  exports: [EMRService],
})
export class EMRModule {}
