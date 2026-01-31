import React, { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, TrendingUp, Users, Phone, ChevronDown, Filter, Store, BarChart3, AlertCircle, ThumbsUp, ArrowLeft, Download } from 'lucide-react';

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

const AbcAggregatedDashboard = () => {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState('last30');
  const [view, setView] = useState('overall');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedIntent, setSelectedIntent] = useState('All');
  const [selectedExperience, setSelectedExperience] = useState('All');
  const [selectedPriceBucket, setSelectedPriceBucket] = useState('All');
  const [allCalls, setAllCalls] = useState([]);
  const [loading, setLoading] = useState(true);

  const handleDownloadReports = () => {
    exportReportsAsCsv(allCalls, 'abc_cart_recovery_reports.csv');
  };

  const navigateWithFilter = (predicate, description) => {
    const ids = filteredCalls.filter(predicate).map((c) => c.id || c.call_id).filter(Boolean);
    navigate('/abc-calls', { state: { filterIds: ids, filterDescription: description } });
  };

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/abc-calls/reports`);
        if (!res.ok) throw new Error('Failed to load ABC reports');
        const json = await res.json();
        setAllCalls(json.reports || []);
      } catch (err) {
        console.error('Error fetching ABC calls:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, []);

  const normalizeIntent = (rating) => {
    const val = (rating || 'Medium').toString().toUpperCase();
    if (val.includes('HIGH')) return 'High';
    if (val.includes('LOW')) return 'Low';
    return 'Medium';
  };

  const normalizeExperience = (score) => {
    if (!score) return 'Medium';
    if (score >= 4) return 'High';
    if (score <= 2) return 'Low';
    return 'Medium';
  };

  const ratingToScore = (value, fallback = 75) => {
    if (value === null || value === undefined) return fallback;
    const numValue = typeof value === 'number' ? value : parseFloat(value);
    if (isNaN(numValue)) return fallback;
    return Math.round(numValue * 20); // 1-5 to 0-100
  };

  const abcCalls = useMemo(() => {
    if (!allCalls.length) return [];

    return allCalls.map((report) => {
      const analysis = report.analysis || {};
      const p1 = analysis.Pillar_1_Customer_Intent_and_Barriers || {};
      const p2 = analysis.Pillar_2_Experience_Delivered || {};
      const p3 = analysis.Pillar_3_RELAX_Framework || {};
      const p5 = analysis.Pillar_5_Agent_Competency || {};
      const rawData = report.raw_data || {};

      const intent = normalizeIntent(p1.Intent_to_Purchase_Rating || 'MEDIUM');
      const experience = normalizeExperience(p2.Overall_Experience_Rating || 3);

      const rawPrice = rawData['Lineitem price'] || rawData.Lineitem_price || 0;
      const cartAmount = typeof rawPrice === 'number' ? rawPrice : parseFloat(rawPrice) || 0;

      // Determine type based on outcome
      const outcome = (analysis.Functional?.Call_Outcome || '').toLowerCase();
      const type = outcome.includes('purchased') || outcome.includes('converted') ? 'Recovered' : 'Pending';

      return {
        id: report.call_id,
        city: report.city || 'Unknown',
        intent,
        experience,
        type,
        cartValue: rawPrice,
        cartAmount,
        scores: {
          overall: ratingToScore(p3.RELAX_Overall_Score || 3, 60),
          rapport: ratingToScore(p3.R_Reach_Out?.Rating || 3, 60),
          explore: ratingToScore(p3.E_Explore_Needs?.Rating || 3, 60),
          link: ratingToScore(p3.L_Link_Experience?.Rating || 3, 60),
          add: ratingToScore(p3.A_Add_Value?.Rating || 3, 60),
          close: ratingToScore(p3.X_Express_Closing?.Rating || 3, 60),
          productKnowledge: ratingToScore(p5.Product_Knowledge?.Score || 3, 60),
          softSkills: ratingToScore(p5.Soft_Skills?.Score || 3, 60)
        },
      };
    });
  }, [allCalls]);

  const cities = useMemo(() => {
    return [...new Set(abcCalls.map((c) => c.city))].filter(Boolean).sort();
  }, [abcCalls]);

  // Ensure selected city is valid when switching to city view
  useEffect(() => {
    if (view === 'city' && !cities.includes(selectedCity)) {
      setSelectedCity(cities[0] || '');
    }
  }, [view, cities, selectedCity]);

  const filteredCalls = useMemo(() => {
    let filtered = [...abcCalls];
    
    // Apply view filter
    if (view === 'city' && selectedCity) {
      filtered = filtered.filter((c) => c.city === selectedCity);
    }
    
    // Apply time range filter (simplified - just limit count for demo)
    if (timeRange === 'last7') {
      filtered = filtered.slice(-7);
    } else if (timeRange === 'last30') {
      filtered = filtered.slice(-30);
    } else if (timeRange === 'last90') {
      filtered = filtered.slice(-90);
    }
    
    // Apply intent filter
    if (selectedIntent !== 'All') {
      filtered = filtered.filter((call) => call.intent === selectedIntent);
    }

    // Apply customer experience filter
    if (selectedExperience !== 'All') {
      filtered = filtered.filter((call) => call.experience === selectedExperience);
    }

    // Apply price bucket filter based on cartAmount
    if (selectedPriceBucket !== 'All') {
      filtered = filtered.filter((call) => {
        const amount = call.cartAmount || 0;
        if (selectedPriceBucket === 'High') return amount > 20000;
        if (selectedPriceBucket === 'Medium') return amount >= 10000 && amount <= 20000;
        if (selectedPriceBucket === 'Low') return amount > 0 && amount < 10000;
        return true;
      });
    }
    
    return filtered;
  }, [abcCalls, view, selectedCity, timeRange, selectedIntent, selectedExperience, selectedPriceBucket]);

  const metrics = useMemo(() => {
    const total = filteredCalls.length;
    const recoveredCalls = filteredCalls.filter((c) => c.type === 'Recovered').length;
    const pendingCalls = total - recoveredCalls;
    
    const matrix = {};
    ['High', 'Medium', 'Low'].forEach((intent) => {
      matrix[intent] = {};
      ['High', 'Medium', 'Low'].forEach((exp) => {
        matrix[intent][exp] = filteredCalls.filter((c) => c.intent === intent && c.experience === exp).length;
      });
    });

    const cityMetrics = {};
    filteredCalls.forEach((call) => {
      if (!cityMetrics[call.city]) {
        cityMetrics[call.city] = {
          cityName: call.city,
          calls: [],
        };
      }
      cityMetrics[call.city].calls.push(call);
    });

    const cityPerformance = Object.values(cityMetrics)
      .map((city) => {
        const calls = city.calls;
        const avgScore = (metric) =>
          calls.length ? Math.round(calls.reduce((sum, c) => sum + c.scores[metric], 0) / calls.length) : 0;

        return {
          cityName: city.cityName,
          totalCalls: calls.length,
          overallScore: avgScore('overall'),
          rapport: avgScore('rapport'),
          explore: avgScore('explore'),
          link: avgScore('link'),
          add: avgScore('add'),
          close: avgScore('close'),
          productKnowledge: avgScore('productKnowledge'),
          softSkills: avgScore('softSkills'),
        };
      })
      .sort((a, b) => b.totalCalls - a.totalCalls);

    return {
      total,
      recoveredCalls,
      pendingCalls,
      matrix,
      cityPerformance,
    };
  }, [filteredCalls]);

  const intents = ['High', 'Medium', 'Low'];
  const experiences = ['High', 'Medium', 'Low'];

  const matrixPalette = {
    High: {
      High: 'from-[#059669] to-[#047857]',
      Medium: 'from-[#10b981] to-[#059669]',
      Low: 'from-[#dc2626] to-[#b91c1c]',
    },
    Medium: {
      High: 'from-[#84cc16] to-[#65a30d]',
      Medium: 'from-[#eab308] to-[#ca8a04]',
      Low: 'from-[#f97316] to-[#ea580c]',
    },
    Low: {
      High: 'from-[#eab308] to-[#ca8a04]',
      Medium: 'from-[#d97706] to-[#92400e]',
      Low: 'from-[#b91c1c] to-[#7f1d1d]',
    },
  };

  const matrixLabels = {
    High: { High: 'The Goal', Medium: 'Nurture', Low: 'CRITICAL RISK' },
    Medium: { High: 'Upsell', Medium: 'Neutral/Baseline', Low: 'Needs Attention' },
    Low: { High: 'Over-servicing?', Medium: 'Low Priority', Low: 'Inefficiency' },
  };

  const matrixLegend = [
    {
      title: 'Dark Green',
      desc: 'The Goal - High intent, excellent experience',
      gradient: 'from-[#059669] to-[#047857]',
      border: 'border-[#059669]',
    },
    {
      title: 'Light Green',
      desc: 'Nurture - High intent, room to improve experience',
      gradient: 'from-[#10b981] to-[#059669]',
      border: 'border-[#10b981]',
    },
    {
      title: 'Bright Red',
      desc: 'CRITICAL RISK - High intent, poor experience',
      gradient: 'from-[#dc2626] to-[#b91c1c]',
      border: 'border-[#dc2626]',
    },
    {
      title: 'Yellow-Green',
      desc: 'Upsell - Medium intent with great experience',
      gradient: 'from-[#84cc16] to-[#65a30d]',
      border: 'border-[#84cc16]',
    },
    {
      title: 'Yellow',
      desc: 'Neutral/Baseline - Average performance',
      gradient: 'from-[#eab308] to-[#ca8a04]',
      border: 'border-[#eab308]',
    },
    {
      title: 'Orange',
      desc: 'Needs Attention - Medium intent, poor experience',
      gradient: 'from-[#f97316] to-[#ea580c]',
      border: 'border-[#f97316]',
    },
    {
      title: 'Orange-Grey',
      desc: 'Low Priority - Low intent, medium experience',
      gradient: 'from-[#d97706] to-[#92400e]',
      border: 'border-[#d97706]',
    },
    {
      title: 'Muted Red',
      desc: 'Inefficiency - Low intent, poor experience',
      gradient: 'from-[#b91c1c] to-[#7f1d1d]',
      border: 'border-[#b91c1c]',
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading call analytics...</div>
      </div>
    );
  }

  if (!abcCalls.length) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">No ABC call data available for aggregated view.</p>
          <Link to="/abc-calls" className="text-blue-600 hover:text-blue-700 font-semibold">
            ← Back to ABC Reports
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08080c] text-gray-100" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Grain texture overlay */}
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none" style={{
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")"
      }}></div>

      {/* Header */}
      <div className="bg-gradient-to-br from-[#0f0f14] to-[#16161d] border-b border-white/6 shadow-2xl relative z-10">
        <div className="max-w-[1600px] mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/abc-calls" className="p-2 hover:bg-white/5 rounded-lg transition">
                <ArrowLeft className="w-5 h-5 text-gray-400" />
              </Link>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight mb-1" style={{ fontFamily: "'Fraunces', serif", letterSpacing: '-0.02em' }}>
                  ABC Cart Recovery Analytics
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleDownloadReports}
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-gray-900 px-4 py-2 rounded-lg font-semibold text-sm shadow-lg transition"
              >
                <Download className="w-4 h-4" />
                Download All Reports
              </button>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex flex-wrap items-center gap-3 bg-[#111116] border border-amber-400/60 rounded-xl px-4 py-3">
              {/* View toggles */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setView('overall')}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                    view === 'overall'
                      ? 'bg-amber-500 text-gray-900 shadow-lg'
                      : 'text-gray-400 hover:text-gray-100 hover:bg-white/5'
                  }`}
                >
                  Overall Overview
                </button>
                <button
                  onClick={() => setView('city')}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                    view === 'city'
                      ? 'bg-amber-500 text-gray-900 shadow-lg'
                      : 'text-gray-400 hover:text-gray-100 hover:bg-white/5'
                  }`}
                >
                  City-wise
                </button>
              </div>

              {/* City filter */}
              {view === 'city' && (
                <div className="flex items-center gap-3 pl-4 border-l border-white/10 bg-[#16161d] rounded-lg px-4 py-2">
                  <Filter className="w-4 h-4 text-gray-500" />
                  <select
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    className="bg-transparent font-medium cursor-pointer outline-none text-gray-200"
                    style={{ colorScheme: 'dark' }}
                  >
                    {cities.map((city) => (
                      <option key={city} value={city} className="bg-[#1a1a1f] text-gray-200">
                        {city}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                </div>
              )}

              {/* Time range filter */}
              <div className="flex items-center gap-2 pl-4 border-l border-white/10 bg-[#16161d] rounded-lg px-4 py-2">
                <Calendar className="w-4 h-4 text-gray-500" />
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                  className="bg-transparent text-sm font-medium cursor-pointer outline-none text-gray-200"
                  style={{ colorScheme: 'dark' }}
                >
                  <option value="last7" className="bg-[#1a1a1f] text-gray-200">Last 7 Days</option>
                  <option value="last30" className="bg-[#1a1a1f] text-gray-200">Last 30 Days</option>
                  <option value="last90" className="bg-[#1a1a1f] text-gray-200">Last 90 Days</option>
                  <option value="ytd" className="bg-[#1a1a1f] text-gray-200">Year to Date</option>
                </select>
                <ChevronDown className="w-4 h-4 text-gray-500" />
              </div>

              {/* Intent to Purchase Filter */}
              <div className="flex items-center gap-2 pl-4 border-l border-white/10 bg-[#16161d] rounded-lg px-4 py-2">
                <span className="text-xs text-gray-400">Intent to Purchase</span>
                <select
                  value={selectedIntent}
                  onChange={(e) => setSelectedIntent(e.target.value)}
                  className="bg-transparent font-medium cursor-pointer outline-none text-gray-200"
                  style={{ colorScheme: 'dark' }}
                >
                  {['All','High','Medium','Low'].map((opt) => (
                    <option key={opt} value={opt} className="bg-[#1a1a1f] text-gray-200">
                      {opt}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-gray-500" />
              </div>

              {/* Customer Experience Filter */}
              <div className="flex items-center gap-2 pl-4 border-l border-white/10 bg-[#16161d] rounded-lg px-4 py-2">
                <span className="text-xs text-gray-400">Customer Experience</span>
                <select
                  value={selectedExperience}
                  onChange={(e) => setSelectedExperience(e.target.value)}
                  className="bg-transparent font-medium cursor-pointer outline-none text-gray-200"
                  style={{ colorScheme: 'dark' }}
                >
                  {['All','High','Medium','Low'].map((opt) => (
                    <option key={opt} value={opt} className="bg-[#1a1a1f] text-gray-200">
                      {opt}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-gray-500" />
              </div>

              {/* Price Bucket Filter */}
              <div className="flex items-center gap-2 pl-4 border-l border-white/10 bg-[#16161d] rounded-lg px-4 py-2">
                <span className="text-xs text-gray-400">Price Bucket</span>
                <select
                  value={selectedPriceBucket}
                  onChange={(e) => setSelectedPriceBucket(e.target.value)}
                  className="bg-transparent font-medium cursor-pointer outline-none text-gray-200"
                  style={{ colorScheme: 'dark' }}
                >
                  <option value="All" className="bg-[#1a1a1f] text-gray-200">All</option>
                  <option value="High" className="bg-[#1a1a1f] text-gray-200">High (&gt; 20k)</option>
                  <option value="Medium" className="bg-[#1a1a1f] text-gray-200">Medium (10k - 20k)</option>
                  <option value="Low" className="bg-[#1a1a1f] text-gray-200">Low (&lt; 10k)</option>
                </select>
                <ChevronDown className="w-4 h-4 text-gray-500" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-8 py-8 relative z-10">
        {/* KPI Cards */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          <div
            onClick={() => navigateWithFilter(() => true, 'All calls (current filters)')}
            className="bg-[#0f0f14] border border-white/6 rounded-2xl p-6 hover:shadow-md transition-shadow relative overflow-hidden cursor-pointer"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-indigo-600 to-transparent"></div>
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-indigo-900/20 rounded-lg">
                <Phone className="w-6 h-6 text-indigo-400" />
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-gray-100">{metrics.total.toLocaleString()}</p>
                <p className="text-sm text-gray-400 mt-1">Total Calls Analyzed</p>
              </div>
            </div>
            <div className="pt-4 border-t border-white/6">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Avg. per city</span>
                <span className="font-semibold text-gray-100">
                  {metrics.cityPerformance.length ? Math.round(metrics.total / metrics.cityPerformance.length) : 0}
                </span>
              </div>
            </div>
          </div>

          <div
            onClick={() => navigateWithFilter((c) => c.type === 'Recovered', 'Recovered calls')}
            className="bg-[#0f0f14] border border-white/6 rounded-2xl p-6 hover:shadow-md transition-shadow relative overflow-hidden cursor-pointer"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-emerald-600 to-transparent"></div>
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-emerald-900/20 rounded-lg">
                <TrendingUp className="w-6 h-6 text-emerald-400" />
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-emerald-400">{metrics.recoveredCalls}</p>
                <p className="text-sm text-gray-400 mt-1">Recovered Carts</p>
              </div>
            </div>
            <div className="pt-4 border-t border-white/6">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Recovery Ratio</span>
                <span className="font-semibold text-gray-100">
                  {metrics.total ? Math.round((metrics.recoveredCalls / metrics.total) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>

          <div
            onClick={() => navigateWithFilter((c) => c.type === 'Pending', 'Pending calls')}
            className="bg-[#0f0f14] border border-white/6 rounded-2xl p-6 hover:shadow-md transition-shadow relative overflow-hidden cursor-pointer"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-blue-600 to-transparent"></div>
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-900/20 rounded-lg">
                <Users className="w-6 h-6 text-blue-400" />
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-blue-400">{metrics.pendingCalls}</p>
                <p className="text-sm text-gray-400 mt-1">Pending Recovery</p>
              </div>
            </div>
            <div className="pt-4 border-t border-white/6">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Pending Ratio</span>
                <span className="font-semibold text-gray-100">
                  {metrics.total ? Math.round((metrics.pendingCalls / metrics.total) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Intent x Customer Experience Matrix */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6 sm:p-8 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-xl shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
              🎯
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-white">Purchase Intent × Customer Experience</h2>
              <p className="text-sm text-slate-400">Click a cell to drill into matching calls</p>
            </div>
          </div>

          <div className="rounded-2xl border border-[#2a2a2a] bg-[#0f0f14] p-4 sm:p-6 overflow-x-auto">
            <div className="min-w-[900px] grid grid-cols-[170px_repeat(3,minmax(0,1fr))] gap-4">
              <div></div>
              {experiences.map((exp) => (
                <div key={`header-${exp}`} className="text-center font-semibold text-base text-slate-100 py-3">
                  {exp} Experience
                </div>
              ))}

              {intents.map((intent) => (
                <React.Fragment key={intent}>
                  <div className="flex items-center justify-end pr-4 text-right text-base font-semibold text-slate-100">
                    {intent} Intent
                  </div>
                  {experiences.map((exp) => (
                    <button
                      key={`${intent}-${exp}`}
                      type="button"
                      onClick={() => navigateWithFilter((c) => c.intent === intent && c.experience === exp, `${intent} intent × ${exp} experience`)}
                      className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${matrixPalette[intent][exp]} p-6 sm:p-7 text-center transition transform hover:-translate-y-1 hover:scale-[1.02] shadow-[0_12px_40px_rgba(0,0,0,0.35)]`}
                    >
                      <div className="text-4xl font-bold tracking-tight text-white drop-shadow-sm">{metrics.matrix[intent][exp]}</div>
                      <div className="text-sm font-medium text-white/80">calls</div>
                      <div className="mt-3 inline-flex rounded-md bg-black/20 px-3 py-1 text-xs font-semibold text-white/90">
                        {matrixLabels[intent][exp]}
                      </div>
                    </button>
                  ))}
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="mt-7 rounded-2xl border border-[#2a2a2a] bg-[#0f0f14] p-6">
            <h3 className="text-lg font-semibold text-slate-100 mb-4">Color Legend & Interpretation</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {matrixLegend.map((item) => (
                <div key={item.title} className="flex items-center gap-3 rounded-xl bg-[#0a0a0a] p-4">
                  <div className={`h-12 w-12 rounded-lg border-2 ${item.border} bg-gradient-to-br ${item.gradient}`}></div>
                  <div className="space-y-1 text-left">
                    <p className="text-sm font-semibold text-slate-100">{item.title}</p>
                    <p className="text-xs text-slate-400 leading-snug">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* City Performance Table */}
        <div className="bg-[#0f0f14] border border-white/6 rounded-2xl overflow-hidden mb-8">
          <div className="p-8 border-b border-white/6">
            <h2 className="text-xl font-semibold text-gray-100 flex items-center gap-3" style={{ fontFamily: "'Fraunces', serif" }}>
              <TrendingUp className="w-6 h-6 text-amber-400" />
              City Performance Analysis
            </h2>
            <p className="text-sm text-gray-400 mt-1">RELAX Framework Scores & Key Metrics</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#16161d] border-b border-white/6">
                <tr>
                  <th className="text-left px-8 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    City Name
                  </th>
                  <th className="text-center px-4 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    # Calls
                  </th>
                  <th className="text-center px-4 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Overall Score
                  </th>
                  <th className="text-center px-4 py-4 text-xs font-semibold text-amber-400 uppercase tracking-wider border-l border-white/6">
                    R
                  </th>
                  <th className="text-center px-4 py-4 text-xs font-semibold text-amber-400 uppercase tracking-wider">
                    E
                  </th>
                  <th className="text-center px-4 py-4 text-xs font-semibold text-amber-400 uppercase tracking-wider">
                    L
                  </th>
                  <th className="text-center px-4 py-4 text-xs font-semibold text-amber-400 uppercase tracking-wider">
                    A
                  </th>
                  <th className="text-center px-4 py-4 text-xs font-semibold text-amber-400 uppercase tracking-wider border-r border-white/6">
                    X
                  </th>
                  <th className="text-center px-4 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Product Knowledge
                  </th>
                  <th className="text-center px-4 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Soft Skills
                  </th>
                </tr>
              </thead>
              <tbody>
                {metrics.cityPerformance.map((city, idx) => (
                  <tr key={city.cityName} className={`border-b border-white/6 hover:bg-white/5 transition ${idx % 2 === 0 ? 'bg-[#0a0a0a]' : ''}`}>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center text-amber-400 font-semibold text-sm">
                          {city.cityName.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-100">{city.cityName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-center px-4 py-5">
                      <span className="font-semibold text-gray-200">{city.totalCalls}</span>
                    </td>
                    <td className="text-center px-4 py-5">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full font-bold text-sm" style={{ 
                        backgroundColor: city.overallScore >= 70 ? 'rgba(16, 185, 129, 0.2)' : city.overallScore >= 50 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                        color: city.overallScore >= 70 ? '#10b981' : city.overallScore >= 50 ? '#f59e0b' : '#ef4444'
                      }}>
                        {city.overallScore}
                      </div>
                    </td>
                    <td className="text-center px-4 py-5 border-l border-white/6"><span className="text-gray-300">{city.rapport}</span></td>
                    <td className="text-center px-4 py-5"><span className="text-gray-300">{city.explore}</span></td>
                    <td className="text-center px-4 py-5"><span className="text-gray-300">{city.link}</span></td>
                    <td className="text-center px-4 py-5"><span className="text-gray-300">{city.add}</span></td>
                    <td className="text-center px-4 py-5 border-r border-white/6"><span className="text-gray-300">{city.close}</span></td>
                    <td className="text-center px-4 py-5">
                      <span className={city.productKnowledge >= 70 ? 'text-emerald-400' : city.productKnowledge >= 50 ? 'text-amber-400' : 'text-red-400'}>
                        {city.productKnowledge}
                      </span>
                    </td>
                    <td className="text-center px-4 py-5">
                      <span className={city.softSkills >= 70 ? 'text-emerald-400' : city.softSkills >= 50 ? 'text-amber-400' : 'text-red-400'}>
                        {city.softSkills}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AbcAggregatedDashboard;
