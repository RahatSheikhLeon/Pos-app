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

    const active = allTransactions.filter((t) => !t.returned);

    const todayTx = active.filter((t) => new Date(t.date) >= startOfToday);
    const weeklyTx = active.filter((t) => new Date(t.date) >= startOfWeek);
    const monthlyTx = active.filter((t) => new Date(t.date) >= startOfMonth);

    const sum = (txs: typeof active) =>
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
      recentTransactions: allTransactions.slice(0, 10),
      lowStockProducts,
    };
  }
}
