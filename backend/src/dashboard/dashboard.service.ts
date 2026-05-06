import { Injectable } from '@nestjs/common';
import { ProductsService } from '../products/products.service';
import { TransactionsService } from '../transactions/transactions.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly productsService: ProductsService,
    private readonly transactionsService: TransactionsService,
  ) {}

  getDashboard() {
    const allTransactions = this.transactionsService.getAll();
    const now = new Date();

    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now);
    startOfMonth.setDate(now.getDate() - 30);
    startOfMonth.setHours(0, 0, 0, 0);

    // Revenue stats count only non-fully-returned transactions
    const countable = allTransactions.filter((t) => t.status !== 'returned');
    const todayTx = countable.filter((t) => new Date(t.date) >= startOfToday);
    const weeklyTx = countable.filter((t) => new Date(t.date) >= startOfWeek);
    const monthlyTx = countable.filter((t) => new Date(t.date) >= startOfMonth);

    const sum = (txs: typeof countable) =>
      parseFloat(txs.reduce((s, t) => s + t.total, 0).toFixed(2));

    const lowStockProducts = this.productsService.getLowStock(10);

    return {
      todaySales: sum(todayTx),
      todayTransactions: todayTx.length,
      weeklySales: sum(weeklyTx),
      weeklyTransactions: weeklyTx.length,
      monthlySales: sum(monthlyTx),
      monthlyTransactions: monthlyTx.length,
      lowStockCount: lowStockProducts.length,
      // Return activity feed — only returned / partially refunded
      recentTransactions: allTransactions
        .filter((t) => t.status === 'returned' || t.status === 'partially_refunded')
        .slice(0, 10),
      lowStockProducts,
    };
  }
}
