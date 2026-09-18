import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { StaffRole } from '@b2b-ops/shared';
import { StaffJwtPayload } from '../auth/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';

// Every School (and anything scoped through it) query MUST run its `where`
// clause through this. Deliberately explicit — called at the top of each
// service method — rather than an interceptor silently rewriting query
// objects, so "grep for schoolScopeWhere" reliably finds every place this
// security boundary is enforced.

/** SUPER_ADMIN/OPERATIONS/TRAINING/SALES see every school (they each need
 * cross-account visibility for scheduling/training/deal work); an
 * ACCOUNT_MANAGER is pinned to only the schools assigned to them. */
export function schoolScopeWhere(staff: StaffJwtPayload): { assignedAccountManagerId?: string } {
  if (staff.role === StaffRole.ACCOUNT_MANAGER) {
    return { assignedAccountManagerId: staff.sub };
  }
  return {};
}

/** Throws unless `staff` is allowed to act on `school` — everyone except an
 * ACCOUNT_MANAGER passes; an ACCOUNT_MANAGER must be the assigned manager.
 * Call this at the top of any controller action scoped by a :schoolId route
 * param (route-param scoping can't be expressed as a Prisma `where` clause
 * the way schoolScopeWhere() is for list/query endpoints). */
export function assertSchoolAccess(staff: StaffJwtPayload, school: { assignedAccountManagerId: string | null }): void {
  if (staff.role !== StaffRole.ACCOUNT_MANAGER) return;
  if (school.assignedAccountManagerId !== staff.sub) {
    throw new ForbiddenException("You don't have access to this school");
  }
}

/** Convenience wrapper used by every :schoolId-scoped sub-resource
 * controller (teachers, workshops, engagement logs, competitions, renewals,
 * infra diagnostic) — looks up the school and runs assertSchoolAccess in one
 * call, throwing NotFoundException if the school doesn't exist at all. */
export async function assertSchoolAccessById(prisma: PrismaService, staff: StaffJwtPayload, schoolId: string): Promise<void> {
  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!school) throw new NotFoundException('School not found');
  assertSchoolAccess(staff, school);
}
