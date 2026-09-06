import React, { useState, useEffect } from 'react';
import { useTranslation } from "react-i18next";
import { useSearchParams, useNavigate } from 'react-router-dom';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '').replace(/\/$/, '') + '/api/payments';

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

export default function PaymentStatus() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const farmerAadhar = searchParams.get('aadhar') || localStorage.getItem('farmer_aadhar') || '111122223333';
  const [payments, setPayments] = useState([]);
  const [totalDisbursed, setTotalDisbursed] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('latest'); // 'latest' | 'history'
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  const fetchPayments = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/farmer/${farmerAadhar}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setPayments(data.payments || []);
        setTotalDisbursed(data.total_disbursed || 0);
      }
    } catch (err) {
      console.error('Error fetching payments:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [farmerAadhar]);

  const latestPayment = payments.length > 0 ? payments[0] : null;

  const renderReceiptModal = () => {
    if (!selectedReceipt) return null;

    const isPaid = selectedReceipt.payment_status === 'PAID';
    const gross = selectedReceipt.gross_amount || 102830;
    const weight = selectedReceipt.net_weight_quintals || 45.20;
    const rate = selectedReceipt.msp_rate || 2275;
    const bankAcc = selectedReceipt.bank_account_number || 'N/A';
    const ifsc = selectedReceipt.bank_ifsc || 'SBIN0001234';

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
        <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border-t-8 border-emerald-600 relative">
          
          {/* Close Button */}
          <button 
            onClick={() => setSelectedReceipt(null)}
            aria-label="Close Receipt Modal"
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl font-bold p-1 cursor-pointer"
          >
            ✕
          </button>

          {/* Official Voucher Header */}
          <div className="p-6 bg-emerald-50/50 border-b border-gray-100 flex items-center gap-4">
            <div className="w-14 h-14 bg-white rounded-full border-2 border-emerald-400 flex items-center justify-center shadow-md p-1 shrink-0">
              <img 
                src="/logo.png" 
                alt="AnnaSetu Emblem" 
                className="w-full h-full object-cover rounded-full"
                style={{ imageRendering: '-webkit-optimize-contrast' }}
              />
            </div>
            <div>
              <span className="text-3xs font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                {t("pay_voucher_dept")}
              </span>
              <h2 className="text-xl font-black text-gray-900 mt-1">{t("pay_voucher_title")}</h2>
              <p className="text-xs text-gray-500 font-mono">UTR: {selectedReceipt.transaction_utr || 'UTR-2026-PFMS-88124'}</p>
            </div>
          </div>

          {/* Voucher Body Details */}
          <div className="p-6 space-y-4 text-xs">
            
            {/* Citizen & Lot Grid */}
            <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3.5 rounded-xl border border-gray-200">
              <div>
                <span className="text-gray-400 font-semibold block text-3xs uppercase">{t("pay_kisan_label")}</span>
                <span className="font-extrabold text-gray-900 text-sm">
                  {selectedReceipt.farmer_name || localStorage.getItem('farmer_name') || t("nav_kisan")}
                </span>
                <span className="text-gray-500 block text-3xs font-mono mt-0.5">{t("rcpt_aadhar") || "Aadhaar"}: •••• •••• {selectedReceipt.farmer_aadhar?.slice(-4) || '••••'}</span>
              </div>
              <div>
                <span className="text-gray-400 font-semibold block text-3xs uppercase">{t("pay_jform_ref")}</span>
                <span className="font-extrabold text-emerald-800 text-sm font-mono">{selectedReceipt.j_form_number || 'N/A'}</span>
                <span className="text-gray-500 block text-3xs font-mono mt-0.5">Token: {selectedReceipt.token_id || 'AS-2026-WHT-7821'}</span>
              </div>
            </div>

            {/* Procurement Math */}
            <div className="grid grid-cols-3 gap-2">
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-center">
                <span className="text-3xs text-emerald-800 font-bold uppercase block">{t("pay_procured_weight")}</span>
                <span className="text-base font-black text-emerald-950">{weight} Qtl</span>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-center">
                <span className="text-3xs text-blue-800 font-bold uppercase block">{t("pay_msp_rate_label")}</span>
                <span className="text-base font-black text-blue-950">₹{rate} /Q</span>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg border border-purple-200 text-center">
                <span className="text-3xs text-purple-800 font-bold uppercase block">{t("pay_gunny_bags")}</span>
                <span className="text-base font-black text-purple-950">{Math.round(weight * 2)} Bags</span>
              </div>
            </div>

            {/* Bank KYC Target */}
            <div className="border-t border-dashed border-gray-300 pt-3 space-y-1.5 font-medium">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">{t("pay_credited_bank")}</span>
                <span className="font-bold text-gray-800">State Bank of India</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">{t("pay_bank_ac_no")}</span>
                <span className="font-mono font-bold text-gray-900">•••• •••• {bankAcc.slice(-4)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">{t("pay_bank_ifsc")}</span>
                <span className="font-mono font-bold text-emerald-800">{ifsc}</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-gray-100">
                <span className="text-gray-500">{t("pay_disbursal_time")}</span>
                <span className="font-mono font-bold text-gray-800">
                  {selectedReceipt.disbursed_at ? new Date(selectedReceipt.disbursed_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                </span>
              </div>
            </div>

            {/* Total Payout Banner */}
            <div className="bg-emerald-600 text-white p-4 rounded-xl text-center shadow-md relative overflow-hidden">
              <span className="text-3xs font-extrabold uppercase tracking-widest text-emerald-200 block mb-1">
                {t("pay_net_dbt_amount")}
              </span>
              <span className="text-3xl font-black tracking-tight">₹{gross.toLocaleString('en-IN')}</span>
              
              <div className="mt-2 inline-flex items-center gap-1.5 bg-emerald-800/80 px-3 py-1 rounded-full text-2xs font-bold text-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>STATUS: {selectedReceipt.payment_status}</span>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => setSelectedReceipt(null)}
                className="w-1/3 bg-gray-100 text-gray-700 font-bold py-2.5 rounded-lg hover:bg-gray-200 transition-colors text-xs cursor-pointer"
              >
                {t("close")}
              </button>
              <button 
                onClick={() => window.print()}
                className="w-2/3 bg-emerald-600 text-white font-bold py-2.5 rounded-lg hover:bg-emerald-700 transition-colors shadow-md text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>🖨️</span> {t("pay_print_pdf")}
              </button>
            </div>

          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="py-4 px-3 sm:py-8 sm:px-6 space-y-4 sm:space-y-6 max-w-5xl mx-auto">
      {renderReceiptModal()}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-800 text-white p-4 sm:p-8 rounded-2xl sm:rounded-3xl shadow-xl border border-emerald-700 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 bg-emerald-700/60 border border-emerald-500/40 rounded-full text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-emerald-200 mb-2 sm:mb-3">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              {t("pay_portal_badge")}
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">{t("pay_title")}</h1>
            <p className="text-xs sm:text-sm text-emerald-200 mt-1 sm:mt-2 font-medium">
              {t("pay_subtitle")}
            </p>
          </div>

          {/* Quick Metrics Badge */}
          <div className="bg-white/10 backdrop-blur-md p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-white/20 text-center min-w-0 sm:min-w-[200px] shrink-0">
            <span className="text-[10px] sm:text-3xs font-extrabold uppercase text-emerald-300 tracking-wider block">{t("pay_total_disbursed")}</span>
            <span className="text-2xl sm:text-3xl font-black text-white mt-0.5 sm:mt-1 block">₹{totalDisbursed.toLocaleString('en-IN')}</span>
            <span className="text-[10px] sm:text-3xs text-emerald-200 block mt-0.5 sm:mt-1">
              {t("pay_beneficiary")} {localStorage.getItem('farmer_name') || (payments.length > 0 ? payments[0].farmer_name : t("nav_kisan"))}
            </span>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-emerald-700/50 flex gap-2 flex-wrap">
          <button
            onClick={() => setActiveTab('latest')}
            className={`px-4 py-2 sm:px-5 sm:py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'latest'
                ? 'bg-white text-emerald-900 shadow-md scale-105'
                : 'text-emerald-200 hover:bg-white/10'
            }`}
          >
            {t("pay_tab_latest")}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 sm:px-5 sm:py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'bg-white text-emerald-900 shadow-md scale-105'
                : 'text-emerald-200 hover:bg-white/10'
            }`}
          >
            {t("pay_tab_all")} ({payments.length})
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="py-20 text-center text-gray-500">
          <div className="inline-block w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-sm font-semibold">{t("pay_loading")}</p>
        </div>
      ) : payments.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-gray-200 text-center shadow-sm space-y-4">
          <span className="text-5xl block">🌾</span>
          <h3 className="text-xl font-extrabold text-gray-900">{t("pay_no_records")}</h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto">
            {t("pay_no_records_desc")}
          </p>
          <button
            onClick={() => navigate('/book-slot')}
            className="mt-2 bg-emerald-600 text-white font-bold px-6 py-2.5 rounded-xl hover:bg-emerald-700 transition shadow text-xs cursor-pointer"
          >
            {t("pay_book_slot_btn")}
          </button>
        </div>
      ) : (
        <>
          {activeTab === 'latest' && latestPayment && (
            <div className="bg-white rounded-3xl border border-gray-200 p-6 md:p-8 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-gray-100 pb-4">
                <div>
                  <span className="text-3xs font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-md">
                    {getCropDisplayName(latestPayment.crop_type, t)}
                  </span>
                  <h3 className="text-xl font-extrabold text-gray-900 mt-1.5">
                    {t("pay_settlement_for")}{latestPayment.token_id}
                  </h3>
                  <p className="text-xs text-gray-500 font-mono">J-Form: {latestPayment.j_form_number}</p>
                </div>
                <button
                  onClick={() => setSelectedReceipt(latestPayment)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition shadow-md flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <span>📄</span> {t("pay_view_receipt")}
                </button>
              </div>

              {/* 3-Step Live DBT Stepper */}
              <div className="space-y-3">
                <span className="text-xs font-extrabold uppercase tracking-wider text-gray-500">
                  {t("pay_dbt_progress")}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center gap-3">
                    <span className="w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center font-black text-xs shrink-0">✓</span>
                    <div>
                      <span className="text-xs font-bold text-gray-900 block">{t("pay_step1_title")}</span>
                      <span className="text-3xs text-emerald-700 font-medium">{t("pay_step1_sub")}</span>
                    </div>
                  </div>

                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center gap-3">
                    <span className="w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center font-black text-xs shrink-0">✓</span>
                    <div>
                      <span className="text-xs font-bold text-gray-900 block">{t("pay_step2_title")}</span>
                      <span className="text-3xs text-emerald-700 font-medium">{t("pay_step2_sub")}</span>
                    </div>
                  </div>

                  <div className="p-4 bg-emerald-600 text-white rounded-2xl shadow-md flex items-center gap-3">
                    <span className="w-8 h-8 bg-white text-emerald-700 rounded-full flex items-center justify-center font-black text-xs shrink-0">✓</span>
                    <div>
                      <span className="text-xs font-black block">{t("pay_step3_title")}</span>
                      <span className="text-3xs text-emerald-100 font-medium">₹{latestPayment.gross_amount?.toLocaleString('en-IN')} {t("pay_step3_sub")}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Details Snapshot */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-200 text-xs">
                <div>
                  <span className="text-gray-400 font-semibold block text-3xs uppercase">{t("pay_gross_msp")}</span>
                  <span className="text-lg font-black text-emerald-800">₹{latestPayment.gross_amount?.toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="text-gray-400 font-semibold block text-3xs uppercase">{t("pay_net_quintals")}</span>
                  <span className="text-lg font-black text-gray-900">{latestPayment.net_weight_quintals} Q</span>
                </div>
                <div>
                  <span className="text-gray-400 font-semibold block text-3xs uppercase">{t("pay_target_account")}</span>
                  <span className="font-mono font-bold text-gray-900 block mt-1">•••• {latestPayment.bank_account_number?.slice(-4) || '5678'}</span>
                </div>
                <div>
                  <span className="text-gray-400 font-semibold block text-3xs uppercase">{t("pay_utr_number")}</span>
                  <span className="font-mono font-bold text-emerald-700 text-2xs block mt-1 truncate">{latestPayment.transaction_utr}</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                <h3 className="font-extrabold text-gray-900 text-base">{t("pay_all_transactions")}</h3>
                <span className="text-xs text-gray-500 font-medium">{payments.length} {t("pay_records_count")}</span>
              </div>

              {/* MOBILE STACKED CARDS VIEW */}
              <div className="block md:hidden divide-y divide-gray-100">
                {payments.map((p) => (
                  <div key={p.payment_id} className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-extrabold text-gray-900 text-sm block">{p.token_id}</span>
                        <span className="text-3xs text-gray-400 font-mono">J-Form: {p.j_form_number}</span>
                      </div>
                      <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-md font-extrabold text-3xs uppercase">
                        {p.payment_status}
                      </span>
                    </div>

                    <div className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100 text-xs">
                      <div>
                        <span className="text-gray-500 block text-3xs uppercase font-bold">{getCropDisplayName(p.crop_type, t)}</span>
                        <span className="font-bold text-gray-900">{p.net_weight_quintals} {t("sb_quintals") || "Quintals"}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-gray-400 block text-3xs uppercase font-bold">{t("pay_gross_msp")}</span>
                        <span className="text-base font-black text-emerald-800">₹{p.gross_amount?.toLocaleString('en-IN')}</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-1">
                      <div className="text-3xs text-gray-500 font-mono">
                        A/C •••• {p.bank_account_number?.slice(-4)}
                      </div>
                      <button
                        onClick={() => setSelectedReceipt(p)}
                        className="bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1 cursor-pointer"
                      >
                        <span>📄</span> {t("pay_btn_voucher")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* DESKTOP TABLE VIEW */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-500 uppercase font-bold text-3xs border-b border-gray-200">
                    <tr>
                      <th className="py-3 px-4">{t("pay_th_token_jform")}</th>
                      <th className="py-3 px-4">{t("pay_th_crop_weight")}</th>
                      <th className="py-3 px-4">{t("pay_th_gross_payout")}</th>
                      <th className="py-3 px-4">{t("pay_th_bank_utr")}</th>
                      <th className="py-3 px-4">{t("pay_th_status")}</th>
                      <th className="py-3 px-4 text-right">{t("pay_th_action")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {payments.map((p) => (
                      <tr key={p.payment_id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-bold text-gray-900 block">{p.token_id}</span>
                          <span className="text-3xs text-gray-400 font-mono">{p.j_form_number}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-gray-900 block">{getCropDisplayName(p.crop_type, t)}</span>
                          <span className="text-3xs text-gray-500">{p.net_weight_quintals} Qtl</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-extrabold text-emerald-800 text-sm">₹{p.gross_amount?.toLocaleString('en-IN')}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-mono text-gray-800 block">•••• {p.bank_account_number?.slice(-4)}</span>
                          <span className="text-3xs text-gray-400 font-mono truncate">{p.transaction_utr}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-3xs uppercase">
                            {p.payment_status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => setSelectedReceipt(p)}
                            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-lg text-3xs font-bold transition cursor-pointer"
                          >
                            📄 {t("pay_btn_voucher")}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
