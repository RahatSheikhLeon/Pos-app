import { Module } from '@nestjs/common';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { ProductsModule } from '../products/products.module';
import { TransactionsModule } from '../transactions/transactions.module';

@Module({
  imports: [ProductsModule, TransactionsModule],
  controllers: [CheckoutController],
  providers: [CheckoutService],
})
export class CheckoutModule {}
