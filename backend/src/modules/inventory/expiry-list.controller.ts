import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InventoryService } from '../inventory/inventory.service';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Expiry')
@Controller('expiry-list')
@UseGuards(FirebaseAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ExpiryListController {
  constructor(private inventoryService: InventoryService) {}

  @Get()
  @Roles('super_admin', 'hospital_admin', 'pharmacist')
  @ApiOperation({ summary: 'Expiry list sorted by nearest expiry' })
  list(
    @Query('hospitalId') hospitalId: string,
    @Query('thresholdDays') thresholdDays?: number,
  ) {
    return this.inventoryService.getExpiryList(hospitalId || 'default', thresholdDays ?? 30);
  }
}
