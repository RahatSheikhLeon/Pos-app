import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULTS = {
  id: 'default',
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

  async getSettings() {
    let settings = await this.prisma.settings.findUnique({ where: { id: 'default' } });
    if (!settings) {
      settings = await this.prisma.settings.create({ data: DEFAULTS });
    }
    return settings;
  }

  async updateSettings(data: any) {
    return this.prisma.settings.upsert({
      where: { id: 'default' },
      create: { ...DEFAULTS, ...data },
      update: data,
    });
  }
}
