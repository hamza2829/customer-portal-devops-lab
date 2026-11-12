import {
  Controller, Get, INestApplication, Module, ServiceUnavailableException, ValidationPipe,
} from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ApiTags, DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuthController, AuthGuard, AuthService } from './auth';
import { Customer, Order, PortalSeed } from './model';
import { CustomersController, OrdersController, PortalService } from './portal';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async check() {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'ok' };
    } catch {
      throw new ServiceUnavailableException('Database unavailable');
    }
  }
}

@Module({
  imports: [
    JwtModule.register({ secret: process.env.JWT_SECRET ?? 'lab-jwt-signing-secret', signOptions: { expiresIn: '1h' } }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? '127.0.0.1',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.POSTGRES_USER ?? 'portal',
      password: process.env.POSTGRES_PASSWORD ?? 'portal-demo-db',
      database: process.env.POSTGRES_DB ?? 'portal',
      entities: [Customer, Order, PortalSeed],
      synchronize: true,
      retryAttempts: 20,
      retryDelay: 2000,
    }),
    TypeOrmModule.forFeature([Customer, Order]),
  ],
  controllers: [HealthController, AuthController, CustomersController, OrdersController],
  providers: [AuthService, AuthGuard, PortalService],
})
export class AppModule {}

export function configure(app: INestApplication) {
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  const config = new DocumentBuilder()
    .setTitle('Customer Portal Demo API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, () => SwaggerModule.createDocument(app, config));
}
