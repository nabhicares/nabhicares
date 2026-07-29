import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpsertProfileDto {
  @ApiProperty({ example: 'HOSP-001' })
  @IsString()
  @IsNotEmpty()
  hospitalId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shopName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'URL or data-URI for shop logo' })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  signatureText?: string;

  @ApiPropertyOptional({ description: 'URL or data-URI for signature image' })
  @IsOptional()
  @IsString()
  signatureUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gstin?: string;
}
