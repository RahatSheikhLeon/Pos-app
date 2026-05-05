import { Injectable, NotFoundException } from '@nestjs/common';
import { v4 as uuid } from 'uuid';

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  sellPrice: number;
  buyPrice: number;
  stock: number;
  imageUrl: string;
  taxable: boolean;
}

const seedProducts: Product[] = [
  {
    id: 'p1',
    name: 'Espresso Coffee Beans',
    sku: 'FOOD-001',
    barcode: '8901234567890',
    category: 'Food & Beverages',
    sellPrice: 14.99,
    buyPrice: 7.5,
    stock: 42,
    imageUrl: '',
    taxable: true,
  },
  {
    id: 'p2',
    name: 'Wireless Mouse',
    sku: 'ELEC-001',
    barcode: '2345678901234',
    category: 'Electronics',
    sellPrice: 29.99,
    buyPrice: 15.0,
    stock: 8,
    imageUrl: '',
    taxable: true,
  },
  {
    id: 'p3',
    name: 'USB-C Hub 7-in-1',
    sku: 'ELEC-002',
    barcode: '3456789012345',
    category: 'Electronics',
    sellPrice: 45.99,
    buyPrice: 22.0,
    stock: 15,
    imageUrl: '',
    taxable: true,
  },
  {
    id: 'p4',
    name: 'Notebook A5 Lined',
    sku: 'STAT-001',
    barcode: '4567890123456',
    category: 'Stationery',
    sellPrice: 5.99,
    buyPrice: 2.5,
    stock: 120,
    imageUrl: '',
    taxable: false,
  },
  {
    id: 'p5',
    name: 'Ballpoint Pen Set (12)',
    sku: 'STAT-002',
    barcode: '5678901234567',
    category: 'Stationery',
    sellPrice: 8.49,
    buyPrice: 3.0,
    stock: 87,
    imageUrl: '',
    taxable: false,
  },
  {
    id: 'p6',
    name: 'Hand Sanitizer 500ml',
    sku: 'HLTH-001',
    barcode: '6789012345678',
    category: 'Health',
    sellPrice: 4.99,
    buyPrice: 2.0,
    stock: 6,
    imageUrl: '',
    taxable: false,
  },
  {
    id: 'p7',
    name: 'Bluetooth Speaker Mini',
    sku: 'ELEC-003',
    barcode: '7890123456789',
    category: 'Electronics',
    sellPrice: 59.99,
    buyPrice: 30.0,
    stock: 12,
    imageUrl: '',
    taxable: true,
  },
  {
    id: 'p8',
    name: 'Green Tea Box (50 bags)',
    sku: 'FOOD-002',
    barcode: '8901234567891',
    category: 'Food & Beverages',
    sellPrice: 9.99,
    buyPrice: 4.5,
    stock: 34,
    imageUrl: '',
    taxable: false,
  },
  {
    id: 'p9',
    name: 'Adjustable Phone Stand',
    sku: 'ACC-001',
    barcode: '9012345678901',
    category: 'Accessories',
    sellPrice: 12.99,
    buyPrice: 5.0,
    stock: 25,
    imageUrl: '',
    taxable: true,
  },
  {
    id: 'p10',
    name: 'Sticky Notes 5-Pack',
    sku: 'STAT-003',
    barcode: '0123456789012',
    category: 'Stationery',
    sellPrice: 3.49,
    buyPrice: 1.0,
    stock: 200,
    imageUrl: '',
    taxable: false,
  },
  {
    id: 'p11',
    name: 'Protein Energy Bar (Box)',
    sku: 'FOOD-003',
    barcode: '1234567890124',
    category: 'Food & Beverages',
    sellPrice: 24.99,
    buyPrice: 12.0,
    stock: 3,
    imageUrl: '',
    taxable: false,
  },
  {
    id: 'p12',
    name: 'Screen Cleaning Kit',
    sku: 'ELEC-004',
    barcode: '2345678901235',
    category: 'Electronics',
    sellPrice: 6.99,
    buyPrice: 2.5,
    stock: 43,
    imageUrl: '',
    taxable: false,
  },
  {
    id: 'p13',
    name: 'Leather Bifold Wallet',
    sku: 'ACC-002',
    barcode: '3456789012346',
    category: 'Accessories',
    sellPrice: 39.99,
    buyPrice: 18.0,
    stock: 7,
    imageUrl: '',
    taxable: true,
  },
  {
    id: 'p14',
    name: 'Insulated Water Bottle',
    sku: 'HLTH-002',
    barcode: '4567890123457',
    category: 'Health',
    sellPrice: 19.99,
    buyPrice: 9.0,
    stock: 18,
    imageUrl: '',
    taxable: false,
  },
  {
    id: 'p15',
    name: 'Bamboo Desk Organizer',
    sku: 'OFFC-001',
    barcode: '5678901234568',
    category: 'Office',
    sellPrice: 34.99,
    buyPrice: 16.0,
    stock: 11,
    imageUrl: '',
    taxable: true,
  },
];

@Injectable()
export class ProductsService {
  private products: Product[] = [...seedProducts];

  findAll(search?: string, category?: string): Product[] {
    let result = [...this.products];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.barcode.includes(q),
      );
    }
    if (category) {
      result = result.filter((p) => p.category === category);
    }
    return result;
  }

  findOne(id: string): Product {
    const product = this.products.find((p) => p.id === id);
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product;
  }

  getCategories(): string[] {
    return [...new Set(this.products.map((p) => p.category))].sort();
  }

  create(data: Partial<Product>): Product {
    const product: Product = {
      id: uuid(),
      name: data.name || '',
      sku: data.sku || '',
      barcode: data.barcode || '',
      category: data.category || 'Uncategorized',
      sellPrice: data.sellPrice || 0,
      buyPrice: data.buyPrice || 0,
      stock: data.stock || 0,
      imageUrl: data.imageUrl || '',
      taxable: data.taxable ?? false,
    };
    this.products.push(product);
    return product;
  }

  update(id: string, data: Partial<Product>): Product {
    const idx = this.products.findIndex((p) => p.id === id);
    if (idx === -1) throw new NotFoundException(`Product ${id} not found`);
    this.products[idx] = { ...this.products[idx], ...data, id };
    return this.products[idx];
  }

  remove(id: string): void {
    const idx = this.products.findIndex((p) => p.id === id);
    if (idx === -1) throw new NotFoundException(`Product ${id} not found`);
    this.products.splice(idx, 1);
  }

  decrementStock(id: string, quantity: number): void {
    const product = this.findOne(id);
    product.stock = Math.max(0, product.stock - quantity);
  }

  incrementStock(id: string, quantity: number): void {
    const product = this.findOne(id);
    product.stock += quantity;
  }

  getLowStock(threshold = 10): Product[] {
    return this.products.filter((p) => p.stock < threshold);
  }
}
