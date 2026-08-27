import React, { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:5000/api/capacity';

export default function ProcurementTracker() {
  const [procurement, setProcurement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showTractorIcon, setShowTractorIcon] = useState(true);
  const [simulatorLoading, setSimulatorLoading] = useState(false);
  const [showSimulator, setShowSimulator] = useState(true);

  // Alternates between Tractor icon and Step Number for the active milestone node
  useEffect(() => {
    const timer = setInterval(() => {
      setShowTractorIcon(prev => !prev);
    }, 1400);
    return () => clearInterval(timer);
  }, []);

  // 1. Fetch procurement consignment from MongoDB Atlas
  const fetchProcurement = async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const res = await fetch(`${API_BASE}/procurements`);
      if (!res.ok) throw new Error('Could not fetch procurement record from database.');
      const data = await res.json();
      if (data.success && data.procurements && data.procurements.length > 0) {
        const active = data.procurements.find(p => p.token_id === 'AS-2026-WHT-7821') || data.procurements[0];
        setProcurement(active);
        setErrorMessage(null);
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
      if (isManual) setIsRefreshing(false);
    }
  };

  // 2. Initial fetch & 3-second auto-sync interval
  useEffect(() => {
    fetchProcurement();
    const interval = setInterval(() => {
      fetchProcurement();
    }, 3000); // Auto-sync every 3 seconds

    return () => clearInterval(interval);
  }, []);

  // 3. Mandi Station Stage Advancement Simulator
  const handleAdvanceStage = async (targetStage, details = {}) => {
    if (!procurement) return;
    setSimulatorLoading(true);
    try {
      const res = await fetch(`${API_BASE}/procurements/advance-stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token_id: procurement.token_id,
          target_stage: targetStage,
          details
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setProcurement(data.procurement);
        }
      }
    } catch (err) {
      console.error('Advance error:', err);
    } finally {
      setSimulatorLoading(false);
    }
  };

  // 4. Reset Demo Token handler
  const handleResetToken = async () => {
    setSimulatorLoading(true);
    try {
      const res = await fetch(`${API_BASE}/procurements/reset-demo-token`, {
        method: 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setProcurement(data.procurement);
        }
      }
    } catch (err) {
      console.error('Reset error:', err);
    } finally {
      setSimulatorLoading(false);
    }
  };

  // 5 Stages Definition
  const STAGES = [
    { key: 1, label: '1. Slot Booked', desc: 'Token active & mandi slot confirmed' },
    { key: 2, label: '2. Gate Check-in', desc: 'Arrival verified & vehicle admitted' },
    { key: 3, label: '3. Quality Assayed', desc: 'Moisture tested & grain graded' },
    { key: 4, label: '4. Weighbridge', desc: 'Gross/Tare weight & bags counted' },
    { key: 5, label: '5. Ready for Payment', desc: 'J-Form approved for payment handoff' }
  ];

  const currentStage = procurement?.current_stage || 1;
  const progressPercent = Math.min(100, Math.max(0, Math.round(((currentStage - 1) / (STAGES.length - 1)) * 100)));
  const netQuintals = procurement?.net_weight_quintals || 45.20;
  const mspRate = procurement?.msp_rate || 2275;
  const grossPayout = procurement?.gross_payout || Math.round(netQuintals * mspRate);

  // Dynamic Audit Logs based on reached stages
  const auditLogs = [
    {
      stage: 1,
      title: 'Slot Booked & Token Active',
      timestamp: procurement?.slot_date ? `${procurement.slot_date} 09:00 AM` : '2026-08-27 09:00 AM',
      officer: 'AnnaSetu Booking Engine',
      notes: `Token ${procurement?.token_id || 'AS-2026-WHT-7821'} confirmed for 09:00 AM - 12:00 PM slot.`
    },
    currentStage >= 2 && {
      stage: 2,
      title: 'Mandi Gate Entry Verified',
      timestamp: procurement?.gate_in_at ? new Date(procurement.gate_in_at).toLocaleTimeString() : '10:15 AM',
      officer: 'Security Officer R. Sharma',
      notes: `Vehicle ${procurement?.vehicle_number || 'HR-05-AB-4412'} verified. Gate Pass ${procurement?.gate_pass || 'GP-2026-8831'} issued.`
    },
    currentStage >= 3 && {
      stage: 3,
      title: 'Grain Quality Assayed & Graded',
      timestamp: procurement?.assayed_at ? new Date(procurement.assayed_at).toLocaleTimeString() : '10:45 AM',
      officer: 'Dr. V. Patel (Quality Assayer)',
      notes: `Moisture ${procurement?.moisture_percent || 11.6}%, Grade: ${procurement?.grade || 'Grade A FAQ'}. Approved for procurement.`
    },
    currentStage >= 4 && {
      stage: 4,
      title: 'Weighbridge & Unloading Completed',
      timestamp: procurement?.weighed_at ? new Date(procurement.weighed_at).toLocaleTimeString() : '11:15 AM',
      officer: 'Weighbridge Incharge K. Singh',
      notes: `Net weight ${netQuintals} Quintals (${procurement?.gunny_bags || 90} standard bags) unloaded at Godown #2.`
    },
    currentStage >= 5 && {
      stage: 5,
      title: 'Procurement Approved (Ready for Payment)',
      timestamp: procurement?.approved_at ? new Date(procurement.approved_at).toLocaleTimeString() : '11:30 AM',
      officer: 'Mandi Manager Vishesh Tiwari',
      notes: `J-Form ${procurement?.j_form_number || 'JF-2026-98124'} approved. Gross payable ₹${grossPayout.toLocaleString()} forwarded for DBT payment.`
    }
  ].filter(Boolean);

  if (loading) {
    return (
      <div className="py-24 px-4 max-w-4xl mx-auto text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-brand border-t-transparent mb-4"></div>
        <p className="text-gray-600 font-semibold">Connecting to live procurement database...</p>
      </div>
    );
  }

  return (
    <div className="py-8 px-4 max-w-6xl mx-auto">
      
      {/* Top Banner & Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-800 text-xs font-bold rounded-full uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-green-600 animate-ping"></span>
                Live Grain Journey Tracking
              </span>
              <span className="text-xs text-gray-500 font-medium">
                Token: <strong className="text-gray-900 font-mono bg-gray-100 px-2 py-0.5 rounded">{procurement?.token_id || 'AS-2026-WHT-7821'}</strong>
              </span>
            </div>
            
            <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">
              Procurement Status
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Farmer: <strong className="text-gray-900">{procurement?.farmer_name || 'Aman Kumar'}</strong> • Centre: <span className="text-gray-900 font-medium">{procurement?.centre_name || 'Meerut Central Agro Warehouse'}</span> • Slot: <span className="text-gray-900 font-medium">{procurement?.slot_name || '09:00 AM - 12:00 PM'}</span>
            </p>
          </div>

          {/* Manual Refresh Button */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchProcurement(true)}
              disabled={isRefreshing}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border border-gray-300 shadow-sm cursor-pointer"
            >
              <span className={`text-sm ${isRefreshing ? 'animate-spin' : ''}`}>🔄</span>
              <span>{isRefreshing ? 'Syncing...' : 'Refresh Now'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Concise Consignment Timeline Bar with Alternating Tractor / Step Indicator */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-base font-extrabold text-gray-900 uppercase tracking-wider flex items-center gap-2">
              <span>🌾</span> Consignment Timeline
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Real-time procurement progress from appointment to payment readiness</p>
          </div>
          <div className="bg-green-50 border border-green-200 text-brand-dark px-3.5 py-1.5 rounded-full text-xs font-black flex items-center gap-1.5 shadow-xs">
            <span className="inline-block transform -scale-x-100">🚜</span>
            <span>Stage {currentStage} of 5</span>
          </div>
        </div>

        {/* Progress Track Container */}
        <div className="relative mx-3 sm:mx-8 mb-10 mt-6 pb-6">
          
          {/* Background Track Line */}
          <div className="absolute top-6 left-0 right-0 h-3 bg-gray-200 rounded-full z-0 overflow-hidden shadow-inner">
            {/* Filled Progress Bar */}
            <div 
              className="h-full bg-gradient-to-r from-emerald-500 via-green-600 to-brand-dark rounded-full transition-all duration-700 ease-out"
              style={{ width: `${progressPercent}%` }}
            >
              <div className="w-full h-full bg-white/20 animate-pulse"></div>
            </div>
          </div>

          {/* Equal-sized Milestone Nodes (Tractor alternates with step number on active node) */}
          <div className="w-full flex justify-between px-0 relative z-10">
            {STAGES.map((st) => {
              const isCompleted = st.key < currentStage;
              const isCurrent = st.key === currentStage;
              const isUpcoming = st.key > currentStage;

              return (
                <div 
                  key={st.key}
                  className="flex flex-col items-center text-center max-w-[90px] sm:max-w-[130px]"
                >
                  {/* Step Node Circle (Same size w-12 h-12 as Tractor) */}
                  <div 
                    className={`w-12 h-12 rounded-full border-2 transition-all duration-500 flex items-center justify-center font-bold z-20 ${
                      isCurrent
                        ? 'bg-white border-brand text-brand-dark shadow-xl ring-4 ring-green-200 scale-110'
                        : isCompleted 
                        ? 'bg-brand text-white border-white shadow-md' 
                        : 'bg-white text-gray-400 border-gray-300 shadow-xs'
                    }`}
                  >
                    {isCompleted && (
                      <span className="text-base font-black">✓</span>
                    )}

                    {isCurrent && (
                      <div className="flex items-center justify-center transition-all duration-300">
                        {showTractorIcon ? (
                          <span className="text-2xl animate-pulse inline-block transform -scale-x-100">🚜</span>
                        ) : (
                          <span className="text-base font-black text-brand-dark">{st.key}</span>
                        )}
                      </div>
                    )}

                    {isUpcoming && (
                      <span className="text-sm font-bold text-gray-400">{st.key}</span>
                    )}
                  </div>

                  {/* Concise Milestone Label */}
                  <div className="mt-2.5 flex flex-col items-center">
                    <div className={`text-[11px] sm:text-xs font-bold leading-tight ${
                      isCurrent ? 'text-brand-dark font-black' : isCompleted ? 'text-gray-900 font-bold' : 'text-gray-400'
                    }`}>
                      {st.label}
                    </div>

                    {/* Milestone Badges & Payment in Rupees under Step 5 */}
                    <div className="mt-1">
                      {st.key === 5 ? (
                        <div className="font-mono font-black text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-300 shadow-2xs">
                          ₹{grossPayout.toLocaleString()}
                        </div>
                      ) : (
                        <>
                          {isCompleted && (
                            <span className="inline-block px-1.5 py-0.2 bg-green-100 text-green-800 rounded text-[9px] font-bold">
                              Done
                            </span>
                          )}
                          {isCurrent && (
                            <span className="inline-block px-1.5 py-0.2 bg-amber-500 text-white rounded text-[9px] font-extrabold animate-pulse">
                              Active
                            </span>
                          )}
                          {isUpcoming && (
                            <span className="inline-block text-gray-400 text-[9px] font-medium">
                              Pending
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                </div>
              );
            })}
          </div>

        </div>

        {/* Ready for Payment Banner when stage 5 is reached */}
        {currentStage === 5 && (
          <div className="mt-4 bg-gradient-to-r from-green-600 to-emerald-700 text-white p-5 rounded-xl shadow-md flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-2xl">
                🎉
              </div>
              <div>
                <h3 className="text-lg font-black tracking-tight">Procurement Completed & Approved for Payment!</h3>
                <p className="text-xs text-green-100 mt-0.5">
                  Official J-Form <strong className="text-white font-mono">{procurement?.j_form_number || 'JF-2026-98124'}</strong> generated. Direct handoff to Payment Module for DBT transfer is ready.
                </p>
              </div>
            </div>

            {/* Total Payment in Rupees Display */}
            <div className="bg-white/15 backdrop-blur-xs border border-white/25 px-5 py-2.5 rounded-xl text-center shadow-inner">
              <span className="text-[10px] text-green-100 uppercase tracking-widest font-extrabold block">Total Payment</span>
              <span className="text-2xl font-black font-mono text-white">₹{grossPayout.toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>

      {/* Main Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        
        {/* Card 1: Gate & Arrival Details */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">🚛</span>
              <h3 className="font-bold text-gray-900 text-sm">Gate Check-in</h3>
            </div>
            <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase ${
              currentStage >= 2 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
            }`}>
              {currentStage >= 2 ? 'Admitted' : 'Pending'}
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-1 border-b border-gray-50">
              <span className="text-gray-500">Vehicle Number:</span>
              <span className="font-bold text-gray-900 font-mono">{procurement?.vehicle_number || (currentStage >= 2 ? 'HR-05-AB-4412' : '--')}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-50">
              <span className="text-gray-500">Gate Pass Slip:</span>
              <span className="font-bold text-gray-900 font-mono">{procurement?.gate_pass || (currentStage >= 2 ? 'GP-2026-8831' : '--')}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-50">
              <span className="text-gray-500">Farmer / Driver:</span>
              <span className="font-bold text-gray-900">{procurement?.farmer_name || 'Aman Kumar'}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-500">Mandi Gate:</span>
              <span className="font-bold text-gray-900">{procurement?.centre_name || 'Meerut Central Agro Warehouse'}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Quality Inspection & Grading */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">🔬</span>
              <h3 className="font-bold text-gray-900 text-sm">Quality Assaying</h3>
            </div>
            <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase ${
              currentStage >= 3 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
            }`}>
              {currentStage >= 3 ? 'Assayed & Passed' : 'In Queue'}
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-gray-50">
              <span className="text-gray-500">Moisture Content:</span>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-gray-900 text-sm">{currentStage >= 3 ? `${procurement?.moisture_percent || 11.6}%` : '--'}</span>
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

      {/* MANDI MANAGER STATION SIMULATOR / EVALUATION CONTROLLER */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl border border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <span className="text-xl">⚡</span>
            <div>
              <h3 className="font-bold text-base text-white">Mandi Manager Station Simulator</h3>
              <p className="text-xs text-slate-400">
                Advance physical stations in MongoDB Atlas to observe live synchronization:
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowSimulator(!showSimulator)}
            className="text-xs text-slate-400 hover:text-white font-semibold cursor-pointer"
          >
            {showSimulator ? 'Hide Controls ▲' : 'Show Controls ▼'}
          </button>
        </div>

        {showSimulator && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              <button
                disabled={simulatorLoading}
                onClick={handleResetToken}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                🔄 1. Reset (Slot Booked)
              </button>

              <button
                disabled={simulatorLoading}
                onClick={() => handleAdvanceStage(2, {
                  vehicle_number: 'HR-05-AB-4412',
                  gate_pass: 'GP-2026-8831'
                })}
                className="bg-blue-900/60 hover:bg-blue-800 text-blue-200 border border-blue-700/50 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                🚛 2. Mark Gate Entry
              </button>

              <button
                disabled={simulatorLoading}
                onClick={() => handleAdvanceStage(3, {
                  moisture_percent: 11.6,
                  grade: 'Grade A FAQ'
                })}
                className="bg-amber-900/60 hover:bg-amber-800 text-amber-200 border border-amber-700/50 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                🔬 3. Assaying Passed
              </button>

              <button
                disabled={simulatorLoading}
                onClick={() => handleAdvanceStage(4, {
                  net_weight_quintals: 45.20,
                  gunny_bags: 90
                })}
                className="bg-purple-900/60 hover:bg-purple-800 text-purple-200 border border-purple-700/50 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                ⚖️ 4. Weighbridge Done
              </button>

              <button
                disabled={simulatorLoading}
                onClick={() => handleAdvanceStage(5, {
                  msp_rate: 2275,
                  j_form_number: 'JF-2026-98124'
                })}
                className="bg-green-800 hover:bg-green-700 text-white border border-green-600 px-3 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer shadow-lg"
              >
                📄 5. Ready for Payment
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
