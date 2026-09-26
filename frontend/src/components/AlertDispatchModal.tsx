import React, { useState, useEffect } from 'react';
import { 
  Send, 
  X, 
  MessageSquare, 
  Phone, 
  Radio, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  LifeBuoy, 
  Users, 
  ShieldCheck,
  RefreshCw,
  Lock,
  Sparkles,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Zone, Resident, ResidentReply } from '../types';
import { api } from '../api';

interface AlertDispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  zone: Zone | null;
}

export const AlertDispatchModal: React.FC<AlertDispatchModalProps> = ({
  isOpen,
  onClose,
  zone
}) => {
  const [channel, setChannel] = useState<'whatsapp' | 'sms'>('whatsapp');
  const [recipientPhone, setRecipientPhone] = useState<string>('');
  const [framingText, setFramingText] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [sendResult, setSendResult] = useState<any | null>(null);

  // Residents & replies & dispatches
  const [residents, setResidents] = useState<Resident[]>([]);
  const [replies, setReplies] = useState<ResidentReply[]>([]);
  const [dispatches, setDispatches] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'compose' | 'replies' | 'residents'>('compose');

  // Interactive webhook simulation state for live demo
  const [simText, setSimText] = useState<string>('SAFE');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simFeedback, setSimFeedback] = useState<string | null>(null);

  const severityPct = zone ? Math.round(zone.current_severity * 100) : 0;
  const confidencePct = zone ? Math.round(zone.current_confidence * 100) : 0;

  useEffect(() => {
    if (isOpen && zone) {
      // Pre-fill free-text framing (operator can edit framing, but metrics remain locked)
      const defaultFraming = `Severe ${zone.disaster_type} threat detected across ${zone.name}. Multi-modal sensors indicate immediate hazard escalation. Evacuate low-lying corridors.`;
      setFramingText(defaultFraming);
      setSendResult(null);
      setSimFeedback(null);
      loadZoneData(zone.id);
    }
  }, [isOpen, zone?.id]);

  const loadZoneData = async (zoneId: number) => {
    setIsLoadingData(true);
    try {
      const [resData, repData, dispData] = await Promise.all([
        api.getZoneResidents(zoneId).catch(() => ({ count: 0, residents: [] })),
        api.getZoneReplies(zoneId).catch(() => []),
        api.getAlertDispatches(zoneId).catch(() => [])
      ]);
      setResidents(resData.residents || []);
      setReplies(repData || []);
      setDispatches(dispData || []);
      if (resData.residents && resData.residents.length > 0 && !recipientPhone) {
        setRecipientPhone(resData.residents[0].phone_number);
      }
    } catch (e) {
      console.error('Error loading resident/reply data:', e);
    } finally {
      setIsLoadingData(false);
    }
  };

  if (!isOpen || !zone) return null;

  const handleSendAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientPhone.trim()) return;

    setIsSending(true);
    setSendResult(null);

    // Build rationale with locked metrics + operator free-text framing
    const fullRationale = `[Severity: ${severityPct}% | Confidence: ${confidencePct}%] ${framingText.trim()}`;

    try {
      const result = await api.dispatchAlert({
        recipient_number: recipientPhone.trim(),
        channel: channel,
        zone_id: zone.id,
        rationale: fullRationale
      });
      setSendResult(result);
      // Reload replies & dispatches after send
      loadZoneData(zone.id);
    } catch (err: any) {
      setSendResult({
        success: false,
        error: err.message || 'Dispatch failed'
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleSimulateReply = async (replyBody: string) => {
    if (!recipientPhone.trim()) return;
    setIsSimulating(true);
    setSimFeedback(null);
    try {
      const res = await api.simulateCitizenReply({
        From: recipientPhone.trim(),
        Body: replyBody
      });
      setSimFeedback(`Reply '${replyBody}' registered! Matched Dispatch ID: ${res.matched_dispatch_id ?? 'Latest'}`);
      await loadZoneData(zone.id);
      setActiveTab('replies');
    } catch (err: any) {
      setSimFeedback(`Simulation failed: ${err.message}`);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
      <div className="bg-command-900 border border-command-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-command-800 flex items-center justify-between bg-command-950/60">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-red-500/20 to-amber-500/10 border border-red-500/30 text-red-400">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-semibold text-slate-100">
                  Emergency Alert Dispatch Desk
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Twilio 2-Way Multi-Channel
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Target Sector: <span className="text-slate-200 font-medium">{zone.name}</span> ({zone.country})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-command-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-command-800 bg-command-950/40 px-6 pt-2">
          <button
            onClick={() => setActiveTab('compose')}
            className={`pb-2.5 px-3 text-xs font-medium border-b-2 transition-colors flex items-center space-x-1.5 ${
              activeTab === 'compose'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Dispatch Alert</span>
          </button>
          <button
            onClick={() => setActiveTab('replies')}
            className={`pb-2.5 px-3 text-xs font-medium border-b-2 transition-colors flex items-center space-x-1.5 ${
              activeTab === 'replies'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <LifeBuoy className="w-3.5 h-3.5" />
            <span>Citizen Replies ({replies.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('residents')}
            className={`pb-2.5 px-3 text-xs font-medium border-b-2 transition-colors flex items-center space-x-1.5 ${
              activeTab === 'residents'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Sector Residents ({residents.length})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'compose' && (
            <form onSubmit={handleSendAlert} className="space-y-4">
              {/* 1. Channel Selector */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Delivery Channel Toggle
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setChannel('whatsapp')}
                    className={`p-3 rounded-xl border text-left flex items-start space-x-2.5 transition-all ${
                      channel === 'whatsapp'
                        ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300 shadow-sm'
                        : 'border-command-700 bg-command-950/60 text-slate-400 hover:border-command-600'
                    }`}
                  >
                    <Radio className="w-4 h-4 mt-0.5" />
                    <div>
                      <div className="text-xs font-semibold">WhatsApp (Primary)</div>
                      <div className="text-[11px] opacity-75">Auto-fallbacks to plain SMS if failed</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setChannel('sms')}
                    className={`p-3 rounded-xl border text-left flex items-start space-x-2.5 transition-all ${
                      channel === 'sms'
                        ? 'border-blue-500/50 bg-blue-500/10 text-blue-300 shadow-sm'
                        : 'border-command-700 bg-command-950/60 text-slate-400 hover:border-command-600'
                    }`}
                  >
                    <Radio className="w-4 h-4 mt-0.5" />
                    <div>
                      <div className="text-xs font-semibold">Direct Cellular SMS</div>
                      <div className="text-[11px] opacity-75">Standard SMS carrier network</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* 2. Recipient Phone & Quick Select */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-300">
                    Recipient Phone Number (with Country Code)
                  </label>
                  {residents.length > 0 && (
                    <span className="text-[11px] text-slate-400">
                      Quick select from {residents.length} sector residents
                    </span>
                  )}
                </div>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    required
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    placeholder="+91xxxxxxxxxx or +34xxxxxxxxxx"
                    className="flex-1 bg-command-950 border border-command-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                  />
                  {residents.length > 0 && (
                    <select
                      onChange={(e) => {
                        if (e.target.value) setRecipientPhone(e.target.value);
                      }}
                      className="bg-command-950 border border-command-700 rounded-lg px-2 py-2 text-xs text-slate-300 font-mono"
                      defaultValue=""
                    >
                      <option value="" disabled>Select Resident...</option>
                      {residents.map((r) => (
                        <option key={r.id} value={r.phone_number}>
                          {r.name} ({r.phone_number})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* 3. Evidence Rationale (Fused Numbers Locked + Free-Text Framing) */}
              <div className="space-y-2">
                {/* Locked Telemetry Numbers */}
                <div className="rounded-xl border border-command-700 bg-command-950/70 p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-300 flex items-center space-x-1.5">
                      <Lock className="w-3.5 h-3.5 text-amber-400" />
                      <span>Evidence Rationale Metrics (Auto-Fused & Locked)</span>
                    </span>
                    <span className="text-[10px] text-amber-400/90 font-mono bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      Read-Only Numbers
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="px-3 py-2 rounded-lg bg-command-900 border border-command-700/60 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">Fused Severity:</span>
                      <span className="font-mono font-bold text-xs text-red-400">
                        {severityPct}%
                      </span>
                    </div>
                    <div className="px-3 py-2 rounded-lg bg-command-900 border border-command-700/60 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">Multi-Modal Confidence:</span>
                      <span className="font-mono font-bold text-xs text-blue-400">
                        {confidencePct}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Editable Free-Text Framing */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-slate-300">
                      Advisory Framing & Context (Free-Text Editable)
                    </label>
                    <span className="text-[10px] text-slate-500">Operator notes only</span>
                  </div>
                  <textarea
                    rows={3}
                    value={framingText}
                    onChange={(e) => setFramingText(e.target.value)}
                    placeholder="Enter incident framing, evacuation routes, and situational instructions..."
                    className="w-full bg-command-950 border border-command-700 rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Two-way reply instruction footer is automatically attached: <span className="text-slate-400">"Reply SAFE if you are secure, or reply HELP for local rescue routing."</span>
                  </p>
                </div>
              </div>

              {/* Outgoing Message Live Preview */}
              <div className="p-3 rounded-xl bg-command-950/80 border border-command-800 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                  <span>Outgoing Cellular Payload Preview</span>
                  <span className="text-emerald-400 font-mono">{channel.toUpperCase()}</span>
                </div>
                <div className="font-mono text-xs text-slate-300 bg-command-900/90 p-2.5 rounded-lg border border-command-700/50 whitespace-pre-wrap">
{`[Severity: ${severityPct}% | Confidence: ${confidencePct}%] ${framingText.trim()}

Reply SAFE if you are secure, or reply HELP for local rescue routing.`}
                </div>
              </div>

              {/* Submit Dispatch Button */}
              <div className="pt-1">
                <button
                  type="submit"
                  disabled={isSending}
                  className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-medium py-2.5 px-4 rounded-xl text-xs shadow-lg transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Send className={`w-4 h-4 ${isSending ? 'animate-spin' : ''}`} />
                  <span>{isSending ? 'Dispatching Multi-Channel Alert...' : 'Dispatch Emergency Alert Now'}</span>
                </button>
              </div>

              {/* Send Result Feedback */}
              {sendResult && (
                <div className={`p-4 rounded-xl border text-xs space-y-1.5 ${
                  sendResult.success 
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                    : 'bg-red-500/10 border-red-500/30 text-red-300'
                }`}>
                  <div className="flex items-center space-x-2 font-semibold">
                    {sendResult.success ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                    <span>{sendResult.success ? 'Alert Dispatched Successfully' : 'Dispatch Failed'}</span>
                  </div>
                  {sendResult.channel && (
                    <div className="font-mono text-[11px]">
                      Channel: <span className="font-bold">{sendResult.channel}</span> | SID: {sendResult.sid || 'N/A'}
                    </div>
                  )}
                  {sendResult.note && (
                    <div className="text-[11px] opacity-80">{sendResult.note}</div>
                  )}
                  {sendResult.error && (
                    <div className="text-[11px] font-mono">{sendResult.error}</div>
                  )}
                </div>
              )}
            </form>
          )}

          {activeTab === 'replies' && (
            <div className="space-y-4">
              {/* Header with Refresh */}
              <div className="flex items-center justify-between text-xs text-slate-400 pb-1 border-b border-command-800">
                <span className="font-medium">Inbound Citizen Replies (Twilio 2-Way Webhook Feed)</span>
                <button
                  onClick={() => loadZoneData(zone.id)}
                  className="flex items-center space-x-1 hover:text-slate-200 transition-colors bg-command-800/50 px-2 py-1 rounded"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingData ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              {/* Quick Interactive Two-Way Simulation Box for Demo */}
              <div className="p-3.5 rounded-xl bg-command-950/70 border border-command-700/60 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-slate-200 flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Live Two-Way Webhook Simulator (Test Twilio Inbound)</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">POST /api/alerts/webhook</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Simulates a citizen text message reply from <span className="font-mono text-slate-200">{recipientPhone || '+91xxxxxxxxxx'}</span> to trigger local rescue routing.
                </p>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    disabled={isSimulating}
                    onClick={() => handleSimulateReply('SAFE')}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-medium transition-colors flex items-center justify-center space-x-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Simulate "SAFE"</span>
                  </button>
                  <button
                    type="button"
                    disabled={isSimulating}
                    onClick={() => handleSimulateReply('HELP')}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 text-xs font-medium transition-colors flex items-center justify-center space-x-1"
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Simulate "HELP"</span>
                  </button>
                </div>
                {simFeedback && (
                  <div className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 p-2 rounded border border-emerald-500/20">
                    {simFeedback}
                  </div>
                )}
              </div>

              {/* Replies Feed */}
              {replies.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs space-y-1">
                  <div>No replies registered yet for this sector.</div>
                  <div className="text-[11px] text-slate-600">Once inbound messages arrive via Twilio webhook, they appear here instantly.</div>
                </div>
              ) : (
                replies.map((rep) => (
                  <div
                    key={rep.id}
                    className={`p-3.5 rounded-xl border space-y-2 ${
                      rep.status === 'HELP'
                        ? 'bg-red-500/10 border-red-500/40 text-red-200'
                        : rep.status === 'SAFE'
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200'
                        : 'bg-command-950/80 border-command-700 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase ${
                          rep.status === 'HELP'
                            ? 'bg-red-600 text-white animate-pulse'
                            : rep.status === 'SAFE'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-command-800 text-slate-400'
                        }`}>
                          {rep.status}
                        </span>
                        <span className="font-mono text-xs">{rep.phone_number}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(rep.timestamp).toLocaleTimeString()}</span>
                      </span>
                    </div>

                    <div className="text-xs font-sans pl-1 border-l-2 border-slate-700/50">
                      "{rep.reply_text}"
                    </div>

                    {rep.status === 'HELP' && (
                      <div className="p-2.5 rounded-lg bg-red-950/60 border border-red-500/30 text-[11px] text-red-300 space-y-1">
                        <div className="font-semibold flex items-center space-x-1">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Local Emergency Rescue Guidance Active</span>
                        </div>
                        <p>
                          Citizen distress reply matched to open dispatch. First responder extraction coordinates flagged for {zone.country}.
                        </p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'residents' && (
            <div className="space-y-3">
              <div className="text-xs text-slate-400 pb-1 border-b border-command-800 flex items-center justify-between">
                <span>Residents identified inside sector polygon/radius</span>
                <span className="font-mono">{residents.length} Matched</span>
              </div>

              {residents.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  No mock residents found within this sector's boundary.
                </div>
              ) : (
                residents.map((r) => (
                  <div
                    key={r.id}
                    className="p-3 rounded-xl bg-command-950/70 border border-command-800 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-medium text-slate-200">{r.name}</div>
                      <div className="text-[11px] font-mono text-slate-400">{r.phone_number}</div>
                      {r.notes && <div className="text-[10px] text-slate-500">{r.notes}</div>}
                    </div>
                    <button
                      onClick={() => {
                        setRecipientPhone(r.phone_number);
                        setActiveTab('compose');
                      }}
                      className="px-2.5 py-1 rounded bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-500/30 text-xs font-medium transition-colors"
                    >
                      Target Contact
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
