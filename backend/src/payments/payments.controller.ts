import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // User: initiate payment (creates pending row)
  @Post('initiate')
  initiate(@CurrentUser() user: any, @Body() body: { planId: string }) {
    return this.paymentsService.initiate(user.id, user.email, body.planId);
  }

  // User: get own payment history
  @Get('my')
  findMine(@CurrentUser() user: any) {
    return this.paymentsService.findMine(user.id);
  }

  // User/frontend: check a specific transaction
  @Get('trx/:trxId')
  findByTrxId(@Param('trxId') trxId: string) {
    return this.paymentsService.findByTrxId(trxId);
  }

  // Frontend success redirect handler (called by frontend after gateway returns)
  @Public()
  @Post('confirm-success')
  confirmSuccess(@Query('trx_id') trxId: string) {
    return this.paymentsService.confirmSuccess(trxId);
  }

  // Frontend failure redirect handler
  @Public()
  @Post('confirm-failed')
  confirmFailed(@Query('trx_id') trxId: string) {
    return this.paymentsService.markFailed(trxId);
  }

  // Payment gateway webhook (SSLCommerz / bKash / Stripe)
  @Public()
  @Post('webhook')
  webhook(@Body() body: any) {
    return this.paymentsService.handleWebhook(body);
  }
}
