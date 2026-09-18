import { IsOptional, IsString } from 'class-validator';

export class UpdateAgentSuggestionDto {
  @IsOptional()
  @IsString()
  draftSubject?: string;

  @IsOptional()
  @IsString()
  draftBody?: string;
}
