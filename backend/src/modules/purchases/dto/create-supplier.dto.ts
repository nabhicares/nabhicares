import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSupplierDto {
  @ApiProperty({ example: 'PharmaCorp Distributors' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 'contacts@pharmacorp.com' })
  @IsNotEmpty()
  @IsString()
  contactEmail: string;

  @ApiProperty({ example: '123 Industrial Parkway' })
  @IsNotEmpty()
  @IsString()
  address: string;

  @ApiPropertyOptional({ example: '+919999999999' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: '36AAAAA0000A1Z5' })
  @IsOptional()
  @IsString()
  gstin?: string;

  @ApiPropertyOptional({ example: 'Mr. Rajesh Kumar' })
  @IsOptional()
  @IsString()
  contactPerson?: string;
}
