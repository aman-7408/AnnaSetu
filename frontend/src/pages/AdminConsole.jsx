const API_BASE = import.meta.env.VITE_API_URL || "";
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
  const tzOffset = new Date().getTimezoneOffset() * 60000;
  const nowMs = Date.now() - tzOffset;
  const todayLocal = new Date(nowMs).toISOString().split('T')[0];
  const [shiftDate, setShiftDate] = useState(todayLocal);
  const [isEditingShifts, setIsEditingShifts] = useState(false);
  const [shiftInputs, setShiftInputs] = useState({});
  const [isSavingShifts, setIsSavingShifts] = useState(false);

  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  };

  // 7-Day Rolling Procurement Window Options
  const shiftDateOptions = Array.from({ length: 8 }, (_, i) => {
    const d = new Date(nowMs + i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().split('T')[0];
    const label = i === 0 ? `Today (${formatDateDisplay(dateStr)})` : i === 1 ? `Tomorrow (${formatDateDisplay(dateStr)})` : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ` (${formatDateDisplay(dateStr)})`;
    return { dateStr, label };
  });

  // Token Sections & Selection State
  const [tokenTab, setTokenTab] = useState('active'); // 'active' | 'approved' | 'rejected'
  const [selectedTokenId, setSelectedTokenId] = useState(null);
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [rejectModalData, setRejectModalData] = useState(null); // { tokenId, stage, defaultReason }
  const [customRejectReason, setCustomRejectReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

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

  // 2. Fetch Slots for a centre (with dynamic date support)
  const fetchSlots = async (centreId, targetDate = shiftDate) => {
    try {
      const res = await fetch(`${API_BASE}/api/capacity/centres/${centreId}/slots?date=${targetDate}`);
      const data = await res.json();
      if (data.success) {
        setSlotsData(prev => ({ ...prev, [centreId]: data.slots }));
        
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
      fetchSlots(centreId, shiftDate);
    }
  };

  // 3. Manager: Set Daily Capacity for Selected Target Date with Safety Shield
  const handleSetCapacity = async (centreId, targetDate = shiftDate) => {
    const target = centres.find(c => c._id === centreId);
    if (!target) return;

    const rawInput = inputCapacities[centreId];
    if (rawInput === undefined || rawInput === '') {
      showError('Please enter a valid capacity number in Quintals.');
      return;
    }

    const newCap = Number(rawInput);
    const ceiling = target.max_designed_capacity_quintals || 2500;
    
    // Check booked grain for this specific selected date
    const currentSlots = slotsData[centreId] || [];
    const floor = currentSlots.reduce((acc, s) => acc + (s.booked_capacity_quintals || 0), 0);

    if (newCap > ceiling) {
      showError(`❌ Safety Block: Exceeds physical silo ceiling (${ceiling.toLocaleString()} Q) for ${target.name}.`);
      return;
    }
    if (newCap < floor) {
      showError(`❌ Safety Block: Cannot set limit lower than already booked grain (${floor.toLocaleString()} Q) on ${formatDateDisplay(targetDate)}.`);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/capacity/centres/${centreId}/capacity`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ daily_capacity_quintals: newCap, date: targetDate })
      });
      const data = await res.json();
      if (data.success) {
        showFeedback(`✓ Mandi intake limit for ${formatDateDisplay(targetDate)} updated to ${newCap.toLocaleString()} Q!`);
        fetchAllData(false);
        fetchSlots(centreId, targetDate);
        setInputCapacities(prev => ({ ...prev, [centreId]: '' }));
      } else {
        showError(data.error || 'Failed to update capacity');
      }
    } catch (err) {
      console.error('Error updating capacity:', err);
      showError('Failed to communicate with backend.');
    }
  };

  // 4. Manager: Save Custom 3-Hour Shift Quotas for Selected Date
  const handleSaveShiftQuotas = async (centreId, targetDate = shiftDate) => {
    const target = centres.find(c => c._id === centreId);
    if (!target) return;

    const targetSlots = slotsData[centreId] || [];
    const updatedSlotsPayload = targetSlots.map(s => ({
      slot_code: s.slot_code,
      slot_name: s.slot_name,
      max_capacity_quintals: Number(shiftInputs[s.slot_code] || 0)
    }));

    const totalSum = updatedSlotsPayload.reduce((acc, s) => acc + s.max_capacity_quintals, 0);
    const requiredDaily = targetSlots.reduce((acc, s) => acc + (s.max_capacity_quintals || 0), 0) || target.daily_capacity_quintals;

    if (totalSum !== requiredDaily) {
      showError(`❌ Mathematical Mismatch: Shift total (${totalSum} Q) must equal configured daily quota (${requiredDaily} Q) on ${formatDateDisplay(targetDate)}.`);
      return;
    }

    for (const slot of targetSlots) {
      const newCap = Number(shiftInputs[slot.slot_code] || 0);
      const bookedFloor = slot.booked_capacity_quintals || 0;
      if (newCap < bookedFloor) {
        showError(`❌ Safety Block: Cannot set ${slot.slot_name} below booked grain (${bookedFloor} Q).`);
        return;
      }
    }

    setIsSavingShifts(true);
    try {
      const res = await fetch(`${API_BASE}/api/capacity/centres/${centreId}/slots`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slots: updatedSlotsPayload, date: targetDate })
      });
      const data = await res.json();
      if (data.success) {
        showFeedback(`✓ Successfully updated 3-hour shift quotas for ${formatDateDisplay(targetDate)}!`);
        setIsEditingShifts(false);
        fetchSlots(centreId, targetDate);
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
  const handleAdvanceStage = async (tokenId, nextStage, currentProc) => {
    setIsAdvancingStage(true);
    try {
      let stageDetails = {};
      if (nextStage === 2) {
        stageDetails = { gate_pass: `GP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}` };
      } else if (nextStage === 3) {
        const randomMoisture = (10.5 + Math.random() * 1.5).toFixed(1);
        stageDetails = { moisture_percent: Number(randomMoisture), purity_percent: 99.2, grade: 'Grade A FAQ' };
      } else if (nextStage === 4) {
        const w = currentProc?.estimated_weight_quintals || 45.20;
        stageDetails = { net_weight_quintals: w, gunny_bags: Math.round(w * 2) };
      } else if (nextStage === 5) {
        let rate = 2275;
        if (currentProc?.crop_type?.includes('Paddy')) rate = 2300;
        else if (currentProc?.crop_type?.includes('Mustard')) rate = 5650;
        else if (currentProc?.crop_type?.includes('Maize')) rate = 2090;
        stageDetails = { msp_rate: rate, j_form_number: `JF-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}` };
      }

      const res = await fetch(`${API_BASE}/api/capacity/procurements/advance-stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token_id: tokenId, target_stage: nextStage, details: stageDetails })
      });
      const data = await res.json();
      if (data.success) {
        showFeedback(`✓ Approved Stage ${nextStage}! Updated live across all official portals.`);
        fetchAllData(false);
      }
    } catch (err) {
      console.error('Error advancing stage:', err);
      showError('Failed to advance procurement stage.');
    } finally {
      setIsAdvancingStage(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectModalData) return;
    setIsRejecting(true);
    try {
      const res = await fetch(`${API_BASE}/api/capacity/procurements/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token_id: rejectModalData.tokenId,
          stage: rejectModalData.stage,
          reason: customRejectReason || rejectModalData.defaultReason,
          officer_name: userSession?.name || 'Mandi Inspection Officer'
        })
      });
      const data = await res.json();
      if (data.success) {
        showFeedback(`🚫 Consignment #${rejectModalData.tokenId} REJECTED & Alert Dispatched to Farmer!`);
        setRejectModalData(null);
        setCustomRejectReason('');
        fetchAllData(true);
      } else {
        showError(data.error || 'Failed to reject consignment');
      }
    } catch (err) {
      showError('Network error while rejecting consignment.');
    } finally {
      setIsRejecting(false);
    }
  };

  const showFeedback = (msg) => {
    setActionMessage(msg);
    setErrorMessage('');
    setTimeout(() => setActionMessage(''), 4500);
  };

  const showError = (msg) => {
    setErrorMessage(msg);
    setActionMessage('');
    setTimeout(() => setErrorMessage(''), 5000);
  };

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(() => {
      fetchAllData(false);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Filter Tokens strictly for the logged-in Mandi Manager's assigned facility
  const assignedFacilityName = userSession?.centreName;
  const facilityProcurements = procurements.filter(p => 
    !assignedFacilityName || p.centre_name === assignedFacilityName
  );

  // Filter Tokens into 3 Distinct Sections for this Facility
  const activeTokens = facilityProcurements.filter(p => p.status !== 'rejected' && p.current_stage < 5);
  const approvedTokens = facilityProcurements.filter(p => p.status !== 'rejected' && p.current_stage === 5);
  const rejectedTokens = facilityProcurements.filter(p => p.status === 'rejected');

  // Active Token being processed (strictly real active tokens belonging to this facility)
  const currentActiveProcurement = facilityProcurements.find(p => p.token_id === selectedTokenId && p.status !== 'rejected' && p.current_stage < 5) || activeTokens[0] || null;

  // Unauthorized Barrier
  if (!userSession) {
    return (
      <div className="py-16 px-4 max-w-md mx-auto text-center space-y-6 animate-fade-in">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-3xl shadow-inner border-2 border-emerald-300">
          🔒
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-gray-900">Official Access Restricted</h2>
          <p className="text-xs text-gray-600 font-medium">
            This terminal is strictly reserved for authorized Mandi Managers & Procurement Officers.
          </p>
        </div>
        <button
          onClick={onOpenLogin}
          className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold py-3.5 px-6 rounded-xl shadow-lg transition-transform active:scale-95 text-sm cursor-pointer"
        >
          🔑 Open Manager Login Terminal
        </button>
      </div>
    );
  }

  // Find manager centre
  const managerCentre = centres.find(
    c => c.name.toLowerCase().includes(userSession?.state?.toLowerCase() || '') || c.name === userSession?.centreName
  ) || centres[0];

  useEffect(() => {
    if (managerCentre?._id) {
      fetchSlots(managerCentre._id, shiftDate);
    }
  }, [managerCentre?._id, shiftDate]);

  const centreSlots = managerCentre ? (slotsData[managerCentre._id] || []) : [];

  // Calculation of shift quotas
  const currentTotalAllocated = Object.values(shiftInputs).reduce((acc, val) => acc + (Number(val) || 0), 0);
  const targetDateCapacity = centreSlots.reduce((acc, s) => acc + (s.max_capacity_quintals || 0), 0) || managerCentre?.daily_capacity_quintals || 1200;
  const allocationDiff = currentTotalAllocated - targetDateCapacity;
  const isShiftQuotaBalanced = allocationDiff === 0;

  const floorViolationSlot = centreSlots.find(slot => {
    const val = Number(shiftInputs[slot.slot_code] !== undefined ? shiftInputs[slot.slot_code] : slot.max_capacity_quintals);
    return val < (slot.booked_capacity_quintals || 0);
  });
  const hasFloorViolation = !!floorViolationSlot;
  const isShiftQuotaValid = isShiftQuotaBalanced && !hasFloorViolation;

  // Manager Voucher Modal
  const renderVoucherModal = () => {
    if (!selectedVoucher) return null;

    const gross = selectedVoucher.gross_payout || 102830;
    const weight = selectedVoucher.net_weight_quintals || 45.20;
    const rate = selectedVoucher.msp_rate || 2275;
    const bags = selectedVoucher.gunny_bags || Math.round(weight * 2);

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
        <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border-t-8 border-emerald-600 relative">
          <button 
            onClick={() => setSelectedVoucher(null)}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl font-bold p-1 cursor-pointer"
          >
            ✕
          </button>

          <div className="p-6 bg-emerald-50/60 border-b border-gray-100 flex items-center gap-4">
            <div className="w-14 h-14 bg-white rounded-full border-2 border-emerald-400 flex items-center justify-center shadow-md p-1 shrink-0">
              <img src="/logo.png" alt="AnnaSetu Emblem" className="w-full h-full object-cover rounded-full" />
            </div>
            <div>
              <span className="text-3xs font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                Mandi Manager Treasury Record
              </span>
              <h2 className="text-xl font-black text-gray-900 mt-1">Official J-Form Settlement Voucher</h2>
              <p className="text-xs text-gray-500 font-mono">Token: {selectedVoucher.token_id}</p>
            </div>
          </div>

          <div className="p-6 space-y-4 text-xs text-gray-800">
            <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3.5 rounded-xl border border-gray-200">
              <div>
                <span className="text-gray-400 font-semibold block text-3xs uppercase">Beneficiary Kisan</span>
                <span className="font-extrabold text-gray-900 text-sm">{selectedVoucher.farmer_name}</span>
                <span className="text-gray-500 block text-3xs font-mono mt-0.5">{selectedVoucher.farmer_phone}</span>
              </div>
              <div>
                <span className="text-gray-400 font-semibold block text-3xs uppercase">J-Form Reference</span>
                <span className="font-extrabold text-emerald-800 text-sm font-mono">{selectedVoucher.j_form_number || 'N/A'}</span>
                <span className="text-gray-500 block text-3xs font-mono mt-0.5">Gate Pass: {selectedVoucher.gate_pass || 'N/A'}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                <span className="text-3xs text-emerald-800 font-bold uppercase block">Net Weight</span>
                <span className="text-base font-black text-emerald-950">{weight} Qtl</span>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <span className="text-3xs text-blue-800 font-bold uppercase block">Govt MSP Rate</span>
                <span className="text-base font-black text-blue-950">₹{rate} /Q</span>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                <span className="text-3xs text-purple-800 font-bold uppercase block">Gunny Bags</span>
                <span className="text-base font-black text-purple-950">{bags} Bags</span>
              </div>
            </div>

            <div className="bg-emerald-600 text-white p-4 rounded-xl text-center shadow-md">
              <span className="text-3xs font-extrabold uppercase tracking-widest text-emerald-200 block mb-1">
                Approved Gross DBT Payout
              </span>
              <span className="text-3xl font-black">₹{gross.toLocaleString('en-IN')}</span>
              <div className="mt-2 text-2xs font-bold text-emerald-100 flex items-center justify-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse"></span>
                <span>STATUS: J-FORM APPROVED (DISBURSED VIA PFMS)</span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => setSelectedVoucher(null)}
                className="w-1/3 bg-gray-100 text-gray-700 font-bold py-2.5 rounded-lg hover:bg-gray-200 transition-colors text-xs cursor-pointer"
              >
                Close
              </button>
              <button 
                onClick={() => window.print()}
                className="w-2/3 bg-emerald-600 text-white font-bold py-2.5 rounded-lg hover:bg-emerald-700 transition-colors shadow-md text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>🖨️</span> Print Voucher Copy
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Rejection Dialog Modal
  const renderRejectionModal = () => {
    if (!rejectModalData) return null;

    const stageTitle = rejectModalData.stage === 3 ? 'Stage 3: Quality Lab Assaying' : 'Stage 4: Weighbridge Measurement';

    const quickReasons = rejectModalData.stage === 3 ? [
      'Moisture content exceeds maximum allowable limit (12% Max FAQ)',
      'Foreign matter & inorganic debris exceeds 2.0% tolerance',
      'Severe grain discoloration / fungus infestation detected',
      'Admixture with substandard non-procurement grain'
    ] : [
      'Gross tare vehicle weight mismatch exceeds allowable tolerance',
      'Damaged / substandard packaging bags (Non-BIS jute bags)',
      'Suspected weight discrepancy on double-beam scale check'
    ];

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border-t-8 border-red-600 relative">
          <button 
            onClick={() => setRejectModalData(null)}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl font-bold p-1 cursor-pointer"
          >
            ✕
          </button>

          <div className="p-6 bg-red-50/60 border-b border-gray-100 flex items-center gap-3">
            <div className="w-12 h-12 bg-red-100 rounded-full border-2 border-red-300 flex items-center justify-center text-2xl shadow-inner shrink-0 text-red-600">
              🚫
            </div>
            <div>
              <span className="text-3xs font-extrabold uppercase tracking-wider text-red-800 bg-red-100 px-2 py-0.5 rounded">
                Official Rejection Action
              </span>
              <h3 className="text-lg font-black text-gray-900 mt-0.5">Reject Consignment</h3>
              <p className="text-xs text-gray-500 font-mono">Token: {rejectModalData.tokenId}</p>
            </div>
          </div>

          <div className="p-6 space-y-4 text-xs text-gray-800">
            <div>
              <span className="text-gray-400 font-bold block text-3xs uppercase mb-1">Rejection Point</span>
              <span className="font-extrabold text-red-900 text-sm">{stageTitle}</span>
            </div>

            <div>
              <span className="text-gray-500 font-bold block text-3xs uppercase mb-1.5">Select Mandi Rejection Code / Reason:</span>
              <div className="space-y-1.5 mb-3">
                {quickReasons.map((r, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setCustomRejectReason(r)}
                    className={`w-full text-left p-2.5 rounded-lg border text-xs font-medium transition cursor-pointer ${
                      (customRejectReason || rejectModalData.defaultReason) === r
                        ? 'bg-red-50 border-red-400 text-red-950 font-bold shadow-xs'
                        : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    • {r}
                  </button>
                ))}
              </div>

              <label className="block text-3xs font-bold text-gray-500 uppercase mb-1">Or Enter Custom Inspection Remark:</label>
              <textarea
                value={customRejectReason}
                onChange={(e) => setCustomRejectReason(e.target.value)}
                placeholder="Enter specific officer observation..."
                className="w-full border border-gray-300 rounded-lg p-2.5 text-xs text-gray-900 focus:outline-none focus:border-red-500 font-medium"
                rows={2}
              />
            </div>

            <div className="bg-red-50 border border-red-200 p-3 rounded-xl text-2xs text-red-900 space-y-1">
              <p className="font-bold flex items-center gap-1">
                <span>⚠️</span> Action is Irreversible:
              </p>
              <p>An instant alert will be dispatched to the farmer's registered phone and notification feed. The consignment will be closed.</p>
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => setRejectModalData(null)}
                disabled={isRejecting}
                className="w-1/3 bg-gray-100 text-gray-700 font-bold py-2.5 rounded-lg hover:bg-gray-200 transition-colors text-xs cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmReject}
                disabled={isRejecting}
                className="w-2/3 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-lg transition-colors shadow-md text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span>🚫</span> {isRejecting ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="py-4 px-3 sm:py-8 sm:px-6 max-w-6xl mx-auto animate-fade-in-up space-y-4 sm:space-y-6">
      {renderVoucherModal()}
      {renderRejectionModal()}
      
      {/* 1. TOP MANAGER HEADER BAR */}
      <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-6 border-l-4 border-emerald-600 flex flex-col md:flex-row md:items-center justify-between gap-4">
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
            <span>Auto-Sync: <strong className="text-emerald-700">5s</strong></span>
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

      {/* 2. DEDICATED TOKEN MANAGEMENT TABS & WORKFLOW */}
      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-md border border-gray-200 space-y-6">
        
        {/* Section Header & Tab Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div>
            <span className="text-3xs font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-md">
              Procurement Token Control Center
            </span>
            <h3 className="text-2xl font-black text-gray-900 mt-1">Mandi Consignment Registry</h3>
          </div>

          {/* 3-Section Tab Switcher */}
          <div className="flex p-1.5 bg-gray-100 rounded-2xl shrink-0 gap-1 flex-wrap">
            <button
              onClick={() => setTokenTab('active')}
              className={`px-4 py-2 sm:px-5 sm:py-2.5 text-xs font-extrabold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                tokenTab === 'active'
                  ? 'bg-emerald-700 text-white shadow-md scale-102'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
              }`}
            >
              <span>🚛</span>
              <span>1. Active ({activeTokens.length})</span>
            </button>

            <button
              onClick={() => setTokenTab('approved')}
              className={`px-4 py-2 sm:px-5 sm:py-2.5 text-xs font-extrabold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                tokenTab === 'approved'
                  ? 'bg-emerald-700 text-white shadow-md scale-102'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
              }`}
            >
              <span>💳</span>
              <span>2. Approved ({approvedTokens.length})</span>
            </button>

            <button
              onClick={() => setTokenTab('rejected')}
              className={`px-4 py-2 sm:px-5 sm:py-2.5 text-xs font-extrabold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                tokenTab === 'rejected'
                  ? 'bg-red-700 text-white shadow-md scale-102'
                  : 'text-gray-600 hover:text-red-700 hover:bg-red-50'
              }`}
            >
              <span>🚫</span>
              <span>3. Rejected ({rejectedTokens.length})</span>
            </button>
          </div>
        </div>

        {/* SECTION 1: ACTIVE TOKENS PIPELINE */}
        {tokenTab === 'active' && (
          <div className="space-y-6 animate-fade-in">
            
            {/* Active Tokens List / Selector */}
            {activeTokens.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Select a token from the queue to process through intake stations:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {activeTokens.map((p) => {
                    const isSelected = p.token_id === currentActiveProcurement?.token_id;
                    return (
                      <div
                        key={p.token_id}
                        onClick={() => setSelectedTokenId(p.token_id)}
                        className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-emerald-50/70 border-emerald-600 shadow-md ring-2 ring-emerald-100'
                            : 'bg-gray-50 border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/30'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <span className="font-mono font-black text-emerald-900 text-xs">{p.token_id}</span>
                          <span className="bg-amber-100 text-amber-900 text-3xs font-extrabold px-2 py-0.5 rounded-full uppercase">
                            Stage {p.current_stage} / 5
                          </span>
                        </div>
                        <p className="font-extrabold text-gray-900 text-sm mt-1">{p.farmer_name}</p>
                        <p className="text-3xs text-gray-500 font-medium">{p.crop_type} • {p.estimated_weight_quintals || 45.2} Qtl</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-8 bg-gray-50 rounded-2xl border border-gray-200 text-center space-y-2">
                <span className="text-3xl block">🌾</span>
                <h4 className="font-extrabold text-gray-800 text-sm">No Active Consignments in Mandi Queue</h4>
                <p className="text-xs text-gray-500">When farmers book slots at this terminal, their active tokens will appear here for live intake.</p>
              </div>
            )}

            {/* Selected Active Token Processing Card */}
            {currentActiveProcurement && (
              <div className="bg-gradient-to-br from-emerald-900 via-emerald-800 to-slate-900 text-white rounded-3xl p-6 shadow-xl border border-emerald-700 relative overflow-hidden">
                <div className="relative z-10 space-y-6">
                  
                  {/* Card Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-700/60 pb-4">
                    <div>
                      <span className="bg-emerald-700/80 px-2.5 py-0.5 rounded-full text-3xs font-black uppercase tracking-wider text-emerald-200 border border-emerald-500/40">
                        Live Consignment In-Process
                      </span>
                      <h3 className="text-2xl font-black font-mono text-emerald-300 mt-1">
                        {currentActiveProcurement.token_id}
                      </h3>
                    </div>

                    <div className="text-left sm:text-right">
                      <span className="text-xs text-emerald-200 block font-medium">Farmer Contact</span>
                      <span className="font-bold text-white text-sm">{currentActiveProcurement.farmer_phone}</span>
                    </div>
                  </div>

                  {/* Active Farmer Delivery Info */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-emerald-950/60 p-4 rounded-2xl border border-emerald-800/60 text-xs">
                    <div>
                      <p className="text-emerald-400 font-bold uppercase text-3xs">Farmer Name</p>
                      <p className="font-extrabold text-white text-sm">{currentActiveProcurement.farmer_name}</p>
                    </div>
                    <div>
                      <p className="text-emerald-400 font-bold uppercase text-3xs">Crop Allotment</p>
                      <p className="font-bold text-white">{currentActiveProcurement.crop_type}</p>
                    </div>
                    <div>
                      <p className="text-emerald-400 font-bold uppercase text-3xs">Arrival Mandi</p>
                      <p className="font-bold text-white">{currentActiveProcurement.centre_name}</p>
                    </div>
                    <div>
                      <p className="text-emerald-400 font-bold uppercase text-3xs">Current Live Stage</p>
                      <p className="font-extrabold text-yellow-300 text-sm">
                        Stage {currentActiveProcurement.current_stage} / 5
                      </p>
                    </div>
                  </div>

                  {/* Interactive 5-Stage Step Approval Station */}
                  <div className="space-y-4">
                    <p className="text-xs font-bold text-emerald-200 uppercase tracking-wider">
                      Click to advance physical intake stations (Triggers live SMS & Portal sync):
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                      
                      {/* STAGE 1: Token Active */}
                      <div className={`p-4 rounded-2xl border transition-all ${
                        currentActiveProcurement.current_stage >= 1 
                          ? 'bg-emerald-800/80 border-emerald-400 text-white shadow-md' 
                          : 'bg-emerald-950/40 border-emerald-800/50 text-emerald-400/60'
                      }`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-2xs font-extrabold uppercase tracking-wider text-emerald-300">Station 1</span>
                          <span className="text-xs">✓</span>
                        </div>
                        <h4 className="font-bold text-sm">Digital Gate Pass</h4>
                        <p className="text-3xs text-emerald-200/80 mt-1">Token Generated</p>
                      </div>

                      {/* STAGE 2: Gate Security Entry */}
                      <div className={`p-4 rounded-2xl border transition-all ${
                        currentActiveProcurement.current_stage >= 2 
                          ? 'bg-emerald-800/80 border-emerald-400 text-white shadow-md' 
                          : 'bg-emerald-950/40 border-emerald-800/50 text-emerald-400/60'
                      }`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-2xs font-extrabold uppercase tracking-wider text-emerald-300">Station 2</span>
                          {currentActiveProcurement.current_stage >= 2 && <span className="text-xs">✓</span>}
                        </div>
                        <h4 className="font-bold text-sm">Gate-In Verified</h4>
                        <p className="text-3xs text-emerald-200/80 mt-1">Verified Gate Pass</p>

                        {currentActiveProcurement.current_stage === 1 && (
                          <button 
                            onClick={() => handleAdvanceStage(currentActiveProcurement.token_id, 2, currentActiveProcurement)}
                            disabled={isAdvancingStage}
                            className="mt-3 w-full bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-extrabold py-1.5 rounded-lg text-2xs transition shadow-sm cursor-pointer"
                          >
                            {isAdvancingStage ? '...' : '▶ Approve Gate In'}
                          </button>
                        )}
                      </div>

                      {/* STAGE 3: Lab Moisture & Quality */}
                      <div className={`p-4 rounded-2xl border transition-all ${
                        currentActiveProcurement.current_stage >= 3 
                          ? 'bg-emerald-800/80 border-emerald-400 text-white shadow-md' 
                          : 'bg-emerald-950/40 border-emerald-800/50 text-emerald-400/60'
                      }`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-2xs font-extrabold uppercase tracking-wider text-emerald-300">Station 3</span>
                          {currentActiveProcurement.current_stage >= 3 && <span className="text-xs">✓</span>}
                        </div>
                        <h4 className="font-bold text-sm">Quality Assaying</h4>
                        <p className="text-3xs text-emerald-200/80 mt-1">{currentActiveProcurement.moisture_percent || 'N/A'}% Moisture • {currentActiveProcurement.grade || 'N/A'}</p>

                        {currentActiveProcurement.current_stage === 2 && (
                          <div className="mt-3 flex gap-1.5">
                            <button 
                              onClick={() => handleAdvanceStage(currentActiveProcurement.token_id, 3, currentActiveProcurement)}
                              disabled={isAdvancingStage}
                              className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-extrabold py-1.5 rounded-lg text-2xs transition shadow-sm cursor-pointer"
                            >
                              {isAdvancingStage ? '...' : '▶ Pass Lab'}
                            </button>
                            <button 
                              onClick={() => setRejectModalData({
                                tokenId: currentActiveProcurement.token_id,
                                stage: 3,
                                defaultReason: 'Moisture content exceeds maximum allowable limit (12% Max FAQ)'
                              })}
                              disabled={isAdvancingStage}
                              className="bg-red-500/80 hover:bg-red-600 text-white font-extrabold px-2 py-1.5 rounded-lg text-2xs transition shadow-sm cursor-pointer"
                              title="Reject at Stage 3"
                            >
                              🚫 Reject
                            </button>
                          </div>
                        )}
                      </div>

                      {/* STAGE 4: Weighbridge Net Weight */}
                      <div className={`p-4 rounded-2xl border transition-all ${
                        currentActiveProcurement.current_stage >= 4 
                          ? 'bg-emerald-800/80 border-emerald-400 text-white shadow-md' 
                          : 'bg-emerald-950/40 border-emerald-800/50 text-emerald-400/60'
                      }`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-2xs font-extrabold uppercase tracking-wider text-emerald-300">Station 4</span>
                          {currentActiveProcurement.current_stage >= 4 && <span className="text-xs">✓</span>}
                        </div>
                        <h4 className="font-bold text-sm">Weighbridge</h4>
                        <p className="text-3xs text-emerald-200/80 mt-1">Net Weight & 50kg Bags</p>

                        {currentActiveProcurement.current_stage === 3 && (
                          <div className="mt-3 flex gap-1.5">
                            <button 
                              onClick={() => handleAdvanceStage(currentActiveProcurement.token_id, 4, currentActiveProcurement)}
                              disabled={isAdvancingStage}
                              className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-extrabold py-1.5 rounded-lg text-2xs transition shadow-sm cursor-pointer"
                            >
                              {isAdvancingStage ? '...' : '▶ Log Weight'}
                            </button>
                            <button 
                              onClick={() => setRejectModalData({
                                tokenId: currentActiveProcurement.token_id,
                                stage: 4,
                                defaultReason: 'Net grain weight mismatch exceeds standard tolerance threshold'
                              })}
                              disabled={isAdvancingStage}
                              className="bg-red-500/80 hover:bg-red-600 text-white font-extrabold px-2 py-1.5 rounded-lg text-2xs transition shadow-sm cursor-pointer"
                              title="Reject at Stage 4"
                            >
                              🚫 Reject
                            </button>
                          </div>
                        )}
                      </div>

                      {/* STAGE 5: J-Form Approved */}
                      <div className={`p-4 rounded-2xl border transition-all ${
                        currentActiveProcurement.current_stage >= 5 
                          ? 'bg-emerald-800/80 border-emerald-400 text-white shadow-md' 
                          : 'bg-emerald-950/40 border-emerald-800/50 text-emerald-400/60'
                      }`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-2xs font-extrabold uppercase tracking-wider text-emerald-300">Station 5</span>
                          {currentActiveProcurement.current_stage >= 5 && <span className="text-xs">✓</span>}
                        </div>
                        <h4 className="font-bold text-sm">J-Form Approved</h4>
                        <p className="text-3xs text-emerald-200/80 mt-1">DBT Payout Disbursed</p>

                        {currentActiveProcurement.current_stage === 4 && (
                          <button 
                            onClick={() => handleAdvanceStage(currentActiveProcurement.token_id, 5, currentActiveProcurement)}
                            disabled={isAdvancingStage}
                            className="mt-3 w-full bg-emerald-400 hover:bg-emerald-300 text-emerald-950 font-extrabold py-1.5 rounded-lg text-2xs transition shadow-sm cursor-pointer animate-pulse"
                          >
                            {isAdvancingStage ? '...' : '▶ Approve & Disburse'}
                          </button>
                        )}
                      </div>

                    </div>
                  </div>

                </div>
              </div>
            )}

          </div>
        )}

        {/* SECTION 2: TOKENS APPROVED FOR PAYMENTS */}
        {tokenTab === 'approved' && (
          <div className="space-y-4 animate-fade-in">
            {approvedTokens.length === 0 ? (
              <div className="p-12 bg-gray-50 rounded-2xl border border-gray-200 text-center space-y-3">
                <span className="text-4xl block">💳</span>
                <h4 className="font-extrabold text-gray-900 text-base">No Completed Settlements Yet</h4>
                <p className="text-xs text-gray-500 max-w-md mx-auto">
                  Once active tokens reach Station 5 (J-Form Approved), they will automatically move here with full gross payout and printable payment vouchers.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-500 uppercase font-bold text-3xs border-b border-gray-200">
                    <tr>
                      <th className="py-3.5 px-4">Token & J-Form</th>
                      <th className="py-3.5 px-4">Farmer Beneficiary</th>
                      <th className="py-3.5 px-4">Crop & Evaluated Load</th>
                      <th className="py-3.5 px-4">Gross Disbursed Payout</th>
                      <th className="py-3.5 px-4">Disbursal Status</th>
                      <th className="py-3.5 px-4 text-right">Official Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {approvedTokens.map((p) => (
                      <tr key={p.token_id} className="hover:bg-emerald-50/40 transition-colors">
                        <td className="py-3.5 px-4">
                          <span className="font-mono font-bold text-gray-900 block">{p.token_id}</span>
                          <span className="text-3xs text-emerald-800 font-mono font-bold">{p.j_form_number || 'N/A'}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-extrabold text-gray-900 block">{p.farmer_name}</span>
                          <span className="text-3xs text-gray-400 font-mono">{p.farmer_phone}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="text-gray-900 block">{p.crop_type}</span>
                          <span className="text-3xs text-gray-500 font-bold">{p.net_weight_quintals || 'N/A'} Qtl ({p.gunny_bags || 'N/A'} Bags)</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="text-base font-black text-emerald-800">
                            ₹{(p.gross_payout || 0).toLocaleString('en-IN')}
                          </span>
                          <span className="text-3xs text-gray-400 block font-mono">MSP @ ₹{p.msp_rate || 'N/A'}/Q</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-emerald-900 rounded-full font-bold text-3xs uppercase">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <span>DBT Disbursed</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => setSelectedVoucher(p)}
                            className="bg-emerald-700 hover:bg-emerald-800 text-white px-3.5 py-1.5 rounded-xl font-bold text-3xs shadow-sm transition-all cursor-pointer inline-flex items-center gap-1"
                          >
                            <span>📄</span> Voucher
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* SECTION 3: REJECTED TOKENS (INSPECTION AUDIT LOG) */}
        {tokenTab === 'rejected' && (
          <div className="space-y-4 animate-fade-in">
            {rejectedTokens.length === 0 ? (
              <div className="p-12 bg-gray-50 rounded-2xl border border-gray-200 text-center space-y-3">
                <span className="text-4xl block">✅</span>
                <h4 className="font-extrabold text-gray-900 text-base">No Rejected Consignments</h4>
                <p className="text-xs text-gray-500 max-w-md mx-auto">
                  All grain consignments processed through this facility have satisfied standard FAQ quality and weighbridge tolerances.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-red-50/70 text-red-950 uppercase font-bold text-3xs border-b border-red-200">
                    <tr>
                      <th className="py-3.5 px-4">Token & Gate Pass</th>
                      <th className="py-3.5 px-4">Farmer Details</th>
                      <th className="py-3.5 px-4">Crop & Est. Load</th>
                      <th className="py-3.5 px-4">Rejection Point</th>
                      <th className="py-3.5 px-4">Official Reason & Officer</th>
                      <th className="py-3.5 px-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {rejectedTokens.map((p) => (
                      <tr key={p.token_id} className="hover:bg-red-50/30 transition-colors">
                        <td className="py-3.5 px-4">
                          <span className="font-mono font-bold text-red-900 block">{p.token_id}</span>
                          <span className="text-3xs text-gray-500 font-mono font-semibold">Pass: {p.gate_pass || 'N/A'}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-extrabold text-gray-900 block">{p.farmer_name}</span>
                          <span className="text-3xs text-gray-400 font-mono">{p.farmer_phone}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="text-gray-900 block">{p.crop_type}</span>
                          <span className="text-3xs text-gray-500 font-bold">{p.estimated_weight_quintals || 45} Qtl</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-900 rounded-full font-extrabold text-3xs uppercase">
                            <span>Station {p.rejection_stage || 3}:</span>
                            <span>{p.rejection_stage === 4 ? 'Weighbridge' : 'Quality Lab'}</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-4 max-w-xs">
                          <span className="text-red-950 font-bold text-xs block leading-tight">{p.rejection_reason || 'Standards not met'}</span>
                          <span className="text-3xs text-gray-400 block mt-0.5 font-mono">
                            By {p.rejected_by || 'Quality Officer'} &bull; {p.rejected_at ? new Date(p.rejected_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Logged'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <span className="bg-red-600 text-white px-2.5 py-1 rounded-md text-3xs font-black uppercase tracking-wider shadow-2xs">
                            Terminated
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>

      {/* 3. MANDI STORAGE CAPACITY & QUOTA MANAGEMENT */}
      {managerCentre && (
        <div className="bg-white rounded-3xl shadow-md p-6 md:p-8 border border-gray-200 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-4">
            <div>
              <span className="text-3xs font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-md">
                Warehouse Telemetry & Quota Allocation
              </span>
              <h3 className="text-xl font-black text-gray-900 mt-1">Live Mandi Capacity Console</h3>
            </div>
            
            <span className="text-xs text-gray-400 font-medium">
              Last Synced: <strong className="text-gray-700 font-mono">{lastSyncedTime}</strong>
            </span>
          </div>

          <div className="space-y-4">
            {(() => {
              const currentSlots = slotsData[managerCentre._id] || [];
              const dateBooked = currentSlots.reduce((acc, s) => acc + (s.booked_capacity_quintals || 0), 0);
              const dateMax = currentSlots.length > 0 
                ? currentSlots.reduce((acc, s) => acc + (s.max_capacity_quintals || 0), 0)
                : (managerCentre.daily_capacity_quintals || 1000);
              const maxCeiling = managerCentre.max_designed_capacity_quintals || 2500;
              const dateAvail = Math.max(0, dateMax - dateBooked);
              const percent = Math.min(100, Math.round((dateBooked / dateMax) * 100));
              const isExpanded = expandedCentreId === managerCentre._id;

              return (
                <div key={managerCentre._id} className="space-y-6">
                  
                  {/* UPFRONT TARGET DATE PICKER BAR */}
                  <div className="bg-emerald-950 text-white p-4 sm:p-5 rounded-2xl border border-emerald-700 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <span className="text-3xs font-extrabold uppercase tracking-widest text-emerald-300 bg-emerald-800/80 px-2.5 py-0.5 rounded-full border border-emerald-600/40">
                        Target Date Quota Configuration
                      </span>
                      <h4 className="text-lg font-black text-white mt-1 flex items-center gap-2">
                        <span>📅</span> Quota Schedule for {formatDateDisplay(shiftDate)}
                      </h4>
                      <p className="text-xs text-emerald-200/80 mt-0.5">
                        Select any date to inspect booked trucks and set customized intake capacity limits.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* 1-Tap Quick Date Pills */}
                      <button
                        type="button"
                        onClick={() => {
                          const d = todayLocal;
                          setShiftDate(d);
                          fetchSlots(managerCentre._id, d);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                          shiftDate === todayLocal
                            ? 'bg-emerald-400 text-emerald-950 shadow-md scale-102 font-black'
                            : 'bg-emerald-900/80 text-emerald-200 hover:bg-emerald-800 border border-emerald-700'
                        }`}
                      >
                        ⚡ Today
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date(nowMs + 86400000).toISOString().split('T')[0];
                          setShiftDate(d);
                          fetchSlots(managerCentre._id, d);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                          shiftDate === new Date(nowMs + 86400000).toISOString().split('T')[0]
                            ? 'bg-emerald-400 text-emerald-950 shadow-md scale-102 font-black'
                            : 'bg-emerald-900/80 text-emerald-200 hover:bg-emerald-800 border border-emerald-700'
                        }`}
                      >
                        📅 Tomorrow
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date(nowMs + 2 * 86400000).toISOString().split('T')[0];
                          setShiftDate(d);
                          fetchSlots(managerCentre._id, d);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                          shiftDate === new Date(nowMs + 2 * 86400000).toISOString().split('T')[0]
                            ? 'bg-emerald-400 text-emerald-950 shadow-md scale-102 font-black'
                            : 'bg-emerald-900/80 text-emerald-200 hover:bg-emerald-800 border border-emerald-700'
                        }`}
                      >
                        📆 In 2 Days
                      </button>

                      {/* Calendar Date Picker */}
                      <input
                        type="date"
                        min={todayLocal}
                        value={shiftDate}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val) {
                            setShiftDate(val);
                            fetchSlots(managerCentre._id, val);
                          }
                        }}
                        className="bg-white text-gray-900 font-extrabold px-3 py-1.5 rounded-xl text-xs border border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-400 cursor-pointer shadow-sm"
                      />
                    </div>
                  </div>

                  {/* Metric Cards For Selected Date */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200">
                      <span className="text-gray-400 font-semibold block text-3xs uppercase">Facility</span>
                      <span className="font-extrabold text-gray-900 text-sm truncate block mt-0.5">{managerCentre.name}</span>
                    </div>

                    <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200">
                      <span className="text-emerald-700 font-semibold block text-3xs uppercase">Available on {formatDateDisplay(shiftDate)}</span>
                      <span className="text-lg font-black text-emerald-950 block mt-0.5">{dateAvail.toLocaleString()} Q</span>
                    </div>

                    <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200">
                      <span className="text-gray-400 font-semibold block text-3xs uppercase">Booked on {formatDateDisplay(shiftDate)}</span>
                      <span className="text-lg font-black text-gray-900 block mt-0.5">{dateBooked.toLocaleString()} Q</span>
                    </div>

                    <div className="p-3.5 bg-emerald-100/60 rounded-2xl border border-emerald-300">
                      <span className="text-emerald-900 font-bold block text-3xs uppercase">Daily Limit ({formatDateDisplay(shiftDate)})</span>
                      <span className="text-lg font-black text-emerald-950 block mt-0.5">{dateMax.toLocaleString()} Q</span>
                    </div>
                  </div>

                  {/* Progress Bar for Selected Date */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-2xs font-extrabold">
                      <span className="text-gray-500">Utilization on {formatDateDisplay(shiftDate)}:</span>
                      <span className={percent >= 85 ? 'text-red-600' : 'text-emerald-700'}>{percent}% Capacity Booked ({dateBooked} Q / {dateMax} Q)</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3.5 overflow-hidden p-0.5 border border-gray-200 shadow-inner">
                      <div 
                        className={`h-full rounded-full transition-all duration-700 ${
                          percent >= 85 ? 'bg-red-500' : percent >= 60 ? 'bg-amber-500' : 'bg-emerald-600'
                        }`}
                        style={{ width: `${Math.max(0, percent)}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Controls Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    
                    {/* Manual Quota Modifier for Selected Date */}
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 shadow-inner space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-extrabold text-gray-700">
                          Set Daily Limit for {formatDateDisplay(shiftDate)}:
                        </span>
                        <span className="text-3xs text-gray-400 font-mono">Max Silo: {maxCeiling} Q</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <input 
                            type="number"
                            placeholder={dateMax.toString()}
                            value={inputCapacities[managerCentre._id] !== undefined ? inputCapacities[managerCentre._id] : ''}
                            onChange={(e) => setInputCapacities({ ...inputCapacities, [managerCentre._id]: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg font-bold text-gray-800 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none pr-8"
                          />
                          <span className="absolute right-3 top-2 text-xs font-bold text-gray-400">Q</span>
                        </div>

                        <button 
                          onClick={() => handleSetCapacity(managerCentre._id, shiftDate)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-lg text-xs shadow-sm transition-all active:scale-95 cursor-pointer whitespace-nowrap"
                        >
                          Set Limit for {formatDateDisplay(shiftDate)}
                        </button>
                      </div>

                      <p className="text-3xs text-gray-400 font-medium">
                        Allowed on {formatDateDisplay(shiftDate)}: <strong className="text-gray-600">{dateBooked} Q</strong> (Booked) – <strong className="text-emerald-700">{maxCeiling} Q</strong> (Silo Ceiling)
                      </p>
                    </div>

                    {/* Diversion & Shifts Action */}
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 shadow-inner flex flex-col justify-between gap-3">
                      <div>
                        <span className="font-extrabold text-gray-700 text-xs block mb-1">Shift Breakdown ({formatDateDisplay(shiftDate)}):</span>
                        <p className="text-2xs text-gray-500">
                          Fine-tune individual 3-hour shift allocations for {formatDateDisplay(shiftDate)} or divert traffic.
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
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-wrap">
                        <div>
                          <p className="text-xs font-extrabold text-gray-800 uppercase tracking-wider">
                            Daily Shift Quota Breakdown (3 Hours Each)
                          </p>
                          <p className="text-2xs text-gray-500">
                            Allocate custom storage limits to specific morning, afternoon, or evening shifts.
                          </p>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Shift Date Dropdown */}
                          <div className="flex items-center gap-1.5 bg-emerald-50/80 px-2.5 py-1.5 rounded-lg border border-emerald-200 text-xs shadow-inner">
                            <span className="font-bold text-emerald-900 text-3xs uppercase">📅 Date:</span>
                            <select
                              value={shiftDate}
                              onChange={(e) => {
                                const newDate = e.target.value;
                                setShiftDate(newDate);
                                setIsEditingShifts(false);
                                fetchSlots(managerCentre._id, newDate);
                              }}
                              className="bg-white border border-emerald-300 font-bold text-gray-800 rounded-md px-2 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-sm"
                            >
                              {shiftDateOptions.map(opt => (
                                <option key={opt.dateStr} value={opt.dateStr}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          {!isEditingShifts ? (
                            <button 
                              onClick={() => setIsEditingShifts(true)}
                              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors shadow-sm cursor-pointer flex items-center gap-1"
                            >
                              <span>✏️</span> Customize Shifts
                            </button>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => {
                                  setIsEditingShifts(false);
                                  fetchSlots(managerCentre._id, shiftDate);
                                }}
                                className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button 
                                onClick={() => handleSaveShiftQuotas(managerCentre._id, shiftDate)}
                                disabled={!isShiftQuotaValid || isSavingShifts}
                                className={`text-xs font-bold px-4 py-1.5 rounded-lg transition-all shadow-md cursor-pointer ${
                                  isShiftQuotaValid 
                                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95' 
                                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                }`}
                              >
                                {isSavingShifts ? 'Saving...' : '💾 Save Quotas'}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* DYNAMIC LIVE QUINTAL ALLOCATION BALANCE INDICATOR */}
                      {isEditingShifts && (() => {
                        const currentSum = Object.values(shiftInputs).reduce((acc, val) => acc + (Number(val) || 0), 0);
                        const remaining = dateMax - currentSum;

                        return (
                          <div className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs shadow-sm ${
                            remaining === 0
                              ? 'bg-emerald-50 border-emerald-400 text-emerald-950'
                              : remaining > 0
                                ? 'bg-amber-50 border-amber-300 text-amber-950'
                                : 'bg-red-50 border-red-400 text-red-950 animate-pulse'
                          }`}>
                            <div className="flex items-center gap-2 font-black">
                              {remaining === 0 ? (
                                <>
                                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs shrink-0">✓</span>
                                  <span>0 Q Left — Perfectly Balanced for {formatDateDisplay(shiftDate)}!</span>
                                </>
                              ) : remaining > 0 ? (
                                <>
                                  <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs shrink-0 animate-bounce">⏳</span>
                                  <span>{remaining.toLocaleString()} Q left to be allocated</span>
                                </>
                              ) : (
                                <>
                                  <span className="w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center text-xs shrink-0">⚠️</span>
                                  <span>{Math.abs(remaining).toLocaleString()} Q Over-Allocated! (Exceeds {dateMax} Q daily limit)</span>
                                </>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-3xs font-mono font-extrabold">
                              <span className="bg-white/80 px-2.5 py-1 rounded-lg border border-gray-200">
                                Allocated: <strong className={remaining === 0 ? 'text-emerald-700' : remaining > 0 ? 'text-amber-700' : 'text-red-700'}>{currentSum} Q</strong> / {dateMax} Q
                              </span>
                            </div>
                          </div>
                        );
                      })()}

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
                                    <div className="flex justify-between text-2xs text-gray-400">
                                      <span>Shift Limit:</span>
                                      <span className="font-bold text-gray-700">{slotMax} Q</span>
                                    </div>
                                    <div className="text-3xs text-gray-400 pt-1 border-t border-gray-200 flex justify-between">
                                      <span>Booked: {slotBooked} Q</span>
                                    </div>
                                  </>
                                ) : (
                                  <div className="space-y-2 pt-1">
                                    <div>
                                      <div className="flex justify-between items-baseline mb-1">
                                        <label className="text-3xs font-bold uppercase text-gray-500 block">
                                          Shift Capacity
                                        </label>
                                        <span className={`text-3xs font-bold ${isBelowFloor ? 'text-red-600 font-extrabold' : 'text-gray-400'}`}>
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
                                        <span className="absolute right-2.5 top-1.5 text-2xs font-bold text-gray-400">Q</span>
                                      </div>
                                    </div>
                                    <p className={`text-3xs ${isBelowFloor ? 'text-red-600 font-bold' : 'text-gray-400'}`}>
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
      </div>

    </div>
  );
}
