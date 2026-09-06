const API_BASE = import.meta.env.VITE_API_URL || "";
import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

const getCropDisplayName = (cropName, t) => {
  if (!cropName) return '';
  const lower = cropName.toLowerCase();
  if (lower.includes('wheat') || lower.includes('गेहूं')) return t('crop_wheat');
  if (lower.includes('paddy') || lower.includes('धान')) return t('crop_paddy');
  if (lower.includes('mustard') || lower.includes('सरसों')) return t('crop_mustard');
  if (lower.includes('maize') || lower.includes('मक्का')) return t('crop_maize');
  if (lower.includes('barley') || lower.includes('जौ')) return t('crop_barley');
  if (lower.includes('chana') || lower.includes('चना')) return t('crop_chana');
  return cropName;
};

const getOfficerBadge = (badge, t) => {
  if (!badge) return '';
  if (badge.includes('Punjab')) return t('admin_badge_punjab') || 'Punjab Zone In-Charge';
  if (badge.includes('UP')) return t('admin_badge_up') || 'UP Zone In-Charge';
  if (badge.includes('Assam')) return t('admin_badge_assam') || 'Assam Zone In-Charge';
  return badge;
};

const generateGatePass = () => `GP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
const generateMoisture = () => (10.5 + Math.random() * 1.5).toFixed(1);
const generateJFormNumber = () => `JF-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

