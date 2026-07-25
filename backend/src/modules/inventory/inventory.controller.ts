import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { CreateMedicineDto } from './dto/create-medicine.dto';
import { UpdateMedicineDto } from './dto/update-medicine.dto';
import { AddBatchDto } from './dto/add-batch.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Inventory')
@Controller('inventory')
@UseGuards(FirebaseAuthGuard, RolesGuard)
@ApiBearerAuth()
export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  @Post('medicines')
  @Roles('super_admin', 'hospital_admin', 'pharmacist')
  @ApiOperation({ summary: 'Add a new medicine record to the catalog' })
  createMedicine(@Body() dto: CreateMedicineDto) {
    return this.inventoryService.createMedicine(dto);
  }

  @Get('medicines')
  @Roles('super_admin', 'hospital_admin', 'doctor', 'pharmacist', 'patient')
  @ApiOperation({ summary: 'Retrieve the complete medicines catalog with pagination and filters' })
  findAllMedicines(
    @Query('q') q?: string,
    @Query('category') category?: string,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.inventoryService.findAllMedicines(q, category, status, page, limit, includeInactive);
  }

  @Get('alerts')
  @Roles('super_admin', 'hospital_admin', 'pharmacist')
  @ApiOperation({ summary: 'List all inventory alert reports: low stock, out of stock, expiring soon' })
  getAlerts(@Query('withinDays') withinDays?: number) {
    return this.inventoryService.getAlerts(withinDays);
  }

  @Get('summary')
  @Roles('super_admin', 'hospital_admin', 'pharmacist')
  @ApiOperation({ summary: 'Get total dashboard summary of active inventory value and alert counts' })
  getSummary() {
    return this.inventoryService.getInventorySummary();
  }

  @Get('transactions')
  @Roles('super_admin', 'hospital_admin', 'pharmacist')
  @ApiOperation({ summary: 'Get audit logs and history of all stock movements' })
  getTransactions(
    @Query('medicineId') medicineId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('type') type?: string,
  ) {
    return this.inventoryService.findTransactions(medicineId, from, to, type);
  }

  @Get('medicines/:id/transactions')
  @Roles('super_admin', 'hospital_admin', 'pharmacist')
  @ApiOperation({ summary: 'Get audit transaction history for a specific medicine SKU' })
  getMedicineTransactions(@Param('id') id: string) {
    return this.inventoryService.findTransactions(id);
  }

  @Get('medicines/:id')
  @Roles('super_admin', 'hospital_admin', 'doctor', 'pharmacist')
  @ApiOperation({ summary: 'Retrieve specific medicine properties with batches' })
  findMedicine(@Param('id') id: string) {
    return this.inventoryService.findMedicine(id);
  }

  @Patch('medicines/:id')
  @Roles('super_admin', 'hospital_admin', 'pharmacist')
  @ApiOperation({ summary: 'Partially edit property fields or toggle active status for a medicine' })
  updateMedicine(@Param('id') id: string, @Body() dto: UpdateMedicineDto) {
    return this.inventoryService.updateMedicine(id, dto);
  }

  @Post('medicines/:id/batch')
  @Roles('super_admin', 'hospital_admin', 'pharmacist')
  @ApiOperation({ summary: 'Append a stock batch to a catalog medicine' })
  addBatch(@Param('id') id: string, @Body() dto: AddBatchDto) {
    return this.inventoryService.addBatch(id, dto);
  }

  @Get('low-stock')
  @Roles('super_admin', 'hospital_admin', 'pharmacist')
  @ApiOperation({ summary: 'List all medicines below safety threshold limits' })
  getLowStock() {
    return this.inventoryService.getLowStockMedicines();
  }

  @Get('medicines/:id/batches')
  @Roles('super_admin', 'hospital_admin', 'pharmacist', 'doctor')
  @ApiOperation({ summary: 'Retrieve all batches for a specific medicine' })
  findBatches(@Param('id') id: string) {
    return this.inventoryService.findBatches(id);
  }

  @Post('adjust')
  @Roles('super_admin', 'hospital_admin', 'pharmacist')
  @ApiOperation({ summary: 'Log audited stock overrides and corrections' })
  adjustStock(@CurrentUser() user: any, @Body() dto: AdjustStockDto) {
    return this.inventoryService.adjustStock(user.uid, dto);
  }
}
