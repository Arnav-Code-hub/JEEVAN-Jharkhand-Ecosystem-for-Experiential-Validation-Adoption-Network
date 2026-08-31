import { RequestMethod, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';

import { AppModule } from './app.module';
import type { Env } from './shared/config/env.validation';

async function bootstrap() {
  // bufferLogs defers startup logging until the pino logger is available, so no
  // line is emitted through the default logger in a different format.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService<Env, true>);
  const nodeEnv = config.get('NODE_ENV', { infer: true });
  const isProduction = nodeEnv === 'production';

  // ADR-0016: URI path versioning. Controllers declare only their resource path;
  // `api` and `v1` are applied globally, so no controller hardcodes either.
  // /health is excluded from both so probes stay stable across version bumps.
  app.setGlobalPrefix('api', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.use(helmet());

  const corsOrigins = config.get('CORS_ORIGINS', { infer: true });
  app.enableCors({
    origin: corsOrigins === '*' ? true : corsOrigins.split(',').map((o) => o.trim()),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      // Reject unknown fields outright rather than silently dropping them — a
      // typo'd field name should fail loudly, not vanish.
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  // Swagger describes routes that may not be public; keep it out of production.
  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('JEEVAN API')
      .setDescription('Jharkhand Ecosystem for Experiential Validation Adoption Network')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig));
  }

  // Lets Nest run module teardown (close the DB pool, drain in-flight requests)
  // on SIGTERM — required for clean container restarts (ADR-0014).
  app.enableShutdownHooks();

  const port = config.get('PORT', { infer: true });
  await app.listen(port);

  app.get(Logger).log(`JEEVAN API listening on :${port} [${nodeEnv}] — base path /api/v1`);
}

// `bufferLogs: true` holds startup logs until the pino logger is attached. If the
// app dies before that — bad config, unreachable database — the buffer is never
// flushed and the process exits silently. Fall back to the console so a failed
// boot is never invisible to an operator.
bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[bootstrap] Startup failed:', error);
  process.exit(1);
});
