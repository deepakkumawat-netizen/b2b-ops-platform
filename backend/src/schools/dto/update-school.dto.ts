import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional } from 'class-validator';
import { SchoolStatus } from '@b2b-ops/shared';
import { CreateSchoolDto } from './create-school.dto';

export class UpdateSchoolDto extends PartialType(CreateSchoolDto) {
  @IsOptional()
  @IsEnum(SchoolStatus)
  status?: SchoolStatus;
}
