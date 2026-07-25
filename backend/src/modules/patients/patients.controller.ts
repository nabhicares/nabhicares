import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Patients')
@Controller('patients')
@UseGuards(FirebaseAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PatientsController {
  constructor(private patientsService: PatientsService) {}

  @Post()
  @Roles('super_admin', 'hospital_admin', 'receptionist')
  @ApiOperation({ summary: 'Register a new patient record' })
  create(@Body() dto: CreatePatientDto) {
    return this.patientsService.create(dto);
  }

  @Get()
  @Roles('super_admin', 'hospital_admin', 'doctor', 'receptionist', 'pharmacist')
  @ApiOperation({ summary: 'Retrieve all patients' })
  findAll() {
    return this.patientsService.findAll();
  }

  @Get(':id')
  @Roles('super_admin', 'hospital_admin', 'doctor', 'receptionist', 'pharmacist', 'patient')
  @ApiOperation({ summary: 'Retrieve detailed patient medical outline' })
  findOne(@Param('id') id: string) {
    return this.patientsService.findOne(id);
  }

  @Put(':id')
  @Roles('super_admin', 'hospital_admin', 'receptionist')
  @ApiOperation({ summary: 'Modify patient details' })
  update(@Param('id') id: string, @Body() dto: Partial<CreatePatientDto>) {
    return this.patientsService.update(id, dto);
  }
}
