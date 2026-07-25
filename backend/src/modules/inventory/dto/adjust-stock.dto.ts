import { IsNotEmpty, IsString, IsNumber, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdjustStockDto {
  @ApiProperty({ example: 'medicine-id-123' })
  @IsNotEmpty()
  @IsString()
  medicineId: string;

  @ApiProperty({ example: 'BATCH-2026-001' })
  @IsNotEmpty()
  @IsString()
  batchNo: string;

  @ApiProperty({ example: -10 })
  @IsNotEmpty()
  @IsNumber()
  quantityChange: number;

  @ApiProperty({ example: 'damaged', enum: ['correction', 'damaged', 'expired', 'loss'] })
  @IsNotEmpty()
  @IsString()
  @IsIn(['correction', 'damaged', 'expired', 'loss'])
  reason: string;
}
