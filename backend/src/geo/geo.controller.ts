import { Controller, Get, Header, Param, UseGuards } from '@nestjs/common';
import { City, State } from 'country-state-city';
import { StaffAuthGuard } from '../common/guards/staff-auth.guard';

// States and cities for the school form's dropdowns. The world lists are
// ~0.5 MB (states) and ~8 MB (cities), so they live here instead of in the
// browser bundle — the form asks for one country's states, then one
// state's cities, as they're picked.
@Controller('geo')
@UseGuards(StaffAuthGuard)
export class GeoController {
  @Get('states/:countryCode')
  @Header('Cache-Control', 'private, max-age=86400')
  states(@Param('countryCode') countryCode: string): Array<{ isoCode: string; name: string }> {
    return State.getStatesOfCountry(countryCode).map((s) => ({ isoCode: s.isoCode, name: s.name }));
  }

  @Get('cities/:countryCode/:stateCode')
  @Header('Cache-Control', 'private, max-age=86400')
  cities(@Param('countryCode') countryCode: string, @Param('stateCode') stateCode: string): string[] {
    const names = City.getCitiesOfState(countryCode, stateCode).map((c) => c.name);
    return [...new Set(names)].sort((a, b) => a.localeCompare(b));
  }
}
