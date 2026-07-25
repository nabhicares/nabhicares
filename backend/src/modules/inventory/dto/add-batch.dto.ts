import { IsNotEmpty, IsString, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddBatchDto {
  @ApiProperty({ example: 'BATCH-2026-001' })
  @IsNotEmpty()
  @IsString()
  batchNo: string;

  @ApiProperty({ example: '2028-12-31' })
  @IsNotEmpty()
  @IsString()
  expiryDate: string;

  @ApiProperty({ example: 500 })
  @IsNotEmpty()
  @IsNumber()
  quantity: number;

  @ApiProperty({ example: 1.5 })
  @IsNotEmpty()
  @IsNumber()
  unitPrice: number;
}
