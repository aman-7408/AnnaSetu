import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

const API_BASE = (import.meta.env.VITE_API_URL || '') + '/api/capacity';

export default function ProcurementTracker() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const savedFarmer = (() => {
    try {
      return JSON.parse(localStorage.getItem('farmer_user')) || {};
    } catch {
      return {};
    }
  })();
  const activeFarmerAadhar = localStorage.getItem('farmer_aadhar') || savedFarmer.aadhar_number || null;

  const [procurement, setProcurement] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showTractorIcon, setShowTractorIcon] = useState(true);
  const [searchToken, setSearchToken] = useState('');
  const [myTokens, setMyTokens] = useState([]);
  const [loadingTokens, setLoadingTokens] = useState(true);

  // Alternates between Tractor icon and Step Number for the active milestone node
  useEffect(() => {
    const timer = setInterval(() => {
      setShowTractorIcon(prev => !prev);
    }, 1400);
    return () => clearInterval(timer);
  }, []);

  // Fetch strictly the logged-in farmer's tokens from DB
  const fetchFarmerTokens = async () => {
    setLoadingTokens(true);
    try {
      const url = activeFarmerAadhar 
        ? `${API_BASE}/procurements?farmer_aadhar=${activeFarmerAadhar}`
        : `${API_BASE}/procurements`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && data.procurements) {
        setMyTokens(data.procurements);

        // Auto-load token if specified in URL or default to the most recent token of this farmer
        const urlToken = searchParams.get('token');
        if (urlToken) {
          setSearchToken(urlToken);
          fetchProcurement(urlToken);
        } else if (data.procurements.length > 0) {
          const defaultToken = data.procurements[0].token_id;
          setSearchToken(defaultToken);
          setSearchParams({ token: defaultToken });
          fetchProcurement(defaultToken);
        }
      }
    } catch (err) {
      console.error('Error fetching farmer tokens:', err);
    } finally {
      setLoadingTokens(false);
    }
  };

  useEffect(() => {
    fetchFarmerTokens();
  }, [activeFarmerAadhar]);

  // Read URL query parameter ?token=AS-2026-xxx
  useEffect(() => {
    const urlToken = searchParams.get('token');
    if (urlToken && urlToken !== procurement?.token_id) {
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
  }, [searchParams, activeFarmerAadhar]);

  const fetchProcurement = async (tokenId, isManual = false, isSilent = false) => {
    if (!tokenId) return;
    if (isManual) setIsRefreshing(true);
    else if (!isSilent) setLoading(true);
    if (!isSilent) setErrorMessage(null);

    try {
      const url = activeFarmerAadhar 
        ? `${API_BASE}/procurements/${tokenId}?farmer_aadhar=${activeFarmerAadhar}`
        : `${API_BASE}/procurements/${tokenId}`;
      const res = await fetch(url);
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
    const cleanToken = searchToken.trim().toUpperCase();
    setSearchParams({ token: cleanToken });
    fetchProcurement(cleanToken);
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

  // Token Selection Hub Component
  const renderFarmerTokensHub = () => {
    if (!activeFarmerAadhar && myTokens.length === 0) return null;

    return (
      <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-sm border border-gray-200 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🧑‍🌾</span>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-gray-900">My Consignment Passes</h3>
              <p className="text-3xs sm:text-2xs text-gray-500">
                Click any token to inspect its live intake station progress:
              </p>
            </div>
          </div>
          <span className="bg-emerald-100 text-emerald-900 text-3xs font-extrabold px-2.5 py-1 rounded-full">
            {myTokens.length} Tokens
          </span>
        </div>

        {loadingTokens ? (
          <p className="text-xs text-gray-400 italic">Loading your booked tokens...</p>
        ) : myTokens.length === 0 ? (
          <div className="p-6 bg-emerald-50/60 rounded-2xl border border-emerald-200 text-center space-y-2">
            <span className="text-3xl block">🌾</span>
            <h4 className="font-extrabold text-emerald-950 text-sm">No Active Consignments Found</h4>
            <p className="text-xs text-emerald-800">You haven't booked any Mandi delivery slots yet.</p>
            <button 
              onClick={() => navigate('/book-slot')} 
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold px-4 py-2 rounded-xl text-xs shadow-sm cursor-pointer mt-1"
            >
              ⚡ Book a Mandi Slot
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {myTokens.map(tok => {
              const isSelected = tok.token_id === procurement?.token_id;
              const isRejected = tok.status === 'rejected';
              const isCompleted = tok.current_stage >= 5 && !isRejected;

              return (
                <div 
                  key={tok.token_id}
                  onClick={() => handleSelectChip(tok.token_id)}
                  className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                    isSelected
                      ? isRejected
                        ? 'bg-red-50 border-red-500 shadow-md ring-2 ring-red-100'
                        : 'bg-emerald-50 border-emerald-600 shadow-md ring-2 ring-emerald-100'
                      : 'bg-gray-50/80 border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/40'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-mono font-black text-xs text-gray-900">{tok.token_id}</span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                      isRejected 
                        ? 'bg-red-100 text-red-900 border border-red-300' 
                        : isCompleted 
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' 
                          : 'bg-amber-100 text-amber-900 border border-amber-300'
                    }`}>
                      {isRejected ? '🚫 Rejected' : isCompleted ? '✓ Completed' : `Stage ${tok.current_stage || 1} / 5`}
                    </span>
                  </div>
                  <p className="font-extrabold text-xs text-gray-800 mt-1 truncate">{tok.centre_name}</p>
                  <div className="flex justify-between text-3xs text-gray-500 font-medium mt-0.5">
                    <span>{tok.crop_type || 'Wheat'}</span>
                    <span>{tok.estimated_weight_quintals || 45} Q</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // VIEW 1: SEARCH STATE
  if (!procurement && !loading) {
    return (
      <div className="py-8 px-4 sm:px-6 max-w-4xl mx-auto font-sans space-y-6">
        {/* Token Selector Hub */}
        {renderFarmerTokensHub()}

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
            <div className="max-w-md mx-auto mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-bold">
              ⚠️ {errorMessage}
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
  const finalPayout = procurement.gross_payout || Math.round(netQuintals * (procurement.msp_rate || 0));

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
        stage: 2, title: 'Gate Check-in Completed', notes: `Gate entry verified against security pass #${procurement.gate_pass || 'N/A'}.`,
        timestamp: new Date(procurement.gate_in_at || Date.now()).toLocaleString(), officer: 'Gate Security Guard'
      });
    }
    if (currentStage >= 3) {
      logs.push({
        stage: 3, title: 'Quality Assaying Passed', notes: `Moisture: ${procurement.moisture_percent || 'N/A'}%, Grade: ${procurement.grade || 'N/A'}`,
        timestamp: new Date(procurement.assayed_at || Date.now()).toLocaleString(), officer: 'Lab Inspector'
      });
    }
    if (currentStage >= 4) {
      logs.push({
        stage: 4, title: 'Weighbridge Ticket Generated', notes: `Net Weight: ${netQuintals} Qtl across ${procurement.gunny_bags || Math.round(netQuintals * 2)} bags.`,
        timestamp: new Date(procurement.weighed_at || Date.now()).toLocaleString(), officer: 'Weighbridge Operator'
      });
    }
    if (currentStage >= 5 && procurement.status !== 'rejected') {
      logs.push({
        stage: 5, title: 'J-Form & Payout Disbursed', notes: `₹${finalPayout.toLocaleString('en-IN')} approved via Direct Benefit Transfer.`,
        timestamp: new Date(procurement.approved_at || Date.now()).toLocaleString(), officer: 'Mandi Manager'
      });
    }
    if (procurement.status === 'rejected') {
      logs.push({
        stage: procurement.rejection_stage || 3,
        title: `Consignment Terminated at Stage ${procurement.rejection_stage || 3}`,
        notes: `REJECTED: ${procurement.rejection_reason || 'Standards not met'}. Inspected by ${procurement.rejected_by || 'Quality Officer'}.`,
        timestamp: new Date(procurement.rejected_at || procurement.updated_at || Date.now()).toLocaleString(),
        officer: procurement.rejected_by || 'Quality Officer',
        isRejected: true
      });
    }
    return logs.reverse();
  };

  const auditLogs = getAuditLogs();

  return (
    <div className="py-4 px-3 sm:py-8 sm:px-6 max-w-5xl mx-auto font-sans space-y-4 sm:space-y-6">
      
      {/* 🧑‍🌾 My Consignment Passes Hub */}
      {renderFarmerTokensHub()}

      {/* Tracker Header */}
      <div className="bg-gradient-to-r from-gray-900 to-slate-800 text-white p-4 sm:p-8 rounded-2xl sm:rounded-3xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6 relative overflow-hidden">
        
        {/* Subtle background icon */}
        <div className="absolute right-0 top-0 text-8xl sm:text-9xl opacity-5 pointer-events-none transform translate-x-4 -translate-y-4">
          🚛
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-white/20 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest backdrop-blur-sm border border-white/10">
              Live Mandi Consignment
            </span>
            {procurement.status === 'rejected' ? (
              <span className="bg-red-500/90 text-white px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest">
                🚫 Terminated / Rejected
              </span>
            ) : isRefreshing ? (
              <span className="flex items-center gap-1 text-[10px] text-emerald-300 font-bold ml-1 sm:ml-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Syncing
              </span>
            ) : null}
          </div>
          
          <h1 className="text-xl sm:text-3xl font-black tracking-tight font-mono text-emerald-300">
            {procurement.token_id}
          </h1>
          
          <p className="text-slate-300 mt-1 sm:mt-2 text-xs sm:text-sm font-medium">
            Mandi: <span className="text-white font-bold">{procurement.centre_name}</span> &bull; Farmer: <span className="text-white font-bold">{procurement.farmer_name}</span>
          </p>
          
          <div className="mt-2.5 sm:mt-3 flex gap-3 text-xs font-bold text-slate-300">
            <button 
              onClick={handleResetSearch}
              className="text-slate-300 hover:text-white cursor-pointer flex items-center gap-1.5 transition-colors font-medium text-xs"
            >
              <span>🔍</span> Track Another Token
            </button>
          </div>
        </div>

        <div className="relative z-10 flex flex-col gap-2 md:items-end">
          <button 
            onClick={() => fetchProcurement(procurement.token_id, true)}
            disabled={isRefreshing}
            className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl text-xs font-bold transition-all border border-white/20 flex items-center justify-center gap-2 backdrop-blur-sm cursor-pointer disabled:opacity-50"
          >
            <span className={isRefreshing ? 'animate-spin' : ''}>🔄</span> 
            {isRefreshing ? 'Refreshing...' : 'Refresh Live Status'}
          </button>
        </div>
      </div>

      {/* REJECTION HERO ALERT CARD (Visible when status === 'rejected') */}
      {procurement.status === 'rejected' && (
        <div className="bg-red-50 border-2 border-red-500 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-md animate-fade-in space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-2xl font-black shrink-0 border border-red-300">
              🚫
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-red-800 bg-red-200/80 px-2.5 py-0.5 rounded-full">
                Consignment Terminated
              </span>
              <h3 className="text-base sm:text-xl font-black text-red-950 mt-0.5">
                Consignment Rejected at {procurement.rejection_stage === 4 ? 'Station 4 (Weighbridge)' : 'Station 3 (Quality Lab)'}
              </h3>
            </div>
          </div>

          <div className="bg-white/90 rounded-xl p-3 sm:p-4 border border-red-200 text-xs sm:text-sm space-y-1.5 shadow-2xs">
            <p className="text-gray-800 font-medium">
              <strong className="text-red-900">Official Reason:</strong> {procurement.rejection_reason || 'Grain lot did not comply with prescribed Mandi tolerance thresholds.'}
            </p>
            <div className="flex items-center justify-between text-2xs text-gray-500 pt-1 border-t border-gray-100 flex-wrap gap-2">
              <span>Inspecting Authority: <strong className="text-gray-800">{procurement.rejected_by || 'Mandi Inspection Officer'}</strong></span>
              <span className="font-mono">{new Date(procurement.rejected_at || procurement.updated_at || Date.now()).toLocaleString()}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-red-900">
            <span>⚠️</span>
            <span>Please collect your tractor gate pass at the exit security gate.</span>
          </div>
        </div>
      )}

      {/* PROGRESS MILESTONES (Responsive: Horizontal on Desktop, Vertical on Mobile) */}
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-gray-200 p-4 sm:p-8 overflow-hidden">
        
        {/* DESKTOP / TABLET HORIZONTAL STEPPER */}
        <div className="hidden sm:block relative">
          {/* Connecting Line Base */}
          <div className="absolute top-6 left-[10%] right-[10%] h-1.5 bg-gray-100 rounded-full z-0"></div>
          
          {/* Active Progress Line */}
          <div 
            className={`absolute top-6 left-[10%] h-1.5 rounded-full z-0 transition-all duration-700 ease-in-out ${
              procurement.status === 'rejected' ? 'bg-gradient-to-r from-emerald-500 to-red-500' : 'bg-brand'
            }`}
            style={{ 
              width: `${(Math.max(1, Math.min(procurement.status === 'rejected' ? (procurement.rejection_stage || 3) : currentStage, 5)) - 1) * 20}%` 
            }}
          ></div>

          {/* Nodes */}
          <div className="relative z-10 flex justify-between">
            {STAGES.map((stage) => {
              const isRejected = procurement.status === 'rejected';
              const rejectionStage = procurement.rejection_stage || 3;

              if (isRejected) {
                const isPassedBefore = stage.id < rejectionStage;
                const isRejectionNode = stage.id === rejectionStage;

                return (
                  <div key={stage.id} className="flex flex-col items-center w-[20%] relative group">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-sm border-4 transition-all duration-300 ${
                      isRejectionNode
                        ? 'bg-red-600 text-white border-red-200 shadow-[0_0_18px_rgba(239,68,68,0.5)] scale-110'
                        : isPassedBefore
                          ? 'bg-brand text-white border-brand'
                          : 'bg-gray-50 text-gray-300 border-gray-100 opacity-40'
                    }`}>
                      {isRejectionNode ? '✕' : isPassedBefore ? '✓' : stage.id}
                    </div>
                    
                    <div className="mt-4 text-center">
                      <p className={`text-xs font-black uppercase tracking-wider mb-1 ${
                        isRejectionNode ? 'text-red-700 font-extrabold' : isPassedBefore ? 'text-gray-800' : 'text-gray-300 line-through'
                      }`}>
                        {stage.title}
                      </p>
                      <p className={`text-[10px] font-medium ${isRejectionNode ? 'text-red-600 font-bold' : isPassedBefore ? 'text-gray-500' : 'text-gray-400'}`}>
                        {isRejectionNode ? '🚫 Terminated' : isPassedBefore ? stage.subtitle : 'Cancelled'}
                      </p>
                    </div>
                  </div>
                );
              }

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
                    <p className="text-[10px] text-gray-500 font-medium">
                      {stage.subtitle}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* MOBILE VERTICAL STEPPER */}
        <div className="block sm:hidden space-y-4">
          <span className={`text-2xs font-extrabold uppercase tracking-wider block mb-2 ${
            procurement.status === 'rejected' ? 'text-red-700 font-black' : 'text-gray-400'
          }`}>
            {procurement.status === 'rejected' 
              ? `🚫 Consignment Terminated at Station ${procurement.rejection_stage || 3} / 5`
              : `Consignment Intake Stages (${currentStage}/5)`
            }
          </span>
          <div className="relative pl-6 space-y-5 before:absolute before:left-3 before:top-3 before:bottom-3 before:w-0.5 before:bg-gray-200">
            {STAGES.map((stage) => {
              const isRejected = procurement.status === 'rejected';
              const rejectionStage = procurement.rejection_stage || 3;

              if (isRejected) {
                const isPassedBefore = stage.id < rejectionStage;
                const isRejectionNode = stage.id === rejectionStage;
                const isCancelled = stage.id > rejectionStage;

                return (
                  <div key={stage.id} className="relative flex items-center gap-3.5">
                    <div className={`absolute -left-6 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs border-2 z-10 transition-all ${
                      isRejectionNode
                        ? 'bg-red-600 text-white border-red-300 ring-4 ring-red-100 scale-110 shadow-sm'
                        : isPassedBefore
                          ? 'bg-brand text-white border-brand'
                          : 'bg-gray-100 text-gray-300 border-gray-200'
                    }`}>
                      {isRejectionNode ? '✕' : isPassedBefore ? '✓' : '-'}
                    </div>

                    <div className={`flex-1 p-3 rounded-xl border transition-all ${
                      isRejectionNode
                        ? 'bg-red-50/90 border-2 border-red-400 shadow-sm'
                        : isPassedBefore
                          ? 'bg-gray-50/60 border-gray-200'
                          : 'bg-white border-gray-100 opacity-40'
                    }`}>
                      <div className="flex items-center justify-between">
                        <h4 className={`text-xs font-extrabold uppercase tracking-wide ${
                          isRejectionNode ? 'text-red-950 font-black' : isPassedBefore ? 'text-gray-900' : 'text-gray-400 line-through'
                        }`}>
                          {stage.title}
                        </h4>
                        {isRejectionNode && (
                          <span className="text-3xs font-black bg-red-600 text-white px-2 py-0.5 rounded-full uppercase shadow-xs">
                            🚫 Rejected
                          </span>
                        )}
                      </div>
                      <p className={`text-3xs mt-0.5 font-medium ${
                        isRejectionNode ? 'text-red-700 font-bold' : 'text-gray-500'
                      }`}>
                        {isRejectionNode 
                          ? (procurement.rejection_reason || 'Standards not met') 
                          : isCancelled 
                            ? 'Cancelled / Not Reached' 
                            : stage.subtitle
                        }
                      </p>
                    </div>
                  </div>
                );
              }

              const isActive = currentStage === stage.id;
              const isPast = currentStage > stage.id;

              return (
                <div key={stage.id} className="relative flex items-center gap-3.5">
                  <div className={`absolute -left-6 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs border-2 z-10 transition-all ${
                    isActive
                      ? 'bg-brand text-white border-emerald-300 ring-4 ring-emerald-100 scale-110 shadow-sm'
                      : isPast
                      ? 'bg-brand text-white border-brand'
                      : 'bg-white text-gray-400 border-gray-300'
                  }`}>
                    {isActive ? (showTractorIcon ? '🚛' : stage.id) : isPast ? '✓' : stage.id}
                  </div>
                  <div className={`flex-1 p-3 rounded-xl border transition-all ${
                    isActive
                      ? 'bg-emerald-50/80 border-emerald-300 shadow-xs'
                      : isPast
                      ? 'bg-gray-50/60 border-gray-200'
                      : 'bg-white border-gray-100 opacity-60'
                  }`}>
                    <div className="flex items-center justify-between">
                      <h4 className={`text-xs font-extrabold uppercase tracking-wide ${
                        isActive ? 'text-emerald-900' : isPast ? 'text-gray-900' : 'text-gray-400'
                      }`}>
                        {stage.title}
                      </h4>
                      {isActive && (
                        <span className="text-3xs font-extrabold bg-brand text-white px-2 py-0.5 rounded-full uppercase">
                          Live Active
                        </span>
                      )}
                    </div>
                    <p className="text-3xs text-gray-500 mt-0.5 font-medium">{stage.subtitle}</p>
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
            Official J-Form <strong>({procurement.j_form_number || 'N/A'})</strong> has been approved. The MSP payout has been initiated via Direct Benefit Transfer to the registered bank account.
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
