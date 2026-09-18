import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { StaffJwtPayload } from '../../auth/jwt-payload.interface';

// Use behind StaffAuthGuard: @CurrentStaff() staff: StaffJwtPayload
export const CurrentStaff = createParamDecorator((_data: unknown, ctx: ExecutionContext): StaffJwtPayload => {
  return ctx.switchToHttp().getRequest().user;
});
