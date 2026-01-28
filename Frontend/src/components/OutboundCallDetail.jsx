import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronUp, Download, FileDown } from 'lucide-react';

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

// Normalizers and helpers
const normalizeTranscriptLog = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    return value
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
};

const normalizeNumber = (value, fallback = 0) => {
  if (value === null || value === undefined || value === '') return fallback;
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isFinite(num) ? num : fallback;
};

const ratingLabelToScore = (value, fallback = 0) => {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'number') return value;
  const str = String(value).trim().toUpperCase();
  if (str === 'N/A' || str === 'NA') return 0;
  if (str.includes('NONE')) return 0;
  if (str.includes('HIGH')) return 5;
  if (str.includes('MEDIUM')) return 3;
  if (str.includes('LOW')) return 1;
  return fallback;
};

const normalizeStoreName = (name) => {
  const str = (name ?? '').toString().trim();
  if (!str) return 'Unknown';
  const lower = str.toLowerCase();
  if (lower === 'nan' || lower === 'null' || lower === 'undefined') return 'Unknown';
  return str;
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

    const OutboundCallDetail = () => {
      const { callId } = useParams();
      const [report, setReport] = useState(null);
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState('');
      const [expandTranscript, setExpandTranscript] = useState(false);

      useEffect(() => {
        const fetchReport = async () => {
          try {
            setLoading(true);
            setError('');
            const res = await fetch(`${API_BASE}/api/outbound-calls/${encodeURIComponent(callId)}`);
            if (!res.ok) {
              throw new Error(`Failed to load report (${res.status})`);
            }
            const data = await res.json();
            setReport(data?.report || data);
          } catch (e) {
            setError(e?.message || 'Failed to load outbound call report');
            setReport(null);
          } finally {
            setLoading(false);
          }
        };

        if (callId) fetchReport();
      }, [callId]);

      const downloadCSV = () => {
        if (!report) return;

        const analysis = report.analysis || {};
        const get = (...paths) => getField(analysis, ...paths);

        const intentRating = get(
          'Pillar_1_Customer_Intent_and_Barriers.Intent_to_Purchase_Rating',
          'PILLAR_1_INTENT_BARRIERS.Intent_to_Purchase_Rating',
          'Call_Analysis.PILLAR_1_CUSTOMER_INTENT_BARRIERS.Intent_to_Purchase_Rating',
          'PILLAR_1.Intent_to_Purchase_Rating',
          'PILLAR_1_CUSTOMER_INTENT_BARRIERS.Intent_to_Purchase_Rating'
        ) || '';

        const nonPurchaseReason = get(
          'Pillar_1_Customer_Intent_and_Barriers.Primary_NonPurchase_Reason',
          'PILLAR_1_INTENT_BARRIERS.Primary_NonPurchase_Reason',
          'Call_Analysis.PILLAR_1_CUSTOMER_INTENT_BARRIERS.Primary_NonPurchase_Reason',
          'PILLAR_1.Primary_NonPurchase_Reason',
          'PILLAR_1_CUSTOMER_INTENT_BARRIERS.Primary_NonPurchase_Reason'
        ) || '';

        const overallExpRating = get(
          'Pillar_2_Experience_Delivered.Overall_Experience_Rating',
          'PILLAR_2_EXPERIENCE_DELIVERED.C_OVERALL_EXPERIENCE.Overall_Experience_Rating',
          'Call_Analysis.PILLAR_2_EXPERIENCE_DELIVERED.C_OVERALL_EXPERIENCE_RATING.Overall_Experience_Rating',
          'PILLAR_2.Overall_Experience_Rating',
          'PILLAR_2_EXPERIENCE_DELIVERED.OVERALL_EXPERIENCE.Overall_Experience_Rating'
        ) || '';

        const rRating = get(
          'Pillar_3_RELAX_Framework.R_Reach_Out.Rating',
          'PILLAR_3_RELAX_FRAMEWORK.R_REACH_OUT.Rating',
          'Call_Analysis.PILLAR_3_RELAX_FRAMEWORK.R_REACH_OUT.Rating',
          'PILLAR_3.R_Reach_Out.Rating',
          'PILLAR_3.R_REACH_OUT.Rating'
        ) || '';
        const eRating = get(
          'Pillar_3_RELAX_Framework.E_Explore_Needs.Rating',
          'PILLAR_3_RELAX_FRAMEWORK.E_EXPLORE_NEEDS.Rating',
          'Call_Analysis.PILLAR_3_RELAX_FRAMEWORK.E_EXPLORE_NEEDS.Rating',
          'PILLAR_3.E_Explore_Needs.Rating',
          'PILLAR_3.E_EXPLORE_NEEDS.Rating'
        ) || '';
        const lRating = get(
          'Pillar_3_RELAX_Framework.L_Link_Experience.Rating',
          'PILLAR_3_RELAX_FRAMEWORK.L_LINK_EXPERIENCE.Rating',
          'Call_Analysis.PILLAR_3_RELAX_FRAMEWORK.L_LINK_EXPERIENCE.Rating',
          'PILLAR_3.L_Link_Experience.Rating',
          'PILLAR_3.L_LINK_EXPERIENCE.Rating'
        ) || '';
        const aRating = get(
          'Pillar_3_RELAX_Framework.A_Add_Value.Rating',
          'PILLAR_3_RELAX_FRAMEWORK.A_ADD_VALUE.Rating',
          'Call_Analysis.PILLAR_3_RELAX_FRAMEWORK.A_ADD_VALUE.Rating',
          'PILLAR_3.A_Add_Value.Rating',
          'PILLAR_3.A_ADD_VALUE.Rating'
        ) || '';
        const xRating = get(
          'Pillar_3_RELAX_Framework.X_Express_Closing.Rating',
          'PILLAR_3_RELAX_FRAMEWORK.X_EXPRESS_CLOSING.Rating',
          'Call_Analysis.PILLAR_3_RELAX_FRAMEWORK.X_EXPRESS_CLOSING.Rating',
          'PILLAR_3.X_Express_Closing.Rating',
          'PILLAR_3.X_EXPRESS_CLOSING.Rating'
        ) || '';

        const invitationQuality = get(
          'Pillar_4_Invitation_to_Convert.Invitation_Quality_Rating',
          'PILLAR_4_INVITATION_TO_CONVERT.Invitation_Quality_Rating',
          'Call_Analysis.PILLAR_4_INVITATION_TO_CONVERT.Invitation_Quality_Rating',
          'PILLAR_4.Invitation_Quality_Rating'
        ) || '';
        const commitment = get(
          'Pillar_4_Invitation_to_Convert.Commitment_Obtained',
          'PILLAR_4_INVITATION_TO_CONVERT.Commitment_Obtained',
          'Call_Analysis.PILLAR_4_INVITATION_TO_CONVERT.Commitment_Obtained',
          'PILLAR_4.Commitment_Obtained'
        ) || '';

        const productScore = get(
          'Pillar_5_Agent_Competency.Product_Knowledge.Score',
          'PILLAR_5_AGENT_COMPETENCY.A_PRODUCT_KNOWLEDGE.Rating',
          'Call_Analysis.PILLAR_5_AGENT_COMPETENCY.A_PRODUCT_KNOWLEDGE',
          'PILLAR_5.Product_Knowledge.Score',
          'PILLAR_5.PRODUCT_KNOWLEDGE'
        ) || '';
        const salesScore = get(
          'Pillar_5_Agent_Competency.Sales_Skills.Score',
          'PILLAR_5_AGENT_COMPETENCY.B_SALES_SKILLS.Rating',
          'Call_Analysis.PILLAR_5_AGENT_COMPETENCY.B_SALES_SKILLS',
          'PILLAR_5.Sales_Skills.Score',
          'PILLAR_5.SALES_SKILLS'
        ) || '';
        const softScore = get(
          'Pillar_5_Agent_Competency.Soft_Skills.Score',
          'PILLAR_5_AGENT_COMPETENCY.C_SOFT_SKILLS_ETIQUETTE.Rating',
          'Call_Analysis.PILLAR_5_AGENT_COMPETENCY.C_SOFT_SKILLS_ETIQUETTE',
          'PILLAR_5.Soft_Skills.Score',
          'PILLAR_5.SOFT_SKILLS_ETIQUETTE'
        ) || '';

        const synopsis = get('Overall_Summary.Call_Synopsis', 'OVERALL_SUMMARY.Call_Synopsis') || '';
        const verdict = get('Overall_Summary.Recovery_Verdict', 'OVERALL_SUMMARY.Recovery_Verdict') || '';

        const headers = [
          'Call_ID', 'Store_Name', 'Phone_Number', 'Call_Date', 'Duration',
          'Is_Converted', 'Intent_to_Purchase', 'Primary_NonPurchase_Reason',
          'Overall_Experience_Rating', 'RELAX_Overall_Score',
          'R_Rating', 'E_Rating', 'L_Rating', 'A_Rating', 'X_Rating',
          'Invitation_Quality', 'Commitment_Obtained',
          'Product_Knowledge_Score', 'Sales_Skills_Score', 'Soft_Skills_Score',
          'Call_Synopsis', 'Recovery_Verdict'
        ];

        const relaxScores = [rRating, eRating, lRating, aRating, xRating]
          .map((v) => normalizeNumber(v, 0))
          .filter((n) => n > 0);
        const relaxOverall = relaxScores.length > 0 ? Math.round(relaxScores.reduce((a, b) => a + b, 0) / relaxScores.length) : '';

        const row = [
          report.call_id,
          report.store_name,
          report.phone_number || report.customer_phone,
          report.call_date,
          report.duration,
          isConvertedValue(report.is_converted) ? 'Yes' : 'No',
          intentRating,
          nonPurchaseReason,
          overallExpRating,
          relaxOverall,
          rRating,
          eRating,
          lRating,
          aRating,
          xRating,
          invitationQuality,
          commitment,
          productScore,
          salesScore,
          softScore,
          (synopsis || '').replace(/,/g, ';').replace(/\n/g, ' '),
          verdict
        ];

        const escapeCSVField = (field) => {
          const str = String(field ?? '');
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        };

        const csvContent = [headers.join(','), row.map(escapeCSVField).join(',')].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `outbound_call_${report.call_id}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
      };

  

  const downloadTranscript = () => {
    if (!report) return;

    const analysis = report.analysis || {};
    let transcript = normalizeTranscriptLog(getField(analysis, 'Transcript_Log', 'FUNCTIONAL_INFORMATION.Transcript_Log'));

    // If transcript is an array of strings, parse it into {Timestamp, Speaker, Text}
    if (transcript.length > 0 && typeof transcript[0] === 'string') {
      transcript = transcript.map((line, idx) => {
        const match = String(line).match(/^(\d{2}:\d{2})\s+(.*?):\s*(.*)$/);
        if (match) {
          return { Timestamp: match[1], Speaker: match[2], Text: match[3] };
        }
        return { Timestamp: `${idx + 1}`, Speaker: 'Unknown', Text: String(line) };
      });
    }

    if (transcript.length === 0) {
      alert('No transcript available for this call');
      return;
    }

    let textContent = `OUTBOUND CALL TRANSCRIPT\n`;
    textContent += `${'='.repeat(80)}\n\n`;
    textContent += `Call ID: ${report.call_id}\n`;
    textContent += `Store: ${report.store_name}\n`;
    textContent += `Date: ${report.call_date}\n`;
    textContent += `Duration: ${report.duration}s\n`;
    textContent += `Phone: ${report.phone_number || report.customer_phone || analysis?.FUNCTIONAL_INFORMATION?.Customer_Phone || 'N/A'}\n\n`;
    textContent += `${'='.repeat(80)}\n\n`;

    transcript.forEach((entry, index) => {
      const timestamp = entry.Timestamp || `${index + 1}`;
      const speaker = entry.Speaker || 'Unknown';
      const text = entry.Text || '';
      textContent += `[${timestamp}] ${speaker}:\n`;
      textContent += `${text}\n\n`;
    });

    textContent += `${'='.repeat(80)}\n`;
    textContent += `End of Transcript\n`;

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `outbound_call_transcript_${report.call_id}.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#08080c] flex items-center justify-center">
        <div className="text-gray-300">Loading call report...</div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-[#08080c] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || 'Report not found'}</p>
          <Link to="/outbound-calls" className="text-amber-400 hover:text-amber-300 font-semibold inline-flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to Calls
          </Link>
        </div>
      </div>
    );
  }

  const analysis = report.analysis || {};
  const hasError = analysis.error;

  if (hasError) {
    return (
      <div className="min-h-screen bg-[#08080c] p-8">
        <Link to="/outbound-calls" className="inline-flex items-center gap-2 text-amber-400 hover:text-amber-300 mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Calls
        </Link>
        <div className="max-w-4xl mx-auto bg-[#0f0f14] border border-white/6 rounded-xl p-8">
          <h1 className="text-2xl font-bold text-gray-100 mb-4">{report.store_name}</h1>
          <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-6">
            <p className="text-red-300">⚠️ Analysis Error: {analysis.error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Helper function to get data from both expected and actual structures
  const get = (...paths) => getField(analysis, ...paths);

  // Functional data - both structures
  const functional = analysis.Functional || analysis.FUNCTIONAL_INFORMATION || analysis.Functional_Information || {};
  
  // Pillar 1: Customer Intent & Barriers
  const pillar1 = {
    Intent_to_Purchase_Rating: get(
      'Pillar_1_Customer_Intent_and_Barriers.Intent_to_Purchase_Rating',
      'PILLAR_1_INTENT_BARRIERS.Intent_to_Purchase_Rating',
      'Call_Analysis.PILLAR_1_CUSTOMER_INTENT_BARRIERS.Intent_to_Purchase_Rating',
      'PILLAR_1.Intent_to_Purchase_Rating',
      'PILLAR_1_CUSTOMER_INTENT_BARRIERS.Intent_to_Purchase_Rating'
    ),
    Primary_NonPurchase_Reason: get(
      'Pillar_1_Customer_Intent_and_Barriers.Primary_NonPurchase_Reason',
      'PILLAR_1_INTENT_BARRIERS.Primary_NonPurchase_Reason',
      'Call_Analysis.PILLAR_1_CUSTOMER_INTENT_BARRIERS.Primary_NonPurchase_Reason',
      'PILLAR_1.Primary_NonPurchase_Reason'
    ),
    Secondary_Barriers: get(
      'Pillar_1_Customer_Intent_and_Barriers.Secondary_Barriers',
      'PILLAR_1_INTENT_BARRIERS.Secondary_Barriers',
      'Call_Analysis.PILLAR_1_CUSTOMER_INTENT_BARRIERS.Secondary_Barriers',
      'PILLAR_1.Secondary_Barriers'
    ) || [],
    Timeline_to_Purchase: get(
      'Pillar_1_Customer_Intent_and_Barriers.Timeline_to_Purchase',
      'PILLAR_1_INTENT_BARRIERS.Timeline_to_Purchase',
      'Call_Analysis.PILLAR_1_CUSTOMER_INTENT_BARRIERS.Timeline_to_Purchase',
      'PILLAR_1.Timeline_to_Purchase'
    ),
    Customer_Stage_AIDA: get(
      'Pillar_1_Customer_Intent_and_Barriers.Customer_Stage_AIDA',
      'PILLAR_1_INTENT_BARRIERS.Customer_Stage_AIDA',
      'Call_Analysis.PILLAR_1_CUSTOMER_INTENT_BARRIERS.Customer_Stage_AIDA',
      'PILLAR_1.Customer_Stage_AIDA'
    ),
    Intent_Shift: get(
      'Pillar_1_Customer_Intent_and_Barriers.Intent_Shift',
      'PILLAR_1_INTENT_BARRIERS.Intent_Shift',
      'Call_Analysis.PILLAR_1_CUSTOMER_INTENT_BARRIERS.Intent_Shift',
      'PILLAR_1.Intent_Shift'
    ),
  };

  // Pillar 2: Experience Delivered
  const pillar2Raw = analysis.Pillar_2_Experience_Delivered || analysis.PILLAR_2_EXPERIENCE_DELIVERED || analysis.Call_Analysis?.PILLAR_2_EXPERIENCE_DELIVERED || analysis.PILLAR_2 || {};
  const customerExp = pillar2Raw.Customer_Experience || pillar2Raw.A_CUSTOMER_EXPERIENCE || pillar2Raw.CUSTOMER_EXPERIENCE || {};
  const salesExp = pillar2Raw.Sales_Experience || pillar2Raw.B_SALES_EXPERIENCE || pillar2Raw.SALES_EXPERIENCE || {};
  const overallExp = pillar2Raw.C_OVERALL_EXPERIENCE || pillar2Raw.C_OVERALL_EXPERIENCE_RATING || pillar2Raw.C_OVERALL_EXPERIENCE_Rating || pillar2Raw.OVERALL_EXPERIENCE || {};
  
  const pillar2 = {
    Overall_Experience_Rating: normalizeNumber(
      pillar2Raw.Overall_Experience_Rating ??
      overallExp.Overall_Experience_Rating ??
      pillar2Raw.OVERALL_EXPERIENCE?.Overall_Experience_Rating,
      0
    ),
    Customer_Experience: {
      Customer_Experience_Rating: ratingLabelToScore(
        customerExp.Customer_Experience_Rating ?? customerExp.CUSTOMER_EXPERIENCE_Rating,
        normalizeNumber(customerExp.Customer_Experience_Rating ?? customerExp.CUSTOMER_EXPERIENCE_Rating, 0)
      ),
      Opening_Experience_Rating: normalizeNumber(customerExp.Opening_Experience_Rating ?? customerExp.Opening_Experience, 0),
      Listening_Quality_Rating: ratingLabelToScore(
        customerExp.Listening_Quality_Rating ?? customerExp.Listening_Quality,
        normalizeNumber(customerExp.Listening_Quality_Rating ?? customerExp.Listening_Quality, 0)
      ),
      Empathy_Displayed_Rating: ratingLabelToScore(
        customerExp.Empathy_Displayed_Rating ?? customerExp.Empathy_Displayed,
        normalizeNumber(customerExp.Empathy_Displayed_Rating ?? customerExp.Empathy_Displayed, 0)
      ),
      Pressure_Level: customerExp.Pressure_Level || 'N/A',
    },
    Sales_Experience: {
      Sales_Experience_Rating: ratingLabelToScore(
        salesExp.Sales_Experience_Rating ?? salesExp.SALES_EXPERIENCE_Rating,
        normalizeNumber(salesExp.Sales_Experience_Rating ?? salesExp.SALES_EXPERIENCE_Rating, 0)
      ),
    }
  };

  // Pillar 3: RELAX Framework
  const pillar3Raw = analysis.Pillar_3_RELAX_Framework || analysis.PILLAR_3_RELAX_FRAMEWORK || analysis.Call_Analysis?.PILLAR_3_RELAX_FRAMEWORK || analysis.PILLAR_3 || {};
  const pillar3 = {
    R_Reach_Out: {
      Rating: pillar3Raw.R_Reach_Out?.Rating || pillar3Raw.R_REACH_OUT?.Rating || 0,
      Reasons: pillar3Raw.R_Reach_Out?.Reasons || [pillar3Raw.R_REACH_OUT?.Reason] || [],
    },
    E_Explore_Needs: {
      Rating: pillar3Raw.E_Explore_Needs?.Rating || pillar3Raw.E_EXPLORE_NEEDS?.Rating || 0,
      Reasons: pillar3Raw.E_Explore_Needs?.Reasons || [pillar3Raw.E_EXPLORE_NEEDS?.Reason] || [],
    },
    L_Link_Experience: {
      Rating: pillar3Raw.L_Link_Experience?.Rating || pillar3Raw.L_LINK_EXPERIENCE?.Rating || 0,
      Reasons: pillar3Raw.L_Link_Experience?.Reasons || [pillar3Raw.L_LINK_EXPERIENCE?.Reason] || [],
    },
    A_Add_Value: {
      Rating: pillar3Raw.A_Add_Value?.Rating || pillar3Raw.A_ADD_VALUE?.Rating || 0,
      Reasons: pillar3Raw.A_Add_Value?.Reasons || [pillar3Raw.A_ADD_VALUE?.Reason] || [],
    },
    X_Express_Closing: {
      Rating: pillar3Raw.X_Express_Closing?.Rating || pillar3Raw.X_EXPRESS_CLOSING?.Rating || 0,
      Reasons: pillar3Raw.X_Express_Closing?.Reasons || [pillar3Raw.X_EXPRESS_CLOSING?.Reason] || [],
    },
    RELAX_Overall_Score: pillar3Raw.RELAX_Overall_Score || 0,
  };

  // Calculate RELAX overall if not present
  if (!pillar3.RELAX_Overall_Score) {
    const scores = [
      pillar3.R_Reach_Out.Rating,
      pillar3.E_Explore_Needs.Rating,
      pillar3.L_Link_Experience.Rating,
      pillar3.A_Add_Value.Rating,
      pillar3.X_Express_Closing.Rating,
    ].filter(s => s > 0);
    pillar3.RELAX_Overall_Score = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  }

  // Pillar 4: Invitation to Convert
  const pillar4Raw = analysis.Pillar_4_Invitation_to_Convert || analysis.PILLAR_4_INVITATION_TO_CONVERT || analysis.Call_Analysis?.PILLAR_4_INVITATION_TO_CONVERT || analysis.PILLAR_4 || {};
  const pillar4 = {
    Invitation_Attempted: pillar4Raw.Invitation_Attempted ?? false,
    Invitation_Quality_Rating: normalizeNumber(pillar4Raw.Invitation_Quality_Rating, 0),
    Urgency_Creation_Rating: normalizeNumber(pillar4Raw.Urgency_Creation_Rating, 0),
    Clarity_of_Next_Steps_Rating: normalizeNumber(pillar4Raw.Clarity_of_Next_Steps_Rating, 0),
    Commitment_Obtained: pillar4Raw.Commitment_Obtained || '',
    Conversion_Paths_Offered: pillar4Raw.Conversion_Paths_Offered || [],
  };

  // Pillar 5: Agent Competency
  const pillar5Raw = analysis.Pillar_5_Agent_Competency || analysis.PILLAR_5_AGENT_COMPETENCY || analysis.Call_Analysis?.PILLAR_5_AGENT_COMPETENCY || analysis.PILLAR_5 || {};
  const pillar5 = {
    Product_Knowledge: {
      Score: normalizeNumber(
        pillar5Raw.Product_Knowledge?.Score ??
        pillar5Raw.A_PRODUCT_KNOWLEDGE?.Rating ??
        pillar5Raw.A_PRODUCT_KNOWLEDGE ??
        pillar5Raw.PRODUCT_KNOWLEDGE,
        0
      ),
      Observations: pillar5Raw.Product_Knowledge?.Reasons || [pillar5Raw.A_PRODUCT_KNOWLEDGE?.Details] || [],
    },
    Sales_Skills: {
      Score: normalizeNumber(
        pillar5Raw.Sales_Skills?.Score ??
        pillar5Raw.B_SALES_SKILLS?.Rating ??
        pillar5Raw.B_SALES_SKILLS ??
        pillar5Raw.SALES_SKILLS,
        0
      ),
      Observations: pillar5Raw.Sales_Skills?.Reasons || [pillar5Raw.B_SALES_SKILLS?.Details] || [],
    },
    Soft_Skills: {
      Score: normalizeNumber(
        pillar5Raw.Soft_Skills?.Score ??
        pillar5Raw.C_SOFT_SKILLS_ETIQUETTE?.Rating ??
        pillar5Raw.C_SOFT_SKILLS_ETIQUETTE ??
        pillar5Raw.SOFT_SKILLS_ETIQUETTE,
        0
      ),
      Observations: pillar5Raw.Soft_Skills?.Reasons || [pillar5Raw.C_SOFT_SKILLS_ETIQUETTE?.Details] || [],
    },
  };

  // Summary
  const summaryRaw = analysis.Overall_Summary || analysis.OVERALL_SUMMARY || {};
  const summary = {
    Call_Synopsis: summaryRaw.Call_Synopsis || '',
    What_Worked_Well: summaryRaw.What_Worked_Well || [],
    Critical_Improvement_Areas: summaryRaw.Critical_Improvement_Areas || [],
    Recovery_Verdict: summaryRaw.Recovery_Verdict || '',
    Next_Action: summaryRaw.Next_Action || '',
  };

  // Transcript - normalize to an array, then parse string-line format if needed
  let transcript = normalizeTranscriptLog(getField(analysis, 'Transcript_Log', 'FUNCTIONAL_INFORMATION.Transcript_Log'));
  if (transcript.length > 0 && typeof transcript[0] === 'string') {
    transcript = transcript.map((line, idx) => {
      // Format: "00:04 Agent: Sir, good morning..."
      const match = String(line).match(/^(\d{2}:\d{2})\s+(.*?):\s*(.*)$/);
      if (match) {
        return { Timestamp: match[1], Speaker: match[2], Text: match[3] };
      }
      return { Timestamp: `${idx + 1}`, Speaker: 'Unknown', Text: String(line) };
    });
  }

  const overallScore = pillar2.Overall_Experience_Rating || 0;
  const relaxScore = pillar3.RELAX_Overall_Score || 0;

  const getIntentBadgeColor = (intent) => {
    if (!intent) return 'bg-gray-800 text-gray-400';
    const upper = intent.toUpperCase();
    if (upper.includes('HIGH')) return 'bg-emerald-900/30 text-emerald-300 border border-emerald-600/40';
    if (upper.includes('MEDIUM')) return 'bg-amber-900/30 text-amber-300 border border-amber-600/40';
    return 'bg-red-900/30 text-red-300 border border-red-600/40';
  };

  const getScoreColor = (score) => {
    if (score >= 4) return { bg: 'bg-emerald-900/30', text: 'text-emerald-300', border: 'border-emerald-600' };
    if (score >= 3) return { bg: 'bg-amber-900/30', text: 'text-amber-300', border: 'border-amber-600' };
    return { bg: 'bg-red-900/30', text: 'text-red-300', border: 'border-red-600' };
  };

  const getRelaxBarClass = (score) => {
    if (score >= 4) return 'bg-gradient-to-t from-emerald-600 to-emerald-500';
    if (score >= 3) return 'bg-gradient-to-t from-amber-600 to-amber-500';
    if (score >= 2) return 'bg-gradient-to-t from-orange-600 to-orange-500';
    return 'bg-gradient-to-t from-red-600 to-red-500';
  };

  const renderStars = (count) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={i <= count ? 'text-amber-400' : 'text-gray-700'}>★</span>
        ))}
      </div>
    );
  };

  const aideStages = ['A', 'I', 'D', 'A'];
  const currentStage = pillar1.Customer_Stage_AIDA || 'Awareness';
  const currentStageIndex = currentStage === 'Awareness' ? 0 : currentStage === 'Interest' ? 1 : currentStage === 'Desire' ? 2 : 3;

  return (
    <div className="min-h-screen bg-[#08080c] text-gray-100" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Grain texture overlay */}
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none" style={{
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")"
      }}></div>

      <div className="max-w-[1400px] mx-auto px-6 py-10 relative z-10">
        {/* Back Button and Download Buttons */}
        <div className="flex items-center justify-between mb-6">
          <Link to="/outbound-calls" className="inline-flex items-center gap-2 text-amber-400 hover:text-amber-300 transition">
            <ArrowLeft className="w-4 h-4" /> Back to All Outbound Calls
          </Link>
          
          <div className="flex gap-3">
            <button
              onClick={downloadCSV}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition shadow-sm"
              title="Download Call Report as CSV"
            >
              <Download className="w-4 h-4" />
              Download CSV
            </button>
            <button
              onClick={downloadTranscript}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold transition shadow-sm"
              title="Download Call Transcript as TXT"
            >
              <FileDown className="w-4 h-4" />
              Download Transcript
            </button>
          </div>
        </div>

        {/* HEADER */}
        <header className="bg-gradient-to-br from-[#0f0f14] to-[#16161d] border border-white/6 rounded-3xl p-8 mb-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-amber-600 to-transparent"></div>
          
          <div className="flex justify-between items-start mb-6">
            <div className="flex flex-col gap-2">
              <span className="font-mono text-xs text-gray-500 tracking-wider">CALL ID: {report.call_id}</span>
              <h1 className="text-3xl font-semibold text-gray-100" style={{ fontFamily: "'Fraunces', serif", letterSpacing: '-0.02em' }}>
                {normalizeStoreName(report.store_name)}
              </h1>
              {isConvertedValue(report.is_converted) && (
                <span className="inline-flex items-center gap-2 bg-emerald-900/20 border border-emerald-600/25 px-4 py-2 rounded-full text-sm font-medium text-emerald-400 w-fit">
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  Converted
                </span>
              )}
            </div>
            
            <div className="flex flex-col items-end gap-2">
              <span className="text-xs uppercase tracking-wider text-gray-500">Overall Score</span>
              <div className="text-4xl font-bold text-amber-400">{normalizeNumber(overallScore, 0)}</div>
              <div className="text-xs text-gray-500">out of 5</div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-6">
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Call Date</p>
              <p className="text-sm font-medium text-gray-200">{report.call_date}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Duration</p>
              <p className="text-sm font-medium text-gray-200">{report.duration}s</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Phone Number</p>
              <p className="text-sm font-medium text-gray-200">{report.phone_number || report.customer_phone || functional.Customer_Phone || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Language</p>
              <p className="text-sm font-medium text-gray-200">{functional.Customer_Language || 'Not specified'}</p>
            </div>
          </div>
        </header>

        {/* MAIN GRID */}
        <div className="grid grid-cols-2 gap-6">
          
          {/* CUSTOMER INSIGHTS */}
          <div className="bg-[#0f0f14] border border-white/6 rounded-2xl p-7">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-medium text-gray-100" style={{ fontFamily: "'Fraunces', serif" }}>Customer Intent & Barriers</h2>
              <span className="text-xs text-gray-500">Pillar 1 Analysis</span>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Intent to Purchase</p>
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold ${getIntentBadgeColor(pillar1.Intent_to_Purchase_Rating)}`}>
                  <span className="w-2 h-2 rounded-full bg-current animate-pulse"></span>
                  {pillar1.Intent_to_Purchase_Rating || 'Unknown'}
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Customer Journey (AIDA)</p>
                <div className="flex items-center gap-1">
                  {aideStages.map((stage, i) => (
                    <React.Fragment key={i}>
                      <button className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider ${i === currentStageIndex ? 'bg-amber-500 text-gray-900' : 'bg-gray-800 text-gray-500'}`}>
                        {stage}
                      </button>
                      {i < aideStages.length - 1 && <div className="w-4 h-0.5 bg-gray-800"></div>}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {pillar1.Primary_NonPurchase_Reason && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Primary Non-Purchase Reason</p>
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-full text-sm text-gray-300">
                    <span>🔍</span>
                    {pillar1.Primary_NonPurchase_Reason}
                  </div>
                </div>
              )}

              {pillar1.Secondary_Barriers && pillar1.Secondary_Barriers.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Secondary Barriers</p>
                  <ul className="space-y-1 text-sm text-gray-400">
                    {pillar1.Secondary_Barriers.map((barrier, i) => (
                      <li key={i} className="pl-4 relative before:content-[''] before:absolute before:left-0 before:top-2 before:w-1 before:h-1 before:rounded-full before:bg-gray-600">
                        {barrier}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {pillar1.Timeline_to_Purchase && (
                <div className="pt-4 border-t border-gray-800">
                  <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Timeline to Purchase</p>
                  <p className="text-sm text-gray-300">{pillar1.Timeline_to_Purchase}</p>
                </div>
              )}
            </div>
          </div>

          {/* EXPERIENCE DELIVERED */}
          <div className="bg-[#0f0f14] border border-white/6 rounded-2xl p-7 mt-6">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-lg font-medium text-gray-100" style={{ fontFamily: "'Fraunces', serif" }}>RELAX Framework Performance</h2>
              <span className="text-xs text-gray-500">Pillar 3 - Sales Methodology</span>
            </div>

            <div className="flex justify-between items-end h-48 gap-4 mb-12 px-4">
              {[
                { letter: 'R', name: 'Reach Out', score: pillar3.R_Reach_Out?.Rating || 0 },
                { letter: 'E', name: 'Explore', score: pillar3.E_Explore_Needs?.Rating || 0 },
                { letter: 'L', name: 'Link', score: pillar3.L_Link_Experience?.Rating || 0 },
                { letter: 'A', name: 'Add Value', score: pillar3.A_Add_Value?.Rating || 0 },
                { letter: 'X', name: 'Express', score: pillar3.X_Express_Closing?.Rating || 0 },
              ].map((item) => (
                <div key={item.letter} className="flex flex-col items-center gap-3 flex-1">
                  <div className="relative w-full flex justify-center">
                    <div
                      className={`w-12 rounded-t-lg ${getRelaxBarClass(item.score)} flex items-end justify-center pb-2 relative`}
                      style={{ height: `${Math.max(0.5, item.score) * 30}px` }}
                    >
                      <span className="text-lg font-bold text-white">{item.score}</span>
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-semibold text-gray-100">{item.letter}</p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">{item.name}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-5 gap-4">
              {[
                { title: 'R — Reach Out', score: pillar3.R_Reach_Out?.Rating || 0, reasons: pillar3.R_Reach_Out?.Reasons || [] },
                { title: 'E — Explore', score: pillar3.E_Explore_Needs?.Rating || 0, reasons: pillar3.E_Explore_Needs?.Reasons || [] },
                { title: 'L — Link', score: pillar3.L_Link_Experience?.Rating || 0, reasons: pillar3.L_Link_Experience?.Reasons || [] },
                { title: 'A — Add Value', score: pillar3.A_Add_Value?.Rating || 0, reasons: pillar3.A_Add_Value?.Reasons || [] },
                { title: 'X — Express', score: pillar3.X_Express_Closing?.Rating || 0, reasons: pillar3.X_Express_Closing?.Reasons || [] },
              ].map((item) => {
                const color = getScoreColor(item.score);
                return (
                  <div key={item.title} className={`bg-[#16161d] rounded-lg p-4 border-l-2 ${color.border}`}>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-semibold text-gray-300">{item.title}</span>
                      <span className={`text-xs font-mono px-2 py-1 rounded ${color.bg} ${color.text}`}>{item.score}/5</span>
                    </div>
                    <p className="text-xs text-gray-400 line-clamp-3">{item.reasons[0] || 'No details'}</p>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* INVITATION TO CONVERT */}
        <div className="bg-[#0f0f14] border border-white/6 rounded-2xl p-7 mt-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-medium text-gray-100" style={{ fontFamily: "'Fraunces', serif" }}>Invitation to Convert</h2>
            <span className="text-xs text-gray-500">Pillar 4 Analysis</span>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div className="bg-[#16161d] rounded-lg p-5 text-center">
              <p className={`text-2xl font-bold ${pillar4.Invitation_Attempted ? 'text-emerald-400' : 'text-red-400'}`}>
                {pillar4.Invitation_Attempted ? '✓' : '✗'}
              </p>
              <p className="text-xs text-gray-400 mt-2">Invitation Attempted</p>
            </div>
            <div className="bg-[#16161d] rounded-lg p-5 text-center">
              <p className="text-2xl font-bold text-amber-400">{pillar4.Invitation_Quality_Rating || 0}</p>
              <p className="text-xs text-gray-400 mt-2">Quality Rating</p>
            </div>
            <div className="bg-[#16161d] rounded-lg p-5 text-center">
              <p className="text-2xl font-bold text-blue-400">{pillar4.Urgency_Creation_Rating || 0}</p>
              <p className="text-xs text-gray-400 mt-2">Urgency Created</p>
            </div>
            <div className="bg-[#16161d] rounded-lg p-5 text-center">
              <p className="text-2xl font-bold text-purple-400">{pillar4.Clarity_of_Next_Steps_Rating || 0}</p>
              <p className="text-xs text-gray-400 mt-2">Clear Next Steps</p>
            </div>
          </div>

          {pillar4.Commitment_Obtained && (
            <div className="mt-6 p-4 bg-[#16161d] rounded-lg">
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Commitment Obtained</p>
              <p className="text-sm text-gray-300">{pillar4.Commitment_Obtained}</p>
            </div>
          )}

          {pillar4.Conversion_Paths_Offered && pillar4.Conversion_Paths_Offered.length > 0 && (
            <div className="mt-4 p-4 bg-[#16161d] rounded-lg">
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Conversion Paths Offered</p>
              <div className="flex flex-wrap gap-2">
                {pillar4.Conversion_Paths_Offered.map((path, i) => (
                  <span key={i} className="px-3 py-1 bg-gray-800 rounded-full text-xs text-gray-300">{path}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* AGENT COMPETENCY */}
        <div className="grid grid-cols-3 gap-6 mt-6">
          <div className="bg-[#0f0f14] border border-white/6 rounded-2xl p-7">
            <h2 className="text-lg font-medium text-gray-100 mb-6" style={{ fontFamily: "'Fraunces', serif" }}>Product Knowledge</h2>
            <div className="text-center mb-4">
              <p className="text-4xl font-bold text-emerald-400">{pillar5.Product_Knowledge?.Score || 0}</p>
              <p className="text-xs text-gray-400 mt-2">out of 5</p>
            </div>
            {pillar5.Product_Knowledge?.Observations && (
              <ul className="space-y-2 text-xs text-gray-400">
                {pillar5.Product_Knowledge.Observations.slice(0, 3).map((obs, i) => (
                  <li key={i} className="pl-4 relative before:content-[''] before:absolute before:left-0 before:top-1.5 before:w-1 before:h-1 before:rounded-full before:bg-gray-600">
                    {obs}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-[#0f0f14] border border-white/6 rounded-2xl p-7">
            <h2 className="text-lg font-medium text-gray-100 mb-6" style={{ fontFamily: "'Fraunces', serif" }}>Sales Skills</h2>
            <div className="text-center mb-4">
              <p className="text-4xl font-bold text-amber-400">{pillar5.Sales_Skills?.Score || 0}</p>
              <p className="text-xs text-gray-400 mt-2">out of 5</p>
            </div>
            {pillar5.Sales_Skills?.Observations && (
              <ul className="space-y-2 text-xs text-gray-400">
                {pillar5.Sales_Skills.Observations.slice(0, 3).map((obs, i) => (
                  <li key={i} className="pl-4 relative before:content-[''] before:absolute before:left-0 before:top-1.5 before:w-1 before:h-1 before:rounded-full before:bg-gray-600">
                    {obs}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-[#0f0f14] border border-white/6 rounded-2xl p-7">
            <h2 className="text-lg font-medium text-gray-100 mb-6" style={{ fontFamily: "'Fraunces', serif" }}>Soft Skills</h2>
            <div className="text-center mb-4">
              <p className="text-4xl font-bold text-blue-400">{pillar5.Soft_Skills?.Score || 0}</p>
              <p className="text-xs text-gray-400 mt-2">out of 5</p>
            </div>
            {pillar5.Soft_Skills?.Observations && (
              <ul className="space-y-2 text-xs text-gray-400">
                {pillar5.Soft_Skills.Observations.slice(0, 3).map((obs, i) => (
                  <li key={i} className="pl-4 relative before:content-[''] before:absolute before:left-0 before:top-1.5 before:w-1 before:h-1 before:rounded-full before:bg-gray-600">
                    {obs}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* SUMMARY */}
        <div className="bg-[#0f0f14] border border-white/6 rounded-2xl p-7 mt-6">
          <h2 className="text-lg font-medium text-gray-100 mb-6" style={{ fontFamily: "'Fraunces', serif" }}>Call Summary</h2>
          
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-[#16161d] rounded-lg p-6">
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
                <span>📋</span> Synopsis
              </p>
              <p className="text-sm text-gray-300 leading-relaxed">{summary.Call_Synopsis || 'No synopsis available'}</p>
            </div>
            <div className="bg-[#16161d] rounded-lg p-6">
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
                <span>✅</span> What Worked Well
              </p>
              {summary.What_Worked_Well ? (
                <ul className="space-y-2">
                  {(Array.isArray(summary.What_Worked_Well) ? summary.What_Worked_Well : [summary.What_Worked_Well]).map((item, idx) => (
                    <li key={idx} className="text-sm text-gray-300 flex gap-2">
                      <span className="text-emerald-400">✓</span> {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-400">No details available</p>
              )}
            </div>
          </div>

          {summary.Critical_Improvement_Areas && (
            <div className="mt-6 bg-[#16161d] rounded-lg p-6">
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
                <span>⚠️</span> Areas for Improvement
              </p>
              <ul className="space-y-2">
                {(Array.isArray(summary.Critical_Improvement_Areas) ? summary.Critical_Improvement_Areas : [summary.Critical_Improvement_Areas]).map((item, idx) => (
                  <li key={idx} className="text-sm text-gray-300 flex gap-2">
                    <span className="text-red-400">→</span> {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {summary.Recovery_Verdict && (
            <div className="mt-6 pt-6 border-t border-gray-800">
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
                <span>🎯</span> Recovery Verdict
              </p>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-900/20 border border-amber-600/30 rounded-full text-sm font-medium text-amber-300">
                {summary.Recovery_Verdict}
              </div>
            </div>
          )}
        </div>

        {/* TRANSCRIPT */}
        {transcript && transcript.length > 0 && (
          <div className="bg-[#0f0f14] border border-white/6 rounded-2xl overflow-hidden mt-6">
            <div className="flex justify-between items-center p-7 border-b border-white/6">
              <h2 className="text-lg font-medium text-gray-100" style={{ fontFamily: "'Fraunces', serif" }}>Call Transcript</h2>
              <button
                onClick={() => setExpandTranscript(!expandTranscript)}
                className="flex items-center gap-2 px-4 py-2 bg-[#16161d] rounded-lg text-sm text-amber-400 hover:bg-[#1c1c25] transition"
              >
                {expandTranscript ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                <span>{expandTranscript ? 'Collapse' : 'Expand'}</span>
              </button>
            </div>

            {expandTranscript && (
              <div className="max-h-[500px] overflow-y-auto p-7 space-y-6">
                {transcript.map((msg, i) => (
                  <div key={i} className="flex gap-4 pb-4 border-b border-gray-800 last:border-0">
                    <span className="font-mono text-xs text-gray-500 min-w-12 pt-1">{msg.Timestamp || '00:00'}</span>
                    <div className="flex-1">
                      <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${
                        msg.Speaker?.toLowerCase().includes('agent') || msg.Speaker?.toLowerCase().includes('staff')
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}>
                        {msg.Speaker}
                      </p>
                      <p className="text-sm text-gray-300 leading-relaxed">{msg.Text}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default OutboundCallDetail;
