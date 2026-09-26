import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Download, 
  Sparkles, 
  Clock, 
  MapPin, 
  ShieldCheck, 
  AlertCircle,
  FileCheck
} from 'lucide-react';
import { api } from '../api';
import { Report, Zone } from '../types';

interface ReportsTabProps {
  zones: Zone[];
  selectedZoneId?: number;
}

export const ReportsTab: React.FC<ReportsTabProps> = ({ zones, selectedZoneId }) => {
  const [reports, setReports] = useState<Report[]>([]);
  const [targetZoneId, setTargetZoneId] = useState<number>(selectedZoneId || zones[0]?.id || 1);
  const [reportTitle, setReportTitle] = useState<string>('');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isLoadingList, setIsLoadingList] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    setIsLoadingList(true);
    try {
      const data = await api.getReports();
      setReports(data);
      if (data.length > 0 && !selectedReport) {
        setSelectedReport(data[0]);
      }
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setIsLoadingList(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!targetZoneId) return;
    setIsGenerating(true);
    setErrorMsg(null);

    try {
      const newReport = await api.generateReport(targetZoneId, reportTitle.trim() || undefined);
      setReports((prev) => [newReport, ...prev]);
      setSelectedReport(newReport);
      setReportTitle('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Report generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  const activeZone = zones.find((z) => z.id === targetZoneId);

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header Banner */}
      <div className="hud-panel p-6 rounded-xl border border-command-700">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-mono tracking-wide text-slate-100 uppercase">
                Situation Reports & Damage Assessments
              </h2>
              <p className="text-xs text-slate-400">
                Formal multi-modal intelligence reports with auditable confidence notes & data limitations (§6.5).
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono px-2.5 py-1 rounded bg-purple-500/10 text-purple-400 border border-purple-500/30 flex items-center space-x-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>GROQ LLAMA-3.3-70B DRAFTED</span>
            </span>
          </div>
        </div>

        {/* Generate Report Bar */}
        <div className="mt-6 pt-6 border-t border-command-800 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div className="sm:col-span-4">
            <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1">
              Select Disaster Sector
            </label>
            <select
              value={targetZoneId}
              onChange={(e) => setTargetZoneId(Number(e.target.value))}
              className="w-full bg-command-900 border border-command-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name} ({z.country} — {z.disaster_type})
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-5">
            <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1">
              Custom Report Title (Optional)
            </label>
            <input
              type="text"
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
              placeholder="e.g. 48h Flash Inundation Damage Summary..."
              className="w-full bg-command-900 border border-command-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="sm:col-span-3">
            <button
              onClick={handleGenerateReport}
              disabled={isGenerating}
              className="w-full flex items-center justify-center space-x-2 py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs font-mono transition-all shadow-glow-cyan disabled:opacity-50 cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Synthesizing Report...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Generate Report</span>
                </>
              )}
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Report Catalog */}
        <div className="lg:col-span-4 hud-panel p-4 rounded-xl border border-command-700 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-command-800">
            <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
              Generated Reports Archive
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              {reports.length} Reports
            </span>
          </div>

          <div className="space-y-2 max-h-[620px] overflow-y-auto">
            {reports.map((rep) => {
              const isSelected = selectedReport?.id === rep.id;
              const repZone = zones.find((z) => z.id === rep.zone_id);

              return (
                <div
                  key={rep.id}
                  onClick={() => setSelectedReport(rep)}
                  className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-blue-600/15 border-blue-500 shadow-glow-cyan'
                      : 'bg-command-900/60 border-command-800 hover:border-command-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
                    <span className="text-blue-400 font-bold">
                      {repZone?.country || 'Global'} • {repZone?.disaster_type}
                    </span>
                    <span>{new Date(rep.generated_at).toLocaleDateString()}</span>
                  </div>
                  <h4 className="text-xs font-semibold text-slate-100 line-clamp-1 mb-1">
                    {rep.title}
                  </h4>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                    <span>by {rep.generated_by}</span>
                    <span className="text-emerald-400 flex items-center space-x-0.5">
                      <FileCheck className="w-3 h-3" />
                      <span>Approved</span>
                    </span>
                  </div>
                </div>
              );
            })}

            {reports.length === 0 && (
              <div className="py-8 text-center text-xs text-slate-500 font-mono">
                No reports generated yet. Select a zone and click 'Generate Report'.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Active Report Viewer & PDF Export */}
        <div className="lg:col-span-8 hud-panel p-6 rounded-xl border border-command-700 space-y-4">
          {selectedReport ? (
            <div>
              {/* Report Header Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-command-800 gap-3">
                <div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-command-800 text-slate-400 uppercase">
                    Report ID #{selectedReport.id} • HITL Verified
                  </span>
                  <h3 className="text-lg font-bold text-slate-100 mt-1 font-mono">
                    {selectedReport.title}
                  </h3>
                  <div className="flex items-center space-x-3 text-xs text-slate-400 mt-1 font-mono">
                    <span className="flex items-center space-x-1">
                      <Clock className="w-3 h-3 text-blue-400" />
                      <span>{new Date(selectedReport.generated_at).toLocaleString()}</span>
                    </span>
                    <span>•</span>
                    <span>Engine: {selectedReport.generated_by}</span>
                  </div>
                </div>

                {/* PDF Download Button */}
                <a
                  href={`/api/reports/${selectedReport.id}/pdf`}
                  download
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-semibold shadow-glow-emerald transition-all self-start sm:self-center"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Formal PDF</span>
                </a>
              </div>

              {/* Rendered Markdown Body */}
              <div className="mt-6 prose prose-invert max-w-none text-xs sm:text-sm text-slate-300 leading-relaxed space-y-4 font-sans max-h-[580px] overflow-y-auto p-4 bg-command-950/50 rounded-lg border border-command-800">
                {selectedReport.content_md.split('\n').map((line, idx) => {
                  if (line.startsWith('## ')) {
                    return (
                      <h3 key={idx} className="text-base font-bold font-mono text-slate-100 border-b border-command-800 pb-1 pt-3 text-blue-400">
                        {line.replace('## ', '')}
                      </h3>
                    );
                  }
                  if (line.startsWith('### ')) {
                    return (
                      <h4 key={idx} className="text-sm font-semibold text-slate-200 pt-2">
                        {line.replace('### ', '')}
                      </h4>
                    );
                  }
                  if (line.startsWith('- ')) {
                    return (
                      <li key={idx} className="ml-4 list-disc text-slate-300">
                        {line.replace('- ', '')}
                      </li>
                    );
                  }
                  if (line.trim().length === 0) {
                    return <div key={idx} className="h-2" />;
                  }
                  return (
                    <p key={idx} className="text-slate-300">
                      {line}
                    </p>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="py-24 text-center space-y-2">
              <FileText className="w-12 h-12 text-slate-600 mx-auto" />
              <p className="text-sm text-slate-400">
                Select a report from the archive or generate a new assessment above.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
