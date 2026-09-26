export interface Incident {
  id: number;
  zone_id?: number;
  lat: number;
  lon: number;
  disaster_type: string;
  severity: number;
  description: string;
  image_url?: string;
  reported_at: string;
  source: string;
  status: string;
}

export interface Evidence {
  id: number;
  zone_id: number;
  type: string; // image, sensor, weather, report, satellite_firms
  payload: any;
  confidence: number;
  model_used: string;
  status: 'pending_review' | 'approved' | 'rejected' | 'needs_more_data';
  created_at: string;
  reviewed_at?: string;
  operator_notes?: string;
}

export interface SensorReading {
  id: number;
  zone_id: number;
  sensor_type: string;
  value: number;
  unit: string;
  recorded_at: string;
}

export interface WeatherSnapshot {
  id: number;
  zone_id: number;
  temperature: number;
  humidity: number;
  pressure: number;
  wind_speed: number;
  precipitation: number;
  weather_condition: string;
  recorded_at: string;
}

export interface SituationSummary {
  id: number;
  zone_id: number;
  summary_text: string;
  generated_by: string;
  confidence: number;
  status: 'pending' | 'approved' | 'rejected';
  priority_rank: number;
  created_at: string;
  approved_at?: string;
}

export interface Zone {
  id: number;
  name: string;
  disaster_type: string;
  current_severity: number;
  current_confidence: number;
  status: string;
  lat: number;
  lon: number;
  radius_km: number;
  country: string;
  region: string;
  geom_geojson?: any;
  updated_at: string;
  incidents?: Incident[];
  evidence_items?: Evidence[];
  latest_weather?: WeatherSnapshot;
  recent_sensors?: SensorReading[];
  active_summary?: SituationSummary;
}

export interface FirmsHotspot {
  latitude: number;
  longitude: number;
  brightness: number;
  scan: number;
  track: number;
  acq_date: string;
  acq_time: string;
  satellite: string;
  confidence: number;
  version: string;
  frp: number;
  daynight: string;
  country?: string;
}

export interface Report {
  id: number;
  zone_id: number;
  title: string;
  content_md: string;
  generated_at: string;
  generated_by: string;
  status: string;
}

export interface QueueItem {
  id: number;
  zone_id: number;
  zone_name: string;
  country: string;
  disaster_type: string;
  type: string;
  payload: any;
  confidence: number;
  model_used: string;
  status: string;
  created_at: string;
  operator_notes?: string;
  severity: number;
  urgency_score: number;
}

export interface Resident {
  id: string;
  name: string;
  phone_number: string;
  latitude: number;
  longitude: number;
  zone_name?: string;
  notes?: string;
}

export interface ResidentReply {
  id: number;
  phone_number: string;
  zone_id: number;
  reply_text: string;
  status: 'SAFE' | 'HELP' | 'UNKNOWN';
  timestamp: string;
}

export interface NotificationLog {
  id: number;
  resident_name?: string;
  phone_number: string;
  zone_id?: number;
  channel: string;
  status: string;
  message_body?: string;
  error_message?: string;
  created_at: string;
}

