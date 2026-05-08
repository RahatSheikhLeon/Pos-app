import {
  Controller, Get, Post, Put, Patch, Delete,
  Body, Param, Query,
} from '@nestjs/common';
import { IsString, IsOptional, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { CartsService } from './carts.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { AddCartItemDto, SetItemQtyDto } from './dto/cart-item.dto';

class UpsertSessionDto {
  @IsOptional() @IsString()
  customerName?: string;

  @IsOptional() @IsString()
  customerId?: string;

  @IsOptional() @IsNumber() @Min(0) @Type(() => Number)
  discount?: number;
}

@Controller('carts')
export class CartsController {
  constructor(private readonly cartsService: CartsService) {}

  // GET /api/carts — items + session metadata for the current user
  @Get()
  findAll(@CurrentUser() user: any) {
    return this.cartsService.findAll(user.id);
  }

  // PUT /api/carts/sessions/:sessionId — create or update session metadata
  // Must be called immediately when a cart tab is opened so customer identity
  // is written to the DB before any items are added.
  @Put('sessions/:sessionId')
  upsertSession(
    @CurrentUser() user: any,
    @Param('sessionId') sessionId: string,
    @Body() dto: UpsertSessionDto,
  ) {
    return this.cartsService.upsertSession(user.id, sessionId, dto);
  }

  // POST /api/carts/items — add or increment an item
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

  // DELETE /api/carts/sessions/:sessionId — clear items + session metadata
  @Delete('sessions/:sessionId')
  clearSession(@CurrentUser() user: any, @Param('sessionId') sessionId: string) {
    this.cartsService.clearSession(user.id, sessionId);
    return { success: true };
  }
}
