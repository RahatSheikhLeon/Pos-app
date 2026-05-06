import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { ProductsService } from '../products/products.service';

export interface TransactionItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface ReturnedItem {
  productId: string;
  quantity: number;
}

export type TransactionStatus = 'completed' | 'returned' | 'partially_refunded';

export interface Transaction {
  id: string;
  date: string;
  items: TransactionItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: 'cash' | 'card' | 'wallet';
  memberId?: string;
  status: TransactionStatus;
  returnedItems: ReturnedItem[];
}

const paymentMethods: Array<'cash' | 'card' | 'wallet'> = ['cash', 'card', 'wallet'];

function generateSeedTransactions(): Transaction[] {
  const productSnapshots = [
    { id: 'p1', name: 'Espresso Coffee Beans', sku: 'FOOD-001', price: 14.99 },
    { id: 'p2', name: 'Wireless Mouse', sku: 'ELEC-001', price: 29.99 },
    { id: 'p3', name: 'USB-C Hub 7-in-1', sku: 'ELEC-002', price: 45.99 },
    { id: 'p4', name: 'Notebook A5 Lined', sku: 'STAT-001', price: 5.99 },
    { id: 'p5', name: 'Ballpoint Pen Set (12)', sku: 'STAT-002', price: 8.49 },
    { id: 'p7', name: 'Bluetooth Speaker Mini', sku: 'ELEC-003', price: 59.99 },
    { id: 'p8', name: 'Green Tea Box (50 bags)', sku: 'FOOD-002', price: 9.99 },
    { id: 'p9', name: 'Adjustable Phone Stand', sku: 'ACC-001', price: 12.99 },
    { id: 'p12', name: 'Screen Cleaning Kit', sku: 'ELEC-004', price: 6.99 },
    { id: 'p14', name: 'Insulated Water Bottle', sku: 'HLTH-002', price: 19.99 },
  ];

  const transactions: Transaction[] = [];

  for (let i = 0; i < 55; i++) {
    const daysAgo = Math.floor(Math.random() * 90);
    const hoursOffset = Math.floor(Math.random() * 10) + 8;
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    date.setHours(hoursOffset, Math.floor(Math.random() * 60), 0, 0);

    const itemCount = Math.floor(Math.random() * 3) + 1;
    const usedIds = new Set<string>();
    const items: TransactionItem[] = [];

    for (let j = 0; j < itemCount; j++) {
      const snap = productSnapshots[Math.floor(Math.random() * productSnapshots.length)];
      if (usedIds.has(snap.id)) continue;
      usedIds.add(snap.id);
      const qty = Math.floor(Math.random() * 3) + 1;
      items.push({
        productId: snap.id,
        productName: snap.name,
        sku: snap.sku,
        quantity: qty,
        unitPrice: snap.price,
        total: snap.price * qty,
      });
    }

    if (items.length === 0) continue;

    const subtotal = items.reduce((s, it) => s + it.total, 0);
    const tax = parseFloat((subtotal * 0.1).toFixed(2));
    const total = parseFloat((subtotal + tax).toFixed(2));

    transactions.push({
      id: uuid(),
      date: date.toISOString(),
      items,
      subtotal: parseFloat(subtotal.toFixed(2)),
      tax,
      discount: 0,
      total,
      paymentMethod: paymentMethods[Math.floor(Math.random() * 3)],
      status: 'completed',
      returnedItems: [],
    });
  }

  return transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

@Injectable()
export class TransactionsService {
  private transactions: Transaction[] = generateSeedTransactions();

  constructor(private readonly productsService: ProductsService) {}

  findAll(search?: string, dateFrom?: string, dateTo?: string) {
    let result = [...this.transactions];

    if (search?.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((t) => t.id.toLowerCase().includes(q));
    }

    if (dateFrom) {
      result = result.filter((t) => new Date(t.date) >= new Date(dateFrom));
    }

    if (dateTo) {
      result = result.filter((t) => new Date(t.date) <= new Date(dateTo));
    }

    const totalRevenue = result
      .filter((t) => t.status !== 'returned')
      .reduce((sum, t) => sum + t.total, 0);

    return {
      transactions: result,
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
    };
  }

  findOne(id: string): Transaction {
    const t = this.transactions.find((t) => t.id === id);
    if (!t) throw new NotFoundException(`Transaction ${id} not found`);
    return t;
  }

  create(data: Omit<Transaction, 'id' | 'status' | 'returnedItems'>): Transaction {
    const transaction: Transaction = {
      ...data,
      id: uuid(),
      status: 'completed',
      returnedItems: [],
    };
    this.transactions.unshift(transaction);
    return transaction;
  }

  processReturn(id: string, items?: ReturnedItem[]): Transaction {
    const t = this.findOne(id);
    if (t.status === 'returned') {
      throw new BadRequestException('Transaction is already fully returned');
    }

    const alreadyReturnedQty = (productId: string) =>
      t.returnedItems.find((r) => r.productId === productId)?.quantity ?? 0;

    if (!items || items.length === 0) {
      // Full return — restock everything not yet returned
      for (const item of t.items) {
        const qty = item.quantity - alreadyReturnedQty(item.productId);
        if (qty > 0) {
          try { this.productsService.incrementStock(item.productId, qty); } catch { /* product deleted */ }
        }
      }
      t.returnedItems = t.items.map((i) => ({ productId: i.productId, quantity: i.quantity }));
      t.status = 'returned';
      return t;
    }

    // Partial return — validate first
    for (const ri of items) {
      if (ri.quantity <= 0) continue;
      const original = t.items.find((i) => i.productId === ri.productId);
      if (!original) throw new BadRequestException(`Product ${ri.productId} not in transaction`);
      if (alreadyReturnedQty(ri.productId) + ri.quantity > original.quantity) {
        throw new BadRequestException(
          `Cannot return ${ri.quantity} of "${original.productName}" — only ${original.quantity - alreadyReturnedQty(ri.productId)} returnable`,
        );
      }
    }

    // Apply returns + restock
    for (const ri of items) {
      if (ri.quantity <= 0) continue;
      try { this.productsService.incrementStock(ri.productId, ri.quantity); } catch { /* product deleted */ }
      const existing = t.returnedItems.find((r) => r.productId === ri.productId);
      if (existing) {
        existing.quantity += ri.quantity;
      } else {
        t.returnedItems.push({ productId: ri.productId, quantity: ri.quantity });
      }
    }

    // Determine final status
    const allDone = t.items.every(
      (item) => alreadyReturnedQty(item.productId) >= item.quantity,
    );
    t.status = allDone ? 'returned' : 'partially_refunded';

    return t;
  }

  getAll(): Transaction[] {
    return this.transactions;
  }
}
