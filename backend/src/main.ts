import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import * as dotenv from 'dotenv';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}/api/v1`);
  console.log(`Swagger documentation is available at: http://localhost:${port}/docs`);
}
bootstrap();
