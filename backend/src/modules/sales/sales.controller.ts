import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';
import { SendSaleInvoiceDto } from './dto/send-invoice.dto';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Sales')
@Controller()
@UseGuards(FirebaseAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SalesController {
  constructor(private salesService: SalesService) {}

  @Post('sales')
  @Roles('super_admin', 'hospital_admin', 'pharmacist')
  @ApiOperation({ summary: 'Create a retail sale (transactional stock + payment)' })
  createSale(@Body() dto: CreateSaleDto, @CurrentUser() user: any) {
    return this.salesService.createSale(dto, user?.uid);
  }

  @Get('sales')
  @Roles('super_admin', 'hospital_admin', 'pharmacist')
  @ApiOperation({ summary: 'List sales with filters' })
  listSales(
    @Query('hospitalId') hospitalId: string,
    @Query('customerId') customerId?: string,
    @Query('paymentMethod') paymentMethod?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.salesService.listSales({
      hospitalId: hospitalId || 'default',
      customerId,
      paymentMethod,
      from,
      to,
      page,
      limit,
    });
  }

  @Post('sales/:id/invoice')
  @Roles('super_admin', 'hospital_admin', 'pharmacist')
  @ApiOperation({ summary: 'Generate PDF invoice (stub) using shop profile' })
  invoice(
    @Param('id') id: string,
    @Query('hospitalId') hospitalId: string,
  ) {
    return this.salesService.generateInvoicePdf(id, hospitalId || 'default');
  }

  @Post('sales/:id/send')
  @Roles('super_admin', 'hospital_admin', 'pharmacist')
  @ApiOperation({ summary: 'Send invoice via SMS and/or WhatsApp (stub provider)' })
  send(
    @Param('id') id: string,
    @Query('hospitalId') hospitalId: string,
    @Body() dto: SendSaleInvoiceDto,
  ) {
    return this.salesService.sendInvoice(
      id,
      hospitalId || 'default',
      dto.channels || 'both',
      dto.phone,
    );
  }

  @Get('customers')
  @Roles('super_admin', 'hospital_admin', 'pharmacist')
  @ApiOperation({ summary: 'List customers for a hospital' })
  listCustomers(
    @Query('hospitalId') hospitalId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.salesService.listCustomers(hospitalId || 'default', page, limit);
  }

  @Post('customers')
  @Roles('super_admin', 'hospital_admin', 'pharmacist')
  @ApiOperation({ summary: 'Create a customer' })
  createCustomer(@Body() dto: CreateCustomerDto) {
    return this.salesService.createCustomer(dto);
  }

  @Patch('customers/:id')
  @Roles('super_admin', 'hospital_admin', 'pharmacist')
  @ApiOperation({ summary: 'Update a customer' })
  updateCustomer(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
    @Query('hospitalId') hospitalId?: string,
  ) {
    return this.salesService.updateCustomer(id, dto, hospitalId);
  }
}
