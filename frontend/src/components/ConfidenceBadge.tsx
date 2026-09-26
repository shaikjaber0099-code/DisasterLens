import React from 'react';
import { ShieldCheck, AlertTriangle, AlertOctagon } from 'lucide-react';

interface ConfidenceBadgeProps {
  confidence: number; // 0.0 to 1.0
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({
  confidence,
  showLabel = true,
  size = 'md'
}) => {
  const percentage = Math.round(confidence * 100);

  // Categorize based on PRD §6.4:
  // green >= 0.75, amber 0.4 - 0.75, red < 0.4
  let colorClasses = '';
  let borderClasses = '';
  let Icon = ShieldCheck;
  let statusText = 'HIGH CONFIDENCE';

  if (confidence >= 0.75) {
    colorClasses = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    borderClasses = 'shadow-glow-emerald';
    Icon = ShieldCheck;
    statusText = 'HIGH CONFIDENCE';
  } else if (confidence >= 0.40) {
    colorClasses = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    borderClasses = 'shadow-glow-amber';
    Icon = AlertTriangle;
    statusText = 'MODERATE UNCERTAINTY';
  } else {
    colorClasses = 'bg-red-500/10 text-red-400 border-red-500/30 animate-pulse';
    borderClasses = 'shadow-glow-red';
    Icon = AlertOctagon;
    statusText = 'NEEDS HUMAN REVIEW';
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 space-x-1',
    md: 'text-xs px-2.5 py-1 space-x-1.5',
    lg: 'text-sm px-3.5 py-1.5 space-x-2'
  }[size];

  return (
    <div
      className={`inline-flex items-center font-mono font-medium rounded-full border backdrop-blur-md transition-all ${colorClasses} ${borderClasses} ${sizeClasses}`}
      title={`Confidence score: ${(confidence * 100).toFixed(1)}%`}
    >
      <Icon className={size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
      <span>{percentage}%</span>
      {showLabel && (
        <span className="text-[10px] opacity-80 uppercase tracking-wider font-sans font-semibold border-l border-current/20 pl-1.5 ml-0.5">
          {statusText}
        </span>
      )}
    </div>
  );
};
