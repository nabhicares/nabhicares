import { IsNotEmpty, IsString, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ManualStockAddDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  medicineId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  batchNo: string;

  @ApiProperty({ example: 50 })
  @IsNumber()
  @Min(1)
  qty: number;

  @ApiProperty({ example: '2027-12-31' })
  @IsNotEmpty()
  @IsString()
  expiryDate: string;

  @ApiProperty({ example: 'HOSP-001' })
  @IsNotEmpty()
  @IsString()
  hospitalId: string;

  @ApiPropertyOptional({ example: 12.5 })
  @IsOptional()
  @IsNumber()
  unitPrice?: number;
}
