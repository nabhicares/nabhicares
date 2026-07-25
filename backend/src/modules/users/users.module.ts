import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { FirestoreService } from '../../database/firestore.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, FirestoreService],
  exports: [UsersService],
})
export class UsersModule {}
