import { SetMetadata } from '@nestjs/common';
import { StaffRole } from '@b2b-ops/shared';

export const ROLES_KEY = 'roles';

// @Roles(StaffRole.OPERATIONS, StaffRole.SUPER_ADMIN) on a route, enforced by
// RolesGuard. Must be combined with StaffAuthGuard (runs first, populates
// request.user).
export const Roles = (...roles: StaffRole[]) => SetMetadata(ROLES_KEY, roles);
