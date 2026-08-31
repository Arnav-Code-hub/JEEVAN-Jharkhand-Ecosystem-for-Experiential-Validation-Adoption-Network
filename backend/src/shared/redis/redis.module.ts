import { Global, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import Redis from 'ioredis';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

/**
 * Redis holds OTP state and refresh tokens (ADR-0004). Both must survive a
 * process restart and be shared across instances, which is exactly what the
 * previous in-memory `Map` could not do.
 *
 * Injected by token rather than by concrete class so tests can substitute a
 * fake without touching the network.
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const client = new Redis({
          host: config.getOrThrow<string>('REDIS_HOST'),
          port: config.getOrThrow<number>('REDIS_PORT'),
          password: config.get<string | undefined>('REDIS_PASSWORD') || undefined,
          maxRetriesPerRequest: 3,
          lazyConnect: false,
        });

        const logger = new Logger('Redis');
        client.on('error', (err) => logger.error({ err }, 'Redis connection error'));
        client.on('connect', () => logger.log('Redis connected'));

        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(private readonly moduleRef: ModuleRef) {}

  async onApplicationShutdown(): Promise<void> {
    const client = this.moduleRef.get<Redis>(REDIS_CLIENT, { strict: false });
    await client?.quit().catch(() => undefined);
  }
}
