import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Connects via Neon's own serverless driver (HTTPS/WebSocket) instead of
// Prisma's default Rust engine, which resolves/connects to the DB itself and
// bypasses Node's dns module — Render can't route IPv6 to Neon's endpoint,
// so the default engine fails with P1001 even with a correct connection
// string (confirmed on the reference TicketPlatform project). This works
// identically for local dev too, so there's no separate code path to keep
// in sync.
neonConfig.webSocketConstructor = ws;

// Thin wrapper so every module injects PrismaService instead of constructing
// its own PrismaClient — one connection pool, clean shutdown.
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    // Built inside the constructor, not at module load time: Nest provider
    // construction happens during NestFactory.create(), which runs after
    // ConfigModule.forRoot() has already loaded .env into process.env. A
    // module-level `new Pool(...)` would run at require() time instead —
    // before .env is loaded — and silently fall back to Pool's localhost
    // defaults (confirmed failure: "No database host or connection string
    // was set... (host: localhost)").
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaNeon(pool);
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
