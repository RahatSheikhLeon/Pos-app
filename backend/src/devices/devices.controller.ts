import { Controller, Get, Post, Delete, Body, Param, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { DevicesService } from './devices.service';
import { CurrentUser } from '../auth/current-user.decorator';

const COOKIE_NAME = 'access_token';

@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  /** List active sessions. Pass ?fingerprint=<id> to mark the caller's device as isCurrent. */
  @Get()
  list(@CurrentUser() user: any, @Query('fingerprint') fingerprint?: string) {
    return this.devicesService.listDevices(user.id, fingerprint);
  }

  /** Full snapshot for the Device Limit page. */
  @Get('limit-info')
  limitInfo(@CurrentUser() user: any, @Query('fingerprint') fingerprint?: string) {
    return this.devicesService.getLimitInfo(user.id, fingerprint);
  }

  /** Full usage summary for the Subscription page — includes upgrade history. */
  @Get('summary')
  summary(@CurrentUser() user: any, @Query('fingerprint') fingerprint?: string) {
    return this.devicesService.getUsageSummary(user.id, fingerprint);
  }

  @Post('register')
  register(
    @CurrentUser() user: any,
    @Body() body: { fingerprint: string; name?: string },
  ) {
    return this.devicesService.registerDevice(user.id, body.fingerprint, body.name || 'Device', user.plan);
  }

  /**
   * Secure device removal — requires account password.
   *
   * Only the target device's record is deleted. Because the JWT strategy now
   * validates per-device sessionId (not a global tokenVersion), ALL other
   * browser sessions remain valid and unaffected.
   *
   * Special case: if the caller removes their OWN device, the response instructs
   * the frontend to redirect to login (their cookie is cleared server-side).
   * If they remove a DIFFERENT device, their own session continues normally.
   */
  @Post(':id/remove')
  async secureRemove(
    @CurrentUser() user: any,
    @Param('id') deviceId: string,
    @Body() body: { password: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { removedOwnDevice } = await this.devicesService.secureRemoveDevice(
      user.id, deviceId, body.password, user.deviceId,
    );

    if (removedOwnDevice) {
      // Caller removed themselves — clear their cookie so the frontend redirects to login
      res.clearCookie(COOKIE_NAME, { path: '/' });
      return { success: true, loggedOut: true };
    }

    // Caller removed a different device — their JWT remains valid, no cookie change needed
    return { success: true, loggedOut: false };
  }

  /** Simple removal without password (DeviceLimitReached page only). */
  @Delete(':id')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.devicesService.removeDevice(user.id, id);
  }
}
