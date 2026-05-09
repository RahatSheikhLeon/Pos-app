import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Response } from 'express';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { DevicesService } from '../devices/devices.service';

const COOKIE_NAME = 'access_token';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma:         PrismaService,
    private readonly jwtService:     JwtService,
    private readonly devicesService: DevicesService,
  ) {}

  async register(
    email:       string,
    password:    string,
    name:        string,
    res:         Response,
    fingerprint?: string,
  ) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Email already registered');

    const hashed = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({ data: { email, password: hashed, name } });

    await this.prisma.userSubscription.create({
      data: { userId: user.id, planId: 'plan_free', status: 'active' },
    });

    // Auto-register this browser as the first device
    if (fingerprint) {
      await this.prisma.device.create({
        data: { userId: user.id, fingerprint, name: 'Browser', lastSeen: new Date().toISOString() },
      }).catch(() => { /* ignore duplicate */ });
    }

    this.setAuthCookie(res, user);
    return this.buildUserResponse(user);
  }

  async login(
    email:       string,
    password:    string,
    res:         Response,
    fingerprint?: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    if (user.status !== 'active') throw new UnauthorizedException('Account suspended');

    // Determine effective plan for this specific device
    let effectivePlan = user.plan;

    if (fingerprint && user.plan !== 'free') {
      // Pro user — auto-register device and check device limit
      effectivePlan = await this.devicesService.checkAndRegisterDevice(
        user.id,
        fingerprint,
        user.plan,
      );
    }

    // Embed the effective plan in the JWT so getProfile() can surface it without
    // an extra DB device-check on every page load
    this.setAuthCookie(res, { ...user, plan: effectivePlan });
    return this.buildUserResponse({ ...user, plan: effectivePlan });
  }

  async logout(res: Response) {
    res.clearCookie(COOKIE_NAME, { path: '/' });
    return { success: true };
  }

  /**
   * Returns the user's EFFECTIVE plan from the JWT (not always the DB plan).
   * This ensures over-limit devices consistently see 'free' across all page loads
   * without an additional device-count DB query on every request.
   */
  async getProfile(userId: string, jwtPlan: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, plan: true, status: true, isAdmin: true, createdAt: true },
    });
    if (!user) return null;
    return { ...user, plan: jwtPlan };
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
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:   COOKIE_MAX_AGE,
      path:     '/',
    });
  }

  private buildUserResponse(user: any) {
    return { id: user.id, email: user.email, name: user.name, plan: user.plan };
  }
}
