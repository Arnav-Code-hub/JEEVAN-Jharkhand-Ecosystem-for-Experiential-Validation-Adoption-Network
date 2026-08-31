import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedUser } from './rbac.decorators';
import { Role } from './role.enum';

/** Claims carried by an access token. Deliberately free of PII (parameter.md §2). */
export interface AccessTokenPayload {
  sub: string;
  role: Role;
  org: string | null;
  typ: 'access';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /**
   * Runs only after the signature and expiry have been verified. No database
   * lookup here — that would put a query on every authenticated request. The
   * cost is that a role change takes effect on the next token refresh rather
   * than instantly; revocation of a whole session is handled by refresh-token
   * invalidation (ADR-0004).
   */
  validate(payload: AccessTokenPayload): AuthenticatedUser {
    if (payload.typ !== 'access') {
      // A refresh token must never be accepted as a bearer credential.
      throw new UnauthorizedException('Invalid token type');
    }

    return {
      userId: payload.sub,
      role: payload.role,
      orgUnitId: payload.org,
    };
  }
}
