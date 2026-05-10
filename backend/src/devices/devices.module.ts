import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';

@Module({
  imports: [
    JwtModule.register({
      secret:      process.env.JWT_SECRET || 'shopiq_secret_key',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [DevicesController],
  providers:   [DevicesService],
  exports:     [DevicesService],
})
export class DevicesModule {}
