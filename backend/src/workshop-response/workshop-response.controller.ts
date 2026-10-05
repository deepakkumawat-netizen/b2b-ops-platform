import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { LIVE_WORKSHOP_STATUSES } from '../workshops/workshops.service';
import { isValidWorkshopResponseToken } from '../workshops/workshop-response-token';
import { MIN_LEAD_DAYS, WorkshopReschedulerAgentService } from '../ai/agents/workshop-rescheduler-agent.service';
import { formatDateInZone, isoDateInZone, startOfDayInZone } from '../common/time';
import { RequestWorkshopChangeDto } from './dto/request-workshop-change.dto';

// PUBLIC (no StaffAuthGuard): the "confirm or change this date" page a
// school opens from its workshop emails. The signed token in the URL is the
// only credential, so a bad one gets a plain 404. The school can only
// confirm the date or ask for a change; the workshop rescheduler agent
// decides the new date from the school's preferred ones.
@Controller('public/workshop-response/:workshopId/:token')
export class WorkshopResponseController {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private activity: ActivityService,
    private rescheduler: WorkshopReschedulerAgentService,
  ) {}

  @Get()
  async info(@Param('workshopId') workshopId: string, @Param('token') token: string) {
    const workshop = await this.findWorkshop(workshopId, token);
    return this.view(workshop);
  }

  @Post('confirm')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async confirm(@Param('workshopId') workshopId: string, @Param('token') token: string) {
    const workshop = await this.findLiveWorkshop(workshopId, token);
    if (!workshop.schoolConfirmedAt) {
      const updated = await this.prisma.workshop.update({
        where: { id: workshop.id },
        data: { schoolConfirmedAt: new Date(), changeRequestedAt: null, preferredDates: [] },
        include: { school: { select: { name: true } } },
      });
      await this.activity.record(workshop.schoolId, null, `School confirmed the workshop "${workshop.topic}"`);
      await this.rescheduler.notifySchoolConfirmed(workshop.id);
      return this.view(updated);
    }
    return this.view(workshop);
  }

  @Post('change')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async requestChange(@Param('workshopId') workshopId: string, @Param('token') token: string, @Body() dto: RequestWorkshopChangeDto) {
    const workshop = await this.findLiveWorkshop(workshopId, token);
    const earliest = startOfDayInZone(new Date(), MIN_LEAD_DAYS);
    // Noon UTC falls on the same calendar day in India, so this is that day's midnight there.
    const days = [...new Set(dto.preferredDates)].map((d) => startOfDayInZone(new Date(`${d}T12:00:00Z`)));
    if (days.some((d) => Number.isNaN(d.getTime()))) throw new BadRequestException('Please pick valid dates.');
    if (days.some((d) => d < earliest)) {
      throw new BadRequestException(`Please pick dates from ${formatDateInZone(earliest)} onwards, so we have time to prepare.`);
    }
    const reason = dto.reason?.trim() || null;
    await this.prisma.workshop.update({
      where: { id: workshop.id },
      data: { changeRequestedAt: new Date(), changeReason: reason, preferredDates: days, schoolConfirmedAt: null },
    });
    await this.activity.record(
      workshop.schoolId,
      null,
      `School asked to move the workshop "${workshop.topic}"`,
      `Preferred: ${days.map((d) => formatDateInZone(d)).join(' or ')}${reason ? `. Reason: ${reason}` : ''}`,
    );
    // Straight away, so the school sees the result; the daily run retries if this fails.
    let outcome: Awaited<ReturnType<WorkshopReschedulerAgentService['handleRequest']>> = 'nothing';
    try {
      outcome = await this.rescheduler.handleRequest(workshop.id);
    } catch {
      // Left pending for the daily run.
    }
    const updated = await this.findWorkshop(workshopId, token);
    return { ...this.view(updated), outcome };
  }

  private view(workshop: Awaited<ReturnType<WorkshopResponseController['findWorkshop']>>) {
    return {
      schoolName: workshop.school.name,
      topic: workshop.topic,
      targetGrades: workshop.targetGrades,
      scheduledAt: workshop.scheduledAt,
      live: LIVE_WORKSHOP_STATUSES.includes(workshop.status),
      status: workshop.status,
      schoolConfirmedAt: workshop.schoolConfirmedAt,
      changePending: !!workshop.changeRequestedAt,
      earliestDate: isoDateInZone(startOfDayInZone(new Date(), MIN_LEAD_DAYS)),
    };
  }

  private async findLiveWorkshop(workshopId: string, token: string) {
    const workshop = await this.findWorkshop(workshopId, token);
    if (!LIVE_WORKSHOP_STATUSES.includes(workshop.status)) {
      throw new BadRequestException(`This workshop is already ${workshop.status.toLowerCase()}, so it can't be changed here.`);
    }
    return workshop;
  }

  private async findWorkshop(workshopId: string, token: string) {
    const secret = this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
    if (!isValidWorkshopResponseToken(workshopId, token, secret)) throw new NotFoundException();
    const workshop = await this.prisma.workshop.findUnique({ where: { id: workshopId }, include: { school: { select: { name: true } } } });
    if (!workshop) throw new NotFoundException();
    return workshop;
  }
}
