import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { S3StorageProvider, STORAGE_PROVIDER } from '../../shared/storage/storage.provider';
import { Media } from './media.entity';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';

/**
 * Sits alongside `issues` in the dependency order: it knows nothing about
 * issues or projects, it only records which id a file is attached to.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Media])],
  controllers: [MediaController],
  providers: [MediaService, { provide: STORAGE_PROVIDER, useClass: S3StorageProvider }],
  exports: [MediaService],
})
export class MediaModule {}
