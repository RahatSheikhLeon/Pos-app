import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

const cookieExtractor = (req: Request): string | null =>
  req?.cookies?.access_token ?? null;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'shopiq_secret_key',
    });
  }

  /**
   * Called on every authenticated request.
   * Validates tokenVersion against DB so device removals immediately revoke all sessions.
   * Old JWTs without tokenVersion default to 0; if DB is also 0, they still pass.
   * As soon as a device is removed (DB tokenVersion increments), all old tokens fail.
   */
  async validate(payload: any) {
    const user = await this.prisma.user.findUnique({
      where:  { id: payload.sub },
      select: { tokenVersion: true },
    });

    if (!user) throw new UnauthorizedException('Account not found');

    const jwtVersion = payload.tokenVersion ?? 0;
    if (jwtVersion !== user.tokenVersion) {
      throw new UnauthorizedException('Session revoked — please log in again');
    }

    return {
      id:      payload.sub,
      email:   payload.email,
      name:    payload.name,
      plan:    payload.plan,
      isAdmin: payload.isAdmin ?? false,
    };
  }
}
