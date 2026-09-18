import { IsString } from 'class-validator';

export class CreateRenewalCycleDto {
  @IsString()
  cycleLabel!: string;
}
