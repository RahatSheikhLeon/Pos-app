import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { DashboardModule } from './dashboard/dashboard.module';
import { ProductsModule } from './products/products.module';
import { CheckoutModule } from './checkout/checkout.module';
import { TransactionsModule } from './transactions/transactions.module';
import { ReportsModule } from './reports/reports.module';
import { SettingsModule } from './settings/settings.module';
import { MembersModule } from './members/members.module';
import { CartsModule } from './carts/carts.module';
import { DevicesModule } from './devices/devices.module';
import { SubscriptionPlansModule } from './subscription-plans/subscription-plans.module';
import { UserSubscriptionsModule } from './user-subscriptions/user-subscriptions.module';
import { StripeModule } from './stripe/stripe.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    DashboardModule,
    ProductsModule,
    CheckoutModule,
    TransactionsModule,
    ReportsModule,
    SettingsModule,
    MembersModule,
    CartsModule,
    DevicesModule,
    SubscriptionPlansModule,
    UserSubscriptionsModule,
    StripeModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
