import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(FirebaseAuthGuard, RolesGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Post('push')
  @Roles('super_admin', 'hospital_admin', 'doctor', 'pharmacist')
  @ApiOperation({ summary: 'Enqueue a push notification' })
  send(@Body() dto: CreateNotificationDto) {
    return this.notificationsService.sendPushNotification(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Retrieve notifications of the current authenticated user' })
  getForCurrentUser(@CurrentUser() user: any) {
    return this.notificationsService.getNotificationsForUser(user.uid);
  }
}
