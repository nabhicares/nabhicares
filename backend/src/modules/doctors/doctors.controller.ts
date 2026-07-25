import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DoctorsService } from './doctors.service';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { SetScheduleDto } from './dto/set-schedule.dto';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Doctors')
@Controller('doctors')
@UseGuards(FirebaseAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DoctorsController {
  constructor(private doctorsService: DoctorsService) {}

  @Post()
  @Roles('super_admin', 'hospital_admin')
  @ApiOperation({ summary: 'Create a new doctor profile' })
  create(@Body() dto: CreateDoctorDto) {
    return this.doctorsService.create(dto);
  }

  @Get()
  @Roles('super_admin', 'hospital_admin', 'doctor', 'receptionist', 'pharmacist', 'patient')
  @ApiOperation({ summary: 'Retrieve all doctor records' })
  findAll() {
    return this.doctorsService.findAll();
  }

  @Get(':id')
  @Roles('super_admin', 'hospital_admin', 'doctor', 'receptionist', 'pharmacist', 'patient')
  @ApiOperation({ summary: 'Retrieve details of a single physician' })
  findOne(@Param('id') id: string) {
    return this.doctorsService.findOne(id);
  }

  @Put(':id/schedule')
  @Roles('super_admin', 'hospital_admin', 'doctor')
  @ApiOperation({ summary: 'Register consultation availability schedules' })
  setSchedule(@Param('id') id: string, @Body() dto: SetScheduleDto) {
    return this.doctorsService.setSchedule(id, dto);
  }

  @Get(':id/slots')
  @Roles('super_admin', 'hospital_admin', 'doctor', 'receptionist', 'patient')
  @ApiOperation({ summary: 'Retrieve available slots for a given day' })
  getSlots(@Param('id') id: string, @Query('date') date: string) {
    return this.doctorsService.getAvailableSlots(id, date);
  }
}
