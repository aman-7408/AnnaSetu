import React, { useState, useEffect, Component } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Registration from './pages/Registration';
import SlotBooking from './pages/SlotBooking';
import AdminConsole from './pages/AdminConsole';
import AdminLoginModal from './components/AdminLoginModal';
import FarmerLoginModal from './components/FarmerLoginModal';
import ProcurementTracker from './pages/ProcurementTracker';
import Notifications from './pages/Notifications';
import PaymentStatus from './pages/PaymentStatus';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Captured UI error in ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 text-center font-sans">
          <div className="bg-white p-8 rounded-3xl shadow-2xl border border-gray-200 max-w-md w-full space-y-4 animate-scale-up">
            <span className="text-4xl">🌾</span>
            <h2 className="text-xl font-extrabold text-gray-900">Platform Synchronizing</h2>
            <p className="text-xs text-gray-600">
              The application recovered from an unexpected state. Click below to clear stored cache and reload smoothly.
            </p>
            {this.state.error && (
              <div className="bg-red-50 p-3 rounded-xl border border-red-200 text-left text-2xs font-mono text-red-700 overflow-auto max-h-28">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}
            <button
              onClick={() => {
                try { localStorage.clear(); } catch {}
                this.setState({ hasError: false, error: null });
                window.location.href = '/';
              }}
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold px-6 py-3.5 rounded-2xl text-xs shadow-lg cursor-pointer w-full transition-all active:scale-95"
            >
              🔄 Clear Cache & Reset App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function NavigationBar({ userSession, onAdminClick, farmerSession, onFarmerLoginClick, onFarmerLogout }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const isManagerLoggedIn = !!userSession;
  const isFarmerLoggedIn = !!farmerSession;

  const checkUnread = async () => {
    try {
      const farmerId = farmerSession?.aadhar || localStorage.getItem('farmer_aadhar') || '111122223333';
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/api/notifications/farmer/${farmerId}?unread_only=true`);
      const data = await res.json();
      if (data.success) {
        setUnreadCount(data.unread_count || 0);
      }
    } catch (e) {}
  };

  useEffect(() => {
    checkUnread();
    const handler = () => checkUnread();
    window.addEventListener('notifications-updated', handler);
    window.addEventListener('farmer-session-changed', handler);
    const interval = setInterval(checkUnread, 10000);
    return () => {
      window.removeEventListener('notifications-updated', handler);
      window.removeEventListener('farmer-session-changed', handler);
      clearInterval(interval);
    };
  }, [farmerSession]);

  return (
    <nav className="bg-brand text-white shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-3.5 flex justify-between items-center">
        
        <Link to="/" className="flex items-center space-x-3 cursor-pointer" onClick={() => setIsMenuOpen(false)}>
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-md overflow-hidden p-0.5 border-2 border-emerald-300 shrink-0">
            <img 
              src="/logo.png" 
              alt="AnnaSetu Official Emblem" 
              className="w-full h-full object-cover rounded-full"
              style={{ imageRendering: '-webkit-optimize-contrast' }}
            />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight leading-none">AnnaSetu</h1>
            <span className="text-[10px] text-emerald-200 font-bold uppercase tracking-wider block">Kisan Logistics</span>
          </div>
        </Link>
        
        {/* Navigation Links */}
        <ul className="hidden md:flex space-x-5 text-sm font-medium items-center">
          {!isFarmerLoggedIn ? (
            /* === LOGGED OUT (GUEST / PUBLIC NAVBAR) === */
            <>
              <li>
                <Link to="/register" className="cursor-pointer hover:text-green-200 transition-colors font-bold">
                  Register
                </Link>
              </li>
              <li>
                <button
                  onClick={onFarmerLoginClick}
                  className="bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer border border-emerald-500/50 active:scale-95"
                >
                  <span>🧑‍🌾</span>
                  <span>Farmer Login</span>
                </button>
              </li>
            </>
          ) : (
            /* === LOGGED IN (AUTHENTICATED KISAN NAVBAR) === */
            <>
              <li><Link to="/book-slot" className="cursor-pointer hover:text-green-200 transition-colors">Book Slot</Link></li>
              <li><Link to="/tracker" className="cursor-pointer hover:text-green-200 transition-colors">Tracker</Link></li>
              <li><Link to="/payments" className="cursor-pointer hover:text-green-200 transition-colors">DBT Payments</Link></li>
              <li>
                <Link to="/notifications" className="cursor-pointer hover:text-green-200 transition-colors flex items-center gap-1.5">
                  <span>Notifications</span>
                  {unreadCount > 0 && (
                    <span className="bg-emerald-400 text-emerald-950 text-[10px] font-black px-1.5 py-0.5 rounded-full animate-pulse">
                      {unreadCount}
                    </span>
                  )}
                </Link>
              </li>
              <li>
                <div className="flex items-center gap-2 bg-emerald-900/90 border border-emerald-400/60 rounded-xl px-3 py-1.5 text-xs shadow-inner">
                  <span className="font-extrabold text-emerald-200 flex items-center gap-1">
                    <span>🧑‍🌾</span> {farmerSession?.name ? farmerSession.name.split(' ')[0] : 'Kisan'}
                  </span>
                  <button
                    onClick={onFarmerLogout}
                    title="Logout Farmer Account"
                    className="text-red-300 hover:text-red-100 font-bold text-3xs bg-red-950/60 hover:bg-red-900 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                  >
                    Logout
                  </button>
                </div>
              </li>
            </>
          )}
          
          {/* Manager Link */}
          <li>
            <button 
              onClick={onAdminClick}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isManagerLoggedIn 
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-500 shadow-inner' 
                  : 'bg-brand-dark text-white hover:bg-emerald-700 border border-green-700'
              }`}
            >
              {isManagerLoggedIn ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span>● {userSession?.name ? userSession.name.split(' ')[0] : 'Manager'}</span>
                </>
              ) : (
                <>
                  <span>🔒</span>
                  <span>Manager Portal</span>
                </>
              )}
            </button>
          </li>
        </ul>

        {/* Mobile Hamburger */}
        <div className="md:hidden flex items-center cursor-pointer p-1" onClick={() => setIsMenuOpen(!isMenuOpen)}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 hover:text-green-200 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </div>
      </div>

      {isMenuOpen && (
        <>
          <div 
            className="fixed inset-0 top-16 bg-black/40 z-40 md:hidden backdrop-blur-2xs"
            onClick={() => setIsMenuOpen(false)}
          />
          <div className="relative z-50 md:hidden bg-brand-dark px-4 pt-2 pb-5 space-y-2 shadow-xl border-t border-emerald-700 animate-fade-in-down">
            {!isFarmerLoggedIn ? (
              <>
                <Link to="/register" className="block px-3 py-2.5 rounded-xl text-base font-bold hover:bg-brand transition-colors cursor-pointer text-white" onClick={() => setIsMenuOpen(false)}>🌱 Register as Farmer</Link>
                <button 
                  onClick={() => { setIsMenuOpen(false); onFarmerLoginClick(); }}
                  className="w-full text-left block px-3 py-2.5 rounded-xl text-base font-extrabold hover:bg-brand transition-colors cursor-pointer text-emerald-200"
                >
                  🧑‍🌾 Farmer Login
                </button>
              </>
            ) : (
              <>
                <Link to="/book-slot" className="block px-3 py-2.5 rounded-xl text-sm font-bold hover:bg-brand transition-colors cursor-pointer text-white" onClick={() => setIsMenuOpen(false)}>⚡ Book Slot</Link>
                <Link to="/tracker" className="block px-3 py-2.5 rounded-xl text-sm font-bold hover:bg-brand transition-colors cursor-pointer text-white" onClick={() => setIsMenuOpen(false)}>🛰️ Tracker</Link>
                <Link to="/payments" className="block px-3 py-2.5 rounded-xl text-sm font-bold hover:bg-brand transition-colors cursor-pointer text-white" onClick={() => setIsMenuOpen(false)}>💰 DBT Payments</Link>
                <Link to="/notifications" className="block px-3 py-2.5 rounded-xl text-sm font-bold hover:bg-brand transition-colors cursor-pointer text-white flex items-center justify-between" onClick={() => setIsMenuOpen(false)}>
                  <span>🔔 Notifications</span>
                  {unreadCount > 0 && (
                    <span className="bg-emerald-400 text-emerald-950 text-xs font-black px-2 py-0.5 rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </Link>
                <div className="flex items-center justify-between px-3 py-2.5 bg-emerald-900/90 rounded-xl border border-emerald-600/40 mt-1">
                  <span className="text-xs font-extrabold text-emerald-100">🧑‍🌾 {farmerSession?.name || 'Kisan'}</span>
                  <button onClick={() => { setIsMenuOpen(false); onFarmerLogout(); }} className="text-xs font-bold text-red-300 hover:text-red-100 bg-red-950/80 px-2 py-1 rounded-md">Logout</button>
                </div>
              </>
            )}

            <button 
              onClick={() => { setIsMenuOpen(false); onAdminClick(); }}
              className="w-full text-left block px-3 py-2.5 rounded-xl text-sm font-bold hover:bg-brand transition-colors cursor-pointer text-yellow-300 border-t border-emerald-800/80 pt-3 mt-2"
            >
              {isManagerLoggedIn ? `● ${userSession?.name || 'Manager'}` : '🔒 Mandi Manager Portal'}
            </button>
          </div>
        </>
      )}
    </nav>
  );
}

// Protected Route Barrier for Private Farmer Features
function FarmerAuthGate({ farmerSession, onFarmerLoginClick, children }) {
  const navigate = useNavigate();
  if (!farmerSession) {
    return (
      <div className="py-20 px-4 max-w-lg mx-auto text-center space-y-6 animate-fade-in">
        <div className="w-20 h-20 bg-emerald-100 border-2 border-emerald-300 rounded-full flex items-center justify-center mx-auto text-3xl shadow-inner">
          🔒
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-extrabold text-gray-900">Farmer Authentication Required</h2>
          <p className="text-sm text-gray-600 max-w-md mx-auto leading-relaxed">
            Please sign in with your registered 12-digit Aadhaar & OTP to access your personal procurement passes, live consignment tracker, and DBT payouts.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <button
            onClick={onFarmerLoginClick}
            className="bg-brand hover:bg-brand-dark text-white font-extrabold px-6 py-3 rounded-xl text-sm transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-2"
          >
            <span>🧑‍🌾</span>
            <span>Farmer Login</span>
          </button>
          <button
            onClick={() => navigate('/register')}
            className="bg-white hover:bg-emerald-50 text-emerald-800 border-2 border-emerald-600 font-bold px-6 py-3 rounded-xl text-sm transition-all shadow-sm cursor-pointer"
          >
            Register as New Farmer
          </button>
        </div>
      </div>
    );
  }
  return children;
}

function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Manager Session State
  const [userSession, setUserSession] = useState(null);
  const [showAdminModal, setShowAdminModal] = useState(false);

  // Farmer Persistent Session State
  const [farmerSession, setFarmerSession] = useState(() => {
    try {
      const saved = localStorage.getItem('farmer_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [showFarmerModal, setShowFarmerModal] = useState(false);

  // Hide top navbar on the root gateway screen when logged out
  const isPublicHome = location.pathname === '/' && !farmerSession;

  // Sync state if changed across tabs or in other pages
  useEffect(() => {
    const handleStorageSync = () => {
      try {
        const saved = localStorage.getItem('farmer_session');
        setFarmerSession(saved ? JSON.parse(saved) : null);
      } catch {}
    };
    window.addEventListener('farmer-session-changed', handleStorageSync);
    return () => window.removeEventListener('farmer-session-changed', handleStorageSync);
  }, []);

  // Manager Handlers
  const handleAdminClick = () => {
    if (userSession) {
      navigate('/admin');
    } else {
      setShowAdminModal(true);
    }
  };

  const handleAdminLoginSuccess = (account) => {
    setUserSession(account);
    setShowAdminModal(false);
    navigate('/admin');
  };

  const handleAdminLogout = () => {
    setUserSession(null);
    navigate('/');
  };

  // Farmer Handlers
  const handleFarmerLoginClick = () => {
    setShowFarmerModal(true);
  };

  const handleFarmerLoginSuccess = (sessionData) => {
    setFarmerSession(sessionData);
    setShowFarmerModal(false);
    window.dispatchEvent(new Event('farmer-session-changed'));
    window.dispatchEvent(new Event('notifications-updated'));
  };

  const handleFarmerLogout = () => {
    localStorage.removeItem('farmer_session');
    localStorage.removeItem('farmer_aadhar');
    localStorage.removeItem('farmer_name');
    setFarmerSession(null);
    window.dispatchEvent(new Event('farmer-session-changed'));
    navigate('/');
  };

  return (
    <div className="relative min-h-screen bg-gray-50 font-sans">
      
      {/* Manager Login Modal */}
      <AdminLoginModal 
        isOpen={showAdminModal} 
        onClose={() => setShowAdminModal(false)} 
        onLoginSuccess={handleAdminLoginSuccess}
      />

      {/* Farmer Login Modal */}
      <FarmerLoginModal
        isOpen={showFarmerModal}
        onClose={() => setShowFarmerModal(false)}
        onLoginSuccess={handleFarmerLoginSuccess}
      />

      {/* Watermark Background */}
      <div 
        className="fixed inset-0 z-0 bg-cover bg-center opacity-15"
        style={{ backgroundImage: "url('/wheat-bg.jpg')" }}
      ></div>

      {/* Content */}
      <div className="relative z-10">
        
        {/* Navigation Bar (Hidden on Public Homepage) */}
        {!isPublicHome && (
          <NavigationBar 
            userSession={userSession} 
            onAdminClick={handleAdminClick} 
            farmerSession={farmerSession}
            onFarmerLoginClick={handleFarmerLoginClick}
            onFarmerLogout={handleFarmerLogout}
          />
        )}
        
        {/* Main Content Area */}
        <main className="max-w-7xl mx-auto">
          <Routes>
            <Route 
              path="/" 
              element={
                <Home 
                  farmerSession={farmerSession} 
                  onFarmerLoginClick={handleFarmerLoginClick} 
                  onFarmerLogout={handleFarmerLogout} 
                  onAdminClick={handleAdminClick}
                />
              } 
            />
            <Route path="/register" element={<Registration />} />
            
            {/* Protected Farmer Routes */}
            <Route 
              path="/book-slot" 
              element={
                <FarmerAuthGate farmerSession={farmerSession} onFarmerLoginClick={handleFarmerLoginClick}>
                  <SlotBooking />
                </FarmerAuthGate>
              } 
            />
            <Route 
              path="/tracker" 
              element={
                <FarmerAuthGate farmerSession={farmerSession} onFarmerLoginClick={handleFarmerLoginClick}>
                  <ProcurementTracker />
                </FarmerAuthGate>
              } 
            />
            <Route 
              path="/payments" 
              element={
                <FarmerAuthGate farmerSession={farmerSession} onFarmerLoginClick={handleFarmerLoginClick}>
                  <PaymentStatus />
                </FarmerAuthGate>
              } 
            />
            <Route 
              path="/notifications" 
              element={
                <FarmerAuthGate farmerSession={farmerSession} onFarmerLoginClick={handleFarmerLoginClick}>
                  <Notifications />
                </FarmerAuthGate>
              } 
            />
            <Route 
              path="/admin" 
              element={
                <AdminConsole 
                  userSession={userSession} 
                  onLogout={handleAdminLogout} 
                  onOpenLogin={() => setShowAdminModal(true)} 
                />
              } 
            />
          </Routes>
        </main>
      
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Router>
        <MainLayout />
      </Router>
    </ErrorBoundary>
  );
}
