import { db } from '@/lib/db';
import { handle, ok } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import { ID_TYPE_LABEL } from '@/lib/idverify';

export const dynamic = 'force-dynamic';

/** Queue of students whose government ID is awaiting review. */
export const GET = handle(async () => {
  await requireAdmin();
  const users = await db.user.findMany({
    where: { role: 'STUDENT', idCardStatus: 'PENDING', idDocuments: { some: {} } },
    orderBy: { idSubmittedAt: 'asc' }, take: 100,
    include: { idDocuments: { select: { id: true, mime: true, width: true, height: true } } },
  });
  const hashes = users.map((u) => u.idDocHash).filter(Boolean) as string[];
  const dupes = hashes.length ? await db.user.findMany({ where: { idDocHash: { in: hashes } }, select: { id: true, idDocHash: true } }) : [];
  const [recent, pendingTotal] = await Promise.all([
    db.user.findMany({ where: { role: 'STUDENT', idCardStatus: { in: ['VERIFIED', 'REJECTED'] }, idReviewedAt: { not: null } }, orderBy: { idReviewedAt: 'desc' }, take: 10 }),
    db.user.count({ where: { role: 'STUDENT', idCardStatus: 'PENDING', idDocuments: { some: {} } } }),
  ]);
  return ok({
    pending: pendingTotal,
    queue: users.map((u) => ({
      id: u.id, name: u.name, email: u.email, rollNumber: u.rollNumber, department: u.department, year: u.year, hostel: u.hostel, gender: u.gender,
      idType: u.idType, idTypeLabel: u.idType ? ID_TYPE_LABEL[u.idType] : null, submittedAt: u.idSubmittedAt?.toISOString() ?? null, image: u.idDocuments[0] ?? null,
      duplicateIdImage: dupes.some((d) => d.idDocHash === u.idDocHash && d.id !== u.id),
    })),
    recent: recent.map((u) => ({ id: u.id, name: u.name, status: u.idCardStatus, reviewedAt: u.idReviewedAt?.toISOString() ?? null, reason: u.idRejectReason })),
  });
});
