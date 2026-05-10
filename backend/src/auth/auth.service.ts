import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Response } from 'express';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { DevicesService } from '../devices/devices.service';
import { EmailService } from '../email/email.service';
import { validateEmail } from '../email/email-validation';

const COOKIE_NAME      = 'access_token';
const COOKIE_MAX_AGE   = 7 * 24 * 60 * 60 * 1000; // 7 days
const OTP_TTL_MS       = 10 * 60 * 1000;           // 10 minutes
const MAX_ATTEMPTS     = 5;
const MAX_RESENDS      = 3;
const RESEND_WINDOW_MS = 15 * 60 * 1000;           // 15 minutes

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma:         PrismaService,
    private readonly jwtService:     JwtService,
    private readonly devicesService: DevicesService,
    private readonly emailService:   EmailService,
  ) {}

  // ── Step 1: validate, store pending row, send OTP ─────────────────
  async startRegistration(email: string, password: string, name: string) {
    const emailError = await validateEmail(email);
    if (emailError) throw new BadRequestException(emailError);

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Email already registered');

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp            = this.generateOtp();
    const hashedOtp      = await bcrypt.hash(otp, 10);
    const otpExpiresAt   = new Date(Date.now() + OTP_TTL_MS);

    await this.prisma.pendingRegistration.upsert({
      where:  { email },
      update: { hashedPassword, name, hashedOtp, otpExpiresAt, attempts: 0, resendCount: 0, resendWindowAt: new Date() },
      create: { email, hashedPassword, name, hashedOtp, otpExpiresAt },
    });

    await this.emailService.sendVerificationOtp(email, name, otp);

    return { pendingEmail: email };
  }

  // ── Step 2: verify OTP → create user → issue JWT ──────────────────
  async verifyRegistration(email: string, otp: string, res: Response, fingerprint?: string) {
    const pending = await this.prisma.pendingRegistration.findUnique({ where: { email } });
    if (!pending) throw new BadRequestException('No pending registration found. Please register again');

    if (new Date() > pending.otpExpiresAt) {
      await this.prisma.pendingRegistration.delete({ where: { email } });
      throw new BadRequestException('Verification code has expired. Please register again');
    }

    if (pending.attempts >= MAX_ATTEMPTS) {
      await this.prisma.pendingRegistration.delete({ where: { email } });
      throw new HttpException(
        'Too many failed attempts. Please register again',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const valid = await bcrypt.compare(otp, pending.hashedOtp);
    if (!valid) {
      await this.prisma.pendingRegistration.update({
        where: { email },
        data:  { attempts: { increment: 1 } },
      });
      const remaining = MAX_ATTEMPTS - (pending.attempts + 1);
      throw new BadRequestException(
        remaining > 0
          ? `Invalid code — ${remaining} attempt${remaining === 1 ? '' : 's'} remaining`
          : 'Invalid code — no attempts remaining. Please register again',
      );
    }

    // OTP verified — create the real user
    const user = await this.prisma.user.create({
      data: { email, password: pending.hashedPassword, name: pending.name },
    });

    await this.prisma.userSubscription.create({
      data: { userId: user.id, planId: 'plan_free', status: 'active' },
    });

    if (fingerprint) {
      await this.prisma.device
        .create({ data: { userId: user.id, fingerprint, name: 'Browser', lastSeen: new Date().toISOString() } })
        .catch(() => {});
    }

    await this.prisma.pendingRegistration.delete({ where: { email } });

    this.setAuthCookie(res, user);
    return this.buildUserResponse(user);
  }

  // ── Step 3: resend OTP (rate-limited) ─────────────────────────────
  async resendRegistrationOtp(email: string) {
    const pending = await this.prisma.pendingRegistration.findUnique({ where: { email } });
    if (!pending) throw new BadRequestException('No pending registration found. Please register again');

    const windowEnd    = new Date(pending.resendWindowAt.getTime() + RESEND_WINDOW_MS);
    const withinWindow = new Date() < windowEnd;

    if (withinWindow && pending.resendCount >= MAX_RESENDS) {
      throw new HttpException(
        'Too many resend requests. Please wait 15 minutes',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const newResendWindowAt = withinWindow ? pending.resendWindowAt : new Date();
    const newResendCount    = withinWindow ? pending.resendCount + 1 : 1;
    const otp               = this.generateOtp();
    const hashedOtp         = await bcrypt.hash(otp, 10);
    const otpExpiresAt      = new Date(Date.now() + OTP_TTL_MS);

    await this.prisma.pendingRegistration.update({
      where: { email },
      data:  { hashedOtp, otpExpiresAt, attempts: 0, resendCount: newResendCount, resendWindowAt: newResendWindowAt },
    });

    await this.emailService.sendVerificationOtp(email, pending.name, otp);

    return { message: 'Verification code resent' };
  }

  // ── Login ──────────────────────────────────────────────────────────
  async login(email: string, password: string, res: Response, fingerprint?: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    if (user.status !== 'active') throw new UnauthorizedException('Account suspended');

    let effectivePlan  = user.plan;
    let limitReached   = false;

    if (fingerprint && user.plan !== 'free') {
      const result = await this.devicesService.checkAndRegisterDevice(user.id, fingerprint, user.plan);
      effectivePlan = result.effectivePlan;
      limitReached  = result.limitReached;
    }

    this.setAuthCookie(res, { ...user, plan: effectivePlan });
    return { ...this.buildUserResponse({ ...user, plan: effectivePlan }), deviceLimitReached: limitReached };
  }

  // ── Re-check device limit after removal or slot purchase ──────────
  // Called with a valid JWT cookie, re-issues a fresh JWT and returns the updated state.
  async recheckDeviceLimit(userId: string, fingerprint: string, res: Response) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    if (user.plan === 'free' || !fingerprint) {
      this.setAuthCookie(res, user);
      return { ...this.buildUserResponse(user), deviceLimitReached: false };
    }

    const { effectivePlan, limitReached } = await this.devicesService.checkAndRegisterDevice(
      user.id, fingerprint, user.plan,
    );

    this.setAuthCookie(res, { ...user, plan: effectivePlan });
    return { ...this.buildUserResponse({ ...user, plan: effectivePlan }), deviceLimitReached: limitReached };
  }

  // ── Logout ────────────────────────────────────────────────────────
  async logout(res: Response) {
    res.clearCookie(COOKIE_NAME, { path: '/' });
    return { success: true };
  }

  /**
   * Always returns users.plan from the database — never from the JWT.
   * Plan upgrades via Stripe webhook are visible immediately without re-login.
   */
  async getProfile(userId: string, _jwtPlan: string) {
    const user = await this.prisma.user.findUnique({
      where:  { id: userId },
      select: { id: true, email: true, name: true, plan: true, status: true, isAdmin: true, createdAt: true },
    });
    if (!user) return null;
    return user;
  }

  // ── Private helpers ───────────────────────────────────────────────
  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
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
