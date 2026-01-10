import React, { useState, useEffect, useRef } from 'react';
import { Send, X, ArrowLeft } from 'lucide-react';

const MysteryShopperChat = () => {
  const [personas, setPersonas] = useState([]);
  const [selectedPersona, setSelectedPersona] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [messages, setMessages] = useState([]);
  const [staffInput, setStaffInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [sessionStatus, setSessionStatus] = useState(null);
  const [evaluationReport, setEvaluationReport] = useState(null);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);

  // Fetch available personas
  useEffect(() => {
    const fetchPersonas = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/mystery-shopper/personas');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        // Convert personas object to array safely
        if (data && data.personas && typeof data.personas === 'object') {
          const personasArray = Object.entries(data.personas).map(([key, persona]) => ({
            key,
            ...persona
          }));
          
          setPersonas(personasArray);
          if (personasArray.length > 0) {
            setSelectedPersona(personasArray[0].key);
          }
        } else {
          throw new Error('Invalid personas data structure');
        }
      } catch (err) {
        setError('Failed to load personas: ' + err.message);
        console.error('Error loading personas:', err);
      }
    };
    
    fetchPersonas();
  }, []);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Start new session
  const handleStartSession = async () => {
    if (!selectedPersona) {
      setError('Please select a persona');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('http://localhost:8000/api/mystery-shopper/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona: selectedPersona })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to start session');
      }

      setSessionId(data.session_id);
      setSessionStarted(true);
      setSessionEnded(false);
      setEvaluationReport(null);
      setMessages([
        {
          type: 'customer',
          content: data.opening_message,
          timestamp: new Date()
        }
      ]);
    } catch (err) {
      setError('Error starting session: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Send staff message
  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (!staffInput.trim() || !sessionId) return;

    const staffMessage = staffInput.trim();
    setStaffInput('');
    setLoading(true);
    setError('');

    // Add staff message to UI immediately
    setMessages(prev => [...prev, {
      type: 'staff',
      content: staffMessage,
      timestamp: new Date()
    }]);

    try {
      const response = await fetch('http://localhost:8000/api/mystery-shopper/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          staff_message: staffMessage
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to send message');
      }

      // Add customer response
      setMessages(prev => [...prev, {
        type: 'customer',
        content: data.customer_message,
        analysis: data.internal_analysis,
        timestamp: new Date()
      }]);

      setSessionStatus(data.session_status);

      // Check if session ended
      if (data.session_ended) {
        setSessionEnded(true);
        setEvaluationReport(data.evaluation_report);
      }
    } catch (err) {
      setError('Error sending message: ' + err.message);
      // Remove the staff message if there was an error
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  // Reset for new session
  const handleNewSession = () => {
    setMessages([]);
    setStaffInput('');
    setSessionStarted(false);
    setSessionEnded(false);
    setSessionStatus(null);
    setEvaluationReport(null);
    setSessionId('');
    setError('');
  };

  return (
    <div className="min-h-screen bg-[#08080c] text-gray-100" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <div className="bg-[#0f0f14] border-b border-white/10 px-6 py-4">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl font-semibold text-gray-100 mb-1" style={{ fontFamily: "'Fraunces', serif" }}>
            🔍 Mystery Shopper Evaluation
          </h1>
          <p className="text-sm text-gray-400">Test your sales team's product knowledge & closing skills</p>
        </div>
      </div>

      {error && (
        <div className="max-w-5xl mx-auto mt-4 px-6">
          <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-4 flex items-center justify-between">
            <span className="text-red-400 text-sm">⚠️ {error}</span>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-300">
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {!sessionStarted ? (
        // Persona Selection Screen
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-100 mb-2" style={{ fontFamily: "'Fraunces', serif" }}>
              Select a Persona
            </h2>
            <p className="text-sm text-gray-400">Choose which customer will evaluate your sales team</p>
          </div>
          
          {personas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-gray-400">Loading personas...</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {personas.map(persona => (
                  <div
                    key={persona.key}
                    onClick={() => setSelectedPersona(persona.key)}
                    className={`bg-[#0f0f14] border rounded-xl p-5 cursor-pointer transition-all ${
                      selectedPersona === persona.key
                        ? 'border-amber-500/60 bg-amber-900/10'
                        : 'border-white/6 hover:border-white/20'
                    }`}
                  >
                    <div className="mb-3">
                      <h3 className="text-lg font-semibold text-gray-100 mb-1">{persona.name}</h3>
                      <p className="text-xs text-gray-500 italic">{persona.context}</p>
                    </div>
                    <div className="space-y-2 mb-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-500">Budget</span>
                        <span className="text-amber-400 font-semibold">₹{persona.budget.toLocaleString()}</span>
                      </div>
                      <div className="text-xs">
                        <span className="text-gray-500">Needs: </span>
                        <span className="text-gray-300">{persona.needs}</span>
                      </div>
                    </div>
                    {selectedPersona === persona.key && (
                      <div className="text-xs text-amber-400 font-semibold mt-3 pt-3 border-t border-amber-500/20">
                        ✓ Selected
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-center">
                <button
                  onClick={handleStartSession}
                  disabled={!selectedPersona || loading}
                  className="px-8 py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold rounded-lg transition-all disabled:cursor-not-allowed"
                >
                  {loading ? 'Starting...' : 'Start Evaluation'}
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        // Chat Screen
        <div className="max-w-4xl mx-auto px-6 py-6 h-[calc(100vh-120px)] flex flex-col">
          {/* Chat Header */}
          <div className="bg-[#0f0f14] border border-white/6 rounded-t-xl px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={handleNewSession}
                className="text-gray-400 hover:text-gray-200 transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <h2 className="text-lg font-semibold text-gray-100">
                  {personas.find(p => p.key === selectedPersona)?.name}
                </h2>
                <span className="text-xs text-gray-500 uppercase tracking-wider">
                  {sessionStatus || 'in progress'}
                </span>
              </div>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 bg-[#0f0f14] border-x border-white/6 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.type === 'staff' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] ${msg.type === 'staff' ? 'order-2' : 'order-1'}`}>
                  <div
                    className={`rounded-2xl px-4 py-3 ${
                      msg.type === 'staff'
                        ? 'bg-amber-500/20 border border-amber-500/30'
                        : 'bg-gray-800/50 border border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2 text-xs text-gray-400">
                      <span>{msg.type === 'staff' ? '👤 You' : '🎭 Customer'}</span>
                      <span className="text-gray-600">•</span>
                      <span>{msg.timestamp.toLocaleTimeString()}</span>
                    </div>
                    <p className="text-sm text-gray-200 leading-relaxed">{msg.content}</p>
                    
                    {msg.analysis && (
                      <details className="mt-3 pt-3 border-t border-white/10">
                        <summary className="text-xs text-amber-400 cursor-pointer hover:text-amber-300 font-semibold">
                          📊 View Analysis
                        </summary>
                        <div className="mt-2 space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Score:</span>
                            <span className="text-gray-300 font-semibold">{msg.analysis.score}/10</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Product:</span>
                            <span className="text-gray-300 text-right">{msg.analysis.product_check}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Objection:</span>
                            <span className="text-gray-300">{msg.analysis.objection_status}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Closing:</span>
                            <span className="text-gray-300">{msg.analysis.closing_status}</span>
                          </div>
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input or Evaluation */}
          {!sessionEnded ? (
            <form onSubmit={handleSendMessage} className="bg-[#0f0f14] border border-white/6 rounded-b-xl p-4 flex gap-3">
              <input
                type="text"
                value={staffInput}
                onChange={(e) => setStaffInput(e.target.value)}
                placeholder="Type your message..."
                disabled={loading}
                autoFocus
                className="flex-1 bg-[#08080c] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-500/50 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={loading || !staffInput.trim()}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-all disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Send size={18} />
              </button>
            </form>
          ) : (
            <div className="bg-[#0f0f14] border border-white/6 rounded-b-xl p-6">
              {evaluationReport && (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-gray-100" style={{ fontFamily: "'Fraunces', serif" }}>
                      📋 Evaluation Report
                    </h2>
                    <div
                      className={`px-4 py-2 rounded-lg font-bold text-sm ${
                        evaluationReport.status === 'success'
                          ? 'bg-emerald-900/20 text-emerald-400 border border-emerald-600/30'
                          : evaluationReport.status === 'neutral'
                          ? 'bg-amber-900/20 text-amber-400 border border-amber-600/30'
                          : 'bg-red-900/20 text-red-400 border border-red-600/30'
                      }`}
                    >
                      {evaluationReport.status === 'success' && '✅ SUCCESS'}
                      {evaluationReport.status === 'neutral' && '⚠️ NEUTRAL'}
                      {evaluationReport.status === 'fail' && '❌ FAIL'}
                    </div>
                  </div>

                  <div className="space-y-4 mb-6">
                    <div className="bg-[#08080c] border border-white/6 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-gray-300 mb-3">Performance Metrics</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="text-center">
                          <div className="text-xs text-gray-500 mb-1">Avg Score</div>
                          <div className="text-2xl font-bold text-amber-400">
                            {evaluationReport.metrics.average_score}
                          </div>
                          <div className="text-xs text-gray-600">/10</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-gray-500 mb-1">Turns</div>
                          <div className="text-2xl font-bold text-gray-300">
                            {evaluationReport.metrics.total_exchanges}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-gray-500 mb-1">Product ID</div>
                          <div className={`text-2xl font-bold ${
                            evaluationReport.metrics.product_identified_correctly ? 'text-emerald-400' : 'text-red-400'
                          }`}>
                            {evaluationReport.metrics.product_identified_correctly ? '✓' : '✗'}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-gray-500 mb-1">Objection</div>
                          <div className={`text-2xl font-bold ${
                            evaluationReport.metrics.objection_resolved ? 'text-emerald-400' : 'text-red-400'
                          }`}>
                            {evaluationReport.metrics.objection_resolved ? '✓' : '✗'}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#08080c] border border-white/6 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-gray-300 mb-2">Feedback</h3>
                      <p className="text-sm text-gray-400 leading-relaxed">{evaluationReport.feedback}</p>
                    </div>
                  </div>

                  <button
                    onClick={handleNewSession}
                    className="w-full px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg transition-all"
                  >
                    🔄 Run Another Evaluation
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MysteryShopperChat;
