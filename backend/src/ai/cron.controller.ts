import { timingSafeEqual } from 'crypto';
import { Controller, ForbiddenException, Headers, HttpCode, NotFoundException, Post } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { AgentRunnerService } from './agent-runner.service';

function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Machine-to-machine trigger for the daily agent run — called by the GitHub
// Actions schedule (.github/workflows/daily-agents.yml) because Render's free
// plan sleeps the service and the in-process @Cron never fires while asleep.
// Authenticated by a shared CRON_SECRET header instead of a staff JWT (no
// human is involved). If CRON_SECRET is unset the endpoint doesn't exist.
@Controller('cron')
@SkipThrottle()
export class CronController {
  constructor(private runner: AgentRunnerService) {}

  @Post('run-agents')
  @HttpCode(200)
  run(@Headers('x-cron-secret') provided: string | undefined) {
    const expected = process.env.CRON_SECRET;
    if (!expected) throw new NotFoundException();
    if (!provided || !secretsMatch(provided, expected)) throw new ForbiddenException('Invalid cron secret');
    return this.runner.runAll();
  }
}
