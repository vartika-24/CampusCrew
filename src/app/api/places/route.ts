import { db } from '@/lib/db';
import { handle, ok } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  const places = await db.place.findMany({ where: { isPublic: true }, orderBy: { name: 'asc' } });
  return ok({ places: places.map((p) => ({ id: p.id, code: p.code, name: p.name, kind: p.kind, city: p.city, lat: p.lat, lng: p.lng })) });
});
