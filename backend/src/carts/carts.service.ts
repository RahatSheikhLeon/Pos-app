import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddCartItemDto, SetItemQtyDto } from './dto/cart-item.dto';

@Injectable()
export class CartsService {
  constructor(private readonly prisma: PrismaService) {}

  // Return all cart items for user, enriched with current product data
  async findAll(userId: string) {
    const items = await this.prisma.cart.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

    if (items.length === 0) return [];

    const productIds = [...new Set(items.map((i) => i.productId))];
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    return items.map((item) => ({
      ...item,
      product: productMap.get(item.productId) ?? null,
    }));
  }

  // Upsert a cart item: increment qty if already exists, insert if new
  async upsertItem(userId: string, dto: AddCartItemDto) {
    const sessionId = dto.sessionId ?? 'default';

    const existing = await this.prisma.cart.findUnique({
      where: { userId_sessionId_productId: { userId, sessionId, productId: dto.productId } },
    });

    if (existing) {
      const newQty = existing.qty + dto.qty;
      return this.prisma.cart.update({
        where: { id: existing.id },
        data: {
          qty: newQty,
          subtotal: parseFloat((existing.price * newQty).toFixed(2)),
        },
      });
    }

    return this.prisma.cart.create({
      data: {
        userId,
        sessionId,
        productId: dto.productId,
        qty: dto.qty,
        price: dto.price,
        subtotal: parseFloat((dto.price * dto.qty).toFixed(2)),
      },
    });
  }

  // Set exact quantity for a cart item (qty=0 removes it)
  async setQty(userId: string, productId: string, dto: SetItemQtyDto, sessionId = 'default') {
    const item = await this.prisma.cart.findUnique({
      where: { userId_sessionId_productId: { userId, sessionId, productId } },
    });

    if (!item) throw new NotFoundException('Cart item not found');

    if (dto.qty <= 0) {
      await this.prisma.cart.delete({ where: { id: item.id } });
      return null;
    }

    return this.prisma.cart.update({
      where: { id: item.id },
      data: {
        qty: dto.qty,
        subtotal: parseFloat((item.price * dto.qty).toFixed(2)),
      },
    });
  }

  // Remove a single item from a session
  async removeItem(userId: string, productId: string, sessionId = 'default') {
    await this.prisma.cart.deleteMany({ where: { userId, sessionId, productId } });
  }

  // Remove all items for a given session (used after checkout or cart close)
  async clearSession(userId: string, sessionId: string) {
    await this.prisma.cart.deleteMany({ where: { userId, sessionId } });
  }
}
