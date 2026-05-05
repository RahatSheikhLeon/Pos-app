import { Injectable, NotFoundException } from '@nestjs/common';
import { v4 as uuid } from 'uuid';

export interface TransactionItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Transaction {
  id: string;
  date: string;
  items: TransactionItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: 'cash' | 'card' | 'wallet';
  customerEmail?: string;
  customerPhone?: string;
  returned: boolean;
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
      returned: false,
    });
  }

  return transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

@Injectable()
export class TransactionsService {
  private transactions: Transaction[] = generateSeedTransactions();

  findAll(search?: string, dateFrom?: string, dateTo?: string) {
    let result = [...this.transactions];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.id.toLowerCase().includes(q) ||
          t.paymentMethod.includes(q) ||
          (t.customerEmail && t.customerEmail.toLowerCase().includes(q)),
      );
    }

    if (dateFrom) {
      result = result.filter((t) => new Date(t.date) >= new Date(dateFrom));
    }

    if (dateTo) {
      result = result.filter((t) => new Date(t.date) <= new Date(dateTo));
    }

    const totalRevenue = result
      .filter((t) => !t.returned)
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

  create(data: Omit<Transaction, 'id' | 'returned'>): Transaction {
    const transaction: Transaction = {
      ...data,
      id: uuid(),
      returned: false,
    };
    this.transactions.unshift(transaction);
    return transaction;
  }

  return(id: string): Transaction {
    const t = this.findOne(id);
    if (t.returned) throw new Error('Transaction already returned');
    t.returned = true;
    return t;
  }

  getAll(): Transaction[] {
    return this.transactions;
  }
}
