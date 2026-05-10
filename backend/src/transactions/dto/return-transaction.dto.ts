import { IsArray, IsInt, IsOptional, IsPositive, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ReturnItemDto {
  @IsString()
  @MaxLength(100)
  productId: string;

  @IsInt()
  @IsPositive()
  @Type(() => Number)
  quantity: number;
}

export class ReturnTransactionDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReturnItemDto)
  items?: ReturnItemDto[];
}
