import { Controller, Get, Patch, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProfileService } from './profile.service';
import { UpsertProfileDto } from './dto/upsert-profile.dto';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Profile')
@Controller('profile')
@UseGuards(FirebaseAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ProfileController {
  constructor(private profileService: ProfileService) {}

  @Get()
  @Roles('super_admin', 'hospital_admin', 'pharmacist')
  @ApiOperation({ summary: 'Get shop branding profile for a hospital' })
  get(@Query('hospitalId') hospitalId: string) {
    return this.profileService.getProfile(hospitalId || 'default');
  }

  @Patch()
  @Roles('super_admin', 'hospital_admin')
  @ApiOperation({ summary: 'Upsert shop logo, address, signature, branding' })
  patch(@Body() dto: UpsertProfileDto) {
    return this.profileService.upsertProfile(dto);
  }
}
