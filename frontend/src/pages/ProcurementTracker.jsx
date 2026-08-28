import React, { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/capacity';

export default function ProcurementTracker() {
  const [procurement, setProcurement] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showTractorIcon, setShowTractorIcon] = useState(true);
  const [searchToken, setSearchToken] = useState('');

  // Alternates between Tractor icon and Step Number for the active milestone node
  useEffect(() => {
    const timer = setInterval(() => {
      setShowTractorIcon(prev => !prev);
    }, 1400);
    return () => clearInterval(timer);
  }, []);

  const fetchProcurement = async (tokenId, isManual = false) => {
    if (!tokenId) return;
    if (isManual) setIsRefreshing(true);
    else setLoading(true);
    setErrorMessage(null);

    try {
      // Switch from the generic bulk fetch to the secure token-specific fetch
      const res = await fetch(`${API_BASE}/procurements/${tokenId}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setProcurement(data.procurement);
      } else {
        throw new Error(data.error || 'Could not find Gate Pass Token.');
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setErrorMessage(err.message);
      setProcurement(null);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchProcurement(searchToken.trim());
  };

  // 5 Stages Definition
  const STAGES = [
    { id: 1, title: 'Slot Booked', subtitle: 'Gate Pass Active' },
    { id: 2, title: 'Gate In', subtitle: 'Vehicle Arrived' },
    { id: 3, title: 'Assaying', subtitle: 'Quality Lab Check' },
    { id: 4, title: 'Weighbridge', subtitle: 'Net Weight Finalized' },
    { id: 5, title: 'J-Form Payout', subtitle: 'MSP Disbursed' }
  ];

  if (!procurement && !loading && !isRefreshing) {
    return (
      <div className="py-8 px-4 sm:px-6 max-w-4xl mx-auto font-sans min-h-[60vh] flex flex-col items-center justify-center">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 w-full text-center">
          <div className="w-16 h-16 bg-brand/10 text-brand rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
            🚛
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Track Your Consignment</h2>
          <p className="text-gray-500 mb-8 text-sm">Enter the Gate Pass Token ID from your booking to see live Mandi updates.</p>
          
          <form onSubmit={handleSearch} className="max-w-md mx-auto relative">
            <input 
              type="text" 
              placeholder="e.g. AS-2026-WHT-1234"
              value={searchToken}
              onChange={(e) => setSearchToken(e.target.value)}
              className="w-full px-5 py-4 pr-32 rounded-xl border-2 border-gray-200 focus:border-brand outline-none uppercase font-mono tracking-wider font-bold text-gray-800"
            />
            <button 
              type="submit"
              disabled={!searchToken.trim()}
              className="absolute right-2 top-2 bottom-2 bg-brand text-white px-6 rounded-lg font-bold hover:bg-brand-dark transition-colors disabled:opacity-50"
            >
              Track
            </button>
          </form>
          {errorMessage && <p className="text-red-500 mt-4 text-sm font-bold bg-red-50 py-2 rounded-lg">{errorMessage}</p>}
        </div>
      </div>
    );
  }

  if (loading && !procurement) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-gray-500">
        <div className="inline-block w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="font-semibold animate-pulse">Locating Consignment...</p>
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
        stage: 1, title: 'Intake Slot Confirmed', notes: `Allotted Shift: ${procurement.slot_name}`,
        timestamp: new Date(procurement.updated_at || Date.now()).toLocaleString(), officer: 'System Auto-Generated'
      });
    }
    if (currentStage >= 2) {
      logs.push({
        stage: 2, title: 'Gate Check-in Completed', notes: `Vehicle No: ${procurement.vehicle_number || 'TRUCK-123'} verified against pass.`,
        timestamp: new Date(procurement.gate_in_at || Date.now()).toLocaleString(), officer: 'Gate Security Guard'
      });
    }
    if (currentStage >= 3) {
      logs.push({
        stage: 3, title: 'Quality Assaying Passed', notes: `Moisture: ${procurement.moisture_percent || 11.6}%, Grade: ${procurement.grade || 'A FAQ'}`,
        timestamp: new Date(procurement.assayed_at || Date.now()).toLocaleString(), officer: 'Lab Inspector (Stage 3)'
      });
    }
    if (currentStage >= 4) {
      logs.push({
        stage: 4, title: 'Weighbridge Ticket Generated', notes: `Net Weight: ${netQuintals} Qtl across ${procurement.gunny_bags || 90} standard bags.`,
        timestamp: new Date(procurement.weighed_at || Date.now()).toLocaleString(), officer: 'Weighbridge Operator'
      });
    }
    if (currentStage >= 5) {
      logs.push({
        stage: 5, title: 'J-Form & Payout Disbursed', notes: `₹${finalPayout.toLocaleString('en-IN')} approved to farmer's registered bank account.`,
        timestamp: new Date(procurement.approved_at || Date.now()).toLocaleString(), officer: 'Mandi Manager'
      });
    }
    return logs.reverse();
  };

  const auditLogs = getAuditLogs();

  return (
    <div className="py-8 px-4 sm:px-6 max-w-5xl mx-auto font-sans">
      
      {/* Tracker Header */}
      <div className="bg-gradient-to-r from-gray-900 to-slate-800 text-white p-6 sm:p-8 rounded-2xl shadow-lg mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        {/* Subtle background icon */}
        <div className="absolute right-0 top-0 text-9xl opacity-5 pointer-events-none transform translate-x-4 -translate-y-4">
          🚛
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest backdrop-blur-sm border border-white/10">
              Live Tracker
            </span>
            {isRefreshing && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-300 font-bold ml-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Syncing
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Token: {procurement.token_id}</h1>
          <p className="text-slate-300 mt-2 text-sm font-medium">
            Mandi: <span className="text-white font-bold">{procurement.centre_name}</span>
          </p>
          <div className="mt-3 flex gap-4 text-xs font-bold text-slate-300">
            <button 
              onClick={() => setProcurement(null)}
              className="hover:text-white underline decoration-slate-500 cursor-pointer"
            >
              ← Track Another Token
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
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-10 mb-8 overflow-hidden">
        <div className="relative">
          {/* Connecting Line Base */}
          <div className="absolute top-6 left-[10%] right-[10%] h-1.5 bg-gray-100 rounded-full z-0"></div>
          
          {/* Active Progress Line */}
          <div 
            className="absolute top-6 left-[10%] h-1.5 bg-brand rounded-full z-0 transition-all duration-700 ease-in-out"
            style={{ width: `${(Math.min(currentStage, 5) - 1) * 20}%` }} // 4 intervals between 5 steps = 25% each. Width based on stage. (Wait, 5 steps = 4 gaps. 25% each gap. So: 0, 25, 50, 75, 100)
          ></div>

          {/* Corrected Active Progress Line Logic */}
          <div 
            className="absolute top-6 left-[10%] h-1.5 bg-brand rounded-full z-0 transition-all duration-700 ease-in-out"
            style={{ width: `${(Math.max(1, Math.min(currentStage, 5)) - 1) * 25}%` }}
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
                      showTractorIcon ? '🚛' : stage.id
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
        <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-2xl shadow-sm border border-emerald-200 p-8 mb-8 text-center animate-fade-in-up">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm text-3xl border-2 border-emerald-100">
            🎉
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-emerald-950 mb-2">
            Payment Successfully Generated!
          </h2>
          <p className="text-sm text-emerald-700 max-w-lg mx-auto mb-6">
            Your J-Form <strong>({procurement.j_form_number || 'JF-2026-98124'})</strong> has been issued. The final MSP payout has been initiated via Direct Benefit Transfer to your registered bank account.
          </p>
          
          <div className="inline-block bg-white px-8 py-4 rounded-2xl shadow-sm border border-emerald-100">
            <span className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Final Payout Amount</span>
            <span className="block text-4xl font-black text-emerald-600">₹{finalPayout.toLocaleString('en-IN')}</span>
          </div>
        </div>
      )}

      {/* GRID CARDS: Specific Data */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        
        {/* Card 1: Gate & Vehicle */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">🚛</span>
              <h3 className="font-bold text-gray-900 text-sm">Gate Check-in</h3>
            </div>
            <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase ${
              currentStage >= 2 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
            }`}>
              {currentStage >= 2 ? 'Cleared' : 'Pending Arrival'}
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-1 border-b border-gray-50">
              <span className="text-gray-500">Scheduled Date:</span>
              <span className="font-bold text-gray-900">{procurement.slot_date}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-50">
              <span className="text-gray-500">Intake Shift:</span>
              <span className="font-bold text-gray-900 text-right w-1/2 line-clamp-1">{procurement.slot_name}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-50">
              <span className="text-gray-500">Vehicle No:</span>
              <span className="font-bold text-gray-900 font-mono">{currentStage >= 2 ? (procurement.vehicle_number || 'TRUCK-123') : '--'}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-500">Security Gate Pass:</span>
              <span className="font-bold text-gray-900 font-mono">{currentStage >= 2 ? (procurement.gate_pass || 'GP-8831') : '--'}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Quality Assaying */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">🔬</span>
              <h3 className="font-bold text-gray-900 text-sm">Quality Control</h3>
            </div>
            <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase ${
              currentStage >= 3 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
            }`}>
              {currentStage >= 3 ? 'Passed' : 'Pending Lab'}
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-1 border-b border-gray-50 items-center">
              <span className="text-gray-500">Moisture Content:</span>
              <div className="text-right">
                <span className="font-bold text-gray-900 mr-2">{currentStage >= 3 ? `${procurement?.moisture_percent || 11.6}%` : '--'}</span>
                {currentStage >= 3 && (
                  <span className="text-[10px] text-green-700 bg-green-100 px-1.5 py-0.2 rounded font-semibold">(Limit &le; 14%)</span>
                )}
              </div>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-50">
              <span className="text-gray-500">Quality Grade:</span>
              <span className="font-extrabold text-brand-dark bg-green-50 px-2 py-0.5 rounded border border-green-200">
                {currentStage >= 3 ? (procurement?.grade || 'Grade A FAQ') : 'Pending Test'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-50">
              <span className="text-gray-500">Assaying Status:</span>
              <span className="font-bold text-gray-900">{currentStage >= 3 ? 'Approved for Procurement' : 'Waiting for Lab Turn'}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-500">Assaying Officer:</span>
              <span className="font-bold text-gray-900">Dr. V. Patel (Lab Inspector)</span>
            </div>
          </div>
        </div>

        {/* Card 3: Weighbridge & Net Quintals */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">⚖️</span>
              <h3 className="font-bold text-gray-900 text-sm">Weighbridge & Bags</h3>
            </div>
            <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase ${
              currentStage >= 4 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
            }`}>
              {currentStage >= 4 ? 'Weighed & Unloaded' : 'Pending Weighment'}
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-1 border-b border-gray-50">
              <span className="text-gray-500">Net Procurement Weight:</span>
              <span className="font-extrabold text-base text-gray-900">
                {currentStage >= 4 ? `${netQuintals} Qtl` : 'Pending'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-50">
              <span className="text-gray-500">Standard Gunny Bags:</span>
              <span className="font-bold text-gray-900">{currentStage >= 4 ? `${procurement?.gunny_bags || 90} Bags (50kg)` : '--'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-50">
              <span className="text-gray-500">Gross / Tare Weight:</span>
              <span className="font-bold text-gray-900 font-mono">
                {currentStage >= 4 ? '7,520 kg / 3,000 kg' : '--'}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-500">Weighbridge Slip No:</span>
              <span className="font-bold text-gray-900 font-mono">{currentStage >= 4 ? 'WB-2026-9912' : '--'}</span>
            </div>
          </div>
        </div>

      </div>

      {/* Official Audit Trail & Officer Logs */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-8">
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
