import { IsIn, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SendSaleInvoiceDto {
  @ApiPropertyOptional({ enum: ['sms', 'whatsapp', 'both'], default: 'both' })
  @IsOptional()
  @IsIn(['sms', 'whatsapp', 'both'])
  channels?: 'sms' | 'whatsapp' | 'both';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;
}
