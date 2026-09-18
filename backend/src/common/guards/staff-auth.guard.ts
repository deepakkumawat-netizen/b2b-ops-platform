import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Apply to every route with @UseGuards(StaffAuthGuard). Delegates to the
// 'jwt-staff' Passport strategy (see staff-jwt.strategy.ts).
@Injectable()
export class StaffAuthGuard extends AuthGuard('jwt-staff') {}
