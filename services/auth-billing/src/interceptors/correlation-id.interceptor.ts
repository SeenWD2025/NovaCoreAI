/**
 * Correlation ID interceptor for request tracing
 */
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Get correlation ID from header or generate new one
    const correlationId = request.headers['x-correlation-id'] || uuidv4();

    // Attach to request object for use in controllers
    request.correlationId = correlationId;

    // Add to response headers
    response.setHeader('X-Correlation-ID', correlationId);

    return next.handle();
  }
}
