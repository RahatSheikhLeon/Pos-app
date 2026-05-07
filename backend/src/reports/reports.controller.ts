import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { PlanGuard } from '../auth/plan.guard';

@UseGuards(PlanGuard)

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  getReports(@CurrentUser() user: any, @Query('days') days?: string) {
    return this.reportsService.getReports(user.id, days ? parseInt(days, 10) : 30);
  }
}
