import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { StaffJwtPayload } from '../jwt-payload.interface';

@Injectable()
export class StaffJwtStrategy extends PassportStrategy(Strategy, 'jwt-staff') {
  constructor(
    private prisma: PrismaService,
    config: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET'),
    });
  }

  // Role is re-read fresh from the DB on every request rather than trusted
  // from the token, so a role change or deactivation takes effect on the
  // very next request instead of waiting out the token's TTL.
  async validate(payload: StaffJwtPayload): Promise<StaffJwtPayload> {
    const staff = await this.prisma.staff.findUnique({ where: { id: payload.sub } });
    if (!staff || !staff.isActive) {
      throw new UnauthorizedException('Account is no longer active');
    }
    return { sub: staff.id, role: staff.role };
  }
}