export default function AdminConsole({ userSession, onLogout, onOpenLogin }) {
  const { t, i18n } = useTranslation();
  const isHindi = i18n.language === 'hi';
  const [centres, setCentres] = useState([]);
  const [procurements, setProcurements] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState('Just now');
  const [expandedCentreId, setExpandedCentreId] = useState(null);
  const [slotsData, setSlotsData] = useState({});
  const [actionMessage, setActionMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [inputCapacities, setInputCapacities] = useState({});
  const [isAdvancingStage, setIsAdvancingStage] = useState(false);
  
  // Custom Shift Quotas Editor State
  const [{ nowMs, todayLocal, tomorrowLocal }] = useState(() => {
    const tzOffset = new Date().getTimezoneOffset() * 60000;
    const baseNow = Date.now() - tzOffset;
    return {
      nowMs: baseNow,
      todayLocal: new Date(baseNow).toISOString().split('T')[0],
      tomorrowLocal: new Date(baseNow + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    };
  });

  const [shiftDate, setShiftDate] = useState(todayLocal);
  const [isEditingShifts, setIsEditingShifts] = useState(false);
  const [shiftInputs, setShiftInputs] = useState({});
  const [isSavingShifts, setIsSavingShifts] = useState(false);

  // Date Filter State for Consignment Control Center ('' = All Dates / Latest First)
  const [selectedTokenDate, setSelectedTokenDate] = useState('');

  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  };

  // 7-Day Rolling Procurement Window Options
  const shiftDateOptions = useMemo(() => {
    const locale = isHindi ? 'hi-IN' : 'en-US';
    return Array.from({ length: 8 }, (_, i) => {
      const d = new Date(nowMs + i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split('T')[0];
      const label = i === 0 
        ? `${t('admin_today_btn')} (${formatDateDisplay(dateStr)})` 
        : i === 1 
          ? `${t('admin_tomorrow_btn')} (${formatDateDisplay(dateStr)})` 
          : d.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' }) + ` (${formatDateDisplay(dateStr)})`;
      return { dateStr, label };
    });
  }, [nowMs, isHindi, t]);

  // Token Sections & Selection State
  const [tokenTab, setTokenTab] = useState('active'); // 'active' | 'approved' | 'cancelled' | 'rejected'
  const [selectedTokenId, setSelectedTokenId] = useState(null);
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [rejectModalData, setRejectModalData] = useState(null); // { tokenId, stage, defaultReason }
  const [customRejectReason, setCustomRejectReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);
  const [qualityModalData, setQualityModalData] = useState(null); // { tokenId, currentProc, moisture_percent, purity_percent, remarks }
  const [weighModalData, setWeighModalData] = useState(null); // { tokenId, currentProc, initialEstimate, net_weight_quintals, gunny_bags }

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
  const handleAdvanceStage = async (tokenId, nextStage, currentProc, customDetails = null) => {
    setIsAdvancingStage(true);
    try {
      let stageDetails = customDetails || {};
      if (!customDetails) {
        if (nextStage === 2) {
          stageDetails = { gate_pass: generateGatePass() };
        } else if (nextStage === 3) {
          stageDetails = { moisture_percent: Number(generateMoisture()), purity_percent: 99.2 };
        } else if (nextStage === 4) {
          const w = currentProc?.net_weight_quintals || currentProc?.estimated_weight_quintals || 45.20;
          stageDetails = { net_weight_quintals: w, gunny_bags: Math.round(w * 2) };
        } else if (nextStage === 5) {
          let rate = currentProc?.msp_rate;
          if (!rate) {
            if (currentProc?.crop_type?.includes('Paddy')) rate = 2300;
            else if (currentProc?.crop_type?.includes('Mustard')) rate = 5650;
            else if (currentProc?.crop_type?.includes('Maize')) rate = 2090;
            else rate = 2275;
          }
          stageDetails = { msp_rate: rate, j_form_number: generateJFormNumber() };
        }
      }

      const res = await fetch(`${API_BASE}/api/capacity/procurements/advance-stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token_id: tokenId, target_stage: nextStage, details: stageDetails })
      });
      const data = await res.json();
      if (data.success) {
        showFeedback(`✓ Approved Stage ${nextStage}! Updated live across all official portals.`);
        setQualityModalData(null);
        setWeighModalData(null);
        fetchAllData(false);
      } else {
        showError(data.error || 'Failed to advance stage');
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
    } catch {
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

  // 1. Sort all procurements latest first (newest updated/created/slot date first)
  const sortedFacilityProcurements = [...facilityProcurements].sort((a, b) => {
    const timeA = new Date(a.updated_at || a.created_at || a.slot_date || 0).getTime();
    const timeB = new Date(b.updated_at || b.created_at || b.slot_date || 0).getTime();
    return timeB - timeA;
  });

  // 2. Filter by Selected Date if specified, or return all sorted latest first
  const dateFilteredProcurements = selectedTokenDate
    ? sortedFacilityProcurements.filter(p => {
        const tokenDate = p.slot_date || p.booking_date || (p.updated_at && new Date(p.updated_at).toISOString().split('T')[0]);
        return tokenDate === selectedTokenDate;
      })
    : sortedFacilityProcurements;

  // 3. Partition Tokens into Distinct Sections for this Facility
  const activeTokens = dateFilteredProcurements.filter(p => p.status !== 'rejected' && p.status !== 'cancelled' && p.current_stage < 5);
  const approvedTokens = dateFilteredProcurements.filter(p => p.status !== 'rejected' && p.status !== 'cancelled' && p.current_stage === 5);
  const cancelledTokens = dateFilteredProcurements.filter(p => p.status === 'cancelled');
  const rejectedTokens = dateFilteredProcurements.filter(p => p.status === 'rejected');

  // Active Token being processed (strictly active token belonging to this facility & current date filter)
  const currentActiveProcurement = activeTokens.find(p => p.token_id === selectedTokenId) || activeTokens[0] || null;

  // Find manager centre
  const managerCentre = centres.find(
    c => c.name.toLowerCase().includes(userSession?.state?.toLowerCase() || '') || c.name === userSession?.centreName
  ) || centres[0];

  useEffect(() => {
    if (userSession && managerCentre?._id) {
      fetchSlots(managerCentre._id, shiftDate);
    }
  }, [userSession, managerCentre?._id, shiftDate]);

  // Unauthorized Barrier
  if (!userSession) {
    return (
      <div className="py-16 px-4 max-w-md mx-auto text-center space-y-6 animate-fade-in">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-3xl shadow-inner border-2 border-emerald-300">
          🔒
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-gray-900">{t("admin_access_restricted")}</h2>
          <p className="text-xs text-gray-600 font-medium">
            {t("admin_access_desc")}
          </p>
        </div>
        <button
          onClick={onOpenLogin}
          className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold py-3.5 px-6 rounded-xl shadow-lg transition-transform active:scale-95 text-sm cursor-pointer"
        >
          {t("admin_open_login_btn")}
        </button>
      </div>
    );
  }

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
                {t("sb_badge") || 'Mandi Manager Treasury Record'}
              </span>
              <h2 className="text-xl font-black text-gray-900 mt-1">{t("receipt_title") || 'Official J-Form Settlement Voucher'}</h2>
              <p className="text-xs text-gray-500 font-mono">Token: {selectedVoucher.token_id}</p>
            </div>
          </div>

          <div className="p-6 space-y-4 text-xs text-gray-800">
            <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3.5 rounded-xl border border-gray-200">
              <div>
                <span className="text-gray-400 font-semibold block text-3xs uppercase">{t("rcpt_farmer") || 'Beneficiary Kisan'}</span>
                <span className="font-extrabold text-gray-900 text-sm">{selectedVoucher.farmer_name}</span>
                <span className="text-gray-500 block text-3xs font-mono mt-0.5">{selectedVoucher.farmer_phone}</span>
              </div>
              <div>
                <span className="text-gray-400 font-semibold block text-3xs uppercase">{t("rcpt_jform") || 'J-Form Reference'}</span>
                <span className="font-extrabold text-emerald-800 text-sm font-mono">{selectedVoucher.j_form_number || 'N/A'}</span>
                <span className="text-gray-500 block text-3xs font-mono mt-0.5">Gate Pass: {selectedVoucher.gate_pass || 'N/A'}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                <span className="text-3xs text-emerald-800 font-bold uppercase block">{t("gp_capacity") || 'Net Weight'}</span>
                <span className="text-base font-black text-emerald-950">{weight} Qtl</span>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <span className="text-3xs text-blue-800 font-bold uppercase block">{t("rcpt_rate") || 'Govt MSP Rate'}</span>
                <span className="text-base font-black text-blue-950">₹{rate} /Q</span>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                <span className="text-3xs text-purple-800 font-bold uppercase block">Gunny Bags</span>
                <span className="text-base font-black text-purple-950">{bags} Bags</span>
              </div>
            </div>

            <div className="bg-emerald-600 text-white p-4 rounded-xl text-center shadow-md">
              <span className="text-3xs font-extrabold uppercase tracking-widest text-emerald-200 block mb-1">
                {t("rcpt_gross") || 'Approved Gross DBT Payout'}
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
                {t("close") || 'Close'}
              </button>
              <button 
                onClick={() => window.print()}
                className="w-2/3 bg-emerald-600 text-white font-bold py-2.5 rounded-lg hover:bg-emerald-700 transition-colors shadow-md text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>🖨️</span> {t("sb_print_pdf") || 'Print Voucher Copy'}
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

    const stageTitle = rejectModalData.stage === 3 
      ? (isHindi ? 'स्टेशन 3: गुणवत्ता व नमी जांच' : 'Stage 3: Quality Lab Assaying')
      : (isHindi ? 'स्टेशन 4: वेब्रिज वजन माप' : 'Stage 4: Weighbridge Measurement');

    const quickReasons = rejectModalData.stage === 3 ? (
      isHindi ? [
        'नमी की मात्रा अधिकतम अनुमेय सीमा (12% FAQ) से अधिक है',
        'विदेशी पदार्थ व अकार्बनिक कचरा 2.0% सहनशीलता से अधिक है',
        'अनाज का रंग खराब / फंगस संक्रमण पाया गया',
        'घटिया गैर-खरीद अनाज का मिश्रण'
      ] : [
        'Moisture content exceeds maximum allowable limit (12% Max FAQ)',
        'Foreign matter & inorganic debris exceeds 2.0% tolerance',
        'Severe grain discoloration / fungus infestation detected',
        'Admixture with substandard non-procurement grain'
      ]
    ) : (
      isHindi ? [
        'वाहन का सकल वजन सहनशीलता सीमा से मेल नहीं खाता',
        'क्षतिग्रस्त / घटिया पैकेजिंग बोरियां (गैर-BIS जूट बैग)',
        'डबल-बीम स्केल जांच पर संदिग्ध वजन विसंगति'
      ] : [
        'Gross tare vehicle weight mismatch exceeds allowable tolerance',
        'Damaged / substandard packaging bags (Non-BIS jute bags)',
        'Suspected weight discrepancy on double-beam scale check'
      ]
    );

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
                {isHindi ? 'आधिकारिक अस्वीकृति कार्रवाई' : 'Official Rejection Action'}
              </span>
              <h3 className="text-lg font-black text-gray-900 mt-0.5">
                {isHindi ? 'कंसाइनमेंट अस्वीकार करें' : 'Reject Consignment'}
              </h3>
              <p className="text-xs text-gray-500 font-mono">Token: {rejectModalData.tokenId}</p>
            </div>
          </div>

          <div className="p-6 space-y-4 text-xs text-gray-800">
            <div>
              <span className="text-gray-400 font-bold block text-3xs uppercase mb-1">
                {isHindi ? 'अस्वीकृति बिंदु' : 'Rejection Point'}
              </span>
              <span className="font-extrabold text-red-900 text-sm">{stageTitle}</span>
            </div>

            <div>
              <span className="text-gray-500 font-bold block text-3xs uppercase mb-1.5">
                {isHindi ? 'मंडी अस्वीकृति कोड / कारण चुनें:' : 'Select Mandi Rejection Code / Reason:'}
              </span>
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

              <label className="block text-3xs font-bold text-gray-500 uppercase mb-1">
                {isHindi ? 'या कस्टम निरीक्षण टिप्पणी दर्ज करें:' : 'Or Enter Custom Inspection Remark:'}
              </label>
              <textarea
                value={customRejectReason}
                onChange={(e) => setCustomRejectReason(e.target.value)}
                placeholder={isHindi ? 'विशिष्ट अधिकारी अवलोकन दर्ज करें...' : 'Enter specific officer observation...'}
                className="w-full border border-gray-300 rounded-lg p-2.5 text-xs text-gray-900 focus:outline-none focus:border-red-500 font-medium"
                rows={2}
              />
            </div>

            <div className="bg-red-50 border border-red-200 p-3 rounded-xl text-2xs text-red-900 space-y-1">
              <p className="font-bold flex items-center gap-1">
                <span>⚠️</span> {isHindi ? 'कार्रवाई अपरिवर्तनीय है:' : 'Action is Irreversible:'}
              </p>
              <p>
                {isHindi 
                  ? 'किसान के पंजीकृत फोन और अधिसूचना फ़ीड पर तत्काल अलर्ट भेजा जाएगा। कंसाइनमेंट बंद कर दिया जाएगा।'
                  : 'An instant alert will be dispatched to the farmer\'s registered phone and notification feed. The consignment will be closed.'}
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => setRejectModalData(null)}
                disabled={isRejecting}
                className="w-1/3 bg-gray-100 text-gray-700 font-bold py-2.5 rounded-lg hover:bg-gray-200 transition-colors text-xs cursor-pointer disabled:opacity-50"
              >
                {isHindi ? 'रद्द करें' : 'Cancel'}
              </button>
              <button 
                onClick={handleConfirmReject}
                disabled={isRejecting}
                className="w-2/3 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-lg transition-colors shadow-md text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span>🚫</span> {isRejecting 
                  ? (isHindi ? 'अस्वीकार हो रहा है...' : 'Rejecting...') 
                  : (isHindi ? 'अस्वीकृति की पुष्टि करें' : 'Confirm Rejection')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Quality Assaying Modal (Station 3)
  const renderQualityModal = () => {
    if (!qualityModalData) return null;

    const moistureNum = Number(qualityModalData.moisture_percent) || 0;
    const isSafeMoisture = moistureNum <= 12.0;

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border-t-8 border-emerald-600 relative">
          <button 
            onClick={() => setQualityModalData(null)}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl font-bold p-1 cursor-pointer"
          >
            ✕
          </button>

          <div className="p-6 bg-emerald-50/60 border-b border-gray-100 flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-100 rounded-full border-2 border-emerald-300 flex items-center justify-center text-2xl shadow-inner shrink-0 text-emerald-700">
              🌾
            </div>
            <div>
              <span className="text-3xs font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                {t('admin_qmodal_title')}
              </span>
              <h3 className="text-lg font-black text-gray-900 mt-0.5">
                {t('admin_st3_title')}
              </h3>
              <p className="text-xs text-gray-500 font-mono">Token: {qualityModalData.tokenId}</p>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAdvanceStage(qualityModalData.tokenId, 3, qualityModalData.currentProc, {
                moisture_percent: Number(qualityModalData.moisture_percent),
                purity_percent: Number(qualityModalData.purity_percent || 99.2),
                remarks: qualityModalData.remarks || ''
              });
            }}
            className="p-6 space-y-4 text-xs text-gray-800"
          >
            {/* Moisture % Input */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-3xs font-bold text-gray-600 uppercase">
                  {t('admin_qmodal_moisture_label')}
                </label>
                <span className={`text-3xs font-extrabold px-2 py-0.5 rounded-full ${
                  isSafeMoisture ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {isSafeMoisture ? '✓ Safe FAQ' : '⚠️ Exceeds 12% FAQ'}
                </span>
              </div>
              <input
                type="number"
                step="0.1"
                min="5"
                max="25"
                required
                value={qualityModalData.moisture_percent}
                onChange={(e) => setQualityModalData({ ...qualityModalData, moisture_percent: e.target.value })}
                className="w-full border border-gray-300 rounded-xl p-3 text-sm font-bold text-gray-900 focus:outline-none focus:border-emerald-600 shadow-2xs"
                placeholder="11.5"
              />
              <p className="text-3xs text-gray-400 mt-1">{t('admin_qmodal_moisture_hint')}</p>
            </div>

            {/* Purity % Input */}
            <div>
              <label className="block text-3xs font-bold text-gray-600 uppercase mb-1">
                {t('admin_qmodal_purity_label')}
              </label>
              <input
                type="number"
                step="0.1"
                min="50"
                max="100"
                required
                value={qualityModalData.purity_percent}
                onChange={(e) => setQualityModalData({ ...qualityModalData, purity_percent: e.target.value })}
                className="w-full border border-gray-300 rounded-xl p-3 text-sm font-bold text-gray-900 focus:outline-none focus:border-emerald-600 shadow-2xs"
                placeholder="99.2"
              />
            </div>

            {/* Remarks / Observations */}
            <div>
              <label className="block text-3xs font-bold text-gray-600 uppercase mb-1">
                {t('admin_qmodal_remarks_label')}
              </label>
              <input
                type="text"
                value={qualityModalData.remarks}
                onChange={(e) => setQualityModalData({ ...qualityModalData, remarks: e.target.value })}
                placeholder="Certified lab compliant grain sample..."
                className="w-full border border-gray-300 rounded-xl p-2.5 text-xs text-gray-900 focus:outline-none focus:border-emerald-600 shadow-2xs"
              />
            </div>

            <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-2xs text-emerald-900">
              <p className="font-bold flex items-center gap-1">
                <span>📲</span> {isHindi ? 'तत्काल किसान अधिसूचना:' : 'Instant Farmer Notification:'}
              </p>
              <p>
                {isHindi 
                  ? 'लैब पास करने पर किसान को उनके मोबाइल पर प्रमाणित नमी व शुद्धता प्रतिशत का संदेश प्राप्त होगा।'
                  : 'Upon lab certification, the farmer will receive an instant notification with verified moisture & purity levels.'}
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                type="button"
                onClick={() => setQualityModalData(null)}
                disabled={isAdvancingStage}
                className="w-1/3 bg-gray-100 text-gray-700 font-bold py-2.5 rounded-xl hover:bg-gray-200 transition-colors text-xs cursor-pointer disabled:opacity-50"
              >
                {t('cancel')}
              </button>
              <button 
                type="submit"
                disabled={isAdvancingStage}
                className="w-2/3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl transition-colors shadow-md text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isAdvancingStage ? '...' : t('admin_qmodal_btn_approve')}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // Weighbridge Scale Modal (Station 4)
  const renderWeighModal = () => {
    if (!weighModalData) return null;

    const currentProc = weighModalData.currentProc;
    let mspRate = currentProc?.msp_rate;
    if (!mspRate) {
      if (currentProc?.crop_type?.includes('Paddy')) mspRate = 2300;
      else if (currentProc?.crop_type?.includes('Mustard')) mspRate = 5650;
      else if (currentProc?.crop_type?.includes('Maize')) mspRate = 2090;
      else mspRate = 2275;
    }

    const netWeightNum = Number(weighModalData.net_weight_quintals) || 0;
    const grossPayout = Math.round(netWeightNum * mspRate);
    const initialEst = Number(weighModalData.initialEstimate) || 45.20;
    const deltaWeight = (netWeightNum - initialEst).toFixed(2);
    const deltaPayout = Math.round(deltaWeight * mspRate);

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border-t-8 border-emerald-600 relative">
          <button 
            onClick={() => setWeighModalData(null)}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl font-bold p-1 cursor-pointer"
          >
            ✕
          </button>

          <div className="p-6 bg-emerald-50/60 border-b border-gray-100 flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-100 rounded-full border-2 border-emerald-300 flex items-center justify-center text-2xl shadow-inner shrink-0 text-emerald-700">
              ⚖️
            </div>
            <div>
              <span className="text-3xs font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                {t('admin_wmodal_title')}
              </span>
              <h3 className="text-lg font-black text-gray-900 mt-0.5">
                {t('admin_st4_title')}
              </h3>
              <p className="text-xs text-gray-500 font-mono">Token: {weighModalData.tokenId}</p>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAdvanceStage(weighModalData.tokenId, 4, weighModalData.currentProc, {
                net_weight_quintals: Number(weighModalData.net_weight_quintals)
              });
            }}
            className="p-6 space-y-4 text-xs text-gray-800"
          >
            {/* Info Box: Crop & MSP Rate */}
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 flex justify-between items-center text-2xs">
              <div>
                <span className="text-gray-500 block uppercase font-bold">{t('admin_crop_allotment')}</span>
                <span className="font-extrabold text-gray-900">{getCropDisplayName(currentProc?.crop_type, t)}</span>
              </div>
              <div className="text-right">
                <span className="text-gray-500 block uppercase font-bold">{t('admin_wmodal_msp_rate')}</span>
                <span className="font-mono font-extrabold text-emerald-800 text-sm">₹{mspRate.toLocaleString('en-IN')}/Qtl</span>
              </div>
            </div>

            {/* Net Weight Input */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-3xs font-bold text-gray-600 uppercase">
                  {t('admin_wmodal_net_weight_label')}
                </label>
                <span className="text-3xs text-gray-500">
                  {t('admin_wmodal_est_weight')} <strong className="font-mono text-gray-700">{initialEst} Qtl</strong>
                </span>
              </div>
              <input
                type="number"
                step="0.01"
                min="0.1"
                max="1000"
                required
                value={weighModalData.net_weight_quintals}
                onChange={(e) => {
                  setWeighModalData({
                    ...weighModalData,
                    net_weight_quintals: e.target.value
                  });
                }}
                className="w-full border border-gray-300 rounded-xl p-3 text-base font-extrabold text-gray-900 focus:outline-none focus:border-emerald-600 shadow-2xs font-mono"
                placeholder="45.20"
              />
            </div>

            {/* Dynamic Recalculated Payout Banner */}
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-300 p-4 rounded-2xl space-y-2 shadow-xs">
              <span className="text-3xs font-extrabold uppercase tracking-wider text-emerald-800 block">
                {t('admin_wmodal_payout_preview')}
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black font-mono text-emerald-950">
                  ₹{grossPayout.toLocaleString('en-IN')}
                </span>
                <span className="text-2xs text-emerald-800 font-bold">
                  {netWeightNum} Qtl &times; ₹{mspRate}
                </span>
              </div>

              {Number(deltaWeight) !== 0 && (
                <div className="pt-2 border-t border-emerald-200 flex items-center justify-between text-2xs">
                  <span className="text-emerald-900 font-bold">{t('admin_wmodal_weight_diff')}</span>
                  <span className={`font-extrabold font-mono ${
                    Number(deltaWeight) > 0 ? 'text-emerald-700' : 'text-amber-700'
                  }`}>
                    {Number(deltaWeight) > 0 ? `+${deltaWeight}` : deltaWeight} Qtl ({Number(deltaPayout) > 0 ? `+₹${deltaPayout.toLocaleString('en-IN')}` : `-₹${Math.abs(deltaPayout).toLocaleString('en-IN')}`})
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                type="button"
                onClick={() => setWeighModalData(null)}
                disabled={isAdvancingStage}
                className="w-1/3 bg-gray-100 text-gray-700 font-bold py-2.5 rounded-xl hover:bg-gray-200 transition-colors text-xs cursor-pointer disabled:opacity-50"
              >
                {t('cancel')}
              </button>
              <button 
                type="submit"
                disabled={isAdvancingStage}
                className="w-2/3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl transition-colors shadow-md text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isAdvancingStage ? '...' : t('admin_wmodal_btn_approve')}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  return (
    <div className="py-4 px-3 sm:py-8 sm:px-6 max-w-6xl mx-auto animate-fade-in-up space-y-4 sm:space-y-6">
      {renderVoucherModal()}
      {renderRejectionModal()}
      {renderQualityModal()}
      {renderWeighModal()}
      
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
                {getOfficerBadge(userSession.badge, t)}
              </span>
            </div>
            <p className="text-xs text-gray-500 font-medium mt-0.5">
              {t("admin_assigned_facility")} <span className="font-bold text-emerald-800">{userSession.centreName}</span>
            </p>
          </div>
        </div>
        
        {/* Right Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 shadow-inner">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>{t("admin_auto_sync")} <strong className="text-emerald-700">5s</strong></span>
          </div>

          <button 
            onClick={() => fetchAllData(true)}
            disabled={isSyncing}
            className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold px-3.5 py-2 rounded-lg transition-all shadow-sm active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <span className={`inline-block text-sm ${isSyncing ? 'animate-spin' : ''}`}>🔄</span>
            <span>{isSyncing ? t("admin_syncing") : t("admin_live_sync")}</span>
          </button>

          <button 
            onClick={onLogout}
            className="bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 text-xs font-bold px-3.5 py-2 rounded-lg transition-colors cursor-pointer shadow-sm"
          >
            {t("admin_logout_btn")}
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
              {t("admin_ctrl_center")}
            </span>
            <h3 className="text-2xl font-black text-gray-900 mt-1">{t("admin_consignment_registry")}</h3>
          </div>

          {/* 4-Section Tab Switcher */}
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
              <span>{t("admin_tab_active")} ({activeTokens.length})</span>
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
              <span>{t("admin_tab_approved")} ({approvedTokens.length})</span>
            </button>

            <button
              onClick={() => setTokenTab('cancelled')}
              className={`px-4 py-2 sm:px-5 sm:py-2.5 text-xs font-extrabold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                tokenTab === 'cancelled'
                  ? 'bg-amber-600 text-white shadow-md scale-102'
                  : 'text-gray-600 hover:text-amber-700 hover:bg-amber-50'
              }`}
            >
              <span>🚫</span>
              <span>{t("admin_tab_cancelled")} ({cancelledTokens.length})</span>
            </button>

            <button
              onClick={() => setTokenTab('rejected')}
              className={`px-4 py-2 sm:px-5 sm:py-2.5 text-xs font-extrabold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                tokenTab === 'rejected'
                  ? 'bg-red-700 text-white shadow-md scale-102'
                  : 'text-gray-600 hover:text-red-700 hover:bg-red-50'
              }`}
            >
              <span>⚠️</span>
              <span>{t("admin_tab_rejected")} ({rejectedTokens.length})</span>
            </button>
          </div>
        </div>

        {/* Date Filter Toolbar */}
        <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200/80 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-base">📅</span>
              <span className="text-xs font-black text-emerald-950 uppercase tracking-wide">
                {t("admin_filter_date_label") || "Filter Consignments by Date:"}
              </span>
              {selectedTokenDate && (
                <span className="bg-emerald-200 text-emerald-900 text-3xs font-extrabold px-2 py-0.5 rounded-full font-mono">
                  {formatDateDisplay(selectedTokenDate)}
                </span>
              )}
            </div>
            <p className="text-3xs text-emerald-800 font-medium">
              {selectedTokenDate
                ? (isHindi ? `केवल ${formatDateDisplay(selectedTokenDate)} के निर्धारित टोकन दिखाए जा रहे हैं` : `Showing tokens scheduled for ${formatDateDisplay(selectedTokenDate)}`)
                : (isHindi ? `सभी तिथियों के टोकन (नवीनतम पहले) प्रदर्शित हैं` : `Showing all tokens across all dates (arranged latest first)`)}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* All Dates Button */}
            <button
              onClick={() => setSelectedTokenDate('')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1 ${
                selectedTokenDate === ''
                  ? 'bg-emerald-800 text-white shadow-sm ring-2 ring-emerald-600/30'
                  : 'bg-white text-emerald-900 border border-emerald-200 hover:bg-emerald-100/60'
              }`}
            >
              <span>🌐</span>
              <span>{t("admin_all_dates_btn") || "All Dates (Latest First)"}</span>
            </button>

            {/* Today Button */}
            <button
              onClick={() => setSelectedTokenDate(todayLocal)}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1 ${
                selectedTokenDate === todayLocal
                  ? 'bg-emerald-800 text-white shadow-sm ring-2 ring-emerald-600/30'
                  : 'bg-white text-emerald-900 border border-emerald-200 hover:bg-emerald-100/60'
              }`}
            >
              <span>{t("admin_today_btn") || "Today"} ({formatDateDisplay(todayLocal)})</span>
            </button>

            {/* Tomorrow Button */}
            <button
              onClick={() => setSelectedTokenDate(tomorrowLocal)}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1 ${
                selectedTokenDate === tomorrowLocal
                  ? 'bg-emerald-800 text-white shadow-sm ring-2 ring-emerald-600/30'
                  : 'bg-white text-emerald-900 border border-emerald-200 hover:bg-emerald-100/60'
              }`}
            >
              <span>{t("admin_tomorrow_btn") || "Tomorrow"} ({formatDateDisplay(tomorrowLocal)})</span>
            </button>

            {/* Custom Date Input */}
            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-emerald-200">
              <span className="text-3xs font-bold text-gray-500 uppercase">{t("admin_custom_date") || "Date:"}</span>
              <input
                type="date"
                value={selectedTokenDate}
                onChange={(e) => setSelectedTokenDate(e.target.value)}
                className="text-xs font-bold text-emerald-950 bg-transparent outline-none cursor-pointer"
              />
              {selectedTokenDate && (
                <button
                  onClick={() => setSelectedTokenDate('')}
                  title="Clear Date Filter"
                  className="text-xs text-gray-400 hover:text-red-600 font-bold px-1 rounded transition cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 1: ACTIVE TOKENS PIPELINE */}
        {tokenTab === 'active' && (
          <div className="space-y-6 animate-fade-in">
            
            {/* Active Tokens List / Selector */}
            {activeTokens.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {t("admin_select_token_prompt")}
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
                        <div className="flex justify-between items-start gap-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-black text-emerald-900 text-xs">{p.token_id}</span>
                            {p.reschedule_count > 0 && (
                              <span className="bg-blue-100 text-blue-900 text-3xs font-extrabold px-1.5 py-0.5 rounded flex items-center gap-0.5 border border-blue-200" title={`Rescheduled ${p.reschedule_count} time(s)`}>
                                <span>📅</span>
                                <span>{isHindi ? `${p.reschedule_count} बार पुनर्निर्धारित` : `Rescheduled: ${p.reschedule_count}`}</span>
                              </span>
                            )}
                          </div>
                          <span className="bg-amber-100 text-amber-900 text-3xs font-extrabold px-2 py-0.5 rounded-full uppercase shrink-0">
                            {t("admin_stage")} {p.current_stage} / 5
                          </span>
                        </div>
                        <p className="font-extrabold text-gray-900 text-sm mt-1">{p.farmer_name}</p>
                        <p className="text-3xs text-gray-500 font-medium">{getCropDisplayName(p.crop_type, t)} • {p.estimated_weight_quintals || 45.2} Qtl</p>
                        <p className="text-3xs text-emerald-800 font-bold mt-1 flex items-center gap-1">
                          <span>📅</span>
                          <span>{p.slot_date || p.booking_date || formatDateDisplay(todayLocal)}</span>
                          {p.slot_time && <span className="text-gray-500 font-normal">({p.slot_time})</span>}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-8 bg-gray-50 rounded-2xl border border-gray-200 text-center space-y-3">
                <span className="text-3xl block">🌾</span>
                <h4 className="font-extrabold text-gray-800 text-sm">
                  {selectedTokenDate 
                    ? (isHindi ? `${formatDateDisplay(selectedTokenDate)} के लिए कोई सक्रिय कंसाइनमेंट नहीं मिला` : `No active consignments found for ${formatDateDisplay(selectedTokenDate)}`)
                    : t("admin_no_active_title")}
                </h4>
                <p className="text-xs text-gray-500 max-w-md mx-auto">
                  {selectedTokenDate
                    ? (isHindi ? `इस तिथि के लिए कोई सक्रिय टोकन नहीं है। अन्य रिकॉर्ड देखने के लिए 'सभी तिथियां' चुनें।` : `There are no active tokens scheduled for this date. Click below to view all dates.`)
                    : t("admin_no_active_desc")}
                </p>
                {selectedTokenDate && (
                  <button
                    onClick={() => setSelectedTokenDate('')}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold px-4 py-2 rounded-xl text-xs shadow transition cursor-pointer"
                  >
                    {t("admin_all_dates_btn") || "Show All Dates (Latest First)"}
                  </button>
                )}
              </div>
            )}

            {/* Selected Active Token Processing Card */}
            {currentActiveProcurement && (
              <div className="bg-gradient-to-br from-emerald-900 via-emerald-800 to-slate-900 text-white rounded-3xl p-6 shadow-xl border border-emerald-700 relative overflow-hidden">
                <div className="relative z-10 space-y-6">
                  
                  {/* Card Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-700/60 pb-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="bg-emerald-700/80 px-2.5 py-0.5 rounded-full text-3xs font-black uppercase tracking-wider text-emerald-200 border border-emerald-500/40">
                          {t("admin_live_in_process")}
                        </span>
                        {currentActiveProcurement.reschedule_count > 0 && (
                          <span className="bg-blue-900/90 text-blue-200 text-3xs font-extrabold px-2.5 py-0.5 rounded-full border border-blue-400/50 flex items-center gap-1">
                            <span>📅</span>
                            <span>{isHindi ? `${currentActiveProcurement.reschedule_count} बार पुनर्निर्धारित` : `Rescheduled ${currentActiveProcurement.reschedule_count} time(s)`}</span>
                          </span>
                        )}
                      </div>
                      <h3 className="text-2xl font-black font-mono text-emerald-300 mt-1">
                        {currentActiveProcurement.token_id}
                      </h3>
                    </div>

                    <div className="text-left sm:text-right">
                      <span className="text-xs text-emerald-200 block font-medium">{t("admin_farmer_contact")}</span>
                      <span className="font-bold text-white text-sm">{currentActiveProcurement.farmer_phone}</span>
                    </div>
                  </div>

                  {/* Active Farmer Delivery Info */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 bg-emerald-950/60 p-4 rounded-2xl border border-emerald-800/60 text-xs">
                    <div>
                      <p className="text-emerald-400 font-bold uppercase text-3xs">{t("admin_farmer_name")}</p>
                      <p className="font-extrabold text-white text-sm">{currentActiveProcurement.farmer_name}</p>
                    </div>
                    <div>
                      <p className="text-emerald-400 font-bold uppercase text-3xs">{t("admin_crop_allotment")}</p>
                      <p className="font-bold text-white">{getCropDisplayName(currentActiveProcurement.crop_type, t)}</p>
                    </div>
                    <div>
                      <p className="text-emerald-400 font-bold uppercase text-3xs">{t("admin_arrival_mandi")}</p>
                      <p className="font-bold text-white">{currentActiveProcurement.centre_name}</p>
                    </div>
                    <div>
                      <p className="text-emerald-400 font-bold uppercase text-3xs">{t("admin_th_sched_date") || "Scheduled Slot"}</p>
                      <p className="font-bold text-emerald-200">
                        📅 {currentActiveProcurement.slot_date || currentActiveProcurement.booking_date || 'Today'}
                        {currentActiveProcurement.slot_time && <span className="block text-3xs text-emerald-400">{currentActiveProcurement.slot_time}</span>}
                      </p>
                    </div>
                    <div>
                      <p className="text-emerald-400 font-bold uppercase text-3xs">{t("admin_current_stage")}</p>
                      <p className="font-extrabold text-yellow-300 text-sm">
                        {t("admin_stage")} {currentActiveProcurement.current_stage} / 5
                      </p>
                    </div>
                  </div>

                  {/* Interactive 5-Stage Step Approval Station */}
                  <div className="space-y-4">
                    <p className="text-xs font-bold text-emerald-200 uppercase tracking-wider">
                      {t("admin_advance_prompt")}
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                      
                      {/* STAGE 1: Token Active */}
                      <div className={`p-4 rounded-2xl border transition-all ${
                        currentActiveProcurement.current_stage >= 1 
                          ? 'bg-emerald-800/80 border-emerald-400 text-white shadow-md' 
                          : 'bg-emerald-950/40 border-emerald-800/50 text-emerald-400/60'
                      }`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-2xs font-extrabold uppercase tracking-wider text-emerald-300">{t("admin_station")} 1</span>
                          <span className="text-xs">✓</span>
                        </div>
                        <h4 className="font-bold text-sm">{t("admin_st1_title")}</h4>
                        <p className="text-3xs text-emerald-200/80 mt-1">{t("admin_st1_desc")}</p>
                      </div>

                      {/* STAGE 2: Gate Security Entry */}
                      <div className={`p-4 rounded-2xl border transition-all ${
                        currentActiveProcurement.current_stage >= 2 
                          ? 'bg-emerald-800/80 border-emerald-400 text-white shadow-md' 
                          : 'bg-emerald-950/40 border-emerald-800/50 text-emerald-400/60'
                      }`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-2xs font-extrabold uppercase tracking-wider text-emerald-300">{t("admin_station")} 2</span>
                          {currentActiveProcurement.current_stage >= 2 && <span className="text-xs">✓</span>}
                        </div>
                        <h4 className="font-bold text-sm">{t("admin_st2_title")}</h4>
                        <p className="text-3xs text-emerald-200/80 mt-1">{t("admin_st2_desc")}</p>

                        {currentActiveProcurement.current_stage === 1 && (
                          <button 
                            onClick={() => handleAdvanceStage(currentActiveProcurement.token_id, 2, currentActiveProcurement)}
                            disabled={isAdvancingStage}
                            className="mt-3 w-full bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-extrabold py-1.5 rounded-lg text-2xs transition shadow-sm cursor-pointer"
                          >
                            {isAdvancingStage ? '...' : t("admin_st2_btn")}
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
                          <span className="text-2xs font-extrabold uppercase tracking-wider text-emerald-300">{t("admin_station")} 3</span>
                          {currentActiveProcurement.current_stage >= 3 && <span className="text-xs">✓</span>}
                        </div>
                        <h4 className="font-bold text-sm">{t("admin_st3_title")}</h4>
                        <p className="text-3xs text-emerald-200/80 mt-1">
                          {currentActiveProcurement.current_stage >= 3
                            ? `${currentActiveProcurement.moisture_percent || 'N/A'}% ${t("admin_st3_moisture")} • ${currentActiveProcurement.purity_percent ? currentActiveProcurement.purity_percent + '%' : '99.2%'} ${isHindi ? 'शुद्धता' : 'Purity'}`
                            : t("admin_st3_desc")}
                        </p>

                        {currentActiveProcurement.current_stage === 2 && (
                          <div className="mt-3 flex gap-1.5">
                            <button 
                              onClick={() => setQualityModalData({
                                tokenId: currentActiveProcurement.token_id,
                                currentProc: currentActiveProcurement,
                                moisture_percent: currentActiveProcurement.moisture_percent || 11.5,
                                purity_percent: currentActiveProcurement.purity_percent || 99.2,
                                remarks: ''
                              })}
                              disabled={isAdvancingStage}
                              className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-extrabold py-1.5 rounded-lg text-2xs transition shadow-sm cursor-pointer"
                            >
                              {isAdvancingStage ? '...' : t("admin_st3_btn_pass")}
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
                              {t("admin_st3_btn_reject")}
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
                          <span className="text-2xs font-extrabold uppercase tracking-wider text-emerald-300">{t("admin_station")} 4</span>
                          {currentActiveProcurement.current_stage >= 4 && <span className="text-xs">✓</span>}
                        </div>
                        <h4 className="font-bold text-sm">{t("admin_st4_title")}</h4>
                        <p className="text-3xs text-emerald-200/80 mt-1">
                          {currentActiveProcurement.current_stage >= 4 
                            ? `${currentActiveProcurement.net_weight_quintals || 'N/A'} Quintals`
                            : t("admin_st4_desc")}
                        </p>

                        {currentActiveProcurement.current_stage === 3 && (
                          <div className="mt-3 flex gap-1.5">
                            <button 
                              onClick={() => {
                                const initialW = currentActiveProcurement.net_weight_quintals || currentActiveProcurement.estimated_weight_quintals || 45.20;
                                setWeighModalData({
                                  tokenId: currentActiveProcurement.token_id,
                                  currentProc: currentActiveProcurement,
                                  initialEstimate: currentActiveProcurement.estimated_weight_quintals || 45.20,
                                  net_weight_quintals: initialW
                                });
                              }}
                              disabled={isAdvancingStage}
                              className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-extrabold py-1.5 rounded-lg text-2xs transition shadow-sm cursor-pointer"
                            >
                              {isAdvancingStage ? '...' : t("admin_st4_btn_log")}
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
                              {t("admin_st4_btn_reject")}
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
                          <span className="text-2xs font-extrabold uppercase tracking-wider text-emerald-300">{t("admin_station")} 5</span>
                          {currentActiveProcurement.current_stage >= 5 && <span className="text-xs">✓</span>}
                        </div>
                        <h4 className="font-bold text-sm">{t("admin_st5_title")}</h4>
                        <p className="text-3xs text-emerald-200/80 mt-1">
                          {currentActiveProcurement.current_stage >= 5 && currentActiveProcurement.gross_payout
                            ? `₹${currentActiveProcurement.gross_payout.toLocaleString('en-IN')} DBT`
                            : t("admin_st5_desc")}
                        </p>

                        {currentActiveProcurement.current_stage === 4 && (
                          <button 
                            onClick={() => handleAdvanceStage(currentActiveProcurement.token_id, 5, currentActiveProcurement)}
                            disabled={isAdvancingStage}
                            className="mt-3 w-full bg-emerald-400 hover:bg-emerald-300 text-emerald-950 font-extrabold py-1.5 rounded-lg text-2xs transition shadow-sm cursor-pointer animate-pulse"
                          >
                            {isAdvancingStage ? '...' : t("admin_st5_btn_disburse")}
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
                <h4 className="font-extrabold text-gray-900 text-base">
                  {selectedTokenDate 
                    ? (isHindi ? `${formatDateDisplay(selectedTokenDate)} के लिए कोई स्वीकृत टोकन नहीं मिला` : `No approved tokens for ${formatDateDisplay(selectedTokenDate)}`)
                    : t("admin_no_approved_title")}
                </h4>
                <p className="text-xs text-gray-500 max-w-md mx-auto">
                  {selectedTokenDate
                    ? (isHindi ? `इस तिथि के लिए कोई भुगतान स्वीकृत टोकन नहीं है। अन्य रिकॉर्ड देखने के लिए 'सभी तिथियां' चुनें।` : `No approved tokens found for this date. View all dates to see approved payments.`)
                    : t("admin_no_approved_desc")}
                </p>
                {selectedTokenDate && (
                  <button
                    onClick={() => setSelectedTokenDate('')}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold px-4 py-2 rounded-xl text-xs shadow transition cursor-pointer"
                  >
                    {t("admin_all_dates_btn") || "Show All Dates (Latest First)"}
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-500 uppercase font-bold text-3xs border-b border-gray-200">
                    <tr>
                      <th className="py-3.5 px-4">{t("admin_th_token_jform")}</th>
                      <th className="py-3.5 px-4">{t("admin_th_farmer")}</th>
                      <th className="py-3.5 px-4">{t("admin_th_crop_load")}</th>
                      <th className="py-3.5 px-4">{t("admin_th_gross")}</th>
                      <th className="py-3.5 px-4">{t("admin_th_disbursal_status")}</th>
                      <th className="py-3.5 px-4 text-right">{t("admin_th_receipt")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {approvedTokens.map((p) => (
                      <tr key={p.token_id} className="hover:bg-emerald-50/40 transition-colors">
                        <td className="py-3.5 px-4">
                          <span className="font-mono font-bold text-gray-900 block">{p.token_id}</span>
                          <span className="text-3xs text-emerald-800 font-mono font-bold">{p.j_form_number || 'N/A'}</span>
                          <span className="text-3xs text-gray-500 font-medium block mt-0.5">📅 {p.slot_date ? formatDateDisplay(p.slot_date) : p.booking_date ? formatDateDisplay(p.booking_date) : (p.updated_at && formatDateDisplay(new Date(p.updated_at).toISOString().split('T')[0])) || 'N/A'}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-extrabold text-gray-900 block">{p.farmer_name}</span>
                          <span className="text-3xs text-gray-400 font-mono">{p.farmer_phone}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="text-gray-900 block">{getCropDisplayName(p.crop_type, t)}</span>
                          <span className="text-3xs text-gray-500 font-bold">{p.net_weight_quintals || 'N/A'} Qtl ({p.gunny_bags || 'N/A'} Bags)</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="text-base font-black text-emerald-800">
                            ₹{(p.gross_payout || 0).toLocaleString('en-IN')}
                          </span>
                          <span className="text-3xs text-gray-400 block font-mono">MSP @ ₹{p.msp_rate || 'N/A'}/Q</span>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-emerald-900 rounded-full font-bold text-3xs uppercase">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <span>{t("admin_dbt_disbursed_badge")}</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <button
                            onClick={() => setSelectedVoucher(p)}
                            className="bg-emerald-700 hover:bg-emerald-800 text-white px-3.5 py-1.5 rounded-xl font-bold text-3xs shadow-sm transition-all cursor-pointer inline-flex items-center gap-1"
                          >
                            <span>{t("admin_voucher_btn")}</span>
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

        {/* SECTION 3: CANCELLED TOKENS (PRE-GATE WITHDRAWALS) */}
        {tokenTab === 'cancelled' && (
          <div className="space-y-4 animate-fade-in">
            {cancelledTokens.length === 0 ? (
              <div className="p-12 bg-gray-50 rounded-2xl border border-gray-200 text-center space-y-3">
                <span className="text-4xl block">✨</span>
                <h4 className="font-extrabold text-gray-900 text-base">
                  {selectedTokenDate
                    ? (isHindi ? `${formatDateDisplay(selectedTokenDate)} के लिए कोई रद्द टोकन नहीं मिला` : `No cancelled tokens for ${formatDateDisplay(selectedTokenDate)}`)
                    : t("admin_no_cancelled_title")}
                </h4>
                <p className="text-xs text-gray-500 max-w-md mx-auto">
                  {selectedTokenDate
                    ? (isHindi ? `इस तिथि के लिए कोई टोकन रद्द नहीं हुआ है। अन्य रिकॉर्ड देखने के लिए 'सभी तिथियां' चुनें।` : `No tokens were cancelled for this selected date. Click below to view all dates.`)
                    : t("admin_no_cancelled_desc")}
                </p>
                {selectedTokenDate && (
                  <button
                    onClick={() => setSelectedTokenDate('')}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold px-4 py-2 rounded-xl text-xs shadow transition cursor-pointer"
                  >
                    {t("admin_all_dates_btn") || "Show All Dates (Latest First)"}
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-amber-50/70 text-amber-950 uppercase font-bold text-3xs border-b border-amber-200">
                    <tr>
                      <th className="py-3.5 px-4">{t("admin_th_token_pass")}</th>
                      <th className="py-3.5 px-4">{t("admin_th_farmer")}</th>
                      <th className="py-3.5 px-4">{t("admin_th_crop_load")}</th>
                      <th className="py-3.5 px-4">{t("admin_th_cancellation_reason")}</th>
                      <th className="py-3.5 px-4">{t("admin_th_cancelled_time")}</th>
                      <th className="py-3.5 px-4 text-right">{t("admin_th_status")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {cancelledTokens.map((p) => (
                      <tr key={p.token_id} className="hover:bg-amber-50/30 transition-colors">
                        <td className="py-3.5 px-4">
                          <span className="font-mono font-bold text-amber-900 block">{p.token_id}</span>
                          <span className="text-3xs text-gray-500 font-mono font-semibold">Pass: {p.gate_pass || 'N/A'}</span>
                          <span className="text-3xs text-amber-800 font-medium block mt-0.5">📅 {p.slot_date ? formatDateDisplay(p.slot_date) : p.booking_date ? formatDateDisplay(p.booking_date) : 'N/A'}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-extrabold text-gray-900 block">{p.farmer_name}</span>
                          <span className="text-3xs text-gray-400 font-mono">{p.farmer_phone}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="text-gray-900 block">{getCropDisplayName(p.crop_type, t)}</span>
                          <span className="text-3xs text-gray-500 font-bold">{p.estimated_weight_quintals || 45} Qtl</span>
                        </td>
                        <td className="py-3.5 px-4 max-w-xs">
                          <span className="text-amber-950 font-bold text-xs block leading-tight">
                            {p.cancellation_reason || t("tracker_cancel_reason_4")}
                          </span>
                          <span className="text-3xs text-gray-400 block mt-0.5 font-mono">
                            {p.reschedule_count > 0 ? `Rescheduled ${p.reschedule_count} time(s) prior` : 'Pre-Gate Stage 1 Cancellation'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="text-xs font-semibold text-gray-700 block">
                            {p.cancelled_at ? new Date(p.cancelled_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                          </span>
                          <span className="text-3xs text-gray-400 font-mono">
                            {p.cancelled_at ? new Date(p.cancelled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-600 text-white rounded-md text-3xs font-extrabold uppercase shadow-2xs">
                            <span>🚫</span>
                            <span>{isHindi ? 'रद्द' : 'Cancelled'}</span>
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

        {/* SECTION 4: REJECTED TOKENS (INSPECTION AUDIT LOG) */}
        {tokenTab === 'rejected' && (
          <div className="space-y-4 animate-fade-in">
            {rejectedTokens.length === 0 ? (
              <div className="p-12 bg-gray-50 rounded-2xl border border-gray-200 text-center space-y-3">
                <span className="text-4xl block">✅</span>
                <h4 className="font-extrabold text-gray-900 text-base">
                  {selectedTokenDate
                    ? (isHindi ? `${formatDateDisplay(selectedTokenDate)} के लिए कोई अस्वीकृत टोकन नहीं मिला` : `No rejected tokens for ${formatDateDisplay(selectedTokenDate)}`)
                    : t("admin_no_rejected_title")}
                </h4>
                <p className="text-xs text-gray-500 max-w-md mx-auto">
                  {selectedTokenDate
                    ? (isHindi ? `इस तिथि के लिए कोई अस्वीकृत कंसाइनमेंट नहीं है। अन्य रिकॉर्ड देखने के लिए 'सभी तिथियां' चुनें।` : `No consignments were rejected for this selected date. Click below to view all dates.`)
                    : t("admin_no_rejected_desc")}
                </p>
                {selectedTokenDate && (
                  <button
                    onClick={() => setSelectedTokenDate('')}
                    className="bg-red-700 hover:bg-red-800 text-white font-extrabold px-4 py-2 rounded-xl text-xs shadow transition cursor-pointer"
                  >
                    {t("admin_all_dates_btn") || "Show All Dates (Latest First)"}
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-red-50/70 text-red-950 uppercase font-bold text-3xs border-b border-red-200">
                    <tr>
                      <th className="py-3.5 px-4">{t("admin_th_token_pass")}</th>
                      <th className="py-3.5 px-4">{t("admin_th_farmer")}</th>
                      <th className="py-3.5 px-4">{t("admin_th_crop_load")}</th>
                      <th className="py-3.5 px-4">{t("admin_th_rejection_pt")}</th>
                      <th className="py-3.5 px-4">{t("admin_th_reason_officer")}</th>
                      <th className="py-3.5 px-4 text-right">{t("admin_th_status")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {rejectedTokens.map((p) => (
                      <tr key={p.token_id} className="hover:bg-red-50/30 transition-colors">
                        <td className="py-3.5 px-4">
                          <span className="font-mono font-bold text-red-900 block">{p.token_id}</span>
                          <span className="text-3xs text-gray-500 font-mono font-semibold">Pass: {p.gate_pass || 'N/A'}</span>
                          <span className="text-3xs text-red-800 font-medium block mt-0.5">📅 {p.slot_date ? formatDateDisplay(p.slot_date) : p.booking_date ? formatDateDisplay(p.booking_date) : 'N/A'}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-extrabold text-gray-900 block">{p.farmer_name}</span>
                          <span className="text-3xs text-gray-400 font-mono">{p.farmer_phone}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="text-gray-900 block">{getCropDisplayName(p.crop_type, t)}</span>
                          <span className="text-3xs text-gray-500 font-bold">{p.estimated_weight_quintals || 45} Qtl</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-900 rounded-full font-extrabold text-3xs uppercase">
                            <span>{t("admin_station")} {p.rejection_stage || 3}:</span>
                            <span>{p.rejection_stage === 4 ? t("admin_st4_title") : t("admin_st3_title")}</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-4 max-w-xs">
                          <span className="text-red-950 font-bold text-xs block leading-tight">{p.rejection_reason || 'Standards not met'}</span>
                          <span className="text-3xs text-gray-400 block mt-0.5 font-mono">
                            By {p.rejected_by || 'Quality Officer'} &bull; {p.rejected_at ? new Date(p.rejected_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Logged'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-600 text-white rounded-md text-3xs font-extrabold uppercase shadow-2xs">
                            <span>🚫</span>
                            <span>{isHindi ? 'अस्वीकृत' : 'Rejected'}</span>
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
                {t("admin_capacity_telemetry")}
              </span>
              <h3 className="text-xl font-black text-gray-900 mt-1">{t("admin_capacity_title")}</h3>
            </div>
            
            <span className="text-xs text-gray-400 font-medium">
              {t("admin_last_synced")} <strong className="text-gray-700 font-mono">{lastSyncedTime}</strong>
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
                        {t("admin_target_date_badge")}
                      </span>
                      <h4 className="text-lg font-black text-white mt-1 flex items-center gap-2">
                        <span>📅</span> {t("admin_quota_sched")} {formatDateDisplay(shiftDate)}
                      </h4>
                      <p className="text-xs text-emerald-200/80 mt-0.5">
                        {t("admin_quota_sched_desc")}
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
                        {t("admin_today_btn")}
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
                        {t("admin_tomorrow_btn")}
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
                        {t("admin_in_2_days_btn")}
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
                      <span className="text-gray-400 font-semibold block text-3xs uppercase">{t("admin_facility_label")}</span>
                      <span className="font-extrabold text-gray-900 text-sm truncate block mt-0.5">{managerCentre.name}</span>
                    </div>

                    <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200">
                      <span className="text-emerald-700 font-semibold block text-3xs uppercase">{t("admin_avail_label")} {formatDateDisplay(shiftDate)}</span>
                      <span className="text-lg font-black text-emerald-950 block mt-0.5">{dateAvail.toLocaleString()} Q</span>
                    </div>

                    <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200">
                      <span className="text-gray-400 font-semibold block text-3xs uppercase">{t("admin_booked_label")} {formatDateDisplay(shiftDate)}</span>
                      <span className="text-lg font-black text-gray-900 block mt-0.5">{dateBooked.toLocaleString()} Q</span>
                    </div>

                    <div className="p-3.5 bg-emerald-100/60 rounded-2xl border border-emerald-300">
                      <span className="text-emerald-900 font-bold block text-3xs uppercase">{t("admin_daily_limit_label")} ({formatDateDisplay(shiftDate)})</span>
                      <span className="text-lg font-black text-emerald-950 block mt-0.5">{dateMax.toLocaleString()} Q</span>
                    </div>
                  </div>

                  {/* Progress Bar for Selected Date */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-2xs font-extrabold">
                      <span className="text-gray-500">{t("admin_utilization_label")} {formatDateDisplay(shiftDate)}:</span>
                      <span className={percent >= 85 ? 'text-red-600' : 'text-emerald-700'}>{percent}% {t("admin_capacity_booked")} ({dateBooked} Q / {dateMax} Q)</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3.5 overflow-hidden p-0.5 border border-gray-200 shadow-inner">
                      <div 
                        className={`h-full rounded-full transition-all duration-700 ${
                          percent >= 85 ? 'bg-red-500' : percent >= 60 ? 'bg-amber-500' : 'bg-emerald-600'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Controls Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    
                    {/* Manual Quota Modifier for Selected Date */}
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 shadow-inner space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-extrabold text-gray-700">
                          {t("admin_set_daily_limit")} {formatDateDisplay(shiftDate)}:
                        </span>
                        <span className="text-3xs text-gray-400 font-mono">{t("admin_max_silo")} {maxCeiling} Q</span>
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
                          {t("admin_set_limit_btn")} {formatDateDisplay(shiftDate)}
                        </button>
                      </div>

                      <p className="text-3xs text-gray-400 font-medium">
                        {t("admin_allowed_on")} {formatDateDisplay(shiftDate)}: <strong className="text-gray-600">{dateBooked} Q</strong> (Booked) – <strong className="text-emerald-700">{maxCeiling} Q</strong> ({t("admin_silo_ceiling")})
                      </p>
                    </div>

                    {/* Diversion & Shifts Action */}
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 shadow-inner flex flex-col justify-between gap-3">
                      <div>
                        <span className="font-extrabold text-gray-700 text-xs block mb-1">{t("admin_shift_breakdown_label")} ({formatDateDisplay(shiftDate)}):</span>
                        <p className="text-2xs text-gray-500">
                          {t("admin_shift_breakdown_desc")}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button 
                          onClick={() => handleToggleExpand(managerCentre._id)}
                          className="bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-bold py-2 rounded-lg transition-colors shadow-sm cursor-pointer text-center"
                        >
                          {isExpanded ? t("admin_hide_shifts") : t("admin_3hr_shifts")}
                        </button>

                        <button 
                          onClick={() => handleToggleDivert(managerCentre._id, managerCentre.status)}
                          className={`text-xs font-bold py-2 rounded-lg transition-colors shadow-sm cursor-pointer text-center border ${
                            managerCentre.status === 'divert_active'
                              ? 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700'
                              : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                          }`}
                        >
                          {managerCentre.status === 'divert_active' ? t("admin_resume_intake") : t("admin_divert_traffic")}
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
                            {t("admin_daily_shift_breakdown")}
                          </p>
                          <p className="text-2xs text-gray-500">
                            {t("admin_daily_shift_desc")}
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
                              <span>{t("admin_customize_shifts")}</span>
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
                                {t("cancel") || 'Cancel'}
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
                                {isSavingShifts ? t("admin_saving") : t("admin_save_quotas")}
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
                                      <span className="text-gray-500">{t("sb_available") || 'Available'}:</span>
                                      <span className="font-extrabold text-emerald-700">{slotAvail} Q</span>
                                    </div>
                                    <div className="flex justify-between text-2xs text-gray-400">
                                      <span>{t("admin_shift_limit")}</span>
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
                                          {t("admin_shift_cap_label")}
                                        </label>
                                        <span className={`text-3xs font-bold ${isBelowFloor ? 'text-red-600 font-extrabold' : 'text-gray-400'}`}>
                                          {t("admin_shift_min")} {slotBooked} Q
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
