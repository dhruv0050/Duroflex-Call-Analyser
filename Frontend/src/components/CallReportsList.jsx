import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, MapPin, Calendar, Clock, LogOut, BarChart3 } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://duroflex-call-analyser.onrender.com';

const CallReportsList = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchReports();
    fetchStats();
  }, []);

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

        {/* Stats Header */}
        {stats && (
          <div className="grid grid-cols-3 gap-6 mb-10">
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

        {/* Reports Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reports.map((report) => {
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
                      {customer.Intent_to_Visit_Rating && (
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${getIntentColor(customer.Intent_to_Visit_Rating)}`}>
                          Visit: {customer.Intent_to_Visit_Rating}
                        </span>
                      )}
                      {customer.Intent_to_Purchase_Rating && (
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${getIntentColor(customer.Intent_to_Purchase_Rating)}`}>
                          Purchase: {customer.Intent_to_Purchase_Rating}
                        </span>
                      )}
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
