import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { FirestoreService } from '../../database/firestore.service';

@Module({
  controllers: [BillingController],
  providers: [BillingService, FirestoreService],
  exports: [BillingService],
})
export class BillingModule {}
