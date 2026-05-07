import { Controller, Get, Post, Delete, Body, Param } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Get()
  list(@CurrentUser() user: any) {
    return this.devicesService.listDevices(user.id);
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
