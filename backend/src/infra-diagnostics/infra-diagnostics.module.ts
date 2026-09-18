import { Module } from '@nestjs/common';
import { InfraDiagnosticsService } from './infra-diagnostics.service';
import { InfraDiagnosticsController } from './infra-diagnostics.controller';

@Module({
  controllers: [InfraDiagnosticsController],
  providers: [InfraDiagnosticsService],
})
export class InfraDiagnosticsModule {}
