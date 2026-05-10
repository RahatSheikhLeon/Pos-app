import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.setGlobalPrefix('api');

  app.use(cookieParser());

  app.enableCors({
    origin:      process.env.FRONTEND_URL || 'http://localhost:3000',
    methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  /**
   * Global validation pipeline — the last line of defense before service code runs.
   *
   * whitelist:            strip properties that have no decorator on the DTO class.
   * forbidNonWhitelisted: escalate stripping to a 400 error so callers know they
   *                       sent an unexpected field (catches injection probes early).
   * transform:            coerce incoming primitives to the types declared in the DTO
   *                       (e.g. query-string "5" → number 5).
   * exceptionFactory:     return a consistent { success, message, errors[] } shape
   *                       instead of the default NestJS validation error envelope.
   */
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist:            true,
      forbidNonWhitelisted: true,
      transform:            true,
      exceptionFactory: (errors) => {
        const fieldErrors = errors.flatMap((e) =>
          Object.values(e.constraints ?? {}).map((msg) => ({
            field:   e.property,
            message: msg,
          })),
        );
        return new BadRequestException({
          success: false,
          message: 'Validation failed',
          errors:  fieldErrors,
        });
      },
    }),
  );

  await app.listen(3001);
  console.log('ShopIQ API → http://localhost:3001/api');
}
bootstrap();
