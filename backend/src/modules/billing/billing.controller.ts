import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Billing')
@Controller('billing')
@UseGuards(FirebaseAuthGuard, RolesGuard)
@ApiBearerAuth()
export class BillingController {
  constructor(private billingService: BillingService) {}

  @Post('invoices')
  @Roles('super_admin', 'hospital_admin', 'receptionist')
  @ApiOperation({ summary: 'Generate a new billing invoice' })
  createInvoice(@Body() dto: CreateInvoiceDto) {
    return this.billingService.createInvoice(dto);
  }

  @Get('invoices/:id')
  @Roles('super_admin', 'hospital_admin', 'doctor', 'receptionist', 'patient')
  @ApiOperation({ summary: 'Retrieve specific invoice properties' })
  findOne(@Param('id') id: string) {
    return this.billingService.findOne(id);
  }

  @Post('invoices/:id/pay')
  @Roles('super_admin', 'hospital_admin', 'receptionist')
  @ApiOperation({ summary: 'Log a payment against an invoice' })
  recordPayment(
    @Param('id') id: string,
    @Query('amount') amount: string,
    @Query('method') method: string,
  ) {
    return this.billingService.recordPayment(id, parseFloat(amount), method);
  }

  @Put('invoices/:id/refund')
  @Roles('super_admin', 'hospital_admin')
  @ApiOperation({ summary: 'Refund a paid invoice' })
  refundInvoice(@Param('id') id: string, @Query('reason') reason: string) {
    return this.billingService.refundInvoice(id, reason);
  }
}
