import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Phone, MapPin, Calendar, Clock, LogOut, BarChart3, Upload } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://duroflex-call-analyser.onrender.com';

const AbcReportsList = () => {
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
      const res = await fetch(`${API_BASE}/api/abc-calls/reports`);
      const data = await res.json();
      setReports(data.reports || []);
    } catch (err) {
      setError('Failed to load ABC call reports');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/abc-calls/stats/overview`);
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
    return Math.round(num * 20);
  };

  const priceBucketData = useMemo(() => {
    // When coming from aggregated matrix/agent clicks with filters applied,
    // skip heavy performance calculations and summary UI.
    if (filterIds && Array.isArray(filterIds) && filterIds.length > 0) {
      return [];
    }

    // Define price buckets
    const buckets = [
      { label: '₹0 - ₹5,000', min: 0, max: 5000 },
      { label: '₹5,001 - ₹10,000', min: 5001, max: 10000 },
      { label: '₹10,001 - ₹15,000', min: 10001, max: 15000 },
      { label: '₹15,001 - ₹20,000', min: 15001, max: 20000 },
      { label: '₹20,000+', min: 20001, max: Infinity },
    ];

    const bucketMap = {};
    buckets.forEach(bucket => {
      bucketMap[bucket.label] = {
        label: bucket.label,
        calls: [],
      };
    });

    visibleReports.forEach((report) => {
      const cartValue = report.raw_data?.['Lineitem price'] || report.raw_data?.Lineitem_price || 0;
      const bucket = buckets.find(b => cartValue >= b.min && cartValue <= b.max);
      if (bucket && bucketMap[bucket.label]) {
        bucketMap[bucket.label].calls.push(report);
      }
    });

    const performance = Object.values(bucketMap)
      .filter(bucket => bucket.calls.length > 0) // Only show buckets with calls
      .map((bucket) => {
        const calls = bucket.calls;
        
        const processedCalls = calls.map((report) => {
          const analysis = report.analysis || {};
          const relax = analysis.RELAX_Framework || {};
          const skills = analysis.Experience_and_Skills || {};
          const softSkillsData = skills.Soft_Skills || {};

          const reach = relax.R_Reach_Out?.Score;
          const explore = relax.E_Explore?.Score;
          const link = relax.L_Link?.Score;
          const add = relax.A_Add_Value?.Score;
          const close = relax.X_Express?.Score;

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

          const empathy = softSkillsData.Empathy_Score || 3;
          const listening = softSkillsData.Active_Listening_Score || 3;
          const objection = softSkillsData.Objection_Handling_Score || 3;
          const softSkillsScore = ratingToScore((empathy + listening + objection) / 3, 75);
          const productKnowledgeScore = softSkillsScore;

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
          bucketName: bucket.label,
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
  }, [visibleReports, filterIds]);

  const cityPerformanceData = useMemo(() => {
    // When coming from aggregated matrix/agent clicks with filters applied,
    // skip heavy agent performance calculations and summary UI.
    if (filterIds && Array.isArray(filterIds) && filterIds.length > 0) {
      return [];
    }
    const agentMap = {};

    visibleReports.forEach((report) => {
      // Check multiple locations for agent name (prioritize CSV data as source of truth)
      const agentName = 
        report.agent_name ||                    // New field (for future uploads)
        report.raw_data?.AgentName ||           // CSV data (primary source)
        report.raw_data?.Agent_Name ||          // CSV data (alternative column)
        report.analysis?.Functional?.Agent_Name || // Gemini analysis (fallback)
        'Unknown Agent';
      
      const agentKey = agentName;
      if (!agentMap[agentKey]) {
        agentMap[agentKey] = {
          agentName: agentName,
          calls: [],
        };
      }
      agentMap[agentKey].calls.push(report);
    });

    const performance = Object.values(agentMap)
      .map((agent) => {
        const calls = agent.calls;
        
        const processedCalls = calls.map((report) => {
          const analysis = report.analysis || {};
          const relax = analysis.RELAX_Framework || {};
          const skills = analysis.Experience_and_Skills || {};
          const softSkillsData = skills.Soft_Skills || {};

          const reach = relax.R_Reach_Out?.Score;
          const explore = relax.E_Explore?.Score;
          const link = relax.L_Link?.Score;
          const add = relax.A_Add_Value?.Score;
          const close = relax.X_Express?.Score;

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

          // Calculate soft skills from the new prompt structure
          const empathy = softSkillsData.Empathy_Score || 3;
          const listening = softSkillsData.Active_Listening_Score || 3;
          const objection = softSkillsData.Objection_Handling_Score || 3;
          const softSkillsScore = ratingToScore((empathy + listening + objection) / 3, 75);
          const productKnowledgeScore = softSkillsScore; // Using soft skills as proxy

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
          storeName: agent.agentName,
          agentName: agent.agentName,
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
  }, [visibleReports, filterIds]);

  const topStores = cityPerformanceData.slice(0, 10);
  const remainingStores = cityPerformanceData.slice(10);

  const getScoreBgColor = (score) => {
    if (score >= 70) return 'text-emerald-400';
    if (score >= 50) return 'text-amber-400';
    return 'text-red-400';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#08080c] flex items-center justify-center">
        <div className="text-gray-300">Loading ABC reports...</div>
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
              to="/abc-calls/upload"
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 rounded-lg text-purple-300 text-sm font-semibold transition"
            >
              <Upload className="w-4 h-4" />
              Upload CSV
            </Link>

            <Link
              to="/abc-calls/analytics"
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
            ABC Cart Recovery Reports
          </h1>
          <p className="text-sm text-gray-400">Comprehensive analysis of abandoned cart recovery calls</p>
        </div>

        {/* Price Bucket Performance Analysis */}
        {priceBucketData.length > 0 && (
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl overflow-hidden mb-12">
            <div className="px-8 py-6 border-b border-[#2a2a2a]">
              <div className="flex items-center gap-4 mb-2">
                <span className="text-3xl">💰</span>
                <h2 className="text-2xl font-semibold text-white">Price Bucket Performance Analytics</h2>
              </div>
              <p className="text-slate-400 text-sm ml-14">RELAX Framework Scores by Cart Value Range</p>
            </div>

            <div className="flex gap-8 px-8 py-6 bg-[#0a0a0a] border-b border-[#2a2a2a] overflow-x-auto">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Total Buckets</p>
                <p className="text-2xl font-bold text-white">{priceBucketData.length}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Total Calls</p>
                <p className="text-2xl font-bold text-white">{priceBucketData.reduce((sum, b) => sum + b.totalCalls, 0)}</p>
              </div>
              {priceBucketData.length > 0 && (
                <>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Avg Score</p>
                    <p className="text-2xl font-bold text-white">{Math.round(priceBucketData.reduce((sum, s) => sum + s.overallScore, 0) / priceBucketData.length)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Top Score</p>
                    <p className="text-2xl font-bold text-emerald-400">{priceBucketData[0]?.overallScore || 0}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Lowest Score</p>
                    <p className="text-2xl font-bold text-red-400">{priceBucketData[priceBucketData.length - 1]?.overallScore || 0}</p>
                  </div>
                </>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#0a0a0a] border-b-2 border-[#2a2a2a]">
                  <tr>
                    <th className="text-left px-6 py-5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Price Bucket</th>
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
                  {priceBucketData.map((bucket) => (
                    <tr key={bucket.bucketName} className="border-b border-[#2a2a2a] hover:bg-[#252525] transition">
                      <td className="px-6 py-6">
                        <div className="font-semibold text-white text-base">{bucket.bucketName}</div>
                      </td>
                      <td className="text-center px-6 py-6">
                        <span className="text-slate-200 font-semibold text-base">{bucket.totalCalls}</span>
                      </td>
                      <td className="text-center px-6 py-6">
                        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-white font-bold text-sm" style={{ color: bucket.overallScore >= 70 ? '#10b981' : bucket.overallScore >= 50 ? '#f59e0b' : '#dc2626' }}>
                          {bucket.overallScore}
                        </div>
                      </td>
                      <td className="text-center px-6 py-6"><span className="font-semibold text-slate-300 text-base">{bucket.rapport}</span></td>
                      <td className="text-center px-6 py-6"><span className="font-semibold text-slate-300 text-base">{bucket.explore}</span></td>
                      <td className="text-center px-6 py-6"><span className="font-semibold text-slate-300 text-base">{bucket.listen}</span></td>
                      <td className="text-center px-6 py-6"><span className="font-semibold text-slate-300 text-base">{bucket.advise}</span></td>
                      <td className="text-center px-6 py-6"><span className="font-semibold text-slate-300 text-base">{bucket.execute}</span></td>
                      <td className="text-center px-6 py-6"><span className={`font-semibold text-base ${bucket.productKnowledge >= 70 ? 'text-emerald-400' : bucket.productKnowledge >= 50 ? 'text-amber-400' : 'text-red-400'}`}>{bucket.productKnowledge}</span></td>
                      <td className="text-center px-6 py-6"><span className={`font-semibold text-base ${bucket.softSkills >= 70 ? 'text-emerald-400' : bucket.softSkills >= 50 ? 'text-amber-400' : 'text-red-400'}`}>{bucket.softSkills}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Agent Performance Analysis */}
        {cityPerformanceData.length > 0 && (
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl overflow-hidden mb-12">
            <div className="px-8 py-6 border-b border-[#2a2a2a]">
              <div className="flex items-center gap-4 mb-2">
                <span className="text-3xl">📊</span>
                <h2 className="text-2xl font-semibold text-white">Agent Performance Analytics</h2>
              </div>
              <p className="text-slate-400 text-sm ml-14">RELAX Framework Scores & Key Metrics</p>
            </div>

            <div className="flex gap-8 px-8 py-6 bg-[#0a0a0a] border-b border-[#2a2a2a] overflow-x-auto">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Total Agents</p>
                <p className="text-2xl font-bold text-white">{cityPerformanceData.length}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Total Calls</p>
                <p className="text-2xl font-bold text-white">{visibleReports.length}</p>
              </div>
              {cityPerformanceData.length > 0 && (
                <>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Avg Score</p>
                    <p className="text-2xl font-bold text-white">{Math.round(cityPerformanceData.reduce((sum, s) => sum + s.overallScore, 0) / cityPerformanceData.length)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Top Score</p>
                    <p className="text-2xl font-bold text-emerald-400">{cityPerformanceData[0]?.overallScore || 0}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Lowest Score</p>
                    <p className="text-2xl font-bold text-red-400">{cityPerformanceData[cityPerformanceData.length - 1]?.overallScore || 0}</p>
                  </div>
                </>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#0a0a0a] border-b-2 border-[#2a2a2a]">
                  <tr>
                    <th className="text-left px-6 py-5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Agent Name</th>
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
                  {(expandedStores ? cityPerformanceData : topStores).map((store) => (
                    <tr key={store.storeName} className="border-b border-[#2a2a2a] hover:bg-[#252525] transition">
                      <td className="px-6 py-6">
                        <div className="font-semibold text-white text-base">{store.storeName}</div>
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
                  {expandedStores ? 'Show Less' : 'Show More Agents'}
                  <span className={`text-lg leading-none transition ${expandedStores ? 'rotate-180' : ''}`}>▼</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Stats Cards Row - only for unfiltered view */}
        {!filterIds && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {/* Total Calls */}
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

            {/* Analyzed */}
            <div className="bg-[#0f0f14] rounded-2xl p-6 border border-white/6 hover:border-green-500/30 transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-green-500/15 flex items-center justify-center">
                    <BarChart3 className="w-8 h-8 text-green-400" />
                  </div>
                  <span className="text-gray-400 text-sm font-medium">Analyzed</span>
                </div>
              </div>
              <div className="text-4xl font-serif font-bold text-white">
                {reports.filter(r => r.analysis && !r.analysis.error).length}
              </div>
            </div>

            {/* Pending Analysis */}
            <div className="bg-[#0f0f14] rounded-2xl p-6 border border-white/6 hover:border-orange-500/30 transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-orange-500/15 flex items-center justify-center">
                    <Clock className="w-8 h-8 text-orange-400" />
                  </div>
                  <span className="text-gray-400 text-sm font-medium">Pending Analysis</span>
                </div>
              </div>
              <div className="text-4xl font-serif font-bold text-white">
                {reports.length - reports.filter(r => r.analysis && !r.analysis.error).length}
              </div>
            </div>
          </div>
        )}

        {filterIds && (
          <div className="mb-6 flex items-center justify-between bg-amber-500/10 border border-amber-400/40 text-amber-100 rounded-xl px-4 py-3">
            <div className="text-sm font-semibold">
              Showing filtered results{filterDescription ? `: ${filterDescription}` : ''} ({visibleReports.length} of {reports.length})
            </div>
            <button
              onClick={() => navigate('/abc-calls')}
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
            const pillar1 = analysis.Pillar_1_Customer_Intent_and_Barriers || {};
            const pillar2 = analysis.Pillar_2_Experience_Delivered || {};
            const pillar4 = analysis.Pillar_4_Invitation_to_Convert || {};
            const summary = analysis.Overall_Summary || {};
            const rawData = report.raw_data || {};
            
            // Get cart value
            const cartValue = rawData['Lineitem price'] || rawData.Lineitem_price || 0;
            
            // Get duration from call time or default
            const callTime = functional.Call_Time || '00:00';
            const timeParts = callTime.split(':');
            const minutes = parseInt(timeParts[0]) || 0;
            const seconds = parseInt(timeParts[1]) || 0;
            const durationSeconds = minutes * 60 + seconds;

            const rawIntent = pillar1.Intent_to_Purchase_Rating || 'MEDIUM';
            const intentUpper = rawIntent.toString().toUpperCase();
            let intentLevel = 'Medium';
            if (intentUpper.includes('HIGH')) intentLevel = 'High';
            else if (intentUpper.includes('LOW')) intentLevel = 'Low';

            const expRaw = pillar2.Overall_Experience_Rating || 3;
            const expNum = typeof expRaw === 'number' ? expRaw : parseFloat(expRaw) || 3;
            let experienceLevel = 'Medium';
            if (expNum >= 4) experienceLevel = 'High';
            else if (expNum <= 2) experienceLevel = 'Low';

            const levelColor = (level) => {
              if (level === 'High') return 'text-emerald-400';
              if (level === 'Medium') return 'text-amber-400';
              return 'text-red-400';
            };
            
            return (
              <Link
                key={report.call_id}
                to={`/abc-calls/${report.call_id}`}
                className="group bg-[#0f0f14] border border-white/6 rounded-2xl p-6 hover:border-amber-500/50 transition-all overflow-hidden relative"
              >
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-amber-600 to-transparent opacity-0 group-hover:opacity-100 transition"></div>

                {/* Store Header - Using City as "Store" */}
                <div className="mb-6 pb-6 border-b border-white/6">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-lg text-gray-100 group-hover:text-amber-400 transition" style={{ fontFamily: "'Fraunces', serif" }}>
                      {report.city || functional.Store_Location || 'UNKNOWN CITY'}
                    </h3>
                    {rawData.is_Converted === 1 && (
                      <span className="px-3 py-1 bg-emerald-900/30 border border-emerald-600/40 rounded-full text-xs font-semibold text-emerald-300">
                        ✓ Converted
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <MapPin className="w-3 h-3" />
                    <span>{report.city || 'Unknown'}, INDIA</span>
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
                      <span>{report.processed_at ? new Date(report.processed_at).toLocaleDateString() : 'N/A'}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Duration</p>
                    <div className="flex items-center gap-2 text-sm text-gray-200">
                      <Clock className="w-4 h-4 text-gray-600" />
                      <span>{Math.floor(durationSeconds / 60)}:{(durationSeconds % 60).toString().padStart(2, '0')}</span>
                    </div>
                  </div>
                </div>

                {hasError ? (
                  <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-3 text-xs text-red-300">
                    ⚠️ Analysis failed or pending
                  </div>
                ) : (
                  <>
                    {/* Intent & Customer Experience Levels */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-[#16161d] rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">Intent to Purchase</p>
                        <p className={`text-sm font-semibold ${levelColor(intentLevel)}`}>{intentLevel}</p>
                      </div>
                      <div className="bg-[#16161d] rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">Customer Experience</p>
                        <p className={`text-sm font-semibold ${levelColor(experienceLevel)}`}>
                          {experienceLevel} <span className="text-gray-400 text-xs">({expNum}/5)</span>
                        </p>
                      </div>
                    </div>

                    {/* Satisfaction Score */}
                    <div className="bg-[#16161d] rounded-lg p-3 mb-4">
                      <p className="text-xs text-gray-500 mb-1">Satisfaction Score</p>
                      <p className="text-lg font-bold text-amber-400">{pillar2.Overall_Experience_Rating || 3}/5</p>
                    </div>

                    {/* Objective */}
                    <div className="bg-[#16161d] rounded-lg p-3 mb-4">
                      <p className="text-xs text-gray-500 mb-1">Objective</p>
                      <p className="text-sm text-gray-300">{functional.Call_Outcome || 'Cart Recovery'}</p>
                    </div>
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

export default AbcReportsList;
