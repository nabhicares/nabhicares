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

/** Explicit update DTO — never accept uid/status mass-assignment. */
export class UpdatePatientDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  dateOfBirth?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  gender?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @MaxLength(120, { each: true })
  allergies?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @MaxLength(240, { each: true })
  medicalHistory?: string[];
}
