import { bad, int, oneOf, str } from '../api';
import { GENDER_PREFS, MODES, VEHICLE_TYPES } from '../constants';
import type { LegInput } from './engine';
import { normalizeTransit } from '../transit';

export function parseLeg(raw: unknown, label = 'Leg'): LegInput {
  if (!raw || typeof raw !== 'object') throw bad(`${label} is invalid`);
  const o = raw as Record<string, unknown>;
  const mode = oneOf(o.mode, `${label} mode`, MODES);
  let trainNumber: string | null = null;
  let flightNumber: string | null = null;
  if (mode === 'TRAIN') {
    const n = normalizeTransit(str(o.trainNumber, `${label} train number`, { max: 10 }));
    if (!n || n.kind !== 'TRAIN') throw bad(`${label}: enter a valid 5-digit train number`);
    trainNumber = n.number;
  }
  if (mode === 'FLIGHT') {
    const n = normalizeTransit(str(o.flightNumber, `${label} flight number`, { max: 10 }));
    if (!n || n.kind !== 'FLIGHT') throw bad(`${label}: enter a valid flight number like 6E-2134`);
    flightNumber = n.number;
  }
  // Optional informational flight/train on cab legs (e.g. cab to catch train 12301)
  if (mode === 'CAB' || mode === 'AUTO') {
    if (o.trainNumber) { const n = normalizeTransit(String(o.trainNumber)); if (n?.kind === 'TRAIN') trainNumber = n.number; }
    if (o.flightNumber) { const n = normalizeTransit(String(o.flightNumber)); if (n?.kind === 'FLIGHT') flightNumber = n.number; }
  }
  return {
    originId: str(o.originId, `${label} origin`),
    destId: str(o.destId, `${label} destination`),
    date: str(o.date, `${label} date`),
    windowStart: str(o.windowStart, `${label} window start`),
    windowEnd: str(o.windowEnd, `${label} window end`),
    mode,
    vehicleType: o.vehicleType ? oneOf(o.vehicleType, `${label} vehicle`, VEHICLE_TYPES) : 'SEDAN4',
    luggage: int(o.luggage ?? 0, `${label} luggage`, 0, 3),
    genderPref: o.genderPref ? oneOf(o.genderPref, `${label} gender preference`, GENDER_PREFS) : 'MIXED',
    trainNumber, flightNumber,
  };
}
