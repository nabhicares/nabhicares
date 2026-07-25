import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PharmacyService } from './pharmacy.service';
import { CreateDispensationDto } from './dto/create-dispensation.dto';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Pharmacy')
@Controller('pharmacy')
@UseGuards(FirebaseAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PharmacyController {
  constructor(private pharmacyService: PharmacyService) {}

  @Post('dispense')
  @Roles('super_admin', 'hospital_admin', 'pharmacist')
  @ApiOperation({ summary: 'Process prescription medication dispensing and invoicing' })
  dispense(@Body() dto: CreateDispensationDto) {
    return this.pharmacyService.dispensePrescription(dto);
  }

  @Get('prescriptions')
  @Roles('super_admin', 'hospital_admin', 'pharmacist', 'doctor')
  @ApiOperation({ summary: 'Retrieve list of prescriptions with FEFO suggestions' })
  getPrescriptions(@Query('status') status?: string) {
    return this.pharmacyService.findPrescriptions(status);
  }
}
