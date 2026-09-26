import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { MapView } from './components/MapView';
import { IncidentEntryForm } from './components/IncidentEntryForm';
import { ReviewQueue } from './components/ReviewQueue';
import { ReportsTab } from './components/ReportsTab';
import { EvaluationTab } from './components/EvaluationTab';
import { api } from './api';
import { Zone, FirmsHotspot } from './types';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('map');
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [firmsHotspots, setFirmsHotspots] = useState<FirmsHotspot[]>([]);
  const [pendingQueueCount, setPendingQueueCount] = useState<number>(0);
  const [clickedMapCoords, setClickedMapCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [isMonochrome, setIsMonochrome] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load initial global data
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const [zonesData, firmsData, queueData] = await Promise.all([
        api.getZones(),
        api.getFirmsHotspots('USA'),
        api.getReviewQueue(),
      ]);

      setZones(zonesData);
      if (zonesData.length > 0) {
        setSelectedZone(zonesData[0]);
      }
      setFirmsHotspots(firmsData);
      setPendingQueueCount(queueData.count);
    } catch (err) {
      console.error('Failed to load mission data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQueueUpdated = async () => {
    try {
      const queueData = await api.getReviewQueue();
      setPendingQueueCount(queueData.count);
      const zonesData = await api.getZones();
      setZones(zonesData);
      if (selectedZone) {
        const updated = zonesData.find((z) => z.id === selectedZone.id);
        if (updated) setSelectedZone(updated);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMapClickCoords = (coords: { lat: number; lon: number }) => {
    setClickedMapCoords(coords);
  };

  const handleOpenReport = () => {
    setActiveTab('report-incident');
  };

  if (isLoading) {
    return (
      <div className="w-screen h-screen bg-command-950 flex flex-col items-center justify-center space-y-4">
        <div className="relative flex items-center justify-center">
          <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          <div className="absolute w-8 h-8 border-4 border-cyan-400/20 border-b-cyan-400 rounded-full animate-spin" />
        </div>
        <div className="text-center font-mono space-y-1">
          <h2 className="text-sm font-bold text-slate-100 uppercase tracking-widest">
            AEGIS DISASTER INTELLIGENCE PLATFORM
          </h2>
          <p className="text-xs text-slate-500">
            Establishing Satellite, Sensor & Atmospheric Feeds...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-screen h-screen flex flex-col bg-command-950 text-slate-100 overflow-hidden select-none ${isMonochrome ? 'tactical-bw-theme' : ''}`}>
      {/* Top HUD Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pendingCount={pendingQueueCount}
        onOpenReportModal={handleOpenReport}
        isMonochrome={isMonochrome}
        onToggleMonochrome={() => setIsMonochrome(!isMonochrome)}
      />

      {/* Main Mission Content Area */}
      <main className="flex-1 relative overflow-y-auto">
        {activeTab === 'map' && selectedZone && (
          <MapView
            zones={zones}
            selectedZone={selectedZone}
            onSelectZone={(z) => setSelectedZone(z)}
            onMapClickCoords={handleMapClickCoords}
            firmsHotspots={firmsHotspots}
            onOpenReportModal={handleOpenReport}
          />
        )}

        {activeTab === 'review' && (
          <ReviewQueue onQueueUpdated={handleQueueUpdated} />
        )}

        {activeTab === 'report-incident' && (
          <IncidentEntryForm
            zones={zones}
            selectedCoords={clickedMapCoords}
            onSuccess={() => {
              handleQueueUpdated();
              setActiveTab('map');
            }}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsTab
            zones={zones}
            selectedZoneId={selectedZone?.id}
          />
        )}

        {activeTab === 'eval' && (
          <EvaluationTab />
        )}
      </main>
    </div>
  );
};

export default App;
