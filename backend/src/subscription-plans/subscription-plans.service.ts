import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const SEED_PLANS = [
  {
    id: 'plan_free',
    name: 'Free Plan',
    slug: 'free',
    price: 0,
    features: ['50 products', '5 customers', '1 device', 'Basic dashboard'],
    type: 'free',
    maxDevices: 1,
    maxProducts: 50,
    maxCustomers: 5,
  },
  {
    id: 'plan_pro_basic',
    name: 'Pro Basic',
    slug: 'pro_basic',
    price: 9,
    features: ['Unlimited products', 'Unlimited customers', '2 devices', 'Transactions', 'Reports'],
    type: 'pro',
    maxDevices: 2,
    maxProducts: -1,
    maxCustomers: -1,
  },
  {
    id: 'plan_pro_standard',
    name: 'Pro Standard',
    slug: 'pro_standard',
    price: 19,
    features: ['Unlimited products', 'Unlimited customers', '5 devices', 'Transactions', 'Reports', 'Hardware integrations'],
    type: 'pro',
    maxDevices: 5,
    maxProducts: -1,
    maxCustomers: -1,
  },
  {
    id: 'plan_pro_premium',
    name: 'Pro Premium',
    slug: 'pro_premium',
    price: 39,
    features: ['Unlimited products', 'Unlimited customers', '10 devices', 'All features', 'Priority support'],
    type: 'pro',
    maxDevices: 10,
    maxProducts: -1,
    maxCustomers: -1,
  },
];

@Injectable()
export class SubscriptionPlansService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    for (const plan of SEED_PLANS) {
      await this.prisma.subscriptionPlan.upsert({
        where: { id: plan.id },
        create: { ...plan, features: plan.features },
        update: { name: plan.name, price: plan.price, features: plan.features },
      });
    }
  }

  async findAll() {
    return this.prisma.subscriptionPlan.findMany({ orderBy: { price: 'asc' } });
  }

  async findById(id: string) {
    return this.prisma.subscriptionPlan.findUnique({ where: { id } });
  }

  async findFree() {
    return this.prisma.subscriptionPlan.findUnique({ where: { slug: 'free' } });
  }
}
