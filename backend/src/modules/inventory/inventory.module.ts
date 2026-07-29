import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { StockController } from './stock.controller';
import { ExpiryListController } from './expiry-list.controller';
import { InventoryService } from './inventory.service';

@Module({
  controllers: [InventoryController, StockController, ExpiryListController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
