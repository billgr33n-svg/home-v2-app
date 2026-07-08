import { type Priority } from './priority';

export type RideState =
  | 'needed'
  | 'offered'
  | 'assigned'
  | 'confirmed'
  | 'completed'
  | 'canceled';

export interface RawRide {
  id: string;
  destination_text: string;
  pickup_text: string;
  state: RideState;
  driver_id: string | null;
  depart_by: string | null;
  version: number;
}

export interface RideView {
  id: string;
  destination: string;
  pickup: string;
  state: RideState;
  driverName: string | null;
  ownerLabel: string; // driver name, or "Unassigned"
  needsDriver: boolean;
  statusLabel: string;
  priority: Priority;
  departBy: string | null;
  version: number;
}

// Every ride has a visible status and one owner or "Unassigned" (PRODUCT_RULES).
export function rideStatusLabel(state: RideState, needsDriver: boolean): string {
  if (needsDriver) return 'Needs a driver';
  switch (state) {
    case 'offered':
      return 'Offer pending';
    case 'assigned':
      return 'Driver assigned';
    case 'confirmed':
      return 'Confirmed';
    case 'completed':
      return 'Completed';
    case 'canceled':
      return 'Canceled';
    default:
      return 'Needed';
  }
}

export function toRideView(r: RawRide, driverName: string | null): RideView {
  const needsDriver = r.driver_id == null && (r.state === 'needed' || r.state === 'offered');
  const priority: Priority = needsDriver
    ? 'P0'
    : r.state === 'assigned' || r.state === 'confirmed'
      ? 'P2'
      : 'P1';
  return {
    id: r.id,
    destination: r.destination_text,
    pickup: r.pickup_text,
    state: r.state,
    driverName,
    ownerLabel: driverName ?? 'Unassigned',
    needsDriver,
    statusLabel: rideStatusLabel(r.state, needsDriver),
    priority,
    departBy: r.depart_by,
    version: r.version,
  };
}

// Open rides (still coordinating), most urgent first.
export function openRideViews(rides: RawRide[], nameById: Record<string, string>): RideView[] {
  return rides
    .filter((r) => r.state !== 'completed' && r.state !== 'canceled')
    .map((r) => toRideView(r, r.driver_id ? nameById[r.driver_id] ?? null : null))
    .sort((a, b) => a.priority.localeCompare(b.priority));
}
