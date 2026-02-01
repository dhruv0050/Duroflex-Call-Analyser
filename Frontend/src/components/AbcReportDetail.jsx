import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronUp, FileDown, Play, Home, Video, Percent, CalendarCheck } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://duroflex-call-analyser.onrender.com';

const AbcReportDetail = () => {
  const { callId } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandTranscript, setExpandTranscript] = useState(false);

  useEffect(() => {
    fetchReport();
  }, [callId]);

  const fetchReport = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/abc-calls/${callId}`);
      if (!res.ok) throw new Error('Failed to load report');
      const data = await res.json();
      setReport(data.report);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const playAudio = () => {
    if (report?.audio_url) {
      window.open(report.audio_url, '_blank');
    }
  };

  const downloadTranscript = () => {
    if (!report) return;
    const analysis = report.analysis || {};
    const transcript = analysis.Transcript_Log || [];
    
    let textContent = `CALL TRANSCRIPT\n`;
    textContent += `${'='.repeat(80)}\n`;
    textContent += `Call ID: ${report.call_id}\n`;
    textContent += `Date: ${report.processed_at}\n\n`;
    
    transcript.forEach((entry, index) => {
      textContent += `[${entry.Timestamp || index}] ${entry.Speaker || 'Unknown'}: ${entry.Text}\n\n`;
    });

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `transcript_${report.call_id}.txt`;
    link.click();
  };

  if (loading) return <div className="min-h-screen bg-[#08080c] flex items-center justify-center text-gray-300">Loading...</div>;
  if (error || !report) return <div className="min-h-screen bg-[#08080c] flex items-center justify-center text-red-400">{error || 'Report not found'}</div>;

  // Extract data from analysis (new schema)
  const analysis = report.analysis || {};
  const headerData = analysis.Header_Data || {};
  const theVerdict = analysis.The_Verdict || {};
  const conversionAttempts = analysis.Conversion_Attempts || {};
  const relaxFramework = analysis.RELAX_Framework || {};
  const experienceSkills = analysis.Experience_and_Skills || {};
  const nextActions = analysis.Next_Actions || [];
  const summaryNarrative = analysis.Summary_Narrative || '';
  const transcript = analysis.Transcript_Log || [];
  const softSkills = experienceSkills.Soft_Skills || {};

  // Fallback to old schema if new doesn't exist
  const functional = analysis.Functional || {};
  const p1 = analysis.Pillar_1_Customer_Intent_and_Barriers || {};
  const p2 = analysis.Pillar_2_Experience_Delivered || {};
  const p3 = analysis.Pillar_3_RELAX_Framework || {};
  const p4 = analysis.Pillar_4_Invitation_to_Convert || {};
  const p5 = analysis.Pillar_5_Agent_Competency || {};
  const oldSummary = analysis.Overall_Summary || {};

  // Get agent name (priority: CSV data > analysis)
  const agentName = report.agent_name || 
    report.raw_data?.AgentName || 
    report.raw_data?.Agent_Name || 
    headerData.Agent_Name ||
    functional.Agent_Name || 
    'Unknown Agent';

  // Get cart value
  const cartValue = report.raw_data?.['Lineitem price'] || 'N/A';

  // Get lead status
  const leadStatusLabel = headerData.Lead_Status_Label || 
    (p1.Intent_to_Purchase_Rating === 'HIGH' ? 'HOT LEAD' : 
     p1.Intent_to_Purchase_Rating === 'LOW' ? 'COLD/LOST' : 'NURTURING');

  // Get outcome headline
  const outcomeHeadline = theVerdict.Recovery_Outcome_Headline || 
    p4.Commitment_Obtained || 
    (oldSummary.Call_Synopsis ? oldSummary.Call_Synopsis.substring(0, 40) : 'Call Completed');

  // Get primary barrier
  const primaryBarrier = theVerdict.Primary_Barrier || p1.Primary_Abandonment_Reason || 'Not Specified';

  // Get funnel stage
  const funnelStage = theVerdict.Funnel_Stage_AIDA || p1.Customer_Stage_AIDA || 'Interest';

  // Get intent
  const purchaseIntent = theVerdict.Purchase_Intent || p1.Intent_to_Purchase_Rating || 'MEDIUM';

  // RELAX scores (new schema or old)
  const relaxScores = {
    R: relaxFramework.R_Reach_Out?.Score || p3.R_Reach_Out?.Rating || 3,
    E: relaxFramework.E_Explore?.Score || p3.E_Explore_Needs?.Rating || 3,
    L: relaxFramework.L_Link?.Score || p3.L_Link_Experience?.Rating || 3,
    A: relaxFramework.A_Add_Value?.Score || p3.A_Add_Value?.Rating || 3,
    X: relaxFramework.X_Express?.Score || p3.X_Express_Closing?.Rating || 3,
  };

  const relaxReasons = {
    R: relaxFramework.R_Reach_Out?.Reason || p3.R_Reach_Out?.Reasons?.join('. ') || '',
    E: relaxFramework.E_Explore?.Reason || p3.E_Explore_Needs?.Reasons?.join('. ') || '',
    L: relaxFramework.L_Link?.Reason || p3.L_Link_Experience?.Reasons?.join('. ') || '',
    A: relaxFramework.A_Add_Value?.Reason || p3.A_Add_Value?.Reasons?.join('. ') || '',
    X: relaxFramework.X_Express?.Reason || p3.X_Express_Closing?.Reasons?.join('. ') || '',
  };

  // Conversion attempts (new schema or old)
  const storeVisit = conversionAttempts.Store_Visit || {};
  const videoCall = conversionAttempts.Video_Call || {};
  const discountOffer = conversionAttempts.Discount_Offer || {};

  // Experience scores
  const csatScore = experienceSkills.CSAT_Score || p2.Overall_Experience_Rating || 4;
  const customerSentiment = experienceSkills.Customer_Sentiment || p2.Customer_Experience?.Closing_Sentiment || 'Neutral';
  const sentimentReason = experienceSkills.Sentiment_Reason || '';
  const empathyScore = softSkills.Empathy_Score || p2.Customer_Experience?.Empathy_Displayed_Rating || 4;
  const listeningScore = softSkills.Active_Listening_Score || p2.Customer_Experience?.Listening_Quality_Rating || 4;
  const objectionScore = softSkills.Objection_Handling_Score || p5.Sales_Skills?.Score || 3;

  // Summary
  const finalSummary = summaryNarrative || oldSummary.Call_Synopsis || 'No summary available.';

  // Helper functions
  const getLeadStatusStyle = (status) => {
    const statusUpper = (status || '').toUpperCase();
    if (statusUpper.includes('HOT')) return { bg: 'bg-emerald-900/30', border: 'border-emerald-600/40', text: 'text-emerald-400' };
    if (statusUpper.includes('NURTURING')) return { bg: 'bg-amber-900/30', border: 'border-amber-600/40', text: 'text-amber-400' };
    return { bg: 'bg-red-900/30', border: 'border-red-600/40', text: 'text-red-400' };
  };

  const getIntentStyle = (intent) => {
    const intentUpper = (intent || '').toUpperCase();
    if (intentUpper.includes('HIGH')) return { bg: 'bg-emerald-900/30', text: 'text-emerald-300', border: 'border-emerald-600/40' };
    if (intentUpper.includes('MEDIUM')) return { bg: 'bg-amber-900/30', text: 'text-amber-300', border: 'border-amber-600/40' };
    return { bg: 'bg-red-900/30', text: 'text-red-300', border: 'border-red-600/40' };
  };

  const getRelaxBarClass = (score) => {
    if (score >= 4) return 'bg-gradient-to-t from-emerald-600 to-emerald-500';
    if (score >= 3) return 'bg-gradient-to-t from-amber-600 to-amber-500';
    if (score >= 2) return 'bg-gradient-to-t from-orange-600 to-orange-500';
    return 'bg-gradient-to-t from-red-600 to-red-500';
  };

  const getRelaxBorderColor = (score) => {
    if (score >= 4) return 'border-emerald-600';
    if (score >= 3) return 'border-amber-600';
    return 'border-red-600';
  };

  const getConversionStatus = (status) => {
    if (!status) return { label: 'Not Mentioned', style: 'bg-gray-500/10 text-gray-400', borderColor: 'border-gray-600' };
    const statusLower = status.toLowerCase();
    if (statusLower.includes('accepted')) return { label: 'Accepted', style: 'bg-emerald-500/10 text-emerald-400', borderColor: 'border-emerald-500' };
    if (statusLower.includes('declined')) return { label: 'Declined', style: 'bg-red-500/10 text-red-400', borderColor: 'border-red-500' };
    if (statusLower.includes('not invited') || statusLower.includes('not offered')) return { label: 'Missed', style: 'bg-red-500/10 text-red-400', borderColor: 'border-red-500' };
    if (statusLower.includes('discussed')) return { label: 'Discussed', style: 'bg-amber-500/10 text-amber-400', borderColor: 'border-amber-500' };
    return { label: status, style: 'bg-gray-500/10 text-gray-400', borderColor: 'border-gray-600' };
  };

  const getFunnelStages = () => {
    const stages = ['Awareness', 'Interest', 'Desire', 'Action'];
    const currentIndex = stages.findIndex(s => s.toLowerCase() === funnelStage.toLowerCase());
    return stages.map((stage, index) => ({
      name: stage,
      isActive: index <= currentIndex,
      isCurrent: index === currentIndex
    }));
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const leadStyle = getLeadStatusStyle(leadStatusLabel);
  const intentStyle = getIntentStyle(purchaseIntent);
  const funnelStages = getFunnelStages();

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
          <Link to="/abc-calls" className="inline-flex items-center gap-2 text-amber-400 hover:text-amber-300 transition">
            <ArrowLeft className="w-4 h-4" /> Back to ABC Reports
          </Link>
          <div className="flex gap-3">
            <button 
              onClick={playAudio}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition shadow-sm"
            >
              <Play className="w-4 h-4" /> Play Audio
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
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-amber-600 to-transparent"></div>
          
          <div className="flex justify-between items-start mb-6">
            <div className="flex flex-col gap-2">
              <span className="font-mono text-xs text-gray-500 tracking-wider">ID: {report.call_id}</span>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-semibold text-gray-100" style={{ fontFamily: 'Fraunces, serif', letterSpacing: '-0.02em' }}>
                  CART RECOVERY
                </h1>
                {/* Lead Status Badge */}
                <span className={`inline-flex items-center gap-2 ${leadStyle.bg} border ${leadStyle.border} px-3 py-1 rounded-full text-xs font-bold ${leadStyle.text} uppercase tracking-wider`}>
                  <span className="w-2 h-2 rounded-full bg-current animate-pulse"></span>
                  {leadStatusLabel}
                </span>
              </div>
              <div className="flex gap-2 mt-1">
                <span className="text-xs text-gray-400 bg-white/5 px-2 py-1 rounded">Customer: {report.phone}</span>
                <span className="text-xs text-gray-400 bg-white/5 px-2 py-1 rounded">Agent: {agentName}</span>
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-2">
              <span className="text-xs uppercase tracking-wider text-gray-500">Cart Value</span>
              <div className="text-2xl font-bold text-gray-100 font-mono">
                {cartValue !== 'N/A' ? `₹${Number(cartValue).toLocaleString('en-IN')}` : 'N/A'}
              </div>
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-6 gap-6 pt-6 border-t border-white/5">
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Call Date</p>
              <p className="text-sm font-medium text-gray-200">{formatDate(report.processed_at)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Duration</p>
              <p className="text-sm font-medium text-gray-200">{headerData.Call_Duration || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Cart Status</p>
              <p className="text-sm font-medium text-red-300">Abandoned</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Lead Stage</p>
              <p className="text-sm font-medium text-amber-300">{funnelStage}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Location</p>
              <p className="text-sm font-medium text-gray-200">{report.city || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Audio Quality</p>
              <div className="flex gap-1 items-end h-6">
                {[12, 16, 20, 14, 18].map((h, i) => (
                  <div key={i} className="w-1 rounded-sm bg-emerald-500" style={{ height: `${h}px` }}></div>
                ))}
              </div>
            </div>
          </div>
        </header>

        {/* ROW 1: Lead Status & Next Action */}
        <div className="grid grid-cols-3 gap-6 mb-6">
          {/* Card 1: Recovery Outcome */}
          <div className="bg-[#0f0f14] border border-white/6 rounded-2xl p-6 col-span-2 relative overflow-hidden">
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Recovery Outcome</p>
                <h2 className="text-xl font-medium text-gray-100" style={{ fontFamily: 'Fraunces, serif' }}>
                  {outcomeHeadline}
                </h2>
              </div>
              <div className={`w-12 h-12 rounded-full ${leadStyle.bg} border ${leadStyle.border} flex items-center justify-center`}>
                <CalendarCheck className={`w-6 h-6 ${leadStyle.text}`} />
              </div>
            </div>
            <div className={`bg-[#16161d] rounded-lg p-4 border-l-2 ${leadStatusLabel.includes('HOT') ? 'border-emerald-500' : leadStatusLabel.includes('NURTURING') ? 'border-amber-500' : 'border-red-500'} relative z-10`}>
              <p className="text-sm text-gray-300 leading-relaxed">
                <span className={`font-bold ${leadStyle.text}`}>
                  {leadStatusLabel.includes('HOT') ? 'Success:' : leadStatusLabel.includes('NURTURING') ? 'In Progress:' : 'Outcome:'}
                </span>{' '}
                {theVerdict.Recovery_Outcome_Description || finalSummary}
              </p>
            </div>
            {/* Subtle background glow */}
            <div className={`absolute top-0 right-0 w-64 h-64 ${leadStatusLabel.includes('HOT') ? 'bg-emerald-600/5' : leadStatusLabel.includes('NURTURING') ? 'bg-amber-600/5' : 'bg-red-600/5'} rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none`}></div>
          </div>

          {/* Card 2: Next Action */}
          <div className="bg-[#0f0f14] border border-amber-600/30 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">🚀</span>
              <h2 className="text-lg font-medium text-gray-100" style={{ fontFamily: 'Fraunces, serif' }}>Next Action</h2>
            </div>
            <div className="space-y-3">
              {nextActions.length > 0 ? nextActions.map((action, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className={`mt-1 w-4 h-4 rounded-full border ${index === 0 ? 'border-amber-500' : 'border-gray-600'} flex items-center justify-center flex-shrink-0`}>
                    {index === 0 && <div className="w-2 h-2 rounded-full bg-amber-500"></div>}
                  </div>
                  <p className={`text-sm ${index === 0 ? 'text-gray-300' : 'text-gray-400'}`}>{action}</p>
                </div>
              )) : (
                <p className="text-sm text-gray-500">No specific actions recommended</p>
              )}
              <div className="mt-4 pt-4 border-t border-white/10">
                <p className="text-xs uppercase tracking-wider text-gray-500">Lead Status</p>
                <p className={`text-xs mt-1 ${leadStyle.text}`}>{leadStatusLabel}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ROW 2: Insights & Barriers */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Left: Funnel & Barrier Analysis */}
          <div className="bg-[#0f0f14] border border-white/6 rounded-2xl p-7">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-medium text-gray-100" style={{ fontFamily: 'Fraunces, serif' }}>Funnel & Barrier Analysis</h2>
            </div>
            
            <div className="space-y-6">
              {/* Funnel State */}
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Funnel State (AIDA)</p>
                <div className="flex items-center gap-1">
                  {funnelStages.map((stage, index) => (
                    <React.Fragment key={stage.name}>
                      <div className={`flex-1 h-8 rounded ${
                        stage.isCurrent 
                          ? 'bg-amber-900/40 border border-amber-500/50' 
                          : stage.isActive 
                            ? 'bg-emerald-900/40 border border-emerald-500/30' 
                            : 'bg-gray-800 text-gray-500'
                      } flex items-center justify-center text-xs font-bold ${
                        stage.isCurrent ? 'text-amber-400' : stage.isActive ? 'text-emerald-400' : ''
                      } relative`}>
                        {stage.name}
                        {stage.isCurrent && <span className="absolute -bottom-2 w-2 h-2 rotate-45 bg-amber-500"></span>}
                      </div>
                      {index < funnelStages.length - 1 && <div className="w-4 h-0.5 bg-gray-800"></div>}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Intent Gauge */}
                <div>
                  <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Purchase Intent</p>
                  <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold ${intentStyle.bg} ${intentStyle.text} border ${intentStyle.border} w-full justify-center`}>
                    <span className="w-2 h-2 rounded-full bg-current"></span>
                    {purchaseIntent}
                  </div>
                </div>
                {/* Barrier */}
                <div>
                  <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Primary Barrier</p>
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-sm text-gray-300 w-full justify-center">
                    <span>🏷️</span> {primaryBarrier}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Conversion Attempts */}
          <div className="bg-[#0f0f14] border border-white/6 rounded-2xl p-7">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-medium text-gray-100" style={{ fontFamily: 'Fraunces, serif' }}>Conversion Attempts</h2>
              <span className="text-xs text-gray-500">Did the agent try to close?</span>
            </div>
            
            <div className="space-y-4">
              {/* Store Visit */}
              {(() => {
                const status = getConversionStatus(storeVisit.Status);
                return (
                  <div className={`flex items-center justify-between p-4 bg-[#16161d] rounded-lg border-l-4 ${status.borderColor}`}>
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${status.borderColor === 'border-emerald-500' ? 'bg-emerald-900/20 text-emerald-400' : status.borderColor === 'border-red-500' ? 'bg-red-900/20 text-red-400' : 'bg-amber-900/20 text-amber-400'}`}>
                        <Home className="w-[18px] h-[18px]" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-200">Store Visit Invited</p>
                        <p className="text-xs text-gray-400">{storeVisit.Details || 'No details available'}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 ${status.style} text-xs font-bold rounded uppercase`}>{status.label}</span>
                  </div>
                );
              })()}

              {/* Video Call */}
              {(() => {
                const status = getConversionStatus(videoCall.Status);
                return (
                  <div className={`flex items-center justify-between p-4 bg-[#16161d] rounded-lg border-l-4 ${status.borderColor} ${status.borderColor === 'border-red-500' ? 'opacity-75' : ''}`}>
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${status.borderColor === 'border-emerald-500' ? 'bg-emerald-900/20 text-emerald-400' : status.borderColor === 'border-red-500' ? 'bg-red-900/20 text-red-400' : 'bg-amber-900/20 text-amber-400'}`}>
                        <Video className="w-[18px] h-[18px]" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-200">Video Call Demo</p>
                        <p className="text-xs text-gray-400">{videoCall.Details || 'No details available'}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 ${status.style} text-xs font-bold rounded uppercase`}>{status.label}</span>
                  </div>
                );
              })()}

              {/* Discount */}
              {(() => {
                const status = getConversionStatus(discountOffer.Status);
                return (
                  <div className={`flex items-center justify-between p-4 bg-[#16161d] rounded-lg border-l-4 ${status.borderColor}`}>
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${status.borderColor === 'border-emerald-500' ? 'bg-emerald-900/20 text-emerald-400' : status.borderColor === 'border-red-500' ? 'bg-red-900/20 text-red-400' : 'bg-amber-900/20 text-amber-400'}`}>
                        <Percent className="w-[18px] h-[18px]" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-200">Discount Offered</p>
                        <p className="text-xs text-gray-400">{discountOffer.Details || 'No details available'}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 ${status.style} text-xs font-bold rounded uppercase`}>{status.label}</span>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* ROW 3: RELAX Framework */}
        <div className="bg-[#0f0f14] border border-white/6 rounded-2xl p-7 mb-6">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-lg font-medium text-gray-100" style={{ fontFamily: 'Fraunces, serif' }}>RELAX Sales Methodology</h2>
            <span className="text-xs text-gray-500">Framework Performance</span>
          </div>
          
          {/* Visual Bars */}
          <div className="flex justify-between items-end h-40 gap-4 mb-10 px-12">
            {[
              { letter: 'R', name: 'Reach Out', score: relaxScores.R },
              { letter: 'E', name: 'Explore', score: relaxScores.E },
              { letter: 'L', name: 'Link', score: relaxScores.L },
              { letter: 'A', name: 'Add Value', score: relaxScores.A },
              { letter: 'X', name: 'Express', score: relaxScores.X },
            ].map((item) => (
              <div key={item.letter} className="flex flex-col items-center gap-3 flex-1">
                <div className="relative w-full flex justify-center group">
                  <div 
                    className={`w-12 rounded-t-lg ${getRelaxBarClass(item.score)} flex items-end justify-center pb-2 relative transition-all`} 
                    style={{ height: `${Math.max(item.score * 30, 20)}px` }}
                  >
                    <span className="text-lg font-bold text-white">{item.score}</span>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-xl font-semibold text-gray-100">{item.letter}</p>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">{item.name}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Text Breakdown */}
          <div className="grid grid-cols-5 gap-4">
            {[
              { letter: 'R', score: relaxScores.R, reason: relaxReasons.R },
              { letter: 'E', score: relaxScores.E, reason: relaxReasons.E },
              { letter: 'L', score: relaxScores.L, reason: relaxReasons.L },
              { letter: 'A', score: relaxScores.A, reason: relaxReasons.A },
              { letter: 'X', score: relaxScores.X, reason: relaxReasons.X },
            ].map((item) => (
              <div key={item.letter} className={`bg-[#16161d] rounded-lg p-3 border-l-2 ${getRelaxBorderColor(item.score)}`}>
                <p className="text-xs text-gray-400">{item.reason || 'No feedback available.'}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ROW 4: Experience & Soft Skills */}
        <div className="grid grid-cols-3 gap-6 mb-6">
          {/* CSAT */}
          <div className="bg-[#0f0f14] border border-white/6 rounded-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-md font-medium text-gray-100" style={{ fontFamily: 'Fraunces, serif' }}>Customer Experience</h2>
            </div>
            <div className="flex items-center gap-4 mb-4">
              <div className={`w-16 h-16 rounded-full border-2 ${csatScore >= 4 ? 'border-emerald-600' : csatScore >= 3 ? 'border-amber-600' : 'border-red-600'} flex items-center justify-center relative`}>
                <span className={`text-2xl font-bold ${csatScore >= 4 ? 'text-emerald-400' : csatScore >= 3 ? 'text-amber-400' : 'text-red-400'}`}>{csatScore}</span>
                <div className={`absolute inset-0 -m-1 rounded-full border-2 ${csatScore >= 4 ? 'border-emerald-600' : csatScore >= 3 ? 'border-amber-600' : 'border-red-600'} opacity-30`}></div>
              </div>
              <div>
                <span className="text-sm text-gray-300 font-semibold">{customerSentiment} Sentiment</span>
                <p className="text-xs text-gray-500">{sentimentReason || 'Customer feedback recorded.'}</p>
              </div>
            </div>
          </div>

          {/* Soft Skills */}
          <div className="bg-[#0f0f14] border border-white/6 rounded-2xl p-6 col-span-2">
            <h2 className="text-md font-medium text-gray-100 mb-4" style={{ fontFamily: 'Fraunces, serif' }}>Soft Skills & Etiquette</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-[#16161d] rounded-lg p-3 text-center">
                <p className={`text-2xl font-bold ${empathyScore >= 4 ? 'text-emerald-400' : empathyScore >= 3 ? 'text-amber-400' : 'text-red-400'}`}>{empathyScore}</p>
                <p className="text-[10px] uppercase text-gray-500 mt-1">Empathy</p>
              </div>
              <div className="bg-[#16161d] rounded-lg p-3 text-center">
                <p className={`text-2xl font-bold ${listeningScore >= 4 ? 'text-emerald-400' : listeningScore >= 3 ? 'text-amber-400' : 'text-red-400'}`}>{listeningScore}</p>
                <p className="text-[10px] uppercase text-gray-500 mt-1">Active Listening</p>
              </div>
              <div className="bg-[#16161d] rounded-lg p-3 text-center">
                <p className={`text-2xl font-bold ${objectionScore >= 4 ? 'text-emerald-400' : objectionScore >= 3 ? 'text-amber-400' : 'text-red-400'}`}>{objectionScore}</p>
                <p className="text-[10px] uppercase text-gray-500 mt-1">Obj Handling</p>
              </div>
            </div>
          </div>
        </div>

        {/* Call Summary */}
        <div className="bg-[#0f0f14] border border-white/6 rounded-2xl p-7 mb-6">
          <h2 className="text-lg font-medium text-gray-100 mb-4" style={{ fontFamily: 'Fraunces, serif' }}>Call Summary</h2>
          <div className="bg-[#16161d] rounded-lg p-6">
            <p className="text-sm text-gray-300 leading-relaxed italic">
              "{finalSummary}"
            </p>
          </div>
        </div>

        {/* Transcript */}
        <div className="bg-[#0f0f14] border border-white/6 rounded-2xl overflow-hidden">
          <div className="flex justify-between items-center p-7">
            <h2 className="text-lg font-medium text-gray-100" style={{ fontFamily: 'Fraunces, serif' }}>Call Transcript</h2>
            <button
              onClick={() => setExpandTranscript(!expandTranscript)}
              className="flex items-center gap-2 px-4 py-2 bg-[#16161d] rounded-lg text-sm text-amber-400 hover:bg-[#1c1c25] transition"
            >
              <span>{expandTranscript ? 'Collapse' : 'Expand'}</span>
              {expandTranscript ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          {expandTranscript && (
            <div className="max-h-[500px] overflow-y-auto p-7 pt-0 space-y-6">
              {transcript.length > 0 ? transcript.map((msg, i) => (
                <div key={i} className="flex gap-4 pb-4 border-b border-gray-800 last:border-0">
                  <span className="font-mono text-xs text-gray-500 min-w-12 pt-1">{msg.Timestamp || ''}</span>
                  <div className="flex-1">
                    <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${msg.Speaker === 'Agent' ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {msg.Speaker}
                    </p>
                    <p className="text-sm text-gray-300 leading-relaxed">{msg.Text}</p>
                  </div>
                </div>
              )) : (
                <p className="text-sm text-gray-500 text-center py-8">No transcript available for this call.</p>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default AbcReportDetail;
