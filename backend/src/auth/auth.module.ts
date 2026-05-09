import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { DevicesModule } from '../devices/devices.module';
import { EmailModule }   from '../email/email.module';

@Module({
  imports: [
    PassportModule,
    DevicesModule,
    EmailModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'shopiq_secret_key',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [JwtStrategy],
})
export class AuthModule {}
