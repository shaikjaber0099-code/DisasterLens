import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Clock, Calendar } from 'lucide-react';

interface TimelineScrubberProps {
  onTimeChange?: (timeStep: number) => void;
}

const TIMELINE_STEPS = [
  { label: 'T-48h', desc: 'Pre-Disaster Baseline', offsetHours: 48 },
  { label: 'T-24h', desc: 'Initial Inundation / Ignition', offsetHours: 24 },
  { label: 'T-12h', desc: 'Adverse Weather Acceleration', offsetHours: 12 },
  { label: 'T-6h', desc: 'Emergency Perimeter Evacuations', offsetHours: 6 },
  { label: 'T-2h', desc: 'Recent Aerial & Ground Sensor Sync', offsetHours: 2 },
  { label: 'LIVE', desc: 'Real-Time Operational Picture', offsetHours: 0 },
];

export const TimelineScrubber: React.FC<TimelineScrubberProps> = ({ onTimeChange }) => {
  const [currentStep, setCurrentStep] = useState<number>(TIMELINE_STEPS.length - 1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentStep((prev) => {
          const next = prev + 1 >= TIMELINE_STEPS.length ? 0 : prev + 1;
          if (onTimeChange) onTimeChange(next);
          return next;
        });
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [isPlaying, onTimeChange]);

  const handleSelectStep = (index: number) => {
    setCurrentStep(index);
    if (onTimeChange) onTimeChange(index);
  };

  const activeStepObj = TIMELINE_STEPS[currentStep];

  return (
    <div className="hud-panel p-3 rounded-xl border border-command-700 shadow-2xl backdrop-blur-md max-w-2xl mx-auto w-full">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <Clock className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-[11px] font-mono font-bold text-slate-200 uppercase tracking-wider">
            Temporal Playback & Scrubber (§10)
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
            {activeStepObj.label}
          </span>
        </div>

        <div className="text-[11px] text-slate-400 font-sans hidden sm:block">
          {activeStepObj.desc}
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-1 rounded bg-command-800 hover:bg-command-700 text-slate-200 transition-colors"
            title={isPlaying ? 'Pause playback' : 'Play sequence'}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 text-amber-400" /> : <Play className="w-3.5 h-3.5 text-emerald-400" />}
          </button>
          <button
            onClick={() => handleSelectStep(TIMELINE_STEPS.length - 1)}
            className="p-1 rounded bg-command-800 hover:bg-command-700 text-slate-200 transition-colors"
            title="Reset to Live"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Stepper Scrubber Track */}
      <div className="relative flex items-center justify-between pt-2">
        <div className="absolute left-0 right-0 h-1 bg-command-800 rounded-full z-0" />
        <div 
          className="absolute left-0 h-1 bg-blue-500 rounded-full z-0 transition-all duration-300"
          style={{ width: `${(currentStep / (TIMELINE_STEPS.length - 1)) * 100}%` }}
        />

        {TIMELINE_STEPS.map((step, idx) => {
          const isActive = idx === currentStep;
          const isPassed = idx <= currentStep;
          return (
            <button
              key={step.label}
              onClick={() => handleSelectStep(idx)}
              className="relative z-10 flex flex-col items-center group cursor-pointer focus:outline-none"
            >
              <div
                className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${
                  isActive
                    ? 'bg-blue-400 border-white shadow-glow-cyan scale-125'
                    : isPassed
                    ? 'bg-blue-600 border-command-900'
                    : 'bg-command-800 border-command-700 group-hover:border-slate-500'
                }`}
              />
              <span
                className={`text-[10px] font-mono mt-1 transition-colors ${
                  isActive ? 'text-blue-400 font-bold' : 'text-slate-500 group-hover:text-slate-300'
                }`}
              >
                {step.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
