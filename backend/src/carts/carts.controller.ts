import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { CartsService } from './carts.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { AddCartItemDto, SetItemQtyDto } from './dto/cart-item.dto';

@Controller('carts')
export class CartsController {
  constructor(private readonly cartsService: CartsService) {}

  // GET /api/carts — all items for current user (with product details)
  @Get()
  findAll(@CurrentUser() user: any) {
    return this.cartsService.findAll(user.id);
  }

  // POST /api/carts/items — add or increment an item immediately
  @Post('items')
  addItem(@CurrentUser() user: any, @Body() dto: AddCartItemDto) {
    return this.cartsService.upsertItem(user.id, dto);
  }

  // PATCH /api/carts/items/:productId?sessionId=default — set exact qty
  @Patch('items/:productId')
  setQty(
    @CurrentUser() user: any,
    @Param('productId') productId: string,
    @Body() dto: SetItemQtyDto,
    @Query('sessionId') sessionId?: string,
  ) {
    return this.cartsService.setQty(user.id, productId, dto, sessionId);
  }

  // DELETE /api/carts/items/:productId?sessionId=default — remove one item
  @Delete('items/:productId')
  removeItem(
    @CurrentUser() user: any,
    @Param('productId') productId: string,
    @Query('sessionId') sessionId?: string,
  ) {
    this.cartsService.removeItem(user.id, productId, sessionId);
    return { success: true };
  }

  // DELETE /api/carts/sessions/:sessionId — clear all items in a session
  @Delete('sessions/:sessionId')
  clearSession(@CurrentUser() user: any, @Param('sessionId') sessionId: string) {
    this.cartsService.clearSession(user.id, sessionId);
    return { success: true };
  }
}
