import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrgUnit } from '../users/entities/org-unit.entity';
import { Project, ProjectIssue } from './project.entity';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';

/** Depends downward on `users` only (for org-unit scoping). */
@Module({
  imports: [TypeOrmModule.forFeature([Project, ProjectIssue, OrgUnit])],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
