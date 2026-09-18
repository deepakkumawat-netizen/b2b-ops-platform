import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';

@Injectable()
export class TeachersService {
  constructor(private prisma: PrismaService) {}

  listForSchool(schoolId: string) {
    return this.prisma.teacher.findMany({ where: { schoolId }, orderBy: { createdAt: 'asc' } });
  }

  create(schoolId: string, dto: CreateTeacherDto) {
    return this.prisma.teacher.create({ data: { ...dto, schoolId } });
  }

  async update(schoolId: string, teacherId: string, dto: UpdateTeacherDto) {
    const teacher = await this.prisma.teacher.findFirst({ where: { id: teacherId, schoolId } });
    if (!teacher) throw new NotFoundException('Teacher not found');
    return this.prisma.teacher.update({ where: { id: teacherId }, data: dto });
  }

  async remove(schoolId: string, teacherId: string) {
    const teacher = await this.prisma.teacher.findFirst({ where: { id: teacherId, schoolId } });
    if (!teacher) throw new NotFoundException('Teacher not found');
    await this.prisma.teacher.delete({ where: { id: teacherId } });
  }
}
