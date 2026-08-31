import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Issue } from './issue.entity';
import { IssuesService } from './issues.service';
import { IssuesController } from './issues.controller';
import { MediaModule } from '../media/media.module';

/**
 * Depends on nothing above it in the dependency order (parameter.md §1).
 * RBAC guards and the audit service come from global `shared` modules, so this
 * module never has to import `auth`.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Issue]), MediaModule],
  controllers: [IssuesController],
  providers: [IssuesService],
  exports: [IssuesService],
})
export class IssuesModule {}
