import { bad, oneOf, str } from './api';

export const PLACE_KINDS = ['CAMPUS', 'STATION', 'AIRPORT', 'BUS', 'HOME_HUB'] as const;

export function parsePlace(body: Record<string, unknown>) {
  const lat = Number(body.lat), lng = Number(body.lng);
  if (!Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lng) || Math.abs(lng) > 180) throw bad('Enter valid latitude and longitude (e.g. 25.4285, 81.7712)');
  return {
    code: str(body.code, 'Code', { min: 2, max: 20 }).toUpperCase().replace(/[^A-Z0-9-]/g, ''),
    name: str(body.name, 'Name', { min: 3, max: 80 }),
    kind: oneOf(body.kind, 'Type', PLACE_KINDS),
    city: str(body.city, 'City', { min: 2, max: 40 }),
    lat, lng,
  };
}


const PLATE_RE = /^[A-Z]{2}[ -]?\d{1,2}[ -]?[A-Z]{1,3}[ -]?\d{1,4}$/;

export function parseOperator(body: Record<string, unknown>) {
  const plate = str(body.plate, 'Plate number', { max: 20 }).toUpperCase();
  if (!PLATE_RE.test(plate)) throw bad('Enter a valid registration plate, e.g. UP-70-GT-4821');
  return {
    name: str(body.name, 'Driver name', { min: 2, max: 60 }),
    plate: plate.replace(/\s+/g, '-'),
    vehicleType: oneOf(body.vehicleType, 'Vehicle type', ['SEDAN4', 'SUV6', 'AUTO'] as const),
    vehicleName: str(body.vehicleName, 'Vehicle', { min: 2, max: 60 }),
    badge: str(body.badge, 'Verification note', { optional: true, max: 80 }) || 'Verified operator',
    phoneMasked: str(body.phoneMasked, 'Contact shown to riders', { optional: true, max: 40 }) || '—',
  };
}

