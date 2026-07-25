import { IsNotEmpty, IsString, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
}
