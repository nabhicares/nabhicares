import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FirestoreService } from './firestore.service';
import { DatabaseSeeder } from './seed';

@Module({
  imports: [ConfigModule],
  providers: [FirestoreService, DatabaseSeeder],
  exports: [FirestoreService, DatabaseSeeder],
})
export class DatabaseModule {}
