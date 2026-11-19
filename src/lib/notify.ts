import { db } from './db';

export async function notify(userId: string, kind: 'INFO' | 'PROMOTION' | 'INVITE' | 'SAFETY' | 'PENALTY', title: string, body: string, link?: string) {
  await db.notification.create({ data: { userId, kind, title, body, link } });
}
