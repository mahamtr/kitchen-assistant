import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { abortOnError: false });
  app.setGlobalPrefix('api/v1');

  // CORS: allow origins from env var BACKEND_CORS_ORIGINS (comma-separated)
  // Fallback: allow all origins (useful for local dev). In production, set BACKEND_CORS_ORIGINS.
  const originsEnv = process.env.BACKEND_CORS_ORIGINS;
  const allowedOrigins = originsEnv
    ? originsEnv.split(',').map((s) => s.trim())
    : '*';

  app.enableCors({
    origin: allowedOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
