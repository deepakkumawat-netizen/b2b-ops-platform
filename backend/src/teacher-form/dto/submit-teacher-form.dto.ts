import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';

export class TeacherFormRowDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  designation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  gradeAssigned?: string;
}

// Public endpoint — the caps keep one link from being used to flood a school.
export class SubmitTeacherFormDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => TeacherFormRowDto)
  teachers!: TeacherFormRowDto[];
}

export class PublicLogoUploadDto {
  @IsString()
  @MaxLength(2_100_000) // ~1.5 MB of image once base64-encoded
  logo!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2_100_000)
  cobranded?: string;
}

export class StudentRowDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  grade?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  section?: string;
}

export class SubmitStudentsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => StudentRowDto)
  students!: StudentRowDto[];
}

export class PublicInfraDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  labCapacity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  internetConnectivity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  systemsPerStudent?: string;
}

export class PublicOrientationDto {
  @IsDateString()
  date!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}
