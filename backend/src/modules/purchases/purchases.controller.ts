import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PurchasesService } from './purchases.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
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
  findAllSuppliers() {
    return this.purchasesService.findAllSuppliers();
  }

  @Post('orders')
  @Roles('super_admin', 'hospital_admin', 'pharmacist')
  @ApiOperation({ summary: 'Draft and issue a medicine purchase order' })
  createOrder(@Body() dto: CreatePurchaseOrderDto) {
    return this.purchasesService.createPurchaseOrder(dto);
  }

  @Get('orders')
  @Roles('super_admin', 'hospital_admin', 'pharmacist')
  @ApiOperation({ summary: 'Retrieve list of all purchase orders' })
  getOrders() {
    return this.purchasesService.getPurchaseOrders();
  }

  @Put('orders/:id/receive')
  @Roles('super_admin', 'hospital_admin', 'pharmacist')
  @ApiOperation({ summary: 'Process incoming stock goods receipts from a purchase order' })
  receiveOrder(
    @Param('id') id: string,
    @Query('batchNo') batchNo: string,
    @Query('expiryDate') expiryDate: string,
  ) {
    return this.purchasesService.receivePurchaseOrder(id, batchNo, expiryDate);
  }
}
