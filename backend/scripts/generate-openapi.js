// Emits the OpenAPI document without starting a listener, so the incoming
// frontend can generate a typed client (ADR-0013) from the real contract.
const { NestFactory } = require('@nestjs/core');
const { DocumentBuilder, SwaggerModule } = require('@nestjs/swagger');
const { AppModule } = require('../dist/app.module');
const fs = require('fs');

(async () => {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api', { exclude: [{ path: 'health', method: 0 }] });
  app.enableVersioning({ type: 0, defaultVersion: '1' });

  const config = new DocumentBuilder()
    .setTitle('JEEVAN API')
    .setDescription('Jharkhand Ecosystem for Experiential Validation Adoption Network')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const doc = SwaggerModule.createDocument(app, config);
  fs.writeFileSync('openapi.json', JSON.stringify(doc, null, 2));
  const paths = Object.keys(doc.paths).length;
  console.log(`openapi.json written — ${paths} paths`);
  await app.close();
  process.exit(0);
})();
