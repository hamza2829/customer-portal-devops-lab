import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule, configure } from './app';
import { PortalService } from './portal';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configure(app);
  app.enableShutdownHooks();
  await app.init();
  await app.get(PortalService).seed();
  await app.listen(Number(process.env.PORT ?? 3001), '0.0.0.0');
}

void bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
