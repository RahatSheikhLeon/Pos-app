import { Controller, Get, Put, Delete, Body, Param } from '@nestjs/common';
import { CartsService } from './carts.service';

@Controller('carts')
export class CartsController {
  constructor(private readonly cartsService: CartsService) {}

  @Get()
  findAll() {
    return this.cartsService.findAll();
  }

  @Put(':cartId')
  upsert(@Param('cartId') cartId: string, @Body() body: any) {
    return this.cartsService.upsert(cartId, body);
  }

  @Delete(':cartId')
  remove(@Param('cartId') cartId: string) {
    this.cartsService.remove(cartId);
    return { success: true };
  }
}
