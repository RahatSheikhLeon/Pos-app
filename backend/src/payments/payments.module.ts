import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { UserSubscriptionsModule } from '../user-subscriptions/user-subscriptions.module';

@Module({
  imports: [UserSubscriptionsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
