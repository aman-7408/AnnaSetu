import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';

const CROPS = [
  { name: 'Wheat (Sharbati A-Grade)', code: 'WHT', msp: 2275, unit: '₹/Quintal' },
  { name: 'Paddy (Basmati Common)', code: 'PAD', msp: 2300, unit: '₹/Quintal' },
  { name: 'Mustard Seed (FAQ Grade)', code: 'MUS', msp: 5650, unit: '₹/Quintal' },
  { name: 'Maize (Kharif Industrial)', code: 'MAZ', msp: 2090, unit: '₹/Quintal' },
  { name: 'Barley (Malt Grade)', code: 'BAR', msp: 1850, unit: '₹/Quintal' },
  { name: 'Gram / Chana (Desi FAQ)', code: 'CHN', msp: 5440, unit: '₹/Quintal' }
];

const DEMO_FARMERS = [
  {
    name: 'Aman Kumar',
    aadhar: '123456789012',
    phone: '+91 98765 43210',
    land_size: '5.5 Acres',
    plot_number: 'PL-784/A',
    address: 'Ludhiana Rural, Punjab'
  },
  {
    name: 'Ramesh Patel',
    aadhar: '987654321098',
    phone: '+91 94123 55678',
    land_size: '3.8 Acres',
    plot_number: 'UP-MR-209',
    address: 'Bypass Sector 4, Meerut, UP'
  },
  {
    name: 'Sunita Devi',
    aadhar: '456789012345',
    phone: '+91 98350 99881',
    land_size: '4.2 Acres',
    plot_number: 'AS-KM-112',
    address: 'Kamrup District, Guwahati, Assam'
  }
];

