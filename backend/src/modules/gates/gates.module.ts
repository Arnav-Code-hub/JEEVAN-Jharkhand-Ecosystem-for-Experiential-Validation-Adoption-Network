import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IssuesModule } from '../issues/issues.module';
import { ProjectsModule } from '../projects/projects.module';
import { GateTransition } from './gate-transition.entity';
import { GatesService } from './gates.service';
import { G1Service } from './g1.service';
import { GatesController } from './gates.controller';

/**
 * Top of the current dependency order: depends on `projects` and `issues`,
 * neither of which knows this module exists (parameter.md §1).
 */
@Module({
  imports: [TypeOrmModule.forFeature([GateTransition]), IssuesModule, ProjectsModule],
  controllers: [GatesController],
  providers: [GatesService, G1Service],
  exports: [GatesService],
})
export class GatesModule {}
