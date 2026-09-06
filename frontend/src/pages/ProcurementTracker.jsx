import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const API_BASE = (import.meta.env.VITE_API_URL || '') + '/api/capacity';
const API_BOOKING = (import.meta.env.VITE_API_URL || '') + '/api/booking';

const getCropDisplayName = (cropName, t) => {
  if (!cropName) return '';
  const lower = cropName.toLowerCase();
  if (lower.includes('wheat') || lower.includes('गेहूं')) return t('crop_wheat') || 'Wheat';
  if (lower.includes('paddy') || lower.includes('धान')) return t('crop_paddy') || 'Paddy';
  if (lower.includes('mustard') || lower.includes('सरसों')) return t('crop_mustard') || 'Mustard';
  if (lower.includes('maize') || lower.includes('मक्का')) return t('crop_maize') || 'Maize';
  if (lower.includes('barley') || lower.includes('जौ')) return t('crop_barley') || 'Barley';
  if (lower.includes('chana') || lower.includes('चना')) return t('crop_chana') || 'Chana';
  return cropName;
};

export default function ProcurementTracker() {
  const { t, i18n } = useTranslation();
  const isHindi = i18n.language === 'hi';
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
  const [actionSuccessBanner, setActionSuccessBanner] = useState('');

  // Cancellation Modal State
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('Weather / Heavy Rain Forecast');
  const [customCancelReason, setCustomCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelFeedback, setCancelFeedback] = useState(null);

  // Rescheduling Modal State
  const [{ nowMs, todayLocal }] = useState(() => {
    const tzOffset = new Date().getTimezoneOffset() * 60000;
    const baseNow = Date.now() - tzOffset;
    return {
      nowMs: baseNow,
      todayLocal: new Date(baseNow).toISOString().split('T')[0]
    };
  });

  const rescheduleDateOptions = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => {
      const d = new Date(nowMs + i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split('T')[0];
      const [, m, day] = dateStr.split('-');
      const label = i === 0 
        ? `${isHindi ? 'आज' : 'Today'} (${day}/${m})` 
        : i === 1 
          ? `${isHindi ? 'कल' : 'Tomorrow'} (${day}/${m})` 
          : `${d.toLocaleDateString(isHindi ? 'hi-IN' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' })} (${day}/${m})`;
      return { dateStr, label };
    });
  }, [nowMs, isHindi]);

  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState(todayLocal);
  const [rescheduleSlotCode, setRescheduleSlotCode] = useState('SLOT_1_MORNING');
  const [rescheduleSlotName, setRescheduleSlotName] = useState('Slot 1: Morning (09:00 AM - 12:00 PM)');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [rescheduleFeedback, setRescheduleFeedback] = useState(null);

  // Alternates between Tractor icon and Step Number for the active milestone node
  useEffect(() => {
    const timer = setInterval(() => {
      setShowTractorIcon(prev => !prev);
    }, 1400);
    return () => clearInterval(timer);
  }, []);

  // Fetch Available Slots for Rescheduling
  const fetchSlotsForReschedule = async (centreName, targetDate) => {
    setLoadingSlots(true);
    setRescheduleFeedback(null);
    try {
      const resCentres = await fetch(`${API_BASE}/centres`);
      const dataCentres = await resCentres.json();
      if (dataCentres.success && dataCentres.centres) {
        const found = dataCentres.centres.find(c => c.name === centreName) || dataCentres.centres[0];
        if (found) {
          const resSlots = await fetch(`${API_BASE}/centres/${found._id}/slots?date=${targetDate}`);
          const dataSlots = await resSlots.json();
          if (dataSlots.success && dataSlots.slots) {
            setAvailableSlots(dataSlots.slots);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching slots for reschedule:', err);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleOpenCancelModal = () => {
    setCancelReason(isHindi ? 'वर्षा या खराब मौसम की संभावना' : 'Weather / Heavy Rain Forecast');
    setCustomCancelReason('');
    setCancelFeedback(null);
    setShowCancelModal(true);
  };

  const handleConfirmCancel = async () => {
    if (!procurement) return;
    setIsCancelling(true);
    setCancelFeedback(null);
    try {
      const res = await fetch(`${API_BOOKING}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token_id: procurement.token_id,
          farmer_aadhar: activeFarmerAadhar,
          reason: customCancelReason || cancelReason
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to cancel token');
      }
      setShowCancelModal(false);
      setActionSuccessBanner(data.message || 'Token cancelled successfully!');
      setTimeout(() => setActionSuccessBanner(''), 5000);
      await fetchProcurement(procurement.token_id, true);
      await fetchFarmerTokens();
    } catch (err) {
      setCancelFeedback(err.message);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleOpenRescheduleModal = () => {
    const nextDate = procurement?.slot_date || todayLocal;
    setRescheduleDate(nextDate);
    setRescheduleSlotCode('SLOT_1_MORNING');
    setRescheduleSlotName('Slot 1: Morning (09:00 AM - 12:00 PM)');
    setRescheduleFeedback(null);
    setShowRescheduleModal(true);
    fetchSlotsForReschedule(procurement?.centre_name, nextDate);
  };

  const handleRescheduleDateChange = (newDate) => {
    setRescheduleDate(newDate);
    fetchSlotsForReschedule(procurement?.centre_name, newDate);
  };

  const handleConfirmReschedule = async () => {
    if (!procurement) return;
    setIsRescheduling(true);
    setRescheduleFeedback(null);
    try {
      const res = await fetch(`${API_BOOKING}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token_id: procurement.token_id,
          farmer_aadhar: activeFarmerAadhar,
          new_date: rescheduleDate,
          new_slot_code: rescheduleSlotCode,
          new_slot_name: rescheduleSlotName
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reschedule slot');
      }
      setShowRescheduleModal(false);
      setActionSuccessBanner(data.message || 'Slot rescheduled successfully!');
      setTimeout(() => setActionSuccessBanner(''), 5000);
      await fetchProcurement(procurement.token_id, true);
      await fetchFarmerTokens();
    } catch (err) {
      setRescheduleFeedback(err.message);
    } finally {
      setIsRescheduling(false);
    }
  };

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
    { id: 1, title: t("tracker_st1_title"), subtitle: t("tracker_st1_sub") },
    { id: 2, title: t("tracker_st2_title"), subtitle: t("tracker_st2_sub") },
    { id: 3, title: t("tracker_st3_title"), subtitle: t("tracker_st3_sub") },
    { id: 4, title: t("tracker_st4_title"), subtitle: t("tracker_st4_sub") },
    { id: 5, title: t("tracker_st5_title"), subtitle: t("tracker_st5_sub") }
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
              <h3 className="font-extrabold text-sm sm:text-base text-gray-900">{t("tracker_passes_title")}</h3>
              <p className="text-3xs sm:text-2xs text-gray-500">
                {t("tracker_passes_desc")}
              </p>
            </div>
          </div>
          <span className="bg-emerald-100 text-emerald-900 text-3xs font-extrabold px-2.5 py-1 rounded-full">
            {myTokens.length} {t("tracker_tokens_badge")}
          </span>
        </div>

        {loadingTokens ? (
          <p className="text-xs text-gray-400 italic">{t("tracker_loading_tokens")}</p>
        ) : myTokens.length === 0 ? (
          <div className="p-6 bg-emerald-50/60 rounded-2xl border border-emerald-200 text-center space-y-2">
            <span className="text-3xl block">🌾</span>
            <h4 className="font-extrabold text-emerald-950 text-sm">{t("tracker_no_tokens")}</h4>
            <p className="text-xs text-emerald-800">{t("tracker_no_tokens_sub")}</p>
            <button 
              onClick={() => navigate('/book-slot')} 
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold px-4 py-2 rounded-xl text-xs shadow-sm cursor-pointer mt-1"
            >
              {t("tracker_book_slot_btn")}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {myTokens.map(tok => {
              const isSelected = tok.token_id === procurement?.token_id;
              const isRejected = tok.status === 'rejected';
              const isCancelled = tok.status === 'cancelled';
              const isCompleted = tok.current_stage >= 5 && !isRejected && !isCancelled;

              return (
                <div 
                  key={tok.token_id}
                  onClick={() => handleSelectChip(tok.token_id)}
                  className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                    isSelected
                      ? isRejected
                        ? 'bg-red-50 border-red-500 shadow-md ring-2 ring-red-100'
                        : isCancelled
                          ? 'bg-gray-100 border-gray-400 shadow-md ring-2 ring-gray-200'
                          : 'bg-emerald-50 border-emerald-600 shadow-md ring-2 ring-emerald-100'
                      : isCancelled
                        ? 'bg-gray-50 border-gray-200 opacity-60 hover:opacity-100'
                        : 'bg-gray-50/80 border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/40'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-mono font-black text-xs text-gray-900">{tok.token_id}</span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                      isRejected 
                        ? 'bg-red-100 text-red-900 border border-red-300' 
                        : isCancelled
                          ? 'bg-gray-200 text-gray-800 border border-gray-300'
                          : isCompleted 
                            ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' 
                            : 'bg-amber-100 text-amber-900 border border-amber-300'
                    }`}>
                      {isRejected 
                        ? `🚫 ${t("tracker_rejected")}` 
                        : isCancelled
                          ? (t("tracker_cancelled_badge") || '🚫 Cancelled')
                          : isCompleted 
                            ? `✓ ${t("tracker_completed")}` 
                            : `${t("tracker_stage_badge")} ${tok.current_stage || 1} / 5`}
                    </span>
                  </div>
                  <p className="font-extrabold text-xs text-gray-800 mt-1 truncate">{tok.centre_name}</p>
                  <div className="flex justify-between text-3xs text-gray-500 font-medium mt-0.5">
                    <span>{getCropDisplayName(tok.crop_type, t) || 'Wheat'}</span>
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
            {t("tracker_hero_title")}
          </h2>
          <p className="text-gray-500 mb-8 text-sm max-w-md mx-auto">
            {t("tracker_hero_desc")}
          </p>
          
          <form onSubmit={handleSearch} className="max-w-md mx-auto relative mb-6">
            <input 
              type="text" 
              placeholder={t("tracker_input_placeholder")}
              value={searchToken}
              onChange={(e) => setSearchToken(e.target.value)}
              className="w-full px-5 py-4 pr-32 rounded-2xl border-2 border-gray-200 focus:border-brand focus:ring-4 focus:ring-emerald-50 outline-none uppercase font-mono tracking-wider font-bold text-gray-800 transition-all text-sm sm:text-base"
            />
            <button 
              type="submit"
              disabled={!searchToken.trim()}
              className="absolute right-2 top-2 bottom-2 bg-brand text-white px-6 rounded-xl font-bold hover:bg-brand-dark transition-all disabled:opacity-50 cursor-pointer shadow-md text-xs sm:text-sm"
            >
              {t("tracker_track_btn")}
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
        <p className="font-bold text-gray-700 animate-pulse">{t("tracker_syncing_db")}</p>
      </div>
    );
  }

  const currentStage = procurement.current_stage || 1;
  const netQuintals = procurement.net_weight_quintals || procurement.estimated_weight_quintals || 0;
  const finalPayout = procurement.gross_payout || Math.round(netQuintals * (procurement.msp_rate || 0));

  const getAuditLogs = () => {
    const logs = [];
    const baseFallback = procurement.updated_at || procurement.created_at || '2026-03-01T00:00:00Z';
    if (currentStage >= 1) {
      logs.push({
        stage: 1, title: 'Intake Slot Confirmed', notes: `Allotted Shift: ${procurement.slot_name || 'Slot 1: Morning'}`,
        timestamp: new Date(procurement.updated_at || baseFallback).toLocaleString(), officer: 'System Auto-Generated'
      });
    }
    if (currentStage >= 2) {
      logs.push({
        stage: 2, title: 'Gate Check-in Completed', notes: `Gate entry verified against security pass #${procurement.gate_pass || 'N/A'}.`,
        timestamp: new Date(procurement.gate_in_at || baseFallback).toLocaleString(), officer: 'Gate Security Guard'
      });
    }
    if (currentStage >= 3) {
      logs.push({
        stage: 3, title: 'Quality Assaying Passed', notes: `Moisture: ${procurement.moisture_percent || 'N/A'}%, Purity: ${procurement.purity_percent ? procurement.purity_percent + '%' : '99.2%'}`,
        timestamp: new Date(procurement.assayed_at || baseFallback).toLocaleString(), officer: 'Lab Inspector'
      });
    }
    if (currentStage >= 4) {
      logs.push({
        stage: 4, title: 'Weighbridge Ticket Generated', notes: `Net Weight: ${netQuintals} Quintals recorded at weighbridge.`,
        timestamp: new Date(procurement.weighed_at || baseFallback).toLocaleString(), officer: 'Weighbridge Operator'
      });
    }
    if (currentStage >= 5 && procurement.status !== 'rejected') {
      logs.push({
        stage: 5, title: 'J-Form & Payout Disbursed', notes: `₹${finalPayout.toLocaleString('en-IN')} approved via Direct Benefit Transfer.`,
        timestamp: new Date(procurement.approved_at || baseFallback).toLocaleString(), officer: 'Mandi Manager'
      });
    }
    if (procurement.status === 'rejected') {
      logs.push({
        stage: procurement.rejection_stage || 3,
        title: `Consignment Terminated at Stage ${procurement.rejection_stage || 3}`,
        notes: `REJECTED: ${procurement.rejection_reason || 'Standards not met'}. Inspected by ${procurement.rejected_by || 'Quality Officer'}.`,
        timestamp: new Date(procurement.rejected_at || procurement.updated_at || baseFallback).toLocaleString(),
        officer: procurement.rejected_by || 'Quality Officer',
        isRejected: true
      });
    }
    if (procurement.status === 'cancelled') {
      logs.push({
        stage: 1,
        title: isHindi ? 'गेट पास टोकन रद्द किया गया' : 'Gate Pass Token Cancelled',
        notes: `${isHindi ? 'रद्द करने का कारण:' : 'CANCELLED:'} ${procurement.cancellation_reason || (isHindi ? 'मंडी आगमन से पूर्व किसान द्वारा रद्द' : 'Cancelled prior to gate arrival')}. ${isHindi ? 'आरक्षित क्षमता मुक्त की गई।' : 'Reserved capacity released.'}`,
        timestamp: new Date(procurement.cancelled_at || procurement.updated_at || baseFallback).toLocaleString(),
        officer: isHindi ? 'किसान / प्रणाली' : 'Farmer / System',
        isCancelled: true
      });
    }
    return logs.reverse();
  };

  const auditLogs = getAuditLogs();

  const renderCancelModal = () => {
    if (!showCancelModal || !procurement) return null;

    const presetReasons = isHindi ? [
      'वर्षा या खराब मौसम की संभावना',
      'ट्रैक्टर या ट्रॉली में खराबी',
      'फसल कटाई में देरी / तैयार न होना',
      'व्यक्तिगत या लॉजिस्टिक्स कारण'
    ] : [
      'Weather / Heavy Rain Forecast',
      'Tractor / Trolley Breakdown',
      'Crop Harvest Delay / Not Ready',
      'Personal / Logistics Emergency'
    ];

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border-t-8 border-red-600 relative">
          <button 
            onClick={() => setShowCancelModal(false)}
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
                {isHindi ? 'पूर्व-आगमन कार्रवाई' : 'Pre-Arrival Action'}
              </span>
              <h3 className="text-lg font-black text-gray-900 mt-0.5">
                {t("tracker_cancel_modal_title")}
              </h3>
              <p className="text-xs text-gray-500 font-mono">Token: {procurement.token_id}</p>
            </div>
          </div>

          <div className="p-6 space-y-4 text-xs text-gray-800">
            <p className="text-gray-600 font-medium">
              {t("tracker_cancel_modal_desc")}
            </p>

            <div>
              <span className="text-gray-500 font-bold block text-3xs uppercase mb-1.5">
                {t("tracker_cancel_reason_label")}
              </span>
              <div className="space-y-1.5 mb-3">
                {presetReasons.map((r, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setCancelReason(r);
                      setCustomCancelReason('');
                    }}
                    className={`w-full text-left p-2.5 rounded-lg border text-xs font-medium transition cursor-pointer ${
                      cancelReason === r && !customCancelReason
                        ? 'bg-red-50 border-red-400 text-red-950 font-bold shadow-xs'
                        : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    • {r}
                  </button>
                ))}
              </div>

              <label className="block text-3xs font-bold text-gray-500 uppercase mb-1">
                {t("tracker_cancel_custom_ph")}
              </label>
              <textarea
                value={customCancelReason}
                onChange={(e) => setCustomCancelReason(e.target.value)}
                placeholder={isHindi ? 'विशिष्ट कारण दर्ज करें...' : 'Enter specific reason...'}
                className="w-full border border-gray-300 rounded-lg p-2.5 text-xs text-gray-900 focus:outline-none focus:border-red-500 font-medium"
                rows={2}
              />
            </div>

            {cancelFeedback && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-2xs font-bold">
                ⚠️ {cancelFeedback}
              </div>
            )}

            <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-2xs text-amber-900 space-y-1">
              <p className="font-bold flex items-center gap-1">
                <span>⚠️</span> {isHindi ? 'नोट:' : 'Notice:'}
              </p>
              <p>
                {isHindi 
                  ? 'रद्द करने पर यह टोकन निष्क्रिय हो जाएगा और आरक्षित स्लॉट क्षमता अन्य किसानों के लिए तुरंत उपलब्ध हो जाएगी।'
                  : 'Upon cancellation, this gate pass token will be deactivated and the reserved capacity will be immediately released.'}
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => setShowCancelModal(false)}
                disabled={isCancelling}
                className="w-1/3 bg-gray-100 text-gray-700 font-bold py-2.5 rounded-lg hover:bg-gray-200 transition-colors text-xs cursor-pointer disabled:opacity-50"
              >
                {isHindi ? 'वापस जाएं' : 'Cancel'}
              </button>
              <button 
                onClick={handleConfirmCancel}
                disabled={isCancelling}
                className="w-2/3 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-lg transition-colors shadow-md text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span>🚫</span> {isCancelling ? t("tracker_cancelling") : t("tracker_cancel_confirm_btn")}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderRescheduleModal = () => {
    if (!showRescheduleModal || !procurement) return null;

    const currentWeight = Number(procurement.estimated_weight_quintals) || 45;

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in overflow-y-auto">
        <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border-t-8 border-emerald-600 relative my-8">
          <button 
            onClick={() => setShowRescheduleModal(false)}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl font-bold p-1 cursor-pointer"
          >
            ✕
          </button>

          <div className="p-6 bg-emerald-50/60 border-b border-gray-100 flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-100 rounded-full border-2 border-emerald-300 flex items-center justify-center text-2xl shadow-inner shrink-0 text-emerald-800">
              📅
            </div>
            <div>
              <span className="text-3xs font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                {isHindi ? 'रोलिंग 7-दिवसीय शेड्यूलिंग' : 'Rolling 7-Day Window'}
              </span>
              <h3 className="text-lg font-black text-gray-900 mt-0.5">
                {t("tracker_reschedule_modal_title")}
              </h3>
              <p className="text-xs text-gray-500 font-mono">Token: {procurement.token_id} • {currentWeight} Qtl</p>
            </div>
          </div>

          <div className="p-6 space-y-4 text-xs text-gray-800">
            <p className="text-gray-600 font-medium">
              {t("tracker_reschedule_modal_desc")}
            </p>

            {/* 1. Date Selector */}
            <div>
              <label className="block text-3xs font-bold text-gray-500 uppercase mb-1.5">
                {isHindi ? 'नई मंडी आगमन तिथि चुनें:' : 'Select New Arrival Date:'}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {rescheduleDateOptions.map((opt) => {
                  const isSelected = rescheduleDate === opt.dateStr;
                  return (
                    <button
                      key={opt.dateStr}
                      type="button"
                      onClick={() => handleRescheduleDateChange(opt.dateStr)}
                      className={`p-2 rounded-xl border text-center font-bold text-xs transition cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm'
                          : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-emerald-50 hover:border-emerald-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Shift Slots Selector */}
            <div>
              <label className="block text-3xs font-bold text-gray-500 uppercase mb-1.5">
                {isHindi ? '3-घंटे की शिफ्ट चुनें:' : 'Select 3-Hour Intake Shift:'}
              </label>
              {loadingSlots ? (
                <div className="py-6 text-center text-gray-400 italic">
                  <span className="inline-block animate-spin mr-1.5">⏳</span> {isHindi ? 'शिफ्ट क्षमता जांची जा रही है...' : 'Checking live shift capacity...'}
                </div>
              ) : availableSlots.length === 0 ? (
                <p className="text-xs text-gray-400 italic">{isHindi ? 'स्लॉट लोड हो रहे हैं...' : 'Loading slots...'}</p>
              ) : (
                <div className="space-y-2">
                  {availableSlots.map((s) => {
                    const maxCap = s.max_capacity_quintals || 400;
                    const booked = s.booked_capacity_quintals || 0;
                    const avail = Math.max(0, maxCap - booked);
                    const isFull = avail < currentWeight;
                    const isSelected = rescheduleSlotCode === s.slot_code;

                    return (
                      <div
                        key={s.slot_code}
                        onClick={() => {
                          if (!isFull) {
                            setRescheduleSlotCode(s.slot_code);
                            setRescheduleSlotName(s.slot_name);
                          }
                        }}
                        className={`p-3 rounded-xl border-2 transition-all flex items-center justify-between ${
                          isFull
                            ? 'bg-gray-100 border-gray-200 opacity-50 cursor-not-allowed'
                            : isSelected
                              ? 'bg-emerald-50 border-emerald-600 shadow-sm cursor-pointer ring-2 ring-emerald-100'
                              : 'bg-white border-gray-200 hover:border-emerald-300 cursor-pointer'
                        }`}
                      >
                        <div>
                          <p className="font-extrabold text-xs text-gray-900">{s.slot_name}</p>
                          <p className="text-3xs text-gray-500 mt-0.5">
                            {isHindi ? 'उपलब्ध क्षमता:' : 'Available Capacity:'} <strong className={avail > 100 ? 'text-emerald-700' : 'text-amber-700'}>{avail} Q</strong> / {maxCap} Q
                          </p>
                        </div>
                        <span className={`text-2xs font-extrabold px-2 py-0.5 rounded-full uppercase ${
                          isFull 
                            ? 'bg-red-100 text-red-700' 
                            : isSelected 
                              ? 'bg-emerald-700 text-white' 
                              : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {isFull ? (isHindi ? 'भर गया' : 'Full') : isSelected ? '✓ Selected' : (isHindi ? 'उपलब्ध' : 'Available')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {rescheduleFeedback && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-2xs font-bold">
                ⚠️ {rescheduleFeedback}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => setShowRescheduleModal(false)}
                disabled={isRescheduling}
                className="w-1/3 bg-gray-100 text-gray-700 font-bold py-2.5 rounded-lg hover:bg-gray-200 transition-colors text-xs cursor-pointer disabled:opacity-50"
              >
                {isHindi ? 'रद्द करें' : 'Cancel'}
              </button>
              <button 
                onClick={handleConfirmReschedule}
                disabled={isRescheduling || loadingSlots}
                className="w-2/3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-lg transition-colors shadow-md text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span>📅</span> {isRescheduling ? t("tracker_rescheduling") : t("tracker_reschedule_confirm_btn")}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="py-4 px-3 sm:py-8 sm:px-6 max-w-5xl mx-auto font-sans space-y-4 sm:space-y-6">
      {renderCancelModal()}
      {renderRescheduleModal()}
      
      {/* Action Success Toast Banner */}
      {actionSuccessBanner && (
        <div className="bg-emerald-700 text-white p-3.5 rounded-2xl text-xs font-bold flex items-center justify-between shadow-lg animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="text-base">✓</span>
            <span>{actionSuccessBanner}</span>
          </div>
          <button onClick={() => setActionSuccessBanner('')} className="text-emerald-200 hover:text-white font-black text-sm cursor-pointer">✕</button>
        </div>
      )}
      
      {/* 🧑‍🌾 My Consignment Passes Hub */}
      {renderFarmerTokensHub()}

      {/* Tracker Header */}
      <div className="bg-gradient-to-r from-gray-900 to-slate-800 text-white p-4 sm:p-8 rounded-2xl sm:rounded-3xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6 relative overflow-hidden">
        
        {/* Subtle background icon */}
        <div className="absolute right-0 top-0 text-8xl sm:text-9xl opacity-5 pointer-events-none transform translate-x-4 -translate-y-4">
          🚛
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="bg-white/20 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest backdrop-blur-sm border border-white/10">
              {t("tracker_live_badge")}
            </span>
            {procurement.status === 'rejected' ? (
              <span className="bg-red-500/90 text-white px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest">
                {t("tracker_terminated_badge")}
              </span>
            ) : procurement.status === 'cancelled' ? (
              <span className="bg-amber-600 text-white px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                <span>🚫</span> {isHindi ? 'रद्द टोकन' : 'Cancelled Token'}
              </span>
            ) : isRefreshing ? (
              <span className="flex items-center gap-1 text-[10px] text-emerald-300 font-bold ml-1 sm:ml-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> {t("tracker_syncing")}
              </span>
            ) : null}
          </div>
          
          <h1 className="text-xl sm:text-3xl font-black tracking-tight font-mono text-emerald-300">
            {procurement.token_id}
          </h1>
          
          <p className="text-slate-300 mt-1 sm:mt-2 text-xs sm:text-sm font-medium">
            {t("tracker_mandi_label")} <span className="text-white font-bold">{procurement.centre_name}</span> &bull; {t("tracker_farmer_label")} <span className="text-white font-bold">{procurement.farmer_name}</span>
          </p>
          
          <div className="mt-2.5 sm:mt-3 flex gap-3 text-xs font-bold text-slate-300">
            <button 
              onClick={handleResetSearch}
              className="text-slate-300 hover:text-white cursor-pointer flex items-center gap-1.5 transition-colors font-medium text-xs"
            >
              <span>🔍</span> {t("tracker_track_another")}
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
            {isRefreshing ? t("tracker_refreshing") : t("tracker_refresh_btn")}
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
                {(t("tracker_terminated_badge") || '').replace(/^🚫\s*/, '')}
              </span>
              <h3 className="text-base sm:text-xl font-black text-red-950 mt-0.5">
                {procurement.rejection_stage === 4 ? t("tracker_rejected_at_st4") : t("tracker_rejected_at_st3")}
              </h3>
            </div>
          </div>

          <div className="bg-white/90 rounded-xl p-3 sm:p-4 border border-red-200 text-xs sm:text-sm space-y-1.5 shadow-2xs">
            <p className="text-gray-800 font-medium">
              <strong className="text-red-900">{t("tracker_official_reason")}</strong> {procurement.rejection_reason || 'Grain lot did not comply with prescribed Mandi tolerance thresholds.'}
            </p>
            <div className="flex items-center justify-between text-2xs text-gray-500 pt-1 border-t border-gray-100 flex-wrap gap-2">
              <span>{t("tracker_inspecting_auth")} <strong className="text-gray-800">{procurement.rejected_by || 'Mandi Inspection Officer'}</strong></span>
              <span className="font-mono">{procurement.rejected_at || procurement.updated_at ? new Date(procurement.rejected_at || procurement.updated_at).toLocaleString() : ''}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-red-900">
            <span>⚠️</span>
            <span>{t("tracker_exit_note")}</span>
          </div>
        </div>
      )}

      {/* CANCELLATION HERO ALERT CARD (Visible when status === 'cancelled') */}
      {procurement.status === 'cancelled' && (
        <div className="bg-amber-50/70 border-2 border-amber-400 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-md animate-fade-in space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center text-2xl font-black shrink-0 border border-amber-300">
              🚫
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-900 bg-amber-200 px-2.5 py-0.5 rounded-full">
                {(t("tracker_cancelled_badge") || '').replace(/^🚫\s*/, '')}
              </span>
              <h3 className="text-base sm:text-xl font-black text-amber-950 mt-0.5">
                {t("tracker_pass_cancelled_title")}
              </h3>
            </div>
          </div>

          <div className="bg-white rounded-xl p-3 sm:p-4 border border-amber-200 text-xs sm:text-sm space-y-1.5 shadow-2xs">
            <p className="text-gray-800 font-medium">
              <strong className="text-gray-900">{t("tracker_official_reason")}</strong> {procurement.cancellation_reason || (isHindi ? 'मंडी आगमन से पूर्व किसान द्वारा रद्द।' : 'Cancelled by farmer prior to gate check-in.')}
            </p>
            <div className="flex items-center justify-between text-2xs text-gray-500 pt-1 border-t border-gray-100 flex-wrap gap-2">
              <span>{isHindi ? 'स्थिति: आरक्षित स्लॉट क्षमता तुरंत मुक्त कर दी गई है' : 'Status: Reserved slot capacity released back to Mandi'}</span>
              <span className="font-mono">{procurement.cancelled_at || procurement.updated_at ? new Date(procurement.cancelled_at || procurement.updated_at).toLocaleString() : ''}</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 flex-wrap gap-3">
            <p className="text-xs text-gray-600 font-medium">{t("tracker_pass_cancelled_desc")}</p>
            <button
              onClick={() => navigate('/book-slot')}
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold px-4 py-2 rounded-xl text-xs shadow-sm cursor-pointer shrink-0 transition"
            >
              {t("tracker_book_slot_btn")}
            </button>
          </div>
        </div>
      )}

      {/* PRE-GATE ARRIVAL ACTIONS (Stage 1 Reschedule & Cancel Controls) */}
      {currentStage === 1 && procurement.status === 'in_progress' && (
        <div className="bg-emerald-900 text-white p-4 sm:p-5 rounded-2xl shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs border border-emerald-700/60 animate-fade-in">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚡</span>
            <div>
              <h4 className="font-extrabold text-sm sm:text-base text-emerald-100">
                {isHindi ? 'मंडी आगमन से पूर्व विकल्प' : 'Pre-Gate Arrival Options'}
              </h4>
              <p className="text-2xs text-emerald-300">
                {isHindi 
                  ? 'गेट चेक-इन (स्टेज 2) से पहले आप कभी भी स्लॉट रीशेड्यूल या टोकन रद्द कर सकते हैं।' 
                  : 'You can reschedule your appointment or cancel this token anytime prior to gate check-in.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 pt-1 sm:pt-0">
            <button
              onClick={handleOpenRescheduleModal}
              className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 px-3.5 py-2 rounded-xl font-bold transition shadow-sm cursor-pointer flex items-center gap-1.5 text-xs"
            >
              <span>📅</span> {t("tracker_reschedule_btn")}
            </button>
            <button
              onClick={handleOpenCancelModal}
              className="bg-red-500/90 hover:bg-red-500 text-white px-3.5 py-2 rounded-xl font-bold transition shadow-sm cursor-pointer flex items-center gap-1.5 text-xs"
            >
              <span>🚫</span> {t("tracker_cancel_btn")}
            </button>
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
              procurement.status === 'rejected' 
                ? 'bg-gradient-to-r from-emerald-500 to-red-500' 
                : procurement.status === 'cancelled'
                ? 'bg-amber-500'
                : 'bg-brand'
            }`}
            style={{ 
              width: `${(Math.max(1, Math.min(procurement.status === 'rejected' ? (procurement.rejection_stage || 3) : procurement.status === 'cancelled' ? 1 : currentStage, 5)) - 1) * 20}%` 
            }}
          ></div>

          {/* Nodes */}
          <div className="relative z-10 flex justify-between">
            {STAGES.map((stage) => {
              const isRejected = procurement.status === 'rejected';
              const isCancelledStatus = procurement.status === 'cancelled';
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
                      <p className={`text-[10px] font-medium ${isRejectionNode ? 'text-red-600 font-bold' : isPassedBefore ? stage.subtitle : t("tracker_cancelled")}`}>
                        {isRejectionNode ? `🚫 ${t("tracker_rejected")}` : isPassedBefore ? stage.subtitle : t("tracker_cancelled")}
                      </p>
                    </div>
                  </div>
                );
              }

              if (isCancelledStatus) {
                const isCancelledNode = stage.id === 1;

                return (
                  <div key={stage.id} className="flex flex-col items-center w-[20%] relative group">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-sm border-4 transition-all duration-300 ${
                      isCancelledNode
                        ? 'bg-amber-600 text-white border-amber-200 shadow-[0_0_18px_rgba(217,119,6,0.5)] scale-110'
                        : 'bg-gray-50 text-gray-300 border-gray-100 opacity-40'
                    }`}>
                      {isCancelledNode ? '🚫' : '-'}
                    </div>
                    
                    <div className="mt-4 text-center">
                      <p className={`text-xs font-black uppercase tracking-wider mb-1 ${
                        isCancelledNode ? 'text-amber-900 font-extrabold' : 'text-gray-300 line-through'
                      }`}>
                        {isCancelledNode ? (isHindi ? 'स्लॉट बुकिंग रद्द' : 'Slot Cancelled') : stage.title}
                      </p>
                      <p className={`text-[10px] font-medium ${isCancelledNode ? 'text-amber-700 font-bold' : 'text-gray-400'}`}>
                        {isCancelledNode ? (isHindi ? 'मंडी आगमन से पूर्व रद्द' : 'Cancelled Pre-Gate') : t("tracker_cancelled")}
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
            procurement.status === 'rejected' ? 'text-red-700 font-black' : procurement.status === 'cancelled' ? 'text-amber-700 font-black' : 'text-gray-400'
          }`}>
            {procurement.status === 'rejected' 
              ? `🚫 ${t("tracker_terminated_at")} ${procurement.rejection_stage || 3} / 5`
              : procurement.status === 'cancelled'
              ? `🚫 ${isHindi ? 'मंडी आगमन से पूर्व रद्द (चरण 1)' : 'Cancelled Pre-Gate Arrival (Stage 1)'}`
              : `${t("tracker_intake_stages")} (${currentStage}/5)`
            }
          </span>
          <div className="relative pl-6 space-y-5 before:absolute before:left-3 before:top-3 before:bottom-3 before:w-0.5 before:bg-gray-200">
            {STAGES.map((stage) => {
              const isRejected = procurement.status === 'rejected';
              const isCancelledStatus = procurement.status === 'cancelled';
              const rejectionStage = procurement.rejection_stage || 3;

              if (isRejected) {
                const isPassedBefore = stage.id < rejectionStage;
                const isRejectionNode = stage.id === rejectionStage;

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
                            🚫 {t("tracker_rejected")}
                          </span>
                        )}
                      </div>
                      <p className={`text-3xs mt-0.5 font-medium ${
                        isRejectionNode ? 'text-red-700 font-bold' : 'text-gray-500'
                      }`}>
                        {isRejectionNode 
                          ? (procurement.rejection_reason || 'Standards not met') 
                          : stage.subtitle
                        }
                      </p>
                    </div>
                  </div>
                );
              }

              if (isCancelledStatus) {
                const isCancelledNode = stage.id === 1;

                return (
                  <div key={stage.id} className="relative flex items-center gap-3.5">
                    <div className={`absolute -left-6 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs border-2 z-10 transition-all ${
                      isCancelledNode
                        ? 'bg-amber-600 text-white border-amber-300 ring-4 ring-amber-100 scale-110 shadow-sm'
                        : 'bg-gray-100 text-gray-300 border-gray-200'
                    }`}>
                      {isCancelledNode ? '🚫' : '-'}
                    </div>

                    <div className={`flex-1 p-3 rounded-xl border transition-all ${
                      isCancelledNode
                        ? 'bg-amber-50/90 border-2 border-amber-400 shadow-sm'
                        : 'bg-white border-gray-100 opacity-40'
                    }`}>
                      <div className="flex items-center justify-between">
                        <h4 className={`text-xs font-extrabold uppercase tracking-wide ${
                          isCancelledNode ? 'text-amber-950 font-black' : 'text-gray-400 line-through'
                        }`}>
                          {isCancelledNode ? (isHindi ? 'स्लॉट बुकिंग रद्द' : 'Slot Booking Cancelled') : stage.title}
                        </h4>
                        {isCancelledNode && (
                          <span className="text-3xs font-black bg-amber-600 text-white px-2 py-0.5 rounded-full uppercase shadow-xs">
                            {t("tracker_cancelled_badge") || '🚫 Cancelled'}
                          </span>
                        )}
                      </div>
                      <p className={`text-3xs mt-0.5 font-medium ${
                        isCancelledNode ? 'text-amber-800 font-bold' : 'text-gray-400'
                      }`}>
                        {isCancelledNode 
                          ? (procurement.cancellation_reason || (isHindi ? 'मंडी आगमन से पूर्व रद्द' : 'Cancelled prior to gate arrival'))
                          : t("tracker_cancelled")
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
                          {t("tracker_live_active")}
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
            {t("tracker_payout_success")}
          </h2>
          <p className="text-sm text-emerald-700 max-w-lg mx-auto mb-6">
            {t("tracker_jform_approved")}
          </p>
          
          <div className="inline-block bg-white px-8 py-4 rounded-2xl shadow-sm border border-emerald-100">
            <span className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{t("tracker_final_payout")}</span>
            <span className="block text-4xl font-black text-emerald-600">₹{finalPayout.toLocaleString('en-IN')}</span>
          </div>
        </div>
      )}

      {/* Official Audit Trail & Officer Logs */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-6 mb-8">
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
          <span>📜</span> {t("tracker_audit_logs")}
        </h3>

        <div className="divide-y divide-gray-100">
          {auditLogs.map((log, i) => (
            <div key={i} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-start gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5 ${
                  log.isCancelled
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : log.isRejected
                    ? 'bg-red-100 text-red-800 border border-red-300'
                    : 'bg-green-100 text-green-800'
                }`}>
                  {log.isCancelled ? '🚫' : log.isRejected ? '✕' : log.stage}
                </div>
                <div>
                  <div className={`font-bold ${log.isCancelled ? 'text-amber-950' : log.isRejected ? 'text-red-950' : 'text-gray-900'}`}>{log.title}</div>
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
