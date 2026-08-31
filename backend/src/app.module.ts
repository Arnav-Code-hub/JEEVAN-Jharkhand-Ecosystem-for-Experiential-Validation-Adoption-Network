import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { validateEnv } from './shared/config/env.validation';
import { buildLoggerOptions } from './shared/logging/logger.options';
import { AllExceptionsFilter } from './shared/filters/all-exceptions.filter';
import { JwtScaffoldingModule } from './shared/auth/jwt.module';
import { HealthModule } from './shared/health/health.module';
import { RedisModule } from './shared/redis/redis.module';
import { AuditModule } from './shared/audit/audit.module';
import { RbacModule } from './shared/rbac/rbac.module';
import { JwtAuthGuard } from './shared/rbac/guards';
import { MIGRATIONS_GLOB } from './db/data-source';

import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { MediaModule } from './modules/media/media.module';
import { IssuesModule } from './modules/issues/issues.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { GatesModule } from './modules/gates/gates.module';

@Module({
  imports: [
    // Validated once at boot; nothing else may read process.env directly.
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv, cache: true }),

    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        buildLoggerOptions({
          isProduction: config.getOrThrow<string>('NODE_ENV') === 'production',
          level: config.getOrThrow<string>('LOG_LEVEL'),
        }),
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): TypeOrmModuleOptions => ({
        type: 'postgres',
        host: config.getOrThrow<string>('DB_HOST'),
        port: config.getOrThrow<number>('DB_PORT'),
        username: config.getOrThrow<string>('DB_USERNAME'),
        password: config.getOrThrow<string>('DB_PASSWORD'),
        database: config.getOrThrow<string>('DB_NAME'),
        autoLoadEntities: true,
        migrations: MIGRATIONS_GLOB,
        // Schema is owned by migrations. See src/db/data-source.ts.
        synchronize: false,
        migrationsRun: false,
        // Bounded so an unreachable database fails the boot in ~10s rather than
        // hanging for 30s+ with no output.
        retryAttempts: 5,
        retryDelay: 2000,
      }),
    }),

    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.getOrThrow<number>('THROTTLE_TTL_SECONDS') * 1000,
          limit: config.getOrThrow<number>('THROTTLE_LIMIT'),
        },
      ],
    }),

    // Cross-cutting infrastructure.
    RedisModule,
    JwtScaffoldingModule,
    RbacModule,
    AuditModule,
    HealthModule,

    // Domain modules, listed bottom-up in dependency order (parameter.md §1).
    UsersModule,
    AuthModule,
    MediaModule,
    IssuesModule,
    ProjectsModule,
    GatesModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // Authentication is on by default; routes opt out with @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
