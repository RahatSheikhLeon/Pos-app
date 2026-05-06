import { Injectable } from '@nestjs/common';

@Injectable()
export class CartsService {
  private carts = new Map<string, any>();

  findAll(): any[] {
    return Array.from(this.carts.values());
  }

  upsert(cartId: string, data: any): any {
    const cart = { ...data, cartId };
    this.carts.set(cartId, cart);
    return cart;
  }

  remove(cartId: string): void {
    this.carts.delete(cartId);
  }
}
