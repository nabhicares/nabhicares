import { Module } from '@nestjs/common';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { ProfileModule } from '../profile/profile.module';
import { MessagingProvider, StubMessagingProvider } from '../messaging/messaging.provider';

@Module({
  imports: [ProfileModule],
  controllers: [SalesController],
  providers: [
    SalesService,
    { provide: MessagingProvider, useClass: StubMessagingProvider },
  ],
  exports: [SalesService],
})
export class SalesModule {}
