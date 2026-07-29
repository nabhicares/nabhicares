import {
  IsNotEmpty,
  IsString,
  IsEmail,
  IsOptional,
  IsArray,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePatientDto {
  @ApiProperty({ example: 'Alice Smith' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: 'alice.smith@example.com' })
  @IsNotEmpty()
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: '+19876543210' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(32)
  phone: string;

  @ApiProperty({ example: '1990-01-01' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(32)
  dateOfBirth: string;

  @ApiProperty({ example: 'Female' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(32)
  gender: string;

  @ApiProperty({ example: ['Peanuts', 'Penicillin'], required: false })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @MaxLength(120, { each: true })
  allergies?: string[];

  @ApiProperty({ example: ['Hypertension'], required: false })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @MaxLength(240, { each: true })
  medicalHistory?: string[];
}
