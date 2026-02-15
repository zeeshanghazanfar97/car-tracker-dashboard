export interface TrackingSegmentRow {
  id: number;
  plate_number: string;
  speed_kmh: number | null;
  heading: number | null;
  first_gps_timestamp: string | null;
  last_gps_timestamp: string | null;
  first_server_timestamp: string | null;
  last_server_timestamp: string | null;
  display_name: string | null;
  road: string | null;
  suburb: string | null;
  city: string | null;
  subdistrict: string | null;
  county: string | null;
  state_district: string | null;
  state: string | null;
  postcode: string | null;
  country: string | null;
  country_code: string | null;
  location_text: string | null;
  raw_tracker: unknown;
  raw_geocode: unknown;
  created_at: string | null;
  updated_at: string | null;
}

export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface NormalizedSegment extends TrackingSegmentRow {
  point: GeoPoint | null;
  effective_start: string;
  effective_end: string;
  duration_sec: number;
  has_time_anomaly: boolean;
}

export interface VehicleCurrentLocation {
  plateNumber: string;
  id: number;
  displayName: string | null;
  road: string | null;
  city: string | null;
  speedKmh: number | null;
  heading: number | null;
  lastGpsTimestamp: string | null;
  lastServerTimestamp: string | null;
  lat: number | null;
  lon: number | null;
  locationWarning: string | null;
}

export interface TripReport {
  plateNumber: string;
  displayName: string | null;
  startTime: string;
  endTime: string;
  durationSec: number;
  idleSec: number;
  movingSec: number;
  distanceKm: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  startLat: number | null;
  startLon: number | null;
  endLat: number | null;
  endLon: number | null;
  points: GeoPoint[];
  hasTimeAnomaly: boolean;
}

export interface DateRange {
  from: Date;
  to: Date;
}
