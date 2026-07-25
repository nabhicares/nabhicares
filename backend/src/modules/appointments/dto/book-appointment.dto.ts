import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BookAppointmentDto {
  @ApiProperty({ example: 'patient-id-123' })
  @IsNotEmpty()
  @IsString()
  patientId: string;

  @ApiProperty({ example: 'doctor-id-123' })
  @IsNotEmpty()
  @IsString()
  doctorId: string;

  @ApiProperty({ example: '2026-07-30' })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be in format YYYY-MM-DD' })
  date: string;

  @ApiProperty({ example: '09:30' })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'Time slot must be in format HH:MM' })
  timeSlot: string;
}
