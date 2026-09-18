import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompetitionDto } from './dto/create-competition.dto';

@Injectable()
export class CompetitionsService {
  constructor(private prisma: PrismaService) {}

  listForSchool(schoolId: string) {
    return this.prisma.competitionParticipation.findMany({ where: { schoolId }, orderBy: { date: 'desc' } });
  }

  create(schoolId: string, dto: CreateCompetitionDto) {
    return this.prisma.competitionParticipation.create({ data: { ...dto, date: new Date(dto.date), schoolId } });
  }
}
