import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import { 
  Layers, 
  Flame, 
  Droplets, 
  Radio, 
  MapPin, 
  Eye, 
  PlusCircle, 
  Maximize2, 
  Minimize2, 
  Activity, 
  Compass,
  Camera,
  X,
  Bell
} from 'lucide-react';
import { Zone, FirmsHotspot } from '../types';
import { ConfidenceBadge } from './ConfidenceBadge';
import { SensorWeatherPanel } from './SensorWeatherPanel';
import { TimelineScrubber } from './TimelineScrubber';
import { ImageUploadPanel } from './ImageUploadPanel';
import { AlertDispatchModal } from './AlertDispatchModal';

interface MapViewProps {
  zones: Zone[];
  selectedZone: Zone;
  onSelectZone: (zone: Zone) => void;
  onMapClickCoords: (coords: { lat: number; lon: number }) => void;
  firmsHotspots: FirmsHotspot[];
  onOpenReportModal: () => void;
}

export const MapView: React.FC<MapViewProps> = ({
  zones,
  selectedZone,
  onSelectZone,
  onMapClickCoords,
  firmsHotspots,
  onOpenReportModal
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  // Layer toggles (§10)
  const [showZones, setShowZones] = useState<boolean>(true);
  const [showFirms, setShowFirms] = useState<boolean>(true);
  const [showHeatmap, setShowHeatmap] = useState<boolean>(true);
  const [showSensors, setShowSensors] = useState<boolean>(true);
  const [showIncidents, setShowIncidents] = useState<boolean>(true);
  const [showSatelliteBase, setShowSatelliteBase] = useState<boolean>(false);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState<boolean>(false);

  // Side panels & quick tools
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [showQuickVision, setShowQuickVision] = useState<boolean>(false);

  // Initialize MapLibre
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Use Carto Dark Matter style for tactical dark command center
    const cartoKey = import.meta.env.VITE_CARTO_API_KEY || 'cb1_3ywa_1_0bb93c98faa6e07430cffd29';
    const keyParam = cartoKey ? `?key=${cartoKey}` : '';

    const darkStyle = {
      version: 8,
      sources: {
        'osm-tiles': {
          type: 'raster',
          tiles: [
            `https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png${keyParam}`,
            `https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png${keyParam}`,
            `https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png${keyParam}`
          ],
          tileSize: 256,
          attribution: '&copy; CartoDB &copy; OpenStreetMap contributors'
        }
      },
      layers: [
        {
          id: 'osm-tiles-layer',
          type: 'raster',
          source: 'osm-tiles',
          minzoom: 0,
          maxzoom: 19
        }
      ]
    };

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: darkStyle as any,
      center: [selectedZone ? selectedZone.lon : -0.3763, selectedZone ? selectedZone.lat : 39.4699],
      zoom: 6.5,
      pitch: 35,
      bearing: 0,
      attributionControl: false
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');

    map.on('load', () => {
      mapRef.current = map;
      renderZonePolygons(map);
      renderHeatmapLayer(map);
      renderHotspotsAndMarkers(map);
    });

    // Map click listener to select coordinates for reporting (§6.1)
    map.on('click', (e) => {
      const { lng, lat } = e.lngLat;
      onMapClickCoords({ lat, lon: lng });
    });

    return () => {
      map.remove();
    };
  }, []);

  // Update polygon layers when zones or showZones change
  useEffect(() => {
    if (mapRef.current && mapRef.current.isStyleLoaded()) {
      renderZonePolygons(mapRef.current);
    }
  }, [zones, showZones, selectedZone]);

  // Update heatmap layer
  useEffect(() => {
    if (mapRef.current && mapRef.current.isStyleLoaded()) {
      renderHeatmapLayer(mapRef.current);
    }
  }, [showHeatmap, firmsHotspots, zones]);

  // Update markers when layer toggles or hotspots change
  useEffect(() => {
    if (mapRef.current && mapRef.current.isStyleLoaded()) {
      renderHotspotsAndMarkers(mapRef.current);
    }
  }, [showFirms, showSensors, showIncidents, firmsHotspots, selectedZone]);

  // Fly to selected zone when changed
  useEffect(() => {
    if (mapRef.current && selectedZone) {
      mapRef.current.flyTo({
        center: [selectedZone.lon, selectedZone.lat],
        zoom: 8.5,
        pitch: 45,
        speed: 1.2,
        curve: 1.4,
        essential: true
      });
    }
  }, [selectedZone?.id]);

  const renderZonePolygons = (map: maplibregl.Map) => {
    const sourceId = 'zones-geojson-source';
    const fillLayerId = 'zones-fill-layer';
    const lineLayerId = 'zones-line-layer';

    const features = zones
      .filter((z) => z.geom_geojson)
      .map((z) => ({
        type: 'Feature',
        properties: {
          id: z.id,
          name: z.name,
          country: z.country,
          disaster_type: z.disaster_type,
          severity: z.current_severity,
          confidence: z.current_confidence,
          isSelected: selectedZone?.id === z.id,
        },
        geometry: z.geom_geojson,
      }));

    const geojsonData: any = {
      type: 'FeatureCollection',
      features: features,
    };

    if (map.getSource(sourceId)) {
      (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(geojsonData);
    } else {
      map.addSource(sourceId, {
        type: 'geojson',
        data: geojsonData,
      });

      // Fill Layer
      map.addLayer({
        id: fillLayerId,
        type: 'fill',
        source: sourceId,
        paint: {
          'fill-color': [
            'case',
            ['>=', ['get', 'severity'], 0.75], '#ef4444',
            ['>=', ['get', 'severity'], 0.45], '#f59e0b',
            '#3b82f6'
          ],
          'fill-opacity': [
            'case',
            ['boolean', ['get', 'isSelected'], false], 0.35,
            0.18
          ]
        }
      });

      // Outline Line Layer
      map.addLayer({
        id: lineLayerId,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': [
            'case',
            ['boolean', ['get', 'isSelected'], false], '#60a5fa',
            ['>=', ['get', 'severity'], 0.75], '#f87171',
            ['>=', ['get', 'severity'], 0.45], '#fbbf24',
            '#60a5fa'
          ],
          'line-width': [
            'case',
            ['boolean', ['get', 'isSelected'], false], 3,
            1.5
          ],
          'line-dasharray': [2, 1]
        }
      });

      // Hover / Click on Polygon
      map.on('click', fillLayerId, (e: any) => {
        if (e.features && e.features[0]) {
          const zoneId = e.features[0].properties.id;
          const target = zones.find((z) => z.id === zoneId);
          if (target) onSelectZone(target);
        }
      });
    }

    if (map.getLayer(fillLayerId)) {
      map.setLayoutProperty(fillLayerId, 'visibility', showZones ? 'visible' : 'none');
    }
    if (map.getLayer(lineLayerId)) {
      map.setLayoutProperty(lineLayerId, 'visibility', showZones ? 'visible' : 'none');
    }
  };

  const renderHotspotsAndMarkers = (map: maplibregl.Map) => {
    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // 1. Render NASA FIRMS Active Wildfire Thermal Hotspots
    if (showFirms && firmsHotspots) {
      firmsHotspots.forEach((h) => {
        const el = document.createElement('div');
        el.className = 'group relative flex items-center justify-center cursor-pointer';
        el.innerHTML = `
          <div class="w-3.5 h-3.5 rounded-full bg-red-500 border border-amber-300 shadow-glow-red animate-pulse flex items-center justify-center text-[8px] text-white font-bold">
            🔥
          </div>
        `;

        const popup = new maplibregl.Popup({ offset: 12, closeButton: false }).setHTML(`
          <div class="text-xs space-y-1 font-mono">
            <div class="font-bold text-amber-400 flex items-center space-x-1">
              <span>NASA FIRMS THERMAL HOTSPOT</span>
            </div>
            <div>Brightness: ${h.brightness.toFixed(1)} K</div>
            <div>Fire Radiative Power: ${h.frp.toFixed(1)} MW</div>
            <div>Satellite: ${h.satellite} (${h.acq_date})</div>
            <div class="text-[10px] text-slate-400">Confidence: ${(h.confidence * 100).toFixed(0)}%</div>
          </div>
        `);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([h.longitude, h.latitude])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push(marker);
      });
    }

    // 2. Render Zone Centroids & Active Sensors
    if (showSensors) {
      zones.forEach((z) => {
        const el = document.createElement('div');
        el.className = 'flex items-center justify-center cursor-pointer';
        const isSelected = selectedZone?.id === z.id;
        el.innerHTML = `
          <div class="flex items-center space-x-1 px-2 py-1 rounded-full border backdrop-blur-md transition-all ${
            isSelected 
              ? 'bg-blue-600/90 text-white border-blue-400 shadow-glow-cyan scale-110' 
              : 'bg-command-950/80 text-slate-200 border-command-700 hover:border-slate-400'
          }">
            <span class="w-2 h-2 rounded-full ${z.disaster_type === 'flood' ? 'bg-blue-400' : 'bg-amber-400'} animate-ping"></span>
            <span class="text-[10px] font-mono font-bold uppercase">${z.name.split(' ')[0]}</span>
          </div>
        `;

        el.addEventListener('click', () => {
          onSelectZone(z);
        });

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([z.lon, z.lat])
          .addTo(map);

        markersRef.current.push(marker);
      });
    }

    // 3. Render Citizen & First Responder Incidents
    if (showIncidents && selectedZone?.incidents) {
      selectedZone.incidents.forEach((inc) => {
        const el = document.createElement('div');
        el.className = 'cursor-pointer';
        el.innerHTML = `
          <div class="w-4 h-4 rounded-full bg-amber-500 border border-white text-[10px] flex items-center justify-center font-bold text-black shadow-md">
            !
          </div>
        `;

        const popup = new maplibregl.Popup({ offset: 12 }).setHTML(`
          <div class="text-xs space-y-1">
            <div class="font-bold text-amber-400 uppercase font-mono">${inc.disaster_type} (Sev: ${inc.severity}/5)</div>
            <p class="text-slate-300 font-sans">${inc.description}</p>
            <div class="text-[10px] text-slate-400 font-mono">Source: ${inc.source}</div>
          </div>
        `);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([inc.lon, inc.lat])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push(marker);
      });
    }
  };

  const renderHeatmapLayer = (map: maplibregl.Map) => {
    const sourceId = 'tactical-heatmap-source';
    const layerId = 'tactical-heatmap-layer';

    if (!showHeatmap) {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', 'none');
      }
      return;
    }

    const features: any[] = [];

    // Add FIRMS hotspots with normalized intensity
    firmsHotspots.forEach((h) => {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [h.longitude, h.latitude]
        },
        properties: {
          intensity: Math.min(1.0, Math.max(0.3, (h.frp || 25) / 100))
        }
      });
    });

    // Add Zone disaster centroids
    zones.forEach((z) => {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [z.lon, z.lat]
        },
        properties: {
          intensity: Math.max(0.5, z.current_severity || 0.6)
        }
      });
    });

    const geojsonData: any = {
      type: 'FeatureCollection',
      features
    };

    if (map.getSource(sourceId)) {
      (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(geojsonData);
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', 'visible');
      }
    } else {
      map.addSource(sourceId, {
        type: 'geojson',
        data: geojsonData
      });

      map.addLayer(
        {
          id: layerId,
          type: 'heatmap',
          source: sourceId,
          maxzoom: 14,
          paint: {
            'heatmap-weight': [
              'interpolate',
              ['linear'],
              ['get', 'intensity'],
              0, 0,
              1, 1
            ],
            'heatmap-intensity': [
              'interpolate',
              ['linear'],
              ['zoom'],
              0, 1.2,
              9, 3.5
            ],
            'heatmap-color': [
              'interpolate',
              ['linear'],
              ['heatmap-density'],
              0, 'rgba(0, 0, 0, 0)',
              0.2, 'rgba(59, 130, 246, 0.5)',
              0.4, 'rgba(16, 185, 129, 0.7)',
              0.6, 'rgba(245, 158, 11, 0.85)',
              0.8, 'rgba(239, 68, 68, 0.95)',
              1, 'rgba(220, 38, 38, 1)'
            ],
            'heatmap-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              0, 8,
              5, 25,
              10, 50
            ],
            'heatmap-opacity': 0.85
          }
        },
        'zones-line-layer'
      );
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] overflow-hidden bg-command-950">
      {/* MapLibre Canvas Container */}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />

      {/* Top Left: Worldwide Hotspot Quick Selector */}
      <div className="absolute top-4 left-4 z-10 flex flex-col space-y-2">
        <div className="hud-panel p-2.5 rounded-xl border border-command-700 shadow-xl max-w-sm">
          <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-command-800">
            <span className="text-[11px] font-mono font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-1.5">
              <Compass className="w-3.5 h-3.5 text-blue-400" />
              <span>Worldwide Disaster Sectors</span>
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">
              {zones.length} ZONES
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
            {zones.map((z) => {
              const isSelected = selectedZone?.id === z.id;
              return (
                <button
                  key={z.id}
                  onClick={() => onSelectZone(z)}
                  className={`text-[11px] font-mono px-2 py-1 rounded transition-all cursor-pointer flex items-center space-x-1 ${
                    isSelected
                      ? 'bg-blue-600 text-white font-bold shadow-sm'
                      : 'bg-command-900/80 hover:bg-command-800 text-slate-300 border border-command-800'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${z.disaster_type === 'flood' ? 'bg-blue-400' : 'bg-amber-400'}`} />
                  <span>{z.name}</span>
                  <span className="text-[9px] opacity-70">({z.country})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Layer Toggles Pill (§10) */}
        <div className="hud-panel p-2 rounded-lg border border-command-700 flex items-center space-x-1.5 text-xs font-mono">
          <span className="text-[10px] text-slate-400 px-1 uppercase">LAYERS:</span>
          <button
            onClick={() => setShowZones(!showZones)}
            className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
              showZones ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40' : 'text-slate-500 bg-command-900'
            }`}
          >
            Zones
          </button>
          <button
            onClick={() => setShowFirms(!showFirms)}
            className={`px-2 py-0.5 rounded text-[10px] transition-colors flex items-center space-x-1 ${
              showFirms ? 'bg-red-600/30 text-red-300 border border-red-500/40' : 'text-slate-500 bg-command-900'
            }`}
          >
            <span>FIRMS Points</span>
          </button>
          <button
            onClick={() => setShowHeatmap(!showHeatmap)}
            className={`px-2 py-0.5 rounded text-[10px] transition-colors flex items-center space-x-1 ${
              showHeatmap ? 'bg-orange-600/30 text-orange-300 border border-orange-500/40' : 'text-slate-500 bg-command-900'
            }`}
          >
            <span>🔥 Heatmap</span>
          </button>
          <button
            onClick={() => setShowSensors(!showSensors)}
            className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
              showSensors ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40' : 'text-slate-500 bg-command-900'
            }`}
          >
            IoT Mesh
          </button>
          <button
            onClick={() => setShowIncidents(!showIncidents)}
            className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
              showIncidents ? 'bg-amber-600/30 text-amber-300 border border-amber-500/40' : 'text-slate-500 bg-command-900'
            }`}
          >
            Incidents
          </button>
        </div>
      </div>

      {/* Floating Map Actions */}
      <div className="absolute top-4 right-14 z-10 flex items-center space-x-2">
        <button
          onClick={() => setIsAlertModalOpen(true)}
          className="flex items-center space-x-1.5 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-glow-red transition-all cursor-pointer font-sans"
        >
          <Bell className="w-3.5 h-3.5" />
          <span>Alert Residents</span>
        </button>
        <button
          onClick={onOpenReportModal}
          className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer font-sans"
        >
          <PlusCircle className="w-4 h-4" />
          <span>+ Add Report Here</span>
        </button>
      </div>

      {/* Quick Tool: Analyze Image Floater */}
      <div className="absolute top-16 right-14 z-10">
        <button
          onClick={() => setShowQuickVision(!showQuickVision)}
          className="flex items-center space-x-1.5 bg-command-900/90 hover:bg-command-800 text-purple-300 border border-purple-500/30 px-3 py-1.5 rounded-lg text-xs font-mono shadow-md transition-all cursor-pointer"
        >
          <Camera className="w-3.5 h-3.5 text-purple-400" />
          <span>Analyze Image Quick-Tool</span>
        </button>
      </div>

      {/* Floating Quick Vision Modal */}
      {showQuickVision && (
        <div className="absolute top-28 right-14 z-20 w-96 shadow-2xl animate-fadeIn">
          <div className="relative">
            <button
              onClick={() => setShowQuickVision(false)}
              className="absolute top-3 right-3 text-slate-400 hover:text-white z-30"
            >
              <X className="w-4 h-4" />
            </button>
            <ImageUploadPanel
              zones={zones}
              selectedZoneId={selectedZone?.id}
              compact={true}
              onAnalysisComplete={() => {
                // Keep open to see result
              }}
            />
          </div>
        </div>
      )}

      {/* Bottom Floating Temporal Scrubber (§10) */}
      <div className="absolute bottom-6 left-4 right-4 sm:left-auto sm:right-auto sm:left-1/2 sm:-translate-x-1/2 z-10 w-full sm:w-auto px-4">
        <TimelineScrubber />
      </div>

      {/* Right Collapsible Telemetry HUD (SensorWeatherPanel) */}
      <div
        className={`absolute top-0 right-0 bottom-0 z-20 w-80 lg:w-96 transition-transform duration-300 ${
          isSidebarOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute -left-8 top-1/2 -translate-y-1/2 bg-command-900 border-l border-t border-b border-command-700 text-slate-300 p-1.5 rounded-l-md hover:bg-command-800 transition-colors shadow-lg"
        >
          {isSidebarOpen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>

        {selectedZone && (
          <SensorWeatherPanel selectedZone={selectedZone} />
        )}
      </div>

      {/* Alert Dispatch Modal */}
      <AlertDispatchModal
        isOpen={isAlertModalOpen}
        onClose={() => setIsAlertModalOpen(false)}
        zone={selectedZone}
      />
    </div>
  );
};
