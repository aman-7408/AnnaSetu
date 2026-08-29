import React, { useState } from 'react';

// The 3 Official Mandi In-Charges
const AUTH_ACCOUNTS = [
  {
    username: 'vishesh',
    password: 'Meerut@Setu2026',
    title: 'Mandi In-Charge (Uttar Pradesh)',
    name: 'Vishesh Tiwari',
    centreName: 'Meerut Central Agro Warehouse',
    state: 'Uttar Pradesh',
    badge: 'UP Zone In-Charge'
  },
  {
    username: 'sarabpreet',
    password: 'Punjab@Setu2026',
    title: 'Mandi In-Charge (Punjab)',
    name: 'Sarabpreet Singh Khanna',
    centreName: 'Ludhiana Grain Logistics Terminal',
    state: 'Punjab',
    badge: 'Punjab Zone In-Charge'
  },
  {
    username: 'saishri',
    password: 'Assam@Setu2026',
    title: 'Mandi In-Charge (Assam)',
    name: 'Saishri Bidwai',
    centreName: 'Guwahati Brahmaputra Agro Hub',
    state: 'Assam',
    badge: 'Assam Zone In-Charge'
  }
];

export default function AdminLoginModal({ isOpen, onClose, onLoginSuccess }) {
  const [officerId, setOfficerId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    if (e?.preventDefault) e.preventDefault();
    setError('');

    const trimmedUser = officerId.trim().toLowerCase();
    const matchedAccount = AUTH_ACCOUNTS.find(
      acc => acc.username.toLowerCase() === trimmedUser && acc.password === password
    );

    if (matchedAccount) {
      onLoginSuccess(matchedAccount);
      setOfficerId('');
      setPassword('');
      setError('');
    } else {
      setError('Invalid Manager Credentials. Access Restricted to Mandi In-Charges.');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8 max-w-md w-full animate-fade-in-down border-t-4 border-emerald-600 relative">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl font-bold p-1 cursor-pointer"
        >
          ✕
        </button>

        {/* Header with Official Logo */}
        <div className="text-center mb-6">
          <div className="w-20 h-20 bg-white rounded-full border-2 border-emerald-300 flex items-center justify-center mx-auto mb-3 shadow-md overflow-hidden p-1">
            <img 
              src="/logo.png" 
              alt="AnnaSetu Official Emblem" 
              className="w-full h-full object-cover rounded-full"
              style={{ imageRendering: '-webkit-optimize-contrast' }}
            />
          </div>
          <h3 className="text-2xl font-extrabold text-gray-900 tracking-tight">Mandi Manager Portal</h3>
          <p className="text-xs text-emerald-700 font-semibold tracking-wider uppercase mt-1">
            Department of Food & Public Distribution
          </p>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-5 border border-red-200 text-xs font-semibold flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-700 text-xs font-bold uppercase tracking-wider mb-1">
              Manager Username
            </label>
            <input 
              type="text" 
              required
              placeholder="Username"
              value={officerId}
              onChange={(e) => setOfficerId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 text-sm font-medium"
            />
          </div>

          <div>
            <label className="block text-gray-700 text-xs font-bold uppercase tracking-wider mb-1">
              Security Password
            </label>
            <input 
              type="password" 
              required
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 text-sm font-medium"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button 
              type="button" 
              onClick={onClose}
              className="w-1/3 bg-gray-100 text-gray-700 font-bold py-2.5 rounded-lg hover:bg-gray-200 transition-colors text-sm cursor-pointer"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="w-2/3 bg-emerald-600 text-white font-bold py-2.5 rounded-lg hover:bg-emerald-700 transition-colors shadow-md text-sm cursor-pointer"
            >
              Authenticate
            </button>
          </div>
        </form>

        {/* Quick Roles Reference Drawer */}
        <div className="mt-5 pt-3 border-t border-gray-100 text-[11px] text-gray-400 space-y-1">
          <p className="font-bold text-gray-600">Official Mandi In-Charges:</p>
          <p>• Meerut (UP): <span className="font-mono text-gray-700 font-bold">vishesh / Meerut@Setu2026</span></p>
          <p>• Ludhiana (PB): <span className="font-mono text-gray-700 font-bold">sarabpreet / Punjab@Setu2026</span></p>
          <p>• Guwahati (AS): <span className="font-mono text-gray-700 font-bold">saishri / Assam@Setu2026</span></p>
        </div>

      </div>
    </div>
  );
}
