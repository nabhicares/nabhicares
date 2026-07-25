import { Module } from '@nestjs/common';
import { PharmacyController } from './pharmacy.controller';
import { PharmacyService } from './pharmacy.service';
import { FirestoreService } from '../../database/firestore.service';

@Module({
  controllers: [PharmacyController],
  providers: [PharmacyService, FirestoreService],
  exports: [PharmacyService],
})
export class PharmacyModule {}
