import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULTS = {
  storeName: 'ShopIQ Store',
  address: '',
  phone: '',
  email: '',
  taxRate: 10,
  currency: 'USD',
  currencySymbol: '$',
  receiptHeader: 'Thank you for shopping with us!',
  receiptFooter: 'Please come again.',
  taxId: '',
  showLogo: true,
  showTaxId: false,
  theme: 'light',
};

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(userId: string) {
    let settings = await this.prisma.settings.findUnique({ where: { id: userId } });
    if (!settings) {
      settings = await this.prisma.settings.create({ data: { id: userId, userId, ...DEFAULTS } });
    }
    return settings;
  }

  async updateSettings(userId: string, data: any) {
    return this.prisma.settings.upsert({
      where: { id: userId },
      create: { id: userId, userId, ...DEFAULTS, ...data },
      update: data,
    });
  }
}
