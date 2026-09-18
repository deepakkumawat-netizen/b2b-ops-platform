import { IsString } from 'class-validator';

export class RecordFeedbackDto {
  @IsString()
  feedbackSummary!: string;
}
