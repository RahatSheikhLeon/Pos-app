import { Injectable, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

export interface DeviceCheckResult {
  effectivePlan: string;
  limitReached:  boolean;
  deviceId:      string | null; // null when over limit (device not registered)
  sessionId:     string | null; // null when over limit
}

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  async getEffectiveLimit(userId: string): Promise<number> {
    const sub = await this.prisma.userSubscription.findUnique({
      where:   { userId },
      include: { plan: true },
    });
    return (sub?.plan?.maxDevices ?? 1) + (sub?.extraDevices ?? 0);
  }

  /**
   * Called on every login.
   *
   * Each successful call rotates the device's sessionId so the new JWT is the
   * only valid one for that device — previous JWTs for the same fingerprint are
   * immediately invalidated. Other devices are completely unaffected.
   */
  async checkAndRegisterDevice(
    userId:       string,
    fingerprint:  string,
    purchasedPlan: string,
  ): Promise<DeviceCheckResult> {
    const newSessionId = randomUUID();

    const existing = await this.prisma.device.findUnique({
      where: { userId_fingerprint: { userId, fingerprint } },
    });

    if (existing) {
      await this.prisma.device.update({
        where: { id: existing.id },
        data:  { lastSeen: new Date().toISOString(), sessionId: newSessionId },
      });
      return { effectivePlan: purchasedPlan, limitReached: false, deviceId: existing.id, sessionId: newSessionId };
    }

    const limit = await this.getEffectiveLimit(userId);
    const count = await this.prisma.device.count({ where: { userId } });

    if (count >= limit) {
      console.log(`[Devices] Over limit for user ${userId}: ${count}/${limit}. effectivePlan → free`);
      return { effectivePlan: 'free', limitReached: true, deviceId: null, sessionId: null };
    }

    const device = await this.prisma.device.create({
      data: { userId, fingerprint, name: 'Browser', lastSeen: new Date().toISOString(), sessionId: newSessionId },
    });
    console.log(`[Devices] Registered new device ${device.id} for user ${userId} (${count + 1}/${limit})`);
    return { effectivePlan: purchasedPlan, limitReached: false, deviceId: device.id, sessionId: newSessionId };
  }

  // ── Manual registration (Subscription page) ───────────────────────
  async registerDevice(userId: string, fingerprint: string, name: string, _plan: string) {
    const existing = await this.prisma.device.findUnique({
      where: { userId_fingerprint: { userId, fingerprint } },
    });
    if (existing) {
      const sid = randomUUID();
      await this.prisma.device.update({
        where: { userId_fingerprint: { userId, fingerprint } },
        data:  { lastSeen: new Date().toISOString(), sessionId: sid },
      });
      return existing;
    }

    const limit = await this.getEffectiveLimit(userId);
    const count = await this.prisma.device.count({ where: { userId } });
    if (count >= limit) {
      throw new ForbiddenException(`Device limit reached (max ${limit} device${limit !== 1 ? 's' : ''})`);
    }

    return this.prisma.device.create({
      data: { userId, fingerprint, name, lastSeen: new Date().toISOString(), sessionId: randomUUID() },
    });
  }

  /**
   * Marks a device as logged out by clearing its sessionId.
   * The Device record stays in the DB (the device is still registered);
   * it simply disappears from the "active sessions" list.
   * Other devices are completely unaffected.
   */
  async logoutDevice(userId: string, deviceId: string) {
    await this.prisma.device.updateMany({
      where: { id: deviceId, userId },     // userId check prevents cross-user attacks
      data:  { sessionId: '' },
    });
  }

  /**
   * Returns ONLY devices with an active session (sessionId != '').
   * Logged-out devices are automatically excluded.
   * If currentFingerprint is provided, the matching device gets isCurrent: true.
   */
  async listDevices(userId: string, currentFingerprint?: string) {
    const devices = await this.prisma.device.findMany({
      where:   { userId, sessionId: { not: '' } }, // active sessions only
      orderBy: { lastSeen: 'desc' },
    });
    return devices.map((d) => ({
      id:        d.id,
      name:      d.name,
      lastSeen:  d.lastSeen,
      isCurrent: !!currentFingerprint && d.fingerprint === currentFingerprint,
    }));
  }

  // ── Simple removal without password (DeviceLimitReached page) ────
  async removeDevice(userId: string, deviceId: string) {
    const device = await this.prisma.device.findFirst({ where: { id: deviceId, userId } });
    if (!device) throw new ForbiddenException('Device not found');
    await this.prisma.device.delete({ where: { id: deviceId } });
    return { success: true };
  }

  /**
   * Secure device removal — requires the user's account password.
   *
   * Deletes ONLY the target device record. Because the JWT strategy validates
   * against Device.sessionId (not a global tokenVersion), only that specific
   * device's JWT becomes invalid. All other sessions remain active.
   *
   * Returns whether the caller removed their own device, so the controller
   * can decide whether to clear the caller's cookie.
   */
  async secureRemoveDevice(
    userId:          string,
    deviceId:        string,
    password:        string,
    callerDeviceId?: string, // deviceId from the caller's JWT
  ): Promise<{ removedOwnDevice: boolean }> {
    const device = await this.prisma.device.findFirst({ where: { id: deviceId, userId } });
    if (!device) throw new ForbiddenException('Device not found');

    const user = await this.prisma.user.findUnique({
      where:  { id: userId },
      select: { password: true },
    });
    if (!user) throw new UnauthorizedException();

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid password');

    // Delete only this device — other sessions are completely unaffected
    await this.prisma.device.delete({ where: { id: deviceId } });

    return { removedOwnDevice: deviceId === callerDeviceId };
  }

  // ── Snapshot for DeviceLimitReached page ─────────────────────────
  async getLimitInfo(userId: string, currentFingerprint?: string) {
    const [sub, count, devices] = await Promise.all([
      this.prisma.userSubscription.findUnique({ where: { userId }, include: { plan: true } }),
      this.prisma.device.count({ where: { userId } }),
      this.listDevices(userId, currentFingerprint),
    ]);

    const baseLimit      = sub?.plan?.maxDevices ?? 1;
    const extraDevices   = sub?.extraDevices ?? 0;
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

  // ── Full summary for Subscription page (includes upgrade history) ─
  async getUsageSummary(userId: string, currentFingerprint?: string) {
    const [sub, count, devices, upgradeHistory] = await Promise.all([
      this.prisma.userSubscription.findUnique({ where: { userId }, include: { plan: true } }),
      this.prisma.device.count({ where: { userId, sessionId: { not: '' } } }), // active only
      this.listDevices(userId, currentFingerprint),
      this.prisma.deviceUpgradeHistory.findMany({
        where:   { userId },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const baseLimit      = sub?.plan?.maxDevices ?? 1;
    const extraDevices   = sub?.extraDevices ?? 0;
    const effectiveLimit = baseLimit + extraDevices;

    return {
      devices,
      count,
      baseLimit,
      extraDevices,
      effectiveLimit,
      limitReached:   count >= effectiveLimit,
      upgradeHistory,
      endDate:        sub?.endDate ?? null,
      planId:         sub?.planId ?? 'plan_free',
      planName:       sub?.planName ?? 'Free',
      billingCycle:   sub?.billingCycle ?? 'monthly',
    };
  }
}
