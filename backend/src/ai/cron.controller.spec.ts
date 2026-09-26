import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CronController } from './cron.controller';
import { AgentRunnerService } from './agent-runner.service';

describe('CronController', () => {
  const runAll = jest.fn().mockResolvedValue({ errors: {} });
  const controller = new CronController({ runAll } as unknown as AgentRunnerService);
  const original = process.env.CRON_SECRET;

  afterEach(() => {
    process.env.CRON_SECRET = original;
    runAll.mockClear();
  });

  it('does not exist when CRON_SECRET is unset', () => {
    delete process.env.CRON_SECRET;
    expect(() => controller.run('anything')).toThrow(NotFoundException);
    expect(runAll).not.toHaveBeenCalled();
  });

  it('rejects a missing or wrong secret', () => {
    process.env.CRON_SECRET = 's3cret-value';
    expect(() => controller.run(undefined)).toThrow(ForbiddenException);
    expect(() => controller.run('wrong')).toThrow(ForbiddenException);
    expect(runAll).not.toHaveBeenCalled();
  });

  it('runs the agents with the right secret', async () => {
    process.env.CRON_SECRET = 's3cret-value';
    await controller.run('s3cret-value');
    expect(runAll).toHaveBeenCalledTimes(1);
  });
});
