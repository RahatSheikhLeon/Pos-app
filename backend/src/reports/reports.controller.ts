import { Controller, Get, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  getReports(@Query('days') days?: string) {
    return this.reportsService.getReports(days ? parseInt(days, 10) : 30);
  }
}
