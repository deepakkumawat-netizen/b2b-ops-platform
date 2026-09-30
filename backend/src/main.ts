import helmet from 'helmet';
import { json } from 'express';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Render (like most hosts) sits behind a reverse proxy. Without this,
  // req.ip is the proxy's address, so ThrottlerGuard's per-IP limits become
  // one shared limit for the whole team, and req.secure is always false.
  app.set('trust proxy', 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        // Helmet's defaults, plus Google Calendar in a frame: the Calendar page shows it.
        directives: { frameSrc: ["'self'", 'https://calendar.google.com'] },
      },
    }),
  );
  // Logo uploads come as base64 JSON (images up to 5 MB), so only their two
  // routes get a big body limit; registered first, it handles those requests
  // and the general parser below skips them. Everything else stays at 3 MB
  // (enough for 500 students in one submit).
  app.use(['/api/public/teacher-form/:schoolId/:token/logo', '/api/schools/:schoolId/onboarding/assets/:kind'], json({ limit: '15mb' }));
  app.useBodyParser('json', { limit: '3mb' });
  const corsOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({ origin: corsOrigins, credentials: true });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`B2B Ops Platform API listening on http://localhost:${port}`);
}
bootstrap();
