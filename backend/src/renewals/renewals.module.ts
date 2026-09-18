import { Module } from '@nestjs/common';
import { RenewalsService } from './renewals.service';
import { RenewalsController } from './renewals.controller';

@Module({
  controllers: [RenewalsController],
  providers: [RenewalsService],
  exports: [RenewalsService],
})
export class RenewalsModule {}
