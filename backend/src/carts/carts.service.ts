import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CartsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string) {
    return this.prisma.cart.findMany({ where: { userId } });
  }

  async upsert(userId: string, cartId: string, data: any) {
    return this.prisma.cart.upsert({
      where: { cartId },
      create: { cartId, userId, ...data },
      update: data,
    });
  }

  async remove(userId: string, cartId: string) {
    try { await this.prisma.cart.deleteMany({ where: { cartId, userId } }); } catch { }
  }
}
