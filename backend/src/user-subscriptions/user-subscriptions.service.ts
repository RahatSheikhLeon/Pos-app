import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserSubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMySubscription(userId: string) {
    const sub = await this.prisma.userSubscription.findUnique({
      where: { userId },
      include: { plan: true },
    });

    // Auto-downgrade to Free when Pro subscription has expired
    if (sub && sub.planId !== 'plan_free' && sub.endDate && sub.endDate < new Date()) {
      await this.prisma.userSubscription.update({
        where: { userId },
        data: { planId: 'plan_free', status: 'expired' },
      });
      await this.prisma.user.update({
        where: { id: userId },
        data: { plan: 'free' },
      });
      return this.prisma.userSubscription.findUnique({
        where: { userId },
        include: { plan: true },
      });
    }

    return sub;
  }

  async activateFree(userId: string) {
    const existing = await this.prisma.userSubscription.findUnique({ where: { userId } });
    if (existing) return existing;

    return this.prisma.userSubscription.create({
      data: { userId, planId: 'plan_free', status: 'active' },
    });
  }

  async upgradePlan(userId: string, planId: string) {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new Error('Plan not found');

    await this.prisma.userSubscription.upsert({
      where: { userId },
      create: { userId, planId, status: 'active' },
      update: { planId, status: 'active', startDate: new Date(), endDate: null },
    });

    // Mirror the plan slug to user.plan so the JWT reflects the new access level
    const planSlug = plan.slug === 'free' ? 'free' : plan.slug;
    await this.prisma.user.update({
      where: { id: userId },
      data: { plan: planSlug },
    });

    return this.getMySubscription(userId);
  }
}
