import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL || '';

export default function FarmerLoginModal({ isOpen, onClose, onLoginSuccess }) {
  const navigate = useNavigate();
  const [aadhar, setAadhar] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [farmerInfo, setFarmerInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isUnregistered, setIsUnregistered] = useState(false);

  const otpInputRef = useRef(null);

  useEffect(() => {
    if (otpSent && otpInputRef.current) {
      otpInputRef.current.focus();
    }
  }, [otpSent]);

  const handleSendOtp = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    setError('');
    setIsUnregistered(false);

    const cleanAadhar = aadhar.replace(/\s+/g, '');
    if (cleanAadhar.length !== 12 || !/^\d{12}$/.test(cleanAadhar)) {
      setError('Please enter a valid 12-digit Aadhaar number.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/farmers/login/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aadhar_number: cleanAadhar })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setOtpSent(true);
        setFarmerInfo({ name: data.farmer_name, masked_phone: data.masked_phone });
      } else if (res.status === 404) {
        setIsUnregistered(true);
        setError(data.error || 'This Aadhaar is not registered in AnnaSetu.');
      } else {
        setError(data.error || 'Failed to send OTP. Please try again.');
      }
    } catch (err) {
      setError('Unable to reach authentication server. Please retry.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    setError('');

    const cleanAadhar = aadhar.replace(/\s+/g, '');
    if (!otp || otp.length !== 6) {
      setError('Please enter the 6-digit OTP code.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/farmers/login/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aadhar_number: cleanAadhar, otp })
      });
      const data = await res.json();

      if (res.ok && data.success && data.farmer) {
        const sessionData = {
          aadhar: data.farmer.aadhar_number,
          name: data.farmer.name,
          phone: data.farmer.phone,
          address: data.farmer.address,
          land_size: data.farmer.land_size,
          plot_number: data.farmer.plot_number,
          bank_account_number: data.farmer.bank_account_number,
          bank_ifsc: data.farmer.bank_ifsc,
          logged_in_at: new Date().toISOString()
        };

        try {
          localStorage.setItem('farmer_session', JSON.stringify(sessionData));
          localStorage.setItem('farmer_aadhar', sessionData.aadhar);
          localStorage.setItem('farmer_name', sessionData.name);
        } catch {}

        onLoginSuccess(sessionData);
        handleClose();
      } else {
        setError(data.error || 'Invalid OTP. Please check and retry.');
      }
    } catch (err) {
      setError('Failed to verify OTP code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setAadhar('');
    setOtp('');
    setOtpSent(false);
    setFarmerInfo(null);
    setError('');
    setIsUnregistered(false);
    onClose();
  };

  const handleGoToRegister = () => {
    handleClose();
    navigate('/register');
  };

  // Auto-verify when 6-digit OTP is typed
  useEffect(() => {
    if (isOpen && otpSent && otp.length === 6 && !isLoading) {
      handleVerifyOtp();
    }
  }, [otp, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in touch-manipulation">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-w-lg w-full border-t-4 sm:border-2 border-brand overflow-hidden animate-scale-up max-h-[92vh] overflow-y-auto">
        
        {/* Modal Header */}
        <div className="p-6 sm:p-8 bg-gradient-to-b from-emerald-50/70 to-white border-b border-gray-100 flex items-start justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100/80 text-emerald-800 rounded-full text-xs font-extrabold uppercase tracking-wider mb-2">
              <span>🌾</span>
              <span>Farmer Portal</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">Farmer Login</h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5 font-medium">
              Enter your registered Aadhaar to manage your bookings and payments
            </p>
          </div>
          <button 
            onClick={handleClose}
            aria-label="Close modal"
            className="text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 w-9 h-9 rounded-full flex items-center justify-center text-base font-bold transition-colors cursor-pointer mt-1 shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-6 sm:p-8 space-y-5">
          
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs sm:text-sm text-red-700 space-y-2 animate-shake">
              <div className="flex items-center gap-2 font-semibold">
                <span className="text-base">⚠️</span>
                <span>{error}</span>
              </div>
              {isUnregistered && (
                <button
                  type="button"
                  onClick={handleGoToRegister}
                  className="text-xs font-extrabold text-emerald-800 hover:text-emerald-950 underline block cursor-pointer pl-6"
                >
                  ➔ Click here to Register as a New Farmer
                </button>
              )}
            </div>
          )}

          {!otpSent ? (
            /* STEP 1: AADHAAR ENTRY */
            <form onSubmit={handleSendOtp} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  12-Digit Aadhaar Number
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={12}
                    placeholder="Enter 12-digit Aadhaar number"
                    value={aadhar}
                    onChange={(e) => setAadhar(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-4 py-3.5 bg-gray-50/80 border-2 border-gray-200 rounded-2xl font-mono text-base font-bold text-gray-900 focus:bg-white focus:border-brand focus:ring-4 focus:ring-emerald-50 focus:outline-none transition-all placeholder:font-sans placeholder:font-normal placeholder:text-gray-400"
                  />
                  <span className="absolute right-4 top-3.5 text-xs font-bold text-gray-400 font-mono">
                    {aadhar.length}/12
                  </span>
                </div>
              </div>

              {/* Test Data Minimal Helper Box */}
              <div className="bg-gray-50 px-4 py-3 rounded-xl border border-gray-200 text-xs space-y-1.5">
                <span className="font-semibold text-gray-500 block text-3xs uppercase tracking-wider">Test Farmer Aadhaar (Universal OTP: 123456):</span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAadhar('111122223333')}
                    className="font-mono text-xs font-bold text-brand hover:underline bg-white px-2.5 py-1 rounded-lg border border-gray-200 shadow-2xs cursor-pointer"
                  >
                    111122223333 (Aman)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAadhar('222233334444')}
                    className="font-mono text-xs font-bold text-brand hover:underline bg-white px-2.5 py-1 rounded-lg border border-gray-200 shadow-2xs cursor-pointer"
                  >
                    222233334444 (Anusrita)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAadhar('333344445555')}
                    className="font-mono text-xs font-bold text-brand hover:underline bg-white px-2.5 py-1 rounded-lg border border-gray-200 shadow-2xs cursor-pointer"
                  >
                    333344445555 (Anurag)
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || aadhar.length !== 12}
                className="w-full bg-brand hover:bg-brand-dark text-white font-extrabold py-4 rounded-2xl transition-all shadow-md active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 text-sm"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Verifying with AnnaSetu...</span>
                  </>
                ) : (
                  <>
                    <span>Send Verification OTP</span>
                    <span>➔</span>
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <p className="text-xs text-gray-500 font-medium">
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={handleGoToRegister}
                    className="text-brand font-bold hover:underline cursor-pointer"
                  >
                    Register as a New Farmer
                  </button>
                </p>
              </div>
            </form>
          ) : (
            /* STEP 2: OTP VERIFICATION */
            <form onSubmit={handleVerifyOtp} className="space-y-5 animate-fade-in">
              <div className="bg-emerald-50/80 p-4 rounded-2xl border border-emerald-200 flex items-center justify-between">
                <div>
                  <span className="text-3xs font-extrabold uppercase tracking-wider text-emerald-800 block">Verified Account</span>
                  <span className="font-extrabold text-emerald-950 text-sm block">{farmerInfo?.name}</span>
                  <span className="text-xs text-emerald-700 font-mono">Mobile: {farmerInfo?.masked_phone}</span>
                </div>
                <button
                  type="button"
                  onClick={() => { setOtpSent(false); setOtp(''); }}
                  className="text-xs font-bold text-emerald-800 hover:text-emerald-950 underline cursor-pointer bg-white px-2.5 py-1 rounded-lg border border-emerald-200"
                >
                  Change
                </button>
              </div>

              <div>
                <div className="flex justify-between items-baseline mb-2">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Enter 6-Digit OTP
                  </label>
                  <span className="text-xs text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-mono">
                    Test OTP: <strong>123456</strong>
                  </span>
                </div>
                <input
                  ref={otpInputRef}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-2xl font-mono text-center text-2xl font-black tracking-widest text-gray-900 focus:bg-white focus:border-brand focus:ring-4 focus:ring-emerald-50 focus:outline-none transition-all"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setOtp('123456')}
                  className="w-1/3 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold py-3.5 rounded-2xl transition-colors cursor-pointer"
                >
                  Auto-Fill
                </button>
                <button
                  type="submit"
                  disabled={isLoading || otp.length !== 6}
                  className="w-2/3 bg-brand hover:bg-brand-dark text-white font-extrabold py-3.5 rounded-2xl transition-all shadow-md active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 text-xs"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <span>✓ Confirm Login</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

        </div>

      </div>
    </div>
  );
}
