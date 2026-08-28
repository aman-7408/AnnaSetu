const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";
import React, { useState, useEffect } from 'react';

export default function AdminConsole({ userSession, onLogout, onOpenLogin }) {
  const [centres, setCentres] = useState([]);
  const [procurements, setProcurements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState('Just now');
  const [expandedCentreId, setExpandedCentreId] = useState(null);
  const [slotsData, setSlotsData] = useState({});
  const [actionMessage, setActionMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [inputCapacities, setInputCapacities] = useState({});
  const [isAdvancingStage, setIsAdvancingStage] = useState(false);
  
  // Custom Shift Quotas Editor State
  const [isEditingShifts, setIsEditingShifts] = useState(false);
  const [shiftInputs, setShiftInputs] = useState({});
  const [isSavingShifts, setIsSavingShifts] = useState(false);

  // 1. Fetch Centres & Procurements from MongoDB
  const fetchAllData = async (showSyncIndicator = false) => {
    if (showSyncIndicator) setIsSyncing(true);
    try {
      const resCentres = await fetch(`${API_BASE}/api/capacity/centres`);
      const dataCentres = await resCentres.json();
      if (dataCentres.success) {
        setCentres(dataCentres.centres);
      }

      const resProc = await fetch(`${API_BASE}/api/capacity/procurements`);
      const dataProc = await resProc.json();
      if (dataProc.success) {
        setProcurements(dataProc.procurements);
      }

      const now = new Date();
      setLastSyncedTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
      if (showSyncIndicator) {
        setTimeout(() => setIsSyncing(false), 500);
      }
    }
  };

  // 2. Fetch Slots for a centre
  const fetchSlots = async (centreId) => {
    try {
      const res = await fetch(`${API_BASE}/api/capacity/centres/${centreId}/slots`);
      const data = await res.json();
      if (data.success) {
        setSlotsData(prev => ({ ...prev, [centreId]: data.slots }));
        
        // Populate default edit values
        const initialInputs = {};
        data.slots.forEach(slot => {
          initialInputs[slot.slot_code] = slot.max_capacity_quintals;
        });
        setShiftInputs(initialInputs);
      }
    } catch (err) {
      console.error('Error fetching slots:', err);
    }
  };

  const handleToggleExpand = (centreId) => {
    if (expandedCentreId === centreId) {
      setExpandedCentreId(null);
      setIsEditingShifts(false);
    } else {
      setExpandedCentreId(centreId);
      setIsEditingShifts(false);
      fetchSlots(centreId);
    }
  };

  // 3. Manager: Set Daily Capacity with Two-Way Safety Shield
  const handleSetCapacity = async (centreId) => {
    const target = centres.find(c => c._id === centreId);
    if (!target) return;

    const rawInput = inputCapacities[centreId];
    if (rawInput === undefined || rawInput === '') {
      showError('Please enter a valid capacity number.');
      return;
    }

    const newCap = Number(rawInput);
    const ceiling = target.max_designed_capacity_quintals || 2500;
    const floor = target.booked_capacity_quintals || 0;

    if (newCap > ceiling) {
      showError(`❌ Safety Block: Exceeds physical silo ceiling (${ceiling.toLocaleString()} Q) for ${target.name}.`);
      return;
    }
    if (newCap < floor) {
      showError(`❌ Safety Block: Cannot set capacity lower than currently booked grain (${floor.toLocaleString()} Q).`);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/capacity/centres/${centreId}/capacity`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ daily_capacity_quintals: newCap })
      });
      const data = await res.json();
      if (data.success) {
        showFeedback(`✓ Daily capacity for ${target.name} set to ${newCap.toLocaleString()} Q`);
        fetchAllData(false);
        fetchSlots(centreId);
      } else {
        showError(data.error || 'Failed to update capacity');
      }
    } catch (err) {
      console.error('Error updating capacity:', err);
      showError('Failed to communicate with backend.');
    }
  };

  // 4. Manager: Save Custom 3-Hour Shift Quotas
  const handleSaveShiftQuotas = async (centreId) => {
    const target = centres.find(c => c._id === centreId);
    if (!target) return;

    const targetSlots = slotsData[centreId] || [];
    const updatedSlotsPayload = targetSlots.map(s => ({
      slot_code: s.slot_code,
      slot_name: s.slot_name,
      max_capacity_quintals: Number(shiftInputs[s.slot_code] || 0)
    }));

    // Math validation
    const totalSum = updatedSlotsPayload.reduce((acc, s) => acc + s.max_capacity_quintals, 0);
    const requiredDaily = target.daily_capacity_quintals;

    if (totalSum !== requiredDaily) {
      showError(`❌ Mathematical Mismatch: Shift total (${totalSum} Q) must equal Mandi daily capacity (${requiredDaily} Q).`);
      return;
    }

    // Floor checks
    for (const slot of targetSlots) {
      const newCap = Number(shiftInputs[slot.slot_code] || 0);
      const bookedFloor = slot.booked_capacity_quintals || 0;
      if (newCap < bookedFloor) {
        showError(`❌ Safety Block: Cannot set ${slot.slot_name} below currently booked grain (${bookedFloor} Q).`);
        return;
      }
    }

    setIsSavingShifts(true);
    try {
      const res = await fetch(`${API_BASE}/api/capacity/centres/${centreId}/slots`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slots: updatedSlotsPayload })
      });
      const data = await res.json();
      if (data.success) {
        showFeedback(`✓ Successfully balanced 3-hour shift quotas to match ${requiredDaily.toLocaleString()} Q!`);
        setIsEditingShifts(false);
        fetchSlots(centreId);
      } else {
        showError(data.error || 'Failed to update shift quotas.');
      }
    } catch (err) {
      console.error('Error saving shift quotas:', err);
      showError('Failed to communicate with server.');
    } finally {
      setIsSavingShifts(false);
    }
  };

  // 5. Manager: Toggle Traffic Diversion
  const handleToggleDivert = async (centreId, currentStatus) => {
    const isCurrentlyDiverting = currentStatus === 'divert_active';
    try {
      const res = await fetch(`${API_BASE}/api/capacity/centres/${centreId}/divert`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          divert_active: !isCurrentlyDiverting,
          alert_message: !isCurrentlyDiverting ? 'Heavy truck load. Recommended to book alternate green Mandis.' : ''
        })
      });
      const data = await res.json();
      if (data.success) {
        showFeedback(!isCurrentlyDiverting ? '🚨 Traffic Diversion Alert Activated!' : '✓ Normal Traffic Restored');
        fetchAllData(false);
      }
    } catch (err) {
      console.error('Error toggling diversion:', err);
    }
  };

  // 6. Manager Action: Advance Procurement Stage (1 ➔ 2 ➔ 3 ➔ 4 ➔ 5)
  const handleAdvanceStage = async (tokenId, nextStage) => {
    setIsAdvancingStage(true);
    try {
      let stageDetails = {};
      if (nextStage === 2) {
        stageDetails = { vehicle_number: 'HR-05-AB-4412', gate_pass: 'GP-2026-8831' };
      } else if (nextStage === 3) {
        stageDetails = { moisture_percent: 11.6, purity_percent: 99.2, grade: 'Grade A FAQ' };
      } else if (nextStage === 4) {
        // Dynamically calculate based on the actual farmer's booked weight
        const w = activeDemoProcurement.estimated_weight_quintals || 45.20;
        stageDetails = { net_weight_quintals: w, gunny_bags: Math.round(w * 2) };
      } else if (nextStage === 5) {
        stageDetails = { msp_rate: 2275, j_form_number: 'JF-2026-98124' };
      }

      const res = await fetch(`${API_BASE}/api/capacity/procurements/advance-stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token_id: tokenId, target_stage: nextStage, details: stageDetails })
      });
      const data = await res.json();
      if (data.success) {
        showFeedback(`✓ Approved Stage ${nextStage}! Updated in MongoDB Atlas for Farmer & Preet.`);
        fetchAllData(false);
      }
    } catch (err) {
      console.error('Error advancing stage:', err);
      showError('Failed to advance procurement stage.');
    } finally {
      setIsAdvancingStage(false);
    }
  };

  const handleResetToken = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/capacity/procurements/reset-demo-token`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showFeedback('⚡ Demo Token reset to Stage 1 (Slot Active)!');
        fetchAllData(true);
      }
    } catch (err) {
      console.error('Error resetting token:', err);
    }
  };

  const handleResetSeed = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/capacity/seed`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showFeedback('⚡ All Demo Mandi Data Reset to Default!');
        setInputCapacities({});
        setIsEditingShifts(false);
        fetchAllData(true);
      }
    } catch (err) {
      console.error('Error resetting seed data:', err);
    }
  };

  const showFeedback = (msg) => {
    setActionMessage(msg);
    setErrorMessage('');
    setTimeout(() => setActionMessage(''), 4000);
  };

  const showError = (msg) => {
    setErrorMessage(msg);
    setActionMessage('');
    setTimeout(() => setErrorMessage(''), 5000);
  };

  useEffect(() => {
    if (userSession) {
      fetchAllData(false);
      const interval = setInterval(() => {
        fetchAllData(false);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [userSession]);

  if (!userSession) {
    return (
      <div className="py-20 px-4 max-w-xl mx-auto text-center animate-fade-in-up">
        <div className="bg-white rounded-2xl shadow-xl p-8 border-t-4 border-red-500">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Access Restricted</h2>
          <p className="text-gray-600 text-sm mb-6 leading-relaxed">
            This command center is reserved for authorized Mandi Managers & In-Charges.
          </p>
          <button 
            onClick={onOpenLogin}
            className="bg-emerald-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-emerald-700 transition-colors shadow-md flex items-center justify-center gap-2 mx-auto cursor-pointer"
          >
            <span>🔒</span> Open Manager Login
          </button>
        </div>
      </div>
    );
  }

  const managerCentre = centres.find(
    c => c.name.toLowerCase().includes(userSession.state?.toLowerCase() || '') || c.name === userSession.centreName
  ) || centres[0];

  const centreSlots = managerCentre ? (slotsData[managerCentre._id] || []) : [];

  const activeDemoProcurement = procurements[0] || {
    token_id: 'AS-2026-WHT-7821',
    farmer_name: 'Aman Kumar',
    farmer_phone: '+91 98765 43210',
    crop_type: 'Wheat (Sharbati A-Grade)',
    centre_name: userSession.centreName || 'Meerut Central Agro Warehouse',
    current_stage: 1
  };

  // Live calculation of shift quota allocation sum
  const currentTotalAllocated = Object.values(shiftInputs).reduce((acc, val) => acc + (Number(val) || 0), 0);
  const requiredDailyQuota = managerCentre?.daily_capacity_quintals || 1200;
  const allocationDiff = currentTotalAllocated - requiredDailyQuota;
  const isShiftQuotaBalanced = allocationDiff === 0;

  // Check if any shift is set below currently booked grain
  const floorViolationSlot = centreSlots.find(slot => {
    const val = Number(shiftInputs[slot.slot_code] !== undefined ? shiftInputs[slot.slot_code] : slot.max_capacity_quintals);
    return val < (slot.booked_capacity_quintals || 0);
  });
  const hasFloorViolation = !!floorViolationSlot;
  const isShiftQuotaValid = isShiftQuotaBalanced && !hasFloorViolation;

  return (
    <div className="py-8 px-4 max-w-6xl mx-auto animate-fade-in-up space-y-6">
      
      {/* 1. TOP MANAGER HEADER BAR */}
      <div className="bg-white rounded-2xl shadow-md p-5 md:p-6 border-l-4 border-emerald-600 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center justify-center text-2xl shadow-inner shrink-0">
            🌾
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl md:text-2xl font-extrabold text-gray-900">
                {userSession.name}
              </h2>
              <span className="bg-emerald-100 text-emerald-800 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                {userSession.badge}
              </span>
            </div>
            <p className="text-xs text-gray-500 font-medium mt-0.5">
              Assigned Facility: <span className="font-bold text-emerald-800">{userSession.centreName}</span>
            </p>
          </div>
        </div>
        
        {/* Right Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 shadow-inner">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Auto-Sync: <strong className="text-emerald-700">3s</strong></span>
          </div>

          <button 
            onClick={() => fetchAllData(true)}
            disabled={isSyncing}
            className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold px-3.5 py-2 rounded-lg transition-all shadow-sm active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <span className={`inline-block text-sm ${isSyncing ? 'animate-spin' : ''}`}>🔄</span>
            <span>{isSyncing ? 'Syncing...' : 'Live Sync'}</span>
          </button>

          <button 
            onClick={onLogout}
            className="bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 text-xs font-bold px-3.5 py-2 rounded-lg transition-colors cursor-pointer shadow-sm"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Success / Error Banners */}
      {actionMessage && (
        <div className="bg-emerald-600 text-white p-3 rounded-xl shadow-md text-xs md:text-sm font-bold flex items-center justify-between animate-fade-in-down">
          <span>{actionMessage}</span>
          <span className="text-emerald-200 text-xs font-mono">Updated in MongoDB Atlas</span>
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-600 text-white p-3.5 rounded-xl shadow-md text-xs md:text-sm font-bold flex items-center justify-between animate-shake">
          <span>{errorMessage}</span>
          <span className="text-red-200 text-xs uppercase font-mono">Safety Guardrail</span>
        </div>
      )}

      {/* 2. THE MANAGER'S LIVE PHYSICAL INTAKE & 5-STAGE APPROVAL STATION */}
      <div className="bg-gradient-to-br from-emerald-900 to-teal-950 text-white rounded-3xl p-6 md:p-8 shadow-xl border border-emerald-800 relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-10 text-9xl pointer-events-none transform translate-x-6 -translate-y-6">
          ⚖️
        </div>

        <div className="relative z-10 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-800/80 pb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                Physical Mandi Gate Station
              </span>
              <h3 className="text-xl md:text-2xl font-extrabold text-white mt-0.5 flex items-center gap-2">
                <span>🚛</span> Truck Arrival & 5-Stage Station Approvals
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-emerald-300 bg-emerald-800/60 border border-emerald-600 px-3 py-1 rounded-full font-mono font-bold">
                Token: {activeDemoProcurement.token_id}
              </span>
              <button 
                onClick={handleResetToken}
                className="bg-emerald-800 hover:bg-emerald-700 text-emerald-200 text-[11px] font-bold px-2.5 py-1 rounded-lg transition-colors cursor-pointer border border-emerald-600"
                title="Reset demo token back to Stage 1"
              >
                ↺ Reset Token
              </button>
            </div>
          </div>

          {/* Active Farmer Delivery Info */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-emerald-950/60 p-4 rounded-2xl border border-emerald-800/60 text-xs">
            <div>
              <p className="text-emerald-400 font-bold uppercase text-[10px]">Farmer Name</p>
              <p className="font-extrabold text-white text-sm">{activeDemoProcurement.farmer_name}</p>
            </div>
            <div>
              <p className="text-emerald-400 font-bold uppercase text-[10px]">Crop Allotment</p>
              <p className="font-bold text-white">{activeDemoProcurement.crop_type}</p>
            </div>
            <div>
              <p className="text-emerald-400 font-bold uppercase text-[10px]">Arrival Mandi</p>
              <p className="font-bold text-white">{activeDemoProcurement.centre_name}</p>
            </div>
            <div>
              <p className="text-emerald-400 font-bold uppercase text-[10px]">Current Live Stage</p>
              <p className="font-extrabold text-yellow-300 text-sm">
                Stage {activeDemoProcurement.current_stage} / 5
              </p>
            </div>
          </div>

          {/* Interactive 5-Stage Step Approval Station */}
          <div className="space-y-4">
            <p className="text-xs font-bold text-emerald-200 uppercase tracking-wider">
              Click to approve physical stations (Updates Farmer & Preet live):
            </p>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              
              {/* STAGE 1: Token Active */}
              <div className={`p-4 rounded-2xl border transition-all ${
                activeDemoProcurement.current_stage >= 1 
                  ? 'bg-emerald-800/80 border-emerald-400 text-white shadow-md' 
                  : 'bg-emerald-950/40 border-emerald-800/50 text-emerald-400/60'
              }`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold">Stage 1</span>
                  <span>{activeDemoProcurement.current_stage >= 1 ? '✅' : '⏳'}</span>
                </div>
                <h5 className="font-extrabold text-xs">Token Active</h5>
                <p className="text-[10px] text-emerald-200 mt-1">Booked by Anushrita</p>
              </div>

              {/* STAGE 2: Gate Check-in */}
              <div className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                activeDemoProcurement.current_stage >= 2 
                  ? 'bg-emerald-800/80 border-emerald-400 text-white shadow-md' 
                  : activeDemoProcurement.current_stage === 1
                    ? 'bg-emerald-950/90 border-yellow-400/80 text-white ring-2 ring-yellow-400/30'
                    : 'bg-emerald-950/40 border-emerald-800/50 text-emerald-400/60'
              }`}>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold">Stage 2</span>
                    <span>{activeDemoProcurement.current_stage >= 2 ? '✅' : '🚛'}</span>
                  </div>
                  <h5 className="font-extrabold text-xs">Gate Check-in</h5>
                  <p className="text-[10px] text-emerald-200 mt-0.5">HR-05-AB-4412</p>
                </div>

                {activeDemoProcurement.current_stage === 1 && (
                  <button 
                    onClick={() => handleAdvanceStage(activeDemoProcurement.token_id, 2)}
                    disabled={isAdvancingStage}
                    className="mt-3 w-full bg-yellow-400 hover:bg-yellow-300 text-gray-950 text-[11px] font-extrabold py-1.5 px-2 rounded-lg transition-all shadow active:scale-95 cursor-pointer"
                  >
                    Approve Gate-In
                  </button>
                )}
              </div>

              {/* STAGE 3: Quality Assaying */}
              <div className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                activeDemoProcurement.current_stage >= 3 
                  ? 'bg-emerald-800/80 border-emerald-400 text-white shadow-md' 
                  : activeDemoProcurement.current_stage === 2
                    ? 'bg-emerald-950/90 border-yellow-400/80 text-white ring-2 ring-yellow-400/30'
                    : 'bg-emerald-950/40 border-emerald-800/50 text-emerald-400/60'
              }`}>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold">Stage 3</span>
                    <span>{activeDemoProcurement.current_stage >= 3 ? '✅' : '🔬'}</span>
                  </div>
                  <h5 className="font-extrabold text-xs">Quality Assaying</h5>
                  <p className="text-[10px] text-emerald-200 mt-0.5">Moisture 11.6% • Grade A</p>
                </div>

                {activeDemoProcurement.current_stage === 2 && (
                  <button 
                    onClick={() => handleAdvanceStage(activeDemoProcurement.token_id, 3)}
                    disabled={isAdvancingStage}
                    className="mt-3 w-full bg-yellow-400 hover:bg-yellow-300 text-gray-950 text-[11px] font-extrabold py-1.5 px-2 rounded-lg transition-all shadow active:scale-95 cursor-pointer"
                  >
                    Approve Quality
                  </button>
                )}
              </div>

              {/* STAGE 4: Weighbridge & Bags */}
              <div className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                activeDemoProcurement.current_stage >= 4 
                  ? 'bg-emerald-800/80 border-emerald-400 text-white shadow-md' 
                  : activeDemoProcurement.current_stage === 3
                    ? 'bg-emerald-950/90 border-yellow-400/80 text-white ring-2 ring-yellow-400/30'
                    : 'bg-emerald-950/40 border-emerald-800/50 text-emerald-400/60'
              }`}>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold">Stage 4</span>
                    <span>{activeDemoProcurement.current_stage >= 4 ? '✅' : '⚖️'}</span>
                  </div>
                  <h5 className="font-extrabold text-xs">Weighbridge</h5>
                  <p className="text-[10px] text-emerald-200 mt-0.5">{activeDemoProcurement.net_weight_quintals || activeDemoProcurement.estimated_weight_quintals || 45.20} Qtl • {activeDemoProcurement.gunny_bags || Math.round((activeDemoProcurement.estimated_weight_quintals || 45.20) * 2)} Bags</p>
                </div>

                {activeDemoProcurement.current_stage === 3 && (
                  <button 
                    onClick={() => handleAdvanceStage(activeDemoProcurement.token_id, 4)}
                    disabled={isAdvancingStage}
                    className="mt-3 w-full bg-yellow-400 hover:bg-yellow-300 text-gray-950 text-[11px] font-extrabold py-1.5 px-2 rounded-lg transition-all shadow active:scale-95 cursor-pointer"
                  >
                    Approve Weight
                  </button>
                )}
              </div>

              {/* STAGE 5: Payment Approval */}
              <div className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                activeDemoProcurement.current_stage >= 5 
                  ? 'bg-gradient-to-br from-emerald-600 to-teal-500 border-white text-white shadow-lg' 
                  : activeDemoProcurement.current_stage === 4
                    ? 'bg-emerald-950/90 border-yellow-400/80 text-white ring-2 ring-yellow-400/30'
                    : 'bg-emerald-950/40 border-emerald-800/50 text-emerald-400/60'
              }`}>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold">Stage 5</span>
                    <span>{activeDemoProcurement.current_stage >= 5 ? '💰' : '📄'}</span>
                  </div>
                  <h5 className="font-extrabold text-xs">Approved Payout</h5>
                  <p className="text-[10px] text-emerald-200 mt-0.5">₹{(activeDemoProcurement.gross_payout || Math.round((activeDemoProcurement.net_weight_quintals || activeDemoProcurement.estimated_weight_quintals || 45.20) * 2275)).toLocaleString('en-IN')} ({activeDemoProcurement.j_form_number || 'JF-2026-98124'})</p>
                </div>

                {activeDemoProcurement.current_stage === 4 && (
                  <button 
                    onClick={() => handleAdvanceStage(activeDemoProcurement.token_id, 5)}
                    disabled={isAdvancingStage}
                    className="mt-3 w-full bg-yellow-400 hover:bg-yellow-300 text-gray-950 text-[11px] font-extrabold py-1.5 px-2 rounded-lg transition-all shadow active:scale-95 cursor-pointer"
                  >
                    Generate J-Form
                  </button>
                )}

                {activeDemoProcurement.current_stage === 5 && (
                  <span className="mt-2 text-[10px] font-extrabold bg-white/20 px-2 py-1 rounded text-center">
                    ✓ Handed to Preet
                  </span>
                )}
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* 3. MANAGER'S ASSIGNED MANDI FACILITY & CAPACITY CONTROLS */}
      {managerCentre && (
        <div className="space-y-4">
          <h3 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
            <span>🏢</span> Mandi Warehouse Capacity & Safety Controls
          </h3>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
            {(() => {
              const max = managerCentre.daily_capacity_quintals || 1000;
              const maxCeiling = managerCentre.max_designed_capacity_quintals || 2500;
              const booked = managerCentre.booked_capacity_quintals || 0;
              const percent = managerCentre.utilization_percentage || Math.round((booked / max) * 100);
              const isExpanded = expandedCentreId === managerCentre._id;

              let barColor = 'bg-emerald-500';
              let badgeBg = 'bg-emerald-50 text-emerald-800 border-emerald-200';
              let statusLabel = '🟢 Normal Intake';

              if (percent >= 85 || managerCentre.status === 'divert_active') {
                barColor = 'bg-red-500';
                badgeBg = 'bg-red-50 text-red-800 border-red-200';
                statusLabel = '🔴 Critical Load';
              } else if (percent >= 60) {
                barColor = 'bg-amber-500';
                badgeBg = 'bg-amber-50 text-amber-800 border-amber-200';
                statusLabel = '🟡 Filling Steadily';
              }

              return (
                <div className="space-y-6">
                  
                  {/* Top Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-4">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider bg-gray-100 text-gray-700 px-2.5 py-1 rounded-md">
                        {managerCentre.state} • {managerCentre.district}
                      </span>
                      <h4 className="text-xl font-extrabold text-gray-900 mt-1">
                        {managerCentre.name}
                      </h4>
                      <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                        <span>📍</span> {managerCentre.location}
                      </p>
                    </div>

                    <span className={`text-xs font-extrabold px-3 py-1 rounded-full border self-start sm:self-auto ${badgeBg}`}>
                      {statusLabel}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-baseline text-xs font-bold">
                      <span className="text-gray-700">Storage Capacity Utilization</span>
                      <span className={`text-base ${percent >= 85 ? 'text-red-600 font-extrabold' : 'text-gray-900'}`}>
                        {percent}%
                      </span>
                    </div>

                    <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden p-0.5 border border-gray-200 shadow-inner">
                      <div 
                        className={`h-full rounded-full transition-all duration-700 ${barColor}`} 
                        style={{ width: `${Math.min(100, Math.max(5, percent))}%` }}
                      ></div>
                    </div>

                    <div className="flex justify-between items-center text-xs text-gray-500 pt-1 font-medium">
                      <span>Booked: <strong>{booked} Q</strong></span>
                      <span>Available: <strong className="text-emerald-700">{managerCentre.available_capacity_quintals || (max - booked)} Q</strong></span>
                      <span>Current Limit: <strong>{max} Q</strong></span>
                      <span>Physical Silo Ceiling: <strong className="text-gray-700">{maxCeiling} Q</strong></span>
                    </div>
                  </div>

                  {/* Controls Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    
                    {/* Manual Quota Modifier */}
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 shadow-inner space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-extrabold text-gray-700">Adjust Daily Limit:</span>
                        <span className="text-[10px] text-gray-400 font-mono">Max Silo: {maxCeiling} Q</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <input 
                            type="number"
                            placeholder={max.toString()}
                            value={inputCapacities[managerCentre._id] !== undefined ? inputCapacities[managerCentre._id] : ''}
                            onChange={(e) => setInputCapacities({ ...inputCapacities, [managerCentre._id]: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg font-bold text-gray-800 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none pr-8"
                          />
                          <span className="absolute right-3 top-2 text-xs font-bold text-gray-400">Q</span>
                        </div>

                        <button 
                          onClick={() => handleSetCapacity(managerCentre._id)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-lg text-xs shadow-sm transition-all active:scale-95 cursor-pointer whitespace-nowrap"
                        >
                          Set Limit
                        </button>
                      </div>

                      <p className="text-[10px] text-gray-400 font-medium">
                        Allowed: <strong className="text-gray-600">{booked} Q</strong> (Booked) – <strong className="text-emerald-700">{maxCeiling} Q</strong> (Silo Ceiling)
                      </p>
                    </div>

                    {/* Diversion & Shifts Action */}
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 shadow-inner flex flex-col justify-between gap-3">
                      <div>
                        <span className="font-extrabold text-gray-700 text-xs block mb-1">Mandi Traffic Controls:</span>
                        <p className="text-[11px] text-gray-500">
                          Configure 3-hour shift allocations or activate diversion advisories.
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button 
                          onClick={() => handleToggleExpand(managerCentre._id)}
                          className="bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-bold py-2 rounded-lg transition-colors shadow-sm cursor-pointer text-center"
                        >
                          {isExpanded ? '▲ Hide Shifts' : '⏰ 3-Hour Shifts'}
                        </button>

                        <button 
                          onClick={() => handleToggleDivert(managerCentre._id, managerCentre.status)}
                          className={`text-xs font-bold py-2 rounded-lg transition-colors shadow-sm cursor-pointer text-center border ${
                            managerCentre.status === 'divert_active'
                              ? 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700'
                              : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                          }`}
                        >
                          {managerCentre.status === 'divert_active' ? '✓ Resume Intake' : '⚠️ Divert Traffic'}
                        </button>
                      </div>
                    </div>

                  </div>

                  {/* 3-HOUR SHIFT BREAKDOWN & CUSTOM QUOTA EDITOR */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-gray-200 space-y-4 animate-fade-in-down">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-extrabold text-gray-800 uppercase tracking-wider">
                            Daily Shift Quota Breakdown (3 Hours Each)
                          </p>
                          <p className="text-[11px] text-gray-500">
                            Allocate custom storage limits to specific morning, afternoon, or evening shifts.
                          </p>
                        </div>

                        {!isEditingShifts ? (
                          <button 
                            onClick={() => setIsEditingShifts(true)}
                            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors shadow-sm cursor-pointer self-start sm:self-auto flex items-center gap-1"
                          >
                            <span>✏️</span> Customize Shifts
                          </button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => {
                                setIsEditingShifts(false);
                                fetchSlots(managerCentre._id);
                              }}
                              className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button 
                              onClick={() => handleSaveShiftQuotas(managerCentre._id)}
                              disabled={!isShiftQuotaValid || isSavingShifts}
                              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-1.5 rounded-lg transition-colors shadow-md cursor-pointer flex items-center gap-1"
                            >
                              <span>💾</span> {isSavingShifts ? 'Saving...' : 'Save Shifts'}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Live Allocation Math Status Pill */}
                      {isEditingShifts && (
                        <div className={`p-3 rounded-xl border text-xs font-bold flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                          hasFloorViolation
                            ? 'bg-red-50 border-red-300 text-red-700 animate-shake'
                            : isShiftQuotaBalanced 
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                              : allocationDiff > 0
                                ? 'bg-red-50 border-red-300 text-red-700'
                                : 'bg-amber-50 border-amber-300 text-amber-800'
                        }`}>
                          <div className="flex items-center gap-2">
                            <span>{hasFloorViolation ? '🛑' : isShiftQuotaBalanced ? '✅' : '⚖️'}</span>
                            <span>
                              {hasFloorViolation ? (
                                <>Safety Block: <strong>{floorViolationSlot.slot_name}</strong> is below booked grain (<strong>{floorViolationSlot.booked_capacity_quintals} Q</strong>)</>
                              ) : (
                                <>Allocated Sum: <strong>{currentTotalAllocated.toLocaleString()} Q</strong> / Required Daily: <strong>{requiredDailyQuota.toLocaleString()} Q</strong></>
                              )}
                            </span>
                          </div>

                          <span className="text-[11px] font-mono uppercase">
                            {hasFloorViolation 
                              ? 'Floor Violation'
                              : isShiftQuotaBalanced 
                                ? '✓ 100% Balanced & Valid' 
                                : allocationDiff > 0 
                                  ? `Overallocated by +${allocationDiff} Q` 
                                  : `Remaining to allocate: ${Math.abs(allocationDiff)} Q`}
                          </span>
                        </div>
                      )}
                      
                      {centreSlots.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">Loading shift quotas...</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {centreSlots.map((slot) => {
                            const slotMax = slot.max_capacity_quintals || Math.round(max / 3);
                            const slotBooked = slot.booked_capacity_quintals || 0;
                            const slotAvail = Math.max(0, slotMax - slotBooked);
                            const currentVal = shiftInputs[slot.slot_code] !== undefined ? shiftInputs[slot.slot_code] : slotMax;
                            const isBelowFloor = isEditingShifts && Number(currentVal) < slotBooked;

                            return (
                              <div key={slot.slot_code} className={`p-4 rounded-xl border transition-all space-y-2 shadow-inner ${
                                isBelowFloor 
                                  ? 'bg-red-50/60 border-red-400 ring-2 ring-red-100' 
                                  : isEditingShifts 
                                    ? 'bg-white border-emerald-300 ring-2 ring-emerald-50' 
                                    : 'bg-gray-50 border-gray-200'
                              }`}>
                                <span className="font-extrabold text-gray-800 text-xs block">{slot.slot_name}</span>
                                
                                {!isEditingShifts ? (
                                  <>
                                    <div className="flex justify-between text-xs">
                                      <span className="text-gray-500">Available:</span>
                                      <span className="font-extrabold text-emerald-700">{slotAvail} Q</span>
                                    </div>
                                    <div className="flex justify-between text-[11px] text-gray-400">
                                      <span>Shift Limit:</span>
                                      <span className="font-bold text-gray-700">{slotMax} Q</span>
                                    </div>
                                    <div className="text-[10px] text-gray-400 pt-1 border-t border-gray-200 flex justify-between">
                                      <span>Booked: {slotBooked} Q</span>
                                    </div>
                                  </>
                                ) : (
                                  <div className="space-y-2 pt-1">
                                    <div>
                                      <div className="flex justify-between items-baseline mb-1">
                                        <label className="text-[10px] font-bold uppercase text-gray-500 block">
                                          Shift Capacity
                                        </label>
                                        <span className={`text-[10px] font-bold ${isBelowFloor ? 'text-red-600 font-extrabold' : 'text-gray-400'}`}>
                                          Min {slotBooked} Q
                                        </span>
                                      </div>
                                      <div className="relative">
                                        <input 
                                          type="number"
                                          min={slotBooked}
                                          value={currentVal}
                                          onChange={(e) => setShiftInputs({ ...shiftInputs, [slot.slot_code]: e.target.value })}
                                          className={`w-full px-3 py-1.5 rounded-lg font-bold text-xs focus:outline-none pr-7 ${
                                            isBelowFloor 
                                              ? 'bg-white border-2 border-red-500 text-red-700 focus:ring-2 focus:ring-red-500' 
                                              : 'bg-gray-50 border border-gray-300 text-gray-800 focus:ring-2 focus:ring-emerald-500'
                                          }`}
                                        />
                                        <span className="absolute right-2.5 top-1.5 text-[11px] font-bold text-gray-400">Q</span>
                                      </div>
                                    </div>
                                    <p className={`text-[10px] ${isBelowFloor ? 'text-red-600 font-bold' : 'text-gray-400'}`}>
                                      {isBelowFloor ? `❌ Cannot be less than ${slotBooked} Q (Booked)` : `Already Booked: ${slotBooked} Q`}
                                    </p>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* 4. FOOTER UTILITY */}
      <div className="pt-4 border-t border-gray-200 flex items-center justify-between text-xs text-gray-400">
        <p>AnnaSetu • Dedicated Mandi Manager Station</p>
        <button 
          onClick={handleResetSeed}
          className="text-gray-500 hover:text-emerald-700 font-semibold underline cursor-pointer"
        >
          ⚡ Reset Demo Test Values
        </button>
      </div>

    </div>
  );
}
