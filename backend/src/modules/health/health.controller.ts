import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Get('ping')
  @ApiOperation({ summary: 'System operational status validation check' })
  ping() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    };
  }
}
