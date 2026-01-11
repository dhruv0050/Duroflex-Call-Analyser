import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Phone, MapPin, Calendar, Clock, LogOut, BarChart3, Upload } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://duroflex-call-analyser.onrender.com';

const CallReportsList = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState(null);

  const filterIds = location.state?.filterIds;
  const filterDescription = location.state?.filterDescription;

  useEffect(() => {
    fetchReports();
    fetchStats();
  }, []);

  const visibleReports = useMemo(() => {
    if (!filterIds || !Array.isArray(filterIds)) return reports;
    return reports.filter((r) => filterIds.includes(r.call_id));
  }, [reports, filterIds]);

  const fetchReports = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/call-reports`);
      const data = await res.json();
      setReports(data.reports || []);
    } catch (err) {
      setError('Failed to load call reports');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/call-reports/stats/overview`);
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

  const getIntentColor = (intent) => {
    if (!intent) return 'bg-gray-800 text-gray-400 border-gray-700';
    const upper = intent.toUpperCase();
    if (upper.includes('HIGH')) return 'bg-emerald-900/30 text-emerald-300 border-emerald-600/40';
    if (upper.includes('MEDIUM')) return 'bg-amber-900/30 text-amber-300 border-amber-600/40';
    return 'bg-red-900/30 text-red-300 border-red-600/40';
  };

  const [expandedStores, setExpandedStores] = useState(false);

  const ratingToScore = (value, fallback = 75) => {
    if (value === null || value === undefined) return fallback;
    const num = typeof value === 'number' ? value : parseFloat(value);
    if (isNaN(num)) return fallback;
    // If the rating is on a 0-5 scale, multiply by 20 to convert to 0-100
    return Math.round(num * 20);
  };

  const storePerformanceData = useMemo(() => {
    const storeMap = {};

    visibleReports.forEach((report) => {
      const storeName = report.store_name || 'Unknown';
      const storeKey = storeName;
      if (!storeMap[storeKey]) {
        storeMap[storeKey] = {
          storeName: report.store_name,
          city: report.city,
          state: report.state,
          calls: [],
        };
      }
      storeMap[storeKey].calls.push(report);
    });

    const performance = Object.values(storeMap)
      .map((store) => {
        const calls = store.calls;
        
        const processedCalls = calls.map((report) => {
          const analysis = report.analysis || {};
          const agent = analysis.Agent_Areas || {};
          const relax = agent.RELAX_Framework || {};
          const soft = agent.SoftSkills_Etiquette || {};
          const knowledge = agent.Verbal_Product_Knowledge || {};

          const reach = relax.R_Reach_Out?.Rating;
          const explore = relax.E_Explore_Needs?.Rating || relax.E_Explore?.Rating;
          const link = relax.L_Link_Experience?.Rating;
          const add = relax.A_Add_Value?.Rating;
          const close = relax.X_Express_Closing?.Rating;

          const rapportScore = ratingToScore(reach, 75);
          const exploreScore = ratingToScore(explore, 75);
          const listenScore = ratingToScore(link, 75);
          const adviseScore = ratingToScore(add, 75);
          const executeScore = ratingToScore(close, 75);

          const relaxScores = [rapportScore, exploreScore, listenScore, adviseScore, executeScore];
          const availableRelax = relaxScores.filter((s) => s !== undefined && s !== null);
          const overallRelax = availableRelax.length
            ? Math.round(availableRelax.reduce((a, b) => a + b, 0) / availableRelax.length)
            : 75;

          const productKnowledgeScore = ratingToScore(
            knowledge.Description_Quality_Rating || knowledge.Technical_Knowledge_Rating,
            75
          );

          const softSkillsScore = (() => {
            const parts = [
              ratingToScore(soft.Tone_and_Patience_Rating, null),
              ratingToScore(soft.Hold_Management_Rating, null),
              ratingToScore(soft.Agent_Language_Fluency_Score, null)
            ].filter((s) => s !== null);
            if (!parts.length) return 75;
            return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
          })();

          return {
            overall: overallRelax,
            rapport: rapportScore,
            explore: exploreScore,
            listen: listenScore,
            advise: adviseScore,
            execute: executeScore,
            productKnowledge: productKnowledgeScore,
            softSkills: softSkillsScore,
          };
        });

        const avgScore = (metric) => {
          const scores = processedCalls.map(c => c[metric]).filter(v => v !== undefined && v !== null);
          return scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
        };

        return {
          storeName: store.storeName,
          city: store.city,
          state: store.state,
          totalCalls: calls.length,
          overallScore: avgScore('overall'),
          rapport: avgScore('rapport'),
          explore: avgScore('explore'),
          listen: avgScore('listen'),
          advise: avgScore('advise'),
          execute: avgScore('execute'),
          productKnowledge: avgScore('productKnowledge'),
          softSkills: avgScore('softSkills'),
        };
      })
      .sort((a, b) => b.overallScore - a.overallScore);

    return performance;
  }, [visibleReports]);

  const topStores = storePerformanceData.slice(0, 10);
  const remainingStores = storePerformanceData.slice(10);

  const getScoreBgColor = (score) => {
    if (score >= 70) return 'text-emerald-400';
    if (score >= 50) return 'text-amber-400';
    return 'text-red-400';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#08080c] flex items-center justify-center">
        <div className="text-gray-300">Loading call reports...</div>
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
              to="/call-reports/upload"
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 rounded-lg text-purple-300 text-sm font-semibold transition"
            >
              <Upload className="w-4 h-4" />
              Upload CSV
            </Link>

            <Link
              to="/call-reports/analytics"
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
            Audio Call Reports
          </h1>
          <p className="text-sm text-gray-400">Comprehensive analysis of recorded call data</p>
        </div>

        {/* Store Performance Analysis */}
        {storePerformanceData.length > 0 && (
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl overflow-hidden mb-12">
            <div className="px-8 py-6 border-b border-[#2a2a2a]">
              <div className="flex items-center gap-4 mb-2">
                <span className="text-3xl">📊</span>
                <h2 className="text-2xl font-semibold text-white">Store Performance Analysis</h2>
              </div>
              <p className="text-slate-400 text-sm ml-14">RELAX Framework Scores & Key Metrics</p>
            </div>

            <div className="flex gap-8 px-8 py-6 bg-[#0a0a0a] border-b border-[#2a2a2a] overflow-x-auto">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Total Stores</p>
                <p className="text-2xl font-bold text-white">{storePerformanceData.length}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Total Calls</p>
                <p className="text-2xl font-bold text-white">{visibleReports.length}</p>
              </div>
              {storePerformanceData.length > 0 && (
                <>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Avg Score</p>
                    <p className="text-2xl font-bold text-white">{Math.round(storePerformanceData.reduce((sum, s) => sum + s.overallScore, 0) / storePerformanceData.length)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Top Score</p>
                    <p className="text-2xl font-bold text-emerald-400">{storePerformanceData[0]?.overallScore || 0}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Lowest Score</p>
                    <p className="text-2xl font-bold text-red-400">{storePerformanceData[storePerformanceData.length - 1]?.overallScore || 0}</p>
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
                    <th className="text-center px-6 py-5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Overall Score</th>
                    <th className="text-center px-6 py-5 text-xs font-semibold text-slate-400 uppercase tracking-wider">R</th>
                    <th className="text-center px-6 py-5 text-xs font-semibold text-slate-400 uppercase tracking-wider">E</th>
                    <th className="text-center px-6 py-5 text-xs font-semibold text-slate-400 uppercase tracking-wider">L</th>
                    <th className="text-center px-6 py-5 text-xs font-semibold text-slate-400 uppercase tracking-wider">A</th>
                    <th className="text-center px-6 py-5 text-xs font-semibold text-slate-400 uppercase tracking-wider">X</th>
                    <th className="text-center px-6 py-5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Product Knowledge</th>
                    <th className="text-center px-6 py-5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Soft Skills</th>
                  </tr>
                </thead>
                <tbody>
                  {(expandedStores ? storePerformanceData : topStores).map((store) => (
                    <tr key={store.storeName} className="border-b border-[#2a2a2a] hover:bg-[#252525] transition">
                      <td className="px-6 py-6">
                        <div className="font-semibold text-white text-base">{store.storeName}</div>
                        <div className="text-xs text-slate-500 mt-1">{store.city}, {store.state}</div>
                      </td>
                      <td className="text-center px-6 py-6">
                        <span className="text-slate-200 font-semibold text-base">{store.totalCalls}</span>
                      </td>
                      <td className="text-center px-6 py-6">
                        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-white font-bold text-sm" style={{ color: store.overallScore >= 70 ? '#10b981' : store.overallScore >= 50 ? '#f59e0b' : '#dc2626' }}>
                          {store.overallScore}
                        </div>
                      </td>
                      <td className="text-center px-6 py-6"><span className="font-semibold text-slate-300 text-base">{store.rapport}</span></td>
                      <td className="text-center px-6 py-6"><span className="font-semibold text-slate-300 text-base">{store.explore}</span></td>
                      <td className="text-center px-6 py-6"><span className="font-semibold text-slate-300 text-base">{store.listen}</span></td>
                      <td className="text-center px-6 py-6"><span className="font-semibold text-slate-300 text-base">{store.advise}</span></td>
                      <td className="text-center px-6 py-6"><span className="font-semibold text-slate-300 text-base">{store.execute}</span></td>
                      <td className="text-center px-6 py-6"><span className={`font-semibold text-base ${store.productKnowledge >= 70 ? 'text-emerald-400' : store.productKnowledge >= 50 ? 'text-amber-400' : 'text-red-400'}`}>{store.productKnowledge}</span></td>
                      <td className="text-center px-6 py-6"><span className={`font-semibold text-base ${store.softSkills >= 70 ? 'text-emerald-400' : store.softSkills >= 50 ? 'text-amber-400' : 'text-red-400'}`}>{store.softSkills}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {remainingStores.length > 0 && (
              <div className="text-center px-8 py-6 bg-[#1a1a1a] border-t border-[#2a2a2a]">
                <button
                  onClick={() => setExpandedStores(!expandedStores)}
                  className={`inline-flex items-center gap-3 px-8 py-3 rounded-lg font-semibold transition transform hover:-translate-y-0.5 ${expandedStores ? 'bg-gradient-to-r from-slate-600 to-slate-700 text-white' : 'bg-gradient-to-r from-blue-500 to-cyan-400 text-white'}`}
                >
                  {expandedStores ? 'Show Less' : 'Show More Stores'}
                  <span className={`text-lg leading-none transition ${expandedStores ? 'rotate-180' : ''}`}>▼</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Stats Header */}
        {stats && (
          <div className="grid grid-cols-3 gap-6 mb-6">
            <div className="bg-[#0f0f14] border border-white/6 rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-amber-600 to-transparent"></div>
              <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">Total Calls</div>
              <div className="text-4xl font-bold text-gray-100">{stats.total_calls}</div>
            </div>
            <div className="bg-[#0f0f14] border border-white/6 rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-emerald-600 to-transparent"></div>
              <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">Converted</div>
              <div className="text-4xl font-bold text-emerald-400">{stats.converted_calls}</div>
            </div>
            <div className="bg-[#0f0f14] border border-white/6 rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-blue-600 to-transparent"></div>
              <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">Conversion Rate</div>
              <div className="text-4xl font-bold text-blue-400">{stats.conversion_rate}%</div>
            </div>
          </div>
        )}

        {filterIds && (
          <div className="mb-6 flex items-center justify-between bg-amber-500/10 border border-amber-400/40 text-amber-100 rounded-xl px-4 py-3">
            <div className="text-sm font-semibold">
              Showing filtered results{filterDescription ? `: ${filterDescription}` : ''} ({visibleReports.length} of {reports.length})
            </div>
            <button
              onClick={() => navigate('/call-reports')}
              className="text-xs font-semibold px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-300/40"
            >
              Clear filter
            </button>
          </div>
        )}

        {/* Reports Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleReports.length === 0 && (
            <div className="col-span-full text-center text-gray-400 py-12">No reports match this filter.</div>
          )}
          {visibleReports.map((report) => {
            const analysis = report.analysis || {};
            const hasError = analysis.error;
            const functional = analysis.Functional || {};
            const customer = analysis.Customer_Information || {};
            
            return (
              <Link
                key={report.call_id}
                to={`/call-reports/${report.call_id}`}
                className="group bg-[#0f0f14] border border-white/6 rounded-2xl p-6 hover:border-amber-500/50 transition-all overflow-hidden relative"
              >
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-amber-600 to-transparent opacity-0 group-hover:opacity-100 transition"></div>

                {/* Store Header */}
                <div className="mb-6 pb-6 border-b border-white/6">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-lg text-gray-100 group-hover:text-amber-400 transition" style={{ fontFamily: "'Fraunces', serif" }}>
                      {report.store_name}
                    </h3>
                    {report.is_converted && (
                      <span className="px-3 py-1 bg-emerald-900/30 border border-emerald-600/40 rounded-full text-xs font-semibold text-emerald-300">
                        ✓ Converted
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <MapPin className="w-3 h-3" />
                    <span>{report.city}, {report.state}</span>
                  </div>
                </div>

                {/* Call ID */}
                <div className="mb-4">
                  <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Call ID</p>
                  <p className="font-mono text-sm text-gray-300">{report.call_id}</p>
                </div>

                {/* Call Info Row */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Date</p>
                    <div className="flex items-center gap-2 text-sm text-gray-200">
                      <Calendar className="w-4 h-4 text-gray-600" />
                      <span>{report.call_date}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Duration</p>
                    <div className="flex items-center gap-2 text-sm text-gray-200">
                      <Clock className="w-4 h-4 text-gray-600" />
                      <span>{Math.floor(report.duration_seconds / 60)}:{(report.duration_seconds % 60).toString().padStart(2, '0')}</span>
                    </div>
                  </div>
                </div>

                {hasError ? (
                  <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-3 text-xs text-red-300">
                    ⚠️ Analysis failed or pending
                  </div>
                ) : (
                  <>
                    {/* Intent Badges */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {customer.Intent_to_Purchase_Rating && (
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${getIntentColor(customer.Intent_to_Purchase_Rating)}`}>
                          Purchase: {customer.Intent_to_Purchase_Rating}
                        </span>
                      )}
                    </div>

                    {/* Satisfaction Score & Invited at Store */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-[#16161d] rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">Satisfaction</p>
                        <p className="text-lg font-bold text-amber-400">{customer.Customer_Satisfaction_Score !== undefined ? customer.Customer_Satisfaction_Score : 'N/A'}/5</p>
                      </div>
                      <div className="bg-[#16161d] rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">Invited to Store</p>
                        <p className={`text-sm font-semibold ${analysis.Agent_Areas?.The_Invitation_to_Visit?.Attempted ? 'text-emerald-400' : 'text-red-400'}`}>
                          {analysis.Agent_Areas?.The_Invitation_to_Visit?.Attempted ? '✓ Yes' : '✗ No'}
                        </p>
                      </div>
                    </div>

                    {/* Objective */}
                    {functional.Call_Objective_Theme && (
                      <div className="bg-[#16161d] rounded-lg p-3 mb-4">
                        <p className="text-xs text-gray-500 mb-1">Objective</p>
                        <p className="text-sm text-gray-300">{functional.Call_Objective_Theme}</p>
                      </div>
                    )}

                    {/* AIDA Stage */}
                    {customer.Customer_Stage_AIDA && (
                      <div className="bg-[#16161d] rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">Customer Stage</p>
                        <p className="text-sm text-amber-400 font-semibold">{customer.Customer_Stage_AIDA}</p>
                      </div>
                    )}
                  </>
                )}

                <div className="mt-6 pt-6 border-t border-white/6 text-right">
                  <span className="text-xs text-amber-400 group-hover:text-amber-300 font-semibold inline-flex items-center gap-1">
                    View Report
                    <svg className="w-4 h-4 group-hover:translate-x-1 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CallReportsList;
