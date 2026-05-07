import { Controller, Get, Put, Delete, Body, Param } from '@nestjs/common';
import { CartsService } from './carts.service';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('carts')
export class CartsController {
  constructor(private readonly cartsService: CartsService) {}

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.cartsService.findAll(user.id);
  }

  @Put(':cartId')
  upsert(@CurrentUser() user: any, @Param('cartId') cartId: string, @Body() body: any) {
    return this.cartsService.upsert(user.id, cartId, body);
  }

  @Delete(':cartId')
  remove(@CurrentUser() user: any, @Param('cartId') cartId: string) {
    this.cartsService.remove(user.id, cartId);
    return { success: true };
  }
}
