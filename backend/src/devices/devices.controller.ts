import { Controller, Get, Post, Delete, Body, Param, Query, Res } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Response } from 'express';
import { DevicesService } from './devices.service';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from '../auth/current-user.decorator';

const COOKIE_NAME    = 'access_token';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

@Controller('devices')
export class DevicesController {
  constructor(
    private readonly devicesService: DevicesService,
    private readonly prisma:         PrismaService,
    private readonly jwtService:     JwtService,
  ) {}

  /** List devices. Pass ?fingerprint=<id> to mark the caller's device as isCurrent. */
  @Get()
  list(@CurrentUser() user: any, @Query('fingerprint') fingerprint?: string) {
    return this.devicesService.listDevices(user.id, fingerprint);
  }

  /** Full snapshot for the Device Limit page. */
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

  /**
   * Secure device removal — requires account password.
   * On success: device is deleted, all sessions are invalidated (tokenVersion++),
   * and a fresh JWT is issued for the caller so their session continues without
   * interruption.
   */
  @Post(':id/remove')
  async secureRemove(
    @CurrentUser() user: any,
    @Param('id') deviceId: string,
    @Body() body: { password: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { newTokenVersion } = await this.devicesService.secureRemoveDevice(
      user.id, deviceId, body.password,
    );

    // Re-issue JWT with the new tokenVersion so the caller's session stays valid.
    // All OTHER devices will be rejected on their next request (tokenVersion mismatch).
    const freshUser = await this.prisma.user.findUnique({
      where:  { id: user.id },
      select: { id: true, email: true, name: true, plan: true, isAdmin: true },
    });

    const token = this.jwtService.sign({
      sub:          freshUser!.id,
      email:        freshUser!.email,
      name:         freshUser!.name,
      plan:         freshUser!.plan,
      isAdmin:      freshUser!.isAdmin,
      tokenVersion: newTokenVersion,
    });

    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:   COOKIE_MAX_AGE,
      path:     '/',
    });

    return { success: true };
  }

  /** Simple removal — no password required (used from DeviceLimitReached page). */
  @Delete(':id')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.devicesService.removeDevice(user.id, id);
  }
}
