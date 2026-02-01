import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Phone, MapPin, Calendar, Clock, LogOut, BarChart3, Upload } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://duroflex-call-analyser.onrender.com';

// Helper functions to handle both expected and actual Gemini response structures
const getAnalysisField = (analysis, ...paths) => {
  for (const path of paths) {
    const keys = path.split('.');
    let value = analysis;
    for (const key of keys) {
      if (value && typeof value === 'object') {
        value = value[key];
      } else {
        value = undefined;
        break;
      }
    }
    if (value !== undefined && value !== null) return value;
  }
  return null;
};

const isConvertedValue = (value) => {
  if (value === true) return true;
  if (value === false || value === null || value === undefined) return false;
  if (typeof value === 'number') return value > 0;
  const str = String(value).trim().toLowerCase();
  if (str === 'true' || str === 'yes' || str === 'y') return true;
  const num = parseFloat(str);
  if (!Number.isNaN(num)) return num > 0;
  return false;
};

const normalizeStoreName = (name) => {
  const str = (name ?? '').toString().trim();
  if (!str) return 'Unknown';
  const lower = str.toLowerCase();
  if (lower === 'nan' || lower === 'null' || lower === 'undefined') return 'Unknown';
  return str;
};

const OutboundCallsList = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState(null);
  const [selectedIntent, setSelectedIntent] = useState('ALL');
  const [expandedStores, setExpandedStores] = useState(false);

  const filterIds = location.state?.filterIds;
  const filterDescription = location.state?.filterDescription;

  useEffect(() => {
    fetchReports();
    fetchStats();
  }, []);

  const fetchReports = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/outbound-calls`);
      const data = await res.json();
      setReports(data.reports || []);
    } catch (err) {
      setError('Failed to load outbound call reports');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/outbound-calls/stats/overview`);
      const data = await res.json();
      setStats(data.stats);
    } catch (err) {
      console.error('Failed to load stats', err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('admin_email');
    navigate('/');
  };

  const getIntentRating = (report) => {
    const analysis = report.analysis || {};
    // NEW SCHEMA: Map Recovery_Verdict to intent levels
    const summary = analysis.Summary || {};
    const verdict = summary.Recovery_Verdict;
    if (verdict) {
      if (verdict.includes('Hot')) return 'HIGH';
      if (verdict.includes('Warm')) return 'MEDIUM';
      if (verdict.includes('Cold') || verdict.includes('Lost')) return 'LOW';
    }
    
    // OLD SCHEMA FALLBACK
    const intent = getAnalysisField(analysis,
      'Pillar_1_Customer_Intent_and_Barriers.Intent_to_Purchase_Rating',
      'PILLAR_1_INTENT_BARRIERS.Intent_to_Purchase_Rating',
      'Call_Analysis.PILLAR_1_CUSTOMER_INTENT_BARRIERS.Intent_to_Purchase_Rating',
      'PILLAR_1.Intent_to_Purchase_Rating',
      'PILLAR_1_CUSTOMER_INTENT_BARRIERS.Intent_to_Purchase_Rating'
    );
    return intent || 'MEDIUM';
  };

  const getIntentColor = (intent) => {
    if (!intent) return 'bg-gray-800 text-gray-400 border-gray-700';
    const upper = intent.toUpperCase();
    if (upper.includes('HIGH')) return 'bg-emerald-900/30 text-emerald-300 border-emerald-600/40';
    if (upper.includes('MEDIUM')) return 'bg-amber-900/30 text-amber-300 border-amber-600/40';
    return 'bg-red-900/30 text-red-300 border-red-600/40';
  };

  const visibleReports = useMemo(() => {
    if (!filterIds || !Array.isArray(filterIds)) return reports;
    return reports.filter((r) => filterIds.includes(r.call_id));
  }, [reports, filterIds]);

  const filteredReports = useMemo(() => {
    if (selectedIntent === 'ALL') return visibleReports;
    return visibleReports.filter(r => getIntentRating(r) === selectedIntent);
  }, [visibleReports, selectedIntent]);

  const getOverallScore = (report) => {
    const analysis = report.analysis || {};
    // NEW SCHEMA: Use average of RELAX scores from Pillar_5_Methodology
    const pillar5 = analysis.Pillar_5_Methodology || {};
    const relaxScores = pillar5.RELAX_Scores || {};
    
    // Calculate average of R, E, L, A, X scores
    const scores = [
      relaxScores.R?.Score,
      relaxScores.E?.Score,
      relaxScores.L?.Score,
      relaxScores.A?.Score,
      relaxScores.X?.Score
    ].filter(s => typeof s === 'number');
    
    if (scores.length > 0) {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      return Math.round(avg);
    }
    
    // OLD SCHEMA FALLBACK
    const score = getAnalysisField(
      analysis,
      'PILLAR_2_EXPERIENCE_DELIVERED.Overall_Experience_Rating',
      'Pillar_2_Experience_Delivered.Overall_Experience_Rating',
      'PILLAR_2_EXPERIENCE_DELIVERED.C_OVERALL_EXPERIENCE.Overall_Experience_Rating',
      'Call_Analysis.PILLAR_2_EXPERIENCE_DELIVERED.C_OVERALL_EXPERIENCE_RATING.Overall_Experience_Rating',
      'PILLAR_2_EXPERIENCE_DELIVERED.OVERALL_EXPERIENCE.Overall_Experience_Rating',
      'PILLAR_2.Overall_Experience_Rating',
      'PILLAR_2.OVERALL_EXPERIENCE.Overall_Experience_Rating'
    );
    const numScore = typeof score === 'number' ? score : parseInt(score) || 0;
    return Math.max(0, Math.min(5, numScore)); // Clamp between 0-5
  };

  const storePerformanceData = useMemo(() => {
    const storeMap = {};
    filteredReports.forEach(report => {
      const storeName = normalizeStoreName(report.store_name);
      if (!storeMap[storeName]) {
        storeMap[storeName] = {
          storeName,
          calls: [],
          avgScore: 0,
          totalCalls: 0,
          highIntent: 0,
          converted: 0
        };
      }
      storeMap[storeName].calls.push(report);
      storeMap[storeName].totalCalls += 1;
      if (getIntentRating(report) === 'HIGH') storeMap[storeName].highIntent += 1;
      if (isConvertedValue(report.is_converted)) storeMap[storeName].converted += 1;
    });

    Object.keys(storeMap).forEach(key => {
      const store = storeMap[key];
      const scores = store.calls.map(getOverallScore);
      store.avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b) / scores.length) : 0;
    });

    return Object.values(storeMap).sort((a, b) => b.avgScore - a.avgScore);
  }, [filteredReports]);

  const topStores = storePerformanceData.slice(0, 10);
  const remainingStores = storePerformanceData.slice(10);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#08080c] flex items-center justify-center">
        <div className="text-gray-300">Loading outbound calls...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#08080c] flex items-center justify-center">
        <div className="text-red-400">{error}</div>
      </div>
    );
  }

  const analyzedCount = reports.filter(r => r.analysis && !r.analysis.error).length;

  return (
    <div className="min-h-screen bg-[#08080c] text-gray-100" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Grain texture overlay */}
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none" style={{
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")"
      }}></div>

      <div className="max-w-[1400px] mx-auto px-6 py-10 relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="inline-flex items-center gap-2 text-amber-400 hover:text-amber-300 transition">
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/outbound-calls/upload"
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 rounded-lg text-purple-300 text-sm font-semibold transition"
            >
              <Upload className="w-4 h-4" />
              Upload CSV
            </Link>

            <Link
              to="/outbound-calls/analytics"
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-400/30 rounded-lg text-amber-200 text-sm font-semibold transition"
            >
              <BarChart3 className="w-4 h-4" />
              Analytics Dashboard
            </Link>

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-900/20 hover:bg-red-900/30 border border-red-600/30 rounded-lg text-red-400 text-sm font-semibold transition"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>

        {/* Title Section */}
        <div className="mb-10">
          <h1 className="text-3xl font-semibold text-gray-100 mb-2" style={{ fontFamily: "'Fraunces', serif", letterSpacing: '-0.02em' }}>
            Store Walkin Outbound Calls
          </h1>
          <p className="text-sm text-gray-400">Pre-purchase follow-up call analysis • {filteredReports.length} calls</p>
        </div>

        {/* Store Performance Analysis */}
        {storePerformanceData.length > 0 && (
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl overflow-hidden mb-12">
            <div className="px-8 py-6 border-b border-[#2a2a2a]">
              <div className="flex items-center gap-4 mb-2">
                <span className="text-3xl">📊</span>
                <h2 className="text-2xl font-semibold text-white">Store Performance Analysis</h2>
              </div>
              <p className="text-slate-400 text-sm ml-14">Experience Scores & Conversion Metrics</p>
            </div>

            <div className="flex gap-8 px-8 py-6 bg-[#0a0a0a] border-b border-[#2a2a2a] overflow-x-auto">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Total Stores</p>
                <p className="text-2xl font-bold text-white">{storePerformanceData.length}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Total Calls</p>
                <p className="text-2xl font-bold text-white">{filteredReports.length}</p>
              </div>
              {stats && (
                <>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Conversions</p>
                    <p className="text-2xl font-bold text-emerald-400">{stats.converted_calls}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Conversion Rate</p>
                    <p className="text-2xl font-bold text-amber-400">{stats.conversion_rate}%</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Avg Performance</p>
                    <p className="text-2xl font-bold text-blue-400">{Math.round(stats.avg_agent_score * 20)}/100</p>
                  </div>
                </>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#0a0a0a] border-b-2 border-[#2a2a2a]">
                  <tr>
                    <th className="text-left px-6 py-5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Store Name</th>
                    <th className="text-center px-6 py-5 text-xs font-semibold text-slate-400 uppercase tracking-wider"># Calls</th>
                    <th className="text-center px-6 py-5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Avg Score</th>
                    <th className="text-center px-6 py-5 text-xs font-semibold text-slate-400 uppercase tracking-wider">High Intent</th>
                    <th className="text-center px-6 py-5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Converted</th>
                  </tr>
                </thead>
                <tbody>
                  {(expandedStores ? storePerformanceData : topStores).map((store) => (
                    <tr key={store.storeName} className="border-b border-[#2a2a2a] hover:bg-[#252525] transition">
                      <td className="px-6 py-6">
                        <div className="font-semibold text-white text-base">{store.storeName}</div>
                      </td>
                      <td className="text-center px-6 py-6">
                        <span className="text-slate-200 font-semibold text-base">{store.totalCalls}</span>
                      </td>
                      <td className="text-center px-6 py-6">
                        <div
                          className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-white font-bold text-sm"
                          style={{ color: store.avgScore >= 4 ? '#10b981' : store.avgScore >= 3 ? '#f59e0b' : '#dc2626' }}
                          title="Average Overall Score (1–5)"
                        >
                          {store.avgScore}/5
                        </div>
                      </td>
                      <td className="text-center px-6 py-6">
                        <span className="font-semibold text-emerald-400 text-base">{store.highIntent}</span>
                      </td>
                      <td className="text-center px-6 py-6">
                        <span className="font-semibold text-amber-400 text-base">{store.converted}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {remainingStores.length > 0 && (
              <div className="text-center px-8 py-6 bg-[#1a1a1a] border-t border-[#2a2a2a]">
                <button
                  onClick={() => setExpandedStores(!expandedStores)}
                  className={`inline-flex items-center gap-3 px-8 py-3 rounded-lg font-semibold transition transform hover:-translate-y-0.5 ${expandedStores ? 'bg-gradient-to-r from-slate-600 to-slate-700 text-white' : 'bg-gradient-to-r from-amber-500 to-amber-600 text-white'}`}
                >
                  {expandedStores ? 'Show Less' : 'Show More Stores'}
                  <span className={`text-lg leading-none transition ${expandedStores ? 'rotate-180' : ''}`}>▼</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Stats Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-[#0f0f14] rounded-2xl p-6 border border-white/6 hover:border-amber-500/30 transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-500/15 flex items-center justify-center">
                  <Phone className="w-8 h-8 text-amber-400" />
                </div>
                <span className="text-gray-400 text-sm font-medium">Total Calls</span>
              </div>
            </div>
            <div className="text-4xl font-serif font-bold text-white">{reports.length}</div>
          </div>

          <div className="bg-[#0f0f14] rounded-2xl p-6 border border-white/6 hover:border-green-500/30 transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-green-500/15 flex items-center justify-center">
                  <BarChart3 className="w-8 h-8 text-green-400" />
                </div>
                <span className="text-gray-400 text-sm font-medium">Analyzed</span>
              </div>
            </div>
            <div className="text-4xl font-serif font-bold text-white">{analyzedCount}</div>
          </div>

          {stats && (
            <>
              <div className="bg-[#0f0f14] rounded-2xl p-6 border border-white/6 hover:border-emerald-500/30 transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                      <span className="text-2xl">✓</span>
                    </div>
                    <span className="text-gray-400 text-sm font-medium">Conversions</span>
                  </div>
                </div>
                <div className="text-4xl font-serif font-bold text-emerald-400">{stats.converted_calls}</div>
              </div>

              <div className="bg-[#0f0f14] rounded-2xl p-6 border border-white/6 hover:border-blue-500/30 transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-blue-500/15 flex items-center justify-center">
                      <span className="text-2xl">%</span>
                    </div>
                    <span className="text-gray-400 text-sm font-medium">Conversion Rate</span>
                  </div>
                </div>
                <div className="text-4xl font-serif font-bold text-blue-400">{stats.conversion_rate}%</div>
              </div>
            </>
          )}
        </div>

        {/* Reports Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredReports.length === 0 && (
            <div className="col-span-full text-center text-gray-400 py-12">
              <Phone className="w-12 h-12 mx-auto text-gray-600 mb-4" />
              <p>No outbound calls found</p>
              <Link
                to="/outbound-calls/upload"
                className="mt-4 inline-block px-4 py-2 bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors text-white"
              >
                Upload First CSV
              </Link>
            </div>
          )}
          {filteredReports.map((report) => {
            const intent = getIntentRating(report);
            const score = getOverallScore(report);
            const analysis = report.analysis || {};
            // NEW SCHEMA: Extract commitment from Next_Action_Text or Recovery_Verdict
            const pillar4 = analysis.Pillar_4_Lead_Health || {};
            const summary = analysis.Summary || {};
            const commitment = pillar4.AIDA_Stage || summary.Recovery_Verdict || 
              getAnalysisField(analysis,
                'Pillar_4_Invitation_to_Convert.Commitment_Obtained',
                'PILLAR_4_INVITATION_TO_CONVERT.Commitment_Obtained',
                'Call_Analysis.PILLAR_4_INVITATION_TO_CONVERT.Commitment_Obtained',
                'PILLAR_4.Commitment_Obtained'
              ) || 'N/A';
            
            return (
              <Link
                key={report.call_id}
                to={`/outbound-calls/${report.call_id}`}
                className="group bg-[#0f0f14] border border-white/6 rounded-2xl p-6 hover:border-amber-500/50 transition-all overflow-hidden relative"
              >
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-amber-600 to-transparent opacity-0 group-hover:opacity-100 transition"></div>

                {/* Store Header */}
                <div className="mb-6 pb-6 border-b border-white/6">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-lg text-gray-100 group-hover:text-amber-400 transition" style={{ fontFamily: "'Fraunces', serif" }}>
                      {normalizeStoreName(report.store_name)}
                    </h3>
                    {isConvertedValue(report.is_converted) && (
                      <span className="px-3 py-1 bg-emerald-900/30 border border-emerald-600/40 rounded-full text-xs font-semibold text-emerald-300">
                        ✓ Converted
                      </span>
                    )}
                  </div>
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-semibold border ${getIntentColor(intent)}`}>
                    <span className="w-2 h-2 rounded-full bg-current"></span>
                    {intent} Intent
                  </div>
                </div>

                {/* Call ID */}
                <div className="mb-4">
                  <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Call ID</p>
                  <p className="font-mono text-sm text-gray-300">{report.call_id}</p>
                </div>

                {/* Call Info Row */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Date</p>
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <Calendar className="w-3 h-3" />
                      {report.call_date}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Duration</p>
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <Clock className="w-3 h-3" />
                      {report.duration}s
                    </div>
                  </div>
                </div>

                {/* Score & Commitment */}
                <div className="flex items-center justify-between pt-4 border-t border-white/6">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Commitment</p>
                    <p className="text-sm text-gray-300">{commitment}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Score</p>
                    <p className={`text-2xl font-bold ${score >= 4 ? 'text-emerald-400' : score >= 3 ? 'text-amber-400' : 'text-red-400'}`}>{score}</p>
                    <p className="text-xs text-gray-500">out of 5</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default OutboundCallsList;
