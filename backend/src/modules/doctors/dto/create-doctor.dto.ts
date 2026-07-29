import { IsNotEmpty, IsString, IsNumber, IsOptional, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDoctorDto {
  @ApiProperty({ example: 'Dr. Gregory House' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'house@hospital.com' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: 'Diagnostics' })
  @ValidateIf((o) => !o.specialization)
  @IsNotEmpty()
  @IsString()
  specialty?: string;

  @ApiPropertyOptional({ example: 'Diagnostics', description: 'Alias for specialty' })
  @ValidateIf((o) => !o.specialty)
  @IsNotEmpty()
  @IsString()
  specialization?: string;

  @ApiPropertyOptional({ example: 150 })
  @IsOptional()
  @IsNumber()
  consultationFee?: number;

  @ApiPropertyOptional({ example: 'MD, Board Certified Diagnostics' })
  @IsOptional()
  @IsString()
  qualifications?: string;

  @ApiPropertyOptional({ example: 'HOSP-001' })
  @IsOptional()
  @IsString()
  hospitalId?: string;

  @ApiPropertyOptional({ example: '+919800000099' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 5, description: 'Commission % on referred credit sales' })
  @IsOptional()
  @IsNumber()
  commissionRate?: number;
}
