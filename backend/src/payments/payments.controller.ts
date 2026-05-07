import { Controller, Get } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('my')
  findMine(@CurrentUser() user: any) {
    return this.paymentsService.findMine(user.id);
  }
}
