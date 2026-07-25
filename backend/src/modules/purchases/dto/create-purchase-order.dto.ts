import { IsNotEmpty, IsString, IsArray, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class PurchaseItemDto {
  @ApiProperty({ example: 'medicine-id-123' })
  @IsNotEmpty()
  @IsString()
  medicineId: string;

  @ApiProperty({ example: 100 })
  @IsNotEmpty()
  @IsNumber()
  quantity: number;

  @ApiProperty({ example: 1.25 })
  @IsNotEmpty()
  @IsNumber()
  unitPrice: number;
}

export class CreatePurchaseOrderDto {
  @ApiProperty({ example: 'supplier-id-123' })
  @IsNotEmpty()
  @IsString()
  supplierId: string;

  @ApiProperty({ type: [PurchaseItemDto] })
  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemDto)
  items: PurchaseItemDto[];
}
