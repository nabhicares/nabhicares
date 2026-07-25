import { IsNotEmpty, IsString, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ReceiveItemDto {
  @ApiProperty({ example: 'medicine-id-123' })
  @IsNotEmpty()
  @IsString()
  medicineId: string;

  @ApiProperty({ example: 'BATCH-PO-101' })
  @IsNotEmpty()
  @IsString()
  batchNo: string;

  @ApiProperty({ example: '2028-12-31' })
  @IsNotEmpty()
  @IsString()
  expiryDate: string;

  @ApiProperty({ example: 50 })
  @IsNotEmpty()
  @IsNumber()
  quantityReceived: number;
}

export class ReceivePurchaseOrderDto {
  @ApiProperty({ type: [ReceiveItemDto] })
  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiveItemDto)
  items: ReceiveItemDto[];
}
