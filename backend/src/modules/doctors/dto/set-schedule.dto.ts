import { IsNotEmpty, IsString, IsArray, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DaySchedule {
  @ApiProperty({ example: 'Monday' })
  @IsNotEmpty()
  @IsString()
  dayOfWeek: string;

  @ApiProperty({ example: '09:00' })
  @IsNotEmpty()
  @IsString()
  startTime: string;

  @ApiProperty({ example: '17:00' })
  @IsNotEmpty()
  @IsString()
  endTime: string;
}

export class SetScheduleDto {
  @ApiProperty({ example: 30 })
  @IsNotEmpty()
  @IsNumber()
  slotDurationMinutes: number;

  @ApiProperty({ type: [DaySchedule] })
  @IsNotEmpty()
  @IsArray()
  weeklySchedules: DaySchedule[];
}
