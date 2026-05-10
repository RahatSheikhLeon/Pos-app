import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { sanitizeObject } from './sanitize.util';

/**
 * Global sanitization interceptor.
 *
 * Runs in the interceptor phase — BEFORE the global ValidationPipe — so every
 * incoming request body is stripped of HTML/XSS payloads before DTO validation
 * runs. This means validators see already-sanitized data and the final service
 * layer receives clean input regardless of whether a field has a custom transformer.
 *
 * Skipped for:
 * - GET / DELETE requests (no body)
 * - Stripe webhook (rawBody — binary, must not be modified)
 */
@Injectable()
export class SanitizeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<{ body: unknown; url: string }>();

    // Skip the Stripe webhook — it uses rawBody and must not be touched
    if (req.url?.includes('/stripe/webhook')) return next.handle();

    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }

    return next.handle();
  }
}
