import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('health')
  health() {
    return {
      status: 'healthy',
      service: 'auth-billing',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    };
  }
}
