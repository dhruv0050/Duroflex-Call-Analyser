import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Play, CheckCircle, Clock, LogOut, Video, ChevronRight, BarChart3, Upload } from 'lucide-react';

export default function VideoCallsList() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const filterIds = location.state?.filterIds;
  const filterDescription = location.state?.filterDescription;

  useEffect(() => {
    fetchVideoReports();
  }, []);

  const visibleReports = useMemo(() => {
    if (!filterIds || !Array.isArray(filterIds)) return reports;
    return reports.filter((r) => filterIds.includes(r.report_id));
  }, [reports, filterIds]);

  const fetchVideoReports = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'https://duroflex-call-analyser.onrender.com'}/api/video-reports`);
      const data = await response.json();
      
      if (data.status === 'success') {
        setReports(data.reports);
      } else {
        setError('Failed to fetch video reports');
      }
    } catch (err) {
      setError('Error connecting to API');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#08080c] flex items-center justify-center">
        <div className="text-gray-300 text-lg">Loading video reports...</div>
      </div>
    );
  }

  const analyzedCount = reports.filter(r => r.analyzed).length;
  const pendingCount = reports.length - analyzedCount;

  return (
    <div className="min-h-screen bg-[#08080c] text-white relative">
      {/* Background grain effect */}
      <svg className="fixed inset-0 w-full h-full pointer-events-none opacity-[0.03]" width="100%" height="100%">
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>

      {/* Content Container */}
      <div className="relative max-w-[1400px] mx-auto p-8">
        {/* Header */}
        <div className="mb-12 flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-serif font-bold text-white mb-3">Video Call Reports</h1>
            <p className="text-gray-400 text-lg">Review and analyze all video sales interactions</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/video-reports/upload"
              className="flex items-center gap-2 px-5 py-2.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 rounded-xl transition-all duration-200 border border-purple-500/40 hover:border-purple-500/60"
            >
              <Upload size={18} />
              <span className="font-medium">Upload CSV</span>
            </Link>
            <button
              onClick={() => navigate('/video-reports/analytics')}
              className="flex items-center gap-2 px-5 py-2.5 bg-purple-600/10 hover:bg-purple-600/20 text-purple-400 rounded-xl transition-all duration-200 border border-purple-500/20 hover:border-purple-500/40"
            >
              <BarChart3 size={18} />
              <span className="font-medium">Analytics Dashboard</span>
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-5 py-2.5 bg-red-600/10 hover:bg-red-600/20 text-red-400 rounded-xl transition-all duration-200 border border-red-500/20 hover:border-red-500/40"
            >
              <LogOut size={18} />
              <span className="font-medium">Logout</span>
            </button>
          </div>
        </div>

        {/* Stats Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Total Videos */}
          <div className="bg-[#0f0f14] rounded-2xl p-6 border border-white/6 hover:border-purple-500/30 transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-purple-500/15 flex items-center justify-center">
                  <Play className="w-8 h-8 text-purple-400" />
                </div>
                <span className="text-gray-400 text-sm font-medium">Total Videos</span>
              </div>
            </div>
            <div className="text-4xl font-serif font-bold text-white">{reports.length}</div>
          </div>

          {/* Analyzed */}
          <div className="bg-[#0f0f14] rounded-2xl p-6 border border-white/6 hover:border-green-500/30 transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-green-500/15 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-400" />
                </div>
                <span className="text-gray-400 text-sm font-medium">Analyzed</span>
              </div>
            </div>
            <div className="text-4xl font-serif font-bold text-white">{analyzedCount}</div>
          </div>

          {/* Pending Analysis */}
          <div className="bg-[#0f0f14] rounded-2xl p-6 border border-white/6 hover:border-amber-500/30 transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-500/15 flex items-center justify-center">
                  <Clock className="w-8 h-8 text-amber-400" />
                </div>
                <span className="text-gray-400 text-sm font-medium">Pending Analysis</span>
              </div>
            </div>
            <div className="text-4xl font-serif font-bold text-white">{pendingCount}</div>
          </div>
        </div>

        {filterIds && (
          <div className="mb-6 flex items-center justify-between bg-amber-500/10 border border-amber-400/40 text-amber-100 rounded-xl px-4 py-3">
            <div className="text-sm font-semibold">
              Showing filtered results{filterDescription ? `: ${filterDescription}` : ''} ({visibleReports.length} of {reports.length})
            </div>
            <button
              onClick={() => navigate('/video-reports')}
              className="text-xs font-semibold px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-300/40"
            >
              Clear filter
            </button>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-900/20 border border-red-600/40 rounded-xl p-4 mb-8">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* Empty State */}
        {!error && reports.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-gray-800/50 flex items-center justify-center mx-auto mb-4">
              <Video className="w-8 h-8 text-gray-500" />
            </div>
            <p className="text-gray-400 text-lg">No video reports found</p>
          </div>
        )}

        {/* Video Call Cards Grid */}
        {!error && reports.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {visibleReports.length === 0 && (
              <div className="col-span-full text-center text-gray-400 py-12">No reports match this filter.</div>
            )}
            {visibleReports.map((report) => {
              const analysis = report.analysis || {};
              const functional = analysis.Functional || {};
              const customer = analysis.Customer_Information || {};
              const hasError = !report.analyzed || analysis.error || analysis.parse_error;

              const visitIntent = customer.Intent_to_Visit_Rating || 'LOW';
              const purchaseIntent = customer.Intent_to_Purchase_Rating || 'LOW';
              const objective = functional.Call_Objective_Theme || null;
              const stage = customer.Customer_Stage_AIDA || 'Awareness';
              const storeLocation = functional.Store_Location || report.store_name || 'Unknown Store';
              const customerLocation = functional.Customer_Location;
              const callTime = functional.Call_Time || report.call_time || 'N/A';
              const duration = report.duration || (report.metadata && report.metadata.duration) || 'N/A';

              const getIntentColor = (intent) => {
                const normalized = typeof intent === 'string' ? intent.toUpperCase() : 'LOW';
                if (normalized === 'HIGH') return 'bg-red-900/30 border-red-600/40 text-red-300';
                if (normalized === 'MEDIUM' || normalized === 'MED') return 'bg-yellow-900/30 border-yellow-600/40 text-yellow-300';
                return 'bg-gray-800/50 border-gray-600/40 text-gray-400';
              };

              return (
                <div
                  key={report.report_id}
                  onClick={() => navigate(`/video-reports/${report.report_id}`)}
                  className="group bg-[#0f0f14] border border-white/6 rounded-2xl p-6 hover:border-amber-500/50 transition-all overflow-hidden relative cursor-pointer"
                >
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-amber-600 to-transparent opacity-0 group-hover:opacity-100 transition"></div>

                  <div className="mb-6 pb-6 border-b border-white/6">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-semibold text-lg text-gray-100 group-hover:text-amber-400 transition" style={{ fontFamily: "'Fraunces', serif" }}>
                        {storeLocation}
                      </h3>
                    </div>
                    {customerLocation && customerLocation !== 'N/A' && (
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span>{customerLocation}</span>
                      </div>
                    )}
                  </div>

                  <div className="mb-4">
                    <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Call ID</p>
                    <p className="font-mono text-sm text-gray-300">{report.report_id}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Date</p>
                      <div className="flex items-center gap-2 text-sm text-gray-200">
                        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeWidth={2} />
                          <line x1="16" y1="2" x2="16" y2="6" strokeWidth={2} />
                          <line x1="8" y1="2" x2="8" y2="6" strokeWidth={2} />
                          <line x1="3" y1="10" x2="21" y2="10" strokeWidth={2} />
                        </svg>
                        <span>{callTime}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Duration</p>
                      <div className="flex items-center gap-2 text-sm text-gray-200">
                        <Clock className="w-4 h-4 text-gray-600" />
                        <span>{duration}</span>
                      </div>
                    </div>
                  </div>

                  {hasError ? (
                    <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-3 text-xs text-red-300">
                      ⚠️ Analysis failed or pending
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-2 mb-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${getIntentColor(visitIntent)}`}>
                          Visit: {visitIntent}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${getIntentColor(purchaseIntent)}`}>
                          Purchase: {purchaseIntent}
                        </span>
                      </div>

                      {objective && (
                        <div className="bg-[#16161d] rounded-lg p-3 mb-4">
                          <p className="text-xs text-gray-500 mb-1">Objective</p>
                          <p className="text-sm text-gray-300">{objective}</p>
                        </div>
                      )}

                      <div className="bg-[#16161d] rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">Customer Stage</p>
                        <p className="text-sm text-amber-400 font-semibold">{stage}</p>
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
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

