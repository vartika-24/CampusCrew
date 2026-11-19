'use client';

export class ApiErr extends Error {
  constructor(message: string, public status: number, public code?: string, public data?: Record<string, unknown>) {
    super(message);
  }
}

export async function api<T = unknown>(url: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
      headers: opts.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      cache: 'no-store',
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiErr('Network error. Check your connection and retry.', 0, 'NETWORK');
  }
  let data: Record<string, unknown> = {};
  try { data = await res.json(); } catch { /* empty */ }
  if (!res.ok) throw new ApiErr((data.error as string) || `Request failed (${res.status})`, res.status, data.code as string | undefined, data);
  return data as T;
}

export const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export function fmtDate(d: string) {
  return new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export function fmtTimeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export type Place = { id: string; code: string; name: string; kind: string; city: string; lat: number; lng: number };
export type Me = {
  id: string; email: string; name: string; role: string; department: string; year: number; hostel: string | null; gender: string; genderLocked: boolean;
  rollNumber: string; idCardStatus: string; trustScore: number; completedRides: number; buddyVisible: boolean; upiId: string | null; ratingAvg: number | null;
  cancelCount: number; lateCancels: number; idType: string | null; idRejectReason: string | null; isDemo: boolean;
};
export type Member = {
  userId: string; name: string; firstName: string; department: string; year: number; hostel: string | null; gender: string; trustScore: number; verified: boolean;
  status: string; isHost: boolean; luggage: number; boarded: boolean; paymentStatus?: string; shareAmount?: number;
};
export type Trip = {
  id: string; origin: Place; dest: Place; km: number; date: string; windowStart: string; windowEnd: string; mode: string; vehicleType: string; vehicleLabel: string;
  seats: number; seatsLeft: number; bagCapacity: number; bagsUsed: number; genderPref: string; nightMode: boolean; status: string; trainNumber: string | null; flightNumber: string | null;
  delayMins: number; fareTotal: number | null; feePerRider: number;
  split: { total: number; riders: number; baseShare: number; fee: number; perRider: number; collected: number } | null;
  startedAt: string | null; completedAt: string | null; parentGroupId: string | null; note: string | null; hostId: string; hostName: string; isHost: boolean; isMember: boolean;
  myStatus: string | null; me: { boarded: boolean; paymentStatus: string; shareAmount: number; luggage: number } | null; waitlistCount: number; members: Member[];
  operator: { name: string; plate: string; badge: string; vehicleName: string; rating: number; phoneMasked: string } | null;
  operatorPreview: { badge: string; vehicleName: string } | null;
  pin: string | null; demoPin: string | null; shareToken: string | null; upi: string | null; upiPayee: { name: string; upiId: string | null } | null;
  score: { total: number; eligible: boolean; reasons: string[]; blockers: string[]; nightSafety: boolean } | null;
};
