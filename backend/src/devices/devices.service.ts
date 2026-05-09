import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Kept for the legacy /devices/register endpoint (manual registration from Subscription page)
const PLAN_DEVICE_LIMITS: Record<string, number> = {
  free:         1,
  pro_basic:    2,
  pro_standard: 5,
  pro_premium:  10,
  // Legacy slugs
  pro:    2,
  pro_2:  2,
  pro_5:  5,
  pro_10: 10,
};

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Called automatically on every login.
   *
   * - If the fingerprint is already registered → update lastSeen, grant purchasedPlan.
   * - If it is new AND within the plan's maxDevices → register it, grant purchasedPlan.
   * - If it is new AND over the limit → do NOT register, return 'free'.
   *
   * Returns the effective plan for THIS device session.
   */
  async checkAndRegisterDevice(
    userId: string,
    fingerprint: string,
    purchasedPlan: string,
  ): Promise<string> {
    // Already registered on this device → re-authorise, update last-seen
    const existing = await this.prisma.device.findUnique({
      where: { userId_fingerprint: { userId, fingerprint } },
    });
    if (existing) {
      await this.prisma.device.update({
        where: { id: existing.id },
        data: { lastSeen: new Date().toISOString() },
      });
      return purchasedPlan;
    }

    // New device — look up the device limit from the subscription_plans table
    // (single source of truth, no separate in-code mapping needed)
    const sub = await this.prisma.userSubscription.findUnique({
      where: { userId },
      include: { plan: true },
    });
    const limit = sub?.plan?.maxDevices ?? 1;
    const count = await this.prisma.device.count({ where: { userId } });

    if (count >= limit) {
      // Device limit reached — this device falls back to Free
      console.log(
        `[Devices] Over limit for user ${userId}: ${count}/${limit} devices. Effective plan → free`,
      );
      return 'free';
    }

    // Within limit — register and grant full plan
    await this.prisma.device.create({
      data: {
        userId,
        fingerprint,
        name: 'Browser',
        lastSeen: new Date().toISOString(),
      },
    });
    console.log(
      `[Devices] Registered new device for user ${userId} (${count + 1}/${limit}). Effective plan → ${purchasedPlan}`,
    );
    return purchasedPlan;
  }

  // ── Manual registration (Subscription page / explicit call) ──────────────────
  async registerDevice(userId: string, fingerprint: string, name: string, plan: string) {
    const existing = await this.prisma.device.findUnique({
      where: { userId_fingerprint: { userId, fingerprint } },
    });
    if (existing) {
      await this.prisma.device.update({
        where: { userId_fingerprint: { userId, fingerprint } },
        data: { lastSeen: new Date().toISOString() },
      });
      return existing;
    }

    const limit = PLAN_DEVICE_LIMITS[plan] ?? 1;
    const count = await this.prisma.device.count({ where: { userId } });
    if (count >= limit) {
      throw new ForbiddenException(
        `Device limit reached for your plan (max ${limit} device${limit > 1 ? 's' : ''})`,
      );
    }

    return this.prisma.device.create({
      data: { userId, fingerprint, name, lastSeen: new Date().toISOString() },
    });
  }

  async listDevices(userId: string) {
    return this.prisma.device.findMany({ where: { userId }, orderBy: { lastSeen: 'desc' } });
  }

  async removeDevice(userId: string, deviceId: string) {
    const device = await this.prisma.device.findFirst({ where: { id: deviceId, userId } });
    if (!device) throw new ForbiddenException('Device not found');
    await this.prisma.device.delete({ where: { id: deviceId } });
    return { success: true };
  }
}
