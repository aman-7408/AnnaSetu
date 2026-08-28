import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000') + '/api/capacity';

export default function ProcurementTracker() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [procurement, setProcurement] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showTractorIcon, setShowTractorIcon] = useState(true);
  const [searchToken, setSearchToken] = useState('');
  const [recentTokens, setRecentTokens] = useState([]);

  // Alternates between Tractor icon and Step Number for the active milestone node
  useEffect(() => {
    const timer = setInterval(() => {
      setShowTractorIcon(prev => !prev);
    }, 1400);
    return () => clearInterval(timer);
  }, []);

  // Fetch recent active tokens from DB for quick-select chips
  useEffect(() => {
    fetch(`${API_BASE}/procurements`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.procurements) {
          setRecentTokens(data.procurements.slice(0, 5));
        }
      })
      .catch(() => {});
  }, []);

  // Read URL query parameter ?token=AS-2026-xxx
  useEffect(() => {
    const urlToken = searchParams.get('token');
    if (urlToken) {
      setSearchToken(urlToken);
      fetchProcurement(urlToken);
    }
  }, [searchParams]);

  // Live Auto-Sync: Gently polls server every 6 seconds so the stepper advances in real time
  useEffect(() => {
    const urlToken = searchParams.get('token');
    if (!urlToken) return;

    const autoSyncTimer = setInterval(() => {
      fetchProcurement(urlToken, false, true);
    }, 6000);

    return () => clearInterval(autoSyncTimer);
  }, [searchParams]);

  const fetchProcurement = async (tokenId, isManual = false, isSilent = false) => {
    if (!tokenId) return;
    if (isManual) setIsRefreshing(true);
    else if (!isSilent) setLoading(true);
    if (!isSilent) setErrorMessage(null);

    try {
      const res = await fetch(`${API_BASE}/procurements/${tokenId}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setProcurement(data.procurement);
      } else {
        throw new Error(data.error || 'Could not find Gate Pass Token.');
      }
    } catch (err) {
      if (!isSilent) {
        console.error('Fetch error:', err);
        setErrorMessage(err.message);
        setProcurement(null);
      }
    } finally {
      if (!isSilent) setLoading(false);
      if (isManual) setIsRefreshing(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (!searchToken.trim()) return;
    setSearchParams({ token: searchToken.trim().toUpperCase() });
    fetchProcurement(searchToken.trim().toUpperCase());
  };

  const handleSelectChip = (token) => {
    setSearchToken(token);
    setSearchParams({ token });
    fetchProcurement(token);
  };

  const handleResetSearch = () => {
    setProcurement(null);
    setSearchToken('');
    setSearchParams({});
  };

  // 5 Stages Definition
  const STAGES = [
    { id: 1, title: 'Slot Booked', subtitle: 'Gate Pass Active' },
    { id: 2, title: 'Gate In', subtitle: 'Entry Verified' },
    { id: 3, title: 'Assaying', subtitle: 'Quality Lab Check' },
    { id: 4, title: 'Weighbridge', subtitle: 'Net Weight Finalized' },
    { id: 5, title: 'J-Form Payout', subtitle: 'MSP Disbursed' }
  ];

  // VIEW 1: SEARCH STATE
  if (!procurement && !loading) {
    return (
      <div className="py-12 px-4 sm:px-6 max-w-4xl mx-auto font-sans min-h-[65vh] flex flex-col items-center justify-center">
        <div className="bg-white p-8 sm:p-10 rounded-3xl shadow-xl border border-gray-200 w-full text-center relative overflow-hidden">
          
          <div className="w-16 h-16 bg-emerald-100 text-emerald-800 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl shadow-inner">
            🛰️
          </div>
          
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-2">
            Live Grain Consignment Tracker
          </h2>
          <p className="text-gray-500 mb-8 text-sm max-w-md mx-auto">
            Enter your official Gate Pass Token ID to track physical Mandi intake, quality assaying, and DBT payout in real-time.
          </p>
          
          <form onSubmit={handleSearch} className="max-w-md mx-auto relative mb-6">
            <input 
              type="text" 
              placeholder="e.g. AS-2026-WHT-7821"
              value={searchToken}
              onChange={(e) => setSearchToken(e.target.value)}
              className="w-full px-5 py-4 pr-32 rounded-2xl border-2 border-gray-200 focus:border-brand focus:ring-4 focus:ring-emerald-50 outline-none uppercase font-mono tracking-wider font-bold text-gray-800 transition-all text-sm sm:text-base"
            />
            <button 
              type="submit"
              disabled={!searchToken.trim()}
              className="absolute right-2 top-2 bottom-2 bg-brand text-white px-6 rounded-xl font-bold hover:bg-brand-dark transition-all disabled:opacity-50 cursor-pointer shadow-md text-xs sm:text-sm"
            >
              Track Live
            </button>
          </form>

          {errorMessage && (
            <div className="max-w-md mx-auto mb-6 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-bold">
              ⚠️ {errorMessage}
            </div>
          )}

          {/* Quick-Select Recent Tokens */}
          {recentTokens.length > 0 && (
            <div className="pt-6 border-t border-gray-100 text-left">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 text-center">
                Or click an active Mandi consignment to inspect:
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {recentTokens.map(p => (
                  <button
                    key={p.token_id}
                    onClick={() => handleSelectChip(p.token_id)}
                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 px-3.5 py-1.5 rounded-full text-xs font-mono font-bold transition-all hover:scale-105 cursor-pointer flex items-center gap-1.5"
                  >
                    <span>●</span>
                    <span>{p.token_id}</span>
                    <span className="text-[10px] text-emerald-600 font-sans font-medium">({p.farmer_name?.split(' ')[0]})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    );
  }

  // VIEW 2: LOADING STATE
  if (loading && !procurement) {
    return (
      <div className="py-32 flex flex-col items-center justify-center text-gray-500 font-sans">
        <div className="inline-block w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="font-bold text-gray-700 animate-pulse">Syncing Consignment from MongoDB Atlas...</p>
      </div>
    );
  }

  const currentStage = procurement.current_stage || 1;
  const netQuintals = procurement.net_weight_quintals || procurement.estimated_weight_quintals || 0;
  const finalPayout = procurement.gross_payout || Math.round(netQuintals * (procurement.msp_rate || 2275));

  const getAuditLogs = () => {
    const logs = [];
    if (currentStage >= 1) {
      logs.push({
        stage: 1, title: 'Intake Slot Confirmed', notes: `Allotted Shift: ${procurement.slot_name || 'Slot 1: Morning'}`,
        timestamp: new Date(procurement.updated_at || Date.now()).toLocaleString(), officer: 'System Auto-Generated'
      });
    }
    if (currentStage >= 2) {
      logs.push({
        stage: 2, title: 'Gate Check-in Completed', notes: `Gate entry verified against security pass #${procurement.gate_pass || 'GP-2026-8831'}.`,
        timestamp: new Date(procurement.gate_in_at || Date.now()).toLocaleString(), officer: 'Gate Security Guard'
      });
    }
    if (currentStage >= 3) {
      logs.push({
        stage: 3, title: 'Quality Assaying Passed', notes: `Moisture: ${procurement.moisture_percent || 11.6}%, Grade: ${procurement.grade || 'Grade A FAQ'}`,
        timestamp: new Date(procurement.assayed_at || Date.now()).toLocaleString(), officer: 'Lab Inspector'
      });
    }
    if (currentStage >= 4) {
      logs.push({
        stage: 4, title: 'Weighbridge Ticket Generated', notes: `Net Weight: ${netQuintals} Qtl across ${procurement.gunny_bags || Math.round(netQuintals * 2)} bags.`,
        timestamp: new Date(procurement.weighed_at || Date.now()).toLocaleString(), officer: 'Weighbridge Operator'
      });
    }
    if (currentStage >= 5) {
      logs.push({
        stage: 5, title: 'J-Form & Payout Disbursed', notes: `₹${finalPayout.toLocaleString('en-IN')} approved via Direct Benefit Transfer.`,
        timestamp: new Date(procurement.approved_at || Date.now()).toLocaleString(), officer: 'Mandi Manager'
      });
    }
    return logs.reverse();
  };

  const auditLogs = getAuditLogs();

  return (
    <div className="py-8 px-4 sm:px-6 max-w-5xl mx-auto font-sans">
      
      {/* Tracker Header */}
      <div className="bg-gradient-to-r from-gray-900 to-slate-800 text-white p-6 sm:p-8 rounded-3xl shadow-xl mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        
        {/* Subtle background icon */}
        <div className="absolute right-0 top-0 text-9xl opacity-5 pointer-events-none transform translate-x-4 -translate-y-4">
          🚛
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest backdrop-blur-sm border border-white/10">
              Live Mandi Consignment
            </span>
            {isRefreshing && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-300 font-bold ml-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Syncing
              </span>
            )}
          </div>
          
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight font-mono text-emerald-300">
            {procurement.token_id}
          </h1>
          
          <p className="text-slate-300 mt-2 text-sm font-medium">
            Mandi: <span className="text-white font-bold">{procurement.centre_name}</span> &bull; Farmer: <span className="text-white font-bold">{procurement.farmer_name}</span>
          </p>
          
          <div className="mt-3 flex gap-4 text-xs font-bold text-slate-300">
            <button 
              onClick={handleResetSearch}
              className="text-slate-300 hover:text-white cursor-pointer flex items-center gap-1.5 transition-colors font-medium"
            >
              <span>🔍</span> Track Another Token
            </button>
          </div>
        </div>

        <div className="relative z-10 flex flex-col gap-3 md:items-end">
          <button 
            onClick={() => fetchProcurement(procurement.token_id, true)}
            disabled={isRefreshing}
            className="bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all border border-white/20 flex items-center gap-2 backdrop-blur-sm cursor-pointer disabled:opacity-50"
          >
            <span className={isRefreshing ? 'animate-spin' : ''}>🔄</span> 
            {isRefreshing ? 'Refreshing...' : 'Refresh Live Status'}
          </button>
        </div>
      </div>

      {/* HORIZONTAL PROGRESS MILESTONES */}
      <div className="bg-white rounded-3xl shadow-md border border-gray-200 p-6 sm:p-10 mb-8 overflow-hidden">
        <div className="relative">
          {/* Connecting Line Base */}
          <div className="absolute top-6 left-[10%] right-[10%] h-1.5 bg-gray-100 rounded-full z-0"></div>
          
          {/* Active Progress Line */}
          <div 
            className="absolute top-6 left-[10%] h-1.5 bg-brand rounded-full z-0 transition-all duration-700 ease-in-out"
            style={{ width: `${(Math.max(1, Math.min(currentStage, 5)) - 1) * 20}%` }}
          ></div>

          {/* Nodes */}
          <div className="relative z-10 flex justify-between">
            {STAGES.map((stage) => {
              const isActive = currentStage === stage.id;
              const isPast = currentStage > stage.id;
              
              return (
                <div key={stage.id} className="flex flex-col items-center w-[20%] relative group">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-sm border-4 transition-all duration-300 ${
                    isActive 
                      ? 'bg-brand text-white border-green-200 shadow-[0_0_15px_rgba(34,197,94,0.4)] scale-110' 
                      : isPast
                        ? 'bg-brand text-white border-brand'
                        : 'bg-white text-gray-300 border-gray-100'
                  }`}>
                    {isActive ? (
                      showTractorIcon ? (
                        <span className="inline-block transform -scale-x-100">🚛</span>
                      ) : (
                        stage.id
                      )
                    ) : isPast ? (
                      '✓'
                    ) : (
                      stage.id
                    )}
                  </div>
                  
                  <div className="mt-4 text-center">
                    <p className={`text-xs font-black uppercase tracking-wider mb-1 ${isActive ? 'text-brand' : isPast ? 'text-gray-800' : 'text-gray-400'}`}>
                      {stage.title}
                    </p>
                    <p className="text-[10px] text-gray-500 hidden sm:block font-medium">
                      {stage.subtitle}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* FINAL PAYOUT HERO CARD (Only visible if Stage 5) */}
      {currentStage === 5 && (
        <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-3xl shadow-sm border border-emerald-200 p-8 mb-8 text-center animate-fade-in-up">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm text-3xl border-2 border-emerald-100">
            🎉
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-emerald-950 mb-2">
            Payment Successfully Generated!
          </h2>
          <p className="text-sm text-emerald-700 max-w-lg mx-auto mb-6">
            Official J-Form <strong>({procurement.j_form_number || 'JF-2026-98124'})</strong> has been approved. The MSP payout has been initiated via Direct Benefit Transfer to the registered bank account.
          </p>
          
          <div className="inline-block bg-white px-8 py-4 rounded-2xl shadow-sm border border-emerald-100">
            <span className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Final Disbursed Payout</span>
            <span className="block text-4xl font-black text-emerald-600">₹{finalPayout.toLocaleString('en-IN')}</span>
          </div>
        </div>
      )}

      {/* Official Audit Trail & Officer Logs */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-6 mb-8">
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
          <span>📜</span> Official Audit Trail & Officer Logs
        </h3>

        <div className="divide-y divide-gray-100">
          {auditLogs.map((log, i) => (
            <div key={i} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-green-100 text-green-800 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">
                  {log.stage}
                </div>
                <div>
                  <div className="font-bold text-gray-900">{log.title}</div>
                  <div className="text-gray-500 mt-0.5">{log.notes}</div>
                </div>
              </div>
              <div className="text-right sm:text-right pl-9 sm:pl-0">
                <div className="text-gray-400 text-[11px]">{log.timestamp}</div>
                <div className="text-gray-600 font-medium text-[11px]">{log.officer}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
