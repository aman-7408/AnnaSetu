import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function Home({ farmerSession, onFarmerLoginClick, onFarmerLogout, onAdminClick }) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[85vh] py-12 px-4 text-center animate-fade-in">
      
      {/* Emblem & Official Seal */}
      <div className="w-36 h-36 bg-white rounded-full flex items-center justify-center mb-6 border-4 border-brand shadow-2xl p-2 overflow-hidden transform hover:scale-105 transition-transform duration-300">
        <img 
          src="/logo.png" 
          alt="AnnaSetu Official Logo" 
          className="w-full h-full object-cover rounded-full"
          style={{ imageRendering: '-webkit-optimize-contrast' }}
        />
      </div>
      
      {/* Platform Title */}
      <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 mb-3 tracking-tight">
        Welcome to <span className="text-brand">AnnaSetu</span>
      </h1>
      <p className="text-base sm:text-lg text-gray-700 font-medium max-w-2xl mx-auto mb-10 leading-relaxed">
        India's Direct Digital Grain Procurement & PFMS Direct Benefit Transfer Portal.
      </p>

      {/* Dynamic State: Authenticated Farmer vs Public 3-Action Gateway */}
      {farmerSession ? (
        /* === AUTHENTICATED FARMER DASHBOARD === */
        <div className="w-full max-w-xl mx-auto space-y-5 animate-scale-up">
          <div className="p-5 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-2 border-emerald-300 rounded-3xl shadow-sm text-left flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 bg-emerald-600 text-white rounded-2xl flex items-center justify-center text-2xl shadow-sm">
                🧑‍🌾
              </div>
              <div>
                <span className="text-3xs font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-200/70 px-2.5 py-0.5 rounded-full">
                  Authenticated Farmer
                </span>
                <h2 className="text-xl font-extrabold text-emerald-950 mt-0.5">{farmerSession.name}</h2>
                <p className="text-xs text-gray-600 font-mono">
                  Aadhaar: <span className="font-bold text-gray-800">{farmerSession.aadhar}</span> • {farmerSession.phone || '9876543210'}
                </p>
              </div>
            </div>
            <button
              onClick={onFarmerLogout}
              className="text-xs font-bold text-red-600 hover:text-red-800 bg-white hover:bg-red-50 border border-red-200 px-3.5 py-2 rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap"
            >
              Logout ↪
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-3.5 w-full justify-center">
            <button 
              onClick={() => navigate('/book-slot')}
              className="bg-brand text-white px-8 py-4 rounded-2xl font-extrabold text-base hover:bg-brand-dark transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-95 flex-1"
            >
              <span>⚡ Book a Procurement Slot</span>
              <span>➔</span>
            </button>
            <button 
              onClick={() => navigate('/payments')}
              className="bg-white text-emerald-800 border-2 border-emerald-600 px-8 py-4 rounded-2xl font-extrabold text-base hover:bg-emerald-50 transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer flex-1"
            >
              <span>💳 View DBT Payments</span>
            </button>
          </div>
        </div>
      ) : (
        /* === PUBLIC GATEWAY: 3 PRIMARY ACTION PORTALS === */
        <div className="w-full max-w-xl mx-auto space-y-4 animate-scale-up">
          
          {/* Top Row: Farmer Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button 
              onClick={() => navigate('/register')}
              className="bg-brand hover:bg-brand-dark text-white px-6 py-4 rounded-2xl font-extrabold text-base transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2.5 cursor-pointer active:scale-95 border-2 border-emerald-600"
            >
              <span>🌱</span>
              <span>Register as New Farmer</span>
            </button>

            <button 
              onClick={onFarmerLoginClick}
              className="bg-white hover:bg-emerald-50/80 text-emerald-900 border-2 border-emerald-600 px-6 py-4 rounded-2xl font-extrabold text-base transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2.5 cursor-pointer active:scale-95"
            >
              <span>🧑‍🌾</span>
              <span>Farmer Login</span>
            </button>
          </div>

          {/* Divider */}
          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-gray-50 px-3 font-extrabold text-gray-600 tracking-wider">
                Official Administration
              </span>
            </div>
          </div>

          {/* Bottom Row: Official Mandi Manager Portal (Clean Light Theme) */}
          <button 
            onClick={onAdminClick}
            className="w-full bg-white hover:bg-emerald-50/70 text-gray-900 border-2 border-gray-200 hover:border-emerald-500 p-4 rounded-2xl font-bold transition-all shadow-sm hover:shadow-md flex items-center justify-between cursor-pointer active:scale-98 group"
          >
            <div className="flex items-center gap-3 text-left">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-xl shadow-2xs group-hover:scale-110 transition-transform">
                🔒
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-gray-900 tracking-wide group-hover:text-emerald-900">
                  Mandi Manager Portal
                </h3>
                <p className="text-2xs text-gray-500 font-medium">
                  Official Mandi In-Charge Console & Intake Stations
                </p>
              </div>
            </div>
            <span className="text-emerald-700 font-extrabold text-xs group-hover:translate-x-1 transition-transform pr-1">
              Enter Portal ➔
            </span>
          </button>

          {/* Trust & Security Badge */}
          <div className="pt-6 flex items-center justify-center gap-2 text-2xs text-gray-600 font-semibold">
            <span>🛡️</span>
            <span>Verified by UIDAI Aadhaar KYC & PFMS National Treasury System</span>
          </div>

        </div>
      )}
    </div>
  );
}
