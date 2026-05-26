import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
// import { AccessTokenGuard } from './auth/guards/accessToken.guard';
import { AppModule } from './app.module';
import { IntrospectionGuard } from './auth/guards/introspectToken.guard';
import { AwardModule } from './award/award.module';
import { WalletModule } from './wallet/wallet.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const appVersion = configService.get('APP_VERSION');

  // Retrieve the instance of AccessTokenGuard from Nest's context
  const introspectionGuard = app.get(IntrospectionGuard);

  // Set the guard globally using the retrieved instance
  app.useGlobalGuards(introspectionGuard);

  // Keep API routes under /v1 so they match nginx proxy paths.
  app.setGlobalPrefix('v1');

  const config = new DocumentBuilder()
    .setTitle('Energenius Award System API')
    .setVersion(appVersion || '1.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    include: [AwardModule, WalletModule],
  });
  SwaggerModule.setup('v1/api-docs', app, document);

  // Remove cors when going live
  app.enableCors();

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    })
  );

  const port = Number(configService.get('PORT') ?? 3001);
  await app.listen(port, '0.0.0.0');
}
bootstrap();
