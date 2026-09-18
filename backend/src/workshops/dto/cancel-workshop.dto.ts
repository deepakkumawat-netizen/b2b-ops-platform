import { IsString } from 'class-validator';

export class CancelWorkshopDto {
  @IsString()
  cancelReason!: string;
}
