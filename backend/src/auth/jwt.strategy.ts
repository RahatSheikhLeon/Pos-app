import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';

// Extract JWT from HttpOnly cookie 'access_token'
const cookieExtractor = (req: Request): string | null => {
  return req?.cookies?.access_token ?? null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,                               // primary: httpOnly cookie
        ExtractJwt.fromAuthHeaderAsBearerToken(),      // fallback: Bearer header (for testing)
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'shopiq_secret_key',
    });
  }

  async validate(payload: any) {
    return {
      id:      payload.sub,
      email:   payload.email,
      name:    payload.name,
      plan:    payload.plan,
      isAdmin: payload.isAdmin ?? false,
    };
  }
}
