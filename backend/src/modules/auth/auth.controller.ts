import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Audit } from '../../shared/audit/audit.interceptor';
import { AuthenticatedUser, CurrentUser, Public } from '../../shared/rbac/rbac.decorators';
import { AuthService } from './auth.service';
import { ConfirmTotpDto, RefreshTokenDto, RequestOtpDto, VerifyOtpDto } from './auth.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * Tightly throttled: without this, the endpoint is an SMS-cost amplifier and a
   * denial-of-wallet vector the moment a real provider is attached. The
   * per-identifier cooldown in OtpService is the second layer.
   */
  @Post('otp/request')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Request a one-time code by phone or email' })
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.auth.requestOtp(dto.identifier);
  }

  @Post('otp/verify')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Verify a one-time code and start a session' })
  // No identifier in the audit metadata — it is PII (parameter.md §8).
  @Audit({
    action: 'auth.otp.verify',
    resourceType: 'user',
    fromResult: (result) => {
      const r = result as { status: string; user?: { id: string } };
      return { resourceId: r.user?.id, metadata: { outcome: r.status } };
    },
  })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(dto.identifier, dto.otp, dto.totp);
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange a refresh token for a new token pair' })
  @Audit({ action: 'auth.refresh' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke the session behind a refresh token' })
  @Audit({ action: 'auth.logout' })
  async logout(@Body() dto: RefreshTokenDto) {
    await this.auth.logout(dto.refreshToken);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'The authenticated principal' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.currentUser(user.userId);
  }

  /**
   * Public because an elevated account cannot hold a session until enrolment
   * completes. Authorisation comes from the short-lived enrolment token issued
   * by otp/verify, which was itself gated by a successful OTP.
   */
  @Post('totp/confirm')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Complete TOTP enrolment and receive the first session' })
  @Audit({
    action: 'auth.totp.enable',
    resourceType: 'user',
    fromResult: (result) => ({ resourceId: (result as { user: { id: string } }).user.id }),
  })
  confirmTotp(@Body() dto: ConfirmTotpDto) {
    return this.auth.confirmTotp(dto.enrolmentToken, dto.code);
  }
}
