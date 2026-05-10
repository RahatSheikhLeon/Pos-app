import {
  IsEmail, IsOptional, IsString, MaxLength, MinLength,
} from 'class-validator';

// ── Registration ───────────────────────────────────────────────────

export class RegisterStartDto {
  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password: string;

  @IsString()
  @MaxLength(255)
  name: string;
}

export class RegisterVerifyDto {
  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  @MinLength(6)
  @MaxLength(6)
  otp: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  fingerprint?: string;
}

export class RegisterResendDto {
  @IsEmail()
  @MaxLength(255)
  email: string;
}

// ── Login ──────────────────────────────────────────────────────────

export class LoginDto {
  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  fingerprint?: string;
}

// ── Password management ────────────────────────────────────────────

export class ForgotPasswordDto {
  @IsEmail()
  @MaxLength(255)
  email: string;
}

export class VerifyResetOtpDto {
  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  @MinLength(6)
  @MaxLength(6)
  otp: string;
}

export class ResetPasswordDto {
  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  @MaxLength(200)
  resetToken: string;

  @IsString()
  @MinLength(6)
  @MaxLength(128)
  newPassword: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  currentPassword: string;

  @IsString()
  @MinLength(6)
  @MaxLength(128)
  newPassword: string;
}

export class VerifyPasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password: string;
}

export class RecheckDeviceDto {
  @IsString()
  @MaxLength(200)
  fingerprint: string;
}
