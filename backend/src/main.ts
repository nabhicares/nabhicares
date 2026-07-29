import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { ExpressAdapter } from '@nestjs/platform-express';
import express = require('express');
import helmet = require('helmet');
import rateLimit = require('express-rate-limit');
import * as dotenv from 'dotenv';
import {
  assertCriticalEnv,
  getCorsOrigins,
  isProductionRuntime,
} from './common/config/env.validation';

dotenv.config();

try {
  assertCriticalEnv();
} catch (err) {
  // Fail loudly at cold start so Vercel logs show the config problem.
  console.error(err instanceof Error ? err.message : err);
  throw err;
}

const server = express();
// Vercel sits behind a reverse proxy — required for correct client IPs + rate limiting.
server.set('trust proxy', 1);
let isInitialized = false;

// Security headers on every response (including pre-Nest cold starts).
const helmetMiddleware = (helmet as any).default ?? (helmet as any);
server.use(
  helmetMiddleware({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    frameguard: { action: 'deny' },
    noSniff: true,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: { policy: 'no-referrer' },
  }),
);

const rateLimitFn = (rateLimit as any).default ?? (rateLimit as any);

// Auth-adjacent endpoints (this API has no classic login/reset; bootstrap sets passwords).
const authBurstLimiter = rateLimitFn({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many attempts. Try again later.',
      request_id: 'RATE',
    },
  },
});

const passwordActionLimiter = rateLimitFn({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many password / bootstrap attempts. Try again in an hour.',
      request_id: 'RATE',
    },
  },
});

// Messaging spam guard — cap enqueued push notifications per IP.
const messagingLimiter = rateLimitFn({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many notifications. Slow down.',
      request_id: 'RATE',
    },
  },
});

// Coarse global limiter (per serverless instance) to blunt scraping / DDoS bursts.
const globalLimiter = rateLimitFn({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests. Try again shortly.',
      request_id: 'RATE',
    },
  },
});

server.use('/api/v1', globalLimiter);
server.use('/api/v1/users/register', authBurstLimiter);
server.use('/api/v1/users/bootstrap', passwordActionLimiter);
server.use('/api/v1/users/bootstrap', authBurstLimiter);
server.use('/api/v1/notifications/push', messagingLimiter);

async function bootstrapNest() {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    logger: isProductionRuntime() ? ['error', 'warn'] : ['log', 'error', 'warn', 'debug'],
  });

  app.setGlobalPrefix('api/v1');

  const allowedOrigins = getCorsOrigins();
  app.enableCors({
    origin: (origin, callback) => {
      // Non-browser clients (Flutter mobile, curl) often send no Origin.
      if (!origin) {
        return callback(null, true);
      }
      if (allowedOrigins === false) {
        return callback(null, false);
      }
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Bootstrap-Secret'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  // Swagger is debug surface — off by default in production.
  const enableSwagger =
    process.env.ENABLE_SWAGGER?.trim() === 'true' || !isProductionRuntime();
  if (enableSwagger) {
    const config = new DocumentBuilder()
      .setTitle('Hospital Management Platform API')
      .setDescription('The API documentation for the Hospital Management Platform')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  await app.init();
  isInitialized = true;
}

const handler = async (req: any, res: any) => {
  if (!isInitialized) {
    await bootstrapNest();
  }
  server(req, res);
};

// Local listener only outside production / Vercel.
if (!isProductionRuntime() && !process.env.VERCEL) {
  const port = process.env.PORT || 3000;
  bootstrapNest()
    .then(() => {
      server.listen(port, () => {
        // Intentional local-only startup notice (not a debug dump of secrets).
        process.stdout.write(`Listening on http://localhost:${port}/api/v1\n`);
      });
    })
    .catch((err) => {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    });
}

export default handler;
