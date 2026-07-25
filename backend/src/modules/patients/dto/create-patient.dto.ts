import { IsNotEmpty, IsString, IsEmail, IsOptional, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePatientDto {
  @ApiProperty({ example: 'Alice Smith' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 'alice.smith@example.com' })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({ example: '+19876543210' })
  @IsNotEmpty()
  @IsString()
  phone: string;

  @ApiProperty({ example: '1990-01-01' })
  @IsNotEmpty()
  @IsString()
  dateOfBirth: string;

  @ApiProperty({ example: 'Female' })
  @IsNotEmpty()
  @IsString()
  gender: string;

  @ApiProperty({ example: ['Peanuts', 'Penicillin'], required: false })
  @IsOptional()
  @IsArray()
  allergies?: string[];

  @ApiProperty({ example: ['Hypertension'], required: false })
  @IsOptional()
  @IsArray()
  medicalHistory?: string[];
}
