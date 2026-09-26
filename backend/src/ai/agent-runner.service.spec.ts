import { AGENT_NAMES, AgentRunnerService } from './agent-runner.service';

type RunnerCtor = new (...agents: unknown[]) => AgentRunnerService;

function agent(result: number | Error) {
  return { scan: jest.fn(() => (result instanceof Error ? Promise.reject(result) : Promise.resolve(result))) };
}

function makeRunner(agents: unknown[]) {
  const runner = new (AgentRunnerService as unknown as RunnerCtor)(...agents);
  const logger = (runner as unknown as { logger: { error: () => void; log: () => void } }).logger;
  jest.spyOn(logger, 'error').mockImplementation(() => undefined);
  jest.spyOn(logger, 'log').mockImplementation(() => undefined);
  return runner;
}

describe('AgentRunnerService.runAll', () => {
  it('keeps running later agents when one throws, and reports the error', async () => {
    const agents = AGENT_NAMES.map((_, i) => agent(i === 2 ? new Error('DB timeout') : i + 1));
    const result = await makeRunner(agents).runAll();

    agents.forEach((a) => expect(a.scan).toHaveBeenCalledTimes(1));
    expect(result.workshopReminder).toBe(0);
    expect(result.errors).toEqual({ workshopReminder: 'DB timeout' });
    expect(result.dataCompleteness).toBe(9);
  });

  it('returns an empty errors object when everything succeeds', async () => {
    const result = await makeRunner(AGENT_NAMES.map(() => agent(0))).runAll();
    expect(result.errors).toEqual({});
  });
});
