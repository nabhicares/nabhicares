import { IsNotEmpty, IsString, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMedicineDto {
  @ApiProperty({ example: 'Paracetamol 500mg' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 'Acetaminophen' })
  @IsNotEmpty()
  @IsString()
  genericName: string;

  @ApiProperty({ example: 'Analgesics' })
  @IsNotEmpty()
  @IsString()
  category: string;

  @ApiProperty({ example: 100 })
  @IsNotEmpty()
  @IsNumber()
  reorderLevel: number;

  @ApiPropertyOptional({ example: 'GlaxoSmithKline' })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional({ example: 'tablet' })
  @IsOptional()
  @IsString()
  form?: string;

  @ApiPropertyOptional({ example: '500mg' })
  @IsOptional()
  @IsString()
  strength?: string;

  @ApiPropertyOptional({ example: 'strip' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsNumber()
  packSize?: number;

  @ApiPropertyOptional({ example: 1.50 })
  @IsOptional()
  @IsNumber()
  mrp?: number;

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @IsNumber()
  gstPercent?: number;

  @ApiPropertyOptional({ example: '8901234567890' })
  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiPropertyOptional({ example: 'Shelf A-4' })
  @IsOptional()
  @IsString()
  location?: string;
}
