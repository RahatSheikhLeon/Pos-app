import { Controller, Post, Get, Body, Res, Req } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';
import { CurrentUser } from './current-user.decorator';
import {
  RegisterStartDto, RegisterVerifyDto, RegisterResendDto,
  LoginDto, ForgotPasswordDto, VerifyResetOtpDto, ResetPasswordDto,
  ChangePasswordDto, VerifyPasswordDto, RecheckDeviceDto,
} from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService:  JwtService,
  ) {}

  // ── Registration ───────────────────────────────────────────────────

  @Public()
  @Post('register')
  startRegistration(@Body() body: RegisterStartDto) {
    return this.authService.startRegistration(body.email, body.password, body.name);
  }

  @Public()
  @Post('register/verify')
  verifyRegistration(
    @Body() body: RegisterVerifyDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.verifyRegistration(body.email, body.otp, res, body.fingerprint);
  }

  @Public()
  @Post('register/resend')
  resendRegistrationOtp(@Body() body: RegisterResendDto) {
    return this.authService.resendRegistrationOtp(body.email);
  }

  // ── Login ──────────────────────────────────────────────────────────

  @Public()
  @Post('login')
  login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.login(body.email, body.password, res, body.fingerprint);
  }

  // ── Password reset (public — unauthenticated flow) ─────────────────

  @Public()
  @Post('forgot-password')
  forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.authService.forgotPassword(body.email);
  }

  @Public()
  @Post('forgot-password/verify-otp')
  verifyResetOtp(@Body() body: VerifyResetOtpDto) {
    return this.authService.verifyResetOtp(body.email, body.otp);
  }

  @Public()
  @Post('reset-password')
  resetPassword(@Body() body: ResetPasswordDto) {
    return this.authService.resetPassword(body.email, body.resetToken, body.newPassword);
  }

  // ── Authenticated account management ──────────────────────────────

  @Post('change-password')
  changePassword(@CurrentUser() user: any, @Body() body: ChangePasswordDto) {
    return this.authService.changePassword(user.id, body.currentPassword, body.newPassword);
  }

  @Post('verify-password')
  async verifyPassword(@CurrentUser() user: any, @Body() body: VerifyPasswordDto) {
    await this.authService.verifyPassword(user.id, body.password);
    return { valid: true };
  }

  @Post('recheck-device')
  recheckDeviceLimit(
    @CurrentUser() user: any,
    @Body() body: RecheckDeviceDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.recheckDeviceLimit(user.id, body.fingerprint, res);
  }

  // ── Logout (public — no valid token required) ─────────────────────

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
    } catch { /* ignore decode errors */ }
    return this.authService.logout(userId, deviceId, res);
  }

  // ── Profile ───────────────────────────────────────────────────────

  @Get('profile')
  getProfile(@CurrentUser() user: any) {
    return this.authService.getProfile(user.id, user.plan);
  }
}
