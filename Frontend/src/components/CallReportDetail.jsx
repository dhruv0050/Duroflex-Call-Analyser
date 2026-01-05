import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronUp, Download, FileDown } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://duroflex-call-analyser.onrender.com';

const CallReportDetail = () => {
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
      const res = await fetch(`${API_BASE}/api/call-reports/${callId}`);
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

    // Create CSV headers
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

    // Create CSV row
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

    // Escape fields that contain commas or quotes
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

    // Create blob and download
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

    // Create transcript text content
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

    // Add transcript entries
    transcript.forEach((entry, index) => {
      const timestamp = entry.Timestamp || `${index + 1}`;
      const speaker = entry.Speaker || 'Unknown';
      const text = entry.Text || '';

      textContent += `[${timestamp}] ${speaker}:\n`;
      textContent += `${text}\n\n`;
    });

    textContent += `${'='.repeat(80)}\n`;
    textContent += `End of Transcript\n`;

    // Create blob and download
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `call_transcript_${report.call_id}.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
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
          <Link to="/call-reports" className="text-amber-400 hover:text-amber-300 font-semibold inline-flex items-center gap-2">
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
      <div className="min-h-screen bg-[#08080c] p-8">
        <Link to="/call-reports" className="inline-flex items-center gap-2 text-amber-400 hover:text-amber-300 mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Reports
        </Link>
        <div className="max-w-4xl mx-auto bg-gray-900 border border-gray-800 rounded-xl p-8">
          <h1 className="text-2xl font-bold text-gray-100 mb-4">{report.store_name}</h1>
          <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-6">
            <p className="text-red-300">⚠️ Analysis Error: {analysis.error}</p>
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

  const getIntentBadgeColor = (intent) => {
    if (!intent) return 'bg-gray-800 text-gray-400';
    const upper = intent.toUpperCase();
    if (upper.includes('HIGH')) return 'bg-emerald-900/30 text-emerald-300 border border-emerald-600/40';
    if (upper.includes('MEDIUM')) return 'bg-amber-900/30 text-amber-300 border border-amber-600/40';
    return 'bg-red-900/30 text-red-300 border border-red-600/40';
  };

  const getScoreColor = (score) => {
    if (score >= 4) return { bg: 'bg-emerald-900/30', text: 'text-emerald-300', border: 'border-emerald-600' };
    if (score >= 3) return { bg: 'bg-amber-900/30', text: 'text-amber-300', border: 'border-amber-600' };
    return { bg: 'bg-red-900/30', text: 'text-red-300', border: 'border-red-600' };
  };

  const getRelaxBarClass = (score) => {
    if (score >= 4) return 'bg-gradient-to-t from-emerald-600 to-emerald-500';
    if (score >= 3) return 'bg-gradient-to-t from-amber-600 to-amber-500';
    if (score >= 2) return 'bg-gradient-to-t from-orange-600 to-orange-500';
    return 'bg-gradient-to-t from-red-600 to-red-500';
  };

  const renderStars = (count) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={i <= count ? 'text-amber-400' : 'text-gray-700'}>★</span>
        ))}
      </div>
    );
  };

  const aideStages = ['A', 'I', 'D', 'A'];
  const currentStage = customer.Customer_Stage_AIDA || 'Awareness';
  const currentStageIndex = currentStage === 'Awareness' ? 0 : currentStage === 'Interest' ? 1 : currentStage === 'Desire' ? 2 : 3;

  return (
    <div className="min-h-screen bg-[#08080c] text-gray-100" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Grain texture overlay */}
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none" style={{
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")"
      }}></div>

      <div className="max-w-[1400px] mx-auto px-6 py-10 relative z-10">
        {/* Back Button and Download Buttons */}
        <div className="flex items-center justify-between mb-6">
          <Link to="/call-reports" className="inline-flex items-center gap-2 text-amber-400 hover:text-amber-300 transition">
            <ArrowLeft className="w-4 h-4" /> Back to All Reports
          </Link>
          
          <div className="flex gap-3">
            <button
              onClick={downloadCSV}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition shadow-sm"
              title="Download Call Report as CSV"
            >
              <Download className="w-4 h-4" />
              Download CSV
            </button>
            <button
              onClick={downloadTranscript}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold transition shadow-sm"
              title="Download Call Transcript as TXT"
            >
              <FileDown className="w-4 h-4" />
              Download Transcript
            </button>
          </div>
        </div>

        {/* HEADER */}
        <header className="bg-gradient-to-br from-[#0f0f14] to-[#16161d] border border-white/6 rounded-3xl p-8 mb-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-amber-600 to-transparent"></div>
          
          <div className="flex justify-between items-start mb-6">
            <div className="flex flex-col gap-2">
              <span className="font-mono text-xs text-gray-500 tracking-wider">CALL ID: {report.call_id}</span>
              <h1 className="text-3xl font-semibold text-gray-100" style={{ fontFamily: "'Fraunces', serif", letterSpacing: '-0.02em' }}>
                {report.store_name}
              </h1>
              {functional.Call_Objective_Theme && (
                <span className="inline-flex items-center gap-2 bg-amber-900/20 border border-amber-600/25 px-4 py-2 rounded-full text-sm font-medium text-amber-400 w-fit">
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  {functional.Call_Objective_Theme}
                </span>
              )}
            </div>
            
            <div className="flex flex-col items-end gap-2">
              <span className="text-xs uppercase tracking-wider text-gray-500">Audio Quality</span>
              <div className="flex gap-1 items-end h-6">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div 
                    key={i} 
                    className={`w-1.5 rounded-sm ${i <= (functional.Agent_Audio_Quality_Rating || 3) ? 'bg-emerald-500' : 'bg-gray-700'}`} 
                    style={{ height: `${8 + i * 4}px` }}
                  ></div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-6">
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Call Date</p>
              <p className="text-sm font-medium text-gray-200">{report.call_date}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Duration</p>
              <p className="text-sm font-medium text-gray-200">{Math.floor(report.duration_seconds / 60)}:{(report.duration_seconds % 60).toString().padStart(2, '0')}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Customer</p>
              <p className="text-sm font-medium text-gray-200">{functional.Customer_Name || 'Unknown'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Agent</p>
              <p className="text-sm font-medium text-gray-200">{functional.Agent_Name || 'Unknown'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Location</p>
              <p className="text-sm font-medium text-gray-200">{report.city}, {report.state}</p>
            </div>
          </div>
        </header>

        {/* MAIN GRID */}
        <div className="grid grid-cols-2 gap-6">
          
          {/* CUSTOMER INSIGHTS */}
          <div className="bg-[#0f0f14] border border-white/6 rounded-2xl p-7">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-medium text-gray-100" style={{ fontFamily: "'Fraunces', serif" }}>Customer Insights</h2>
              <span className="text-xs text-gray-500">Intent & Satisfaction Analysis</span>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Intent to Visit</p>
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold ${getIntentBadgeColor(customer.Intent_to_Visit_Rating)}`}>
                  <span className="w-2 h-2 rounded-full bg-current animate-pulse"></span>
                  {customer.Intent_to_Visit_Rating || 'Unknown'}
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Intent to Purchase</p>
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold ${getIntentBadgeColor(customer.Intent_to_Purchase_Rating)}`}>
                  <span className="w-2 h-2 rounded-full bg-current animate-pulse"></span>
                  {customer.Intent_to_Purchase_Rating || 'Unknown'}
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Customer Journey (AIDA)</p>
                <div className="flex items-center gap-1">
                  {aideStages.map((stage, i) => (
                    <React.Fragment key={i}>
                      <button className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider ${i === currentStageIndex ? 'bg-amber-500 text-gray-900' : 'bg-gray-800 text-gray-500'}`}>
                        {stage}
                      </button>
                      {i < aideStages.length - 1 && <div className="w-4 h-0.5 bg-gray-800"></div>}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {customer.Barriers_to_Conversion && customer.Barriers_to_Conversion !== 'N/A' && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Barrier to Conversion</p>
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-full text-sm text-gray-300">
                    <span>🔍</span>
                    {customer.Barriers_to_Conversion}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-gray-800">
                <p className="text-xs uppercase tracking-wider text-gray-500 mb-3">Satisfaction Score</p>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full border-2 border-amber-600 flex items-center justify-center relative">
                    <span className="text-2xl font-bold text-amber-400">{customer.Customer_Satisfaction_Score || 3}</span>
                    <div className="absolute inset-0 -m-1 rounded-full border-2 border-amber-600 opacity-30"></div>
                  </div>
                  <span className="text-sm text-gray-400">of 5</span>
                </div>
                {customer.Customer_Satisfaction_Score_Reasons && customer.Customer_Satisfaction_Score_Reasons.length > 0 && (
                  <ul className="mt-4 space-y-2">
                    {customer.Customer_Satisfaction_Score_Reasons.map((reason, i) => (
                      <li key={i} className="text-sm text-gray-400 pl-4 relative before:content-[''] before:absolute before:left-0 before:top-2 before:w-1 before:h-1 before:rounded-full before:bg-gray-600">
                        {reason}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* QUESTIONS ASKED */}
          <div className="bg-[#0f0f14] border border-white/6 rounded-2xl p-7">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-medium text-gray-100" style={{ fontFamily: "'Fraunces', serif" }}>Primary Questions Asked</h2>
            </div>

            <div className="space-y-3 mb-6">
              {customer.Primary_Questions_Asked && customer.Primary_Questions_Asked.map((q, i) => (
                <div key={i} className="flex gap-3 p-4 bg-[#16161d] rounded-lg border-l-2 border-amber-500">
                  <span className="font-mono text-xs text-amber-400/70">{String(i + 1).padStart(2, '0')}</span>
                  <span className="text-sm text-gray-300 italic">{q}</span>
                </div>
              ))}
            </div>

            {invitation && (
              <div className="pt-4 border-t border-gray-800">
                <div className="bg-[#16161d] rounded-lg p-5">
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-xs uppercase tracking-wider text-gray-500">Invitation to Visit</p>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${invitation.Attempted ? 'bg-emerald-900/30 text-emerald-300' : 'bg-red-900/30 text-red-300'}`}>
                        {invitation.Attempted ? '✓ Attempted' : '✗ Not Attempted'}
                      </span>
                      {invitation.Attempted && invitation.Quality_Rating && (
                        <span className="text-xs text-gray-400">Quality: {invitation.Quality_Rating}/5</span>
                      )}
                    </div>
                  </div>
                  {invitation.Reasons && invitation.Reasons.length > 0 && (
                    <ul className="space-y-1 text-xs text-gray-400">
                      {invitation.Reasons.map((reason, i) => (
                        <li key={i} className="pl-4 relative before:content-[''] before:absolute before:left-0 before:top-1.5 before:w-1 before:h-1 before:rounded-full before:bg-gray-600">
                          {reason}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RELAX FRAMEWORK */}
        <div className="bg-[#0f0f14] border border-white/6 rounded-2xl p-7 mt-6">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-lg font-medium text-gray-100" style={{ fontFamily: "'Fraunces', serif" }}>RELAX Framework Performance</h2>
            <span className="text-xs text-gray-500">Sales Methodology Assessment</span>
          </div>

          {/* Visual Bars */}
          <div className="flex justify-between items-end h-48 gap-4 mb-12 px-4">
            {[
              { letter: 'R', name: 'Reach Out', score: relax.R_Reach_Out?.Rating || 3 },
              { letter: 'E', name: 'Explore', score: relax.E_Explore_Needs?.Rating || relax.E_Explore?.Rating || 3 },
              { letter: 'L', name: 'Link', score: relax.L_Link_Experience?.Rating || 3 },
              { letter: 'A', name: 'Add Value', score: relax.A_Add_Value?.Rating || 3 },
              { letter: 'X', name: 'Express', score: relax.X_Express_Closing?.Rating || 3 },
            ].map((item) => (
              <div key={item.letter} className="flex flex-col items-center gap-3 flex-1">
                <div className="relative w-full flex justify-center">
                  <div className={`w-12 rounded-t-lg ${getRelaxBarClass(item.score)} flex items-end justify-center pb-2 relative`} style={{ height: `${item.score * 30}px` }}>
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

          {/* Detail Cards */}
          <div className="grid grid-cols-5 gap-4">
            {[
              { title: 'R — Reach Out', score: relax.R_Reach_Out?.Rating || 3, reasons: relax.R_Reach_Out?.Reasons || [] },
              { title: 'E — Explore', score: relax.E_Explore_Needs?.Rating || relax.E_Explore?.Rating || 3, reasons: relax.E_Explore_Needs?.Reasons || relax.E_Explore?.Reasons || [] },
              { title: 'L — Link', score: relax.L_Link_Experience?.Rating || 3, reasons: relax.L_Link_Experience?.Reasons || [] },
              { title: 'A — Add Value', score: relax.A_Add_Value?.Rating || 3, reasons: relax.A_Add_Value?.Reasons || [] },
              { title: 'X — Express', score: relax.X_Express_Closing?.Rating || 3, reasons: relax.X_Express_Closing?.Reasons || [] },
            ].map((item) => {
              const color = getScoreColor(item.score);
              return (
                <div key={item.title} className={`bg-[#16161d] rounded-lg p-4 border-l-2 ${color.border}`}>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-semibold text-gray-300">{item.title}</span>
                    <span className={`text-xs font-mono px-2 py-1 rounded ${color.bg} ${color.text}`}>{item.score}/5</span>
                  </div>
                  <p className="text-xs text-gray-400 line-clamp-3">{item.reasons[0] || 'No details'}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* PRODUCT KNOWLEDGE & SOFT SKILLS */}
        <div className="grid grid-cols-2 gap-6 mt-6">
          {/* Product Knowledge */}
          <div className="bg-[#0f0f14] border border-white/6 rounded-2xl p-7">
            <h2 className="text-lg font-medium text-gray-100 mb-6" style={{ fontFamily: "'Fraunces', serif" }}>Product Knowledge</h2>
            
            <div className="space-y-4">
              <div className="bg-[#16161d] rounded-lg p-5">
                <div className="flex justify-between items-start mb-2">
                  <p className="text-sm font-medium text-gray-300">Description Quality</p>
                  <div className="flex gap-0.5">
                    {renderStars(knowledge.Description_Quality_Rating || 3)}
                  </div>
                </div>
                <p className="text-xs text-gray-400">{knowledge.Description_Quality_Reason || 'Not assessed'}</p>
              </div>

              <div className="bg-[#16161d] rounded-lg p-5">
                <div className="flex justify-between items-start mb-2">
                  <p className="text-sm font-medium text-gray-300">Stock Availability</p>
                  <div className="flex gap-0.5">
                    {renderStars(knowledge.Stock_Availability_Check_Rating || 2)}
                  </div>
                </div>
                <p className="text-xs text-gray-400">{knowledge.Stock_Availability_Check_Reason || 'Not checked'}</p>
              </div>
            </div>
          </div>

          {/* Soft Skills */}
          <div className="bg-[#0f0f14] border border-white/6 rounded-2xl p-7">
            <h2 className="text-lg font-medium text-gray-100 mb-6" style={{ fontFamily: "'Fraunces', serif" }}>Soft Skills & Etiquette</h2>
            
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-[#16161d] rounded-lg p-5 text-center">
                <p className="text-3xl font-bold text-emerald-400">{softSkills.Tone_and_Patience_Rating || 4}</p>
                <p className="text-xs text-gray-400 mt-2">Tone & Patience</p>
              </div>
              <div className="bg-[#16161d] rounded-lg p-5 text-center">
                <p className="text-3xl font-bold text-emerald-400">{softSkills.Hold_Management_Rating || 5}</p>
                <p className="text-xs text-gray-400 mt-2">Hold Mgmt</p>
              </div>
              <div className="bg-[#16161d] rounded-lg p-5 text-center">
                <p className="text-3xl font-bold text-emerald-400">{softSkills.Agent_Language_Fluency_Score || 5}</p>
                <p className="text-xs text-gray-400 mt-2">Fluency</p>
              </div>
            </div>

            <div className="bg-[#16161d] rounded-lg p-5">
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-3">Observations</p>
              <ul className="space-y-1 text-xs text-gray-400">
                {softSkills.Soft_Skills_Reasons && softSkills.Soft_Skills_Reasons.slice(0, 3).map((r, i) => (
                  <li key={i} className="pl-4 relative before:content-[''] before:absolute before:left-0 before:top-1.5 before:w-1 before:h-1 before:rounded-full before:bg-gray-600">
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* TOP IMPROVEMENT AREAS */}
        {agent.Top_3_Improvement_Areas && agent.Top_3_Improvement_Areas.length > 0 && (
          <div className="bg-[#0f0f14] border border-white/6 rounded-2xl p-7 mt-6">
            <h2 className="text-lg font-medium text-gray-100 mb-6" style={{ fontFamily: "'Fraunces', serif" }}>Top 3 Improvement Areas</h2>
            
            <div className="space-y-4">
              {agent.Top_3_Improvement_Areas.map((area, i) => (
                <div key={i} className="flex gap-4 p-5 bg-[#16161d] rounded-lg border border-white/6 hover:border-amber-600/50 transition">
                  <div className="w-8 h-8 rounded-full bg-amber-900/20 border border-amber-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-amber-400">{i + 1}</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-200 mb-1">{area.split(':')[0] || area}</p>
                    {area.includes(':') && <p className="text-xs text-gray-400">{area.split(':')[1]?.trim()}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SUMMARY */}
        <div className="bg-[#0f0f14] border border-white/6 rounded-2xl p-7 mt-6">
          <h2 className="text-lg font-medium text-gray-100 mb-6" style={{ fontFamily: "'Fraunces', serif" }}>Call Summary</h2>
          
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-[#16161d] rounded-lg p-6">
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
                <span>📋</span> Synopsis
              </p>
              <p className="text-sm text-gray-300 leading-relaxed">{summary.Call_Synopsis || 'No synopsis available'}</p>
            </div>
            <div className="bg-[#16161d] rounded-lg p-6">
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
                <span>👤</span> Agent Performance
              </p>
              <p className="text-sm text-gray-300 leading-relaxed">{summary.Agent_Performance_Summary || 'No performance summary available'}</p>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-800">
            <p className="text-xs uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
              <span>➡️</span> Next Action
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-900/20 border border-orange-600/30 rounded-full text-sm font-medium text-orange-300">
              <span>⚠️</span>
              {summary.Next_Action || 'Pending'}
            </div>
          </div>
        </div>

        {/* TRANSCRIPT */}
        {transcript && transcript.length > 0 && (
          <div className="bg-[#0f0f14] border border-white/6 rounded-2xl overflow-hidden mt-6">
            <div className="flex justify-between items-center p-7 border-b border-white/6">
              <h2 className="text-lg font-medium text-gray-100" style={{ fontFamily: "'Fraunces', serif" }}>Call Transcript</h2>
              <button
                onClick={() => setExpandTranscript(!expandTranscript)}
                className="flex items-center gap-2 px-4 py-2 bg-[#16161d] rounded-lg text-sm text-amber-400 hover:bg-[#1c1c25] transition"
              >
                {expandTranscript ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                <span>{expandTranscript ? 'Collapse' : 'Expand'}</span>
              </button>
            </div>

            {expandTranscript && (
              <div className="max-h-[500px] overflow-y-auto p-7 space-y-6">
                {transcript.map((msg, i) => (
                  <div key={i} className="flex gap-4 pb-4 border-b border-gray-800 last:border-0">
                    <span className="font-mono text-xs text-gray-500 min-w-12 pt-1">{msg.Timestamp || '00:00'}</span>
                    <div className="flex-1">
                      <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${msg.Speaker === 'Agent' ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {msg.Speaker}
                      </p>
                      <p className="text-sm text-gray-300 leading-relaxed">{msg.Text}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CallReportDetail;
