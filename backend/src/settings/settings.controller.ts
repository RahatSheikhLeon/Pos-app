import { Controller, Get, Put, Body } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  getSettings(@CurrentUser() user: any) {
    return this.settingsService.getSettings(user.id);
  }

  @Put()
  updateSettings(@CurrentUser() user: any, @Body() body: any) {
    return this.settingsService.updateSettings(user.id, body);
  }
}
