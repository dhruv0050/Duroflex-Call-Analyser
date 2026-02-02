import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Download, FileDown, ChevronDown, ChevronUp } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://duroflex-call-analyser.onrender.com';

// Expandable Details Component
const ExpandableCard = ({ title, subtitle, rating, ratingColor, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  const getRatingStyles = () => {
    const upper = (rating || '').toString().toUpperCase();
    if (upper.includes('HIGH') || parseInt(upper) >= 4) {
      return 'text-green-700 bg-green-100 border-green-300';
    }
    if (upper.includes('MEDIUM') || parseInt(upper) === 3) {
      return 'text-yellow-700 bg-yellow-100 border-yellow-300';
    }
    return 'text-red-700 bg-red-100 border-red-300';
  };

  return (
    <div className="bg-gray-50 border-2 border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full p-6 text-left transition ${isOpen ? 'bg-gray-100' : 'hover:bg-gray-100'}`}
      >
        <div className="flex justify-between items-center">
          <div>
            <p className="text-lg font-bold text-gray-900">{title}</p>
            {subtitle && <p className="text-sm text-gray-600 mt-0.5">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-3">
            {rating && (
              <span className={`text-base font-bold px-4 py-1.5 rounded-full border-2 ${getRatingStyles()}`}>
                {rating}
              </span>
            )}
            <span className="text-gray-400 text-xl font-bold">{isOpen ? '−' : '+'}</span>
          </div>
        </div>
      </button>
      {isOpen && (
        <div className="px-6 pb-6 text-base text-gray-700 border-t-2 border-gray-200 pt-4">
          {children}
        </div>
      )}
    </div>
  );
};

// Info Card with Tooltip
const InfoCard = ({ label, value, valueColor, tooltip, children }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  
  const getValueColor = () => {
    const upper = (value || '').toString().toUpperCase();
    if (upper.includes('HIGH')) return 'text-green-600';
    if (upper.includes('MEDIUM')) return 'text-yellow-600';
    if (upper.includes('LOW')) return 'text-red-600';
    return valueColor || 'text-blue-600';
  };

  const getScoreDot = () => {
    const upper = (value || '').toString().toUpperCase();
    if (upper.includes('HIGH')) return 'bg-green-500';
    if (upper.includes('MEDIUM')) return 'bg-yellow-500';
    if (upper.includes('LOW')) return 'bg-red-500';
    return 'bg-blue-500';
  };

  return (
    <div 
      className="relative bg-gray-50 border-2 border-gray-200 rounded-xl p-6 hover:border-blue-400 transition cursor-pointer"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {tooltip && showTooltip && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 -translate-y-3 bg-gray-800 border border-gray-700 px-4 py-3 rounded-lg text-sm text-gray-100 whitespace-normal w-max max-w-xs z-50 shadow-xl">
          {tooltip}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-8 border-transparent border-t-gray-800"></div>
        </div>
      )}
      <p className="text-sm text-gray-600 font-bold uppercase tracking-wider mb-3">{label}</p>
      {children || (
        <div className="flex items-center">
          <span className={`inline-block w-2.5 h-2.5 rounded-full ${getScoreDot()} mr-2`}></span>
          <span className={`text-2xl font-bold ${getValueColor()}`}>{value}</span>
        </div>
      )}
    </div>
  );
};

const CallReportDetail = () => {
  const { callId } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandTranscript, setExpandTranscript] = useState(false);
  const [expandedHooks, setExpandedHooks] = useState({});

  useEffect(() => {
    fetchReport();
  }, [callId]);

  const fetchReport = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/GmbCalls/${callId}`);
      if (!res.ok) throw new Error('Failed to load report');
      const data = await res.json();
      setReport(data.report);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = () => {
    if (!report) return;

    const analysis = report.analysis || {};
    const functional = analysis.Functional || {};
    const customer = analysis.Customer_Information || {};
    const agent = analysis.Agent_Areas || {};
    const summary = analysis.Overall_Summary || {};
    const relax = agent.RELAX_Framework || {};
    const softSkills = agent.SoftSkills_Etiquette || {};
    const knowledge = agent.Verbal_Product_Knowledge || {};
    const invitation = agent.The_Invitation_to_Visit || {};

    const headers = [
      'Call_ID', 'Store_Name', 'City', 'State', 'Region', 'Date', 'Duration_Seconds',
      'Customer_Name', 'Agent_Name', 'Is_Converted',
      'Call_Objective', 'Interest_Category', 'Specific_Product',
      'Intent_to_Visit', 'Intent_to_Purchase', 'Customer_Stage_AIDA',
      'Customer_Satisfaction_Score', 'Barriers_to_Conversion',
      'R_Reach_Out_Rating', 'E_Explore_Needs_Rating', 'L_Link_Experience_Rating',
      'A_Add_Value_Rating', 'X_Express_Closing_Rating',
      'Product_Description_Quality', 'Stock_Availability_Check',
      'Invitation_Attempted', 'Invitation_Quality',
      'Tone_and_Patience', 'Hold_Management', 'Language_Fluency',
      'Call_Synopsis', 'Agent_Performance', 'Next_Action'
    ];

    const row = [
      report.call_id,
      report.store_name,
      report.city,
      report.state,
      report.region,
      report.call_date,
      report.duration_seconds,
      functional.Customer_Name || '',
      functional.Agent_Name || '',
      report.is_converted ? 'Yes' : 'No',
      functional.Call_Objective_Theme || '',
      customer.Interest_Category || '',
      customer.Specific_Product_Inquiry || '',
      customer.Intent_to_Visit_Rating || '',
      customer.Intent_to_Purchase_Rating || '',
      customer.Customer_Stage_AIDA || '',
      customer.Customer_Satisfaction_Score || '',
      customer.Barriers_to_Conversion || '',
      relax.R_Reach_Out?.Rating || '',
      relax.E_Explore_Needs?.Rating || relax.E_Explore?.Rating || '',
      relax.L_Link_Experience?.Rating || '',
      relax.A_Add_Value?.Rating || '',
      relax.X_Express_Closing?.Rating || '',
      knowledge.Description_Quality_Rating || '',
      knowledge.Stock_Availability_Check_Rating || '',
      invitation.Attempted ? 'Yes' : 'No',
      invitation.Quality_Rating || '',
      softSkills.Tone_and_Patience_Rating || '',
      softSkills.Hold_Management_Rating || '',
      softSkills.Agent_Language_Fluency_Score || '',
      (summary.Call_Synopsis || '').replace(/,/g, ';').replace(/\n/g, ' '),
      (summary.Agent_Performance_Summary || '').replace(/,/g, ';').replace(/\n/g, ' '),
      summary.Next_Action || ''
    ];

    const escapeCSVField = (field) => {
      const str = String(field);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvContent = [
      headers.join(','),
      row.map(escapeCSVField).join(',')
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `call_report_${report.call_id}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const downloadTranscript = () => {
    if (!report) return;

    const analysis = report.analysis || {};
    const transcript = analysis.Transcript_Log || [];
    const functional = analysis.Functional || {};

    if (transcript.length === 0) {
      alert('No transcript available for this call');
      return;
    }

    let textContent = `CALL TRANSCRIPT\n`;
    textContent += `${'='.repeat(80)}\n\n`;
    textContent += `Call ID: ${report.call_id}\n`;
    textContent += `Store: ${report.store_name}\n`;
    textContent += `Date: ${report.call_date}\n`;
    textContent += `Duration: ${Math.floor(report.duration_seconds / 60)}:${(report.duration_seconds % 60).toString().padStart(2, '0')}\n`;
    textContent += `Customer: ${functional.Customer_Name || 'Unknown'}\n`;
    textContent += `Agent: ${functional.Agent_Name || 'Unknown'}\n`;
    textContent += `Location: ${report.city}, ${report.state}\n\n`;
    textContent += `${'='.repeat(80)}\n\n`;

    transcript.forEach((entry, index) => {
      const timestamp = entry.Timestamp || `${index + 1}`;
      const speaker = entry.Speaker || 'Unknown';
      const text = entry.Text || '';
      textContent += `[${timestamp}] ${speaker}:\n`;
      textContent += `${text}\n\n`;
    });

    textContent += `${'='.repeat(80)}\n`;
    textContent += `End of Transcript\n`;

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `call_transcript_${report.call_id}.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // Helper functions
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
  };

  const getRatingText = (rating) => {
    if (!rating) return 'N/A';
    if (typeof rating === 'number') {
      if (rating >= 4) return 'HIGH';
      if (rating >= 3) return 'MEDIUM';
      return 'LOW';
    }
    return rating.toString().toUpperCase();
  };

  const getScoreDotClass = (rating) => {
    const upper = getRatingText(rating);
    if (upper.includes('HIGH')) return 'bg-green-500';
    if (upper.includes('MEDIUM')) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getRelaxOverallRating = (relax) => {
    const ratingToScore = (rating) => {
      const r = getRatingText(rating).toUpperCase();
      if (r === 'HIGH') return 3;
      if (r === 'MEDIUM') return 2;
      if (r === 'LOW') return 1;
      return 0;
    };

    const scores = [
      ratingToScore(relax.R_Reach_Out?.Rating),
      ratingToScore(relax.E_Explore_Needs?.Rating || relax.E_Explore?.Rating),
      ratingToScore(relax.L_Link_Experience?.Rating),
      ratingToScore(relax.A_Add_Value?.Rating),
      ratingToScore(relax.X_Express_Closing?.Rating)
    ].filter(s => s > 0);
    
    if (scores.length === 0) return 'N/A';
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    return avg.toFixed(2);
  };

  const getFunnelStageIndex = (stage) => {
    const stages = ['Awareness', 'Interest', 'Desire', 'Action'];
    const idx = stages.findIndex(s => s.toLowerCase() === (stage || '').toLowerCase());
    return idx >= 0 ? idx : 0;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600 text-lg">Loading call report...</div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4 text-lg">{error || 'Report not found'}</p>
          <Link to="/GmbCalls" className="text-blue-600 hover:text-blue-700 font-semibold inline-flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to Reports
          </Link>
        </div>
      </div>
    );
  }

  const analysis = report.analysis || {};
  const hasError = analysis.error;

  if (hasError) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <Link to="/GmbCalls" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Reports
        </Link>
        <div className="max-w-4xl mx-auto bg-white border-2 border-gray-200 rounded-xl p-8 shadow-lg">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">{report.store_name}</h1>
          <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6">
            <p className="text-red-700">⚠️ Analysis Error: {analysis.error}</p>
          </div>
        </div>
      </div>
    );
  }

  const functional = analysis.Functional || {};
  const customer = analysis.Customer_Information || {};
  const agent = analysis.Agent_Areas || {};
  const summary = analysis.Overall_Summary || {};
  const transcript = analysis.Transcript_Log || [];
  const relax = agent.RELAX_Framework || {};
  const softSkills = agent.SoftSkills_Etiquette || {};
  const knowledge = agent.Verbal_Product_Knowledge || {};
  const invitation = agent.The_Invitation_to_Visit || {};

  const funnelStages = ['Awareness', 'Consideration', 'Action'];
  const currentStageIndex = getFunnelStageIndex(customer.Customer_Stage_AIDA);

  // Map AIDA stage to funnel index
  const mapAidaToFunnel = () => {
    const stage = (customer.Customer_Stage_AIDA || '').toLowerCase();
    if (stage === 'action') return 2;
    if (stage === 'desire' || stage === 'interest') return 1;
    return 0;
  };

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="max-w-[1600px] mx-auto px-8 py-10 relative z-10">
        
        {/* Navigation */}
        <div className="flex items-center justify-between mb-10">
          <Link 
            to="/GmbCalls" 
            className="text-base font-medium text-gray-600 hover:text-gray-900 transition tracking-wide"
          >
            ← BACK TO STORE CALLS
          </Link>
          <div className="flex gap-4">
            <span className="inline-flex items-center px-5 py-2.5 bg-white rounded-lg text-base text-gray-600 border border-gray-300 font-mono tracking-wider shadow-sm">
              ID: {report.call_id}
            </span>
            {(report.driveLink || report.recording_url) && (
              <a
                href={report.driveLink || report.recording_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-base font-bold transition tracking-wide shadow-md"
              >
                📞 LISTEN TO CALL
              </a>
            )}
          </div>
        </div>

        {/* HEADER: Metadata & Summary */}
        <div className="bg-white border-2 border-gray-200 rounded-2xl p-10 mb-10 shadow-lg">
          <div className="border-l-4 border-blue-500 pl-5 mb-8">
            <h1 className="text-4xl font-bold text-gray-900" style={{ fontFamily: "'Fraunces', serif" }}>
              Store Call Analysis
            </h1>
            <p className="text-base text-gray-500 mt-2">
              GMB Inbound • {functional.Agent_Name || 'Unknown Agent'} ({functional.Store_Location || report.store_name})
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* Col 1: Identity & Metadata */}
            <div className="lg:col-span-4 border-r border-gray-200 pr-8">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <span className="font-mono text-sm text-gray-500 tracking-widest uppercase">Customer</span>
                  <h2 className="text-3xl font-semibold text-gray-900 mt-1" style={{ fontFamily: "'Fraunces', serif" }}>
                    {functional.Customer_Name || 'Unknown'}
                  </h2>
                </div>
                <span className="bg-green-100 text-green-700 text-sm font-bold px-4 py-1.5 rounded-full border border-green-200 uppercase">
                  Connected
                </span>
              </div>
              
              <div className="space-y-4 text-base">
                <div>
                  <span className="text-xs text-gray-500 uppercase tracking-wider font-bold block mb-1">Location & Language</span>
                  <span className="text-gray-900 font-medium text-lg">
                    {report.city}, {report.state} • {functional.Customer_Language || 'English'}
                  </span>
                </div>
                
                <div>
                  <span className="text-xs text-blue-600 uppercase tracking-wider font-bold block mb-1">Interest Category</span>
                  <span className="text-blue-600 text-3xl font-bold">{customer.Interest_Category || 'General'}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <span className="text-xs text-gray-500 uppercase tracking-wider font-bold block mb-1">Duration</span>
                    <span className="font-mono text-lg text-gray-900">{formatDuration(report.duration_seconds)}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 uppercase tracking-wider font-bold block mb-1">Timeline</span>
                    <span className="text-lg font-bold text-green-600">{customer.Timeline_to_Purchase || 'Unknown'}</span>
                  </div>
                </div>

                <div className="mt-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <span className="text-xs text-gray-500 uppercase tracking-wider font-bold block mb-1">Call Quality</span>
                  <div className="flex items-center gap-2">
                    <span className={`inline-block w-2.5 h-2.5 rounded-full ${getScoreDotClass(functional.Agent_Audio_Quality_Rating)}`}></span>
                    <span className="text-base font-bold text-gray-700">{getRatingText(functional.Agent_Audio_Quality_Rating)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Col 2: Call Summary */}
            <div className="lg:col-span-8 pl-4 flex flex-col justify-center">
              <div className="mb-5">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-2">Call Objective</span>
                <h3 className="text-2xl text-gray-900 font-semibold" style={{ fontFamily: "'Fraunces', serif" }}>
                  {functional.Call_Objective_Theme || 'General Inquiry'} • {customer.Specific_Product_Inquiry || 'Product Inquiry'}
                </h3>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-8">
                <span className="text-xs font-bold text-blue-700 uppercase tracking-widest block mb-3">Executive Summary</span>
                <p className="text-lg text-gray-700 leading-relaxed font-medium">
                  {summary.Call_Synopsis || 'No summary available for this call.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 1: Critical Sales Metrics */}
        <div className="bg-white border-2 border-gray-200 rounded-2xl p-8 mb-10 shadow-lg">
          <div className="mb-8 border-b-2 border-gray-200 pb-4">
            <h2 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Fraunces', serif" }}>
              Critical Sales Intelligence
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
            <InfoCard 
              label="Intent to Purchase" 
              value={
                customer.Barriers_to_Conversion?.toLowerCase().includes('already purchased') ||
                customer.Barriers_to_Conversion?.toLowerCase().includes('issue resolved over the phone') ||
                customer.Barriers_to_Conversion?.toLowerCase().includes('delivery delay') ||
                customer.Barriers_to_Conversion?.toLowerCase().includes('already placed') ||
                customer.Intent_to_Purchase_Rating_Reasons?.[0]?.toLowerCase().includes('already placed') ||
                customer.Intent_to_Purchase_Rating_Reasons?.[0]?.toLowerCase().includes('awaiting delivery')
                  ? 'Already Purchased'
                  : (customer.Intent_to_Purchase_Rating || 'Unknown')
              }
              tooltip={customer.Intent_to_Purchase_Rating_Reasons?.[0] || 'No details available'}
            />
            <InfoCard 
              label="Customer Experience" 
              value={getRatingText(customer.Customer_Satisfaction_Score)}
              tooltip={customer.Customer_Satisfaction_Score_Reasons?.[0] || 'No details available'}
            />
            <InfoCard 
              label="Purchase Timeline" 
              value={customer.Timeline_to_Purchase || 'Unknown'}
              valueColor="text-blue-600"
              tooltip="Customer's expected purchase timeframe"
            />
            <InfoCard 
              label="Funnel Stage" 
              value={customer.Customer_Stage_AIDA || 'Awareness'}
              valueColor="text-blue-600"
              tooltip="Customer's position in the AIDA sales funnel"
            />
          </div>

          {/* Funnel Visual */}
          <div className="flex items-center gap-1 mb-8">
            {funnelStages.map((stage, i) => (
              <div 
                key={stage}
                className={`relative flex items-center justify-center py-3 px-6 text-sm font-bold uppercase tracking-wider border
                  ${i === 0 ? 'rounded-l-lg' : ''} 
                  ${i === funnelStages.length - 1 ? 'rounded-r-lg' : ''}
                  ${i <= mapAidaToFunnel() 
                    ? 'bg-gradient-to-r from-green-500 to-green-600 text-white border-green-600 shadow-md' 
                    : 'bg-gray-100 text-gray-500 border-gray-200'
                  }`}
                style={{
                  clipPath: i === 0 
                    ? 'polygon(0% 0%, 90% 0%, 100% 50%, 90% 100%, 0% 100%)'
                    : i === funnelStages.length - 1
                    ? 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 10% 50%)'
                    : 'polygon(0% 0%, 90% 0%, 100% 50%, 90% 100%, 0% 100%, 10% 50%)'
                }}
              >
                {stage}
              </div>
            ))}
          </div>

          {/* Barrier Analysis */}
          {customer.Barriers_to_Conversion && customer.Barriers_to_Conversion !== 'N/A' && (
            <div className="bg-red-50 border-2 border-red-300 rounded-xl p-6">
              <div className="flex items-start gap-4">
                <span className="text-3xl">🛡️</span>
                <div className="flex-1">
                  <p className="text-base font-bold text-red-600 uppercase tracking-wider mb-2">
                    Primary Barrier: {customer.Barriers_to_Conversion}
                  </p>
                  <p className="text-lg text-gray-700 leading-relaxed">
                    {customer.Intent_to_Purchase_Rating_Reasons?.join(' ') || 'Customer faced barriers during the call that may affect conversion.'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 2: Store Visit & Invitations */}
        <div className="bg-white border-2 border-gray-200 rounded-2xl p-8 mb-10 shadow-lg">
          <div className="mb-8 border-b-2 border-gray-200 pb-4 flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Fraunces', serif" }}>
              Invitations & Channel Strategy
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Store Visit Pitch */}
            {(() => {
              const storeVisitRating = invitation.Attempted ? getRatingText(invitation.Quality_Rating) : 'LOW';
              const storeVisitExpanded = expandedHooks['StoreVisitPitch'] || false;
              
              return (
                <div className="bg-gray-50 border-2 border-gray-200 rounded-lg overflow-hidden">
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`inline-block w-3 h-3 rounded-full ${
                            storeVisitRating === 'HIGH' ? 'bg-green-500' : 
                            storeVisitRating === 'MEDIUM' ? 'bg-yellow-500' : 'bg-red-500'
                          }`}></span>
                          <p className="text-lg font-bold text-gray-900">Store Visit Pitch</p>
                        </div>
                        <p className={`text-2xl font-bold ${
                          storeVisitRating === 'HIGH' ? 'text-green-600' : 
                          storeVisitRating === 'MEDIUM' ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {storeVisitRating}
                        </p>
                      </div>
                      <button 
                        className="text-gray-400 hover:text-gray-600 text-2xl font-bold transition ml-4"
                        onClick={() => setExpandedHooks(prev => ({
                          ...prev,
                          StoreVisitPitch: !prev.StoreVisitPitch
                        }))}
                      >
                        {storeVisitExpanded ? '−' : '+'}
                      </button>
                    </div>
                  </div>
                  {storeVisitExpanded && (
                    <div className="px-6 pb-6 pt-2 border-t-2 border-gray-200 bg-white">
                      <strong className={`text-sm uppercase block mb-2 ${invitation.Attempted ? 'text-green-700' : 'text-red-700'}`}>
                        Assessment:
                      </strong>
                      <p className="text-sm text-gray-700">
                        {invitation.Reasons?.join(' ') || (invitation.Attempted 
                          ? 'Agent attempted to invite the customer to visit the store.'
                          : 'Agent did not attempt to invite the customer to visit the store.'
                        )}
                      </p>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Video Demo Offer */}
            {(() => {
              const videoDemoRating = customer.Intent_to_Visit_Rating || 'N/A';
              const videoDemoExpanded = expandedHooks['VideoDemoOffer'] || false;
              
              return (
                <div className="bg-gray-50 border-2 border-gray-200 rounded-lg overflow-hidden">
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`inline-block w-3 h-3 rounded-full ${
                            videoDemoRating === 'HIGH' ? 'bg-green-500' : 
                            videoDemoRating === 'MEDIUM' ? 'bg-yellow-500' : 'bg-red-500'
                          }`}></span>
                          <p className="text-lg font-bold text-gray-900">Video Demo Offer</p>
                        </div>
                        <p className={`text-2xl font-bold ${
                          videoDemoRating === 'HIGH' ? 'text-green-600' : 
                          videoDemoRating === 'MEDIUM' ? 'text-yellow-600' : 
                          videoDemoRating === 'N/A' ? 'text-gray-600' : 'text-red-600'
                        }`}>
                          {videoDemoRating}
                        </p>
                      </div>
                      <button 
                        className="text-gray-400 hover:text-gray-600 text-2xl font-bold transition ml-4"
                        onClick={() => setExpandedHooks(prev => ({
                          ...prev,
                          VideoDemoOffer: !prev.VideoDemoOffer
                        }))}
                      >
                        {videoDemoExpanded ? '−' : '+'}
                      </button>
                    </div>
                  </div>
                  {videoDemoExpanded && (
                    <div className="px-6 pb-6 pt-2 border-t-2 border-gray-200 bg-white">
                      <strong className="text-gray-600 text-sm uppercase block mb-2">Assessment:</strong>
                      <p className="text-sm text-gray-700">
                        {customer.Intent_to_Visit_Rating_Reasons?.join(' ') || 'No assessment available for video demo offer.'}
                      </p>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Conversion Hooks Utilized Section */}
        <div className="bg-white border-2 border-gray-200 rounded-2xl p-8 mb-10 shadow-lg">
          <div className="mb-8 border-b-2 border-gray-200 pb-4">
            <h2 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Fraunces', serif" }}>
              Conversion Hooks Utilized
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {(() => {
              // Define conversion hooks - check if they exist in analysis or use defaults
              const hooks = [
                { 
                  key: 'Warranty', 
                  label: 'WARRANTY',
                  icon: '✓',
                  // Check various possible locations for warranty mention
                  used: summary.Call_Synopsis?.toLowerCase().includes('warranty') ||
                        agent.RELAX_Framework?.A_Add_Value?.Reasons?.some(r => r.toLowerCase().includes('warranty')) ||
                        false,
                  assessment: summary.Call_Synopsis?.toLowerCase().includes('warranty') || agent.RELAX_Framework?.A_Add_Value?.Reasons?.some(r => r.toLowerCase().includes('warranty'))
                    ? 'Agent mentioned warranty during the call.'
                    : 'Agent did not mention warranty during the call.'
                },
                { 
                  key: 'Brochure', 
                  label: 'BROCHURE',
                  icon: '✓',
                  used: summary.Call_Synopsis?.toLowerCase().includes('brochure') ||
                        summary.Call_Synopsis?.toLowerCase().includes('details') ||
                        summary.Call_Synopsis?.toLowerCase().includes('catalog') ||
                        false,
                  assessment: summary.Call_Synopsis?.toLowerCase().includes('brochure') || summary.Call_Synopsis?.toLowerCase().includes('details') || summary.Call_Synopsis?.toLowerCase().includes('catalog')
                    ? 'Agent offered brochure or catalog during the call.'
                    : 'Agent did not mention brochure during the call.'
                },
                { 
                  key: 'Measurement', 
                  label: 'MEASUREMENT',
                  icon: '✗',
                  used: summary.Call_Synopsis?.toLowerCase().includes('measurement') ||
                        summary.Call_Synopsis?.toLowerCase().includes('measure') ||
                        summary.Call_Synopsis?.toLowerCase().includes('size') ||
                        false,
                  assessment: summary.Call_Synopsis?.toLowerCase().includes('measurement') || summary.Call_Synopsis?.toLowerCase().includes('measure') || summary.Call_Synopsis?.toLowerCase().includes('size')
                    ? 'Agent discussed measurement services during the call.'
                    : 'Agent did not mention measurement services during the call.'
                },
                { 
                  key: 'Sleep_Trial', 
                  label: 'SLEEP TRIAL',
                  icon: '✗',
                  used: summary.Call_Synopsis?.toLowerCase().includes('trial') ||
                        summary.Call_Synopsis?.toLowerCase().includes('sleep trial') ||
                        false,
                  assessment: summary.Call_Synopsis?.toLowerCase().includes('trial') || summary.Call_Synopsis?.toLowerCase().includes('sleep trial')
                    ? 'Agent mentioned sleep trial during the call.'
                    : 'Agent did not mention sleep trial during the call.'
                },
                { 
                  key: 'Offers', 
                  label: 'OFFERS',
                  icon: '✓',
                  used: summary.Call_Synopsis?.toLowerCase().includes('offer') ||
                        summary.Call_Synopsis?.toLowerCase().includes('discount') ||
                        summary.Call_Synopsis?.toLowerCase().includes('promotion') ||
                        agent.RELAX_Framework?.A_Add_Value?.Reasons?.some(r => r.toLowerCase().includes('offer')) ||
                        false,
                  assessment: summary.Call_Synopsis?.toLowerCase().includes('offer') || summary.Call_Synopsis?.toLowerCase().includes('discount') || summary.Call_Synopsis?.toLowerCase().includes('promotion') || agent.RELAX_Framework?.A_Add_Value?.Reasons?.some(r => r.toLowerCase().includes('offer'))
                    ? 'Agent mentioned offers or discounts during the call.'
                    : 'Agent did not mention offers during the call.'
                }
              ];

              return hooks.map((hook) => (
                <div key={hook.key} className="bg-gray-50 border-2 border-gray-200 rounded-lg overflow-hidden hover:border-gray-300 transition">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`${hook.used ? 'text-green-600' : 'text-red-600'} font-bold text-xl`}>
                          {hook.used ? '✓' : '✗'}
                        </span>
                        <span className="text-sm text-gray-600 font-bold uppercase tracking-wider">{hook.label}</span>
                      </div>
                      <button 
                        className="text-gray-400 hover:text-gray-600 text-xl font-bold transition"
                        onClick={() => setExpandedHooks(prev => ({
                          ...prev,
                          [hook.key]: !prev[hook.key]
                        }))}
                      >
                        {expandedHooks[hook.key] ? '−' : '+'}
                      </button>
                    </div>
                    <p className={`text-lg font-semibold ${hook.used ? 'text-green-600' : 'text-red-600'}`}>
                      {hook.used ? 'YES' : 'NO'}
                    </p>
                  </div>
                  {expandedHooks[hook.key] && (
                    <div className="px-6 pb-6 pt-2 border-t-2 border-gray-200 bg-white">
                      <p className="text-sm text-gray-700">
                        {hook.assessment}
                      </p>
                    </div>
                  )}
                </div>
              ));
            })()}
          </div>
        </div>

        {/* SECTION 3: Product Intelligence & Customer Needs */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
          {/* Product Intelligence */}
          <div className="bg-white border-2 border-gray-200 rounded-2xl p-8 shadow-lg">
            <div className="mb-6 border-b-2 border-gray-200 pb-4">
              <h2 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Fraunces', serif" }}>
                Product Intelligence
              </h2>
            </div>

            <div className="space-y-6">
              {/* Narrow Down Stage */}
              <div>
                <p className="text-sm text-gray-600 font-bold uppercase tracking-wider mb-4">Narrow Down Stage</p>
                <div className="flex items-center gap-1">
                  {(() => {
                    // Determine which stage to highlight based on specificity
                    let currentStage = 0; // Default: Category
                    const specificProduct = customer.Specific_Product_Inquiry || 'General';
                    
                    if (specificProduct !== 'General' && specificProduct.toLowerCase().includes('specific')) {
                      currentStage = 2; // Specific SKU
                    } else if (specificProduct !== 'General') {
                      currentStage = 1; // Range
                    }
                    
                    return (
                      <>
                        <div 
                          className={`relative flex items-center justify-center py-3 px-6 text-sm font-bold uppercase tracking-wider border ${
                            currentStage >= 0
                              ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white border-blue-600 shadow-md'
                              : 'bg-gray-100 text-gray-500 border-gray-300'
                          }`}
                          style={{ clipPath: 'polygon(0% 0%, 85% 0%, 100% 50%, 85% 100%, 0% 100%)' }}
                        >
                          Category
                        </div>
                        <div 
                          className={`relative flex items-center justify-center py-3 px-6 text-sm font-bold uppercase tracking-wider border ${
                            currentStage >= 1
                              ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white border-blue-600 shadow-md'
                              : 'bg-gray-100 text-gray-500 border-gray-300'
                          }`}
                          style={{ clipPath: 'polygon(0% 0%, 85% 0%, 100% 50%, 85% 100%, 0% 100%, 15% 50%)' }}
                        >
                          Range
                        </div>
                        <div 
                          className={`relative flex items-center justify-center py-3 px-6 text-sm font-bold uppercase tracking-wider border ${
                            currentStage >= 2
                              ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white border-blue-600 shadow-md'
                              : 'bg-gray-100 text-gray-500 border-gray-300'
                          }`}
                          style={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 15% 50%)' }}
                        >
                          Specific SKU
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-300 rounded-lg p-5">
                <p className="text-sm text-gray-600 font-bold uppercase tracking-wider mb-2">Product of Interest</p>
                <span className="text-lg font-semibold text-gray-900">
                  {customer.Interest_Category || 'General'} / {customer.Specific_Product_Inquiry || 'Not specified'}
                </span>
              </div>

              <div className="bg-gray-50 border border-gray-300 rounded-lg p-5">
                <p className="text-sm text-gray-600 font-bold uppercase tracking-wider mb-2">Decision Maker</p>
                <span className="text-lg font-semibold text-gray-900">
                  {functional.Customer_Name && functional.Customer_Name !== 'Unknown' && functional.Customer_Name !== 'Not mentioned'
                    ? `${functional.Customer_Name} (Caller)`
                    : 'Sole Decision Maker (Caller)'}
                </span>
              </div>
            </div>
          </div>

          {/* Customer Needs Profile - Replaced Questions */}
          <div className="bg-white border-2 border-gray-200 rounded-2xl p-8 shadow-lg">
            <div className="mb-6 border-b-2 border-gray-200 pb-4">
              <h2 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Fraunces', serif" }}>
                Customer Needs Profile
              </h2>
            </div>

            <div className="bg-gray-50 border-2 border-gray-300 rounded-lg p-6 space-y-5">
              {/* For Whom */}
              {customer.Primary_Questions_Asked && customer.Primary_Questions_Asked.length > 0 && (
                <div>
                  <span className="text-blue-600 font-bold text-base">For Whom:</span>
                  <span className="text-gray-800 text-base ml-2">
                    {functional.Customer_Name && functional.Customer_Name !== 'Unknown' && functional.Customer_Name !== 'Not mentioned'
                      ? functional.Customer_Name
                      : 'Self'}
                  </span>
                </div>
              )}

              {/* Medical Condition / Context (from barriers or questions) */}
              {customer.Barriers_to_Conversion && customer.Barriers_to_Conversion !== 'N/A' && (
                <div>
                  <span className="text-blue-600 font-bold text-base">Primary Concern:</span>
                  <span className="text-gray-800 text-base ml-2">{customer.Barriers_to_Conversion}</span>
                </div>
              )}

              {/* Requirement (from questions) */}
              {customer.Primary_Questions_Asked && customer.Primary_Questions_Asked.length > 0 && (
                <div>
                  <span className="text-blue-600 font-bold text-base">Requirement:</span>
                  <span className="text-gray-800 text-base ml-2">
                    {customer.Primary_Questions_Asked.join('. ')}
                  </span>
                </div>
              )}

              {/* Timeline */}
              {customer.Timeline_to_Purchase && (
                <div>
                  <span className="text-blue-600 font-bold text-base">Purchase Timeline:</span>
                  <span className="text-gray-800 text-base ml-2">{customer.Timeline_to_Purchase}</span>
                </div>
              )}

              {/* Key Constraint */}
              {(customer.Intent_to_Purchase_Rating_Reasons || customer.Intent_to_Visit_Rating_Reasons) && (
                <div>
                  <span className="text-blue-600 font-bold text-base">Key Constraint:</span>
                  <span className="text-gray-800 text-base ml-2">
                    {customer.Intent_to_Purchase_Rating_Reasons?.[0] || 
                     customer.Intent_to_Visit_Rating_Reasons?.[0] || 
                     'None specified'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 4: RELAX Framework & Agent Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-10">
          
          {/* RELAX Framework */}
          <div className="lg:col-span-7 bg-white border-2 border-gray-200 rounded-2xl p-8 shadow-lg">
            <div className="mb-8 border-b-2 border-gray-200 pb-4 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Fraunces', serif" }}>
                RELAX Framework
              </h2>
              <span className={`text-4xl font-bold ${
                parseFloat(getRelaxOverallRating(relax)) >= 0.75 ? 'text-green-600' : 
                parseFloat(getRelaxOverallRating(relax)) >= 0.50 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {getRelaxOverallRating(relax) !== 'N/A' ? `${getRelaxOverallRating(relax)}/3` : 'N/A'}
              </span>
            </div>

            <div className="space-y-4">
              {[
                { key: 'R', title: 'R — Reach Out', subtitle: 'Greeting & Brand', data: relax.R_Reach_Out },
                { key: 'E', title: 'E — Explore Needs', subtitle: 'Discovery', data: relax.E_Explore_Needs || relax.E_Explore },
                { key: 'L', title: 'L — Link Product', subtitle: 'Link to Needs', data: relax.L_Link_Experience },
                { key: 'A', title: 'A — Add Value', subtitle: 'Offers/Accessories', data: relax.A_Add_Value },
                { key: 'X', title: 'X — Express Closing', subtitle: 'Next Steps', data: relax.X_Express_Closing },
              ].map((item) => (
                <ExpandableCard
                  key={item.key}
                  title={item.title}
                  subtitle={item.subtitle}
                  rating={getRatingText(item.data?.Rating)}
                >
                  <strong className={`text-sm uppercase block mb-1 ${
                    (item.data?.Rating || 0) >= 4 ? 'text-green-700' :
                    (item.data?.Rating || 0) >= 3 ? 'text-yellow-700' : 'text-red-700'
                  }`}>Reason:</strong>
                  {item.data?.Reasons?.join(' ') || 'No details available.'}
                </ExpandableCard>
              ))}
            </div>
          </div>

          {/* Agent Scorecard */}
          <div className="lg:col-span-5 bg-white border-2 border-gray-200 rounded-2xl p-8 shadow-lg">
            <div className="mb-8 border-b-2 border-gray-200 pb-4">
              <h2 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Fraunces', serif" }}>
                Agent Scorecard
              </h2>
            </div>

            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Product Knowledge</h3>
            <div className="space-y-4 mb-8">
              <ExpandableCard
                title="Description Quality"
                rating={getRatingText(knowledge.Description_Quality_Rating)}
              >
                {knowledge.Description_Quality_Reason || 'No assessment available.'}
              </ExpandableCard>

              <ExpandableCard
                title="Stock Availability Check"
                rating={getRatingText(knowledge.Stock_Availability_Check_Rating)}
              >
                {knowledge.Stock_Availability_Check_Reason || 'No assessment available.'}
              </ExpandableCard>
            </div>

            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 pt-4 border-t border-gray-200">
              Soft Skills & Etiquette
            </h3>
            <div className="space-y-4">
              <ExpandableCard
                title="Tone & Patience"
                rating={getRatingText(softSkills.Tone_and_Patience_Rating)}
              >
                {softSkills.Soft_Skills_Reasons?.[0] || 'No details available.'}
              </ExpandableCard>

              <ExpandableCard
                title="Hold Management"
                rating={getRatingText(softSkills.Hold_Management_Rating)}
              >
                {softSkills.Soft_Skills_Reasons?.[1] || 'No details available.'}
              </ExpandableCard>

              <ExpandableCard
                title="Language Fluency"
                rating={getRatingText(softSkills.Agent_Language_Fluency_Score)}
              >
                {softSkills.Soft_Skills_Reasons?.[2] || 'No details available.'}
              </ExpandableCard>
            </div>
          </div>
        </div>

        {/* SECTION 5: Learnings & Next Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
          
          {/* Agent Learnings / Improvement Areas */}
          {agent.Top_3_Improvement_Areas && agent.Top_3_Improvement_Areas.length > 0 && (
            <div className="bg-white border-2 border-gray-200 rounded-2xl p-8 shadow-lg">
              <div className="mb-8 border-b-2 border-gray-200 pb-4">
                <h2 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Fraunces', serif" }}>
                  Agent Learnings
                </h2>
              </div>

              <div className="space-y-4">
                {agent.Top_3_Improvement_Areas.map((area, i) => (
                  <ExpandableCard
                    key={i}
                    title={`${i + 1}. ${area.split(':')[0] || area.substring(0, 40)}`}
                    rating={i === 0 ? 'PRIORITY' : undefined}
                  >
                    <strong className="text-yellow-700 block mb-1 text-sm uppercase tracking-wide">Feedback:</strong>
                    {area}
                  </ExpandableCard>
                ))}
              </div>
            </div>
          )}

          {/* Next Actions & NPS */}
          <div className="bg-white border-2 border-gray-200 rounded-2xl p-8 shadow-lg">
            <div className="mb-8 border-b-2 border-gray-200 pb-4">
              <h2 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Fraunces', serif" }}>
                Closing Intelligence
              </h2>
            </div>

            <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-6 mb-8">
              <p className="text-sm text-blue-700 font-bold uppercase tracking-wider mb-4">Next Actions</p>
              <p className="text-lg text-gray-700 leading-relaxed font-semibold">
                {summary.Next_Action || 'No specific next action defined.'}
              </p>
            </div>

            <div className="bg-gradient-to-br from-green-100 to-green-50 border-2 border-green-400 rounded-xl p-8 text-center">
              <p className="text-sm text-green-700 font-bold uppercase tracking-wider mb-4">NPS Estimation</p>
              <div className="text-6xl font-bold text-green-700 mb-4">
                {(() => {
                  const score = customer.Customer_Satisfaction_Score || 3;
                  // Convert 1-5 scale to NPS scale (0-10): multiply by 2
                  const nps = Math.min(10, Math.round(score * 2));
                  return nps;
                })()}
              </div>
              <p className="text-base font-bold text-green-700 uppercase tracking-wide mb-4">
                {(() => {
                  const score = customer.Customer_Satisfaction_Score || 3;
                  const nps = Math.min(10, Math.round(score * 2));
                  if (nps >= 9) return 'PROMOTER';
                  if (nps >= 7) return 'PASSIVE / PROMOTER';
                  return 'PASSIVE / DETRACTOR';
                })()}
              </p>
              <p className="text-base text-gray-700 italic leading-relaxed">
                "{summary.Agent_Performance_Summary || 'No performance summary available.'}"
              </p>
            </div>
          </div>
        </div>

        {/* TRANSCRIPT */}
        {transcript && transcript.length > 0 && (
          <div className="bg-white border-2 border-gray-200 rounded-2xl overflow-hidden mb-10 shadow-lg">
            <div className="flex justify-between items-center p-8 border-b-2 border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Fraunces', serif" }}>
                Call Transcript
              </h2>
              <div className="flex gap-3">
                <button
                  onClick={downloadTranscript}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-bold transition border border-gray-300"
                >
                  <FileDown className="w-4 h-4" />
                  Download
                </button>
                <button
                  onClick={() => setExpandTranscript(!expandTranscript)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition"
                >
                  {expandTranscript ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  {expandTranscript ? 'Collapse' : 'Expand'}
                </button>
              </div>
            </div>

            {expandTranscript && (
              <div className="max-h-[600px] overflow-y-auto p-8 space-y-6 bg-gray-50">
                {transcript.map((msg, i) => (
                  <div key={i} className="flex gap-4 pb-4 border-b border-gray-200 last:border-0">
                    <span className="font-mono text-sm text-gray-500 min-w-16 pt-1">{msg.Timestamp || `${i + 1}`}</span>
                    <div className="flex-1">
                      <p className={`text-sm font-bold uppercase tracking-wider mb-2 ${
                        msg.Speaker === 'Agent' ? 'text-blue-600' : 'text-green-600'
                      }`}>
                        {msg.Speaker}
                      </p>
                      <p className="text-base text-gray-700 leading-relaxed">{msg.Text}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Download Actions */}
        <div className="flex justify-center gap-4 mb-10">
          <button
            onClick={downloadCSV}
            className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg text-base font-bold transition shadow-md"
          >
            <Download className="w-5 h-5" />
            Download Full Report (CSV)
          </button>
          <button
            onClick={downloadTranscript}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-base font-bold transition shadow-md"
          >
            <FileDown className="w-5 h-5" />
            Download Transcript (TXT)
          </button>
        </div>

        {/* Footer */}
        <div className="text-center pt-8 border-t-2 border-gray-200">
          <p className="text-base text-gray-500">Duroflex Store Call Intelligence • Powered by AI Analysis</p>
        </div>

      </div>
    </div>
  );
};

export default CallReportDetail;
