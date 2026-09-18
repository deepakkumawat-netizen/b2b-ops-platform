import { IsOptional, IsString } from 'class-validator';

export class UpsertInfraDiagnosticDto {
  @IsOptional()
  @IsString()
  labCapacity?: string;

  @IsOptional()
  @IsString()
  internetConnectivity?: string;

  @IsOptional()
  @IsString()
  systemsPerStudent?: string;

  @IsOptional()
  @IsString()
  recommendedSessionMix?: string;
}
