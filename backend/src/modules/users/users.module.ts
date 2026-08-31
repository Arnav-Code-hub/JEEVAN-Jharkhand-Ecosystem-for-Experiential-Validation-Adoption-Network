import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HeiDomain } from './entities/hei-domain.entity';
import { OrgUnit } from './entities/org-unit.entity';
import { User } from './entities/user.entity';
import { HeiDomainsService } from './hei-domains.service';
import { OrgUnitsService } from './org-units.service';
import { UsersService } from './users.service';
import { OrgUnitsController, UsersAdminController } from './users.controller';

/**
 * Sits directly above `shared` in the dependency order (parameter.md §1).
 * Depends on no other domain module; `auth` depends on it.
 */
@Module({
  imports: [TypeOrmModule.forFeature([User, OrgUnit, HeiDomain])],
  controllers: [UsersAdminController, OrgUnitsController],
  providers: [UsersService, OrgUnitsService, HeiDomainsService],
  exports: [UsersService, OrgUnitsService, HeiDomainsService],
})
export class UsersModule {}
