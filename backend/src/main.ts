import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as express from 'express';
import * as dotenv from 'dotenv';

dotenv.config();

const server = express();
let isInitialized = false;

async function bootstrapNest() {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server));

  // Set global API prefix
  app.setGlobalPrefix('api/v1');

  // Enable CORS
  app.enableCors();

  // Register Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Register Global Exception Filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Register Global Success Response Interceptor
  app.useGlobalInterceptors(new ResponseInterceptor());

  // Configure Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('Hospital Management Platform API')
    .setDescription('The API documentation for the Hospital Management Platform')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  await app.init();
  isInitialized = true;
}

// Vercel serverless request entrypoint handler
const handler = async (req: any, res: any) => {
  if (!isInitialized) {
    await bootstrapNest();
  }
  server(req, res);
};

// Start local listener if running locally outside of Vercel
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  const port = process.env.PORT || 3000;
  bootstrapNest().then(() => {
    server.listen(port, () => {
      console.log(`Application is running on: http://localhost:${port}/api/v1`);
      console.log(`Swagger documentation is available at: http://localhost:${port}/docs`);
    });
  });
}

export default handler;
