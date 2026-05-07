import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Response } from 'express';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

const COOKIE_NAME = 'access_token';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(email: string, password: string, name: string, res: Response) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Email already registered');

    const hashed = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({ data: { email, password: hashed, name } });

    // Auto-activate free plan
    await this.prisma.userSubscription.create({
      data: { userId: user.id, planId: 'plan_free', status: 'active' },
    });

    this.setAuthCookie(res, user);
    return this.buildUserResponse(user);
  }

  async login(email: string, password: string, res: Response) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    if (user.status !== 'active') throw new UnauthorizedException('Account suspended');

    this.setAuthCookie(res, user);
    return this.buildUserResponse(user);
  }

  async logout(res: Response) {
    res.clearCookie(COOKIE_NAME, { path: '/' });
    return { success: true };
  }

  async getProfile(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, plan: true, status: true, isAdmin: true, createdAt: true },
    });
  }

  private setAuthCookie(res: Response, user: any) {
    const token = this.jwtService.sign({
      sub:     user.id,
      email:   user.email,
      name:    user.name,
      plan:    user.plan,
      isAdmin: user.isAdmin ?? false,
    });

    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,                              // not accessible via JS
      secure:   process.env.NODE_ENV === 'production', // HTTPS only in prod
      sameSite: 'lax',
      maxAge:   COOKIE_MAX_AGE,
      path:     '/',
    });
  }

  private buildUserResponse(user: any) {
    return { id: user.id, email: user.email, name: user.name, plan: user.plan };
  }
}
