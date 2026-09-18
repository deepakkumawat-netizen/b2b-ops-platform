import { ForbiddenException } from '@nestjs/common';
import { StaffRole } from '@b2b-ops/shared';
import { assertSchoolAccess, schoolScopeWhere } from './scope';
import { StaffJwtPayload } from '../auth/jwt-payload.interface';

// The exact function every School (and anything scoped through it) query
// must run through — the RBAC boundary the whole plan depends on. If this is
// wrong, one account manager sees another's schools.

const superAdmin: StaffJwtPayload = { sub: 'staff-super', role: StaffRole.SUPER_ADMIN };
const operations: StaffJwtPayload = { sub: 'staff-ops', role: StaffRole.OPERATIONS };
const accountManager: StaffJwtPayload = { sub: 'staff-am-1', role: StaffRole.ACCOUNT_MANAGER };

describe('schoolScopeWhere', () => {
  it('lets SUPER_ADMIN see every school (no filter)', () => {
    expect(schoolScopeWhere(superAdmin)).toEqual({});
  });

  it('lets OPERATIONS see every school (no filter)', () => {
    expect(schoolScopeWhere(operations)).toEqual({});
  });

  it('pins an ACCOUNT_MANAGER to only their assigned schools', () => {
    expect(schoolScopeWhere(accountManager)).toEqual({ assignedAccountManagerId: 'staff-am-1' });
  });
});

describe('assertSchoolAccess', () => {
  it('allows non-ACCOUNT_MANAGER roles into any school', () => {
    expect(() => assertSchoolAccess(operations, { assignedAccountManagerId: 'staff-am-1' })).not.toThrow();
  });

  it('allows an ACCOUNT_MANAGER into a school assigned to them', () => {
    expect(() => assertSchoolAccess(accountManager, { assignedAccountManagerId: 'staff-am-1' })).not.toThrow();
  });

  it('blocks an ACCOUNT_MANAGER from a school assigned to someone else', () => {
    expect(() => assertSchoolAccess(accountManager, { assignedAccountManagerId: 'staff-am-2' })).toThrow(
      ForbiddenException,
    );
  });

  it('blocks an ACCOUNT_MANAGER from an unassigned school', () => {
    expect(() => assertSchoolAccess(accountManager, { assignedAccountManagerId: null })).toThrow(ForbiddenException);
  });
});
