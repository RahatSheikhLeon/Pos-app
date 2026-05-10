import {
  IsBoolean, IsEmail, IsNumber, IsOptional, IsString, Max, MaxLength, Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  storeName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  taxRate?: number;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5)
  currencySymbol?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  receiptHeader?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  receiptFooter?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  taxId?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  showLogo?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  showTaxId?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  theme?: string;
}
