import { IsNotEmpty, IsString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class PrescriptionItemDto {
  @ApiProperty({ example: 'medicine-id-123' })
  @IsNotEmpty()
  @IsString()
  medicineId: string;

  @ApiProperty({ example: 'Paracetamol 500mg' })
  @IsNotEmpty()
  @IsString()
  medicineName: string;

  @ApiProperty({ example: '1-0-1' })
  @IsNotEmpty()
  @IsString()
  dosage: string;

  @ApiProperty({ example: '5 days' })
  @IsNotEmpty()
  @IsString()
  duration: string;

  @ApiProperty({ example: 'After food' })
  @IsNotEmpty()
  @IsString()
  instructions: string;
}

export class CreatePrescriptionDto {
  @ApiProperty({ example: 'consultation-id-123' })
  @IsNotEmpty()
  @IsString()
  consultationId: string;

  @ApiProperty({ example: 'patient-id-123' })
  @IsNotEmpty()
  @IsString()
  patientId: string;

  @ApiProperty({ type: [PrescriptionItemDto] })
  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrescriptionItemDto)
  items: PrescriptionItemDto[];
}