export default function SlotBooking() {
  const [activeTab, setActiveTab] = useState('book'); // 'book' | 'passes'
  const [currentStep, setCurrentStep] = useState(1); // 1: Farmer & Mandi, 2: Shift, 3: Crop & Weight

  // Centres & Live Slots Data
  const [centres, setCentres] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loadingCentres, setLoadingCentres] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Booking Form State
  const [selectedFarmer, setSelectedFarmer] = useState(DEMO_FARMERS[0]);
  const [aadharInput, setAadharInput] = useState(DEMO_FARMERS[0].aadhar);
  const [farmerLookupStatus, setFarmerLookupStatus] = useState('verified'); // 'idle' | 'loading' | 'verified' | 'manual'
  const [selectedCentre, setSelectedCentre] = useState(null);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedCrop, setSelectedCrop] = useState(CROPS[0]);
  const [weightQuintals, setWeightQuintals] = useState('45');

  // Submission & Result States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingResult, setBookingResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Farmer's Existing Passes
  const [myPasses, setMyPasses] = useState([]);
  const [loadingPasses, setLoadingPasses] = useState(false);
  const [activePassModal, setActivePassModal] = useState(null);

  // Fetch Centres on Mount
  useEffect(() => {
    fetchCentres();
  }, []);

  // Fetch Slots when Centre or Date changes
  useEffect(() => {
    if (selectedCentre) {
      fetchSlots(selectedCentre._id, selectedDate);
    }
  }, [selectedCentre, selectedDate]);

  const fetchCentres = async () => {
    try {
      setLoadingCentres(true);
      const res = await fetch('/api/capacity/centres');
      const data = await res.json();
      if (data.success && data.centres?.length > 0) {
        setCentres(data.centres);
        // Default to first available centre
        if (!selectedCentre) {
          setSelectedCentre(data.centres[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load centres:', err);
    } finally {
      setLoadingCentres(false);
    }
  };

  const fetchSlots = async (centreId, date) => {
    try {
      setLoadingSlots(true);
      const res = await fetch(`/api/capacity/centres/${centreId}/slots?date=${date}`);
      const data = await res.json();
      if (data.success) {
        setSlots(data.slots || []);
        // Automatically select first slot with capacity
        if (data.slots && data.slots.length > 0) {
          const available = data.slots.find(s => (s.max_capacity_quintals - s.booked_capacity_quintals) > 0);
          setSelectedSlot(available || data.slots[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch slots:', err);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleFarmerLookup = async (aadharToLookup) => {
    const aadhar = aadharToLookup || aadharInput;
    if (!aadhar || aadhar.trim().length < 12) {
      setErrorMessage('Please enter a valid 12-digit Aadhaar number.');
      return;
    }
    setErrorMessage('');
    setFarmerLookupStatus('loading');

    try {
      const res = await fetch(`/api/farmers`);
      const data = await res.json();
      const match = data.farmers?.find(f => f.aadhar_number === aadhar.trim());

      if (match) {
        setSelectedFarmer({
          name: match.name,
          aadhar: match.aadhar_number,
          phone: match.phone,
          land_size: match.land_size || '4.0 Acres',
          plot_number: match.plot_number || 'N/A',
          address: match.address
        });
        setFarmerLookupStatus('verified');
      } else {
        // Match in demo presets or manual
        const demo = DEMO_FARMERS.find(d => d.aadhar === aadhar.trim());
        if (demo) {
          setSelectedFarmer(demo);
          setFarmerLookupStatus('verified');
        } else {
          setSelectedFarmer({
            name: 'Kisan Beneficiary',
            aadhar: aadhar.trim(),
            phone: '+91 98000 00000',
            land_size: '3.5 Acres',
            plot_number: 'PL-REG-NEW',
            address: 'District Agro Zone'
          });
          setFarmerLookupStatus('manual');
        }
      }
    } catch {
      setFarmerLookupStatus('manual');
    }
  };

  const fetchFarmerPasses = async (aadhar) => {
    if (!aadhar) return;
    try {
      setLoadingPasses(true);
      const res = await fetch(`/api/bookings/farmer/${aadhar}`);
      const data = await res.json();
      if (data.success) {
        setMyPasses(data.bookings || []);
      }
    } catch (err) {
      console.error('Failed to fetch passes:', err);
    } finally {
      setLoadingPasses(false);
    }
  };

  const handleCreateBooking = async () => {
    setErrorMessage('');
    const weight = Number(weightQuintals);

    if (!selectedCentre) {
      setErrorMessage('Please select a Procurement Mandi Centre.');
      return;
    }
    if (!selectedSlot) {
      setErrorMessage('Please select a 3-Hour Intake Shift.');
      return;
    }
    if (!weight || weight <= 0) {
      setErrorMessage('Please enter a valid grain weight (Quintals).');
      return;
    }

    const remainingSlotCapacity = Math.max(0, selectedSlot.max_capacity_quintals - (selectedSlot.booked_capacity_quintals || 0));
    if (weight > remainingSlotCapacity) {
      setErrorMessage(`Cannot exceed available slot limit (${remainingSlotCapacity} Q). Please lower grain weight or choose another shift.`);
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        farmer_aadhar: selectedFarmer.aadhar,
        farmer_name: selectedFarmer.name,
        farmer_phone: selectedFarmer.phone,
        centre_id: selectedCentre._id,
        date: selectedDate,
        slot_code: selectedSlot.slot_code,
        crop_type: selectedCrop.name,
        estimated_weight_quintals: weight
      };

      const res = await fetch('/api/bookings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Booking failed');
      }

      setBookingResult(data.booking);
      setActivePassModal(data.booking);

      // Trigger Confetti Celebration
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });

      // Refresh Centres and Slots
      fetchCentres();
      fetchSlots(selectedCentre._id, selectedDate);
    } catch (err) {
      setErrorMessage(err.message || 'Error occurred while securing slot.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintPass = () => {
    window.print();
  };

  const remainingSlotCap = selectedSlot
    ? Math.max(0, selectedSlot.max_capacity_quintals - (selectedSlot.booked_capacity_quintals || 0))
    : 0;

  const estimatedPayout = Math.round((Number(weightQuintals) || 0) * (selectedCrop?.msp || 0));

  return (
    <div className="py-8 px-4 sm:px-6 max-w-6xl mx-auto font-sans">
      
      {/* PAGE HEADER */}
      <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 text-white p-6 sm:p-8 rounded-2xl shadow-xl mb-8 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-full opacity-10 pointer-events-none flex items-center justify-center">
          <svg className="w-72 h-72 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
          </svg>
        </div>

        <div className="relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-700/60 border border-emerald-500/40 rounded-full text-xs font-semibold uppercase tracking-wider text-emerald-200 mb-3">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Module 2: Token & Slot Engine
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
                Mandi Slot Booking & Digital Gate Pass
              </h1>
              <p className="text-emerald-100/90 text-sm sm:text-base mt-1 max-w-2xl">
                Reserve your guaranteed 3-hour grain intake window at national procurement terminals, prevent Mandi bottlenecks, and generate verified QR tokens.
              </p>
            </div>

            {/* TAB SELECTOR */}
            <div className="flex bg-emerald-950/60 p-1 rounded-xl border border-emerald-600/30">
              <button
                onClick={() => setActiveTab('book')}
                className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${
                  activeTab === 'book'
                    ? 'bg-emerald-500 text-white shadow-md'
                    : 'text-emerald-200 hover:text-white'
                }`}
              >
                🌾 New Slot Booking
              </button>
              <button
                onClick={() => {
                  setActiveTab('passes');
                  fetchFarmerPasses(selectedFarmer.aadhar);
                }}
                className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${
                  activeTab === 'passes'
                    ? 'bg-emerald-500 text-white shadow-md'
                    : 'text-emerald-200 hover:text-white'
                }`}
              >
                📋 My Active Passes
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ERROR BANNER */}
      {errorMessage && (
        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-xl flex items-center justify-between shadow-sm animate-shake">
          <div className="flex items-center gap-3">
            <span className="text-xl">⚠️</span>
            <p className="text-sm font-medium text-red-800">{errorMessage}</p>
          </div>
          <button onClick={() => setErrorMessage('')} className="text-red-500 hover:text-red-700 font-bold text-sm">
            ✕
          </button>
        </div>
      )}

      {/* VIEW: MY PASSES TAB */}
      {activeTab === 'passes' ? (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-gray-100">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Farmer Gate Pass Directory</h2>
              <p className="text-xs text-gray-500">Showing active and completed passes for Aadhaar: {selectedFarmer.aadhar}</p>
            </div>
            <button
              onClick={() => setActiveTab('book')}
              className="bg-brand text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-brand-dark transition-colors"
            >
              + Book Another Slot
            </button>
          </div>

          {loadingPasses ? (
            <div className="py-16 text-center text-gray-500">
              <div className="inline-block w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3"></div>
              <p className="text-sm font-semibold">Fetching issued gate passes...</p>
            </div>
          ) : myPasses.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <div className="text-5xl mb-3">🎫</div>
              <p className="text-base font-semibold text-gray-700">No gate passes found for this farmer</p>
              <p className="text-xs text-gray-400 mt-1">Book your first grain procurement slot to generate a digital token.</p>
              <button
                onClick={() => setActiveTab('book')}
                className="mt-4 bg-brand text-white px-5 py-2.5 rounded-lg text-xs font-bold hover:bg-brand-dark transition-colors shadow-md"
              >
                Proceed to Booking Wizard
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              {myPasses.map((pass) => (
                <div
                  key={pass.token_id}
                  className="border-2 border-emerald-100 hover:border-emerald-500 rounded-xl p-5 bg-gradient-to-br from-emerald-50/40 via-white to-white shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-mono text-sm font-bold text-emerald-900 bg-emerald-100 px-3 py-1 rounded-md border border-emerald-300">
                        {pass.token_id}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-600 text-white uppercase tracking-wider">
                        {pass.status || 'CONFIRMED'}
                      </span>
                    </div>

                    <h3 className="font-bold text-gray-900 text-base">{pass.crop_type}</h3>
                    <p className="text-xs text-gray-600 mt-0.5">{pass.centre_name}</p>

                    <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-gray-100 text-xs">
                      <div>
                        <span className="text-gray-400 block">Scheduled Date:</span>
                        <span className="font-semibold text-gray-800">{pass.booking_date}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block">Shift Timing:</span>
                        <span className="font-semibold text-gray-800">{pass.slot_name?.split('(')[1]?.replace(')', '') || pass.slot_name}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block">Allotted Grain:</span>
                        <span className="font-bold text-emerald-700">{pass.estimated_weight_quintals} Quintals</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block">Farmer:</span>
                        <span className="font-semibold text-gray-800">{pass.farmer_name}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setActivePassModal(pass)}
                    className="mt-4 w-full bg-emerald-800 text-white py-2 rounded-lg text-xs font-bold hover:bg-emerald-900 transition-colors flex items-center justify-center gap-2"
                  >
                    <span>👁️</span>
                    <span>View Official Gate Pass</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* VIEW: 3-STEP BOOKING WIZARD */
        <div>
          {/* STEPPER BAR */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-8">
            <div className="flex items-center justify-between max-w-3xl mx-auto">
              {/* Step 1 */}
              <div
                onClick={() => setCurrentStep(1)}
                className={`flex items-center gap-3 cursor-pointer transition-opacity ${
                  currentStep >= 1 ? 'opacity-100' : 'opacity-40'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                    currentStep === 1
                      ? 'bg-brand text-white ring-4 ring-emerald-100 shadow-md'
                      : currentStep > 1
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {currentStep > 1 ? '✓' : '1'}
                </div>
                <div className="hidden sm:block">
                  <p className="text-xs font-bold text-gray-900">Step 1</p>
                  <p className="text-xs text-gray-500">Farmer & Mandi</p>
                </div>
              </div>

              <div className={`h-1 flex-1 mx-3 rounded transition-colors ${currentStep >= 2 ? 'bg-brand' : 'bg-gray-200'}`} />

              {/* Step 2 */}
              <div
                onClick={() => currentStep > 1 && setCurrentStep(2)}
                className={`flex items-center gap-3 transition-opacity ${
                  currentStep >= 2 ? 'opacity-100 cursor-pointer' : 'opacity-50 cursor-not-allowed'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                    currentStep === 2
                      ? 'bg-brand text-white ring-4 ring-emerald-100 shadow-md'
                      : currentStep > 2
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {currentStep > 2 ? '✓' : '2'}
                </div>
                <div className="hidden sm:block">
                  <p className="text-xs font-bold text-gray-900">Step 2</p>
                  <p className="text-xs text-gray-500">3-Hour Shift</p>
                </div>
              </div>

              <div className={`h-1 flex-1 mx-3 rounded transition-colors ${currentStep >= 3 ? 'bg-brand' : 'bg-gray-200'}`} />

              {/* Step 3 */}
              <div
                onClick={() => currentStep > 2 && setCurrentStep(3)}
                className={`flex items-center gap-3 transition-opacity ${
                  currentStep >= 3 ? 'opacity-100 cursor-pointer' : 'opacity-50 cursor-not-allowed'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                    currentStep === 3
                      ? 'bg-brand text-white ring-4 ring-emerald-100 shadow-md'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  3
                </div>
                <div className="hidden sm:block">
                  <p className="text-xs font-bold text-gray-900">Step 3</p>
                  <p className="text-xs text-gray-500">Crop & Token</p>
                </div>
              </div>
            </div>
          </div>

          {/* STEP 1: FARMER LOOKUP & MANDI SELECTION */}
          {currentStep === 1 && (
            <div className="space-y-6">
              {/* Farmer Lookup Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <span className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg text-sm">👤</span>
                    Farmer Identity & Land Records (Module 1 Validation)
                  </h2>
                  <span className="text-xs font-bold px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
                    Aadhaar Verified
                  </span>
                </div>

                {/* Quick Selection Demo Chips */}
                <div className="mb-4">
                  <p className="text-xs text-gray-500 mb-2 font-semibold">Quick-Select Registered Profile:</p>
                  <div className="flex flex-wrap gap-2">
                    {DEMO_FARMERS.map((farmer) => (
                      <button
                        key={farmer.aadhar}
                        type="button"
                        onClick={() => {
                          setSelectedFarmer(farmer);
                          setAadharInput(farmer.aadhar);
                          setFarmerLookupStatus('verified');
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                          selectedFarmer.aadhar === farmer.aadhar
                            ? 'bg-brand text-white border-brand shadow-sm'
                            : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border-gray-200'
                        }`}
                      >
                        🌾 {farmer.name} ({farmer.address.split(',')[1]?.trim() || farmer.address})
                      </button>
                    ))}
                  </div>
                </div>

                {/* Aadhaar Input Search */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      maxLength={12}
                      value={aadharInput}
                      onChange={(e) => setAadharInput(e.target.value.replace(/\D/g, ''))}
                      placeholder="Enter 12-Digit Farmer Aadhaar Number"
                      className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none font-mono text-sm tracking-wider"
                    />
                    <span className="absolute left-3.5 top-3.5 text-gray-400">🆔</span>
                  </div>
                  <button
                    onClick={() => handleFarmerLookup(aadharInput)}
                    className="bg-emerald-800 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-emerald-900 transition-colors shrink-0 shadow-sm flex items-center justify-center gap-2"
                  >
                    <span>🔍</span>
                    <span>Verify Aadhaar</span>
                  </button>
                </div>

                {/* Verified Farmer Banner */}
                {selectedFarmer && (
                  <div className="mt-4 p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shadow-sm shrink-0">
                        {selectedFarmer.name.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 text-base flex items-center gap-2">
                          {selectedFarmer.name}
                          <span className="text-emerald-700 text-xs">✓ Verified</span>
                        </h4>
                        <p className="text-xs text-gray-600">
                          Aadhaar: <span className="font-mono font-semibold">XXXX-XXXX-{selectedFarmer.aadhar.slice(-4)}</span> | Phone: {selectedFarmer.phone}
                        </p>
                      </div>
                    </div>

                    <div className="text-right text-xs bg-white px-3 py-2 rounded-lg border border-emerald-100 shadow-2xs">
                      <span className="text-gray-400 block">Registered Land Holding:</span>
                      <span className="font-bold text-emerald-800">{selectedFarmer.land_size} ({selectedFarmer.plot_number})</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Mandi Selection Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <span className="p-1.5 bg-amber-100 text-amber-800 rounded-lg text-sm">🏢</span>
                    Select Procurement Mandi Terminal (Module 4 Capacity Live Feed)
                  </h2>
                  <span className="text-xs font-bold text-gray-500">3 National Centres Active</span>
                </div>

                {loadingCentres ? (
                  <div className="py-12 text-center text-gray-500">
                    <div className="inline-block w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                    <p className="text-xs">Loading Mandi capacities...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {centres.map((centre) => {
                      const isSelected = selectedCentre?._id === centre._id;
                      const max = centre.daily_capacity_quintals || 1000;
                      const booked = centre.booked_capacity_quintals || 0;
                      const available = Math.max(0, max - booked);
                      const util = Math.min(100, Math.round((booked / max) * 100));
                      const isDiverted = centre.status === 'divert_active';

                      return (
                        <div
                          key={centre._id}
                          onClick={() => setSelectedCentre(centre)}
                          className={`cursor-pointer rounded-xl p-5 border-2 transition-all relative ${
                            isSelected
                              ? 'border-brand bg-emerald-50/40 shadow-md ring-2 ring-emerald-200'
                              : 'border-gray-200 hover:border-gray-300 bg-white'
                          }`}
                        >
                          {isSelected && (
                            <div className="absolute top-3 right-3 w-5 h-5 bg-brand text-white rounded-full flex items-center justify-center text-xs font-bold">
                              ✓
                            </div>
                          )}

                          <div className="flex items-start justify-between mb-2">
                            <span className="text-xs font-extrabold uppercase tracking-wide text-emerald-800">
                              {centre.state}
                            </span>
                            {isDiverted ? (
                              <span className="px-2 py-0.5 rounded text-2xs font-extrabold bg-amber-500 text-white uppercase animate-pulse">
                                Traffic Divert
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-2xs font-extrabold bg-emerald-100 text-emerald-800 uppercase">
                                Normal Intake
                              </span>
                            )}
                          </div>

                          <h3 className="font-bold text-gray-900 text-sm line-clamp-2 h-10">{centre.name}</h3>
                          <p className="text-2xs text-gray-500 mt-1 mb-3">📍 {centre.location}</p>

                          {/* Capacity Progress Bar */}
                          <div className="space-y-1 mt-2">
                            <div className="flex justify-between text-2xs font-bold text-gray-600">
                              <span>Intake Utilization:</span>
                              <span className={util >= 85 ? 'text-red-600' : util >= 60 ? 'text-amber-600' : 'text-emerald-700'}>
                                {util}% ({available} Q Left)
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  util >= 85 ? 'bg-red-500' : util >= 60 ? 'bg-amber-500' : 'bg-brand'
                                }`}
                                style={{ width: `${util}%` }}
                              />
                            </div>
                          </div>

                          {/* Advisory if Diverted */}
                          {isDiverted && (
                            <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded text-2xs text-amber-800 font-medium">
                              ⚠️ {centre.alert_message || 'Heavy intake. Recommended to reroute to alternate Mandis.'}
                            </div>
                          )}

                          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-2xs text-gray-500">
                            <span>Manager: {centre.manager_name}</span>
                            <span className="font-mono">{centre.manager_phone}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* NEXT BUTTON */}
                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    disabled={!selectedCentre}
                    className="bg-brand text-white px-8 py-3.5 rounded-xl font-bold text-sm hover:bg-brand-dark transition-all shadow-md flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span>Proceed to Select Shift</span>
                    <span>➔</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: 3-HOUR SHIFT SELECTION */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-4 border-b border-gray-100">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <span className="p-1.5 bg-blue-100 text-blue-800 rounded-lg text-sm">⏰</span>
                      Select Booking Date & 3-Hour Intake Shift
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Procurement Terminal: <span className="font-bold text-emerald-800">{selectedCentre?.name}</span>
                    </p>
                  </div>

                  {/* Date Picker Input */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-gray-700">Intake Date:</label>
                    <input
                      type="date"
                      value={selectedDate}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="border-2 border-emerald-300 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-800 focus:outline-none focus:border-brand"
                    />
                  </div>
                </div>

                {/* Shift Selection Cards */}
                {loadingSlots ? (
                  <div className="py-16 text-center text-gray-500">
                    <div className="inline-block w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin mb-3"></div>
                    <p className="text-xs font-semibold">Loading real-time shift capacities...</p>
                  </div>
                ) : slots.length === 0 ? (
                  <div className="py-12 text-center text-gray-400">
                    <p className="text-sm font-semibold">No shifts registered for this date.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {slots.map((slot) => {
                      const isSelected = selectedSlot?.slot_code === slot.slot_code;
                      const max = slot.max_capacity_quintals;
                      const booked = slot.booked_capacity_quintals || 0;
                      const available = Math.max(0, max - booked);
                      const util = Math.min(100, Math.round((booked / max) * 100));
                      const isFull = available <= 0;

                      return (
                        <div
                          key={slot.slot_code}
                          onClick={() => !isFull && setSelectedSlot(slot)}
                          className={`rounded-xl p-5 border-2 transition-all relative ${
                            isFull
                              ? 'bg-gray-100 border-gray-200 opacity-60 cursor-not-allowed'
                              : isSelected
                              ? 'border-brand bg-emerald-50/50 shadow-md ring-2 ring-emerald-300 cursor-pointer'
                              : 'border-gray-200 hover:border-gray-300 bg-white cursor-pointer'
                          }`}
                        >
                          {isSelected && (
                            <div className="absolute top-3 right-3 w-5 h-5 bg-brand text-white rounded-full flex items-center justify-center text-xs font-bold">
                              ✓
                            </div>
                          )}

                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xl">
                              {slot.slot_code === 'SLOT_1_MORNING' ? '🌅' : slot.slot_code === 'SLOT_2_AFTERNOON' ? '☀️' : '🌇'}
                            </span>
                            <div>
                              <span className="text-2xs font-extrabold uppercase text-gray-400 block">3-Hour Window</span>
                              <h3 className="font-bold text-gray-900 text-sm">{slot.slot_name}</h3>
                            </div>
                          </div>

                          <div className="my-3 py-2 px-3 bg-gray-50 rounded-lg border border-gray-100 space-y-1">
                            <div className="flex justify-between text-2xs">
                              <span className="text-gray-500">Available Quota:</span>
                              <span className="font-extrabold text-emerald-800">{available} Quintals</span>
                            </div>
                            <div className="flex justify-between text-2xs">
                              <span className="text-gray-500">Booked Capacity:</span>
                              <span className="font-semibold text-gray-700">{booked} / {max} Q</span>
                            </div>
                          </div>

                          {/* Progress Bar */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-2xs font-bold text-gray-500">
                              <span>Slot Fullness:</span>
                              <span>{util}%</span>
                            </div>
                            <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  isFull ? 'bg-red-500' : util >= 75 ? 'bg-amber-500' : 'bg-brand'
                                }`}
                                style={{ width: `${util}%` }}
                              />
                            </div>
                          </div>

                          <div className="mt-4 text-center">
                            {isFull ? (
                              <span className="text-2xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded border border-red-200 block">
                                ⛔ Shift Full (0 Q Left)
                              </span>
                            ) : (
                              <span
                                className={`text-2xs font-bold px-2 py-1 rounded block ${
                                  isSelected
                                    ? 'bg-brand text-white'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {isSelected ? 'Selected Shift' : 'Select This Shift'}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* STEP NAVIGATION BUTTONS */}
                <div className="mt-6 flex justify-between items-center pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="px-5 py-3 border border-gray-300 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    ← Back to Mandi Selection
                  </button>

                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    disabled={!selectedSlot || remainingSlotCap <= 0}
                    className="bg-brand text-white px-8 py-3.5 rounded-xl font-bold text-sm hover:bg-brand-dark transition-all shadow-md flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span>Proceed to Crop & Weight</span>
                    <span>➔</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: CROP & WEIGHT CONFIRMATION */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 pb-4 mb-4 border-b border-gray-100">
                  <span className="p-1.5 bg-yellow-100 text-yellow-800 rounded-lg text-sm">🌾</span>
                  Confirm Crop Details & Grain Load (Quintals)
                </h2>

                {/* SUMMARY RIBBON */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl mb-6 text-xs">
                  <div>
                    <span className="text-gray-500 block">Selected Mandi:</span>
                    <span className="font-bold text-gray-900">{selectedCentre?.name}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Shift Timing:</span>
                    <span className="font-bold text-gray-900">{selectedDate} ({selectedSlot?.slot_name})</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Remaining Quota:</span>
                    <span className="font-bold text-emerald-800">{remainingSlotCap} Quintals Available</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Crop Selection */}
                  <div>
                    <label className="block text-xs font-bold text-gray-800 mb-2">Select Commodity / Crop Type:</label>
                    <div className="space-y-2">
                      {CROPS.map((crop) => (
                        <div
                          key={crop.code}
                          onClick={() => setSelectedCrop(crop)}
                          className={`p-3 rounded-xl border-2 transition-all flex items-center justify-between cursor-pointer ${
                            selectedCrop.code === crop.code
                              ? 'border-brand bg-emerald-50/50 shadow-sm font-bold'
                              : 'border-gray-200 hover:border-gray-300 bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-base">📦</span>
                            <span className="text-xs text-gray-900">{crop.name}</span>
                          </div>
                          <span className="text-xs font-extrabold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                            MSP ₹{crop.msp.toLocaleString('en-IN')}/Q
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Weight Input & MSP Calculator */}
                  <div className="flex flex-col justify-between space-y-4">
                    <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
                      <label className="block text-xs font-bold text-gray-800 mb-1">
                        Estimated Grain Load to Deliver (Quintals):
                      </label>
                      <p className="text-2xs text-gray-500 mb-3">1 Quintal = 100 kg. Minimum load 1 Q.</p>

                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          max={remainingSlotCap}
                          value={weightQuintals}
                          onChange={(e) => setWeightQuintals(e.target.value)}
                          className="w-full pl-4 pr-16 py-3 border-2 border-emerald-300 rounded-xl focus:border-brand focus:outline-none font-bold text-lg text-emerald-950"
                          placeholder="e.g. 45"
                        />
                        <span className="absolute right-4 top-3.5 text-xs font-bold text-gray-400">Quintals</span>
                      </div>

                      {/* Quick Weight Chips */}
                      <div className="flex gap-2 mt-3">
                        {[25, 45, 60, 100].map((q) => (
                          <button
                            key={q}
                            type="button"
                            onClick={() => setWeightQuintals(String(q))}
                            className="px-2.5 py-1 rounded-md text-2xs font-bold bg-white hover:bg-emerald-100 border border-gray-200 text-gray-700 transition-colors"
                          >
                            {q} Q
                          </button>
                        ))}
                      </div>

                      {/* Over-capacity alert */}
                      {Number(weightQuintals) > remainingSlotCap && (
                        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-bold text-red-700 flex items-center gap-2">
                          <span>⛔</span>
                          <span>Exceeds remaining shift capacity of {remainingSlotCap} Q!</span>
                        </div>
                      )}
                    </div>

                    {/* Financial Estimator Card */}
                    <div className="p-4 bg-gradient-to-br from-emerald-900 to-teal-950 text-white rounded-xl shadow-inner space-y-2">
                      <div className="flex justify-between items-center text-xs text-emerald-200">
                        <span>Guaranteed MSP Base Rate:</span>
                        <span className="font-mono font-bold">₹{selectedCrop.msp}/Quintal</span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-emerald-200">
                        <span>Estimated Load:</span>
                        <span className="font-mono font-bold">{weightQuintals || 0} Quintals</span>
                      </div>
                      <div className="pt-2 border-t border-emerald-800 flex justify-between items-center">
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                          Estimated Direct MSP Payout:
                        </span>
                        <span className="text-xl font-extrabold text-yellow-300">
                          ₹{estimatedPayout.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <p className="text-3xs text-emerald-300/80 italic mt-1">
                        *Subject to FAQ moisture assay & weighbridge verification at Mandi.
                      </p>
                    </div>
                  </div>
                </div>

                {/* STEP 3 ACTIONS */}
                <div className="mt-8 flex justify-between items-center pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="px-5 py-3 border border-gray-300 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    ← Back to Shift Selection
                  </button>

                  <button
                    type="button"
                    onClick={handleCreateBooking}
                    disabled={isSubmitting || Number(weightQuintals) <= 0 || Number(weightQuintals) > remainingSlotCap}
                    className="bg-brand hover:bg-brand-dark text-white px-10 py-4 rounded-xl font-extrabold text-base transition-all shadow-xl flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02]"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Securing Slot & Generating Pass...</span>
                      </>
                    ) : (
                      <>
                        <span>🎫</span>
                        <span>Confirm Slot & Generate Digital Gate Pass</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* OFFICIAL DIGITAL GATE PASS MODAL / SLIP */}
      {activePassModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full border-4 border-emerald-800 overflow-hidden animate-fadeIn my-8">
            
            {/* PRINTABLE GATE PASS CONTENT */}
            <div id="printable-gate-pass" className="p-6 sm:p-8 bg-gradient-to-b from-emerald-50/60 via-white to-emerald-50/30">
              
              {/* Official Seal & Header */}
              <div className="text-center pb-4 border-b-2 border-emerald-800/30 relative">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-brand shadow-sm">
                    <img src="/logo.png" alt="AnnaSetu Emblem" className="w-full h-full object-cover" />
                  </div>
                  <div className="text-left">
                    <h2 className="text-xl font-extrabold text-emerald-950 tracking-tight">AnnaSetu National Grain Procurement</h2>
                    <p className="text-2xs text-emerald-800 font-bold uppercase tracking-widest">
                      Ministry of Consumer Affairs, Food & Public Distribution
                    </p>
                  </div>
                </div>

                <div className="inline-block bg-emerald-800 text-white px-4 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider mt-1">
                  OFFICIAL DIGITAL GATE PASS (राष्ट्रीय अनाज प्रवेश पत्र)
                </div>
              </div>

              {/* TOKEN BANNER */}
              <div className="my-5 p-4 bg-emerald-900 text-white rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-md">
                <div>
                  <span className="text-2xs font-extrabold text-emerald-300 uppercase tracking-widest block">
                    ISSUED TOKEN IDENTIFIER
                  </span>
                  <span className="font-mono text-2xl sm:text-3xl font-extrabold tracking-wider text-yellow-300">
                    {activePassModal.token_id}
                  </span>
                </div>
                <div className="text-right">
                  <span className="px-3 py-1 bg-emerald-500/80 rounded-lg text-xs font-bold uppercase tracking-wider">
                    ● {activePassModal.status || 'CONFIRMED'}
                  </span>
                  <p className="text-2xs text-emerald-200 mt-1">Verified Gate-In Pass</p>
                </div>
              </div>

              {/* PASS DETAILS GRID WITH QR CODE */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-center my-6">
                
                {/* QR Code Container */}
                <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl border-2 border-emerald-200 shadow-sm">
                  <QRCodeSVG
                    value={activePassModal.token_id}
                    size={150}
                    level="H"
                    fgColor="#064e3b"
                    bgColor="#ffffff"
                  />
                  <span className="text-3xs text-gray-500 mt-2 font-mono text-center">
                    Scan for Mandi Gate-In Check
                  </span>
                </div>

                {/* Details Table */}
                <div className="sm:col-span-2 space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-2 pb-2 border-b border-gray-100">
                    <div>
                      <span className="text-gray-400 block text-2xs">Farmer Name:</span>
                      <span className="font-bold text-gray-900">{activePassModal.farmer_name}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-2xs">Aadhaar:</span>
                      <span className="font-mono font-semibold text-gray-800">
                        XXXX-XXXX-{activePassModal.farmer_aadhar?.slice(-4) || '7890'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pb-2 border-b border-gray-100">
                    <div>
                      <span className="text-gray-400 block text-2xs">Procurement Centre:</span>
                      <span className="font-bold text-emerald-900">{activePassModal.centre_name}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-2xs">Scheduled Date:</span>
                      <span className="font-bold text-gray-900">{activePassModal.booking_date}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pb-2 border-b border-gray-100">
                    <div>
                      <span className="text-gray-400 block text-2xs">Intake Shift:</span>
                      <span className="font-bold text-gray-900">{activePassModal.slot_name}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-2xs">Commodity / Crop:</span>
                      <span className="font-bold text-emerald-900">{activePassModal.crop_type}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-gray-400 block text-2xs">Allotted Load:</span>
                      <span className="font-extrabold text-emerald-800 text-sm">
                        {activePassModal.estimated_weight_quintals} Quintals
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-2xs">Contact:</span>
                      <span className="font-semibold text-gray-800">{activePassModal.farmer_phone}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Instructions Footer */}
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-2xs text-amber-900 space-y-1">
                <p className="font-bold">⚠️ Gate Reporting Instructions:</p>
                <p>1. Please report at Mandi entry terminal within your designated 3-hour shift window.</p>
                <p>2. Keep physical Aadhaar card and tractor/vehicle registration ready for Stage 2 Gate Scan.</p>
              </div>

            </div>

            {/* MODAL ACTION CONTROLS */}
            <div className="bg-gray-100 px-6 py-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-200">
              <button
                onClick={() => {
                  setActivePassModal(null);
                  setCurrentStep(1);
                }}
                className="text-xs font-bold text-gray-600 hover:text-gray-800 px-4 py-2"
              >
                ✕ Close
              </button>

              <div className="flex gap-3">
                <button
                  onClick={handlePrintPass}
                  className="bg-emerald-800 text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-emerald-900 transition-colors shadow flex items-center gap-2"
                >
                  <span>🖨️</span>
                  <span>Print / Save PDF Gate Pass</span>
                </button>

                <button
                  onClick={() => {
                    setActivePassModal(null);
                    setActiveTab('passes');
                    fetchFarmerPasses(selectedFarmer.aadhar);
                  }}
                  className="bg-brand text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-brand-dark transition-colors shadow"
                >
                  View All My Passes
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
