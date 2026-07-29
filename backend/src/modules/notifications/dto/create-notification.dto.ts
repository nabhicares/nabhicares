import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateNotificationDto {
  @ApiProperty({ example: 'patient-id-123' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(128)
  userId: string;

  @ApiProperty({ example: 'Prescription Ready' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(120)
  title: string;

  @ApiProperty({ example: 'Your medicines are ready for collection at the pharmacy.' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  body: string;
}
