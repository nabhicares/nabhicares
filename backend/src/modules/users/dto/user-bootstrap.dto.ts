import { IsNotEmpty, IsString, IsEmail, MinLength, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UserBootstrapDto {
  @ApiProperty({ example: 'staff@pharmastore.com' })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'securePassword123' })
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'John Pharmacist' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 'pharmacist', enum: ['super_admin', 'hospital_admin', 'doctor', 'receptionist', 'pharmacist', 'patient'] })
  @IsNotEmpty()
  @IsString()
  @IsIn(['super_admin', 'hospital_admin', 'doctor', 'receptionist', 'pharmacist', 'patient'])
  role: string;
}
