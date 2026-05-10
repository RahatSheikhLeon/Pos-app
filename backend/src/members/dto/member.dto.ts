import {
  IsString, IsNumber, IsEmail, IsOptional, MaxLength, Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMemberDto {
  @IsString()
  @MaxLength(100)
  membershipId: string;

  @IsString()
  @MaxLength(255)
  name: string;

  @IsString()
  @MaxLength(20)
  phone: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  due?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  joinedAt?: string;
}

export class UpdateMemberDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  membershipId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  due?: number;
}
