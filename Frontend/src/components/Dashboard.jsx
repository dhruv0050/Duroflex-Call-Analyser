import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, Video, LogOut } from 'lucide-react';

const Dashboard = () => {
  const navigate = useNavigate();
  const adminEmail = localStorage.getItem('admin_email');

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('admin_email');
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#08080c] text-gray-100" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Grain texture overlay */}
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none" style={{
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")"
      }}></div>

      <div className="max-w-[1400px] mx-auto px-6 py-10 relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-16">
          <div>
            <h1 className="text-3xl font-semibold text-gray-100 mb-2" style={{ fontFamily: "'Fraunces', serif" }}>
              Welcome to Duroflex
            </h1>
            <p className="text-sm text-gray-400">Call Analytics Dashboard</p>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-xs uppercase tracking-wider text-gray-500">Logged in as</p>
              <p className="text-sm font-medium text-gray-200">{adminEmail}</p>
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-900/20 hover:bg-red-900/30 border border-red-600/30 rounded-lg text-red-400 text-sm font-semibold transition"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-2xl">
          <div className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-100 mb-2" style={{ fontFamily: "'Fraunces', serif" }}>
              What do you want to analyse?
            </h2>
            <p className="text-gray-400 text-sm">Choose the type of call analysis you'd like to explore</p>
          </div>

          {/* Analysis Options */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Audio Call Reports */}
            <button
              onClick={() => navigate('/call-reports/analytics')}
              className="group bg-[#0f0f14] border border-white/6 rounded-2xl p-8 hover:border-amber-500/50 transition overflow-hidden relative"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-emerald-600 to-transparent opacity-0 group-hover:opacity-100 transition"></div>

              <div className="flex items-start justify-between mb-6">
                <div className="p-4 bg-emerald-900/20 rounded-xl border border-emerald-600/30 group-hover:border-emerald-600/60 transition">
                  <Phone className="w-8 h-8 text-emerald-400" />
                </div>
              </div>

              <h3 className="text-xl font-semibold text-gray-100 mb-3 text-left" style={{ fontFamily: "'Fraunces', serif" }}>
                Audio Call Reports
              </h3>
              <p className="text-gray-400 text-sm text-left leading-relaxed mb-6">
                Analyze and review recorded audio call data with comprehensive metrics, customer insights, and agent performance analysis.
              </p>

              <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
                <span>Explore Reports</span>
                <svg className="w-4 h-4 group-hover:translate-x-1 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>

            {/* Video Call Reports - NEW */}
            <button
              onClick={() => navigate('/video-reports/analytics')}
              className="group bg-[#0f0f14] border border-white/6 rounded-2xl p-8 hover:border-amber-500/50 transition overflow-hidden relative"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-amber-600 to-transparent opacity-0 group-hover:opacity-100 transition"></div>

              <div className="flex items-start justify-between mb-6">
                <div className="p-4 bg-amber-900/20 rounded-xl border border-amber-600/30 group-hover:border-amber-600/60 transition">
                  <Video className="w-8 h-8 text-amber-400" />
                </div>
              </div>

              <h3 className="text-xl font-semibold text-gray-100 mb-3 text-left" style={{ fontFamily: "'Fraunces', serif" }}>
                Video Call Reports
              </h3>
              <p className="text-gray-400 text-sm text-left leading-relaxed mb-6">
                Analyze and review video call recordings with AI-powered insights, agent performance metrics, and customer interaction analysis.
              </p>

              <div className="flex items-center gap-2 text-amber-400 text-sm font-semibold">
                <span>View Video Reports</span>
                <svg className="w-4 h-4 group-hover:translate-x-1 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-16 pt-8 border-t border-gray-800">
          <p className="text-xs text-gray-600">
            Duroflex Call Analytics Dashboard © 2025 | All call data is securely stored and encrypted
          </p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
