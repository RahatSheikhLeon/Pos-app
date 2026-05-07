import { Controller, Get } from '@nestjs/common';
import { UserSubscriptionsService } from './user-subscriptions.service';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('subscriptions')
export class UserSubscriptionsController {
  constructor(private readonly service: UserSubscriptionsService) {}

  @Get('my')
  getMySubscription(@CurrentUser() user: any) {
    return this.service.getMySubscription(user.id);
  }
}
