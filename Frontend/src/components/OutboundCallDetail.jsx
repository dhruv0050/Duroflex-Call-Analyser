import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronUp, Play, FileDown, Home, Package, Users, Calendar, Percent } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://duroflex-call-analyser.onrender.com';

const OutboundCallDetail = () => {
  const { callId } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandTranscript, setExpandTranscript] = useState(false);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        setLoading(true);
        setError('');
        const res = await fetch(`${API_BASE}/api/outbound-calls/${encodeURIComponent(callId)}`);
        if (!res.ok) throw new Error(`Failed to load report (${res.status})`);
        const data = await res.json();
        setReport(data?.report || data);
      } catch (e) {
        setError(e?.message || 'Failed to load outbound call report');
        setReport(null);
      } finally {
        setLoading(false);
      }
    };
    if (callId) fetchReport();
  }, [callId]);

  const playRecording = () => {
    if (report?.recording_url) {
      window.open(report.recording_url, '_blank');
    }
  };

  const downloadTranscript = () => {
    if (!report) return;
    const analysis = report.analysis || {};
    let transcript = analysis.Transcript_Log || '';
    
    if (typeof transcript === 'string') {
      // Already a string, use as-is
    } else if (Array.isArray(transcript)) {
      transcript = transcript.map(t => `[${t.Timestamp || ''}] ${t.Speaker || ''}: ${t.Text || ''}`).join('\n\n');
    }

    if (!transcript) {
      alert('No transcript available');
      return;
    }

    let textContent = `WALK-IN RECOVERY CALL TRANSCRIPT\n`;
    textContent += `${'='.repeat(80)}\n\n`;
    textContent += `Call ID: ${report.call_id}\n`;
    textContent += `Store: ${report.store_name}\n`;
    textContent += `Date: ${report.call_date}\n`;
    textContent += `Duration: ${report.duration}s\n\n`;
    textContent += `${'='.repeat(80)}\n\n`;
    textContent += transcript;

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `walkin_transcript_${report.call_id}.txt`;
    link.click();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#08080c] flex items-center justify-center">
        <div className="text-gray-300">Loading call report...</div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-[#08080c] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || 'Report not found'}</p>
          <Link to="/outbound-calls" className="text-indigo-400 hover:text-indigo-300 font-semibold inline-flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to Calls
          </Link>
        </div>
      </div>
    );
  }

  const analysis = report.analysis || {};

  // Extract data - support both new and old schema
  // New Schema
  const headerData = analysis.Header_Data || {};
  const pillar1Double = analysis.Pillar_1_Double_Audit || {};
  const pillar2Diag = analysis.Pillar_2_Diagnosis || {};
  const pillar3Hooks = analysis.Pillar_3_Recovery_Hooks || {};
  const pillar4Health = analysis.Pillar_4_Lead_Health || {};
  const pillar5Method = analysis.Pillar_5_Methodology || {};
  const summaryNew = analysis.Summary || {};

  // Old Schema fallbacks
  const pillar1Old = analysis.PILLAR_1_INTENT_BARRIERS || analysis.Pillar_1_Customer_Intent_and_Barriers || {};
  const pillar2Old = analysis.PILLAR_2_EXPERIENCE_DELIVERED || analysis.Pillar_2_Experience_Delivered || {};
  const pillar3Old = analysis.PILLAR_3_RELAX_FRAMEWORK || analysis.Pillar_3_RELAX_Framework || {};
  const pillar4Old = analysis.PILLAR_4_INVITATION_TO_CONVERT || analysis.Pillar_4_Invitation_to_Convert || {};
  const pillar5Old = analysis.PILLAR_5_AGENT_COMPETENCY || analysis.Pillar_5_Agent_Competency || {};
  const summaryOld = analysis.OVERALL_SUMMARY || analysis.Overall_Summary || {};

  // Header Data
  const productOfInterest = headerData.Product_of_Interest || 'Not Specified';
  const leadStatusLabel = headerData.Lead_Status_Label || 
    summaryNew.Recovery_Verdict || 
    summaryOld.Recovery_Verdict || 
    'Unknown';

  // Store Audit (New) or derive from old
  const storeAudit = pillar1Double.Store_Audit || {};
  const storeRating = storeAudit.Rating || 
    (pillar2Old.A_CUSTOMER_EXPERIENCE?.Opening_Experience ? 3 : 0) || 3;
  const storeSentiment = storeAudit.Sentiment_Label || 
    pillar2Old.A_CUSTOMER_EXPERIENCE?.Closing_Sentiment || 'Neutral';
  const storeFeedback = storeAudit.Specific_Feedback || 
    pillar2Old.A_CUSTOMER_EXPERIENCE?.Opening_Experience || 'No specific feedback';

  // Call Audit (New) or derive from old
  const callAudit = pillar1Double.Call_Audit || {};
  const callRating = callAudit.Rating || 
    pillar2Old.Overall_Experience_Rating || 3;
  const callSentiment = callAudit.Sentiment_Label || 
    pillar2Old.A_CUSTOMER_EXPERIENCE?.Customer_Experience_Rating || 'Neutral';
  const callSkillHighlight = callAudit.Skill_Highlight || 
    (pillar5Old.C_SOFT_SKILLS_ETIQUETTE > 3 ? 'Professional Tone' : 'Communication');

  // Diagnosis (New) or derive from old
  const primaryWalkoutReason = pillar2Diag.Primary_WalkOut_Reason || 
    pillar1Old.Primary_NonPurchase_Reason || 'Not Disclosed';
  const primaryBarrierIcon = pillar2Diag.Primary_Barrier_Icon || 'Other';
  const decisionMaker = pillar2Diag.Decision_Maker || 'Self';
  const timelineLabel = pillar2Diag.Timeline_Label || 
    pillar1Old.Timeline_to_Purchase || 'Uncertain';

  // Recovery Hooks (New)
  const sweetenerHook = pillar3Hooks.Sweetener_Hook || {};
  const homeMeasureHook = pillar3Hooks.Home_Measure_Hook || {};

  // Lead Health (New) or derive from old
  const aidaStage = pillar4Health.AIDA_Stage || 
    pillar1Old.Customer_Stage_AIDA || 'Interest';
  const nextActionText = pillar4Health.Next_Action_Text || 
    summaryOld.Next_Action || 'Follow up with customer';

  // RELAX Scores (New or Old)
  const relaxScoresNew = pillar5Method.RELAX_Scores || {};
  const relaxScores = {
    R: relaxScoresNew.R?.Score || pillar3Old.R_REACH_OUT?.Rating || pillar3Old.R_Reach_Out?.Rating || 3,
    E: relaxScoresNew.E?.Score || pillar3Old.E_EXPLORE_NEEDS?.Rating || pillar3Old.E_Explore_Needs?.Rating || 3,
    L: relaxScoresNew.L?.Score || pillar3Old.L_LINK_EXPERIENCE?.Rating || pillar3Old.L_Link_Experience?.Rating || 3,
    A: relaxScoresNew.A?.Score || pillar3Old.A_ADD_VALUE?.Rating || pillar3Old.A_Add_Value?.Rating || 3,
    X: relaxScoresNew.X?.Score || pillar3Old.X_EXPRESS_CLOSING?.Rating || pillar3Old.X_Express_Closing?.Rating || 3,
  };
  const relaxReasons = {
    R: relaxScoresNew.R?.Reason || pillar3Old.R_REACH_OUT?.Reason || pillar3Old.R_Reach_Out?.Reasons?.[0] || '',
    E: relaxScoresNew.E?.Reason || pillar3Old.E_EXPLORE_NEEDS?.Reason || pillar3Old.E_Explore_Needs?.Reasons?.[0] || '',
    L: relaxScoresNew.L?.Reason || pillar3Old.L_LINK_EXPERIENCE?.Reason || pillar3Old.L_Link_Experience?.Reasons?.[0] || '',
    A: relaxScoresNew.A?.Reason || pillar3Old.A_ADD_VALUE?.Reason || pillar3Old.A_Add_Value?.Reasons?.[0] || '',
    X: relaxScoresNew.X?.Reason || pillar3Old.X_EXPRESS_CLOSING?.Reason || pillar3Old.X_Express_Closing?.Reasons?.[0] || '',
  };

  // Soft Skills (New or Old)
  const softSkillsNew = pillar5Method.Soft_Skills || {};
  const softSkills = {
    Empathy: softSkillsNew.Empathy || pillar5Old.C_SOFT_SKILLS_ETIQUETTE || 3,
    Patience: softSkillsNew.Patience || pillar5Old.C_SOFT_SKILLS_ETIQUETTE || 3,
    Persuasion: softSkillsNew.Persuasion || pillar5Old.B_SALES_SKILLS || 3,
    Tone: softSkillsNew.Tone || pillar5Old.C_SOFT_SKILLS_ETIQUETTE || 4,
  };

  // Summary
  const callSynopsis = summaryNew.Call_Synopsis || summaryOld.Call_Synopsis || 'No synopsis available';
  const recoveryVerdict = summaryNew.Recovery_Verdict || summaryOld.Recovery_Verdict || 'Unknown';

  // Transcript - parse string format
  let transcriptItems = [];
  const rawTranscript = analysis.Transcript_Log;
  if (typeof rawTranscript === 'string' && rawTranscript.length > 0) {
    // Try parsing conversation format like "A: ... C: ..." or "Agent: ... Customer: ..."
    let parts = [];
    
    // First try to split by Agent/Customer labels
    if (rawTranscript.includes('Agent:') || rawTranscript.includes('Customer:')) {
      parts = rawTranscript.split(/(?=(?:Agent|Customer):)/g).filter(Boolean);
    }
    // Try A: C: format
    else if (rawTranscript.match(/[AC]:/)) {
      parts = rawTranscript.split(/(?=[AC]:)/g).filter(Boolean);
    }
    // If no clear format, treat as single message
    else {
      parts = [rawTranscript];
    }

    transcriptItems = parts.map((part, idx) => {
      let speaker = 'Unknown';
      let text = part.trim();

      // Match "A: text" or "C: text"
      let match = part.match(/^([AC]):\s*(.*)$/s);
      if (match) {
        speaker = match[1] === 'A' ? 'Agent' : 'Customer';
        text = match[2].trim();
      }
      // Match "Agent: text" or "Customer: text"
      else {
        match = part.match(/^(Agent|Customer):\s*(.*)$/is);
        if (match) {
          speaker = match[1].charAt(0).toUpperCase() + match[1].slice(1);
          text = match[2].trim();
        }
      }

      return {
        Speaker: speaker,
        Text: text,
        Timestamp: ''
      };
    }).filter(item => item.Text.length > 0);
  } else if (Array.isArray(rawTranscript)) {
    transcriptItems = rawTranscript.map(item => ({
      Speaker: item.Speaker || item.speaker || 'Unknown',
      Text: item.Text || item.text || String(item),
      Timestamp: item.Timestamp || item.timestamp || ''
    }));
  }

  // Helper functions
  const getLeadStatusStyle = (status) => {
    const s = (status || '').toLowerCase();
    if (s.includes('hot')) return { bg: 'bg-emerald-900/30', border: 'border-emerald-600/40', text: 'text-emerald-400' };
    if (s.includes('warm') || s.includes('progress')) return { bg: 'bg-amber-900/30', border: 'border-amber-600/40', text: 'text-amber-400' };
    if (s.includes('cold') || s.includes('lost')) return { bg: 'bg-red-900/30', border: 'border-red-600/40', text: 'text-red-400' };
    return { bg: 'bg-gray-800/50', border: 'border-gray-600/40', text: 'text-gray-400' };
  };

  const getSentimentStyle = (sentiment) => {
    const s = (sentiment || '').toLowerCase();
    if (s.includes('excellent') || s.includes('positive')) return { bg: 'bg-emerald-900/30', text: 'text-emerald-300' };
    if (s.includes('neutral')) return { bg: 'bg-amber-900/30', text: 'text-amber-300' };
    return { bg: 'bg-red-900/30', text: 'text-red-300' };
  };

  const getScoreColor = (score) => {
    if (score >= 4) return 'text-emerald-400';
    if (score >= 3) return 'text-amber-400';
    return 'text-red-400';
  };

  const getRelaxBarHeight = (score) => `${Math.max(score * 20, 20)}%`;

  const getRelaxBarClass = (score) => {
    if (score >= 4) return 'bg-gradient-to-t from-emerald-600 to-emerald-400';
    if (score >= 3) return 'bg-gradient-to-t from-amber-600 to-amber-400';
    return 'bg-gradient-to-t from-red-600 to-red-400';
  };

  const getRelaxBorderColor = (score) => {
    if (score >= 4) return 'border-emerald-500';
    if (score >= 3) return 'border-amber-500';
    return 'border-red-500';
  };

  const getBarrierIcon = (barrier) => {
    const b = (barrier || '').toLowerCase();
    if (b.includes('price')) return '💰';
    if (b.includes('product') || b.includes('confusion')) return '🤔';
    if (b.includes('family') || b.includes('spouse')) return '👥';
    if (b.includes('timing') || b.includes('delivery')) return '📅';
    if (b.includes('trust')) return '🔒';
    return '❓';
  };

  const getDecisionIcon = (decision) => {
    const d = (decision || '').toLowerCase();
    if (d.includes('joint')) return '👥';
    if (d.includes('spouse')) return '💑';
    if (d.includes('family')) return '👨‍👩‍👧‍👦';
    return '👤';
  };

  const getTimelineIcon = () => '📅';

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const safeStringify = (value) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (typeof value === 'object') {
      // Try to extract meaningful properties
      if (value.Details) return String(value.Details);
      if (value.Reason) return String(value.Reason);
      if (value.Text) return String(value.Text);
      if (value.Message) return String(value.Message);
      return '';
    }
    return String(value);
  };

  const leadStyle = getLeadStatusStyle(leadStatusLabel);
  const storeSentimentStyle = getSentimentStyle(storeSentiment);
  const callSentimentStyle = getSentimentStyle(callSentiment);

  // AIDA stages
  const aidaStages = ['Awareness', 'Interest', 'Desire', 'Action'];
  const currentAidaIndex = aidaStages.findIndex(s => s.toLowerCase() === (aidaStage || '').toLowerCase());

  return (
    <div className="min-h-screen bg-[#08080c] text-gray-100" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Background Noise Texture */}
      <div 
        className="fixed inset-0 opacity-[0.03] pointer-events-none" 
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")" }}
      ></div>

      <div className="max-w-[1400px] mx-auto px-6 py-10 relative z-10">
        
        {/* Navigation */}
        <div className="flex items-center justify-between mb-6">
          <Link to="/outbound-calls" className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 transition">
            <ArrowLeft className="w-4 h-4" /> Back to Walk-in Leads
          </Link>
          <div className="flex gap-3">
            <button 
              onClick={playRecording}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition shadow-sm"
            >
              <Play className="w-4 h-4" /> Play Recording
            </button>
            <button 
              onClick={downloadTranscript}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold transition shadow-sm"
            >
              <FileDown className="w-4 h-4" /> Transcript
            </button>
          </div>
        </div>

        {/* Header Section */}
        <header className="bg-gradient-to-br from-[#0f0f14] to-[#16161d] border border-white/6 rounded-3xl p-8 mb-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-600 to-transparent"></div>
          
          <div className="flex justify-between items-start mb-6">
            <div className="flex flex-col gap-2">
              <span className="font-mono text-xs text-gray-500 tracking-wider">ID: {report.call_id}</span>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-semibold text-gray-100" style={{ fontFamily: 'Fraunces, serif', letterSpacing: '-0.02em' }}>
                  WALK-IN RECOVERY
                </h1>
                <span className={`inline-flex items-center gap-2 ${leadStyle.bg} border ${leadStyle.border} px-3 py-1 rounded-full text-xs font-bold ${leadStyle.text} uppercase tracking-wider`}>
                  <span className="w-2 h-2 rounded-full bg-current animate-pulse"></span>
                  {leadStatusLabel}
                </span>
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-2">
              <span className="text-xs uppercase tracking-wider text-gray-500">Product of Interest</span>
              <div className="text-2xl font-bold text-gray-100 font-mono">{productOfInterest}</div>
            </div>
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-5 gap-6 pt-6 border-t border-white/5">
            <div className="col-span-2">
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Store Visited</p>
              <div className="flex items-center gap-2 text-gray-200 font-medium">
                <Home className="w-4 h-4 text-indigo-400" />
                {report.store_name || 'Unknown Store'}
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Visit Date</p>
              <p className="text-sm font-medium text-gray-200">{report.call_date || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Customer</p>
              <p className="text-sm font-medium text-gray-200">{report.customer_phone || 'Walk-in Customer'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Call Duration</p>
              <p className="text-sm font-medium text-gray-200">{formatDuration(report.duration || 0)}</p>
            </div>
          </div>
        </header>

        {/* ZONE 1: THE DOUBLE AUDIT */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Store Experience Audit */}
          <div className={`bg-[#0f0f14] border border-white/6 rounded-2xl p-6 border-l-4 ${storeRating >= 4 ? 'border-l-emerald-500' : storeRating >= 3 ? 'border-l-amber-500' : 'border-l-red-500'}`}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium text-gray-100" style={{ fontFamily: 'Fraunces, serif' }}>Store Experience Rating</h2>
              <span className={`px-2 py-1 ${storeSentimentStyle.bg} ${storeSentimentStyle.text} rounded text-xs font-bold uppercase`}>
                {storeSentiment}
              </span>
            </div>
            <div className="flex gap-4 items-center">
              <div className={`text-4xl font-bold ${getScoreColor(storeRating)}`}>
                {storeRating}<span className="text-lg text-gray-600">/5</span>
              </div>
              <div>
                <p className="text-sm text-gray-300 font-medium">"{String(storeFeedback).substring(0, 50)}..."</p>
                <p className="text-xs text-gray-500 mt-1">{String(storeFeedback)}</p>
              </div>
            </div>
          </div>

          {/* Call Experience Audit */}
          <div className={`bg-[#0f0f14] border border-white/6 rounded-2xl p-6 border-l-4 ${callRating >= 4 ? 'border-l-emerald-500' : callRating >= 3 ? 'border-l-amber-500' : 'border-l-red-500'}`}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium text-gray-100" style={{ fontFamily: 'Fraunces, serif' }}>Call Experience (Agent)</h2>
              <span className={`px-2 py-1 ${callSentimentStyle.bg} ${callSentimentStyle.text} rounded text-xs font-bold uppercase`}>
                {callSentiment}
              </span>
            </div>
            <div className="flex gap-4 items-center">
              <div className={`text-4xl font-bold ${getScoreColor(callRating)}`}>
                {callRating}<span className="text-lg text-gray-600">/5</span>
              </div>
              <div>
                <p className="text-sm text-gray-300 font-medium">{callSkillHighlight}</p>
                <p className="text-xs text-gray-500 mt-1">Key skill demonstrated during the call</p>
              </div>
            </div>
          </div>
        </div>

        {/* ZONE 2: DIAGNOSIS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Why: Barrier */}
          <div className="bg-[#0f0f14] border border-white/6 rounded-2xl p-5">
            <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Primary Walk-out Reason</p>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{getBarrierIcon(primaryWalkoutReason)}</span>
              <span className="font-bold text-gray-200">{primaryWalkoutReason}</span>
            </div>
            <p className="text-xs text-gray-400">Main barrier identified during the call.</p>
          </div>

          {/* Who: Decision Maker */}
          <div className="bg-[#0f0f14] border border-white/6 rounded-2xl p-5">
            <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Decision Maker</p>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{getDecisionIcon(decisionMaker)}</span>
              <span className="font-bold text-gray-200">{decisionMaker}</span>
            </div>
            <p className="text-xs text-gray-400">Who makes the final purchase decision.</p>
          </div>

          {/* When: Timeline */}
          <div className="bg-[#0f0f14] border border-white/6 rounded-2xl p-5">
            <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Timeline to Purchase</p>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{getTimelineIcon()}</span>
              <span className={`font-bold ${timelineLabel.toLowerCase().includes('short') || timelineLabel.toLowerCase().includes('immediate') ? 'text-amber-300' : 'text-gray-200'}`}>
                {timelineLabel}
              </span>
            </div>
            <p className="text-xs text-gray-400">Expected purchase timeline.</p>
          </div>
        </div>

        {/* ZONE 3: RECOVERY HOOKS */}
        <div className="bg-[#0f0f14] border border-white/6 rounded-2xl p-7 mb-6 relative overflow-hidden">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-medium text-gray-100" style={{ fontFamily: 'Fraunces, serif' }}>Recovery Hooks Used</h2>
            <span className="text-xs text-gray-500">Did the agent add value to save the deal?</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
            {/* Hook 1: Value Add / Sweetener */}
            <div className={`bg-[#16161d] rounded-xl p-5 border ${sweetenerHook.Rating_Label === 'HIGH' ? 'border-emerald-500/30' : sweetenerHook.Rating_Label === 'MEDIUM' ? 'border-amber-500/30' : 'border-gray-600/30'}`}>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="text-sm font-bold text-gray-200">Value Add / Sweetener</p>
                  <p className="text-xs text-gray-400">Discount or Gift offered?</p>
                </div>
                <span className={`px-2 py-1 text-xs font-bold rounded ${
                  sweetenerHook.Rating_Label === 'HIGH' ? 'bg-emerald-500/20 text-emerald-400' :
                  sweetenerHook.Rating_Label === 'MEDIUM' ? 'bg-amber-500/20 text-amber-400' :
                  sweetenerHook.Rating_Label === 'LOW' ? 'bg-red-500/20 text-red-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {sweetenerHook.Rating_Label || 'NOT OFFERED'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Percent className={`w-4 h-4 ${sweetenerHook.Rating_Label === 'HIGH' ? 'text-emerald-400' : sweetenerHook.Rating_Label === 'MEDIUM' ? 'text-amber-400' : 'text-gray-400'}`} />
                <span className="text-sm text-gray-300">{safeStringify(sweetenerHook.Details) || 'No specific offer mentioned'}</span>
              </div>
            </div>

            {/* Hook 2: Home Measure */}
            <div className={`bg-[#16161d] rounded-xl p-5 border ${homeMeasureHook.Offered ? 'border-emerald-500/30' : 'border-gray-600/30'}`}>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="text-sm font-bold text-gray-200">Home Measure Visit</p>
                  <p className="text-xs text-gray-400">Service hook offered?</p>
                </div>
                <span className={`px-2 py-1 text-xs font-bold rounded ${homeMeasureHook.Offered ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-400'}`}>
                  {homeMeasureHook.Offered ? 'OFFERED' : 'NOT OFFERED'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Package className={`w-4 h-4 ${homeMeasureHook.Offered ? 'text-emerald-400' : 'text-gray-400'}`} />
                <span className="text-sm text-gray-300">{safeStringify(homeMeasureHook.Reasoning) || 'Home measurement service not discussed'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ZONE 4: LEAD HEALTH */}
        <div className="bg-[#0f0f14] border border-white/6 rounded-2xl p-7 mb-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-medium text-gray-100" style={{ fontFamily: 'Fraunces, serif' }}>Lead Health</h2>
            <span className="text-xs text-gray-500">Funnel State (AIDA)</span>
          </div>

          {/* AIDA Funnel Visual */}
          <div className="flex items-center justify-between w-full gap-2 mb-8 px-2">
            {aidaStages.map((stage, index) => (
              <React.Fragment key={stage}>
                <div className={`flex-1 py-3 rounded-md text-center text-sm font-bold uppercase tracking-wider relative ${
                  index === currentAidaIndex 
                    ? 'bg-amber-900/20 border border-amber-500/50 text-amber-500' 
                    : 'bg-[#16161d] border border-white/5 text-gray-500'
                }`}>
                  {stage}
                  {index === currentAidaIndex && (
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-amber-500 rotate-45 border-2 border-[#08080c]"></div>
                  )}
                </div>
                {index < aidaStages.length - 1 && <div className="w-4 h-0.5 bg-gray-800"></div>}
              </React.Fragment>
            ))}
          </div>

          <div className="bg-[#16161d] rounded-lg p-5 border-l-2 border-indigo-500">
            <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Next Action for Duroflex</p>
            <p className="text-sm font-medium text-white">{nextActionText}</p>
          </div>
        </div>

        {/* ZONE 5: RELAX METHODOLOGY */}
        <div className="bg-[#0f0f14] border border-white/6 rounded-2xl p-7 mb-6">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-lg font-medium text-gray-100" style={{ fontFamily: 'Fraunces, serif' }}>RELAX Sales Methodology</h2>
            <span className="text-xs text-gray-500">Framework Performance</span>
          </div>
          
          {/* RELAX Bar Chart */}
          <div className="flex justify-between items-end h-48 px-8 mb-8">
            {[
              { letter: 'R', name: 'Reach Out', score: relaxScores.R },
              { letter: 'E', name: 'Explore', score: relaxScores.E },
              { letter: 'L', name: 'Link', score: relaxScores.L },
              { letter: 'A', name: 'Add Value', score: relaxScores.A },
              { letter: 'X', name: 'Express', score: relaxScores.X },
            ].map((item) => (
              <div key={item.letter} className="flex flex-col items-center gap-3 flex-1">
                <div 
                  className={`w-14 rounded-t-lg ${getRelaxBarClass(item.score)} flex items-end justify-center pb-3 relative shadow-lg`}
                  style={{ height: getRelaxBarHeight(item.score) }}
                >
                  <span className="text-lg font-bold text-white drop-shadow-md">{item.score}</span>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-gray-200">{item.letter}</p>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">{item.name}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Text Breakdown Grid */}
          <div className="grid grid-cols-5 gap-3">
            {['R', 'E', 'L', 'A', 'X'].map((letter) => (
              <div key={letter} className={`bg-[#16161d] rounded p-3 border-l-2 ${getRelaxBorderColor(relaxScores[letter])}`}>
                <p className="text-xs text-gray-400 leading-relaxed">{relaxReasons[letter] || 'No details available.'}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Soft Skills */}
        <div className="bg-[#0f0f14] border border-white/6 rounded-2xl p-6 mb-6">
          <h2 className="text-md font-medium text-gray-100 mb-4" style={{ fontFamily: 'Fraunces, serif' }}>Agent Soft Skills</h2>
          <div className="grid grid-cols-4 gap-4">
            {Object.entries(softSkills).map(([skill, score]) => (
              <div key={skill} className="bg-[#16161d] p-4 rounded-lg text-center">
                <span className={`block text-2xl font-bold ${getScoreColor(score)}`}>{score}</span>
                <span className="text-[10px] text-gray-500 uppercase mt-1">{skill}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="bg-[#0f0f14] border border-white/6 rounded-2xl p-7 mb-6">
          <h2 className="text-lg font-medium text-gray-100 mb-4" style={{ fontFamily: 'Fraunces, serif' }}>Call Summary & Verdict</h2>
          <div className={`bg-[#16161d] rounded-lg p-6 border-l-4 ${
            recoveryVerdict.toLowerCase().includes('hot') ? 'border-emerald-500' :
            recoveryVerdict.toLowerCase().includes('warm') || recoveryVerdict.toLowerCase().includes('progress') ? 'border-amber-500' :
            'border-red-500'
          }`}>
            <div className="flex justify-between items-start mb-2">
              <h3 className={`text-sm font-bold uppercase tracking-wide ${
                recoveryVerdict.toLowerCase().includes('hot') ? 'text-emerald-400' :
                recoveryVerdict.toLowerCase().includes('warm') || recoveryVerdict.toLowerCase().includes('progress') ? 'text-amber-400' :
                'text-red-400'
              }`}>{recoveryVerdict}</h3>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed italic">
              "{callSynopsis}"
            </p>
          </div>
        </div>

        {/* Transcript */}
        {transcriptItems.length > 0 ? (
          <div className="bg-[#0f0f14] border border-white/6 rounded-2xl overflow-hidden">
            <div className="flex justify-between items-center p-7 border-b border-white/6">
              <h2 className="text-lg font-medium text-gray-100" style={{ fontFamily: 'Fraunces, serif' }}>Call Transcript</h2>
              <button
                onClick={() => setExpandTranscript(!expandTranscript)}
                className="flex items-center gap-2 px-4 py-2 bg-[#16161d] rounded-lg text-sm text-indigo-400 hover:bg-[#1c1c25] transition"
              >
                <span>{expandTranscript ? 'Collapse' : 'Expand'}</span>
                {expandTranscript ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            {expandTranscript && (
              <div className="max-h-[500px] overflow-y-auto p-7 space-y-6">
                {transcriptItems.map((msg, i) => (
                  <div key={i} className="flex gap-4 pb-4 border-b border-gray-800 last:border-0">
                    <span className="font-mono text-xs text-gray-500 min-w-12 pt-1">{msg.Timestamp || ''}</span>
                    <div className="flex-1">
                      <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${
                        msg.Speaker?.toLowerCase().includes('agent') ? 'text-indigo-400' : 'text-emerald-400'
                      }`}>
                        {msg.Speaker}
                      </p>
                      <p className="text-sm text-gray-300 leading-relaxed">{msg.Text}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-[#0f0f14] border border-white/6 rounded-2xl p-7">
            <h2 className="text-lg font-medium text-gray-100 mb-4" style={{ fontFamily: 'Fraunces, serif' }}>Call Transcript</h2>
            <p className="text-gray-400">No transcript available for this call.</p>
          </div>
        )}

      </div>
    </div>
  );
};

export default OutboundCallDetail;
