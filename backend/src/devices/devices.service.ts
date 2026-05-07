import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const PLAN_DEVICE_LIMITS: Record<string, number> = {
  free: 1,
  pro_2: 2,
  pro_5: 5,
  pro_10: 10,
  pro: 999,
};

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

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

    const deviceCount = await this.prisma.device.count({ where: { userId } });
    const limit = PLAN_DEVICE_LIMITS[plan] ?? 1;
    if (deviceCount >= limit) {
      throw new ForbiddenException(`Device limit reached for your ${plan} plan (max ${limit})`);
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
