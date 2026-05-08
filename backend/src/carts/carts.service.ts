import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddCartItemDto, SetItemQtyDto } from './dto/cart-item.dto';

@Injectable()
export class CartsService {
  constructor(private readonly prisma: PrismaService) {}

  // Return both cart items (enriched with product data) and session metadata.
  // The frontend needs both to rebuild carts with correct customer identity.
  async findAll(userId: string) {
    const [items, sessions] = await Promise.all([
      this.prisma.cart.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.cartSession.findMany({ where: { userId } }),
    ]);

    let enrichedItems: any[] = [];
    if (items.length > 0) {
      const productIds = [...new Set(items.map((i) => i.productId))];
      const products = await this.prisma.product.findMany({
        where: { id: { in: productIds } },
      });
      const productMap = new Map(products.map((p) => [p.id, p]));
      enrichedItems = items.map((item) => ({
        ...item,
        product: productMap.get(item.productId) ?? null,
      }));
    }

    return { items: enrichedItems, sessions };
  }

  // Upsert session metadata: customer name, customer ID, discount.
  // Called the moment a cart tab is created — persists even before items are added.
  async upsertSession(
    userId: string,
    sessionId: string,
    data: { customerName?: string; customerId?: string; discount?: number },
  ) {
    return this.prisma.cartSession.upsert({
      where: { id: sessionId },
      create: {
        id: sessionId,
        userId,
        customerName: data.customerName ?? 'Walk-in',
        customerId: data.customerId ?? null,
        discount: data.discount ?? 0,
      },
      update: {
        customerName: data.customerName ?? 'Walk-in',
        customerId: data.customerId ?? null,
        discount: data.discount ?? 0,
      },
    });
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

  // Remove all items AND session metadata — called on checkout or tab close
  async clearSession(userId: string, sessionId: string) {
    await Promise.all([
      this.prisma.cart.deleteMany({ where: { userId, sessionId } }),
      this.prisma.cartSession.deleteMany({ where: { id: sessionId, userId } }),
    ]);
  }
}
