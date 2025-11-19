import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ServiceAuthService } from './service-auth.service';
import { serviceAuthAttempts } from '../metrics';

/**
 * Guard to enforce service-to-service authentication
 * Validates X-Service-Token header on protected endpoints
 */
@Injectable()
export class ServiceAuthGuard implements CanActivate {
  constructor(private readonly serviceAuthService: ServiceAuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const serviceToken = request.headers['x-service-token'];

    if (!serviceToken) {
      serviceAuthAttempts.labels({ service: 'unknown', result: 'failure' }).inc();
      throw new UnauthorizedException('Service token required for service-to-service calls');
    }

    try {
      const decoded = this.serviceAuthService.verifyServiceToken(serviceToken);
      
      // Add service context to request
      request.service = {
        serviceName: decoded.serviceName,
        authenticated: true,
      };

      serviceAuthAttempts.labels({ service: decoded.serviceName, result: 'success' }).inc();
      return true;
    } catch (error) {
      serviceAuthAttempts.labels({ service: 'unknown', result: 'failure' }).inc();
      throw new UnauthorizedException('Invalid service token');
    }
  }
}
