import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { ManualStockAddDto } from './dto/manual-stock-add.dto';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Stock')
@Controller('stock')
@UseGuards(FirebaseAuthGuard, RolesGuard)
@ApiBearerAuth()
export class StockController {
  constructor(private inventoryService: InventoryService) {}

  @Post('add')
  @Roles('super_admin', 'hospital_admin', 'pharmacist')
  @ApiOperation({ summary: 'Manual stock addition (transactional batch upsert + audit tx)' })
  add(@Body() dto: ManualStockAddDto) {
    return this.inventoryService.manualAddStock(dto);
  }

  @Get('batches/:batchNo')
  @Roles('super_admin', 'hospital_admin', 'pharmacist')
  @ApiOperation({ summary: 'Batch lookup aggregated from stockTransactions + purchases' })
  getBatch(
    @Param('batchNo') batchNo: string,
    @Query('hospitalId') hospitalId?: string,
  ) {
    return this.inventoryService.getBatchByNo(batchNo, hospitalId);
  }
}
