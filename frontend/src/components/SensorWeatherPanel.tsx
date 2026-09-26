import React, { useState, useEffect } from 'react';
import { 
  CloudRain, 
  Wind, 
  Thermometer, 
  Compass, 
  Activity, 
  RefreshCw, 
  Droplets, 
  Flame, 
  Radio, 
  Clock
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { api } from '../api';
import { Zone, WeatherSnapshot, SensorReading } from '../types';

interface SensorWeatherPanelProps {
  selectedZone: Zone;
  onRefresh?: () => void;
}

export const SensorWeatherPanel: React.FC<SensorWeatherPanelProps> = ({
  selectedZone,
  onRefresh
}) => {
  const [weatherHistory, setWeatherHistory] = useState<WeatherSnapshot[]>([]);
  const [sensorHistory, setSensorHistory] = useState<SensorReading[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isTicking, setIsTicking] = useState<boolean>(false);

  useEffect(() => {
    if (selectedZone) {
      loadTelemetry(selectedZone.id);
    }
  }, [selectedZone?.id]);

  const loadTelemetry = async (zoneId: number) => {
    setIsLoading(true);
    try {
      const [wData, sData] = await Promise.all([
        api.getWeatherHistory(zoneId),
        api.getSensorHistory(zoneId),
      ]);
      setWeatherHistory(wData);
      setSensorHistory(sData);
    } catch (err) {
      console.error('Failed to load telemetry:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualSensorTick = async () => {
    setIsTicking(true);
    try {
      await api.triggerSensorTick();
      if (selectedZone) {
        await loadTelemetry(selectedZone.id);
      }
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setIsTicking(false);
    }
  };

  const handleManualWeatherPoll = async () => {
    setIsLoading(true);
    try {
      await api.triggerWeatherPoll(selectedZone?.id);
      if (selectedZone) {
        await loadTelemetry(selectedZone.id);
      }
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Format chart data
  const chartData = weatherHistory.map((w, idx) => {
    const timeStr = new Date(w.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    // Match matching sensor reading if available
    const matchedSensor = sensorHistory[idx];
    return {
      time: timeStr,
      temp: w.temperature,
      humidity: w.humidity,
      wind: w.wind_speed,
      precip: w.precipitation,
      sensorVal: matchedSensor ? matchedSensor.value : null,
      sensorType: matchedSensor ? matchedSensor.sensor_type : '',
    };
  });

  const latestWeather = weatherHistory[weatherHistory.length - 1] || selectedZone.latest_weather;
  const latestSensors = selectedZone.recent_sensors || [];

  return (
    <div className="h-full flex flex-col bg-command-900/90 backdrop-blur-xl border-l border-command-800 p-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-command-800">
        <div className="flex items-center space-x-2">
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h3 className="font-mono text-xs font-bold text-slate-100 uppercase tracking-wider">
              Environmental Telemetry HUD
            </h3>
            <p className="text-[11px] text-slate-400">
              {selectedZone.name} ({selectedZone.country})
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={handleManualWeatherPoll}
            disabled={isLoading}
            title="Poll live global weather from Open-Meteo / NOAA"
            className="p-1.5 rounded bg-command-800 hover:bg-command-700 text-slate-300 text-xs border border-command-700 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Primary Weather Grid */}
      {latestWeather ? (
        <div className="grid grid-cols-2 gap-2 my-4">
          {/* Temperature */}
          <div className="p-3 rounded-lg bg-command-950/70 border border-command-800">
            <div className="flex items-center justify-between text-slate-400 text-[10px] font-mono uppercase mb-1">
              <span>Temperature</span>
              <Thermometer className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-xl font-bold font-mono text-slate-100">
              {latestWeather.temperature.toFixed(1)}°C
            </div>
            <span className="text-[10px] text-slate-500 font-sans">
              Cond: {latestWeather.weather_condition}
            </span>
          </div>

          {/* Wind Speed */}
          <div className="p-3 rounded-lg bg-command-950/70 border border-command-800">
            <div className="flex items-center justify-between text-slate-400 text-[10px] font-mono uppercase mb-1">
              <span>Wind Speed</span>
              <Wind className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="text-xl font-bold font-mono text-slate-100">
              {latestWeather.wind_speed.toFixed(1)} <span className="text-xs text-slate-400">km/h</span>
            </div>
            <span className="text-[10px] text-slate-500 font-sans">
              Surface Vector 10m
            </span>
          </div>

          {/* Relative Humidity */}
          <div className="p-3 rounded-lg bg-command-950/70 border border-command-800">
            <div className="flex items-center justify-between text-slate-400 text-[10px] font-mono uppercase mb-1">
              <span>Relative Humidity</span>
              <Droplets className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="text-xl font-bold font-mono text-slate-100">
              {latestWeather.humidity.toFixed(0)}%
            </div>
            <span className="text-[10px] text-slate-500 font-sans">
              {latestWeather.humidity < 25 ? 'Critical Fire Weather' : 'Atmospheric Dewpoint'}
            </span>
          </div>

          {/* Precipitation */}
          <div className="p-3 rounded-lg bg-command-950/70 border border-command-800">
            <div className="flex items-center justify-between text-slate-400 text-[10px] font-mono uppercase mb-1">
              <span>Precipitation</span>
              <CloudRain className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-xl font-bold font-mono text-slate-100">
              {latestWeather.precipitation.toFixed(1)} <span className="text-xs text-slate-400">mm/h</span>
            </div>
            <span className="text-[10px] text-slate-500 font-sans">
              Runoff Gauge
            </span>
          </div>
        </div>
      ) : (
        <div className="py-6 text-center text-xs text-slate-500 font-mono">
          Loading atmospheric observation...
        </div>
      )}

      {/* Sparkline 1: 24h Temperature & Wind Velocity */}
      <div className="mb-4 p-3 rounded-lg bg-command-950/50 border border-command-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-mono text-slate-300 uppercase tracking-wider flex items-center space-x-1">
            <Thermometer className="w-3 h-3 text-amber-400" />
            <span>24h Diurnal Trend (°C)</span>
          </span>
          <span className="text-[10px] font-mono text-slate-500">Live Forecast Series</span>
        </div>
        <div className="h-28 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="time" hide />
              <YAxis hide domain={['auto', 'auto']} />
              <Tooltip 
                contentStyle={{ background: '#0a0f1d', borderColor: '#1e293b', fontSize: '11px', borderRadius: '6px' }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Area type="monotone" dataKey="temp" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#tempGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Ground IoT Telemetry Gauges */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-mono text-slate-300 uppercase tracking-wider flex items-center space-x-1">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>Ground IoT Sensor Mesh (§6.3)</span>
          </span>
          <button
            onClick={handleManualSensorTick}
            disabled={isTicking}
            className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-colors"
          >
            {isTicking ? 'Simulating...' : 'Simulate IoT Tick'}
          </button>
        </div>

        <div className="space-y-2">
          {latestSensors.slice(0, 4).map((sensor) => (
            <div
              key={sensor.id}
              className="p-2.5 rounded-lg bg-command-950/60 border border-command-800 flex items-center justify-between"
            >
              <div className="flex items-center space-x-2">
                <span className={`w-2 h-2 rounded-full ${
                  sensor.sensor_type.includes('water') ? 'bg-blue-400' :
                  sensor.sensor_type.includes('smoke') ? 'bg-amber-400' : 'bg-emerald-400'
                }`} />
                <div>
                  <div className="text-xs font-medium text-slate-200 capitalize font-mono">
                    {sensor.sensor_type.replace(/_/g, ' ')}
                  </div>
                  <div className="text-[10px] text-slate-500 flex items-center space-x-1">
                    <Clock className="w-2.5 h-2.5" />
                    <span>{new Date(sensor.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold font-mono text-slate-100">
                  {sensor.value.toFixed(1)}
                </span>
                <span className="text-[10px] text-slate-400 font-mono ml-1">
                  {sensor.unit}
                </span>
              </div>
            </div>
          ))}

          {latestSensors.length === 0 && (
            <div className="p-4 rounded-lg bg-command-950/40 border border-command-800 text-center text-xs text-slate-500">
              No active IoT telemetry. Click 'Simulate IoT Tick' to stream sensor readings.
            </div>
          )}
        </div>
      </div>

      {/* Sparkline 2: 24h Wind Gust or River Stage */}
      <div className="p-3 rounded-lg bg-command-950/50 border border-command-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-mono text-slate-300 uppercase tracking-wider flex items-center space-x-1">
            <Wind className="w-3 h-3 text-cyan-400" />
            <span>Wind / Runoff Velocity Trend</span>
          </span>
          <span className="text-[10px] font-mono text-slate-500">Anemometer Array</span>
        </div>
        <div className="h-24 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis dataKey="time" hide />
              <YAxis hide domain={['auto', 'auto']} />
              <Tooltip 
                contentStyle={{ background: '#0a0f1d', borderColor: '#1e293b', fontSize: '11px', borderRadius: '6px' }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Line type="monotone" dataKey="wind" stroke="#06b6d4" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
