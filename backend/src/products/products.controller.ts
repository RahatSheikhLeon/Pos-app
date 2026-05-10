import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll(
    @CurrentUser() user: any,
    @Query('search') search?: string,
    @Query('category') category?: string,
  ) {
    return this.productsService.findAll(user.id, search, category);
  }

  @Get('categories')
  getCategories(@CurrentUser() user: any) {
    return this.productsService.getCategories(user.id);
  }

  @Get(':id')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.productsService.findOne(user.id, id);
  }

  @Post()
  create(@CurrentUser() user: any, @Body() body: CreateProductDto) {
    return this.productsService.create(user.id, user.plan, body);
  }

  @Put(':id')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() body: UpdateProductDto) {
    return this.productsService.update(user.id, id, body);
  }

  @Delete(':id')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    this.productsService.remove(user.id, id);
    return { success: true };
  }
}
