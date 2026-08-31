import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { TokenService } from './token.service';
import { MockOtpProvider, OTP_PROVIDER } from './providers/otp.provider';

/**
 * Sits above `users` and below every capability module (parameter.md §1).
 *
 * The RBAC guards and the JWT strategy deliberately live in `shared`, not here —
 * otherwise every module needing a guard would have to import `auth`, inverting
 * the dependency direction.
 */
@Module({
  imports: [PassportModule, UsersModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    OtpService,
    TokenService,
    // Swap for a real SMS/email provider in production; same interface (§3/§4).
    { provide: OTP_PROVIDER, useClass: MockOtpProvider },
  ],
  exports: [AuthService, TokenService],
})
export class AuthModule {}
