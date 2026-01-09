import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, TrendingUp, Users, Video, ArrowLeft, Filter, Calendar, ChevronDown, Download } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://duroflex-call-analyser.onrender.com';

// Flatten nested JSON objects into a single-level map suitable for CSV export
const flattenObject = (obj, prefix = '') => {
  const result = {};
  Object.entries(obj || {}).forEach(([key, value]) => {
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, newKey));
    } else if (Array.isArray(value)) {
      const normalized = value.map((item) => (item && typeof item === 'object' ? JSON.stringify(item) : item));
      result[newKey] = normalized.join('; ');
    } else {
      result[newKey] = value;
    }
  });
  return result;
};

const toCsvValue = (value) => {
  if (value === null || value === undefined) return '';
  const str = String(value).replace(/"/g, '""');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str}"`;
  }
  return str;
};

const exportReportsAsCsv = (reports, filename) => {
  if (!reports || !reports.length) {
    alert('No reports to download');
    return;
  }

  const flattened = reports.map((r) => flattenObject(r));
  const headers = Array.from(new Set(flattened.flatMap((item) => Object.keys(item))));

  const rows = [headers.join(',')];
  flattened.forEach((item) => {
    const row = headers.map((h) => toCsvValue(item[h]));
    rows.push(row.join(','));
  });

  const csvContent = rows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const VideoAggregatedDashboard = () => {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState('last30');
  const [view, setView] = useState('overall');
  const [selectedRegion, setSelectedRegion] = useState('South');
  const [selectedCity, setSelectedCity] = useState('Bangalore');
  const [selectedStore, setSelectedStore] = useState('');
  const [storePeriod, setStorePeriod] = useState('week');
  const [allCalls, setAllCalls] = useState([]);
  const [loading, setLoading] = useState(true);

  const handleDownloadReports = () => {
    exportReportsAsCsv(allCalls, 'video_reports.csv');
  };

  useEffect(() => {
    const fetchVideoCalls = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE}/api/video-reports`);
        const data = await response.json();
        if (data.status === 'success' && data.reports) {
          setAllCalls(data.reports);
        }
      } catch (error) {
        console.error('Error fetching video calls:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchVideoCalls();
  }, []);

  const normalizeIntent = (rating) => {
    if (!rating) return 'Low';
    const upper = rating.toUpperCase();
    if (upper === 'HIGH') return 'High';
    if (upper === 'MED' || upper === 'MEDIUM') return 'Medium';
    return 'Low';
  };

  const normalizeExperience = (score) => {
    if (!score) return 'Poor';
    const numScore = typeof score === 'number' ? score : parseInt(score);
    if (numScore >= 4) return 'Excellent';
    if (numScore === 3) return 'Good';
    if (numScore === 2) return 'Fair';
    return 'Poor';
  };

  const deriveType = (objective) => {
    if (!objective) return 'General';
    const lower = objective.toLowerCase();
    if (lower.includes('product')) return 'Product Inquiry';
    if (lower.includes('visit')) return 'Visit Request';
    if (lower.includes('demo')) return 'Demo Request';
    return 'General';
  };

  const ratingToScore = (value, fallback = 75) => {
    if (typeof value === 'number') return (value / 5) * 100;
    if (typeof value === 'string') {
      const upper = value.toUpperCase();
      if (upper === 'HIGH') return 90;
      if (upper === 'MED' || upper === 'MEDIUM') return 70;
      if (upper === 'LOW') return 40;
    }
    return fallback;
  };

  const videoCalls = useMemo(() => {
    return allCalls
      .filter((call) => call.analyzed && call.analysis_data)
      .map((call) => {
        const analysis = call.analysis_data || {};
        const functional = analysis.Functional || {};
        const customer = analysis.Customer_Information || {};
        const agentAreas = analysis.Agent_Areas || {};
        const productDemo = agentAreas.Product_Demonstration || {};
        const relaxFramework = agentAreas.RELAX_Framework || {};
        const softSkills = agentAreas.SoftSkills || {};
        const invitation = agentAreas.The_Invitation_to_Visit || {};

        // Extract store location properly
        const storeLocation = functional.Store_Location || call.store_name || 'Unknown Store';

        // Determine region based on store location
        const region = storeLocation.includes('Bangalore') || storeLocation.includes('INDIRANAGAR') || storeLocation.includes('Hyderabad') || storeLocation.includes('Chennai') || storeLocation.includes('ADYAR') || storeLocation.includes('COCHIN') ? 'South' :
                      storeLocation.includes('Mumbai') || storeLocation.includes('Pune') ? 'West' :
                      storeLocation.includes('Delhi') || storeLocation.includes('LAJPAT') ? 'North' :
                      storeLocation.includes('Kolkata') ? 'East' : 'South';

        const city = storeLocation.includes('Bangalore') || storeLocation.includes('INDIRANAGAR') ? 'Bangalore' :
                    storeLocation.includes('Mumbai') ? 'Mumbai' :
                    storeLocation.includes('Delhi') || storeLocation.includes('LAJPAT') ? 'Delhi' :
                    storeLocation.includes('Hyderabad') ? 'Hyderabad' :
                    storeLocation.includes('Chennai') || storeLocation.includes('ADYAR') ? 'Chennai' : 'Bangalore';

        // Calculate RELAX score properly
        const relaxRatings = [
          relaxFramework.R_Reach_Out?.Rating,
          relaxFramework.E_Explore_Needs?.Rating,
          relaxFramework.L_Link_Demo?.Rating,
          relaxFramework.A_Add_Value?.Rating,
          relaxFramework.X_Express_Offers?.Rating
        ].filter(r => typeof r === 'number');
        
        const relaxScore = relaxRatings.length > 0 
          ? relaxRatings.reduce((sum, r) => sum + r, 0) / relaxRatings.length 
          : 0;

        // Calculate soft skills score properly
        const softSkillRatings = [
          softSkills.Active_Listening_Rating,
          softSkills.Empathy_Rapport_Rating,
          softSkills.Clarity_Confidence_Rating,
          softSkills.Objection_Handling_Rating,
          softSkills.Hold_and_Dead_Air_Management_Rating
        ].filter(r => typeof r === 'number');
        
        const softSkillScore = softSkillRatings.length > 0
          ? softSkillRatings.reduce((sum, r) => sum + r, 0) / softSkillRatings.length
          : 0;

        // Calculate product demo score (average of all demo ratings)
        const demoRatings = [
          productDemo.Quality_Rating,
          productDemo.Relevance_Rating,
          productDemo.Video_Audio_Quality_Rating,
          productDemo.Effectiveness_Rating,
          productDemo.Customer_Engagement_Rating
        ].filter(r => typeof r === 'number');
        
        const productDemoScore = demoRatings.length > 0
          ? demoRatings.reduce((sum, r) => sum + r, 0) / demoRatings.length
          : 0;

        return {
          id: call.report_id,
          region,
          city,
          store: storeLocation,
          type: deriveType(functional.Call_Objective_Theme),
          intent: normalizeIntent(customer.Intent_to_Purchase_Rating),
          experience: normalizeExperience(customer.Customer_Satisfaction_Score),
          productDemoScore: productDemoScore,
          relaxScore: relaxScore,
          softSkillScore: softSkillScore,
          invitationAttempted: invitation.Attempted || false,
          invitationQuality: invitation.Quality_Rating || 0,
          customerSatisfaction: customer.Customer_Satisfaction_Score || 0,
          businessSatisfaction: customer.Business_Satisfaction_Score || 0,
          callObjective: functional.Call_Objective_Theme || 'General',
          callTime: functional.Call_Time || 'N/A',
          customerName: functional.Customer_Name || 'N/A',
          agentName: functional.Agent_Name || 'N/A'
        };
      });
  }, [allCalls]);

  const filteredCalls = useMemo(() => {
    let filtered = [...videoCalls];
    
    // Apply time range filter
    if (timeRange === 'last7') {
      filtered = filtered.slice(-7);
    } else if (timeRange === 'last30') {
      filtered = filtered.slice(-30);
    } else if (timeRange === 'last90') {
      filtered = filtered.slice(-90);
    }
    // 'ytd' - no filtering (defaults to all calls)
    
    // Apply view-based filters
    if (view === 'regional') {
      filtered = filtered.filter((c) => c.region === selectedRegion);
    } else if (view === 'city') {
      filtered = filtered.filter((c) => c.city === selectedCity);
    } else if (view === 'store' && selectedStore) {
      // Only filter by store if a specific store is selected
      filtered = filtered.filter((c) => c.store === selectedStore);
    }
    return filtered;
  }, [videoCalls, view, selectedRegion, selectedCity, selectedStore, timeRange]);

  const metrics = useMemo(() => {
    const total = filteredCalls.length;
    if (total === 0) {
      return {
        total: 0,
        avgProductDemo: 0,
        avgRelax: 0,
        avgSoftSkills: 0,
        avgInvitation: 0,
        invitationAttemptRate: 0,
        avgCustomerSat: 0,
        avgBusinessSat: 0,
        intentBreakdown: { High: 0, Medium: 0, Low: 0 },
        experienceBreakdown: { Excellent: 0, Good: 0, Fair: 0, Poor: 0 },
        typeBreakdown: {},
        matrix: {},
        storePerformance: {}
      };
    }

    const avgProductDemo = filteredCalls.reduce((sum, c) => sum + c.productDemoScore, 0) / total;
    const avgRelax = filteredCalls.reduce((sum, c) => sum + c.relaxScore, 0) / total;
    const avgSoftSkills = filteredCalls.reduce((sum, c) => sum + c.softSkillScore, 0) / total;
    const avgInvitation = filteredCalls.reduce((sum, c) => sum + c.invitationQuality, 0) / total;
    const invitationAttemptRate = (filteredCalls.filter(c => c.invitationAttempted).length / total) * 100;
    const avgCustomerSat = filteredCalls.reduce((sum, c) => sum + c.customerSatisfaction, 0) / total;
    const avgBusinessSat = filteredCalls.reduce((sum, c) => sum + c.businessSatisfaction, 0) / total;

    const intentBreakdown = filteredCalls.reduce((acc, c) => {
      acc[c.intent] = (acc[c.intent] || 0) + 1;
      return acc;
    }, { High: 0, Medium: 0, Low: 0 });

    const experienceBreakdown = filteredCalls.reduce((acc, c) => {
      acc[c.experience] = (acc[c.experience] || 0) + 1;
      return acc;
    }, { Excellent: 0, Good: 0, Fair: 0, Poor: 0 });

    const typeBreakdown = filteredCalls.reduce((acc, c) => {
      acc[c.type] = (acc[c.type] || 0) + 1;
      return acc;
    }, {});

    const matrix = {};
    filteredCalls.forEach((c) => {
      if (!matrix[c.intent]) matrix[c.intent] = {};
      matrix[c.intent][c.experience] = (matrix[c.intent][c.experience] || 0) + 1;
    });

    const storePerformance = filteredCalls.reduce((acc, call) => {
      if (!acc[call.store]) {
        acc[call.store] = {
          count: 0,
          avgProductDemo: 0,
          avgRelax: 0,
          avgSoftSkills: 0,
          avgInvitation: 0,
          avgCustomerSat: 0,
          invitationAttempts: 0
        };
      }
      acc[call.store].count += 1;
      acc[call.store].avgProductDemo += call.productDemoScore;
      acc[call.store].avgRelax += call.relaxScore;
      acc[call.store].avgSoftSkills += call.softSkillScore;
      acc[call.store].avgInvitation += call.invitationQuality;
      acc[call.store].avgCustomerSat += call.customerSatisfaction;
      if (call.invitationAttempted) acc[call.store].invitationAttempts += 1;
      return acc;
    }, {});

    Object.keys(storePerformance).forEach((store) => {
      const count = storePerformance[store].count;
      storePerformance[store].avgProductDemo = (storePerformance[store].avgProductDemo / count).toFixed(1);
      storePerformance[store].avgRelax = (storePerformance[store].avgRelax / count).toFixed(1);
      storePerformance[store].avgSoftSkills = (storePerformance[store].avgSoftSkills / count).toFixed(1);
      storePerformance[store].avgInvitation = (storePerformance[store].avgInvitation / count).toFixed(1);
      storePerformance[store].avgCustomerSat = (storePerformance[store].avgCustomerSat / count).toFixed(1);
      storePerformance[store].invitationRate = ((storePerformance[store].invitationAttempts / count) * 100).toFixed(0);
    });

    return {
      total,
      avgProductDemo,
      avgRelax,
      avgSoftSkills,
      avgInvitation,
      invitationAttemptRate,
      avgCustomerSat,
      avgBusinessSat,
      intentBreakdown,
      experienceBreakdown,
      typeBreakdown,
      matrix,
      storePerformance
    };
  }, [filteredCalls]);

  const getScoreColor = (score) => {
    if (score >= 4) return 'text-green-400';
    if (score >= 3) return 'text-amber-400';
    return 'text-red-400';
  };

  const getScoreBg = (score) => {
    if (score >= 4) return 'bg-green-500/10 border-green-500/30';
    if (score >= 3) return 'bg-amber-500/10 border-amber-500/30';
    return 'bg-red-500/10 border-red-500/30';
  };

  const getMatrixColor = (count, max) => {
    const intensity = count / max;
    if (intensity > 0.7) return 'bg-green-500/30 border-green-500/50';
    if (intensity > 0.4) return 'bg-amber-500/30 border-amber-500/50';
    if (intensity > 0.1) return 'bg-orange-500/20 border-orange-500/40';
    return 'bg-gray-700/20 border-gray-600/30';
  };

  const maxMatrixValue = Math.max(...Object.values(metrics.matrix).flatMap((row) => Object.values(row)), 1);

  const storeAnalysis = useMemo(() => {
    if (!selectedStore) return null;
    const storeData = metrics.storePerformance[selectedStore];
    if (!storeData) return null;

    const storeCalls = filteredCalls.filter((c) => c.store === selectedStore);
    
    let filteredStoreCalls = storeCalls;
    const now = new Date();
    if (storePeriod === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filteredStoreCalls = storeCalls.filter(() => true);
    } else if (storePeriod === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filteredStoreCalls = storeCalls.filter(() => true);
    }

    const intentDist = filteredStoreCalls.reduce((acc, c) => {
      acc[c.intent] = (acc[c.intent] || 0) + 1;
      return acc;
    }, { High: 0, Medium: 0, Low: 0 });

    const experienceDist = filteredStoreCalls.reduce((acc, c) => {
      acc[c.experience] = (acc[c.experience] || 0) + 1;
      return acc;
    }, { Excellent: 0, Good: 0, Fair: 0, Poor: 0 });

    const typeDist = filteredStoreCalls.reduce((acc, c) => {
      acc[c.type] = (acc[c.type] || 0) + 1;
      return acc;
    }, {});

    const topAgents = filteredStoreCalls.reduce((acc, c) => {
      if (!acc[c.agentName]) {
        acc[c.agentName] = { count: 0, avgRelax: 0, avgSoftSkills: 0 };
      }
      acc[c.agentName].count += 1;
      acc[c.agentName].avgRelax += c.relaxScore;
      acc[c.agentName].avgSoftSkills += c.softSkillScore;
      return acc;
    }, {});

    Object.keys(topAgents).forEach((agent) => {
      const count = topAgents[agent].count;
      topAgents[agent].avgRelax = (topAgents[agent].avgRelax / count).toFixed(1);
      topAgents[agent].avgSoftSkills = (topAgents[agent].avgSoftSkills / count).toFixed(1);
    });

    const sortedAgents = Object.entries(topAgents)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5);

    return {
      ...storeData,
      intentDist,
      experienceDist,
      typeDist,
      topAgents: sortedAgents,
      recentCalls: filteredStoreCalls.slice(-10).reverse()
    };
  }, [selectedStore, storePeriod, filteredCalls, metrics.storePerformance]);

  const regions = ['South', 'West', 'North', 'East'];
  const cities = ['Bangalore', 'Mumbai', 'Hyderabad', 'Chennai', 'Delhi'];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#08080c] flex items-center justify-center text-white">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-lg text-gray-400">Loading video analytics...</p>
        </div>
      </div>
    );
  }

  if (!videoCalls.length) {
    return (
      <div className="min-h-screen bg-[#08080c] text-white p-8">
        <div className="max-w-7xl mx-auto">
          <button
            onClick={() => navigate('/video-reports')}
            className="flex items-center gap-2 text-amber-400 hover:text-amber-300 mb-6"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Video Reports</span>
          </button>
          <div className="text-center py-16">
            <Video className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-xl text-gray-400">No analyzed video calls available</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08080c] text-white relative">
      {/* Grain overlay */}
      <div
        className="pointer-events-none fixed inset-0 opacity-10 mix-blend-soft-light"
        style={{
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")"
        }}
      />

      <div className="max-w-[1600px] mx-auto px-6 py-8 space-y-8 relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={() => navigate('/video-reports')}
              className="flex items-center gap-2 text-amber-400 hover:text-amber-300 mb-4 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Back to Video Reports</span>
            </button>
            <h1 className="text-4xl font-['Fraunces',serif] font-bold tracking-tight mb-2">Video Call Analytics</h1>
            <p className="text-gray-400 text-lg">Performance insights and metrics across all video interactions</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadReports}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-gray-900 px-4 py-2 rounded-lg font-semibold text-sm shadow-lg transition"
            >
              <Download className="w-4 h-4" />
              Download All Reports
            </button>
            <div className="flex items-center gap-3 bg-[#0f0f14] border border-white/10 rounded-xl px-4 py-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="bg-transparent text-sm font-medium cursor-pointer outline-none text-gray-200"
                style={{ colorScheme: 'dark' }}
              >
                <option value="last7" className="bg-[#0f0f14] text-gray-200">Last 7 Days</option>
                <option value="last30" className="bg-[#0f0f14] text-gray-200">Last 30 Days</option>
                <option value="last90" className="bg-[#0f0f14] text-gray-200">Last 90 Days</option>
                <option value="ytd" className="bg-[#0f0f14] text-gray-200">Year to Date</option>
              </select>
              <ChevronDown className="w-4 h-4 text-gray-500" />
            </div>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 bg-[#0f0f14] rounded-xl p-1 border border-white/10">
            {[
              { value: 'overall', label: 'Overall' },
              { value: 'regional', label: 'Regional' },
              { value: 'city', label: 'City' },
              { value: 'store', label: 'Store' }
            ].map((v) => (
              <button
                key={v.value}
                onClick={() => setView(v.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  view === v.value
                    ? 'bg-amber-500 text-[#0b0b10]'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>

          {view === 'regional' && (
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="px-4 py-2 bg-[#0f0f14] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500/50"
            >
              {regions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          )}

          {view === 'city' && (
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="px-4 py-2 bg-[#0f0f14] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500/50"
            >
              {cities.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}

          {view === 'store' && (
            <>
              <select
                value={selectedStore}
                onChange={(e) => setSelectedStore(e.target.value)}
                className="px-4 py-2 bg-[#0f0f14] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500/50"
              >
                <option value="">Select Store</option>
                {Object.keys(metrics.storePerformance).map((store) => (
                  <option key={store} value={store}>{store}</option>
                ))}
              </select>
              {selectedStore && (
                <select
                  value={storePeriod}
                  onChange={(e) => setStorePeriod(e.target.value)}
                  className="px-4 py-2 bg-[#0f0f14] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500/50"
                >
                  <option value="week">Last Week</option>
                  <option value="month">Last Month</option>
                  <option value="all">All Time</option>
                </select>
              )}
            </>
          )}
        </div>

        {/* Key Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="rounded-2xl bg-[#0f0f14] border border-white/10 p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm uppercase tracking-wider text-gray-500">Total Video Calls</span>
              <Video className="w-6 h-6 text-purple-400" />
            </div>
            <div className="text-4xl font-['Fraunces',serif] font-bold text-white">{metrics.total}</div>
            <div className="mt-2 text-xs text-gray-400">Analyzed sessions</div>
          </div>

          <div className="rounded-2xl bg-[#0f0f14] border border-white/10 p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm uppercase tracking-wider text-gray-500">Avg Product Demo</span>
              <BarChart3 className="w-6 h-6 text-green-400" />
            </div>
            <div className={`text-4xl font-['Fraunces',serif] font-bold ${getScoreColor(metrics.avgProductDemo)}`}>
              {metrics.avgProductDemo.toFixed(1)}<span className="text-xl text-gray-500">/5</span>
            </div>
            <div className="mt-2 text-xs text-gray-400">Visual demo quality</div>
          </div>

          <div className="rounded-2xl bg-[#0f0f14] border border-white/10 p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm uppercase tracking-wider text-gray-500">Avg RELAX Score</span>
              <TrendingUp className="w-6 h-6 text-amber-400" />
            </div>
            <div className={`text-4xl font-['Fraunces',serif] font-bold ${getScoreColor(metrics.avgRelax)}`}>
              {metrics.avgRelax.toFixed(1)}<span className="text-xl text-gray-500">/5</span>
            </div>
            <div className="mt-2 text-xs text-gray-400">Sales methodology</div>
          </div>

          <div className="rounded-2xl bg-[#0f0f14] border border-white/10 p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm uppercase tracking-wider text-gray-500">Visit Invitations</span>
              <Users className="w-6 h-6 text-green-400" />
            </div>
            <div className="text-4xl font-['Fraunces',serif] font-bold text-green-400">
              {metrics.invitationAttemptRate.toFixed(0)}<span className="text-xl text-gray-500">%</span>
            </div>
            <div className="mt-2 text-xs text-gray-400">Attempt rate</div>
          </div>
        </div>

        {/* Secondary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-2xl bg-[#0f0f14] border border-white/10 p-6">
            <span className="text-sm uppercase tracking-wider text-gray-500 block mb-4">Avg Soft Skills</span>
            <div className={`text-3xl font-['Fraunces',serif] font-bold ${getScoreColor(metrics.avgSoftSkills)}`}>
              {metrics.avgSoftSkills.toFixed(1)}<span className="text-lg text-gray-500">/5</span>
            </div>
          </div>

          <div className="rounded-2xl bg-[#0f0f14] border border-white/10 p-6">
            <span className="text-sm uppercase tracking-wider text-gray-500 block mb-4">Customer Satisfaction</span>
            <div className={`text-3xl font-['Fraunces',serif] font-bold ${getScoreColor(metrics.avgCustomerSat)}`}>
              {metrics.avgCustomerSat.toFixed(1)}<span className="text-lg text-gray-500">/5</span>
            </div>
          </div>

          <div className="rounded-2xl bg-[#0f0f14] border border-white/10 p-6">
            <span className="text-sm uppercase tracking-wider text-gray-500 block mb-4">Business Satisfaction</span>
            <div className={`text-3xl font-['Fraunces',serif] font-bold ${getScoreColor(metrics.avgBusinessSat)}`}>
              {metrics.avgBusinessSat.toFixed(1)}<span className="text-lg text-gray-500">/5</span>
            </div>
          </div>
        </div>

        {/* Intent Breakdown */}
        <div className="rounded-2xl bg-[#0f0f14] border border-white/10 p-7">
          <h2 className="text-xl font-['Fraunces',serif] font-semibold mb-6">Purchase Intent Distribution</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.entries(metrics.intentBreakdown).map(([intent, count]) => {
              const percentage = metrics.total > 0 ? ((count / metrics.total) * 100).toFixed(1) : 0;
              const colorClass = intent === 'High' ? 'text-green-400 border-green-500/30 bg-green-500/10' :
                                intent === 'Medium' ? 'text-amber-400 border-amber-500/30 bg-amber-500/10' :
                                'text-red-400 border-red-500/30 bg-red-500/10';
              return (
                <div key={intent} className={`rounded-xl border p-6 ${colorClass}`}>
                  <div className="text-sm uppercase tracking-wider mb-2">{intent} Intent</div>
                  <div className={`text-4xl font-['Fraunces',serif] font-bold mb-2`}>{count}</div>
                  <div className="text-sm opacity-80">{percentage}% of total</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Experience Breakdown */}
        <div className="rounded-2xl bg-[#0f0f14] border border-white/10 p-7">
          <h2 className="text-xl font-['Fraunces',serif] font-semibold mb-6">Customer Experience Distribution</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(metrics.experienceBreakdown).map(([exp, count]) => {
              const percentage = metrics.total > 0 ? ((count / metrics.total) * 100).toFixed(1) : 0;
              return (
                <div key={exp} className="rounded-xl bg-[#16161d] border border-white/5 p-5 text-center">
                  <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">{exp}</div>
                  <div className="text-3xl font-['Fraunces',serif] font-bold text-white mb-1">{count}</div>
                  <div className="text-xs text-gray-400">{percentage}%</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Call Type Breakdown */}
        <div className="rounded-2xl bg-[#0f0f14] border border-white/10 p-7">
          <h2 className="text-xl font-['Fraunces',serif] font-semibold mb-6">Call Type Breakdown</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(metrics.typeBreakdown).map(([type, count]) => {
              const percentage = metrics.total > 0 ? ((count / metrics.total) * 100).toFixed(1) : 0;
              return (
                <div key={type} className="rounded-xl bg-[#16161d] border border-white/5 p-5">
                  <div className="text-sm text-gray-300 mb-2">{type}</div>
                  <div className="text-2xl font-['Fraunces',serif] font-bold text-white">{count}</div>
                  <div className="text-xs text-gray-400 mt-1">{percentage}%</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Intent × Experience Matrix */}
        <div className="rounded-2xl bg-[#0f0f14] border border-white/10 p-7">
          <h2 className="text-xl font-['Fraunces',serif] font-semibold mb-6">Intent × Experience Matrix</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left text-sm uppercase tracking-wider text-gray-500 pb-4 pr-4">Intent ↓ / Experience →</th>
                  {['Excellent', 'Good', 'Fair', 'Poor'].map((exp) => (
                    <th key={exp} className="text-center text-sm uppercase tracking-wider text-gray-500 pb-4 px-3">{exp}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {['High', 'Medium', 'Low'].map((intent) => (
                  <tr key={intent}>
                    <td className="text-sm font-medium text-gray-300 py-3 pr-4">{intent}</td>
                    {['Excellent', 'Good', 'Fair', 'Poor'].map((exp) => {
                      const count = metrics.matrix[intent]?.[exp] || 0;
                      return (
                        <td key={exp} className="px-3 py-3">
                          <div className={`rounded-lg border p-4 text-center ${getMatrixColor(count, maxMatrixValue)}`}>
                            <div className="text-2xl font-['Fraunces',serif] font-bold text-white">{count}</div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Store Performance Table */}
        {view !== 'store' && (
          <div className="rounded-2xl bg-[#0f0f14] border border-white/10 p-7">
            <h2 className="text-xl font-['Fraunces',serif] font-semibold mb-6">Store Performance Summary</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left text-xs uppercase tracking-wider text-gray-500 pb-3">Store</th>
                    <th className="text-center text-xs uppercase tracking-wider text-gray-500 pb-3">Calls</th>
                    <th className="text-center text-xs uppercase tracking-wider text-gray-500 pb-3">Demo</th>
                    <th className="text-center text-xs uppercase tracking-wider text-gray-500 pb-3">RELAX</th>
                    <th className="text-center text-xs uppercase tracking-wider text-gray-500 pb-3">Soft Skills</th>
                    <th className="text-center text-xs uppercase tracking-wider text-gray-500 pb-3">Invitation</th>
                    <th className="text-center text-xs uppercase tracking-wider text-gray-500 pb-3">Cust. Sat.</th>
                    <th className="text-center text-xs uppercase tracking-wider text-gray-500 pb-3">Invite Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(metrics.storePerformance)
                    .sort((a, b) => b[1].count - a[1].count)
                    .map(([store, data]) => (
                      <tr key={store} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="py-4 text-sm text-gray-300">{store}</td>
                        <td className="py-4 text-center text-sm font-medium text-white">{data.count}</td>
                        <td className={`py-4 text-center text-sm font-medium ${getScoreColor(parseFloat(data.avgProductDemo))}`}>{data.avgProductDemo}</td>
                        <td className={`py-4 text-center text-sm font-medium ${getScoreColor(parseFloat(data.avgRelax))}`}>{data.avgRelax}</td>
                        <td className={`py-4 text-center text-sm font-medium ${getScoreColor(parseFloat(data.avgSoftSkills))}`}>{data.avgSoftSkills}</td>
                        <td className={`py-4 text-center text-sm font-medium ${getScoreColor(parseFloat(data.avgInvitation))}`}>{data.avgInvitation}</td>
                        <td className={`py-4 text-center text-sm font-medium ${getScoreColor(parseFloat(data.avgCustomerSat))}`}>{data.avgCustomerSat}</td>
                        <td className="py-4 text-center text-sm font-medium text-green-400">{data.invitationRate}%</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Store Deep Dive */}
        {view === 'store' && selectedStore && storeAnalysis && (
          <div className="space-y-6">
            <div className="rounded-2xl bg-[#0f0f14] border border-white/10 p-7">
              <h2 className="text-2xl font-['Fraunces',serif] font-semibold mb-6">{selectedStore} - Deep Dive</h2>
              
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
                <div className="rounded-xl bg-[#16161d] border border-white/5 p-4 text-center">
                  <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">Total Calls</div>
                  <div className="text-2xl font-['Fraunces',serif] font-bold text-white">{storeAnalysis.count}</div>
                </div>
                <div className="rounded-xl bg-[#16161d] border border-white/5 p-4 text-center">
                  <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">Demo Avg</div>
                  <div className={`text-2xl font-['Fraunces',serif] font-bold ${getScoreColor(parseFloat(storeAnalysis.avgProductDemo))}`}>{storeAnalysis.avgProductDemo}</div>
                </div>
                <div className="rounded-xl bg-[#16161d] border border-white/5 p-4 text-center">
                  <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">RELAX Avg</div>
                  <div className={`text-2xl font-['Fraunces',serif] font-bold ${getScoreColor(parseFloat(storeAnalysis.avgRelax))}`}>{storeAnalysis.avgRelax}</div>
                </div>
                <div className="rounded-xl bg-[#16161d] border border-white/5 p-4 text-center">
                  <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">Soft Skills</div>
                  <div className={`text-2xl font-['Fraunces',serif] font-bold ${getScoreColor(parseFloat(storeAnalysis.avgSoftSkills))}`}>{storeAnalysis.avgSoftSkills}</div>
                </div>
                <div className="rounded-xl bg-[#16161d] border border-white/5 p-4 text-center">
                  <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">Cust. Sat.</div>
                  <div className={`text-2xl font-['Fraunces',serif] font-bold ${getScoreColor(parseFloat(storeAnalysis.avgCustomerSat))}`}>{storeAnalysis.avgCustomerSat}</div>
                </div>
                <div className="rounded-xl bg-[#16161d] border border-white/5 p-4 text-center">
                  <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">Invite Rate</div>
                  <div className="text-2xl font-['Fraunces',serif] font-bold text-green-400">{storeAnalysis.invitationRate}%</div>
                </div>
              </div>

              {/* Store Intent Distribution */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-4">Intent Distribution</h3>
                <div className="grid grid-cols-3 gap-4">
                  {Object.entries(storeAnalysis.intentDist).map(([intent, count]) => (
                    <div key={intent} className="rounded-xl bg-[#16161d] border border-white/5 p-4 text-center">
                      <div className="text-sm text-gray-400 mb-1">{intent}</div>
                      <div className="text-xl font-['Fraunces',serif] font-bold text-white">{count}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Agents */}
              {storeAnalysis.topAgents.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Top Performing Agents</h3>
                  <div className="space-y-3">
                    {storeAnalysis.topAgents.map(([agent, data], idx) => (
                      <div key={agent} className="flex items-center justify-between rounded-xl bg-[#16161d] border border-white/5 p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-300 font-semibold text-sm">
                            {idx + 1}
                          </div>
                          <span className="text-white font-medium">{agent}</span>
                        </div>
                        <div className="flex items-center gap-6 text-sm">
                          <div>
                            <span className="text-gray-400">Calls: </span>
                            <span className="text-white font-medium">{data.count}</span>
                          </div>
                          <div>
                            <span className="text-gray-400">RELAX: </span>
                            <span className={`font-medium ${getScoreColor(parseFloat(data.avgRelax))}`}>{data.avgRelax}</span>
                          </div>
                          <div>
                            <span className="text-gray-400">Soft Skills: </span>
                            <span className={`font-medium ${getScoreColor(parseFloat(data.avgSoftSkills))}`}>{data.avgSoftSkills}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoAggregatedDashboard;
