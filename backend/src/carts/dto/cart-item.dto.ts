import { IsString, IsInt, IsNumber, IsOptional, IsPositive, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AddCartItemDto {
  @IsString()
  productId: string;

  @IsInt()
  @IsPositive()
  @Type(() => Number)
  qty: number;

  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  price: number;

  @IsOptional()
  @IsString()
  sessionId?: string;
}

export class SetItemQtyDto {
  @IsInt()
  @Min(0)
  @Type(() => Number)
  qty: number;
}
