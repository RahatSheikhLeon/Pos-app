import { Injectable, BadRequestException } from '@nestjs/common';
import { ProductsService } from '../products/products.service';
import { TransactionsService } from '../transactions/transactions.service';
import { MembersService } from '../members/members.service';

export interface CheckoutPayload {
  items: { productId: string; quantity: number; unitPrice: number }[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: 'cash' | 'card' | 'wallet';
  memberId?: string;
}

@Injectable()
export class CheckoutService {
  constructor(
    private readonly productsService: ProductsService,
    private readonly transactionsService: TransactionsService,
    private readonly membersService: MembersService,
  ) {}

  async processCheckout(userId: string, payload: CheckoutPayload) {
    if (!payload.items || payload.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    const products = await Promise.all(
      payload.items.map((item) => this.productsService.findById(item.productId)),
    );

    for (let i = 0; i < payload.items.length; i++) {
      if (products[i].stock < payload.items[i].quantity) {
        throw new BadRequestException(
          `Insufficient stock for ${products[i].name}. Available: ${products[i].stock}`,
        );
      }
    }

    const transactionItems = payload.items.map((item, i) => ({
      productId: item.productId,
      productName: products[i].name,
      sku: products[i].sku,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: parseFloat((item.unitPrice * item.quantity).toFixed(2)),
    }));

    await Promise.all(
      payload.items.map((item) =>
        this.productsService.decrementStock(item.productId, item.quantity),
      ),
    );

    const transaction = await this.transactionsService.create({
      userId,
      date: new Date().toISOString(),
      items: transactionItems,
      subtotal: payload.subtotal,
      tax: payload.tax,
      discount: payload.discount,
      total: payload.total,
      paymentMethod: payload.paymentMethod,
      memberId: payload.memberId ?? null,
    });

    if (payload.memberId) {
      try {
        await this.membersService.addPurchase(payload.memberId, {
          transactionId: transaction.id,
          date: transaction.date,
          items: transactionItems.map((i) => ({
            productName: i.productName,
            sku: i.sku,
            quantity: i.quantity,
            total: i.total,
          })),
          total: transaction.total,
        });
      } catch { }
    }

    return { success: true, transaction };
  }
}
