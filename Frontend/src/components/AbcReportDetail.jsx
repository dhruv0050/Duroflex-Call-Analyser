import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronUp, Download, FileDown } from 'lucide-react';

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

  const downloadCSV = () => {
    if (!report) return;
    // Simplified CSV download logic
    alert("CSV Download for single report not yet implemented, please use dashboard export.");
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

  const analysis = report.analysis || {};
  const functional = analysis.Functional || {};
  const p1 = analysis.Pillar_1_Customer_Intent_and_Barriers || {};
  const p2 = analysis.Pillar_2_Experience_Delivered || {};
  const p3 = analysis.Pillar_3_RELAX_Framework || {};
  const p4 = analysis.Pillar_4_Invitation_to_Convert || {};
  const p5 = analysis.Pillar_5_Agent_Competency || {};
  const summary = analysis.Overall_Summary || {};
  const transcript = analysis.Transcript_Log || [];

  const customerExp = p2.Customer_Experience || {};
  const salesExp = p2.Sales_Experience || {};

  const getScoreColor = (score) => {
    if (score >= 4) return { bg: 'bg-emerald-900/30', text: 'text-emerald-300', border: 'border-emerald-600' };
    if (score >= 3) return { bg: 'bg-amber-900/30', text: 'text-amber-300', border: 'border-amber-600' };
    return { bg: 'bg-red-900/30', text: 'text-red-300', border: 'border-red-600' };
  };

  const getRelaxBarClass = (score) => {
    const safeScore = score || 3;
    if (safeScore >= 4) return 'bg-gradient-to-t from-emerald-600 to-emerald-500';
    if (safeScore >= 3) return 'bg-gradient-to-t from-amber-600 to-amber-500';
    if (safeScore >= 2) return 'bg-gradient-to-t from-orange-600 to-orange-500';
    return 'bg-gradient-to-t from-red-600 to-red-500';
  };

  const renderStars = (count) => {
    const safeCount = count || 3;
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={i <= safeCount ? 'text-amber-400' : 'text-gray-700'}>★</span>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#08080c] text-gray-100" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="max-w-[1400px] mx-auto px-6 py-10 relative z-10">
        
        {/* Navigation */}
        <div className="flex items-center justify-between mb-6">
          <Link to="/abc-calls" className="inline-flex items-center gap-2 text-red-400 hover:text-red-300 transition">
            <ArrowLeft className="w-4 h-4" /> Back to ABC Reports
          </Link>
          <button onClick={downloadTranscript} className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold">
            <FileDown className="w-4 h-4 inline mr-2" /> Download Transcript
          </button>
        </div>

        {/* Header */}
        <header className="bg-gradient-to-br from-[#0f0f14] to-[#16161d] border border-white/6 rounded-3xl p-8 mb-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-amber-600 to-transparent"></div>
          <div className="flex justify-between items-start mb-6">
            <div>
              <span className="font-mono text-xs text-gray-500 tracking-wider">CALL ID: {report.call_id}</span>
              <h1 className="text-3xl font-semibold text-gray-100 mt-2">
                Cart Recovery Analysis
              </h1>
              <div className="mt-2 flex gap-2">
                 <span className="px-3 py-1 bg-white/5 rounded text-sm text-gray-300">
                    Phone: {report.phone}
                 </span>
                 <span className="px-3 py-1 bg-white/5 rounded text-sm text-gray-300">
                    Loc: {report.city}
                 </span>
              </div>
            </div>
            <div className="flex flex-col items-end">
                <span className="text-xs uppercase tracking-wider text-gray-500">Overall Experience</span>
                <div className="text-4xl font-bold text-emerald-400 mt-2">{p2.Overall_Experience_Rating || 3}<span className="text-lg text-gray-600">/5</span></div>
            </div>
          </div>
          {/* Synopsis */}
          <div className="bg-black/20 p-4 rounded-lg border border-white/5">
              <p className="text-gray-300 italic">"{summary.Call_Synopsis}"</p>
          </div>
        </header>

        {/* PILLAR 1: INTENT & BARRIERS */}
        <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-100 mb-4 border-l-4 border-amber-500 pl-4">1. Customer Intent & Barriers</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-[#16161d] p-5 rounded-xl border border-white/5">
                    <p className="text-xs text-gray-500 uppercase">Intent Rating</p>
                    <p className={`text-lg font-bold mt-1 ${(p1.Intent_to_Purchase_Rating || 'MEDIUM') === 'HIGH' ? 'text-emerald-400' : (p1.Intent_to_Purchase_Rating || 'MEDIUM') === 'LOW' ? 'text-red-400' : 'text-amber-400'}`}>
                        {p1.Intent_to_Purchase_Rating || 'MEDIUM'}
                    </p>
                </div>
                <div className="bg-[#16161d] p-5 rounded-xl border border-white/5">
                     <p className="text-xs text-gray-500 uppercase">Primary Barrier</p>
                     <p className="text-lg font-bold mt-1 text-gray-200">{p1.Primary_Abandonment_Reason || 'Not Specified'}</p>
                </div>
                <div className="bg-[#16161d] p-5 rounded-xl border border-white/5">
                     <p className="text-xs text-gray-500 uppercase">Stage (AIDA)</p>
                     <p className="text-lg font-bold mt-1 text-blue-400">{p1.Customer_Stage_AIDA || 'Interest'}</p>
                </div>
                 <div className="bg-[#16161d] p-5 rounded-xl border border-white/5">
                     <p className="text-xs text-gray-500 uppercase">Resolution Status</p>
                     <p className="text-lg font-bold mt-1 text-gray-200">{p1.Barrier_Resolution_Status || 'Pending'}</p>
                </div>
            </div>
        </section>

        {/* PILLAR 2: EXPERIENCE */}
        <section className="mb-8">
             <h2 className="text-xl font-semibold text-gray-100 mb-4 border-l-4 border-purple-500 pl-4">2. Experience Delivered</h2>
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 {/* Customer Side */}
                 <div className="bg-[#16161d] p-6 rounded-xl border border-white/5">
                     <h3 className="text-md font-medium text-gray-300 mb-4">Customer Perspective</h3>
                     <div className="space-y-4">
                        <div className="flex justify-between">
                            <span className="text-sm text-gray-400">Opening</span>
                            {renderStars(customerExp.Opening_Experience_Rating || 3)}
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sm text-gray-400">Listening</span>
                             {renderStars(customerExp.Listening_Quality_Rating || 3)}
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sm text-gray-400">Empathy</span>
                             {renderStars(customerExp.Empathy_Displayed_Rating || 3)}
                        </div>
                         <div className="pt-2 border-t border-gray-700 mt-2">
                             <p className="text-sm text-gray-400">Sentiment: <span className="text-white">{customerExp.Closing_Sentiment || 'Neutral'}</span></p>
                         </div>
                     </div>
                 </div>
                 {/* Sales Side */}
                 <div className="bg-[#16161d] p-6 rounded-xl border border-white/5">
                     <h3 className="text-md font-medium text-gray-300 mb-4">Sales Perspective</h3>
                     <div className="space-y-4">
                        <div className="flex justify-between">
                            <span className="text-sm text-gray-400">Opp Utilization</span>
                            {renderStars(salesExp.Opportunity_Utilization_Rating || 3)}
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sm text-gray-400">Control</span>
                             {renderStars(salesExp.Conversation_Control_Rating || 3)}
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sm text-gray-400">Value Articulation</span>
                             {renderStars(salesExp.Value_Articulation_Rating || 3)}
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sm text-gray-400">Commercial Alignment</span>
                             {renderStars(salesExp.Commercial_Outcome_Alignment_Rating || 3)}
                        </div>
                     </div>
                 </div>
             </div>
        </section>

        {/* PILLAR 3: RELAX */}
        <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-100 mb-6 border-l-4 border-green-500 pl-4">3. RELAX Framework</h2>
             <div className="flex justify-between items-end h-48 gap-4 mb-6 px-4 bg-[#16161d] p-6 rounded-xl border border-white/5">
                {[
                { letter: 'R', name: 'Reach Out', score: p3.R_Reach_Out?.Rating || 3 },
                { letter: 'E', name: 'Explore', score: p3.E_Explore_Needs?.Rating || 3 },
                { letter: 'L', name: 'Link', score: p3.L_Link_Experience?.Rating || 3 },
                { letter: 'A', name: 'Add Value', score: p3.A_Add_Value?.Rating || 3 },
                { letter: 'X', name: 'Express', score: p3.X_Express_Closing?.Rating || 3 },
                ].map((item) => (
                <div key={item.letter} className="flex flex-col items-center gap-3 flex-1">
                    <div className="relative w-full flex justify-center">
                    <div className={`w-12 rounded-t-lg ${getRelaxBarClass(item.score)} flex items-end justify-center pb-2 relative transition-all duration-500`} style={{ height: `${Math.max(item.score * 30, 20)}px` }}>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="bg-[#16161d] p-4 rounded-lg">
                    <p className="text-xs uppercase text-gray-500 mb-2">Reach Out Reasons</p>
                    <ul className="list-disc pl-4 text-sm text-gray-400">
                        {p3.R_Reach_Out?.Reasons?.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                 </div>
                 <div className="bg-[#16161d] p-4 rounded-lg">
                    <p className="text-xs uppercase text-gray-500 mb-2">Explore Reasons</p>
                    <ul className="list-disc pl-4 text-sm text-gray-400">
                        {p3.E_Explore_Needs?.Reasons?.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                 </div>
            </div>
        </section>

        {/* PILLAR 4 & 5 GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* PILLAR 4: INVITATION */}
            <section className="bg-[#16161d] p-6 rounded-xl border border-white/5">
                <h2 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
                    <span className="w-1 h-6 bg-blue-500 rounded"></span> 4. Invitation to Convert
                </h2>
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-black/20 p-3 rounded">
                        <p className="text-xs text-gray-500">Attempted?</p>
                        <p className={`font-bold ${p4.Invitation_Attempted ? 'text-green-400' : 'text-red-400'}`}>
                            {p4.Invitation_Attempted ? 'YES' : 'NO'}
                        </p>
                    </div>
                    <div className="bg-black/20 p-3 rounded">
                        <p className="text-xs text-gray-500">Quality</p>
                        <div className="flex gap-1">{renderStars(p4.Invitation_Quality_Rating || 3)}</div>
                    </div>
                </div>
                <div className="mb-2">
                     <p className="text-xs text-gray-500">Paths Offered:</p>
                     <div className="flex flex-wrap gap-2 mt-1">
                        {(p4.Conversion_Paths_Offered || []).length > 0 ? (
                          p4.Conversion_Paths_Offered.map(path => (
                            <span key={path} className="px-2 py-1 bg-white/10 rounded text-xs">{path}</span>
                          ))
                        ) : (
                          <span className="text-gray-500 text-xs">None offered</span>
                        )}
                     </div>
                </div>
                <div>
                     <p className="text-xs text-gray-500">Commitment Obtained:</p>
                     <p className="text-sm font-medium text-white">{p4.Commitment_Obtained || 'None'}</p>
                </div>
            </section>

             {/* PILLAR 5: AGENT COMPETENCY */}
             <section className="bg-[#16161d] p-6 rounded-xl border border-white/5">
                <h2 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
                    <span className="w-1 h-6 bg-pink-500 rounded"></span> 5. Agent Competency
                </h2>
                <div className="space-y-4">
                    <div className="flex justify-between items-center bg-black/20 p-3 rounded">
                        <span className="text-sm text-gray-300">Product Knowledge</span>
                        <div className="text-right">
                            {renderStars(p5.Product_Knowledge?.Score || 3)}
                        </div>
                    </div>
                     <div className="flex justify-between items-center bg-black/20 p-3 rounded">
                        <span className="text-sm text-gray-300">Sales Skills</span>
                        <div className="text-right">
                            {renderStars(p5.Sales_Skills?.Score || 3)}
                        </div>
                    </div>
                     <div className="flex justify-between items-center bg-black/20 p-3 rounded">
                        <span className="text-sm text-gray-300">Soft Skills</span>
                        <div className="text-right">
                            {renderStars(p5.Soft_Skills?.Score || 3)}
                        </div>
                    </div>
                </div>
            </section>
        </div>

        {/* TRANSCRIPT */}
        <section className="bg-[#0f0f14] border border-white/6 rounded-2xl overflow-hidden mt-6">
            <div className="flex justify-between items-center p-7 border-b border-white/6">
              <h2 className="text-lg font-medium text-gray-100">Call Transcript</h2>
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
                    <span className="font-mono text-xs text-gray-500 min-w-12 pt-1">{msg.Timestamp || ''}</span>
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
        </section>

      </div>
    </div>
  );
};

export default AbcReportDetail;
