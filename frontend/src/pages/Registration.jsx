import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL || '';

export default function Registration() {
  const navigate = useNavigate();
  
  const [aadhar, setAadhar] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [alreadyRegisteredData, setAlreadyRegisteredData] = useState(null);
  
  // Reference to auto-focus the OTP input
  const otpInputRef = useRef(null);
  
  // Modal States
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  
  // Animation State for SVG drawing
  const [isDrawn, setIsDrawn] = useState(false);

  const [formStep, setFormStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    gender: '',
    address: '',
    land_size: '',
    plot_number: '',
    land_address: '',
    bank_account_number: '',
    bank_ifsc: ''
  });

  // SVG Draw Animation Effect
  useEffect(() => {
    if (showSuccessModal) {
      // 100ms delay gives the modal time to mount before we trigger the CSS transition
      const timer = setTimeout(() => setIsDrawn(true), 100);
      return () => clearTimeout(timer);
    } else {
      setIsDrawn(false);
    }
  }, [showSuccessModal]);

  // BACK BUTTON INTERCEPTOR
  useEffect(() => {
    // Only lock the back button if we are filling the form AND haven't successfully submitted yet
    if (formStep === 2 && !showSuccessModal) {
      // Push a dummy state so clicking back doesn't immediately leave
      window.history.pushState({ preventBack: true }, '');

      const handlePopState = (e) => {
        e.preventDefault();
        setShowLeaveModal(true);
        // Push the dummy state back again so they remain locked in
        window.history.pushState({ preventBack: true }, '');
      };

      const handleBeforeUnload = (e) => {
        e.preventDefault();
        e.returnValue = ''; 
      };

      window.addEventListener('popstate', handlePopState);
      window.addEventListener('beforeunload', handleBeforeUnload);

      return () => {
        window.removeEventListener('popstate', handlePopState);
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    }
  }, [formStep, showSuccessModal]);

  const handleConfirmLeave = () => {
    setShowLeaveModal(false);
    navigate('/');
  };

  // Auto-focus OTP input as soon as it appears
  useEffect(() => {
    if (otpSent && !otpVerified && otpInputRef.current) {
      otpInputRef.current.focus();
    }
  }, [otpSent, otpVerified]);

  useEffect(() => {
    if (otp.length === 6 && !otpVerified) {
      verifyOtp();
    }
  }, [otp]);

  const sendOtp = async () => {
    setError('');
    setAlreadyRegisteredData(null);
    if (aadhar.length !== 12) {
      setError('Please enter a valid 12-digit Aadhar Number.');
      return;
    }
    
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/farmers/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aadhar_number: aadhar })
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        setOtpSent(true);
      } else if (res.status === 409 || data.already_registered) {
        try {
          localStorage.setItem('farmer_aadhar', aadhar);
          if (data.farmer_name) localStorage.setItem('farmer_name', data.farmer_name);
        } catch {}
        setAlreadyRegisteredData(data);
      } else {
        setError(data.error || 'Failed to send OTP.');
      }
    } catch (err) {
      setError('Failed to connect to the server.');
    }
    setIsLoading(false);
  };

  const verifyOtp = async () => {
    setError('');
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/farmers/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aadhar_number: aadhar, otp })
      });
      const data = await res.json();
      
      if (res.ok) {
        try {
          localStorage.setItem('farmer_aadhar', aadhar);
          if (data.autoFillData?.name) localStorage.setItem('farmer_name', data.autoFillData.name);
        } catch {}
        setOtpVerified(true);
        setFormData(prev => ({
          ...prev,
          name: data.autoFillData.name,
          phone: data.autoFillData.phone,
          gender: data.autoFillData.gender,
          address: data.autoFillData.address
        }));
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to verify OTP.');
    }
    setIsLoading(false);
  };

  const handleFinalSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      const res = await fetch(`${API_BASE}/api/farmers/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, aadhar_number: aadhar })
      });
      const data = await res.json();
      
      if (res.ok) {
        const sessionData = {
          aadhar,
          name: formData.name,
          phone: formData.phone,
          address: formData.address,
          land_size: formData.land_size,
          plot_number: formData.plot_number,
          bank_account_number: formData.bank_account_number,
          bank_ifsc: formData.bank_ifsc,
          logged_in_at: new Date().toISOString()
        };
        try {
          localStorage.setItem('farmer_session', JSON.stringify(sessionData));
          localStorage.setItem('farmer_aadhar', aadhar);
          localStorage.setItem('farmer_name', formData.name);
          window.dispatchEvent(new Event('farmer-session-changed'));
        } catch {}
        // Trigger the Custom Success Modal instead of Browser Alert
        setShowSuccessModal(true);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Registration failed.');
    }
    setIsLoading(false);
  };

  // Called when user clicks "OK" on the success modal
  const handleSuccessOk = () => {
    setShowSuccessModal(false);
    navigate('/book-slot');
  };

  return (
    <>
      {/* SUCCESS MODAL */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-60 px-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center animate-fade-in-down border-b-4 border-brand">
            
            {/* SVG Drawing Animation Container */}
            <div className="relative w-28 h-28 mx-auto mb-6 flex items-center justify-center">
              
              {/* The Mathematical SVG Circle */}
              {/* Rotated -90deg so the drawing starts from the absolute top middle (12 o'clock) */}
              <svg className="absolute inset-0 w-28 h-28 transform -rotate-90" viewBox="0 0 100 100">
                {/* Background faint circle (track) */}
                <circle cx="50" cy="50" r="45" fill="none" stroke="#D1FAE5" strokeWidth="6" />
                
                {/* Animated drawing circle */}
                <circle 
                  cx="50" cy="50" r="45" 
                  fill="none" 
                  stroke="#10B981" 
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray="283"
                  strokeDashoffset={isDrawn ? "0" : "283"}
                  style={{ transition: 'stroke-dashoffset 1s ease-out' }}
                />
              </svg>

              {/* Popping Green Tick (Delayed by 600ms so it pops right when the circle finishes) */}
              <svg 
                className={`w-12 h-12 text-brand relative z-10 transition-all duration-500 delay-[600ms] transform ${isDrawn ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`} 
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            
            <h3 className={`text-2xl font-extrabold text-gray-900 mb-2 tracking-tight transition-opacity duration-500 delay-[700ms] ${isDrawn ? 'opacity-100' : 'opacity-0'}`}>
              Registration Complete!
            </h3>
            
            <p className={`text-gray-500 mb-8 font-medium transition-opacity duration-500 delay-[800ms] ${isDrawn ? 'opacity-100' : 'opacity-0'}`}>
              Your details have been successfully verified.
            </p>
            
            {/* Action Buttons - Drops in fully animated at the very end */}
            <div className={`space-y-2.5 transition-all duration-500 delay-[1000ms] ${isDrawn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
              <button 
                onClick={handleSuccessOk}
                className="w-full bg-brand text-white font-bold py-3.5 rounded-xl hover:bg-brand-dark transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 flex items-center justify-center gap-2 text-sm cursor-pointer"
              >
                <span>⚡</span>
                <span>Proceed to Slot Booking</span>
              </button>
              <button 
                onClick={() => { setShowSuccessModal(false); navigate('/'); }}
                className="w-full text-xs font-bold text-gray-500 hover:text-gray-800 py-1.5 cursor-pointer"
              >
                Go to Home Screen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WARNING MODAL FOR BACK BUTTON */}
      {showLeaveModal && !showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 px-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 md:p-8 max-w-md w-full text-center animate-fade-in-down">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Wait! Are you sure?</h3>
            <p className="text-gray-600 mb-8 font-medium">
              You need to verify yourself again if you don't complete your registration.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button 
                onClick={() => setShowLeaveModal(false)}
                className="flex-1 bg-brand text-white font-bold py-3 rounded-lg hover:bg-brand-dark transition-colors shadow-md"
              >
                Continue Filling
              </button>
              <button 
                onClick={handleConfirmLeave}
                className="flex-1 bg-gray-200 text-gray-700 font-bold py-3 rounded-lg hover:bg-gray-300 transition-colors shadow-md"
              >
                Go Back Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="py-4 px-3 sm:py-10 sm:px-4 max-w-xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-8 border-t-4 border-brand">
          
          <h2 className="text-xl sm:text-2xl font-black text-gray-900 mb-4 sm:mb-6 text-center">New Farmer Registration</h2>
          
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 border border-red-200 text-sm font-medium">
              {error}
            </div>
          )}

          {formStep === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-gray-700 font-bold mb-2">Aadhar Number (12 Digits)</label>
                <input 
                  type="text" 
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength="12"
                  disabled={otpVerified}
                  className="w-full px-4 py-3.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand disabled:bg-gray-100 disabled:text-gray-500 text-lg tracking-widest font-mono"
                  placeholder="0000 0000 0000"
                  value={aadhar}
                  onChange={(e) => setAadhar(e.target.value.replace(/[^0-9]/g, ''))}
                />
                
                {!otpSent && !alreadyRegisteredData && (
                  <button 
                    onClick={sendOtp}
                    disabled={aadhar.length !== 12 || isLoading}
                    className="mt-3 w-full bg-brand text-white font-bold py-3.5 rounded-xl hover:bg-brand-dark transition-colors disabled:opacity-50 cursor-pointer shadow-md"
                  >
                    {isLoading ? 'Sending...' : 'Send OTP'}
                  </button>
                )}

                {alreadyRegisteredData && (
                  <div className="mt-4 p-5 bg-amber-50 border-2 border-amber-300 rounded-2xl animate-fade-in-down text-center">
                    <div className="w-12 h-12 bg-amber-100 text-amber-800 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl shadow-inner">
                      ℹ️
                    </div>
                    <h4 className="text-base font-extrabold text-amber-950 mb-1">
                      Already Registered!
                    </h4>
                    <p className="text-xs text-amber-850 font-medium mb-5 leading-relaxed">
                      Aadhaar <strong className="font-mono text-gray-900">{aadhar}</strong> is already registered in AnnaSetu under <strong className="text-amber-950">{alreadyRegisteredData.farmer_name || 'Registered Kisan'}</strong>. You do not need to register again.
                    </p>
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => navigate('/book-slot')}
                        className="w-full bg-brand text-white font-bold py-3 rounded-xl hover:bg-brand-dark transition-all shadow-md cursor-pointer flex items-center justify-center gap-2 text-xs sm:text-sm"
                      >
                        <span>⚡</span>
                        <span>Proceed to Slot Booking</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate('/')}
                        className="w-full bg-white text-gray-700 border border-gray-300 font-bold py-2.5 rounded-xl hover:bg-gray-50 transition-all text-xs cursor-pointer"
                      >
                        Go to Home Screen
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAlreadyRegisteredData(null);
                          setAadhar('');
                        }}
                        className="w-full text-xs font-bold text-gray-500 hover:text-gray-800 py-1 cursor-pointer"
                      >
                        ← Enter Different Aadhaar
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {otpSent && (
                <div className="animate-fade-in-down border-t pt-4">
                  <label className="block text-gray-700 font-bold mb-4 text-center">Enter 6-Digit OTP</label>
                  
                  <div className="relative w-full flex justify-center mb-4">
                    <input 
                      ref={otpInputRef}
                      type="text" 
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength="6"
                      disabled={otpVerified}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-text z-10"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                    />
                    <div className="flex items-center space-x-2 text-3xl font-mono text-center justify-center">
                      {[0,1,2,3,4,5].map(i => (
                        <React.Fragment key={i}>
                          <span className={`w-10 h-12 flex items-center justify-center border-b-4 transition-colors ${
                            otp.length === i && !otpVerified ? 'border-brand text-brand' 
                            : otp.length > i ? 'border-gray-800 text-gray-900 font-bold' 
                            : 'border-gray-300 text-gray-400'
                          }`}>
                            {otp[i] || '-'}
                          </span>
                          {i === 2 && <span className="mx-1"></span>}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>

                  {otpVerified && <p className="text-green-600 text-sm mt-4 font-bold text-center">✓ Aadhar Verified Successfully</p>}
                </div>
              )}

              {otpSent && (
                <button 
                  onClick={() => setFormStep(2)}
                  disabled={!otpVerified}
                  className={`mt-6 w-full py-4 rounded-lg font-bold text-lg transition-all duration-300 ${
                    otpVerified 
                      ? 'bg-brand text-white shadow-lg hover:bg-brand-dark' 
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  Fill Registration Form
                </button>
              )}
              
              <div className="mt-5 pt-3 border-t border-gray-100 text-center text-[11px] text-gray-400 space-y-1">
                <p className="font-bold text-gray-500">Test Aadhaar Numbers (Universal OTP: 123456):</p>
                <p>• <span className="font-mono font-bold text-gray-700">111122223333</span> — Aman Kumar (Bihar)</p>
                <p>• <span className="font-mono font-bold text-gray-700">222233334444</span> — Anusrita Deb (Tripura)</p>
                <p>• <span className="font-mono font-bold text-gray-700">333344445555</span> — Anurag Ojha (UP)</p>
              </div>
            </div>
          )}

          {formStep === 2 && (
            <form onSubmit={handleFinalSubmit} className="space-y-5 animate-fade-in-up">
              <div className="bg-green-50 p-4 rounded-lg border border-green-200 mb-6 shadow-inner">
                <p className="text-xs text-green-800 font-bold mb-2 uppercase tracking-wide border-b border-green-200 pb-2">Aadhar Verified Data</p>
                <div className="grid grid-cols-2 gap-3 text-sm text-gray-900 mt-2">
                  <p><span className="font-semibold text-gray-600 text-xs uppercase">Name</span><br/><span className="text-base font-bold">{formData.name}</span></p>
                  <p><span className="font-semibold text-gray-600 text-xs uppercase">Gender</span><br/><span className="text-base font-bold">{formData.gender}</span></p>
                  <p><span className="font-semibold text-gray-600 text-xs uppercase">Phone</span><br/><span className="text-base font-bold">+91 {formData.phone}</span></p>
                  <p className="col-span-2"><span className="font-semibold text-gray-600 text-xs uppercase">Address</span><br/><span className="text-base font-bold">{formData.address}</span></p>
                </div>
              </div>

              <div className="border-t pt-4 mt-2">
                <h3 className="font-bold text-gray-800 mb-4">Land Details</h3>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-gray-700 font-bold mb-2 text-sm">Land Size (Acres)</label>
                    <input 
                      required
                      type="text" 
                      placeholder="e.g. 2.5"
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand"
                      value={formData.land_size}
                      onChange={(e) => setFormData({...formData, land_size: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-bold mb-2 text-sm">Plot Number</label>
                    <input 
                      required
                      type="text" 
                      placeholder="e.g. B-452"
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand"
                      value={formData.plot_number}
                      onChange={(e) => setFormData({...formData, plot_number: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-gray-700 font-bold mb-2 text-sm">Address of the Land</label>
                  <input 
                    required
                    type="text" 
                    placeholder="Village/Location of the farmland"
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand"
                    value={formData.land_address}
                    onChange={(e) => setFormData({...formData, land_address: e.target.value})}
                  />
                </div>
              </div>

              <div className="border-t pt-4 mt-4">
                <h3 className="font-bold text-gray-800 mb-4">Direct Benefit Transfer (DBT) Bank Details</h3>
                
                <div className="mb-4">
                  <label className="block text-gray-700 font-bold mb-2 text-sm">Bank Account Number</label>
                  <input 
                    required
                    type="text" 
                    inputMode="numeric"
                    placeholder="e.g. 000012345678"
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand font-mono"
                    value={formData.bank_account_number}
                    onChange={(e) => setFormData({...formData, bank_account_number: e.target.value})}
                  />
                  <p className="text-xs text-gray-500 mt-1">Must match the exact account linked to your Aadhar.</p>
                </div>

                <div>
                  <label className="block text-gray-700 font-bold mb-2 text-sm">Bank IFSC Code</label>
                  <input 
                    required
                    type="text" 
                    maxLength={11}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand uppercase font-mono"
                    placeholder="e.g. SBIN0001234"
                    value={formData.bank_ifsc}
                    onChange={(e) => setFormData({...formData, bank_ifsc: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')})}
                  />
                </div>
              </div>

              <button 
                type="submit"
                disabled={isLoading}
                className="mt-6 w-full bg-brand text-white font-bold py-4 rounded-lg hover:bg-brand-dark transition-colors shadow-lg disabled:opacity-50"
              >
                {isLoading ? 'Processing...' : 'Complete Registration'}
              </button>
              
              <div className="mt-5 pt-3 border-t border-gray-100 text-center text-[11px] text-gray-400 space-y-1">
                <p className="font-bold text-gray-500">Test Linked Bank Details (By Farmer):</p>
                <p>• <strong>Aman Kumar:</strong> A/C <span className="font-mono font-bold text-gray-700">000012345678</span> • IFSC <span className="font-mono font-bold text-gray-700">SBIN0001234</span></p>
                <p>• <strong>Anusrita Deb:</strong> A/C <span className="font-mono font-bold text-gray-700">100023456789</span> • IFSC <span className="font-mono font-bold text-gray-700">SBIN0000017</span></p>
                <p>• <strong>Anurag Ojha:</strong> A/C <span className="font-mono font-bold text-gray-700">200034567890</span> • IFSC <span className="font-mono font-bold text-gray-700">PUNB0024500</span></p>
              </div>
            </form>
          )}

        </div>
      </div>
    </>
  );
}
