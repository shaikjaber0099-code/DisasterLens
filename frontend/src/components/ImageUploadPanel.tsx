import React, { useState } from 'react';
import { 
  Camera, 
  UploadCloud, 
  Sparkles, 
  CheckCircle, 
  AlertCircle, 
  Layers, 
  Eye, 
  Cpu
} from 'lucide-react';
import { api } from '../api';
import { ConfidenceBadge } from './ConfidenceBadge';
import { Zone } from '../types';

interface ImageUploadPanelProps {
  zones: Zone[];
  selectedZoneId?: number;
  onAnalysisComplete?: (result: any) => void;
  compact?: boolean;
}

export const ImageUploadPanel: React.FC<ImageUploadPanelProps> = ({
  zones,
  selectedZoneId,
  onAnalysisComplete,
  compact = false
}) => {
  const [targetZoneId, setTargetZoneId] = useState<number | undefined>(selectedZoneId || zones[0]?.id);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    setSelectedFile(file);
    setAnalysisResult(null);
    setErrorMsg(null);
    const reader = new FileReader();
    reader.onload = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const runAnalysis = async () => {
    if (!selectedFile) return;
    setIsAnalyzing(true);
    setErrorMsg(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      if (targetZoneId) {
        formData.append('zone_id', targetZoneId.toString());
      }

      const result = await api.analyzeImage(formData);
      setAnalysisResult(result);
      if (onAnalysisComplete) onAnalysisComplete(result);
    } catch (err: any) {
      setErrorMsg(err.message || 'Vision analysis failed. Please check network/key.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className={`hud-panel rounded-xl border border-command-700 ${compact ? 'p-4' : 'p-6'}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-400">
            <Camera className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-mono text-xs sm:text-sm font-bold text-slate-100 uppercase tracking-wider">
              Multimodal Vision Ingestion
            </h3>
            <p className="text-[11px] text-slate-400">
              OpenAI gpt-4o & Spectral CV Pipeline (§6.2)
            </p>
          </div>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center space-x-1">
          <Cpu className="w-3 h-3" />
          <span>VISION AGENT</span>
        </span>
      </div>

      {/* Target Zone Selection */}
      <div className="mb-4">
        <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1">
          Associate With Disaster Zone
        </label>
        <select
          value={targetZoneId || ''}
          onChange={(e) => setTargetZoneId(Number(e.target.value))}
          className="w-full bg-command-900 border border-command-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
        >
          {zones.map((z) => (
            <option key={z.id} value={z.id}>
              {z.name} ({z.country} — {z.disaster_type})
            </option>
          ))}
        </select>
      </div>

      {/* Drop / Pick Area */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleFileDrop}
        className="border-2 border-dashed border-command-800 hover:border-command-700 rounded-xl p-4 text-center bg-command-900/40 transition-all mb-4"
      >
        {previewUrl ? (
          <div className="relative">
            <img
              src={previewUrl}
              alt="Disaster preview"
              className="w-full max-h-56 object-cover rounded-lg border border-command-700 shadow-md"
            />
            {isAnalyzing && (
              <div className="absolute inset-0 bg-command-950/70 backdrop-blur-sm rounded-lg flex flex-col items-center justify-center space-y-2">
                <div className="w-8 h-8 border-3 border-purple-500/30 border-t-purple-400 rounded-full animate-spin" />
                <span className="text-xs font-mono text-purple-300 font-semibold animate-pulse">
                  Analyzing pixels with gpt-4o vision...
                </span>
              </div>
            )}
            <button
              onClick={() => {
                setSelectedFile(null);
                setPreviewUrl(null);
                setAnalysisResult(null);
              }}
              className="absolute top-2 right-2 bg-command-950/80 hover:bg-red-600 text-white rounded-full p-1 text-xs border border-command-700 transition-colors"
            >
              ✕
            </button>
          </div>
        ) : (
          <label className="cursor-pointer block py-6">
            <UploadCloud className="w-10 h-10 text-purple-400/80 mx-auto mb-2 animate-bounce" />
            <span className="text-xs font-medium text-purple-300 hover:underline">
              Upload Drone, Satellite, or Field Photo
            </span>
            <p className="text-[10px] text-slate-500 mt-1 font-mono">
              Detects flood inundation, smoke plumes, flame fronts, and structural collapse
            </p>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>
        )}
      </div>

      {/* Action Button */}
      {selectedFile && !analysisResult && (
        <button
          onClick={runAnalysis}
          disabled={isAnalyzing}
          className="w-full py-2 px-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium font-mono flex items-center justify-center space-x-2 transition-all shadow-md cursor-pointer disabled:opacity-50"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{isAnalyzing ? 'Extracting Visual Features...' : 'Run Vision AI Analysis'}</span>
        </button>
      )}

      {errorMsg && (
        <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Analysis Result Card */}
      {analysisResult && (
        <div className="mt-4 p-4 rounded-lg bg-command-900 border border-command-700 space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-command-800 pb-2">
            <div className="flex items-center space-x-2">
              <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold uppercase ${
                analysisResult.condition === 'flooded' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                analysisResult.condition === 'smoke' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                analysisResult.condition === 'damaged_infrastructure' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              }`}>
                {analysisResult.condition.replace('_', ' ')}
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                via {analysisResult.model_used}
              </span>
            </div>
            <ConfidenceBadge confidence={analysisResult.confidence_0_to_1} size="sm" />
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 rounded bg-command-950/60 border border-command-800">
              <span className="text-[10px] text-slate-400 uppercase font-mono block">Severity Score</span>
              <span className="text-sm font-bold text-slate-100 font-mono">
                {(analysisResult.severity_0_to_1 * 100).toFixed(0)}%
              </span>
            </div>
            <div className="p-2 rounded bg-command-950/60 border border-command-800">
              <span className="text-[10px] text-slate-400 uppercase font-mono block">Review Status</span>
              <span className="text-xs font-bold text-amber-400 font-mono">
                Pending Operator Review
              </span>
            </div>
          </div>

          <div>
            <span className="text-[10px] text-slate-400 uppercase font-mono block mb-1">
              Visual Rationale & Spectral Detection:
            </span>
            <p className="text-xs text-slate-300 leading-relaxed font-sans bg-command-950/40 p-2.5 rounded border border-command-800">
              {analysisResult.rationale}
            </p>
          </div>

          {analysisResult.detected_features && analysisResult.detected_features.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {analysisResult.detected_features.map((feat: string, idx: number) => (
                <span key={idx} className="text-[10px] px-2 py-0.5 rounded bg-command-800 text-slate-300 border border-command-700">
                  {feat}
                </span>
              ))}
            </div>
          )}

          <div className="text-[10px] font-mono text-slate-500 pt-2 border-t border-command-800 flex items-center justify-between">
            <span>Linked to Evidence ID: #{analysisResult.evidence_id || 'N/A'}</span>
            <span className="text-emerald-400">Queued for Human-in-the-Loop</span>
          </div>
        </div>
      )}
    </div>
  );
};
