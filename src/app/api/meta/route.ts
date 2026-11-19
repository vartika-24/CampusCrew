import { handle, ok } from '@/lib/api';
import { VEHICLE_SPECS, PLATFORM_FEE } from '@/lib/constants';
import { getConfig } from '@/lib/settings';
import { ID_TYPES, ID_TYPE_LABEL } from '@/lib/idverify';
import { todayIST } from '@/lib/time';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  const c = await getConfig();
  return ok({
    campus: c.campusName, today: todayIST(), helplines: c.helplines, hostels: c.hostels, departments: c.departments,
    settings: { breakStart: c.breakStart ?? undefined, breakEnd: c.breakEnd ?? undefined, breakLabel: c.breakLabel, returnDate: c.returnDate ?? undefined },
    idTypes: ID_TYPES.map((t) => ({ value: t, label: ID_TYPE_LABEL[t] })), vehicles: VEHICLE_SPECS, platformFee: PLATFORM_FEE,
  });
});
