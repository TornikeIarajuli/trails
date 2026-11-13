import './instrument';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { LoggerService } from './common/logger.service';
import { trustProxyHops } from './common/env';
import express from 'express';
import helmet from 'helmet';

async function bootstrap() {
  const logger = new LoggerService();

  const app = await NestFactory.create(AppModule, { logger });

  // Number of reverse proxies in front of the app whose X-Forwarded-For entry Express
  // believes when it derives req.ip (the rate limiter's fallback key).
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', trustProxyHops());

  // Security headers (CSP, HSTS, X-Frame-Options, etc.)
  app.use(helmet());

  // JSON and form bodies are small. Uploads are raw bodies that the media controller
  // reads itself, with its own size cap.
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ limit: '1mb', extended: true }));

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      process.env.WEB_ADMIN_URL,
    ].filter(Boolean) as string[],
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`Server running on http://localhost:${port}/api`, 'Bootstrap');
}
void bootstrap();
