import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.enableCors({
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
  });
  
  app.setGlobalPrefix('v1');
  
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('ENERGENIUS Awards API')
    .setDescription('ENERGENIUS Sandbox Awards Backend API Documentation')
    .setVersion('1.0')
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('v1/api-docs', app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port);
  
  console.log(`
  🚀 ENERGENIUS Backend Server Running!
  📡 API: http://localhost:${port}/v1
  📚 Swagger: http://localhost:${port}/v1/api-docs
  `);
}

bootstrap();