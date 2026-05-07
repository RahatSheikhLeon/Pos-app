import { Injectable } from '@nestjs/common';
import { TransactionsService } from '../transactions/transactions.service';

@Injectable()
export class ReportsService {
  constructor(private readonly transactionsService: TransactionsService) {}

  async getReports(days = 30) {
    const allTransactions = await this.transactionsService.getAll();
    const since = new Date();
    since.setDate(since.getDate() - days);

    const filtered = allTransactions.filter(
      (t) => t.status !== 'returned' && new Date(t.date) >= since,
    );

    const totalRevenue = parseFloat(filtered.reduce((s, t) => s + t.total, 0).toFixed(2));

    return {
      totalRevenue,
      totalTransactions: filtered.length,
      revenueTrend: this.buildRevenueTrend(filtered, days),
      paymentDistribution: this.buildPaymentDistribution(filtered),
      topProducts: this.buildTopProducts(filtered),
    };
  }

  private buildRevenueTrend(transactions: any[], days: number) {
    const map = new Map<string, number>();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      map.set(d.toISOString().split('T')[0], 0);
    }
    for (const t of transactions) {
      const key = t.date.split('T')[0];
      if (map.has(key)) map.set(key, parseFloat((map.get(key)! + t.total).toFixed(2)));
    }
    return Array.from(map.entries()).map(([date, revenue]) => ({ date, revenue }));
  }

  private buildPaymentDistribution(transactions: any[]) {
    const map = new Map<string, { count: number; amount: number }>();
    for (const t of transactions) {
      const e = map.get(t.paymentMethod) || { count: 0, amount: 0 };
      map.set(t.paymentMethod, { count: e.count + 1, amount: parseFloat((e.amount + t.total).toFixed(2)) });
    }
    return Array.from(map.entries()).map(([method, d]) => ({
      method: method.charAt(0).toUpperCase() + method.slice(1),
      count: d.count,
      amount: d.amount,
    }));
  }

  private buildTopProducts(transactions: any[]) {
    const map = new Map<string, { name: string; sku: string; quantity: number; revenue: number }>();
    for (const t of transactions) {
      for (const item of (t.items as any[])) {
        const e = map.get(item.productId) || { name: item.productName, sku: item.sku, quantity: 0, revenue: 0 };
        map.set(item.productId, { ...e, quantity: e.quantity + item.quantity, revenue: parseFloat((e.revenue + item.total).toFixed(2)) });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }
}
