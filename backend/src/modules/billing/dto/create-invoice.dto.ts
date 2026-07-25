import { IsNotEmpty, IsString, IsArray, IsNumber, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class InvoiceLineItemDto {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: 'Consultation Fee - Diagnostics' })
  description: string;

  @IsNotEmpty()
  @IsNumber()
  @ApiProperty({ example: 150 })
  amount: number;
}

export class CreateInvoiceDto {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: 'patient-id-123' })
  patientId: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ example: 'appointment-id-123', required: false })
  appointmentId?: string;

  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineItemDto)
  @ApiProperty({ type: [InvoiceLineItemDto] })
  items: InvoiceLineItemDto[];
}
