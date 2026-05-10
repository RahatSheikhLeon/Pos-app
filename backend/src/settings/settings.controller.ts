import { Controller, Get, Put, Body } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { UpdateSettingsDto } from './dto/settings.dto';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  getSettings(@CurrentUser() user: any) {
    return this.settingsService.getSettings(user.id);
  }

  @Put()
  updateSettings(@CurrentUser() user: any, @Body() body: UpdateSettingsDto) {
    return this.settingsService.updateSettings(user.id, body);
  }
}
