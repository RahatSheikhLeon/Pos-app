import { Module } from '@nestjs/common';
import { DashboardModule } from './dashboard/dashboard.module';
import { ProductsModule } from './products/products.module';
import { CheckoutModule } from './checkout/checkout.module';
import { TransactionsModule } from './transactions/transactions.module';
import { ReportsModule } from './reports/reports.module';
import { SettingsModule } from './settings/settings.module';
import { MembersModule } from './members/members.module';
import { CartsModule } from './carts/carts.module';

@Module({
  imports: [
    DashboardModule,
    ProductsModule,
    CheckoutModule,
    TransactionsModule,
    ReportsModule,
    SettingsModule,
    MembersModule,
    CartsModule,
  ],
})
export class AppModule {}
