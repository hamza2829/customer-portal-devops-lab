import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail, IsEnum, IsInt, IsISO8601, IsString, IsUUID, Length, Matches, Max, Min, ValidateIf,
} from 'class-validator';
import { OrderStatus } from './model';

export const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export class LoginDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 128)
  password!: string;
}

export class CustomerDto {
  @ApiProperty()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @Length(1, 100)
  name!: string;

  @ApiProperty()
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail()
  @Length(1, 254)
  email!: string;
}

export class CustomerPatch extends PartialType(CustomerDto, { skipNullProperties: false }) {}

export class OrderDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  customerId!: string;

  @ApiProperty()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @Length(1, 120)
  item!: string;

  @ApiProperty({ minimum: 1, maximum: 100000000 })
  @IsInt()
  @Min(1)
  @Max(100000000)
  amountCents!: number;

  @ApiProperty({ enum: OrderStatus, required: false })
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiProperty({ format: 'date' })
  @Matches(/^(?!0000)\d{4}-\d{2}-\d{2}$/)
  @IsISO8601({ strict: true })
  orderDate!: string;
}

export class OrderPatch extends PartialType(OrderDto, { skipNullProperties: false }) {}

export class OrderFilter {
  @ApiProperty({ enum: OrderStatus, required: false })
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(OrderStatus)
  status?: OrderStatus;
}

export class ReportQuery {
  @ApiProperty({ example: '2026-01' })
  @Matches(MONTH_PATTERN)
  @Matches(/^(?!0000)/)
  month!: string;

  @ApiProperty({ enum: ['json', 'csv'], required: false })
  @ValidateIf((_object, value) => value !== undefined)
  @Matches(/^(json|csv)$/)
  format?: 'json' | 'csv';
}
