import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { FirestoreService } from '../../database/firestore.service';

@Module({
  controllers: [InventoryController],
  providers: [InventoryService, FirestoreService],
  exports: [InventoryService],
})
export class InventoryModule {}
