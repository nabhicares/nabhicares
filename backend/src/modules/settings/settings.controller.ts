import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { SystemSettingsDto } from './dto/system-settings.dto';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Settings')
@Controller('settings')
@UseGuards(FirebaseAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  @Get()
  @Roles('super_admin', 'hospital_admin', 'doctor', 'pharmacist', 'receptionist', 'patient')
  @ApiOperation({ summary: 'Retrieve operational configurations' })
  get() {
    return this.settingsService.getSettings();
  }

  @Put()
  @Roles('super_admin', 'hospital_admin')
  @ApiOperation({ summary: 'Modify operational configurations' })
  update(@Body() dto: SystemSettingsDto) {
    return this.settingsService.updateSettings(dto);
  }
}
