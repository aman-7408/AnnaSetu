import React, { useState, useEffect, Component, lazy, Suspense } from 'react';
import { useTranslation } from "react-i18next";

import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import AdminLoginModal from './components/AdminLoginModal';
import FarmerLoginModal from './components/FarmerLoginModal';
import LanguageSwitcher from './components/LanguageSwitcher';

const Registration = lazy(() => import('./pages/Registration'));
const SlotBooking = lazy(() => import('./pages/SlotBooking'));
const AdminConsole = lazy(() => import('./pages/AdminConsole'));
const ProcurementTracker = lazy(() => import('./pages/ProcurementTracker'));
const Notifications = lazy(() => import('./pages/Notifications'));
const PaymentStatus = lazy(() => import('./pages/PaymentStatus'));

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
  const { t } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const isManagerLoggedIn = !!userSession;
  const isFarmerLoggedIn = !!farmerSession;

  const checkUnread = async () => {
    try {
      const farmerId = farmerSession?.aadhar || localStorage.getItem('farmer_aadhar');
      if (!farmerId) return;
      const apiBase = import.meta.env.VITE_API_URL || '';
      let res;
      try {
        res = await fetch(`${apiBase}/api/notifications/farmer/${farmerId}?unread_only=true`);
      } catch {
        res = await fetch(`/api/notifications/farmer/${farmerId}?unread_only=true`);
      }
      if (res && res.ok) {
        const data = await res.json();
        if (data.success) {
          setUnreadCount(Number(data.unread_count) || 0);
        }
      }
    } catch (e) {}
  };

  useEffect(() => {
    checkUnread();
    const handler = () => checkUnread();
    window.addEventListener('notifications-updated', handler);
    window.addEventListener('farmer-session-changed', handler);
    const interval = setInterval(checkUnread, 5000);
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
            <h1 className="text-2xl font-extrabold tracking-tight leading-none">{t("app_title")}</h1>
            <span className="text-[10px] text-emerald-200 font-bold uppercase tracking-wider block">{t("nav_sub_title")}</span>
          </div>
        </Link>
        
        {/* Right Action Cluster: Nav Links + Language Switcher */}
        <div className="hidden md:flex items-center gap-4">
          <ul className="flex space-x-5 text-sm font-medium items-center">
            {isFarmerLoggedIn ? (
              /* === 1. LOGGED IN KISAN NAVBAR === */
              <>
                <li><Link to="/book-slot" className="cursor-pointer hover:text-green-200 transition-colors font-medium">{t("nav_book_slot")}</Link></li>
                <li><Link to="/tracker" className="cursor-pointer hover:text-green-200 transition-colors font-medium">{t("nav_tracker")}</Link></li>
                <li><Link to="/payments" className="cursor-pointer hover:text-green-200 transition-colors font-medium">{t("nav_payments")}</Link></li>
                <li>
                  <Link to="/notifications" className="cursor-pointer hover:text-green-200 transition-colors flex items-center gap-1.5 font-medium">
                    <span>{t("nav_notifications")}</span>
                    {unreadCount > 0 && (
                      <span className="bg-red-500 text-white text-[11px] font-black px-2 py-0.5 rounded-full shadow-sm animate-pulse">
                        {unreadCount}
                      </span>
                    )}
                  </Link>
                </li>
                <li>
                  <div className="flex items-center gap-2 bg-emerald-900/90 border border-emerald-400/60 rounded-xl px-3 py-1.5 text-xs shadow-inner">
                    <span className="font-extrabold text-emerald-200 flex items-center gap-1">
                      <span>🧑‍🌾</span> {farmerSession?.name ? farmerSession.name.split(' ')[0] : t("nav_kisan")}
                    </span>
                    <button
                      onClick={onFarmerLogout}
                      title="Logout Farmer Account"
                      className="text-red-300 hover:text-red-100 font-bold text-3xs bg-red-950/60 hover:bg-red-900 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                    >
                      {t("nav_logout")}
                    </button>
                  </div>
                </li>
              </>
            ) : isManagerLoggedIn ? (
              /* === 2. LOGGED IN MANDI MANAGER NAVBAR (ONLY MANAGER NAME) === */
              <li>
                <div className="flex items-center gap-2 bg-emerald-950 border border-emerald-500/80 rounded-xl px-3.5 py-1.5 text-xs shadow-md">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="font-extrabold text-emerald-200">
                    {userSession?.name || 'Manager'}
                  </span>
                </div>
              </li>
            ) : (
              /* === 3. PUBLIC GUEST NAVBAR === */
              <>
                <li>
                  <Link to="/register" className="cursor-pointer hover:text-green-200 transition-colors font-bold">
                    {t("nav_register")}
                  </Link>
                </li>
                <li>
                  <button
                    onClick={onFarmerLoginClick}
                    className="bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer border border-emerald-500/50 active:scale-95"
                  >
                    <span>🧑‍🌾</span>
                    <span>{t("nav_farmer_login")}</span>
                  </button>
                </li>
                <li>
                  <button 
                    onClick={onAdminClick}
                    className="bg-brand-dark text-white hover:bg-emerald-700 border border-green-700 flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
                  >
                    <span>🔒</span>
                    <span>{t("nav_manager_portal")}</span>
                  </button>
                </li>
              </>
            )}
          </ul>
          <LanguageSwitcher />
        </div>

        {/* Mobile Right Header: Instant Bell + Hamburger */}
        <div className="md:hidden flex items-center gap-2">
          <LanguageSwitcher />
          {isFarmerLoggedIn && (
            <Link 
              to="/notifications" 
              className="relative p-1.5 text-white hover:text-emerald-200 cursor-pointer flex items-center justify-center"
              onClick={() => setIsMenuOpen(false)}
            >
              <span className="text-xl">🔔</span>
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-md animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
          )}

          <div className="flex items-center cursor-pointer p-1" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 hover:text-green-200 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </div>
        </div>
      </div>

      {isMenuOpen && (
        <>
          <div 
            className="fixed inset-0 top-16 bg-black/40 z-40 md:hidden backdrop-blur-2xs"
            onClick={() => setIsMenuOpen(false)}
          />
          <div className="relative z-50 md:hidden bg-brand-dark px-4 pt-2 pb-5 space-y-2 shadow-xl border-t border-emerald-700 animate-fade-in-down">
            {isFarmerLoggedIn ? (
              /* === MOBILE: FARMER === */
              <>
                <Link to="/book-slot" className="block px-3 py-2.5 rounded-xl text-sm font-bold hover:bg-brand transition-colors cursor-pointer text-white" onClick={() => setIsMenuOpen(false)}>⚡ {t("nav_book_slot")}</Link>
                <Link to="/tracker" className="block px-3 py-2.5 rounded-xl text-sm font-bold hover:bg-brand transition-colors cursor-pointer text-white" onClick={() => setIsMenuOpen(false)}>🛰️ {t("nav_tracker")}</Link>
                <Link to="/payments" className="block px-3 py-2.5 rounded-xl text-sm font-bold hover:bg-brand transition-colors cursor-pointer text-white" onClick={() => setIsMenuOpen(false)}>💰 {t("nav_payments")}</Link>
                <Link to="/notifications" className="block px-3 py-2.5 rounded-xl text-sm font-bold hover:bg-brand transition-colors cursor-pointer text-white flex items-center justify-between" onClick={() => setIsMenuOpen(false)}>
                  <span className="flex items-center gap-2">
                    <span>🔔</span>
                    <span>{t("nav_notifications")}</span>
                  </span>
                  {unreadCount > 0 && (
                    <span className="bg-red-500 text-white text-xs font-black px-2.5 py-0.5 rounded-full shadow-sm animate-pulse">
                      {unreadCount} {t("nav_new_count")}
                    </span>
                  )}
                </Link>
                <div className="flex items-center justify-between px-3 py-2.5 bg-emerald-900/90 rounded-xl border border-emerald-600/40 mt-1">
                  <span className="text-xs font-extrabold text-emerald-100">🧑‍🌾 {farmerSession?.name || t("nav_kisan")}</span>
                  <button onClick={() => { setIsMenuOpen(false); onFarmerLogout(); }} className="text-xs font-bold text-red-300 hover:text-red-100 bg-red-950/80 px-2 py-1 rounded-md">{t("nav_logout")}</button>
                </div>
              </>
            ) : isManagerLoggedIn ? (
              /* === MOBILE: MANAGER (ONLY MANAGER NAME) === */
              <div className="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-950/90 rounded-xl border border-emerald-500/60">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-sm font-extrabold text-emerald-100">{userSession?.name || 'Manager'}</span>
              </div>
            ) : (
              /* === MOBILE: PUBLIC GUEST === */
              <>
                <Link to="/register" className="block px-3 py-2.5 rounded-xl text-base font-bold hover:bg-brand transition-colors cursor-pointer text-white" onClick={() => setIsMenuOpen(false)}>🌱 {t("nav_register")}</Link>
                <button 
                  onClick={() => { setIsMenuOpen(false); onFarmerLoginClick(); }}
                  className="w-full text-left block px-3 py-2.5 rounded-xl text-base font-extrabold hover:bg-brand transition-colors cursor-pointer text-emerald-200"
                >
                  🧑‍🌾 {t("nav_farmer_login")}
                </button>
                <button 
                  onClick={() => { setIsMenuOpen(false); onAdminClick(); }}
                  className="w-full text-left block px-3 py-2.5 rounded-xl text-sm font-bold hover:bg-brand transition-colors cursor-pointer text-yellow-300 border-t border-emerald-800/80 pt-3 mt-2 flex items-center gap-2"
                >
                  🔒 {t("nav_manager_portal")}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </nav>
  );
}

// Protected Route Barrier for Private Farmer Features
function FarmerAuthGate({ farmerSession, onFarmerLoginClick, children }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  if (!farmerSession) {
    return (
      <div className="py-20 px-4 max-w-lg mx-auto text-center space-y-6 animate-fade-in">
        <div className="w-20 h-20 bg-emerald-100 border-2 border-emerald-300 rounded-full flex items-center justify-center mx-auto text-3xl shadow-inner">
          🔒
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-extrabold text-gray-900">{t("auth_gate_title")}</h2>
          <p className="text-sm text-gray-600 max-w-md mx-auto leading-relaxed">
            {t("auth_gate_desc")}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <button
            onClick={onFarmerLoginClick}
            className="bg-brand hover:bg-brand-dark text-white font-extrabold px-6 py-3 rounded-xl text-sm transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-2"
          >
            <span>🧑‍🌾</span>
            <span>{t("auth_gate_login")}</span>
          </button>
          <button
            onClick={() => navigate('/register')}
            className="bg-white hover:bg-emerald-50 text-emerald-800 border-2 border-emerald-600 font-bold px-6 py-3 rounded-xl text-sm transition-all shadow-sm cursor-pointer"
          >
            {t("auth_gate_register")}
          </button>
        </div>
      </div>
    );
  }
  return children;
}

function PageLoader() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center animate-fade-in">
      <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mb-4" />
      <p className="text-xs font-semibold text-emerald-800 tracking-wide">Loading portal...</p>
    </div>
  );
}

function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Manager Persistent Session State
  const [userSession, setUserSession] = useState(() => {
    try {
      const saved = localStorage.getItem('manager_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
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
        const savedFarmer = localStorage.getItem('farmer_session');
        setFarmerSession(savedFarmer ? JSON.parse(savedFarmer) : null);
        const savedManager = localStorage.getItem('manager_session');
        setUserSession(savedManager ? JSON.parse(savedManager) : null);
      } catch {}
    };
    window.addEventListener('farmer-session-changed', handleStorageSync);
    window.addEventListener('manager-session-changed', handleStorageSync);
    window.addEventListener('storage', handleStorageSync);
    return () => {
      window.removeEventListener('farmer-session-changed', handleStorageSync);
      window.removeEventListener('manager-session-changed', handleStorageSync);
      window.removeEventListener('storage', handleStorageSync);
    };
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
    try {
      localStorage.setItem('manager_session', JSON.stringify(account));
    } catch {}
    setUserSession(account);
    setShowAdminModal(false);
    window.dispatchEvent(new Event('manager-session-changed'));
    navigate('/admin');
  };

  const handleAdminLogout = () => {
    try {
      localStorage.removeItem('manager_session');
    } catch {}
    setUserSession(null);
    window.dispatchEvent(new Event('manager-session-changed'));
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
          <Suspense fallback={<PageLoader />}>
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
          </Suspense>
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
