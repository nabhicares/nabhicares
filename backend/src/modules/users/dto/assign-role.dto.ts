import { IsNotEmpty, IsString, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignRoleDto {
  @ApiProperty({ example: 'mock-uid-doctor' })
  @IsNotEmpty()
  @IsString()
  uid: string;

  @ApiProperty({ example: 'doctor', enum: ['super_admin', 'hospital_admin', 'doctor', 'receptionist', 'pharmacist', 'patient'] })
  @IsNotEmpty()
  @IsString()
  @IsIn(['super_admin', 'hospital_admin', 'doctor', 'receptionist', 'pharmacist', 'patient'])
  role: string;
}
