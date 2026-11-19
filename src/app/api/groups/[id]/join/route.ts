import { handle, ok, readJson , readJsonOpt} from "@/lib/api";
import { requireUser } from '@/lib/auth';
import { joinGroup } from '@/lib/matching/engine';

export const dynamic = 'force-dynamic';

export const POST = handle<{ id: string }>(async (req, { params }) => {
  const user = await requireUser();
  const body = await readJsonOpt(req);
  const luggage = body.luggage === undefined ? 0 : Number(body.luggage);
  return ok(await joinGroup(user, params.id, { luggage }));
});
