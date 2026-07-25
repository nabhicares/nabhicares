import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FirestoreService } from './firestore.service';
import { DatabaseSeeder } from './seed';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [FirestoreService, DatabaseSeeder],
  exports: [FirestoreService, DatabaseSeeder],
})
export class DatabaseModule {}
