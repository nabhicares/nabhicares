import { IsNotEmpty, IsString, IsNumber, Min, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class RecordPaymentDto {
  @ApiProperty({ example: 1200 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ example: 'cash', enum: ['cash', 'card', 'upi', 'other'] })
  @IsNotEmpty()
  @IsString()
  @IsIn(['cash', 'card', 'upi', 'other'])
  method: string;
}
