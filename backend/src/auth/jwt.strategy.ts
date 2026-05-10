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
   * Per-device session validation.
   *
   * The JWT carries deviceId + sessionId. We look up exactly that Device row
   * and verify the sessionId matches. This means:
   *
   * - Removing device B → its row is deleted → only device B's JWT fails.
   *   Device A, C, D are completely unaffected.
   *
   * - Logging out from device B → Device.sessionId set to "" →
   *   device B's JWT fails; all others unaffected.
   *
   * - Logging in from device B again → new sessionId → old JWT revoked,
   *   new JWT valid.
   *
   * Old JWTs without deviceId (issued before this change) are rejected and
   * require a fresh login.
   */
  async validate(payload: any) {
    if (!payload.deviceId) {
      throw new UnauthorizedException('Session expired — please log in again');
    }

    const device = await this.prisma.device.findUnique({
      where:  { id: payload.deviceId },
      select: { userId: true, sessionId: true },
    });

    if (!device || device.userId !== payload.sub) {
      throw new UnauthorizedException('Device not found — please log in again');
    }

    if (!device.sessionId || device.sessionId !== payload.sessionId) {
      throw new UnauthorizedException('Session expired — please log in again');
    }

    return {
      id:       payload.sub,
      email:    payload.email,
      name:     payload.name,
      plan:     payload.plan,
      isAdmin:  payload.isAdmin ?? false,
      deviceId: payload.deviceId,  // available via @CurrentUser()
    };
  }
}
