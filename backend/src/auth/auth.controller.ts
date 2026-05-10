import { Controller, Post, Get, Body, Res, Req } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';
import { CurrentUser } from './current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService:  JwtService,
  ) {}

  @Public()
  @Post('register')
  startRegistration(@Body() body: { email: string; password: string; name: string }) {
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

  // ── Password-reset flow (all @Public) ────────────────────────────

  @Public()
  @Post('forgot-password')
  forgotPassword(@Body() body: { email: string }) {
    return this.authService.forgotPassword(body.email);
  }

  @Public()
  @Post('forgot-password/verify-otp')
  verifyResetOtp(@Body() body: { email: string; otp: string }) {
    return this.authService.verifyResetOtp(body.email, body.otp);
  }

  @Public()
  @Post('reset-password')
  resetPassword(@Body() body: { email: string; resetToken: string; newPassword: string }) {
    return this.authService.resetPassword(body.email, body.resetToken, body.newPassword);
  }

  /** Verify the current user's password — used by the logout confirmation modal. */
  @Post('verify-password')
  async verifyPassword(
    @CurrentUser() user: any,
    @Body() body: { password: string },
  ) {
    await this.authService.verifyPassword(user.id, body.password);
    return { valid: true };
  }

  /** Re-issue JWT after device slot purchase; requires a valid session. */
  @Post('recheck-device')
  recheckDeviceLimit(
    @CurrentUser() user: any,
    @Body() body: { fingerprint: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.recheckDeviceLimit(user.id, body.fingerprint, res);
  }

  /**
   * Logout must NEVER require a valid token — the user is logging out precisely
   * because they want to end their session.
   *
   * @Public() bypasses JwtAuthGuard so even expired or structurally invalid JWTs
   * (e.g. old tokens issued before the per-device sessionId field existed) can
   * still trigger a clean logout.
   *
   * We decode the cookie without validating the signature (best-effort) to get
   * the userId + deviceId for DB cleanup. If the cookie is absent or malformed,
   * we still clear the cookie — the user is signed out either way.
   */
  @Public()
  @Post('logout')
  logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    let userId:   string | undefined;
    let deviceId: string | undefined;

    try {
      const token = (req as any).cookies?.access_token as string | undefined;
      if (token) {
        const payload = this.jwtService.decode(token) as any;
        userId   = payload?.sub;
        deviceId = payload?.deviceId;
      }
    } catch { /* ignore — clear the cookie regardless */ }

    return this.authService.logout(userId, deviceId, res);
  }

  @Get('profile')
  getProfile(@CurrentUser() user: any) {
    return this.authService.getProfile(user.id, user.plan);
  }
}
