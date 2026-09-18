import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateTeacherDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  designation?: string;

  @IsOptional()
  @IsString()
  gradeAssigned?: string;

  @IsOptional()
  @IsBoolean()
  lmsCredentialGenerated?: boolean;
}
