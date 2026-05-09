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
  register(
    @Body() body: { email: string; password: string; name: string; fingerprint?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.register(body.email, body.password, body.name, res, body.fingerprint);
  }

  @Public()
  @Post('login')
  login(
    @Body() body: { email: string; password: string; fingerprint?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.login(body.email, body.password, res, body.fingerprint);
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    return this.authService.logout(res);
  }

  @Get('profile')
  getProfile(@CurrentUser() user: any) {
    // Pass the JWT plan so the effective plan (not DB plan) is returned.
    // This ensures over-limit devices consistently see 'free' on page reloads.
    return this.authService.getProfile(user.id, user.plan);
  }
}
