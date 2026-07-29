import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AppointmentsService } from './appointments.service';
import { BookAppointmentDto } from './dto/book-appointment.dto';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Appointments')
@Controller('appointments')
@UseGuards(FirebaseAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AppointmentsController {
  constructor(private appointmentsService: AppointmentsService) {}

  @Post()
  @Roles('super_admin', 'hospital_admin', 'receptionist', 'patient')
  @ApiOperation({ summary: 'Reserve a doctor appointment slot' })
  book(@CurrentUser() user: any, @Body() dto: BookAppointmentDto) {
    return this.appointmentsService.bookAppointment(dto, user);
  }

  // Static path segments MUST be registered before :id or Nest shadows them.
  @Get('doctor/:doctorId')
  @Roles('super_admin', 'hospital_admin', 'doctor', 'receptionist')
  @ApiOperation({ summary: 'Retrieve daily/weekly scheduled lists for a doctor' })
  findDoctorCalendar(@Param('doctorId') doctorId: string, @CurrentUser() user: any) {
    return this.appointmentsService.findDoctorCalendar(doctorId, user);
  }

  @Get('patient/:patientId')
  @Roles('super_admin', 'hospital_admin', 'doctor', 'receptionist', 'patient')
  @ApiOperation({ summary: 'Retrieve history logs for a patient' })
  findPatientHistory(@Param('patientId') patientId: string, @CurrentUser() user: any) {
    return this.appointmentsService.findPatientHistory(patientId, user);
  }

  @Get(':id')
  @Roles('super_admin', 'hospital_admin', 'doctor', 'receptionist', 'patient')
  @ApiOperation({ summary: 'Retrieve appointment profile information' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.appointmentsService.findOne(id, user);
  }

  @Put(':id/cancel')
  @Roles('super_admin', 'hospital_admin', 'receptionist', 'patient')
  @ApiOperation({ summary: 'Cancel booking status' })
  cancel(@Param('id') id: string, @CurrentUser() user: any) {
    return this.appointmentsService.updateStatus(id, 'cancelled', user);
  }

  @Put(':id/complete')
  @Roles('super_admin', 'hospital_admin', 'doctor')
  @ApiOperation({ summary: 'Toggle booking to completed consultation status' })
  complete(@Param('id') id: string, @CurrentUser() user: any) {
    return this.appointmentsService.updateStatus(id, 'completed', user);
  }
}
