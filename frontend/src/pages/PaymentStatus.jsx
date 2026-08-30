import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

const API_BASE = (import.meta.env.VITE_API_URL || '') + '/api/payments';

export default function PaymentStatus() {
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
    const bankAcc = selectedReceipt.bank_account_number || '000012345678';
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
                Department of Food & Public Distribution
              </span>
              <h2 className="text-xl font-black text-gray-900 mt-1">Official DBT Payment Voucher</h2>
              <p className="text-xs text-gray-500 font-mono">UTR: {selectedReceipt.transaction_utr || 'UTR-2026-PFMS-88124'}</p>
            </div>
          </div>

          {/* Voucher Body Details */}
          <div className="p-6 space-y-4 text-xs">
            
            {/* Citizen & Lot Grid */}
            <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3.5 rounded-xl border border-gray-200">
              <div>
                <span className="text-gray-400 font-semibold block text-3xs uppercase">Beneficiary Kisan</span>
                <span className="font-extrabold text-gray-900 text-sm">
                  {selectedReceipt.farmer_name || localStorage.getItem('farmer_name') || 'Registered Kisan'}
                </span>
                <span className="text-gray-500 block text-3xs font-mono mt-0.5">Aadhaar: •••• •••• {selectedReceipt.farmer_aadhar?.slice(-4) || '••••'}</span>
              </div>
              <div>
                <span className="text-gray-400 font-semibold block text-3xs uppercase">J-Form Reference</span>
                <span className="font-extrabold text-emerald-800 text-sm font-mono">{selectedReceipt.j_form_number || 'JF-2026-98124'}</span>
                <span className="text-gray-500 block text-3xs font-mono mt-0.5">Token: {selectedReceipt.token_id || 'AS-2026-WHT-7821'}</span>
              </div>
            </div>

            {/* Procurement Math */}
            <div className="grid grid-cols-3 gap-2">
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-center">
                <span className="text-3xs text-emerald-800 font-bold uppercase block">Procured Weight</span>
                <span className="text-base font-black text-emerald-950">{weight} Qtl</span>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-center">
                <span className="text-3xs text-blue-800 font-bold uppercase block">Govt. MSP Rate</span>
                <span className="text-base font-black text-blue-950">₹{rate} /Q</span>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg border border-purple-200 text-center">
                <span className="text-3xs text-purple-800 font-bold uppercase block">Gunny Bags</span>
                <span className="text-base font-black text-purple-950">{Math.round(weight * 2)} Bags</span>
              </div>
            </div>

            {/* Bank KYC Target */}
            <div className="border-t border-dashed border-gray-300 pt-3 space-y-1.5 font-medium">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Credited Bank:</span>
                <span className="font-bold text-gray-800">State Bank of India</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Bank Account No:</span>
                <span className="font-mono font-bold text-gray-900">•••• •••• {bankAcc.slice(-4)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Bank IFSC Code:</span>
                <span className="font-mono font-bold text-emerald-800">{ifsc}</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-gray-100">
                <span className="text-gray-500">Disbursal Timestamp:</span>
                <span className="font-mono font-bold text-gray-800">
                  {selectedReceipt.disbursed_at ? new Date(selectedReceipt.disbursed_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                </span>
              </div>
            </div>

            {/* Total Payout Banner */}
            <div className="bg-emerald-600 text-white p-4 rounded-xl text-center shadow-md relative overflow-hidden">
              <span className="text-3xs font-extrabold uppercase tracking-widest text-emerald-200 block mb-1">
                Net Direct Benefit Transfer (DBT) Amount
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
                Close
              </button>
              <button 
                onClick={() => window.print()}
                className="w-2/3 bg-emerald-600 text-white font-bold py-2.5 rounded-lg hover:bg-emerald-700 transition-colors shadow-md text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>🖨️</span> Print / Save PDF Receipt
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
              Direct Benefit Transfer (DBT) Portal
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">Kisan Payment Settlement</h1>
            <p className="text-xs sm:text-sm text-emerald-200 mt-1 sm:mt-2 font-medium">
              Real-time PFMS bank disbursal tracking & instant digital J-Form settlement vouchers.
            </p>
          </div>

          {/* Quick Metrics Badge */}
          <div className="bg-white/10 backdrop-blur-md p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-white/20 text-center min-w-0 sm:min-w-[200px] shrink-0">
            <span className="text-[10px] sm:text-3xs font-extrabold uppercase text-emerald-300 tracking-wider block">Total Disbursed to Date</span>
            <span className="text-2xl sm:text-3xl font-black text-white mt-0.5 sm:mt-1 block">₹{totalDisbursed.toLocaleString('en-IN')}</span>
            <span className="text-[10px] sm:text-3xs text-emerald-200 block mt-0.5 sm:mt-1">
              Beneficiary: {localStorage.getItem('farmer_name') || (payments.length > 0 ? payments[0].farmer_name : 'Registered Kisan')}
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
            🌾 Latest Payout
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 sm:px-5 sm:py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'bg-white text-emerald-900 shadow-md scale-105'
                : 'text-emerald-200 hover:bg-white/10'
            }`}
          >
            📋 All Records ({payments.length})
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="py-20 text-center text-gray-500">
          <div className="inline-block w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-sm font-semibold">Loading verified DBT records from PFMS gateway...</p>
        </div>
      ) : payments.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-gray-200 text-center shadow-sm space-y-4">
          <span className="text-5xl block">🌾</span>
          <h3 className="text-xl font-extrabold text-gray-900">No Disbursals on Record Yet</h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto">
            Once your grain is procured and approved at Stage 5 in the Mandi, your MSP payout and official settlement receipt will appear here automatically.
          </p>
          <button
            onClick={() => navigate('/book-slot')}
            className="mt-2 bg-emerald-600 text-white font-bold px-6 py-2.5 rounded-xl hover:bg-emerald-700 transition shadow text-xs cursor-pointer"
          >
            Book Mandi Slot
          </button>
        </div>
      ) : (
        <>
          {activeTab === 'latest' && latestPayment && (
            <div className="bg-white rounded-3xl border border-gray-200 p-6 md:p-8 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-gray-100 pb-4">
                <div>
                  <span className="text-3xs font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-md">
                    {latestPayment.crop_type}
                  </span>
                  <h3 className="text-xl font-extrabold text-gray-900 mt-1.5">
                    Settlement for Token #{latestPayment.token_id}
                  </h3>
                  <p className="text-xs text-gray-500 font-mono">J-Form: {latestPayment.j_form_number}</p>
                </div>
                <button
                  onClick={() => setSelectedReceipt(latestPayment)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition shadow-md flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <span>📄</span> View Digital Receipt
                </button>
              </div>

              {/* 3-Step Live DBT Stepper */}
              <div className="space-y-3">
                <span className="text-xs font-extrabold uppercase tracking-wider text-gray-500">
                  Direct Benefit Transfer Progress
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center gap-3">
                    <span className="w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center font-black text-xs shrink-0">✓</span>
                    <div>
                      <span className="text-xs font-bold text-gray-900 block">1. J-Form Approved</span>
                      <span className="text-3xs text-emerald-700 font-medium">MSP Calculated</span>
                    </div>
                  </div>

                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center gap-3">
                    <span className="w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center font-black text-xs shrink-0">✓</span>
                    <div>
                      <span className="text-xs font-bold text-gray-900 block">2. Treasury Cleared</span>
                      <span className="text-3xs text-emerald-700 font-medium">PFMS Batch Signed</span>
                    </div>
                  </div>

                  <div className="p-4 bg-emerald-600 text-white rounded-2xl shadow-md flex items-center gap-3">
                    <span className="w-8 h-8 bg-white text-emerald-700 rounded-full flex items-center justify-center font-black text-xs shrink-0">✓</span>
                    <div>
                      <span className="text-xs font-black block">3. DBT Bank Credited</span>
                      <span className="text-3xs text-emerald-100 font-medium">₹{latestPayment.gross_amount?.toLocaleString('en-IN')} Settled</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Details Snapshot */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-200 text-xs">
                <div>
                  <span className="text-gray-400 font-semibold block text-3xs uppercase">Gross MSP Payout</span>
                  <span className="text-lg font-black text-emerald-800">₹{latestPayment.gross_amount?.toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="text-gray-400 font-semibold block text-3xs uppercase">Net Quintals</span>
                  <span className="text-lg font-black text-gray-900">{latestPayment.net_weight_quintals} Q</span>
                </div>
                <div>
                  <span className="text-gray-400 font-semibold block text-3xs uppercase">Target Account</span>
                  <span className="font-mono font-bold text-gray-900 block mt-1">•••• {latestPayment.bank_account_number?.slice(-4) || '5678'}</span>
                </div>
                <div>
                  <span className="text-gray-400 font-semibold block text-3xs uppercase">UTR Number</span>
                  <span className="font-mono font-bold text-emerald-700 text-2xs block mt-1 truncate">{latestPayment.transaction_utr}</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                <h3 className="font-extrabold text-gray-900 text-base">All Disbursed DBT Transactions</h3>
                <span className="text-xs text-gray-500 font-medium">{payments.length} record(s)</span>
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
                        <span className="text-gray-500 block text-3xs uppercase font-bold">{p.crop_type}</span>
                        <span className="font-bold text-gray-900">{p.net_weight_quintals} Quintals</span>
                      </div>
                      <div className="text-right">
                        <span className="text-gray-400 block text-3xs uppercase font-bold">Gross MSP</span>
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
                        <span>📄</span> View Voucher
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
                      <th className="py-3 px-4">Token & J-Form</th>
                      <th className="py-3 px-4">Crop & Weight</th>
                      <th className="py-3 px-4">Gross Payout</th>
                      <th className="py-3 px-4">Bank A/C & UTR</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
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
                          <span className="text-gray-900 block">{p.crop_type}</span>
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
                            📄 Voucher
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
