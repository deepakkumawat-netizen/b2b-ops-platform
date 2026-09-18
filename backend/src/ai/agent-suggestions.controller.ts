import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { StaffRole } from '@b2b-ops/shared';
import { StaffAuthGuard } from '../common/guards/staff-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentStaff } from '../common/decorators/current-staff.decorator';
import { StaffJwtPayload } from '../auth/jwt-payload.interface';
import { AgentSuggestionsService } from './agent-suggestions.service';
import { AgentRunnerService } from './agent-runner.service';
import { UpdateAgentSuggestionDto } from './dto/update-agent-suggestion.dto';

@Controller('agent-suggestions')
@UseGuards(StaffAuthGuard, RolesGuard)
export class AgentSuggestionsController {
  constructor(
    private suggestions: AgentSuggestionsService,
    private runner: AgentRunnerService,
  ) {}

  @Get()
  list(@CurrentStaff() staff: StaffJwtPayload) {
    return this.suggestions.list(staff);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAgentSuggestionDto, @CurrentStaff() staff: StaffJwtPayload) {
    return this.suggestions.update(id, dto, staff);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @CurrentStaff() staff: StaffJwtPayload) {
    return this.suggestions.approve(id, staff);
  }

  @Post(':id/reject')
  reject(@Param('id') id: string, @CurrentStaff() staff: StaffJwtPayload) {
    return this.suggestions.reject(id, staff);
  }

  // Manual trigger — see AgentRunnerService for why this matters on Render's
  // free plan (the @Cron schedule alone won't reliably fire on a sleeping
  // service).
  @Post('run')
  @Roles(StaffRole.SUPER_ADMIN)
  run() {
    return this.runner.runAll();
  }
}
