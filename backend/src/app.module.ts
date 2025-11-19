import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AwardsModule } from './awards/awards.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    AwardsModule,
  ],
})
export class AppModule {}
