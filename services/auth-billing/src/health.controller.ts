import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { register } from './metrics';

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

  @Get('metrics')
  async metrics(@Res() res: Response) {
    try {
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    } catch (err) {
      res.status(500).end(err);
    }
  }
}
