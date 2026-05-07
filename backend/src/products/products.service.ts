import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const FREE_PRODUCT_LIMIT = 50;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, search?: string, category?: string) {
    return this.prisma.product.findMany({
      where: {
        userId,
        AND: [
          search
            ? { OR: [{ name: { contains: search } }, { sku: { contains: search } }, { barcode: { contains: search } }] }
            : {},
          category ? { category } : {},
        ],
      },
    });
  }

  async findOne(userId: string, id: string) {
    const product = await this.prisma.product.findFirst({ where: { id, userId } });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product;
  }

  async getCategories(userId: string) {
    const rows = await this.prisma.product.findMany({
      where: { userId },
      select: { category: true },
      distinct: ['category'],
    });
    return rows.map((r) => r.category).sort();
  }

  async create(userId: string, plan: string, data: any) {
    if (plan === 'free') {
      const count = await this.prisma.product.count({ where: { userId } });
      if (count >= FREE_PRODUCT_LIMIT) {
        throw new ForbiddenException(`Free plan allows up to ${FREE_PRODUCT_LIMIT} products. Upgrade to Pro for unlimited.`);
      }
    }
    return this.prisma.product.create({ data: { ...data, userId } });
  }

  async update(userId: string, id: string, data: any) {
    await this.findOne(userId, id);
    return this.prisma.product.update({ where: { id }, data });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    await this.prisma.product.delete({ where: { id } });
  }

  async decrementStock(id: string, quantity: number) {
    await this.prisma.product.update({ where: { id }, data: { stock: { decrement: quantity } } });
  }

  async incrementStock(id: string, quantity: number) {
    await this.prisma.product.update({ where: { id }, data: { stock: { increment: quantity } } });
  }

  async getLowStock(userId: string, threshold = 10) {
    return this.prisma.product.findMany({ where: { userId, stock: { lt: threshold } } });
  }

  // Used by checkout — looks up by ID only (no userId guard) since checkout validates the user already
  async findById(id: string) {
    const product = await this.prisma.product.findFirst({ where: { id } });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product;
  }
}
