import { Module } from '@nestjs/common';
import { PurchasesController } from './purchases.controller';
import { PurchasesService } from './purchases.service';
import { FirestoreService } from '../../database/firestore.service';

@Module({
  controllers: [PurchasesController],
  providers: [PurchasesService, FirestoreService],
  exports: [PurchasesService],
})
export class PurchasesModule {}
