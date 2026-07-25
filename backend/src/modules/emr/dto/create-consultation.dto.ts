import { IsNotEmpty, IsString, IsObject, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VitalsDto {
  @ApiProperty({ example: '120/80' })
  @IsNotEmpty()
  @IsString()
  bloodPressure: string;

  @ApiProperty({ example: '36.8' })
  @IsNotEmpty()
  @IsString()
  temperatureCelsius: string;

  @ApiProperty({ example: '72' })
  @IsNotEmpty()
  @IsString()
  heartRateBpm: string;

  @ApiProperty({ example: '70' })
  @IsNotEmpty()
  @IsString()
  weightKg: string;
}

export class CreateConsultationDto {
  @ApiProperty({ example: 'appointment-id-123' })
  @IsNotEmpty()
  @IsString()
  appointmentId: string;

  @ApiProperty({ example: 'patient-id-123' })
  @IsNotEmpty()
  @IsString()
  patientId: string;

  @ApiProperty({ example: 'Fever, cough, sore throat' })
  @IsNotEmpty()
  @IsString()
  symptoms: string;

  @ApiProperty({ example: 'Acute Pharyngitis' })
  @IsNotEmpty()
  @IsString()
  diagnosis: string;

  @ApiProperty({ type: VitalsDto })
  @IsNotEmpty()
  @IsObject()
  vitals: VitalsDto;

  @ApiProperty({ example: 'Advised rest and plenty of fluids.', required: false })
  @IsOptional()
  @IsString()
  clinicalNotes?: string;
}
