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

  processCheckout(payload: CheckoutPayload) {
    if (!payload.items || payload.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    for (const item of payload.items) {
      const product = this.productsService.findOne(item.productId);
      if (product.stock < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for ${product.name}. Available: ${product.stock}`,
        );
      }
    }

    const transactionItems = payload.items.map((item) => {
      const product = this.productsService.findOne(item.productId);
      return {
        productId: item.productId,
        productName: product.name,
        sku: product.sku,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: parseFloat((item.unitPrice * item.quantity).toFixed(2)),
      };
    });

    for (const item of payload.items) {
      this.productsService.decrementStock(item.productId, item.quantity);
    }

    const transaction = this.transactionsService.create({
      date: new Date().toISOString(),
      items: transactionItems,
      subtotal: payload.subtotal,
      tax: payload.tax,
      discount: payload.discount,
      total: payload.total,
      paymentMethod: payload.paymentMethod,
      memberId: payload.memberId,
    });

    if (payload.memberId) {
      try {
        this.membersService.addPurchase(payload.memberId, {
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
      } catch {
        // member not found — don't fail the checkout
      }
    }

    return { success: true, transaction };
  }
}
