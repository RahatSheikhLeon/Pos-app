import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CartsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.cart.findMany();
  }

  async upsert(cartId: string, data: any) {
    return this.prisma.cart.upsert({
      where: { cartId },
      create: { cartId, ...data },
      update: data,
    });
  }

  async remove(cartId: string) {
    try { await this.prisma.cart.delete({ where: { cartId } }); } catch { /* already gone */ }
  }
}
