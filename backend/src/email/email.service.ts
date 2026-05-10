import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger      = new Logger(EmailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly from:        string;
  private readonly appName      = 'ShopIQ POS';

  constructor() {
    this.from = process.env.EMAIL_FROM
      || `"ShopIQ POS" <${process.env.EMAIL_USER ?? 'noreply@shopiq.com'}>`;

    this.transporter = nodemailer.createTransport({
      host:   process.env.EMAIL_HOST  || 'smtp.gmail.com',
      port:   parseInt(process.env.EMAIL_PORT || '587', 10),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  async sendVerificationOtp(to: string, name: string, otp: string): Promise<void> {
    const html = this.buildOtpHtml(name, otp);
    try {
      const info = await this.transporter.sendMail({
        from:    this.from,
        to,
        subject: `${otp} is your ${this.appName} verification code`,
        html,
      });
      this.logger.log(`OTP email sent → ${to} | msgId: ${info.messageId}`);
    } catch (err: any) {
      this.logger.error(`Failed to send OTP to ${to}: ${err.message}`);
      throw new InternalServerErrorException(
        'Failed to send verification email. Please try again.',
      );
    }
  }

  async sendPasswordResetOtp(to: string, name: string, otp: string): Promise<void> {
    const html = this.buildPasswordResetHtml(name, otp);
    try {
      const info = await this.transporter.sendMail({
        from:    this.from,
        to,
        subject: `${otp} is your ${this.appName} password reset code`,
        html,
      });
      this.logger.log(`Password reset OTP sent → ${to} | msgId: ${info.messageId}`);
    } catch (err: any) {
      this.logger.error(`Failed to send password reset OTP to ${to}: ${err.message}`);
      throw new InternalServerErrorException('Failed to send reset email. Please try again.');
    }
  }

  private buildPasswordResetHtml(name: string, otp: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;background:#f4f4f5;">
  <tr><td align="center">
    <table width="480" cellpadding="0" cellspacing="0"
      style="background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.08);overflow:hidden;">
      <tr><td style="background:linear-gradient(135deg,#dc2626,#b91c1c);padding:32px 40px;text-align:center;">
        <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">⚡ ShopIQ POS</h1>
      </td></tr>
      <tr><td style="padding:36px 40px;">
        <h2 style="margin:0 0 8px;color:#111827;font-size:20px;">Reset your password</h2>
        <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
          Hi ${name}, enter the code below to reset your password. It expires in <strong>10 minutes</strong>.
        </p>
        <div style="background:#fff5f5;border:2px dashed #dc2626;border-radius:10px;
                    padding:24px;text-align:center;margin-bottom:28px;">
          <p style="margin:0 0 6px;font-size:12px;color:#dc2626;font-weight:600;
                    letter-spacing:1px;text-transform:uppercase;">Reset Code</p>
          <span style="font-size:44px;font-weight:800;color:#b91c1c;letter-spacing:14px;">${otp}</span>
        </div>
        <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">
          If you didn't request a password reset, you can safely ignore this email.
          Your password will not change.
        </p>
      </td></tr>
      <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;
                    padding:16px 40px;text-align:center;">
        <p style="margin:0;font-size:11px;color:#9ca3af;">
          © ${new Date().getFullYear()} ShopIQ POS
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
  }

  private buildOtpHtml(name: string, otp: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;background:#f4f4f5;">
  <tr><td align="center">
    <table width="480" cellpadding="0" cellspacing="0"
      style="background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.08);overflow:hidden;">
      <tr><td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:32px 40px;text-align:center;">
        <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">⚡ ShopIQ POS</h1>
      </td></tr>
      <tr><td style="padding:36px 40px;">
        <h2 style="margin:0 0 8px;color:#111827;font-size:20px;">Verify your email address</h2>
        <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
          Hi ${name}, enter the code below to activate your account. It expires in <strong>10 minutes</strong>.
        </p>
        <div style="background:#f0f0ff;border:2px dashed #6366f1;border-radius:10px;
                    padding:24px;text-align:center;margin-bottom:28px;">
          <p style="margin:0 0 6px;font-size:12px;color:#6366f1;font-weight:600;
                    letter-spacing:1px;text-transform:uppercase;">Verification Code</p>
          <span style="font-size:44px;font-weight:800;color:#4f46e5;letter-spacing:14px;">${otp}</span>
        </div>
        <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">
          If you didn't create a ShopIQ account, you can safely ignore this email.
        </p>
      </td></tr>
      <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;
                    padding:16px 40px;text-align:center;">
        <p style="margin:0;font-size:11px;color:#9ca3af;">
          © ${new Date().getFullYear()} ShopIQ POS
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
  }
}
