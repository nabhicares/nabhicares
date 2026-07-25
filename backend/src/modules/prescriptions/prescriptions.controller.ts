import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PrescriptionsService } from './prescriptions.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Prescriptions')
@Controller('prescriptions')
@UseGuards(FirebaseAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PrescriptionsController {
  constructor(private prescriptionsService: PrescriptionsService) {}

  @Post()
  @Roles('super_admin', 'doctor')
  @ApiOperation({ summary: 'Issue a new medicine prescription' })
  create(@CurrentUser() user: any, @Body() dto: CreatePrescriptionDto) {
    return this.prescriptionsService.create(user.uid, dto);
  }

  @Get('pending')
  @Roles('super_admin', 'hospital_admin', 'pharmacist')
  @ApiOperation({ summary: 'Retrieve active dispensing queue for pharmacy' })
  findPending() {
    return this.prescriptionsService.findPending();
  }

  // Static segment before :id so Nest does not treat "patient" as an id.
  @Get('patient/:patientId')
  @Roles('super_admin', 'hospital_admin', 'doctor', 'pharmacist', 'patient')
  @ApiOperation({ summary: 'Retrieve historical prescriptions of a patient' })
  findPatientPrescriptions(@Param('patientId') patientId: string) {
    return this.prescriptionsService.findPatientPrescriptions(patientId);
  }

  @Get(':id')
  @Roles('super_admin', 'hospital_admin', 'doctor', 'pharmacist', 'patient')
  @ApiOperation({ summary: 'Retrieve detailed prescription outline' })
  findOne(@Param('id') id: string) {
    return this.prescriptionsService.findOne(id);
  }

  @Put(':id/dispense/:itemIndex')
  @Roles('super_admin', 'hospital_admin', 'pharmacist')
  @ApiOperation({ summary: 'Dispense a specific medication item index' })
  dispenseItem(@Param('id') id: string, @Param('itemIndex') itemIndex: string) {
    return this.prescriptionsService.dispenseItem(id, parseInt(itemIndex, 10));
  }
}
