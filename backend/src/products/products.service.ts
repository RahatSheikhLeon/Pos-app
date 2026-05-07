import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(search?: string, category?: string) {
    return this.prisma.product.findMany({
      where: {
        AND: [
          search
            ? { OR: [{ name: { contains: search } }, { sku: { contains: search } }, { barcode: { contains: search } }] }
            : {},
          category ? { category } : {},
        ],
      },
    });
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product;
  }

  async getCategories() {
    const rows = await this.prisma.product.findMany({ select: { category: true }, distinct: ['category'] });
    return rows.map((r) => r.category).sort();
  }

  async create(data: any) {
    return this.prisma.product.create({ data });
  }

  async update(id: string, data: any) {
    await this.findOne(id);
    return this.prisma.product.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.product.delete({ where: { id } });
  }

  async decrementStock(id: string, quantity: number) {
    await this.prisma.product.update({ where: { id }, data: { stock: { decrement: quantity } } });
  }

  async incrementStock(id: string, quantity: number) {
    await this.prisma.product.update({ where: { id }, data: { stock: { increment: quantity } } });
  }

  async getLowStock(threshold = 10) {
    return this.prisma.product.findMany({ where: { stock: { lt: threshold } } });
  }
}
