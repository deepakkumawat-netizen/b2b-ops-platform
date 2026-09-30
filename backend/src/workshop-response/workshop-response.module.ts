import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { WorkshopsModule } from '../workshops/workshops.module';
import { WorkshopResponseController } from './workshop-response.controller';

@Module({
  imports: [AiModule, WorkshopsModule],
  controllers: [WorkshopResponseController],
})
export class WorkshopResponseModule {}
