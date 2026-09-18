import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertInfraDiagnosticDto } from './dto/upsert-infra-diagnostic.dto';

@Injectable()
export class InfraDiagnosticsService {
  constructor(private prisma: PrismaService) {}

  get(schoolId: string) {
    return this.prisma.infraDiagnostic.findUnique({ where: { schoolId } });
  }

  upsert(schoolId: string, dto: UpsertInfraDiagnosticDto) {
    return this.prisma.infraDiagnostic.upsert({
      where: { schoolId },
      create: { ...dto, schoolId },
      update: { ...dto, submittedAt: new Date() },
    });
  }
}
