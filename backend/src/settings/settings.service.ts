import { Injectable } from '@nestjs/common';

interface Settings {
  storeName: string;
  address: string;
  phone: string;
  email: string;
  taxRate: number;
  currency: string;
  currencySymbol: string;
  receiptHeader: string;
  receiptFooter: string;
  taxId: string;
  showLogo: boolean;
  showTaxId: boolean;
  theme: 'light' | 'dark';
}

@Injectable()
export class SettingsService {
  private settings: Settings = {
    storeName: 'ShopIQ Store',
    address: '123 Commerce Street, Business District',
    phone: '+1 (555) 123-4567',
    email: 'store@shopiq.com',
    taxRate: 10,
    currency: 'USD',
    currencySymbol: '$',
    receiptHeader: 'Thank you for shopping with us!',
    receiptFooter: 'Please come again. Visit us at shopiq.com',
    taxId: 'TAX-123456789',
    showLogo: true,
    showTaxId: false,
    theme: 'light',
  };

  getSettings(): Settings {
    return { ...this.settings };
  }

  updateSettings(data: Partial<Settings>): Settings {
    this.settings = { ...this.settings, ...data };
    return { ...this.settings };
  }
}
