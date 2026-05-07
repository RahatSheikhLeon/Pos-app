import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type TransactionStatus = 'completed' | 'returned' | 'partially_refunded';

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(search?: string, dateFrom?: string, dateTo?: string) {
    const where: any = {};
    if (search?.trim()) where.id = { contains: search.trim() };
    if (dateFrom) where.date = { ...(where.date ?? {}), gte: dateFrom };
    if (dateTo) where.date = { ...(where.date ?? {}), lte: dateTo };

    const transactions = await this.prisma.transaction.findMany({ where, orderBy: { date: 'desc' } });
    const totalRevenue = parseFloat(
      transactions.filter((t) => t.status !== 'returned').reduce((s, t) => s + t.total, 0).toFixed(2),
    );
    return { transactions, totalRevenue };
  }

  async findOne(id: string) {
    const t = await this.prisma.transaction.findUnique({ where: { id } });
    if (!t) throw new NotFoundException(`Transaction ${id} not found`);
    return t;
  }

  async create(data: any) {
    return this.prisma.transaction.create({
      data: { ...data, status: 'completed', returnedItems: [] },
    });
  }

  async processReturn(id: string, items?: any[]) {
    const t = await this.findOne(id);
    if (t.status === 'returned') throw new BadRequestException('Transaction already fully returned');

    const txItems = t.items as any[];
    const returnedItems = (t.returnedItems as any[]) ?? [];
    const alreadyQty = (productId: string) =>
      returnedItems.find((r: any) => r.productId === productId)?.quantity ?? 0;

    if (!items || items.length === 0) {
      for (const item of txItems) {
        const qty = item.quantity - alreadyQty(item.productId);
        if (qty > 0) {
          try { await this.prisma.product.update({ where: { id: item.productId }, data: { stock: { increment: qty } } }); } catch { /* product deleted */ }
        }
      }
      return this.prisma.transaction.update({
        where: { id },
        data: { status: 'returned', returnedItems: txItems.map((i) => ({ productId: i.productId, quantity: i.quantity })) },
      });
    }

    for (const ri of items) {
      if (ri.quantity <= 0) continue;
      const orig = txItems.find((i: any) => i.productId === ri.productId);
      if (!orig) throw new BadRequestException(`Product ${ri.productId} not in transaction`);
      if (alreadyQty(ri.productId) + ri.quantity > orig.quantity) {
        throw new BadRequestException(
          `Cannot return ${ri.quantity} of "${orig.productName}" — only ${orig.quantity - alreadyQty(ri.productId)} remaining`,
        );
      }
    }

    const newReturned = [...returnedItems];
    for (const ri of items) {
      if (ri.quantity <= 0) continue;
      try { await this.prisma.product.update({ where: { id: ri.productId }, data: { stock: { increment: ri.quantity } } }); } catch { /* product deleted */ }
      const existing = newReturned.find((r: any) => r.productId === ri.productId);
      if (existing) { existing.quantity += ri.quantity; } else { newReturned.push({ productId: ri.productId, quantity: ri.quantity }); }
    }

    const allDone = txItems.every((item: any) => {
      const r = newReturned.find((r: any) => r.productId === item.productId);
      return r && r.quantity >= item.quantity;
    });

    return this.prisma.transaction.update({
      where: { id },
      data: { status: allDone ? 'returned' : 'partially_refunded', returnedItems: newReturned },
    });
  }

  async getAll() {
    return this.prisma.transaction.findMany({ orderBy: { date: 'desc' } });
  }
}
