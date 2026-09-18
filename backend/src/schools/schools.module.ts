import { Module } from '@nestjs/common';
import { PhaseTasksModule } from '../phase-tasks/phase-tasks.module';
import { SchoolsService } from './schools.service';
import { SchoolsController } from './schools.controller';

@Module({
  imports: [PhaseTasksModule],
  controllers: [SchoolsController],
  providers: [SchoolsService],
  exports: [SchoolsService],
})
export class SchoolsModule {}
