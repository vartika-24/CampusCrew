export type LatLng = { lat: number; lng: number };

const R = 6371;
const rad = (d: number) => (d * Math.PI) / 180;

export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/** Approximate road distance (straight line × 1.3 detour factor). */
export function roadKm(a: LatLng, b: LatLng): number {
  return Math.max(0.5, Math.round(haversineKm(a, b) * 1.3 * 10) / 10);
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic pseudo-road polyline between two points (gentle bends), seeded for stability. */
export function buildRoute(a: LatLng, b: LatLng, seed: string, bends = 4): LatLng[] {
  const pts: LatLng[] = [a];
  let h = hashSeed(seed);
  const dLat = b.lat - a.lat;
  const dLng = b.lng - a.lng;
  for (let i = 1; i <= bends; i++) {
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    const jitter = ((h % 1000) / 1000 - 0.5) * 0.16;
    const t = i / (bends + 1);
    pts.push({ lat: a.lat + dLat * t + -dLng * jitter, lng: a.lng + dLng * t + dLat * jitter });
  }
  pts.push(b);
  return pts;
}

export function polylineLength(pts: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += haversineKm(pts[i - 1], pts[i]);
  return total;
}

/** Position at fraction t (0..1) of the polyline's length. */
export function positionAt(pts: LatLng[], t: number): LatLng {
  const clamped = Math.max(0, Math.min(1, t));
  const total = polylineLength(pts);
  if (total === 0) return pts[0];
  let target = total * clamped;
  for (let i = 1; i < pts.length; i++) {
    const seg = haversineKm(pts[i - 1], pts[i]);
    if (target <= seg || i === pts.length - 1) {
      const f = seg === 0 ? 0 : Math.min(1, target / seg);
      return {
        lat: pts[i - 1].lat + (pts[i].lat - pts[i - 1].lat) * f,
        lng: pts[i - 1].lng + (pts[i].lng - pts[i - 1].lng) * f,
      };
    }
    target -= seg;
  }
  return pts[pts.length - 1];
}

/** Emission factors in kg CO2 per vehicle-km. Shared rides avoid (n-1) extra vehicles. */
export const EMISSION_KG_PER_KM: Record<string, number> = { CAB: 0.17, AUTO: 0.1, BUS: 0, TRAIN: 0, FLIGHT: 0 };

/** Average speed used for ETA (km/h). */
export function avgSpeedKmh(mode: string, km: number): number {
  if (mode === 'TRAIN') return 60;
  if (mode === 'FLIGHT') return 600;
  if (mode === 'AUTO') return 25;
  return km > 60 ? 55 : 32;
}

export function etaMinutes(mode: string, km: number): number {
  return Math.max(5, Math.round((km / avgSpeedKmh(mode, km)) * 60));
}

/** Seconds a trip takes in the live simulation (compressed so demos finish quickly). */
export function simulationSeconds(etaMins: number): number {
  return Math.max(120, Math.min(600, Math.round((etaMins * 60) / 6)));
}
