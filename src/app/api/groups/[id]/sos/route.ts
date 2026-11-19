import { handle, ok, readJson , readJsonOpt} from "@/lib/api";
import { requireUser } from '@/lib/auth';
import { triggerSos } from '@/lib/safety/sos';
import { getConfig } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export const POST = handle<{ id: string }>(async (req, { params }) => {
  const user = await requireUser();
  const body = await readJsonOpt(req);
  const lat = typeof body.lat === 'number' ? body.lat : undefined;
  const lng = typeof body.lng === 'number' ? body.lng : undefined;
  const alert = await triggerSos(user, params.id, { lat, lng }, typeof body.note === 'string' ? body.note : undefined);
  return ok({ alert: { id: alert.id, lat: alert.lat, lng: alert.lng, approximate: alert.approximate, status: alert.status, createdAt: alert.createdAt.toISOString() }, helplines: (await getConfig()).helplines }, { status: 201 });
});
