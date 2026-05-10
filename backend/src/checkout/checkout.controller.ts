import { Controller, Post, Body } from '@nestjs/common';
import { CheckoutService } from './checkout.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { CheckoutDto } from './dto/checkout.dto';

@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post()
  processCheckout(@CurrentUser() user: any, @Body() body: CheckoutDto) {
    return this.checkoutService.processCheckout(user.id, body);
  }
}
