import React, { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:5000/api/procurement';

export default function Procurement({ user }) {
  const [lotData, setLotData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(new Date());
  const [showAdminSimulator, setShowAdminSimulator] = useState(true);
  const [adminActionLoading, setAdminActionLoading] = useState(false);
  const [showTractorIcon, setShowTractorIcon] = useState(true);

  // Timer to alternate between Tractor icon and Step Number for active step
  useEffect(() => {
    const timer = setInterval(() => {
      setShowTractorIcon(prev => !prev);
    }, 1400);
    return () => clearInterval(timer);
  }, []);

  const farmerId = user?.id || user?.phone || 'FARMER_AMAN_01';

  // 1. Fetch procurement lot from backend database
  const fetchLotData = async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const res = await fetch(`${API_BASE}/active/${farmerId}`);
      if (!res.ok) {
        if (res.status === 404) {
          await fetch(`${API_BASE}/seed`);
          const retryRes = await fetch(`${API_BASE}/active/${farmerId}`);
          if (retryRes.ok) {
            const data = await retryRes.json();
            setLotData(data);
            setErrorMessage(null);
            setLastSyncTime(new Date());
            setLoading(false);
            if (isManual) setIsRefreshing(false);
            return;
          }
        }
        throw new Error('Could not fetch procurement record from database.');
      }
      const data = await res.json();
      setLotData(data);
      setErrorMessage(null);
      setLastSyncTime(new Date());
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
    fetchLotData();
    const interval = setInterval(() => {
      fetchLotData();
    }, 3000); // 3-second auto-refresh

    return () => clearInterval(interval);
  }, [farmerId]);

  // 3. Admin simulation action handler
  const handleAdminUpdate = async (stage, payload = {}) => {
    if (!lotData) return;
    setAdminActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/${lotData._id || lotData.token_number}/update-stage`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage, ...payload })
      });
      if (res.ok) {
        const updated = await res.json();
        setLotData(updated.lot);
        setLastSyncTime(new Date());
      }
    } catch (err) {
      console.error('Admin update failed:', err);
    } finally {
      setAdminActionLoading(false);
    }
  };

  // 4. Reset lot to initial stage handler
  const handleAdminReset = async () => {
    if (!lotData) return;
    setAdminActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/${lotData._id || lotData.token_number}/reset`, {
        method: 'POST'
      });
      if (res.ok) {
        const updated = await res.json();
        setLotData(updated.lot);
        setLastSyncTime(new Date());
      }
    } catch (err) {
      console.error('Reset failed:', err);
    } finally {
      setAdminActionLoading(false);
    }
  };

  // Stepper definition
  const STAGES = [
    { key: 'SLOT_BOOKED', label: '1. Slot Booked', desc: 'Token active & mandi slot confirmed', icon: '📋' },
    { key: 'GATE_IN', label: '2. Gate Check-in', desc: 'Arrival verified & tractor admitted', icon: '🚛' },
    { key: 'QUALITY_CHECKED', label: '3. Quality Assayed', desc: 'Moisture tested & graded', icon: '🔬' },
    { key: 'WEIGHED_UNLOADED', label: '4. Weighbridge', desc: 'Gross/Tare weight & bags counted', icon: '⚖️' },
    { key: 'READY_FOR_PAYMENT', label: '5. Ready for Payment', desc: 'Approved for payment handoff', icon: '📄' }
  ];

  const getStageIndex = (stage) => {
    const idx = STAGES.findIndex(s => s.key === stage);
    return idx === -1 ? 0 : idx;
  };

  const currentIdx = lotData ? getStageIndex(lotData.current_stage) : 0;
  const progressPercent = Math.min(100, Math.max(0, Math.round((currentIdx / (STAGES.length - 1)) * 100)));
  const mspRate = lotData?.receipt_details?.msp_rate_per_quintal || 2300;
  const netQuintals = lotData?.weighment_details?.net_weight_quintals || 45.20;
  const totalAmount = Math.round(netQuintals * mspRate);

  if (loading) {
    return (
      <div className="py-24 px-4 max-w-4xl mx-auto text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-brand border-t-transparent mb-4"></div>
        <p className="text-gray-600 font-semibold">Connecting to procurement database...</p>
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
                Live Tracking
              </span>
              <span className="text-xs text-gray-500 font-medium">
                Token: <strong className="text-gray-900 font-mono bg-gray-100 px-2 py-0.5 rounded">{lotData?.token_number || 'AS-2026-LOT-7821'}</strong>
              </span>
            </div>
            
            <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">
              Procurement Status
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Farmer: <strong className="text-gray-900">{lotData?.farmer_name || user?.name || 'Aman Kumar'}</strong> • Centre: <span className="text-gray-900 font-medium">{lotData?.centre_name || 'Karnal Main Mandi'}</span> • Slot: <span className="text-gray-900 font-medium">{lotData?.time_slot || '10:00 AM - 01:00 PM'}</span>
            </p>
          </div>

          {/* Manual Refresh Control */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchLotData(true)}
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
            <span>Stage {currentIdx + 1} of 5</span>
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
            {STAGES.map((st, idx) => {
              const isCompleted = idx < currentIdx;
              const isCurrent = idx === currentIdx;
              const isUpcoming = idx > currentIdx;

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
                          <span className="text-base font-black text-brand-dark">{idx + 1}</span>
                        )}
                      </div>
                    )}

                    {isUpcoming && (
                      <span className="text-sm font-bold text-gray-400">{idx + 1}</span>
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
                      {st.key === 'READY_FOR_PAYMENT' ? (
                        <div className="font-mono font-black text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-300 shadow-2xs">
                          ₹{totalAmount.toLocaleString()}
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
        {lotData?.current_stage === 'READY_FOR_PAYMENT' && (
          <div className="mt-4 bg-gradient-to-r from-green-600 to-emerald-700 text-white p-5 rounded-xl shadow-md flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-2xl">
                🎉
              </div>
              <div>
                <h3 className="text-lg font-black tracking-tight">Procurement Completed & Approved for Payment!</h3>
                <p className="text-xs text-green-100 mt-0.5">
                  Procurement verified and approved. Handoff to Payment Module for DBT transfer is ready.
                </p>
              </div>
            </div>

            {/* Total Payment in Rupees Display */}
            <div className="bg-white/15 backdrop-blur-xs border border-white/25 px-5 py-2.5 rounded-xl text-center shadow-inner">
              <span className="text-[10px] text-green-100 uppercase tracking-widest font-extrabold block">Total Payment</span>
              <span className="text-2xl font-black font-mono text-white">₹{totalAmount.toLocaleString()}</span>
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
              currentIdx >= 1 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
            }`}>
              {currentIdx >= 1 ? 'Admitted' : 'Pending'}
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-1 border-b border-gray-50">
              <span className="text-gray-500">Vehicle Number:</span>
              <span className="font-bold text-gray-900 font-mono">{lotData?.gate_details?.vehicle_number || 'HR-05-AB-4412'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-50">
              <span className="text-gray-500">Gate Pass Slip:</span>
              <span className="font-bold text-gray-900 font-mono">{lotData?.gate_details?.gate_pass_no || 'GP-2026-8831'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-50">
              <span className="text-gray-500">Driver / Farmer:</span>
              <span className="font-bold text-gray-900">{lotData?.gate_details?.driver_name || lotData?.farmer_name || 'Aman Kumar'}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-500">Mandi Gate:</span>
              <span className="font-bold text-gray-900">{lotData?.centre_name || 'Karnal Centre #3'}</span>
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
              currentIdx >= 2 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
            }`}>
              {currentIdx >= 2 ? 'Assayed & Passed' : 'In Queue'}
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-gray-50">
              <span className="text-gray-500">Moisture Content:</span>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-gray-900 text-sm">{lotData?.quality_details?.moisture_percent ? `${lotData.quality_details.moisture_percent}%` : '11.6%'}</span>
                <span className="text-[10px] text-green-700 bg-green-100 px-1.5 py-0.2 rounded font-semibold">(Limit &le; 14%)</span>
              </div>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-50">
              <span className="text-gray-500">Quality Grade:</span>
              <span className="font-extrabold text-brand-dark bg-green-50 px-2 py-0.5 rounded border border-green-200">
                {lotData?.quality_details?.quality_grade || 'Grade A (FAQ)'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-50">
              <span className="text-gray-500">Foreign Matter:</span>
              <span className="font-bold text-gray-900">{lotData?.quality_details?.foreign_matter_percent || 0.4}%</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-500">Assaying Officer:</span>
              <span className="font-bold text-gray-900">{lotData?.quality_details?.assaying_officer || 'Dr. V. Patel (Lab Inspector)'}</span>
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
              currentIdx >= 3 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
            }`}>
              {currentIdx >= 3 ? 'Weighed & Unloaded' : 'Pending Weighment'}
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-1 border-b border-gray-50">
              <span className="text-gray-500">Net Procurement Weight:</span>
              <span className="font-extrabold text-base text-gray-900">
                {lotData?.weighment_details?.net_weight_quintals ? `${lotData.weighment_details.net_weight_quintals} Qtl` : currentIdx >= 3 ? `${netQuintals} Qtl` : 'Pending'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-50">
              <span className="text-gray-500">Standard Gunny Bags:</span>
              <span className="font-bold text-gray-900">{lotData?.weighment_details?.gunny_bags_count || (currentIdx >= 3 ? 90 : 0)} Bags (50kg)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-50">
              <span className="text-gray-500">Gross / Tare Weight:</span>
              <span className="font-bold text-gray-900 font-mono">
                {currentIdx >= 3 ? `${lotData?.weighment_details?.gross_weight_kg || 7520} kg / ${lotData?.weighment_details?.tare_weight_kg || 3000} kg` : '--'}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-500">Weighbridge Slip No:</span>
              <span className="font-bold text-gray-900 font-mono">{lotData?.weighment_details?.weighbridge_slip_no || (currentIdx >= 3 ? 'WB-2026-9912' : '--')}</span>
            </div>
          </div>
        </div>

      </div>

      {/* Audit Log / Stage Logs Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-8">
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
          <span>📜</span> Official Audit Trail & Officer Logs
        </h3>

        <div className="divide-y divide-gray-100">
          {lotData?.stage_logs?.map((log, i) => (
            <div key={i} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-green-100 text-green-800 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <div>
                  <div className="font-bold text-gray-900">{log.title}</div>
                  <div className="text-gray-500 mt-0.5">{log.notes}</div>
                </div>
              </div>
              <div className="text-right sm:text-right pl-9 sm:pl-0">
                <div className="text-gray-400 text-[11px]">{new Date(log.timestamp).toLocaleString()}</div>
                <div className="text-gray-600 font-medium text-[11px]">{log.updated_by}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ADMIN SIMULATION / TEST CONTROLLER */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl border border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <span className="text-xl">⚡</span>
            <div>
              <h3 className="font-bold text-base text-white">Mandi Admin / Evaluation Simulator</h3>
              <p className="text-xs text-slate-400">
                Simulate admin database updates in real time:
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowAdminSimulator(!showAdminSimulator)}
            className="text-xs text-slate-400 hover:text-white font-semibold cursor-pointer"
          >
            {showAdminSimulator ? 'Hide Controls ▲' : 'Show Controls ▼'}
          </button>
        </div>

        {showAdminSimulator && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              <button
                disabled={adminActionLoading}
                onClick={handleAdminReset}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                🔄 1. Reset (Slot Booked)
              </button>

              <button
                disabled={adminActionLoading}
                onClick={() => handleAdminUpdate('GATE_IN', {
                  gate_details: { vehicle_number: 'HR-05-AB-4412', driver_name: 'Aman Kumar', gate_pass_no: 'GP-2026-8831' },
                  notes: `Gate entry completed. Vehicle admitted at ${lotData?.centre_name || 'Mandi Gate'}.`
                })}
                className="bg-blue-900/60 hover:bg-blue-800 text-blue-200 border border-blue-700/50 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                🚛 2. Mark Gate Entry
              </button>

              <button
                disabled={adminActionLoading}
                onClick={() => handleAdminUpdate('QUALITY_CHECKED', {
                  quality_details: { moisture_percent: 12.0, foreign_matter_percent: 0.4, quality_grade: 'Grade A', is_passed: true, assaying_officer: 'Dr. V. Patel (Lab Inspector)' },
                  notes: 'Quality tested. Moisture within limits, Grade A approved.'
                })}
                className="bg-amber-900/60 hover:bg-amber-800 text-amber-200 border border-amber-700/50 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                🔬 3. Assaying Passed
              </button>

              <button
                disabled={adminActionLoading}
                onClick={() => handleAdminUpdate('WEIGHED_UNLOADED', {
                  weighment_details: { gross_weight_kg: 7520, tare_weight_kg: 3000, gunny_bags_count: 90, weighbridge_slip_no: 'WB-2026-9912' },
                  notes: 'Net weight 45.20 Quintals (90 gunny bags) unloaded at godown.'
                })}
                className="bg-purple-900/60 hover:bg-purple-800 text-purple-200 border border-purple-700/50 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                ⚖️ 4. Weighbridge Done
              </button>

              <button
                disabled={adminActionLoading}
                onClick={() => handleAdminUpdate('READY_FOR_PAYMENT', {
                  receipt_details: { msp_rate_per_quintal: mspRate, deductions_inr: 0, j_form_no: 'JF-2026-88192' },
                  notes: 'Procurement approved for payment handoff.'
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
