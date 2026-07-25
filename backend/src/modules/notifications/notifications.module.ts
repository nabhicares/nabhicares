import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { FirestoreService } from '../../database/firestore.service';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, FirestoreService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
