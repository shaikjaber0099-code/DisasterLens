import React from 'react';
import { 
  Globe2, 
  Layers, 
  ClipboardCheck, 
  FileText, 
  BarChart3, 
  PlusCircle, 
  Activity, 
  Cpu, 
  Satellite,
  ShieldAlert
} from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  pendingCount: number;
  onOpenReportModal?: () => void;
  isMonochrome?: boolean;
  onToggleMonochrome?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  pendingCount,
  onOpenReportModal,
  isMonochrome = false,
  onToggleMonochrome
}) => {
  return (
    <header className="h-16 bg-command-950/95 border-b border-command-800 backdrop-blur-xl flex items-center justify-between px-4 lg:px-6 select-none z-50 sticky top-0">
      {/* Brand & Mission Status */}
      <div className="flex items-center space-x-3">
        <div className="relative flex items-center justify-center w-10 h-10 rounded-lg bg-blue-600/10 border border-blue-500/30 text-blue-400 shadow-glow-cyan">
          <Globe2 className="w-5 h-5 animate-pulse" />
          <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="font-mono text-sm sm:text-base font-bold tracking-wider text-slate-100 uppercase">
              AEGIS <span className="text-blue-400 font-sans font-medium text-xs">// DISASTER INTELLIGENCE</span>
            </h1>
            <span className="hidden md:inline-flex items-center text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
              HITL GATE ENFORCED
            </span>
          </div>
          <p className="text-[11px] text-slate-400 hidden sm:block">
            Multimodal Satellite, Weather, Sensor & Citizen Fusion System
          </p>
        </div>
      </div>

      {/* Center Navigation Tabs */}
      <nav className="flex items-center space-x-1 bg-command-900/80 p-1 rounded-lg border border-command-800">
        <button
          onClick={() => setActiveTab('map')}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            activeTab === 'map'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-command-800/50'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Live Map</span>
        </button>

        <button
          onClick={() => setActiveTab('review')}
          className={`relative flex items-center space-x-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            activeTab === 'review'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-command-800/50'
          }`}
        >
          <ClipboardCheck className="w-3.5 h-3.5" />
          <span>Review Queue</span>
          {pendingCount > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-red-500 text-white font-bold animate-pulse">
              {pendingCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('report-incident')}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            activeTab === 'report-incident'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-command-800/50'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
          <span>Report Incident</span>
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            activeTab === 'reports'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-command-800/50'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Reports</span>
        </button>

        <button
          onClick={() => setActiveTab('eval')}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            activeTab === 'eval'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-command-800/50'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">AI Evaluation</span>
        </button>
      </nav>

      {/* Right Controls & Quick Actions */}
      <div className="flex items-center space-x-3">
        {/* Status Indicators */}
        <div className="hidden xl:flex items-center space-x-2 text-[11px] text-slate-400 font-mono">
          <span className="inline-flex items-center space-x-1 px-2 py-1 rounded bg-command-900 border border-command-800">
            <Satellite className="w-3 h-3 text-cyan-400" />
            <span>FIRMS/SENTINEL</span>
          </span>
          <span className="inline-flex items-center space-x-1 px-2 py-1 rounded bg-command-900 border border-command-800">
            <Activity className="w-3 h-3 text-emerald-400" />
            <span>OPEN-METEO LIVE</span>
          </span>
          <span className="inline-flex items-center space-x-1 px-2 py-1 rounded bg-command-900 border border-command-800">
            <Cpu className="w-3 h-3 text-purple-400" />
            <span>GROQ 70B/8B</span>
          </span>
        </div>

        {/* Black & White Tactical Theme Toggle */}
        {onToggleMonochrome && (
          <button
            onClick={onToggleMonochrome}
            title="Toggle Tactical Black & White Monochrome Mode"
            className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md border text-xs font-mono transition-all cursor-pointer ${
              isMonochrome
                ? 'bg-slate-100 text-slate-900 border-slate-100 font-bold shadow-sm'
                : 'bg-command-900/90 hover:bg-command-800 text-slate-300 border-command-700'
            }`}
          >
            <span>{isMonochrome ? '🌓 B&W Tactical' : '🎨 Tactical Color'}</span>
          </button>
        )}

        {/* Quick Report Button */}
        <button
          onClick={() => onOpenReportModal ? onOpenReportModal() : setActiveTab('report-incident')}
          className="flex items-center space-x-1.5 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white px-3 py-1.5 rounded-md text-xs font-medium font-sans shadow-glow-red transition-all cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          <span className="font-semibold">+ Add Report</span>
        </button>
      </div>
    </header>
  );
};
