import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Play, CheckCircle, Clock, LogOut, Video, ChevronRight, BarChart3, Upload } from 'lucide-react';

export default function VideoCallsList() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchVideoReports();
  }, []);

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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
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
            {reports.map((report) => (
              <div
                key={report.report_id}
                onClick={() => navigate(`/video-reports/${report.report_id}`)}
                className="bg-[#0f0f14] rounded-2xl p-6 border border-white/6 hover:border-amber-500/30 hover:bg-[#16161d] transition-all duration-300 cursor-pointer group"
              >
                {/* Header Row: Store Badge + Status Badge */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 bg-purple-500/15 rounded-lg px-3 py-1.5">
                    <Video className="w-4 h-4 text-purple-400" />
                    <span className="text-purple-300 text-xs font-medium">Store</span>
                  </div>
                  {report.analyzed ? (
                    <span className="px-3 py-1 bg-green-500/15 text-green-400 rounded-lg text-xs font-medium">
                      Analyzed
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-amber-500/15 text-amber-400 rounded-lg text-xs font-medium">
                      Pending
                    </span>
                  )}
                </div>

                {/* Store Location */}
                <h3 className="text-xl font-serif font-semibold text-white mb-3 line-clamp-2">
                  {report.store_name || 'Unknown Store'}
                </h3>

                {/* Metadata Row */}
                <div className="flex items-center gap-4 mb-4 text-sm text-gray-400">
                  <span className="font-mono text-xs">{report.report_id}</span>
                  <span className="text-xs">{report.call_time || 'N/A'}</span>
                </div>

                {/* Product Pill */}
                {report.product && (
                  <div className="mb-3">
                    <span className="inline-block bg-[#16161d] rounded-full px-3 py-1 text-xs text-gray-300">
                      {report.product}
                    </span>
                  </div>
                )}

                {/* Customer Name */}
                {report.customer_name && (
                  <p className="text-gray-300 text-sm mb-4">
                    Customer: {report.customer_name}
                  </p>
                )}

                {/* Footer: View Analysis */}
                <div className="flex items-center justify-end text-amber-400 text-sm font-medium mt-4 pt-4 border-t border-white/6 group-hover:text-amber-300 transition-colors">
                  <span>View Analysis</span>
                  <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform duration-200" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

