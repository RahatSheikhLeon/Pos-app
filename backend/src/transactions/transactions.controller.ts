import { Controller, Get, Post, Param, Query, Body } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { ReturnTransactionDto } from './dto/return-transaction.dto';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  findAll(
    @CurrentUser() user: any,
    @Query('search')   search?:   string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo')   dateTo?:   string,
  ) {
    return this.transactionsService.findAll(user.id, search, dateFrom, dateTo);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.transactionsService.findOne(id);
  }

  @Post(':id/return')
  returnTransaction(
    @Param('id') id: string,
    @Body() body: ReturnTransactionDto,
  ) {
    return this.transactionsService.processReturn(id, body?.items);
  }
}
