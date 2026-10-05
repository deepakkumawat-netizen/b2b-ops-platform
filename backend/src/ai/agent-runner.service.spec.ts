import { AGENT_NAMES, AgentRunnerService } from './agent-runner.service';

type RunnerCtor = new (...agents: unknown[]) => AgentRunnerService;

function agent(result: number | Error) {
  return { scan: jest.fn(() => (result instanceof Error ? Promise.reject(result) : Promise.resolve(result))) };
}

// Constructor args are the agents in declaration order, which differs from
// AGENT_NAMES order — map each constructor slot to its agent name.
const CTOR_ORDER = [
  'engagement',
  'renewal',
  'workshopReminder',
  'renewalCycleOpener',
  'workshopFeedbackNag',
  'stalePhase',
  'renewalStalled',
  'competitionFollowup',
  'dataCompleteness',
  'schoolDetailsReminder',
  'workshopRescheduler',
  'workshopScheduler',
  'festivalHolidays',
  'checklist',
] as const;

function makeRunner(byName: Record<string, unknown>) {
  const runner = new (AgentRunnerService as unknown as RunnerCtor)(...CTOR_ORDER.map((n) => byName[n]));
  const logger = (runner as unknown as { logger: { error: () => void; log: () => void } }).logger;
  jest.spyOn(logger, 'error').mockImplementation(() => undefined);
  jest.spyOn(logger, 'log').mockImplementation(() => undefined);
  return runner;
}

describe('AgentRunnerService.runAll', () => {
  it('keeps running later agents when one throws, and reports the error', async () => {
    const agents = Object.fromEntries(
      AGENT_NAMES.map((name) => [name, agent(name === 'workshopReminder' ? new Error('DB timeout') : name === 'dataCompleteness' ? 9 : 1)]),
    );
    const result = await makeRunner(agents).runAll();

    Object.values(agents).forEach((a) => expect(a.scan).toHaveBeenCalledTimes(1));
    expect(result.workshopReminder).toBe(0);
    expect(result.errors).toEqual({ workshopReminder: 'DB timeout' });
    expect(result.dataCompleteness).toBe(9);
  });

  it('returns an empty errors object when everything succeeds', async () => {
    const result = await makeRunner(Object.fromEntries(AGENT_NAMES.map((name) => [name, agent(0)]))).runAll();
    expect(result.errors).toEqual({});
  });
});
