import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { StaffRole } from '@b2b-ops/shared';
import { RolesGuard } from './roles.guard';

function contextFor(user: unknown): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);

  it('allows any signed-in staff when no roles are required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(contextFor({ sub: 'x', role: StaffRole.TRAINING }))).toBe(true);
  });

  it('only allows the listed roles, plus SUPER_ADMIN', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([StaffRole.SALES]);
    expect(guard.canActivate(contextFor({ sub: 'x', role: StaffRole.SALES }))).toBe(true);
    expect(guard.canActivate(contextFor({ sub: 'x', role: StaffRole.SUPER_ADMIN }))).toBe(true);
    expect(guard.canActivate(contextFor({ sub: 'x', role: StaffRole.ACCOUNT_MANAGER }))).toBe(false);
    expect(guard.canActivate(contextFor(undefined))).toBe(false);
  });
});
