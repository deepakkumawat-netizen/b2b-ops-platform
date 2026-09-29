import { BadRequestException, Body, Controller, Get, Param, Post, Put, Res, UseGuards, UseInterceptors } from '@nestjs/common';
import { Response } from 'express';
import { IsString, MaxLength } from 'class-validator';
import { StaffAuthGuard } from '../common/guards/staff-auth.guard';
import { CurrentStaff } from '../common/decorators/current-staff.decorator';
import { StaffJwtPayload } from '../auth/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { assertSchoolAccessById } from '../common/scope';
import { SyncChecklistInterceptor } from '../automation/sync-checklist.interceptor';
import { OnboardingService } from './onboarding.service';
import { isAssetKind } from './school-assets';

export class WhatsappLinkDto {
  @IsString()
  @MaxLength(200)
  link!: string;
}

export class ImageUploadDto {
  @IsString()
  @MaxLength(2_100_000) // ~1.5 MB of image once base64-encoded
  dataUrl!: string;
}

// Onboarding Setup (SOP Phase 4) for one school. Every write syncs the
// checklist, so the proven tasks tick straight away.
@Controller('schools/:schoolId/onboarding')
@UseGuards(StaffAuthGuard)
@UseInterceptors(SyncChecklistInterceptor)
export class OnboardingController {
  constructor(
    private onboarding: OnboardingService,
    private prisma: PrismaService,
  ) {}

  @Get()
  async overview(@Param('schoolId') schoolId: string, @CurrentStaff() staff: StaffJwtPayload) {
    await assertSchoolAccessById(this.prisma, staff, schoolId);
    return this.onboarding.overview(schoolId);
  }

  @Put('whatsapp-link')
  async setLink(@Param('schoolId') schoolId: string, @Body() dto: WhatsappLinkDto, @CurrentStaff() staff: StaffJwtPayload) {
    await assertSchoolAccessById(this.prisma, staff, schoolId);
    return this.onboarding.setWhatsappLink(schoolId, dto.link, staff);
  }

  @Post('whatsapp-invite/owner')
  async emailOwner(@Param('schoolId') schoolId: string, @CurrentStaff() staff: StaffJwtPayload) {
    await assertSchoolAccessById(this.prisma, staff, schoolId);
    return { sent: await this.onboarding.emailOwnerInvite(schoolId) };
  }

  @Post('whatsapp-invite/teachers/:teacherId')
  async teacherInvited(
    @Param('schoolId') schoolId: string,
    @Param('teacherId') teacherId: string,
    @CurrentStaff() staff: StaffJwtPayload,
  ) {
    await assertSchoolAccessById(this.prisma, staff, schoolId);
    return this.onboarding.markTeacherInvited(schoolId, teacherId, staff);
  }

  @Put('assets/:kind')
  async upload(
    @Param('schoolId') schoolId: string,
    @Param('kind') kind: string,
    @Body() dto: ImageUploadDto,
    @CurrentStaff() staff: StaffJwtPayload,
  ) {
    if (!isAssetKind(kind)) throw new BadRequestException('Unknown image type');
    await assertSchoolAccessById(this.prisma, staff, schoolId);
    return this.onboarding.saveAsset(schoolId, kind, dto.dataUrl, staff);
  }

  @Get('assets/:kind')
  async image(
    @Param('schoolId') schoolId: string,
    @Param('kind') kind: string,
    @CurrentStaff() staff: StaffJwtPayload,
    @Res() res: Response,
  ) {
    if (!isAssetKind(kind)) throw new BadRequestException('Unknown image type');
    await assertSchoolAccessById(this.prisma, staff, schoolId);
    const asset = await this.onboarding.getAsset(schoolId, kind);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.type(asset.mimeType).send(Buffer.from(asset.data));
  }

  @Post('welcome-shared')
  async welcomeShared(@Param('schoolId') schoolId: string, @CurrentStaff() staff: StaffJwtPayload) {
    await assertSchoolAccessById(this.prisma, staff, schoolId);
    return this.onboarding.markWelcomeShared(schoolId, staff);
  }
}
