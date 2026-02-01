import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Phone, TrendingUp, BarChart3, LogOut, Upload, ArrowLeft, Calendar, ChevronDown, Filter, Store, AlertCircle, ThumbsUp, Download, Users } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://duroflex-call-analyser.onrender.com';

// Helper function to safely get nested values from multiple possible paths
const getField = (obj, ...paths) => {
  for (const path of paths) {
    const keys = path.split('.');
    let value = obj;
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

const OutboundAggregatedDashboard = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedIntent, setSelectedIntent] = useState('All');
  const [selectedStore, setSelectedStore] = useState('');
  const [storePeriod, setStorePeriod] = useState('week');
  const [selectedCallExperience, setSelectedCallExperience] = useState('All');
  const [selectedStoreExperience, setSelectedStoreExperience] = useState('All');

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      const [reportsRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/api/outbound-calls`),
        fetch(`${API_BASE}/api/outbound-calls/stats/overview`)
      ]);

      if (reportsRes.ok) {
        const data = await reportsRes.json();
        setReports(data.reports || []);
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.stats || {});
      }
    } catch (err) {
      console.error('Failed to fetch data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReports = () => {
    exportReportsAsCsv(reports, 'outbound_call_reports.csv');
  };

  const navigateWithFilter = (predicate, description) => {
    const ids = filteredReports.filter(predicate).map((r) => r.call_id).filter(Boolean);
    navigate('/outbound-calls', { state: { filterIds: ids, filterDescription: description } });
  };

  const getIntentRating = (report) => {
    const analysis = report.analysis || {};
    // Handle both expected and actual Gemini response structures
    return getField(analysis,
      'Pillar_1_Customer_Intent_and_Barriers.Intent_to_Purchase_Rating',
      'PILLAR_1_INTENT_BARRIERS.Intent_to_Purchase_Rating',
      'Call_Analysis.PILLAR_1_CUSTOMER_INTENT_BARRIERS.Intent_to_Purchase_Rating',
      'PILLAR_1.Intent_to_Purchase_Rating',
      'PILLAR_1_CUSTOMER_INTENT_BARRIERS.Intent_to_Purchase_Rating'
    ) || 'MEDIUM';
  };

  const normalizeIntent = (rating) => {
    const val = (rating || 'Medium').toString().toUpperCase();
    if (val.includes('HIGH')) return 'High';
    if (val.includes('MEDIUM')) return 'Medium';
    if (val.includes('LOW')) return 'Low';
    return 'Medium';
  };

  const getOverallScore = (report) => {
    const analysis = report.analysis || {};
    // Handle all possible keys for overall score
    return getField(
      analysis,
      'Pillar_2_Experience_Delivered.Overall_Experience_Rating',
      'PILLAR_2_EXPERIENCE_DELIVERED.C_OVERALL_EXPERIENCE.Overall_Experience_Rating',
      'Call_Analysis.PILLAR_2_EXPERIENCE_DELIVERED.C_OVERALL_EXPERIENCE_RATING.Overall_Experience_Rating',
      'PILLAR_2_EXPERIENCE_DELIVERED.OVERALL_EXPERIENCE.Overall_Experience_Rating',
      'PILLAR_2.Overall_Experience_Rating',
      'PILLAR_2.OVERALL_EXPERIENCE.Overall_Experience_Rating'
    ) || 0;
  };

  const ratingToScore = (value, fallback = 75) => {
    if (value === undefined || value === null || value === '') return fallback;
    const num = parseFloat(value);
    if (Number.isNaN(num)) return fallback;
    return Math.round(num * 20);
  };

  const getStoreExperienceRating = (report) => {
    const analysis = report.analysis || {};
    // New schema: Pillar_1_Double_Audit.Store_Audit.Rating
    // Old schema: derive from PILLAR_2_EXPERIENCE_DELIVERED.A_CUSTOMER_EXPERIENCE
    const storeAudit = analysis.Pillar_1_Double_Audit?.Store_Audit || {};
    if (storeAudit.Rating) return storeAudit.Rating;
    
    const custExp = getField(analysis,
      'PILLAR_2_EXPERIENCE_DELIVERED.A_CUSTOMER_EXPERIENCE.Customer_Experience_Rating',
      'Pillar_2_Experience_Delivered.A_Customer_Experience.Customer_Experience_Rating'
    );
    return custExp || 3;
  };

  const getCallExperienceRating = (report) => {
    const analysis = report.analysis || {};
    // New schema: Pillar_1_Double_Audit.Call_Audit.Rating
    // Old schema: derive from Overall_Experience_Rating
    const callAudit = analysis.Pillar_1_Double_Audit?.Call_Audit || {};
    if (callAudit.Rating) return callAudit.Rating;
    
    return getField(analysis,
      'PILLAR_2_EXPERIENCE_DELIVERED.Overall_Experience_Rating',
      'Pillar_2_Experience_Delivered.Overall_Experience_Rating'
    ) || 3;
  };

  const normalizeExperience = (rating) => {
    const num = parseFloat(rating) || 3;
    if (num >= 4) return 'High';
    if (num >= 3) return 'Medium';
    return 'Low';
  };

  const filteredReports = useMemo(() => {
    let result = reports;
    
    if (selectedIntent !== 'All') {
      result = result.filter(r => normalizeIntent(getIntentRating(r)) === selectedIntent);
    }
    
    if (selectedStoreExperience !== 'All') {
      result = result.filter(r => normalizeExperience(getStoreExperienceRating(r)) === selectedStoreExperience);
    }
    
    if (selectedCallExperience !== 'All') {
      result = result.filter(r => normalizeExperience(getCallExperienceRating(r)) === selectedCallExperience);
    }
    
    return result;
  }, [reports, selectedIntent, selectedStoreExperience, selectedCallExperience]);

  const intentDistribution = useMemo(() => {
    const dist = { High: 0, Medium: 0, Low: 0 };
    reports.forEach(r => {
      const intent = normalizeIntent(getIntentRating(r));
      if (dist.hasOwnProperty(intent)) dist[intent]++;
    });
    return dist;
  }, [reports]);

  const storePerformance = useMemo(() => {
    const storeMap = {};
    filteredReports.forEach(report => {
      const storeName = report.store_name || 'Unknown';
      if (!storeMap[storeName]) {
        storeMap[storeName] = {
          storeName,
          calls: [],
          avgScore: 0,
          highIntent: 0,
          converted: 0,
          avgRelax: 0,
          avgProduct: 0,
          avgSales: 0,
          avgSoft: 0
        };
      }
      storeMap[storeName].calls.push(report);
      if (normalizeIntent(getIntentRating(report)) === 'High') storeMap[storeName].highIntent++;
      if (isConvertedValue(report.is_converted)) storeMap[storeName].converted++;

      const analysis = report.analysis || {};
      // Handle both expected and actual Gemini response structures
      const pillar3 = analysis.Pillar_3_RELAX_Framework || analysis.PILLAR_3_RELAX_FRAMEWORK || analysis.Call_Analysis?.PILLAR_3_RELAX_FRAMEWORK || {};
      const pillar5 = analysis.Pillar_5_Agent_Competency || analysis.PILLAR_5_AGENT_COMPETENCY || analysis.Call_Analysis?.PILLAR_5_AGENT_COMPETENCY || {};

      // Get RELAX overall score - calculate if not present
      let relaxScore = pillar3.RELAX_Overall_Score || 0;
      if (!relaxScore) {
        const rRating = pillar3.R_Reach_Out?.Rating || pillar3.R_REACH_OUT?.Rating || 0;
        const eRating = pillar3.E_Explore_Needs?.Rating || pillar3.E_EXPLORE_NEEDS?.Rating || 0;
        const lRating = pillar3.L_Link_Experience?.Rating || pillar3.L_LINK_EXPERIENCE?.Rating || 0;
        const aRating = pillar3.A_Add_Value?.Rating || pillar3.A_ADD_VALUE?.Rating || 0;
        const xRating = pillar3.X_Express_Closing?.Rating || pillar3.X_EXPRESS_CLOSING?.Rating || 0;
        const scores = [rRating, eRating, lRating, aRating, xRating].filter(s => s > 0);
        relaxScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      }
      storeMap[storeName].avgRelax += ratingToScore(relaxScore, 0);
      
      // Product Knowledge - both structures
      const productScore = pillar5.Product_Knowledge?.Score || pillar5.A_PRODUCT_KNOWLEDGE?.Rating || pillar5.A_PRODUCT_KNOWLEDGE || 0;
      storeMap[storeName].avgProduct += ratingToScore(productScore, 0);
      
      // Sales Skills - both structures
      const salesScore = pillar5.Sales_Skills?.Score || pillar5.B_SALES_SKILLS?.Rating || pillar5.B_SALES_SKILLS || 0;
      storeMap[storeName].avgSales += ratingToScore(salesScore, 0);
      
      // Soft Skills - both structures
      const softScore = pillar5.Soft_Skills?.Score || pillar5.C_SOFT_SKILLS_ETIQUETTE?.Rating || pillar5.C_SOFT_SKILLS_ETIQUETTE || 0;
      storeMap[storeName].avgSoft += ratingToScore(softScore, 0);
    });

    Object.keys(storeMap).forEach(key => {
      const store = storeMap[key];
      const count = store.calls.length;
      const scores = store.calls.map(r => ratingToScore(getOverallScore(r), 0));
      store.avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b) / scores.length) : 0;
      store.avgRelax = count > 0 ? Math.round(store.avgRelax / count) : 0;
      store.avgProduct = count > 0 ? Math.round(store.avgProduct / count) : 0;
      store.avgSales = count > 0 ? Math.round(store.avgSales / count) : 0;
      store.avgSoft = count > 0 ? Math.round(store.avgSoft / count) : 0;
      store.totalCalls = count;
    });

    return Object.values(storeMap).sort((a, b) => b.totalCalls - a.totalCalls);
  }, [filteredReports]);

  // Set default selected store
  useEffect(() => {
    if (storePerformance.length > 0 && !selectedStore) {
      setSelectedStore(storePerformance[0].storeName);
    }
  }, [storePerformance, selectedStore]);

  const agentPerformance = useMemo(() => {
    const agentMap = {};
    filteredReports.forEach(report => {
      const analysis = report.analysis || {};
      // Handle both expected and actual Gemini response structures
      const agentName = getField(analysis,
        'Functional.Agent_Name',
        'Call_Analysis.Agent_Name'
      ) || 'Unknown Agent';
      
      if (!agentMap[agentName]) {
        agentMap[agentName] = {
          name: agentName,
          calls: [],
          avgScore: 0,
          avgProduct: 0,
          avgSales: 0,
          avgSoft: 0
        };
      }

      agentMap[agentName].calls.push(report);

      const pillar5 = analysis.Pillar_5_Agent_Competency || analysis.PILLAR_5_AGENT_COMPETENCY || {};
      
      // Product Knowledge - both structures
      const productScore = pillar5.Product_Knowledge?.Score || pillar5.A_PRODUCT_KNOWLEDGE?.Rating || 0;
      agentMap[agentName].avgProduct += ratingToScore(productScore, 0);
      
      // Sales Skills - both structures
      const salesScore = pillar5.Sales_Skills?.Score || pillar5.B_SALES_SKILLS?.Rating || 0;
      agentMap[agentName].avgSales += ratingToScore(salesScore, 0);
      
      // Soft Skills - both structures
      const softScore = pillar5.Soft_Skills?.Score || pillar5.C_SOFT_SKILLS_ETIQUETTE?.Rating || 0;
      agentMap[agentName].avgSoft += ratingToScore(softScore, 0);
    });

    Object.keys(agentMap).forEach(key => {
      const agent = agentMap[key];
      const count = agent.calls.length;
      const scores = agent.calls.map(r => ratingToScore(getOverallScore(r), 0));
      agent.avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b) / scores.length) : 0;
      agent.avgProduct = count > 0 ? Math.round(agent.avgProduct / count) : 0;
      agent.avgSales = count > 0 ? Math.round(agent.avgSales / count) : 0;
      agent.avgSoft = count > 0 ? Math.round(agent.avgSoft / count) : 0;
      agent.totalCalls = count;
    });

    return Object.values(agentMap).sort((a, b) => b.avgScore - a.avgScore);
  }, [filteredReports]);

  // Intent x Experience Matrix
  const matrix = useMemo(() => {
    const m = {
      High: { High: 0, Medium: 0, Low: 0 },
      Medium: { High: 0, Medium: 0, Low: 0 },
      Low: { High: 0, Medium: 0, Low: 0 }
    };
    filteredReports.forEach(report => {
      const intent = normalizeIntent(getIntentRating(report));
      const analysis = report.analysis || {};
      // Handle both expected and actual structures
      const expScore = getField(analysis,
        'Pillar_2_Experience_Delivered.Overall_Experience_Rating',
        'PILLAR_2_EXPERIENCE_DELIVERED.C_OVERALL_EXPERIENCE.Overall_Experience_Rating'
      ) || 3;
      const experience = expScore >= 4 ? 'High' : expScore >= 3 ? 'Medium' : 'Low';
      if (m[intent] && m[intent][experience] !== undefined) {
        m[intent][experience]++;
      }
    });
    return m;
  }, [filteredReports]);

  const getScoreColor = (score) => {
    if (score >= 70) return 'text-emerald-400';
    if (score >= 50) return 'text-amber-400';
    return 'text-rose-400';
  };

  const getScoreBg = (score) => {
    if (score >= 70) return 'bg-emerald-900/30';
    if (score >= 50) return 'bg-amber-900/30';
    return 'bg-rose-900/30';
  };

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
    { title: 'Dark Green', desc: 'The Goal - High intent, excellent experience', gradient: 'from-[#059669] to-[#047857]', border: 'border-[#059669]' },
    { title: 'Light Green', desc: 'Nurture - High intent, room to improve', gradient: 'from-[#10b981] to-[#059669]', border: 'border-[#10b981]' },
    { title: 'Bright Red', desc: 'CRITICAL RISK - High intent, poor experience', gradient: 'from-[#dc2626] to-[#b91c1c]', border: 'border-[#dc2626]' },
    { title: 'Yellow-Green', desc: 'Upsell - Medium intent with great experience', gradient: 'from-[#84cc16] to-[#65a30d]', border: 'border-[#84cc16]' },
    { title: 'Yellow', desc: 'Neutral/Baseline - Average performance', gradient: 'from-[#eab308] to-[#ca8a04]', border: 'border-[#eab308]' },
    { title: 'Orange', desc: 'Needs Attention - Medium intent, poor experience', gradient: 'from-[#f97316] to-[#ea580c]', border: 'border-[#f97316]' },
    { title: 'Orange-Grey', desc: 'Low Priority - Low intent, medium experience', gradient: 'from-[#d97706] to-[#92400e]', border: 'border-[#d97706]' },
    { title: 'Muted Red', desc: 'Inefficiency - Low intent, poor experience', gradient: 'from-[#b91c1c] to-[#7f1d1d]', border: 'border-[#b91c1c]' },
  ];

  // Store analysis for selected store
  const storeAnalysis = useMemo(() => {
    if (!selectedStore || storePerformance.length === 0) return null;
    
    const store = storePerformance.find(s => s.storeName === selectedStore);
    if (!store) return null;

    const storeCalls = filteredReports.filter(r => r.store_name === selectedStore);
    
    // Generate temporal data (simplified - by week)
    const temporalData = [];
    const now = new Date();
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - (i * 7));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      const weekCalls = storeCalls.filter(r => {
        const callDate = new Date(r.call_date);
        return callDate >= weekStart && callDate <= weekEnd;
      });

      const weekScores = weekCalls.map(r => ratingToScore(getOverallScore(r), 0));
      const avgScore = weekScores.length > 0 ? Math.round(weekScores.reduce((a, b) => a + b) / weekScores.length) : 0;

      temporalData.push({
        label: `Week ${4 - i}`,
        dateRange: `${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`,
        count: weekCalls.length,
        overallScore: avgScore
      });
    }

    // Analysis summary
    const analysis = {
      totalCalls: store.totalCalls,
      avgScore: store.avgScore,
      performanceSummary: store.avgScore >= 70 
        ? 'This store shows strong overall performance with consistent customer engagement.'
        : store.avgScore >= 50
        ? 'This store has moderate performance with room for improvement in key areas.'
        : 'This store needs attention - performance is below expectations.',
      strengths: [
        { name: 'Product Knowledge', score: store.avgProduct },
        { name: 'Sales Skills', score: store.avgSales },
        { name: 'Soft Skills', score: store.avgSoft }
      ].sort((a, b) => b.score - a.score).slice(0, 2),
      weaknesses: [
        { name: 'Product Knowledge', score: store.avgProduct },
        { name: 'Sales Skills', score: store.avgSales },
        { name: 'Soft Skills', score: store.avgSoft }
      ].sort((a, b) => a.score - b.score).slice(0, 2),
      expBreakdown: {
        high: storeCalls.filter(r => {
          const analysis = r.analysis || {};
          const expScore = getField(analysis,
            'Pillar_2_Experience_Delivered.Overall_Experience_Rating',
            'PILLAR_2_EXPERIENCE_DELIVERED.C_OVERALL_EXPERIENCE.Overall_Experience_Rating'
          ) || 0;
          return expScore >= 4;
        }).length,
        medium: storeCalls.filter(r => {
          const analysis = r.analysis || {};
          const score = getField(analysis,
            'Pillar_2_Experience_Delivered.Overall_Experience_Rating',
            'PILLAR_2_EXPERIENCE_DELIVERED.C_OVERALL_EXPERIENCE.Overall_Experience_Rating'
          ) || 0;
          return score >= 3 && score < 4;
        }).length,
        low: storeCalls.filter(r => {
          const analysis = r.analysis || {};
          const expScore = getField(analysis,
            'Pillar_2_Experience_Delivered.Overall_Experience_Rating',
            'PILLAR_2_EXPERIENCE_DELIVERED.C_OVERALL_EXPERIENCE.Overall_Experience_Rating'
          ) || 0;
          return expScore < 3;
        }).length
      },
      improvementAreas: 'Focus on improving the weakest competency areas to drive better conversion rates.',
      customerExpSummary: `Based on ${store.totalCalls} calls, the customer experience quality shows ${store.avgScore >= 70 ? 'positive' : 'mixed'} results.`
    };

    return { temporalData, analysis };
  }, [selectedStore, storePerformance, filteredReports]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('admin_email');
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#08080c] flex items-center justify-center">
        <div className="text-gray-300">Loading outbound call analytics...</div>
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="min-h-screen bg-[#08080c] flex items-center justify-center">
        <div className="text-center">
          <Phone className="w-16 h-16 mx-auto text-gray-600 mb-4" />
          <p className="text-gray-400 mb-4">No outbound call data available for aggregated view.</p>
          <Link to="/outbound-calls" className="text-amber-400 hover:text-amber-300 font-semibold">
            ← Back to Outbound Calls
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
              <Link to="/outbound-calls" className="p-2 hover:bg-white/5 rounded-lg transition">
                <ArrowLeft className="w-5 h-5 text-gray-400" />
              </Link>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight mb-1" style={{ fontFamily: "'Fraunces', serif", letterSpacing: '-0.02em' }}>
                  Outbound Calls Analytics
                </h1>
                <p className="text-gray-400 text-sm">Store Walkin Follow-up Performance</p>
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
              <Link
                to="/outbound-calls/upload"
                className="flex items-center gap-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 px-4 py-2 rounded-lg font-semibold text-sm transition"
              >
                <Upload className="w-4 h-4" />
                Upload CSV
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 bg-red-900/20 hover:bg-red-900/30 border border-red-600/30 rounded-lg text-red-400 text-sm font-semibold transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Filter Strip */}
          <div className="flex flex-wrap items-center gap-6 mt-6 px-4 py-3 bg-[#0f0f14]/50 rounded-xl border border-white/5">
            {/* Intent Filter */}
            <div className="flex items-center gap-3">
              <span className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Intent:</span>
              {['All', 'High', 'Medium', 'Low'].map((intent) => (
                <button
                  key={intent}
                  onClick={() => setSelectedIntent(intent)}
                  className={`px-3 py-1.5 rounded-md font-medium text-xs transition-all ${
                    selectedIntent === intent
                      ? 'bg-amber-500 text-gray-900 shadow-md'
                      : 'text-gray-400 hover:text-gray-100 hover:bg-white/5'
                  }`}
                >
                  {intent}
                </button>
              ))}
            </div>

            <div className="w-px h-6 bg-white/10"></div>

            {/* Store Experience Filter */}
            <div className="flex items-center gap-3">
              <span className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Store Experience:</span>
              {['All', 'High', 'Medium', 'Low'].map((exp) => (
                <button
                  key={`store-${exp}`}
                  onClick={() => setSelectedStoreExperience(exp)}
                  className={`px-3 py-1.5 rounded-md font-medium text-xs transition-all ${
                    selectedStoreExperience === exp
                      ? 'bg-indigo-500 text-white shadow-md'
                      : 'text-gray-400 hover:text-gray-100 hover:bg-white/5'
                  }`}
                >
                  {exp}
                </button>
              ))}
            </div>

            <div className="w-px h-6 bg-white/10"></div>

            {/* Call Experience Filter */}
            <div className="flex items-center gap-3">
              <span className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Call Experience:</span>
              {['All', 'High', 'Medium', 'Low'].map((exp) => (
                <button
                  key={`call-${exp}`}
                  onClick={() => setSelectedCallExperience(exp)}
                  className={`px-3 py-1.5 rounded-md font-medium text-xs transition-all ${
                    selectedCallExperience === exp
                      ? 'bg-purple-500 text-white shadow-md'
                      : 'text-gray-400 hover:text-gray-100 hover:bg-white/5'
                  }`}
                >
                  {exp}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-8 py-8 relative z-10">
        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          <div className="bg-[#0f0f14] border border-white/6 rounded-2xl p-6 hover:shadow-md transition-shadow relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-indigo-600 to-transparent"></div>
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-indigo-900/20 rounded-lg">
                <Phone className="w-6 h-6 text-indigo-400" />
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-gray-100">{stats?.total_calls || filteredReports.length}</p>
                <p className="text-sm text-gray-400 mt-1">Total Calls</p>
              </div>
            </div>
            <div className="pt-4 border-t border-white/6">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Pre-purchase calls</span>
                <span className="font-semibold text-gray-100">{filteredReports.length}</span>
              </div>
            </div>
          </div>

          <div className="bg-[#0f0f14] border border-white/6 rounded-2xl p-6 hover:shadow-md transition-shadow relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-emerald-600 to-transparent"></div>
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-emerald-900/20 rounded-lg">
                <TrendingUp className="w-6 h-6 text-emerald-400" />
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-emerald-400">{stats?.converted_calls || 0}</p>
                <p className="text-sm text-gray-400 mt-1">Conversions</p>
              </div>
            </div>
            <div className="pt-4 border-t border-white/6">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Conversion Rate</span>
                <span className="font-semibold text-emerald-400">{stats?.conversion_rate || 0}%</span>
              </div>
            </div>
          </div>

          <div className="bg-[#0f0f14] border border-white/6 rounded-2xl p-6 hover:shadow-md transition-shadow relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-amber-600 to-transparent"></div>
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-amber-900/20 rounded-lg">
                <Users className="w-6 h-6 text-amber-400" />
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-amber-400">{intentDistribution.High}</p>
                <p className="text-sm text-gray-400 mt-1">High Intent</p>
              </div>
            </div>
            <div className="pt-4 border-t border-white/6">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Ready to buy</span>
                <span className="font-semibold text-gray-100">{reports.length > 0 ? Math.round((intentDistribution.High / reports.length) * 100) : 0}%</span>
              </div>
            </div>
          </div>

          <div className="bg-[#0f0f14] border border-white/6 rounded-2xl p-6 hover:shadow-md transition-shadow relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-blue-600 to-transparent"></div>
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-900/20 rounded-lg">
                <BarChart3 className="w-6 h-6 text-blue-400" />
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-blue-400">{Math.round((stats?.avg_agent_score || 0) * 20)}</p>
                <p className="text-sm text-gray-400 mt-1">Avg Performance</p>
              </div>
            </div>
            <div className="pt-4 border-t border-white/6">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Out of 100</span>
                <span className="font-semibold text-gray-100">{storePerformance.length} stores</span>
              </div>
            </div>
          </div>
        </div>

        {/* Intent x Experience Matrix */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6 sm:p-8 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-xl shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
              🎯
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-white">Intent × Experience Matrix</h2>
              <p className="text-sm text-slate-400">Click a cell to drill into matching calls</p>
            </div>
          </div>

          <div className="rounded-2xl border border-[#2a2a2a] bg-[#0f0f14] p-4 sm:p-6 overflow-x-auto">
            <div className="min-w-[900px] grid grid-cols-[170px_repeat(3,minmax(0,1fr))] gap-4">
              <div></div>
              {experiences.map((exp) => (
                <div key={`header-${exp}`} className="text-center font-semibold text-base text-slate-100 py-3">
                  {exp} Call Exp
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
                      onClick={() => navigateWithFilter((r) => {
                        const i = normalizeIntent(getIntentRating(r));
                        const analysis = r.analysis || {};
                        const expScore = getField(analysis,
                          'Pillar_2_Experience_Delivered.Overall_Experience_Rating',
                          'PILLAR_2_EXPERIENCE_DELIVERED.C_OVERALL_EXPERIENCE.Overall_Experience_Rating'
                        ) || 3;
                        const e = expScore >= 4 ? 'High' : expScore >= 3 ? 'Medium' : 'Low';
                        return i === intent && e === exp;
                      }, `${intent} intent × ${exp} call experience`)}
                      className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${matrixPalette[intent][exp]} p-6 sm:p-7 text-center transition transform hover:-translate-y-1 hover:scale-[1.02] shadow-[0_12px_40px_rgba(0,0,0,0.35)]`}
                    >
                      <div className="text-4xl font-bold tracking-tight text-white drop-shadow-sm">{matrix[intent][exp]}</div>
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

        {/* Store Performance Table */}
        <div className="bg-[#0f0f14] border border-white/6 rounded-2xl overflow-hidden mb-8">
          <div className="p-8 border-b border-white/6">
            <h2 className="text-xl font-semibold text-gray-100 flex items-center gap-3" style={{ fontFamily: "'Fraunces', serif" }}>
              <TrendingUp className="w-6 h-6 text-amber-400" />
              Store Performance Analysis
            </h2>
            <p className="text-sm text-gray-400 mt-1">Competency Scores & Conversion Metrics</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#16161d] border-b border-white/6">
                <tr>
                  <th className="text-left px-8 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Store Name</th>
                  <th className="text-center px-4 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider"># Calls</th>
                  <th className="text-center px-4 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Overall Score</th>
                  <th className="text-center px-4 py-4 text-xs font-semibold text-amber-400 uppercase tracking-wider border-l border-white/6">High Intent</th>
                  <th className="text-center px-4 py-4 text-xs font-semibold text-emerald-400 uppercase tracking-wider border-r border-white/6">Converted</th>
                  <th className="text-center px-4 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Product Knowledge</th>
                  <th className="text-center px-4 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Sales Skills</th>
                  <th className="text-center px-4 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Soft Skills</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {storePerformance.map((store) => (
                  <tr
                    key={store.storeName}
                    onClick={() => setSelectedStore(store.storeName)}
                    className={`hover:bg-white/5 transition-colors cursor-pointer ${selectedStore === store.storeName ? 'bg-amber-500/10' : ''}`}
                  >
                    <td className="px-8 py-5">
                      <div className="font-semibold text-gray-100">{store.storeName}</div>
                    </td>
                    <td className="px-4 py-5 text-center">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-[#16161d] text-gray-300">
                        {store.totalCalls}
                      </span>
                    </td>
                    <td className="px-4 py-5 text-center">
                      <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-bold ${getScoreBg(store.avgScore)} ${getScoreColor(store.avgScore)}`}>
                        {store.avgScore}
                      </span>
                    </td>
                    <td className="px-4 py-5 text-center border-l border-white/6">
                      <span className="font-semibold text-amber-400">{store.highIntent}</span>
                    </td>
                    <td className="px-4 py-5 text-center border-r border-white/6">
                      <span className="font-semibold text-emerald-400">{store.converted}</span>
                    </td>
                    <td className="px-4 py-5 text-center">
                      <span className={`font-semibold ${getScoreColor(store.avgProduct)}`}>{store.avgProduct}</span>
                    </td>
                    <td className="px-4 py-5 text-center">
                      <span className={`font-semibold ${getScoreColor(store.avgSales)}`}>{store.avgSales}</span>
                    </td>
                    <td className="px-4 py-5 text-center">
                      <span className={`font-semibold ${getScoreColor(store.avgSoft)}`}>{store.avgSoft}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-8 py-4 bg-[#16161d] border-t border-white/6">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <div>
                <span className="font-semibold">Click a store row to see detailed analysis below</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                  <span>70+ Excellent</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                  <span>50-69 Good</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                  <span>&lt;50 Needs Improvement</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Store-wise Deep Dive */}
        {storeAnalysis && selectedStore && (
          <div className="bg-[#0f0f14] border border-white/6 rounded-2xl overflow-hidden mb-8">
            <div className="p-8 border-b border-white/6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-100 flex items-center gap-3" style={{ fontFamily: "'Fraunces', serif" }}>
                    <Store className="w-6 h-6 text-amber-400" />
                    Store Deep Dive: {selectedStore}
                  </h2>
                  <p className="text-sm text-gray-400 mt-1">Performance trends and detailed analytics</p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3 bg-[#16161d] rounded-lg px-4 py-2.5 border border-white/6">
                    <Store className="w-4 h-4 text-gray-500" />
                    <select
                      value={selectedStore}
                      onChange={(e) => setSelectedStore(e.target.value)}
                      className="bg-transparent font-medium text-sm cursor-pointer outline-none text-gray-200 min-w-[200px]"
                      style={{ colorScheme: 'dark' }}
                    >
                      {storePerformance.map((store) => (
                        <option key={store.storeName} value={store.storeName} className="bg-[#1a1a1f] text-gray-200">
                          {store.storeName}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  </div>
                </div>
              </div>
            </div>

            {/* AI-Powered Insights */}
            <div className="p-8 bg-gradient-to-br from-[#0f0f14] to-[#16161d]">
              <div className="flex items-center gap-2 mb-6">
                <TrendingUp className="w-5 h-5 text-amber-400" />
                <h3 className="text-lg font-semibold text-gray-100" style={{ fontFamily: "'Fraunces', serif" }}>
                  AI-Powered Insights & Recommendations
                </h3>
              </div>

              <div className="grid grid-cols-3 gap-6">
                <div className="bg-[#16161d] border border-white/6 rounded-lg p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="p-2 bg-blue-900/20 rounded-lg">
                      <BarChart3 className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-100 mb-1">Store Performance Summary</h4>
                      <div className="flex items-center gap-2 text-sm">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${getScoreBg(storeAnalysis.analysis.avgScore)} ${getScoreColor(storeAnalysis.analysis.avgScore)}`}>
                          {storeAnalysis.analysis.avgScore}/100
                        </span>
                        <span className="text-gray-500">•</span>
                        <span className="text-gray-400">{storeAnalysis.analysis.totalCalls} calls analyzed</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-300 leading-relaxed">{storeAnalysis.analysis.performanceSummary}</p>
                  <div className="mt-4 pt-4 border-t border-white/6">
                    <div className="text-xs font-semibold text-gray-400 mb-2">Top Strengths:</div>
                    <div className="flex flex-col gap-1">
                      {storeAnalysis.analysis.strengths.map((strength, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                          <span className="text-gray-300">{strength.name}</span>
                          <span className={`font-bold ${getScoreColor(strength.score)}`}>{strength.score}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-[#16161d] border border-white/6 rounded-lg p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="p-2 bg-amber-900/20 rounded-lg">
                      <AlertCircle className="w-5 h-5 text-amber-400" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-100 mb-1">Improvement Areas</h4>
                      <div className="text-xs text-gray-400">Priority focus recommendations</div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-300 leading-relaxed">{storeAnalysis.analysis.improvementAreas}</p>
                  <div className="mt-4 pt-4 border-t border-white/6">
                    <div className="text-xs font-semibold text-gray-400 mb-2">Development Priorities:</div>
                    <div className="flex flex-col gap-1">
                      {storeAnalysis.analysis.weaknesses.map((weakness, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                          <span className="text-gray-300">{weakness.name}</span>
                          <span className={`font-bold ${getScoreColor(weakness.score)}`}>{weakness.score}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-[#16161d] border border-white/6 rounded-lg p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="p-2 bg-emerald-900/20 rounded-lg">
                      <ThumbsUp className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-100 mb-1">Customer Experience Summary</h4>
                      <div className="text-xs text-gray-400">Interaction quality & satisfaction</div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-300 leading-relaxed">{storeAnalysis.analysis.customerExpSummary}</p>
                  <div className="mt-4 pt-4 border-t border-white/6">
                    <div className="text-xs font-semibold text-gray-400 mb-2">Experience Breakdown:</div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                          <span className="text-gray-300">High Quality</span>
                        </div>
                        <span className="font-bold text-gray-100">{storeAnalysis.analysis.expBreakdown.high}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                          <span className="text-gray-300">Medium Quality</span>
                        </div>
                        <span className="font-bold text-gray-100">{storeAnalysis.analysis.expBreakdown.medium}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                          <span className="text-gray-300">Low Quality</span>
                        </div>
                        <span className="font-bold text-gray-100">{storeAnalysis.analysis.expBreakdown.low}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OutboundAggregatedDashboard;
