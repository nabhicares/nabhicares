import { IsNotEmpty, IsString, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SystemSettingsDto {
  @ApiProperty({ example: 'Pharma Store General Hospital' })
  @IsNotEmpty()
  @IsString()
  hospitalName: string;

  @ApiProperty({ example: 18 })
  @IsNotEmpty()
  @IsNumber()
  taxPercentage: number;

  @ApiProperty({ example: 10 })
  @IsNotEmpty()
  @IsNumber()
  lowStockThreshold: number;
}
