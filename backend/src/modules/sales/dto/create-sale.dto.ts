import { IsArray, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SaleItemDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  medicineId: string;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  qty: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  batchNo: string;
}

export class InlineCustomerDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;
}

export class CreateSaleDto {
  @ApiProperty({ example: 'HOSP-001' })
  @IsString()
  @IsNotEmpty()
  hospitalId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ type: InlineCustomerDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => InlineCustomerDto)
  customer?: InlineCustomerDto;

  @ApiProperty({ type: [SaleItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items: SaleItemDto[];

  @ApiProperty({ enum: ['cash', 'upi', 'credit'] })
  @IsIn(['cash', 'upi', 'credit'])
  paymentMethod: 'cash' | 'upi' | 'credit';

  @ApiPropertyOptional({ description: 'Referring doctor for commission / credit ledger' })
  @IsOptional()
  @IsString()
  doctorId?: string;

  @ApiPropertyOptional({ description: 'Required / recommended for UPI reconciliation' })
  @IsOptional()
  @IsString()
  upiTransactionRef?: string;
}
