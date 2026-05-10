import { Controller, Post, Get, Body, Res } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';
import { CurrentUser } from './current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  startRegistration(
    @Body() body: { email: string; password: string; name: string },
  ) {
    return this.authService.startRegistration(body.email, body.password, body.name);
  }

  @Public()
  @Post('register/verify')
  verifyRegistration(
    @Body() body: { email: string; otp: string; fingerprint?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.verifyRegistration(body.email, body.otp, res, body.fingerprint);
  }

  @Public()
  @Post('register/resend')
  resendRegistrationOtp(@Body() body: { email: string }) {
    return this.authService.resendRegistrationOtp(body.email);
  }

  @Public()
  @Post('login')
  login(
    @Body() body: { email: string; password: string; fingerprint?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.login(body.email, body.password, res, body.fingerprint);
  }

  /** Re-issue JWT after device removal or extra-slot purchase; no password required. */
  @Post('recheck-device')
  recheckDeviceLimit(
    @CurrentUser() user: any,
    @Body() body: { fingerprint: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.recheckDeviceLimit(user.id, body.fingerprint, res);
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    return this.authService.logout(res);
  }

  @Get('profile')
  getProfile(@CurrentUser() user: any) {
    return this.authService.getProfile(user.id, user.plan);
  }
}
