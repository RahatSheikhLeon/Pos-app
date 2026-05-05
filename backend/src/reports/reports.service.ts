import { Injectable } from '@nestjs/common';
import { TransactionsService } from '../transactions/transactions.service';

@Injectable()
export class ReportsService {
  constructor(private readonly transactionsService: TransactionsService) {}

  getReports(days = 30) {
    const allTransactions = this.transactionsService.getAll();
    const since = new Date();
    since.setDate(since.getDate() - days);

    const filtered = allTransactions.filter(
      (t) => !t.returned && new Date(t.date) >= since,
    );

    const totalRevenue = parseFloat(
      filtered.reduce((s, t) => s + t.total, 0).toFixed(2),
    );

    const revenueTrend = this.buildRevenueTrend(filtered, days);
    const paymentDistribution = this.buildPaymentDistribution(filtered);
    const topProducts = this.buildTopProducts(filtered);

    return {
      totalRevenue,
      totalTransactions: filtered.length,
      revenueTrend,
      paymentDistribution,
      topProducts,
    };
  }

  private buildRevenueTrend(transactions: any[], days: number) {
    const map = new Map<string, number>();

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      map.set(key, 0);
    }

    for (const t of transactions) {
      const key = t.date.split('T')[0];
      if (map.has(key)) {
        map.set(key, parseFloat((map.get(key)! + t.total).toFixed(2)));
      }
    }

    return Array.from(map.entries()).map(([date, revenue]) => ({ date, revenue }));
  }

  private buildPaymentDistribution(transactions: any[]) {
    const map = new Map<string, { count: number; amount: number }>();

    for (const t of transactions) {
      const existing = map.get(t.paymentMethod) || { count: 0, amount: 0 };
      map.set(t.paymentMethod, {
        count: existing.count + 1,
        amount: parseFloat((existing.amount + t.total).toFixed(2)),
      });
    }

    return Array.from(map.entries()).map(([method, data]) => ({
      method: method.charAt(0).toUpperCase() + method.slice(1),
      count: data.count,
      amount: data.amount,
    }));
  }

  private buildTopProducts(transactions: any[]) {
    const map = new Map<string, { name: string; sku: string; quantity: number; revenue: number }>();

    for (const t of transactions) {
      for (const item of t.items) {
        const existing = map.get(item.productId) || {
          name: item.productName,
          sku: item.sku,
          quantity: 0,
          revenue: 0,
        };
        map.set(item.productId, {
          ...existing,
          quantity: existing.quantity + item.quantity,
          revenue: parseFloat((existing.revenue + item.total).toFixed(2)),
        });
      }
    }

    return Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }
}
