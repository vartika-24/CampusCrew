import { handle, ok } from '@/lib/api';
import { CAMPUS_NAME, DEPARTMENTS, HELPLINES, HOSTELS, VEHICLE_SPECS, PLATFORM_FEE } from '@/lib/constants';
import { getSettings } from '@/lib/surge';
import { KNOWN_TRANSIT } from '@/lib/transit';
import { todayIST } from '@/lib/time';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  const settings = await getSettings();
  return ok({
    campus: CAMPUS_NAME, today: todayIST(), settings, helplines: HELPLINES, transit: KNOWN_TRANSIT,
    hostels: HOSTELS, departments: DEPARTMENTS, vehicles: VEHICLE_SPECS, platformFee: PLATFORM_FEE,
  });
});
