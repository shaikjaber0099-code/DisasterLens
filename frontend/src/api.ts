import { Zone, Incident, Evidence, SensorReading, WeatherSnapshot, Report, QueueItem, FirmsHotspot } from './types';

const BASE_URL = '/api';

export const api = {
  // Zones
  getZones: async (): Promise<Zone[]> => {
    const res = await fetch(`${BASE_URL}/zones`);
    if (!res.ok) throw new Error('Failed to fetch zones');
    return res.json();
  },

  getZoneDetail: async (zoneId: number): Promise<Zone> => {
    const res = await fetch(`${BASE_URL}/zones/${zoneId}`);
    if (!res.ok) throw new Error('Failed to fetch zone detail');
    return res.json();
  },

  triggerFusion: async (zoneId: number): Promise<Zone> => {
    const res = await fetch(`${BASE_URL}/zones/${zoneId}/trigger-fusion`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to trigger fusion');
    return res.json();
  },

  getFirmsHotspots: async (country?: string): Promise<FirmsHotspot[]> => {
    const res = await fetch(`${BASE_URL}/zones/firms-hotspots?country=${country || 'USA'}`);
    if (!res.ok) throw new Error('Failed to fetch FIRMS hotspots');
    return res.json();
  },

  // Incidents
  getIncidents: async (zoneId?: number): Promise<Incident[]> => {
    const url = zoneId ? `${BASE_URL}/incidents?zone_id=${zoneId}` : `${BASE_URL}/incidents`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch incidents');
    return res.json();
  },

  createIncident: async (data: {
    lat: number;
    lon: number;
    disaster_type: string;
    severity: number;
    description: string;
    image_url?: string;
    source?: string;
  }): Promise<Incident> => {
    const res = await fetch(`${BASE_URL}/incidents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to report incident');
    return res.json();
  },

  // Image Analysis
  analyzeImage: async (formData: FormData): Promise<any> => {
    const res = await fetch(`${BASE_URL}/analyze-image`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('Failed to analyze image');
    return res.json();
  },

  // Review Queue
  getReviewQueue: async (): Promise<{ count: number; items: QueueItem[]; pending_summaries: any[] }> => {
    const res = await fetch(`${BASE_URL}/review/queue`);
    if (!res.ok) throw new Error('Failed to fetch review queue');
    return res.json();
  },

  reviewEvidence: async (evidenceId: number, action: 'approve' | 'reject' | 'request_more_data', notes?: string): Promise<Evidence> => {
    const res = await fetch(`${BASE_URL}/review/evidence/${evidenceId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, notes }),
    });
    if (!res.ok) throw new Error('Failed to update evidence status');
    return res.json();
  },

  reviewSummary: async (summaryId: number, action: 'approve' | 'reject' | 'edit', edited_text?: string): Promise<any> => {
    const res = await fetch(`${BASE_URL}/review/summary/${summaryId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, edited_text }),
    });
    if (!res.ok) throw new Error('Failed to review summary');
    return res.json();
  },

  // Sensors & Weather
  getSensorHistory: async (zoneId: number): Promise<SensorReading[]> => {
    const res = await fetch(`${BASE_URL}/sensors/${zoneId}`);
    if (!res.ok) throw new Error('Failed to fetch sensor history');
    return res.json();
  },

  triggerSensorTick: async (): Promise<any> => {
    const res = await fetch(`${BASE_URL}/sensors/tick`, { method: 'POST' });
    return res.json();
  },

  getWeatherHistory: async (zoneId: number): Promise<WeatherSnapshot[]> => {
    const res = await fetch(`${BASE_URL}/weather/${zoneId}`);
    if (!res.ok) throw new Error('Failed to fetch weather history');
    return res.json();
  },

  triggerWeatherPoll: async (zoneId?: number): Promise<any> => {
    const url = zoneId ? `${BASE_URL}/weather/poll?zone_id=${zoneId}` : `${BASE_URL}/weather/poll`;
    const res = await fetch(url, { method: 'POST' });
    return res.json();
  },

  // Reports
  getReports: async (zoneId?: number): Promise<Report[]> => {
    const url = zoneId ? `${BASE_URL}/reports?zone_id=${zoneId}` : `${BASE_URL}/reports`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch reports');
    return res.json();
  },

  generateReport: async (zoneId: number, title?: string): Promise<Report> => {
    const res = await fetch(`${BASE_URL}/reports/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zone_id: zoneId, title }),
    });
    if (!res.ok) throw new Error('Failed to generate report');
    return res.json();
  },

  // Evaluation
  getEvaluation: async (): Promise<any> => {
    const res = await fetch(`${BASE_URL}/evaluation/run`);
    if (!res.ok) throw new Error('Failed to run evaluation benchmark');
    return res.json();
  },

  // Twilio Two-Way Alerting & Resident Inquiries
  getZoneReplies: async (zoneId: number): Promise<any[]> => {
    const res = await fetch(`${BASE_URL}/zones/${zoneId}/replies`);
    if (!res.ok) throw new Error('Failed to fetch zone replies');
    return res.json();
  },

  getZoneResidents: async (zoneId: number): Promise<{ count: number; residents: any[] }> => {
    const res = await fetch(`${BASE_URL}/zones/${zoneId}/residents`);
    if (!res.ok) throw new Error('Failed to fetch zone residents');
    return res.json();
  },

  dispatchAlert: async (payload: {
    recipient_number: string;
    channel: string;
    zone_id: number;
    rationale: string;
  }): Promise<any> => {
    const res = await fetch(`${BASE_URL}/alerts/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to dispatch alert');
    return res.json();
  },

  getAlertDispatches: async (zoneId?: number): Promise<any[]> => {
    const url = zoneId ? `${BASE_URL}/alerts/dispatches?zone_id=${zoneId}` : `${BASE_URL}/alerts/dispatches`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch alert dispatches');
    return res.json();
  },

  simulateCitizenReply: async (payload: {
    From: string;
    Body: string;
    zone_id?: number;
  }): Promise<any> => {
    const res = await fetch(`${BASE_URL}/alerts/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to simulate citizen reply');
    return res.json();
  },

  getNotificationLogs: async (zoneId?: number): Promise<any[]> => {
    const url = zoneId ? `${BASE_URL}/notifications/logs?zone_id=${zoneId}` : `${BASE_URL}/notifications/logs`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch notification logs');
    return res.json();
  }
};

