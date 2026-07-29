import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EMRService } from './emr.service';
import { CreateConsultationDto } from './dto/create-consultation.dto';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('EMR')
@Controller('emr')
@UseGuards(FirebaseAuthGuard, RolesGuard)
@ApiBearerAuth()
export class EMRController {
  constructor(private emrService: EMRService) {}

  @Post('consultations')
  @Roles('super_admin', 'doctor')
  @ApiOperation({ summary: 'Log clinical consultation vitals and diagnoses' })
  create(@CurrentUser() user: any, @Body() dto: CreateConsultationDto) {
    return this.emrService.createConsultation(user.uid, dto);
  }

  @Get('consultations/:id')
  @Roles('super_admin', 'hospital_admin', 'doctor', 'receptionist')
  @ApiOperation({ summary: 'Retrieve specific consultation record details' })
  findOne(@Param('id') id: string) {
    return this.emrService.findOne(id);
  }

  @Get('patient/:patientId')
  @Roles('super_admin', 'hospital_admin', 'doctor', 'patient')
  @ApiOperation({ summary: 'Retrieve complete EMR history for a patient' })
  findPatientEMR(@Param('patientId') patientId: string, @CurrentUser() user: any) {
    return this.emrService.findPatientEMR(patientId, user);
  }
}
