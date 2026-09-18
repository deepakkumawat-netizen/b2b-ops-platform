import { StaffRole } from '@b2b-ops/shared';

// v1 has a single principal type — internal staff only, no school-facing
// portal — so unlike a dual-principal system there's no principalType claim
// to check. If a school portal is ever added later, split this the way
// TicketPlatform splits StaffJwtPayload/CustomerJwtPayload.
export interface StaffJwtPayload {
  sub: string; // Staff.id
  role: StaffRole;
}
