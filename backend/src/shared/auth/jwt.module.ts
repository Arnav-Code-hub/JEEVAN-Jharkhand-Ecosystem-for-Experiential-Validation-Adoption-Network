import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

/**
 * Registers the shared JwtService used to sign access tokens and short-lived
 * TOTP-enrolment tokens.
 *
 * The secret is resolved once in `env.validation.ts` — in development an
 * ephemeral per-boot value, in production a required variable — so this module
 * simply reads it and every consumer shares the same key.
 */
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.getOrThrow<number>('JWT_ACCESS_TTL_SECONDS') },
      }),
    }),
  ],
  exports: [JwtModule],
})
export class JwtScaffoldingModule {}
