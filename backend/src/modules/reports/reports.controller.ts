import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Reports')
@Controller('reports')
@UseGuards(FirebaseAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('dashboard')
  @Roles('super_admin', 'hospital_admin')
  @ApiOperation({ summary: 'Retrieve daily/monthly analytical dashboard stats' })
  getDashboard() {
    return this.reportsService.getDashboardSummary();
  }
}
