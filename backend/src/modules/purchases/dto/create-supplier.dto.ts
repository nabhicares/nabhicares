import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
}
