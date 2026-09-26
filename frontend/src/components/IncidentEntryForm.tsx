import React, { useState } from 'react';
import { 
  AlertTriangle, 
  MapPin, 
  Flame, 
  Droplets, 
  CloudLightning, 
  Activity, 
  Upload, 
  CheckCircle2, 
  Clock, 
  UserCheck, 
  Send
} from 'lucide-react';
import { api } from '../api';
import { Zone } from '../types';

interface IncidentEntryFormProps {
  zones: Zone[];
  selectedCoords?: { lat: number; lon: number } | null;
  onSuccess?: () => void;
}

export const IncidentEntryForm: React.FC<IncidentEntryFormProps> = ({
  zones,
  selectedCoords,
  onSuccess
}) => {
  const [lat, setLat] = useState<string>(selectedCoords ? selectedCoords.lat.toFixed(4) : '39.4699');
  const [lon, setLon] = useState<string>(selectedCoords ? selectedCoords.lon.toFixed(4) : '-0.3763');
  const [disasterType, setDisasterType] = useState<string>('flood');
  const [severity, setSeverity] = useState<number>(3);
  const [description, setDescription] = useState<string>('');
  const [source, setSource] = useState<string>('citizen_report');
  const [timestamp, setTimestamp] = useState<string>(new Date().toISOString().slice(0, 16));
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submittedSuccess, setSubmittedSuccess] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync coords if user clicked on map
  React.useEffect(() => {
    if (selectedCoords) {
      setLat(selectedCoords.lat.toFixed(4));
      setLon(selectedCoords.lon.toFixed(4));
    }
  }, [selectedCoords]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleQuickPreset = (presetZone: Zone) => {
    setLat(presetZone.lat.toFixed(4));
    setLon(presetZone.lon.toFixed(4));
    setDisasterType(presetZone.disaster_type);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Client-side validations from PRD §6.1
    const parsedLat = parseFloat(lat);
    const parsedLon = parseFloat(lon);

    if (isNaN(parsedLat) || isNaN(parsedLon)) {
      setErrorMsg('Valid geographic Latitude and Longitude are required.');
      return;
    }

    if (parsedLat < -90 || parsedLat > 90 || parsedLon < -180 || parsedLon > 180) {
      setErrorMsg('Latitude must be between -90 and 90, Longitude between -180 and 180.');
      return;
    }

    if (!description || description.trim().length < 10) {
      setErrorMsg('Description is required and must contain at least 10 characters detailing the incident.');
      return;
    }

    setIsSubmitting(true);

    try {
      let uploadedImageUrl: string | undefined = undefined;

      // If photo attached, analyze and upload via image pipeline
      if (imageFile) {
        const formData = new FormData();
        formData.append('file', imageFile);
        formData.append('lat', parsedLat.toString());
        formData.append('lon', parsedLon.toString());
        const analysisRes = await api.analyzeImage(formData);
        uploadedImageUrl = analysisRes.image_url;
      }

      await api.createIncident({
        lat: parsedLat,
        lon: parsedLon,
        disaster_type: disasterType,
        severity: severity,
        description: description.trim(),
        image_url: uploadedImageUrl,
        source: source,
      });

      setSubmittedSuccess(true);
      if (onSuccess) onSuccess();

      // Reset fields
      setDescription('');
      setImageFile(null);
      setImagePreview(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit incident report. Please retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header Banner */}
      <div className="hud-panel p-6 rounded-xl border border-command-700 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-mono tracking-wide text-slate-100 uppercase">
                Field Incident Report Entry
              </h2>
              <p className="text-xs text-slate-400">
                Direct citizen & first-responder observational data feed (§6.1). Integrates into real-time fusion engine.
              </p>
            </div>
          </div>
          <div className="hidden sm:block text-right">
            <span className="text-[11px] font-mono px-2 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
              LIVE INGESTION
            </span>
          </div>
        </div>

        {/* Quick Location Presets */}
        <div className="mt-4 pt-4 border-t border-command-800">
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block mb-2">
            Global Active Disaster Hotspot Presets:
          </span>
          <div className="flex flex-wrap gap-2">
            {zones.map((z) => (
              <button
                key={z.id}
                type="button"
                onClick={() => handleQuickPreset(z)}
                className="text-xs px-2.5 py-1 rounded bg-command-900 hover:bg-command-800 border border-command-700 text-slate-300 transition-colors flex items-center space-x-1"
              >
                <span>{z.name}</span>
                <span className="text-[10px] text-slate-500 font-mono">({z.country})</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {submittedSuccess && (
        <div className="p-4 mb-6 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-between animate-fadeIn">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5" />
            <span className="text-sm font-medium">
              Incident successfully recorded! Multi-modal fusion engine triggered. Review queue updated.
            </span>
          </div>
          <button 
            onClick={() => setSubmittedSuccess(false)}
            className="text-xs underline hover:text-emerald-300"
          >
            Dismiss
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 mb-6 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 flex items-center space-x-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{errorMsg}</span>
        </div>
      )}

      {/* Entry Form */}
      <form onSubmit={handleSubmit} className="hud-panel p-6 rounded-xl border border-command-700 space-y-6">
        {/* Disaster Type Selector */}
        <div>
          <label className="block text-xs font-mono text-slate-300 uppercase tracking-wider mb-2">
            Disaster Category *
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { id: 'flood', label: 'Inundation / Flood', icon: Droplets, color: 'text-blue-400' },
              { id: 'wildfire', label: 'Wildfire / Smoke', icon: Flame, color: 'text-amber-500' },
              { id: 'severe_storm', label: 'Severe Storm / Cyclone', icon: CloudLightning, color: 'text-purple-400' },
              { id: 'earthquake', label: 'Structural / Seismic', icon: Activity, color: 'text-emerald-400' },
            ].map((t) => {
              const Icon = t.icon;
              const isSelected = disasterType === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setDisasterType(t.id)}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all text-xs font-medium cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600/20 border-blue-500 text-white shadow-glow-cyan'
                      : 'bg-command-900/60 border-command-800 text-slate-400 hover:border-command-700 hover:text-slate-200'
                  }`}
                >
                  <Icon className={`w-5 h-5 mb-1.5 ${t.color}`} />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Geographic Coordinates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-mono text-slate-300 uppercase tracking-wider mb-1.5 flex items-center space-x-1">
              <MapPin className="w-3.5 h-3.5 text-blue-400" />
              <span>Latitude (Decimal Degrees) *</span>
            </label>
            <input
              type="text"
              required
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="e.g. 39.4699"
              className="w-full bg-command-900 border border-command-800 rounded-lg px-3.5 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-300 uppercase tracking-wider mb-1.5 flex items-center space-x-1">
              <MapPin className="w-3.5 h-3.5 text-blue-400" />
              <span>Longitude (Decimal Degrees) *</span>
            </label>
            <input
              type="text"
              required
              value={lon}
              onChange={(e) => setLon(e.target.value)}
              placeholder="e.g. -0.3763"
              className="w-full bg-command-900 border border-command-800 rounded-lg px-3.5 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        </div>

        {/* Severity Slider */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-xs font-mono text-slate-300 uppercase tracking-wider">
              Self-Reported Severity (1 to 5) *
            </label>
            <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
              severity >= 4 ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
              severity === 3 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
              'bg-blue-500/20 text-blue-400 border border-blue-500/30'
            }`}>
              Level {severity}: {
                severity === 5 ? 'CATSTROPHIC / IMMINENT DANGER' :
                severity === 4 ? 'SEVERE STRUCTURAL HAZARD' :
                severity === 3 ? 'MODERATE DESTRUCTION' :
                severity === 2 ? 'LOCALIZED DISRUPTION' : 'MINOR OBSERVATION'
              }
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="5"
            step="1"
            value={severity}
            onChange={(e) => setSeverity(parseInt(e.target.value))}
            className="w-full h-2 bg-command-900 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
            <span>1 - Minor</span>
            <span>2 - Disruption</span>
            <span>3 - Moderate</span>
            <span>4 - Severe</span>
            <span>5 - Critical</span>
          </div>
        </div>

        {/* Description Field */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-xs font-mono text-slate-300 uppercase tracking-wider">
              Ground Incident Description * (Min 10 Characters)
            </label>
            <span className="text-[10px] font-mono text-slate-500">
              {description.length} chars
            </span>
          </div>
          <textarea
            required
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe visible ground conditions: floodwater depth, smoke plume height, structural collapse, road blockages, evacuees stranded, or active flame fronts..."
            className="w-full bg-command-900 border border-command-800 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Reporting Source & Timestamp */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-mono text-slate-300 uppercase tracking-wider mb-1.5 flex items-center space-x-1">
              <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Reporting Entity</span>
            </label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full bg-command-900 border border-command-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="citizen_report">Citizen Field Observer</option>
              <option value="first_responder">First Responder / Civil Protection</option>
              <option value="drone_operator">UAV / Drone Recon Pilot</option>
              <option value="meteorological_watcher">Volunteer Weather Station</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-300 uppercase tracking-wider mb-1.5 flex items-center space-x-1">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              <span>Observation Timestamp</span>
            </label>
            <input
              type="datetime-local"
              value={timestamp}
              onChange={(e) => setTimestamp(e.target.value)}
              className="w-full bg-command-900 border border-command-800 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Image Attachment with Multimodal AI Vision Preview */}
        <div>
          <label className="block text-xs font-mono text-slate-300 uppercase tracking-wider mb-2 flex items-center space-x-1">
            <Upload className="w-3.5 h-3.5 text-purple-400" />
            <span>Attach Aerial / Ground Photo for Multimodal AI Analysis</span>
          </label>
          <div className="border-2 border-dashed border-command-800 hover:border-command-700 rounded-xl p-4 text-center bg-command-900/40 transition-colors">
            {imagePreview ? (
              <div className="relative inline-block">
                <img
                  src={imagePreview}
                  alt="Incident attachment"
                  className="max-h-48 rounded-lg object-contain border border-command-700 shadow-md"
                />
                <button
                  type="button"
                  onClick={() => {
                    setImageFile(null);
                    setImagePreview(null);
                  }}
                  className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 text-xs hover:bg-red-500"
                >
                  ✕
                </button>
                <p className="text-[11px] text-slate-400 mt-2 font-mono">
                  Image ready for OpenAI gpt-4o / spectral vision classification
                </p>
              </div>
            ) : (
              <label className="cursor-pointer block py-4">
                <Upload className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                <span className="text-sm font-medium text-blue-400 hover:underline">
                  Click to select photo or drag and drop
                </span>
                <p className="text-xs text-slate-500 mt-1">PNG, JPG, WEBP up to 10MB</p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-medium text-sm shadow-glow-cyan transition-all disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                <span>Ingesting Data & Re-Running Multimodal Fusion...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Submit Incident to Disaster Decision Desk</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
