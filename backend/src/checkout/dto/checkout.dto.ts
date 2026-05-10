import {
  IsString, IsNumber, IsOptional, IsIn, IsArray,
  ValidateNested, IsInt, IsPositive, Min, MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CheckoutItemDto {
  @IsString()
  @MaxLength(100)
  productId: string;

  @IsInt()
  @IsPositive()
  @Type(() => Number)
  quantity: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  unitPrice: number;
}

export class CheckoutDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemDto)
  items: CheckoutItemDto[];

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  subtotal: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  tax: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  discount: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  total: number;

  @IsIn(['cash', 'card', 'wallet'])
  paymentMethod: 'cash' | 'card' | 'wallet';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  memberId?: string;
}
