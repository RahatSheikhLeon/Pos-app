import { Injectable, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

export interface DeviceCheckResult {
  effectivePlan: string;
  limitReached:  boolean;
}

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the effective device limit for a user:
   * plan.maxDevices + any extra slots purchased via Stripe.
   */
  async getEffectiveLimit(userId: string): Promise<number> {
    const sub = await this.prisma.userSubscription.findUnique({
      where:   { userId },
      include: { plan: true },
    });
    return (sub?.plan?.maxDevices ?? 1) + (sub?.extraDevices ?? 0);
  }

  /**
   * Called automatically on every login.
   *
   * - Known fingerprint → refresh lastSeen, grant purchasedPlan.
   * - New fingerprint + within effective limit → register, grant purchasedPlan.
   * - New fingerprint + over limit → do NOT register, return { effectivePlan: 'free', limitReached: true }.
   */
  async checkAndRegisterDevice(
    userId:       string,
    fingerprint:  string,
    purchasedPlan: string,
  ): Promise<DeviceCheckResult> {
    const existing = await this.prisma.device.findUnique({
      where: { userId_fingerprint: { userId, fingerprint } },
    });

    if (existing) {
      await this.prisma.device.update({
        where: { id: existing.id },
        data:  { lastSeen: new Date().toISOString() },
      });
      return { effectivePlan: purchasedPlan, limitReached: false };
    }

    // New device — check effective limit (base + purchased extras)
    const limit = await this.getEffectiveLimit(userId);
    const count = await this.prisma.device.count({ where: { userId } });

    if (count >= limit) {
      console.log(`[Devices] Over limit for user ${userId}: ${count}/${limit}. Effective plan → free`);
      return { effectivePlan: 'free', limitReached: true };
    }

    await this.prisma.device.create({
      data: { userId, fingerprint, name: 'Browser', lastSeen: new Date().toISOString() },
    });
    console.log(`[Devices] Registered device for user ${userId} (${count + 1}/${limit}). plan → ${purchasedPlan}`);
    return { effectivePlan: purchasedPlan, limitReached: false };
  }

  // ── Manual registration (Subscription page) ───────────────────────
  async registerDevice(userId: string, fingerprint: string, name: string, _plan: string) {
    const existing = await this.prisma.device.findUnique({
      where: { userId_fingerprint: { userId, fingerprint } },
    });
    if (existing) {
      await this.prisma.device.update({
        where: { userId_fingerprint: { userId, fingerprint } },
        data:  { lastSeen: new Date().toISOString() },
      });
      return existing;
    }

    const limit = await this.getEffectiveLimit(userId);
    const count = await this.prisma.device.count({ where: { userId } });
    if (count >= limit) {
      throw new ForbiddenException(
        `Device limit reached (max ${limit} device${limit !== 1 ? 's' : ''})`,
      );
    }

    return this.prisma.device.create({
      data: { userId, fingerprint, name, lastSeen: new Date().toISOString() },
    });
  }

  // ── List devices — optional fingerprint marks the caller's device ─
  async listDevices(userId: string, currentFingerprint?: string) {
    const devices = await this.prisma.device.findMany({
      where:   { userId },
      orderBy: { lastSeen: 'desc' },
    });
    return devices.map((d) => ({
      id:        d.id,
      name:      d.name,
      lastSeen:  d.lastSeen,
      isCurrent: !!currentFingerprint && d.fingerprint === currentFingerprint,
    }));
  }

  // ── Remove a specific device (no password — used from DeviceLimitReached page) ──
  async removeDevice(userId: string, deviceId: string) {
    const device = await this.prisma.device.findFirst({ where: { id: deviceId, userId } });
    if (!device) throw new ForbiddenException('Device not found');
    await this.prisma.device.delete({ where: { id: deviceId } });
    return { success: true };
  }

  /**
   * Secure device removal — requires the user's current password.
   *
   * On success:
   * 1. Verifies password with bcrypt (generic error on failure — no oracle).
   * 2. Atomically deletes the device record and increments tokenVersion.
   *    Incrementing tokenVersion immediately invalidates every existing JWT for
   *    this user; the controller must re-issue a fresh cookie for the caller.
   * 3. Returns the new tokenVersion so the controller can embed it in the
   *    replacement JWT without an extra DB round-trip.
   */
  async secureRemoveDevice(
    userId:   string,
    deviceId: string,
    password: string,
  ): Promise<{ newTokenVersion: number }> {
    // 1. Confirm device belongs to this user
    const device = await this.prisma.device.findFirst({ where: { id: deviceId, userId } });
    if (!device) throw new ForbiddenException('Device not found');

    // 2. Bcrypt verify — use a generic message to avoid password-oracle attacks
    const user = await this.prisma.user.findUnique({
      where:  { id: userId },
      select: { password: true },
    });
    if (!user) throw new UnauthorizedException();

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid password');

    // 3. Atomic: delete device + bump tokenVersion in one transaction
    const [, updated] = await this.prisma.$transaction([
      this.prisma.device.delete({ where: { id: deviceId } }),
      this.prisma.user.update({
        where:  { id: userId },
        data:   { tokenVersion: { increment: 1 } },
        select: { tokenVersion: true },
      }),
    ]);

    return { newTokenVersion: updated.tokenVersion };
  }

  // ── Snapshot for the Device Limit page ───────────────────────────
  async getLimitInfo(userId: string, currentFingerprint?: string) {
    const [sub, count, devices] = await Promise.all([
      this.prisma.userSubscription.findUnique({ where: { userId }, include: { plan: true } }),
      this.prisma.device.count({ where: { userId } }),
      this.listDevices(userId, currentFingerprint),
    ]);

    const baseLimit    = sub?.plan?.maxDevices ?? 1;
    const extraDevices = sub?.extraDevices ?? 0;
    const effectiveLimit = baseLimit + extraDevices;

    return {
      devices,
      count,
      baseLimit,
      extraDevices,
      effectiveLimit,
      limitReached: count >= effectiveLimit,
      endDate:      sub?.endDate ?? null,
      planId:       sub?.planId ?? 'plan_free',
      planName:     sub?.planName ?? 'Free',
      billingCycle: sub?.billingCycle ?? 'monthly',
    };
  }
}
