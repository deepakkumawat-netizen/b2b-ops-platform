import { join } from 'path';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { SchoolsModule } from './schools/schools.module';
import { PhaseTasksModule } from './phase-tasks/phase-tasks.module';
import { TeachersModule } from './teachers/teachers.module';
import { InfraDiagnosticsModule } from './infra-diagnostics/infra-diagnostics.module';
import { WorkshopsModule } from './workshops/workshops.module';
import { EngagementModule } from './engagement/engagement.module';
import { CompetitionsModule } from './competitions/competitions.module';
import { RenewalsModule } from './renewals/renewals.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Global default: 60 req/min per IP. Login gets a tighter per-route
    // @Throttle (see staff-auth.controller.ts) since it's the actual
    // brute-force target.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    // Serves the built frontend (frontend/dist) from this same process in
    // production. Excluding /api/(.*) is the only thing that keeps this
    // from swallowing API routes (see main.ts's setGlobalPrefix('api')).
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', '..', 'frontend', 'dist'),
      exclude: ['/api/(.*)'],
    }),
    PrismaModule,
    AuthModule,
    SchoolsModule,
    PhaseTasksModule,
    TeachersModule,
    InfraDiagnosticsModule,
    WorkshopsModule,
    EngagementModule,
    CompetitionsModule,
    RenewalsModule,
    DashboardModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
