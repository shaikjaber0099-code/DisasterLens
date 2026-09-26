import React, { useState, useEffect } from 'react';
import { 
  Check, 
  X, 
  HelpCircle, 
  AlertTriangle, 
  Clock, 
  Image as ImageIcon, 
  Activity, 
  CloudRain, 
  FileText, 
  ChevronDown, 
  ChevronUp, 
  ShieldCheck, 
  Sparkles,
  Edit3,
  RefreshCw,
  Bell,
  MapPin,
  ExternalLink,
  LifeBuoy
} from 'lucide-react';
import { api } from '../api';
import { QueueItem, Zone, ResidentReply } from '../types';
import { ConfidenceBadge } from './ConfidenceBadge';
import { AlertDispatchModal } from './AlertDispatchModal';

interface ReviewQueueProps {
  onQueueUpdated?: () => void;
}

export const ReviewQueue: React.FC<ReviewQueueProps> = ({ onQueueUpdated }) => {
  const [zones, setZones] = useState<Zone[]>([]);
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [pendingSummaries, setPendingSummaries] = useState<any[]>([]);
  const [zoneRepliesMap, setZoneRepliesMap] = useState<Record<number, ResidentReply[]>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // Interactive states
  const [expandedZoneId, setExpandedZoneId] = useState<number | null>(null);
  const [expandedEvidenceId, setExpandedEvidenceId] = useState<number | null>(null);
  const [actionInProgress, setActionInProgress] = useState<number | null>(null);
  
  // Summary editing
  const [editingSummaryId, setEditingSummaryId] = useState<number | null>(null);
  const [editedSummaryText, setEditedSummaryText] = useState<string>('');

  // Alert modal
  const [alertModalZone, setAlertModalZone] = useState<Zone | null>(null);

  useEffect(() => {
    loadAllOperationalData();
  }, []);

  const loadAllOperationalData = async () => {
    setIsLoading(true);
    try {
      const [queueData, zonesData] = await Promise.all([
        api.getReviewQueue(),
        api.getZones()
      ]);

      setQueueItems(queueData.items || []);
      setPendingSummaries(queueData.pending_summaries || []);
      setZones(zonesData || []);

      // If zones exist and none expanded, expand the first critical or active one
      if (zonesData.length > 0 && expandedZoneId === null) {
        const topZone = zonesData.find((z) => (z.current_severity || 0) >= 0.70) || zonesData[0];
        setExpandedZoneId(topZone.id);
      }

      // Fetch replies for each zone
      const repliesMap: Record<number, ResidentReply[]> = {};
      await Promise.all(
        zonesData.map(async (z) => {
          try {
            const reps = await api.getZoneReplies(z.id);
            if (reps && reps.length > 0) {
              repliesMap[z.id] = reps;
            }
          } catch (e) {
            // ignore
          }
        })
      );
      setZoneRepliesMap(repliesMap);
    } catch (err) {
      console.error('Failed to load operational mission data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEvidenceAction = async (id: number, action: 'approve' | 'reject' | 'request_more_data') => {
    setActionInProgress(id);
    try {
      await api.reviewEvidence(id, action);
      // Remove item from state
      setQueueItems((prev) => prev.filter((item) => item.id !== id));
      if (onQueueUpdated) onQueueUpdated();
    } catch (err) {
      console.error('Action failed:', err);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleSummaryAction = async (id: number, action: 'approve' | 'reject' | 'edit') => {
    try {
      await api.reviewSummary(id, action, action === 'edit' ? editedSummaryText : undefined);
      setPendingSummaries((prev) => prev.filter((s) => s.id !== id));
      setEditingSummaryId(null);
      if (onQueueUpdated) onQueueUpdated();
    } catch (err) {
      console.error('Summary review failed:', err);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'image':
        return <ImageIcon className="w-4 h-4 text-purple-400" />;
      case 'sensor':
        return <Activity className="w-4 h-4 text-emerald-400" />;
      case 'weather':
        return <CloudRain className="w-4 h-4 text-cyan-400" />;
      case 'report':
        return <FileText className="w-4 h-4 text-amber-400" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-blue-400" />;
    }
  };

  // Group queue items by zone
  const getZoneQueueItems = (zoneId: number) => {
    return queueItems.filter((item) => item.zone_id === zoneId);
  };

  // Stats calculation
  const totalPending = queueItems.length;
  const criticalZonesCount = zones.filter((z) => (z.current_severity || 0) >= 0.75).length;
  const totalIncidents = zones.reduce((acc, z) => acc + (z.incidents?.length || 1), 0);

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      
      {/* Primary Action Hero: Clean hierarchy, sentence case */}
      <div className="hud-panel p-6 rounded-2xl border border-command-700 shadow-xl bg-gradient-to-r from-command-900/90 to-command-950/80">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-semibold text-slate-100 font-sans tracking-tight">
                Emergency review & incident dispatch
              </h2>
              {criticalZonesCount > 0 && (
                <span className="px-2 py-0.5 rounded text-[11px] font-bold font-mono tracking-wider bg-red-600 text-white animate-pulse">
                  CRITICAL
                </span>
              )}
            </div>
            
            {/* The single obvious next step for dispatcher */}
            <p className="text-sm text-slate-300 font-sans">
              {totalPending > 0 ? (
                <>
                  You have <span className="font-bold text-amber-300 font-mono">{totalPending} pending items</span> requiring human validation. Click any crisis incident below to inspect evidence, approve actions, or dispatch two-way Twilio alerts.
                </>
              ) : (
                <>All incident evidence items have been validated. Desks are actively monitoring ground feeds.</>
              )}
            </p>
          </div>

          {/* Action-First Controls + Compact Telemetry Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <button
              onClick={loadAllOperationalData}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-command-800/80 hover:bg-command-700 border border-command-700 text-xs font-medium text-slate-300 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh data</span>
            </button>

            {/* Demoted, compact quiet telemetry stats */}
            <div className="flex items-center space-x-2 text-xs font-mono bg-command-950/80 px-3 py-1.5 rounded-lg border border-command-800">
              <span className="text-slate-400">
                Monitored zones: <strong className="text-slate-200">{zones.length}</strong>
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-400">
                Active alerts: <strong className="text-slate-200">{totalIncidents}</strong>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Pending Situation Summaries (Awaiting Operator Authorization) */}
      {pendingSummaries.length > 0 && (
        <div className="hud-panel p-5 rounded-2xl border border-command-700 space-y-3 bg-command-900/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-semibold text-slate-200 font-sans">
                Situation summaries awaiting operator authorization (Confidence ≤ 90%)
              </h3>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                &gt;90% Auto-Approved
              </span>
              <span className="text-xs font-mono text-slate-400">
                {pendingSummaries.length} manual review{pendingSummaries.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {pendingSummaries.map((summary) => (
              <div
                key={summary.id}
                className="p-4 rounded-xl bg-command-950/70 border border-command-800 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-semibold text-blue-400">
                      Sector: {summary.zone_name}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-command-800 text-slate-400">
                      Generated via {summary.generated_by}
                    </span>
                  </div>
                  <ConfidenceBadge confidence={summary.confidence} size="sm" />
                </div>

                {editingSummaryId === summary.id ? (
                  <div className="space-y-2">
                    <textarea
                      rows={5}
                      value={editedSummaryText}
                      onChange={(e) => setEditedSummaryText(e.target.value)}
                      className="w-full bg-command-900 border border-command-700 rounded-lg p-3 text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                    />
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => setEditingSummaryId(null)}
                        className="px-3 py-1 rounded bg-command-800 text-xs text-slate-300 hover:bg-command-700 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSummaryAction(summary.id, 'edit')}
                        className="px-3 py-1 rounded bg-blue-600 text-xs text-white hover:bg-blue-500 cursor-pointer font-medium"
                      >
                        Save and approve
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-300 leading-relaxed font-sans whitespace-pre-wrap bg-command-900/40 p-3 rounded-lg border border-command-800/80">
                    {summary.summary_text}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-command-800 text-xs">
                  <span className="text-[11px] text-slate-400 font-mono">
                    Drafted: {new Date(summary.created_at).toLocaleTimeString()}
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        setEditingSummaryId(summary.id);
                        setEditedSummaryText(summary.summary_text);
                      }}
                      className="flex items-center space-x-1 px-2.5 py-1 rounded bg-command-800 hover:bg-command-700 text-slate-300 text-xs transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => handleSummaryAction(summary.id, 'reject')}
                      className="flex items-center space-x-1 px-2.5 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs transition-colors cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                      <span>Reject</span>
                    </button>
                    <button
                      onClick={() => handleSummaryAction(summary.id, 'approve')}
                      className="flex items-center space-x-1 px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium shadow-sm transition-colors cursor-pointer"
                    >
                      <Check className="w-3 h-3" />
                      <span>Approve summary</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Merged Incident Stream: Operational Zones & Linked Triage Cases */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div>
            <h3 className="text-base font-semibold text-slate-100 font-sans">
              Active crisis incidents & operational sectors
            </h3>
            <p className="text-xs text-slate-400">
              Each sector expands inline to show linked evidence cases, multi-modal detections, and two-way citizen replies.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {zones.length} active sectors
          </span>
        </div>

        {zones.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm hud-panel rounded-2xl border border-command-800">
            No active operational sectors found.
          </div>
        ) : (
          <div className="space-y-3">
            {zones.map((zone) => {
              const zoneItems = getZoneQueueItems(zone.id);
              const isExpanded = expandedZoneId === zone.id;
              const severityPct = Math.round((zone.current_severity || 0) * 100);
              const isCritical = (zone.current_severity || 0) >= 0.75;
              const isElevated = (zone.current_severity || 0) >= 0.40 && !isCritical;
              const zoneReplies = zoneRepliesMap[zone.id] || [];

              return (
                <div
                  key={zone.id}
                  className={`rounded-2xl border transition-all overflow-hidden ${
                    isCritical
                      ? 'bg-command-900/90 border-red-500/40 shadow-lg shadow-red-950/20'
                      : isElevated
                      ? 'bg-command-900/80 border-amber-500/30'
                      : 'bg-command-900/70 border-command-700'
                  }`}
                >
                  {/* Zone Header Row (Click to Expand) */}
                  <div
                    onClick={() => setExpandedZoneId(isExpanded ? null : zone.id)}
                    className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-command-800/40 transition-colors select-none"
                  >
                    <div className="flex items-start sm:items-center space-x-3.5">
                      {/* Priority Status Pill */}
                      <span
                        className={`w-3 h-3 rounded-full mt-1 sm:mt-0 shrink-0 ${
                          isCritical
                            ? 'bg-red-500 shadow-glow-red'
                            : isElevated
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                      />

                      <div>
                        <div className="flex items-center flex-wrap gap-2">
                          <h4 className="text-base font-semibold text-slate-100 font-sans">
                            {zone.name}
                          </h4>
                          <span className="text-xs text-slate-400 font-normal">
                            ({zone.country} • {zone.region})
                          </span>
                          {isCritical && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider bg-red-600 text-white">
                              CRITICAL
                            </span>
                          )}
                          {zone.current_severity >= 0.90 && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30">
                              Threat rate: {severityPct}% (Auto-alert enabled)
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-3 text-xs text-slate-400 mt-1 font-mono">
                          <span>Category: <strong className="capitalize text-slate-300">{zone.disaster_type}</strong></span>
                          <span>•</span>
                          <span>Severity: <strong className={isCritical ? 'text-red-400' : isElevated ? 'text-amber-400' : 'text-emerald-400'}>{severityPct}%</strong></span>
                          <span>•</span>
                          <span>Confidence: <strong>{Math.round((zone.current_confidence || 0) * 100)}%</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Zone Quick Actions & Badges */}
                    <div className="flex items-center space-x-3 self-end md:self-center" onClick={(e) => e.stopPropagation()}>
                      {/* Live Citizen Replies Badge */}
                      {zoneReplies.length > 0 && (
                        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-command-950 border border-command-700 text-xs font-mono">
                          <LifeBuoy className="w-3.5 h-3.5 text-blue-400" />
                          <span>{zoneReplies.length} replies</span>
                          {zoneReplies.some((r) => r.status === 'HELP') && (
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                          )}
                        </div>
                      )}

                      {/* Pending queue badge */}
                      {zoneItems.length > 0 ? (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30">
                          {zoneItems.length} review{zoneItems.length > 1 ? 's' : ''} pending
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                          Clear
                        </span>
                      )}

                      {/* Twilio Alert Dispatch Trigger Button */}
                      <button
                        onClick={() => setAlertModalZone(zone)}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-red-600/90 to-amber-600/90 hover:from-red-500 hover:to-amber-500 text-white text-xs font-medium shadow-sm transition-all cursor-pointer font-sans"
                      >
                        <Bell className="w-3.5 h-3.5" />
                        <span>Alert residents</span>
                      </button>

                      {/* Expand/Collapse Chevron */}
                      <button
                        onClick={() => setExpandedZoneId(isExpanded ? null : zone.id)}
                        className="p-1 rounded-lg hover:bg-command-800 text-slate-400 transition-colors"
                      >
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Zone Detail & Nested Cases Accordion */}
                  {isExpanded && (
                    <div className="border-t border-command-800/80 bg-command-950/60 p-4 sm:p-6 space-y-4">
                      
                      {/* Sector Telemetry & Coordinates */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
                        <div className="p-3 rounded-xl bg-command-900/70 border border-command-800">
                          <span className="text-slate-400">Centroid coordinates</span>
                          <div className="text-slate-200 mt-0.5 font-medium">
                            {zone.lat.toFixed(4)}°, {zone.lon.toFixed(4)}° ({zone.radius_km} km radius)
                          </div>
                        </div>
                        <div className="p-3 rounded-xl bg-command-900/70 border border-command-800">
                          <span className="text-slate-400">Current status</span>
                          <div className="text-slate-200 mt-0.5 font-medium capitalize">
                            {zone.status} • Human verification verified
                          </div>
                        </div>
                        <div className="p-3 rounded-xl bg-command-900/70 border border-command-800 flex items-center justify-between">
                          <div>
                            <span className="text-slate-400">Two-way citizen alerts</span>
                            <div className="text-slate-200 mt-0.5 font-medium">
                              {zoneReplies.length} replies logged
                            </div>
                          </div>
                          <button
                            onClick={() => setAlertModalZone(zone)}
                            className="text-blue-400 hover:text-blue-300 underline text-xs"
                          >
                            Open log
                          </button>
                        </div>
                      </div>

                      {/* Nested Evidence / Review Cases */}
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between">
                          <h5 className="text-xs font-semibold text-slate-300 font-sans">
                            Flagged detections & evidence items in this sector ({zoneItems.length})
                          </h5>
                          {zoneItems.length === 0 && (
                            <span className="text-xs text-slate-500">
                              No unresolved items for this zone.
                            </span>
                          )}
                        </div>

                        {zoneItems.length === 0 ? (
                          <div className="p-6 text-center rounded-xl bg-command-900/40 border border-command-800/60 text-slate-400 text-xs">
                            All multi-modal vision detections, sensor readings, and incident reports for this sector are approved.
                          </div>
                        ) : (
                          zoneItems.map((item) => {
                            const isItemExpanded = expandedEvidenceId === item.id;
                            const isBusy = actionInProgress === item.id;

                            return (
                              <div
                                key={item.id}
                                className="p-4 rounded-xl bg-command-900/90 border border-command-800 space-y-3 hover:border-command-700 transition-colors"
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                  <div className="flex items-center space-x-2.5">
                                    {getTypeIcon(item.type)}
                                    <span className="text-xs font-medium text-slate-200 capitalize">
                                      {item.type} evidence
                                    </span>
                                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-command-800 text-slate-400">
                                      Model: {item.model_used}
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <ConfidenceBadge confidence={item.confidence} size="sm" />
                                    <span className="text-[11px] font-mono text-slate-400">
                                      Urgency: {item.urgency_score}
                                    </span>
                                  </div>
                                </div>

                                {/* Evidence Payload Summary */}
                                <div className="text-xs text-slate-300 font-sans leading-relaxed bg-command-950/70 p-3 rounded-lg border border-command-850">
                                  {item.payload?.rationale ||
                                    item.payload?.description ||
                                    (item.type === 'sensor' && `${item.payload?.sensor_type}: ${item.payload?.value} ${item.payload?.unit}`) ||
                                    JSON.stringify(item.payload)}
                                </div>

                                {/* Operator Action Bar */}
                                <div className="flex items-center justify-between pt-2 border-t border-command-800 text-xs">
                                  <span className="text-[10px] text-slate-500 font-mono">
                                    Reported: {new Date(item.created_at).toLocaleTimeString()}
                                  </span>

                                  <div className="flex items-center space-x-2">
                                    <button
                                      disabled={isBusy}
                                      onClick={() => handleEvidenceAction(item.id, 'request_more_data')}
                                      className="flex items-center space-x-1 px-2.5 py-1 rounded bg-command-800 hover:bg-command-700 text-slate-300 text-xs transition-colors cursor-pointer"
                                    >
                                      <HelpCircle className="w-3 h-3 text-amber-400" />
                                      <span>Request data</span>
                                    </button>

                                    <button
                                      disabled={isBusy}
                                      onClick={() => handleEvidenceAction(item.id, 'reject')}
                                      className="flex items-center space-x-1 px-2.5 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs transition-colors cursor-pointer"
                                    >
                                      <X className="w-3 h-3" />
                                      <span>Reject</span>
                                    </button>

                                    <button
                                      disabled={isBusy}
                                      onClick={() => handleEvidenceAction(item.id, 'approve')}
                                      className="flex items-center space-x-1 px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium shadow-sm transition-colors cursor-pointer"
                                    >
                                      <Check className="w-3 h-3" />
                                      <span>Approve detection</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Alert Dispatch Modal with Two-Way WhatsApp/SMS and Replies */}
      <AlertDispatchModal
        isOpen={alertModalZone !== null}
        onClose={() => {
          setAlertModalZone(null);
          loadAllOperationalData();
        }}
        zone={alertModalZone}
      />
    </div>
  );
};
