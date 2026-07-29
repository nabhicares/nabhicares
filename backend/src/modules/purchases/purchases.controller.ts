import { Controller, Get, Post, Put, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PurchasesService } from './purchases.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Purchases')
@Controller('purchases')
@UseGuards(FirebaseAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PurchasesController {
  constructor(private purchasesService: PurchasesService) {}

  @Post('suppliers')
  @Roles('super_admin', 'hospital_admin', 'pharmacist')
  @ApiOperation({ summary: 'Add a new supplier profile' })
  createSupplier(@Body() dto: CreateSupplierDto) {
    return this.purchasesService.createSupplier(dto);
  }

  @Get('suppliers')
  @Roles('super_admin', 'hospital_admin', 'pharmacist')
  @ApiOperation({ summary: 'Retrieve list of all active suppliers' })
  findAllSuppliers(
    @Query('includeInactive') includeInactive?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.purchasesService.findAllSuppliers(includeInactive, page, limit);
  }

  @Get('suppliers/:id')
  @Roles('super_admin', 'hospital_admin', 'pharmacist')
  @ApiOperation({ summary: 'Retrieve details for a specific supplier profile' })
  findSupplier(@Param('id') id: string) {
    return this.purchasesService.findSupplier(id);
  }

  @Patch('suppliers/:id')
  @Roles('super_admin', 'hospital_admin', 'pharmacist')
  @ApiOperation({ summary: 'Partially edit fields on a supplier profile' })
  updateSupplier(@Param('id') id: string, @Body() dto: UpdateSupplierDto) {
    return this.purchasesService.updateSupplier(id, dto);
  }

  @Post('orders')
  @Roles('super_admin', 'hospital_admin', 'pharmacist')
  @ApiOperation({ summary: 'Draft and issue a medicine purchase order' })
  createOrder(@Body() dto: CreatePurchaseOrderDto) {
    return this.purchasesService.createPurchaseOrder(dto);
  }

  /** Alias: POST /purchases — same create-order /info step. */
  @Post()
  @Roles('super_admin', 'hospital_admin', 'pharmacist')
  @ApiOperation({ summary: 'Create purchase order (supplier + items)' })
  createPurchase(@Body() dto: CreatePurchaseOrderDto) {
    return this.purchasesService.createPurchaseOrder(dto);
  }

  @Get('history')
  @Roles('super_admin', 'hospital_admin', 'pharmacist')
  @ApiOperation({ summary: 'Full purchase history list' })
  getHistory(
    @Query('hospitalId') hospitalId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.purchasesService.getPurchaseHistory(hospitalId, page, limit);
  }

  @Get('orders')
  @Roles('super_admin', 'hospital_admin', 'pharmacist')
  @ApiOperation({ summary: 'Retrieve list of all purchase orders' })
  getOrders(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('hospitalId') hospitalId?: string,
  ) {
    return this.purchasesService.getPurchaseOrders(page, limit, hospitalId);
  }

  @Get('orders/:id')
  @Roles('super_admin', 'hospital_admin', 'pharmacist')
  @ApiOperation({ summary: 'Retrieve specific purchase order details and line status' })
  getOrder(@Param('id') id: string) {
    return this.purchasesService.findPurchaseOrder(id);
  }

  @Patch('orders/:id/cancel')
  @Roles('super_admin', 'hospital_admin', 'pharmacist')
  @ApiOperation({ summary: 'Deactivate / Cancel an active purchase order' })
  cancelOrder(@Param('id') id: string) {
    return this.purchasesService.cancelPurchaseOrder(id);
  }

  @Put('orders/:id/receive')
  @Roles('super_admin', 'hospital_admin', 'pharmacist')
  @ApiOperation({ summary: 'Process incoming stock goods receipts from a purchase order' })
  receiveOrder(
    @Param('id') id: string,
    @Body() dto: ReceivePurchaseOrderDto,
  ) {
    return this.purchasesService.receivePurchaseOrder(id, dto);
  }
}
