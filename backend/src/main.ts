import './instrument';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { LoggerService } from './common/logger.service';
import express from 'express';
import helmet from 'helmet';

async function bootstrap() {
  const logger = new LoggerService();

  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    bodyParser: true,
    logger,
  });

  // Trust proxy headers (Render, Cloudflare, etc.) for correct IP-based rate limiting
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', 1);

  // Security headers (CSP, HSTS, X-Frame-Options, etc.)
  app.use(helmet());

  // Cap request body at 15 MB (covers largest photo uploads; rejects abuse)
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ limit: '15mb', extended: true }));
  app.use(express.raw({ limit: '15mb' }));

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
