// Small reference table of trains / flights used by the buddy finder and quick-fill.
// Unknown numbers are still accepted; these only provide helpful defaults.
export type TransitInfo = { kind: 'TRAIN' | 'FLIGHT'; number: string; name: string; stationCode: string; departs: string; to: string; toCode?: string };

export const KNOWN_TRANSIT: TransitInfo[] = [
  { kind: 'TRAIN', number: '12301', name: 'Howrah–New Delhi Rajdhani', stationCode: 'PRYJ', departs: '22:50', to: 'New Delhi', toCode: 'NDLS' },
  { kind: 'TRAIN', number: '12451', name: 'Shram Shakti Express', stationCode: 'PRYJ', departs: '18:45', to: 'Kanpur Central', toCode: 'CNB' },
  { kind: 'TRAIN', number: '12417', name: 'Prayagraj Express', stationCode: 'PRYJ', departs: '20:20', to: 'New Delhi', toCode: 'NDLS' },
  { kind: 'TRAIN', number: '12559', name: 'Shiv Ganga Express', stationCode: 'PRYJ', departs: '19:35', to: 'New Delhi', toCode: 'NDLS' },
  { kind: 'TRAIN', number: '12403', name: 'Prayagraj–Jaipur SF Express', stationCode: 'PRYJ', departs: '17:30', to: 'Jaipur' },
  { kind: 'FLIGHT', number: '6E-2134', name: 'IndiGo Prayagraj → Delhi', stationCode: 'IXD', departs: '09:40', to: 'Delhi' },
  { kind: 'FLIGHT', number: 'AI-9712', name: 'Air India Prayagraj → Mumbai', stationCode: 'IXD', departs: '11:15', to: 'Mumbai' },
];

export const TRAIN_RE = /^\d{5}$/;
export const FLIGHT_RE = /^[A-Z0-9]{2}-?\d{2,4}$/;

export function normalizeTransit(raw: string): { kind: 'TRAIN' | 'FLIGHT'; number: string } | null {
  const s = raw.trim().toUpperCase().replace(/\s+/g, '');
  if (TRAIN_RE.test(s)) return { kind: 'TRAIN', number: s };
  if (FLIGHT_RE.test(s)) {
    const m = s.match(/^([A-Z0-9]{2})-?(\d{2,4})$/)!;
    return { kind: 'FLIGHT', number: `${m[1]}-${m[2]}` };
  }
  return null;
}

export function findTransit(number: string) {
  return KNOWN_TRANSIT.find((t) => t.number === number);
}
