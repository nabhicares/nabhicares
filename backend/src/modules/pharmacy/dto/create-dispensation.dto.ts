import { IsNotEmpty, IsString, IsArray, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class DispenseItemDto {
  @ApiProperty({ example: 'medicine-id-123' })
  @IsNotEmpty()
  @IsString()
  medicineId: string;

  @ApiProperty({ example: 'BATCH-2026-001' })
  @IsNotEmpty()
  @IsString()
  batchNo: string;

  @ApiProperty({ example: 10 })
  @IsNotEmpty()
  @IsNumber()
  quantity: number;
}

export class CreateDispensationDto {
  @ApiProperty({ example: 'prescription-id-123' })
  @IsNotEmpty()
  @IsString()
  prescriptionId: string;

  @ApiProperty({ type: [DispenseItemDto] })
  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DispenseItemDto)
  items: DispenseItemDto[];
}
