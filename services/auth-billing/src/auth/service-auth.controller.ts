import { Controller, Post, Body, UnauthorizedException, Headers } from '@nestjs/common';
import { ServiceAuthService } from './service-auth.service';

interface ServiceTokenRequest {
  serviceName: string;
}

interface ServiceTokenResponse {
  token: string;
  expiresIn: string;
}

/**
 * Controller for service-to-service authentication endpoints
 */
@Controller('auth/service')
export class ServiceAuthController {
  constructor(private readonly serviceAuthService: ServiceAuthService) {}

  /**
   * Generate a new service token
   * POST /auth/service/token
   * Body: { serviceName: string }
   */
  @Post('token')
  async generateToken(@Body() body: ServiceTokenRequest): Promise<ServiceTokenResponse> {
    const { serviceName } = body;

    if (!serviceName) {
      throw new UnauthorizedException('Service name is required');
    }

    // In production, you might want to validate the service name against a whitelist
    const validServices = [
      'gateway',
      'intelligence',
      'memory',
      'noble-spirit',
      'ngs-curriculum',
      'reflection-worker',
      'distillation-worker',
    ];

    if (!validServices.includes(serviceName)) {
      throw new UnauthorizedException('Invalid service name');
    }

    const token = this.serviceAuthService.generateServiceToken(serviceName);

    return {
      token,
      expiresIn: '24h',
    };
  }

  /**
   * Refresh/renew a service token
   * POST /auth/service/refresh
   * Headers: X-Service-Token (current token)
   */
  @Post('refresh')
  async refreshToken(@Headers('x-service-token') currentToken: string): Promise<ServiceTokenResponse> {
    if (!currentToken) {
      throw new UnauthorizedException('Current service token is required');
    }

    // Verify the current token
    const decoded = this.serviceAuthService.verifyServiceToken(currentToken);

    // Generate a new token with the same service name
    const newToken = this.serviceAuthService.generateServiceToken(decoded.serviceName);

    return {
      token: newToken,
      expiresIn: '24h',
    };
  }

  /**
   * Verify a service token (for testing purposes)
   * POST /auth/service/verify
   * Headers: X-Service-Token
   */
  @Post('verify')
  async verifyToken(@Headers('x-service-token') token: string): Promise<{ valid: boolean; serviceName?: string }> {
    if (!token) {
      throw new UnauthorizedException('Service token is required');
    }

    try {
      const decoded = this.serviceAuthService.verifyServiceToken(token);
      return {
        valid: true,
        serviceName: decoded.serviceName,
      };
    } catch (error) {
      return {
        valid: false,
      };
    }
  }
}
