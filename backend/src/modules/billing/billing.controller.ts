import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

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

  @Get('invoices/patient/:patientId')
  @Roles('super_admin', 'hospital_admin', 'receptionist', 'patient')
  @ApiOperation({ summary: 'Retrieve all invoices for a patient' })
  findByPatient(@Param('patientId') patientId: string, @CurrentUser() user: any) {
    return this.billingService.findByPatient(patientId, user);
  }

  @Get('invoices/:id')
  @Roles('super_admin', 'hospital_admin', 'doctor', 'receptionist', 'patient')
  @ApiOperation({ summary: 'Retrieve specific invoice properties' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.billingService.findOne(id, user);
  }

  @Post('invoices/:id/pay')
  @Roles('super_admin', 'hospital_admin', 'receptionist')
  @ApiOperation({ summary: 'Log a payment against an invoice (server validates amount)' })
  recordPayment(@Param('id') id: string, @Body() dto: RecordPaymentDto) {
    return this.billingService.recordPayment(id, dto.amount, dto.method);
  }

  @Put('invoices/:id/refund')
  @Roles('super_admin', 'hospital_admin')
  @ApiOperation({ summary: 'Refund a paid invoice' })
  refundInvoice(@Param('id') id: string, @Body('reason') reason: string) {
    return this.billingService.refundInvoice(id, reason);
  }
}
