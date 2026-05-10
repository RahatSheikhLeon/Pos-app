import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  /** List devices; pass ?fingerprint=<id> to mark the caller's device as isCurrent */
  @Get()
  list(@CurrentUser() user: any, @Query('fingerprint') fingerprint?: string) {
    return this.devicesService.listDevices(user.id, fingerprint);
  }

  /** Full device-limit snapshot used by the Device Limit page */
  @Get('limit-info')
  limitInfo(@CurrentUser() user: any, @Query('fingerprint') fingerprint?: string) {
    return this.devicesService.getLimitInfo(user.id, fingerprint);
  }

  @Post('register')
  register(
    @CurrentUser() user: any,
    @Body() body: { fingerprint: string; name?: string },
  ) {
    return this.devicesService.registerDevice(user.id, body.fingerprint, body.name || 'Device', user.plan);
  }

  @Delete(':id')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.devicesService.removeDevice(user.id, id);
  }
}
