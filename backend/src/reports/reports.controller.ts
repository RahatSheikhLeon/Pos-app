import { Controller, Get, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  getReports(@CurrentUser() user: any, @Query('days') days?: string) {
    return this.reportsService.getReports(user.id, days ? parseInt(days, 10) : 30);
  }
}
