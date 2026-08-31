import 'reflect-metadata';
import { config as loadDotenv } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';

// The TypeORM CLI boots this file directly, outside the Nest DI container, so it
// loads .env itself. The running application does NOT use this path — it builds
// its options from the validated ConfigService (see app.module.ts).
loadDotenv();

export const MIGRATIONS_GLOB = [__dirname + '/migrations/*.{ts,js}'];
export const ENTITIES_GLOB = [__dirname + '/../modules/**/*.entity.{ts,js}'];

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: ENTITIES_GLOB,
  migrations: MIGRATIONS_GLOB,
  // ADR-0001 / Phase 1: schema is managed exclusively by migrations. Never set
  // this to true — auto-sync can silently drop the gate audit trail and the
  // escrow ledger that the governance model depends on.
  synchronize: false,
  migrationsRun: false,
};

export default new DataSource(dataSourceOptions);
