import { IsNotEmpty, IsString, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDoctorDto {
  @ApiProperty({ example: 'Dr. Gregory House' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 'house@hospital.com' })
  @IsNotEmpty()
  @IsString()
  email: string;

  @ApiProperty({ example: 'Diagnostics' })
  @IsNotEmpty()
  @IsString()
  specialty: string;

  @ApiProperty({ example: 150 })
  @IsNotEmpty()
  @IsNumber()
  consultationFee: number;

  @ApiProperty({ example: 'MD, Board Certified Diagnostics', required: false })
  @IsOptional()
  @IsString()
  qualifications?: string;
}
