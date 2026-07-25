import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateNotificationDto {
  @ApiProperty({ example: 'patient-id-123' })
  @IsNotEmpty()
  @IsString()
  userId: string;

  @ApiProperty({ example: 'Prescription Ready' })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({ example: 'Your medicines are ready for collection at the pharmacy.' })
  @IsNotEmpty()
  @IsString()
  body: string;
}
