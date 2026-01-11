import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, Video } from 'lucide-react';

const Dashboard = () => {
  const navigate = useNavigate();
  const adminEmail = localStorage.getItem('admin_email');

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('admin_email');
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white px-5 py-6 sm:px-8 md:px-12" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between py-5 mb-12">
          <div className="space-y-1">
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">
              Duroflex Call Analyzer
            </h1>
            <p className="text-sm text-slate-400">
              Powered by <span className="text-blue-400 font-semibold">Beyond AI</span>
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Logged in as</p>
              <p className="text-sm font-medium text-slate-100">{adminEmail}</p>
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-400 transition hover:translate-y-[-2px] hover:bg-red-500/15"
            >
              <span className="text-lg leading-none">↗</span>
              Logout
            </button>
          </div>
        </header>

        {/* Hero */}
        <section className="text-center max-w-4xl mx-auto mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl font-semibold text-slate-100 mb-4">
            Transform Your Call Data into Actionable Insights
          </h2>
          <p className="text-base sm:text-lg text-slate-400 leading-relaxed">
            Convert unstructured call recordings into valuable intelligence. Understand customer needs, evaluate representative performance, and boost conversion rates with AI-powered analytics.
          </p>
        </section>

        {/* Value props */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 mb-12">
          {[
            {
              icon: '🎯',
              title: 'Understand Customer Intent',
              desc: "Discover why customers call and what problems they're trying to solve",
            },
            {
              icon: '📊',
              title: 'Evaluate Performance',
              desc: 'Analyze how representatives address customer concerns and handle interactions',
            },
            {
              icon: '📈',
              title: 'Optimize Conversions',
              desc: 'Identify opportunities to improve conversion rates and customer satisfaction',
            },
          ].map(({ icon, title, desc }) => (
            <div
              key={title}
              className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6 backdrop-blur transition hover:-translate-y-1 hover:border-blue-500 hover:bg-[#252525]"
            >
              {/* <div className="text-3xl mb-3">{icon}</div> */}
              <h3 className="text-lg font-semibold text-blue-400 mb-2">{title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        {/* CTA Cards */}
        <section className="text-center mb-6">
          <h3 className="text-xl sm:text-2xl font-semibold text-slate-100">What do you want to analyze?</h3>
        </section>

        <div className="grid gap-7 md:grid-cols-2 max-w-5xl mx-auto">
          <button
            onClick={() => navigate('/call-reports/analytics')}
            className="group relative overflow-hidden rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a] p-8 text-left transition hover:-translate-y-2 hover:border-blue-500 hover:bg-[#252525] hover:shadow-[0_20px_60px_rgba(59,130,246,0.3)]"
          >
            <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 to-cyan-400 origin-left scale-x-0 transition duration-300 group-hover:scale-x-100" />
            <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-blue-500/30 bg-gradient-to-br from-blue-500/10 to-cyan-400/10 text-3xl transition group-hover:scale-110 group-hover:rotate-3">
              <Phone className="h-8 w-8 text-blue-400" />
            </div>
            <div className="text-2xl font-semibold mb-3">Audio Call Reports</div>
            <p className="text-base text-slate-400 leading-relaxed mb-7">
              Analyze and review recorded audio call data with comprehensive metrics, customer insights, and agent performance analysis.
            </p>
            <span className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-400 px-5 py-3 text-sm font-semibold text-white transition group-hover:translate-x-1">
              Explore Reports
              <span className="transition group-hover:translate-x-1">→</span>
            </span>
          </button>

          <button
            onClick={() => navigate('/video-reports/analytics')}
            className="group relative overflow-hidden rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a] p-8 text-left transition hover:-translate-y-2 hover:border-blue-500 hover:bg-[#252525] hover:shadow-[0_20px_60px_rgba(59,130,246,0.3)]"
          >
            <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 to-cyan-400 origin-left scale-x-0 transition duration-300 group-hover:scale-x-100" />
            <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-blue-500/30 bg-gradient-to-br from-blue-500/10 to-cyan-400/10 text-3xl transition group-hover:scale-110 group-hover:rotate-3">
              <Video className="h-8 w-8 text-blue-400" />
            </div>
            <div className="text-2xl font-semibold mb-3">Video Call Reports</div>
            <p className="text-base text-slate-400 leading-relaxed mb-7">
              Analyze and review video call recordings with AI-powered insights, agent performance metrics, and customer interaction analysis.
            </p>
            <span className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-400 px-5 py-3 text-sm font-semibold text-white transition group-hover:translate-x-1">
              View Video Reports
              <span className="transition group-hover:translate-x-1">→</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
