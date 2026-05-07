import { Controller, Get } from '@nestjs/common';
import { SubscriptionPlansService } from './subscription-plans.service';
import { Public } from '../auth/public.decorator';

@Controller('subscription-plans')
export class SubscriptionPlansController {
  constructor(private readonly service: SubscriptionPlansService) {}

  @Public()
  @Get()
  findAll() {
    return this.service.findAll();
  }
}
