import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import Home from './pages/Home';
import Registration from './pages/Registration';
import SlotBooking from './pages/SlotBooking';
import AdminConsole from './pages/AdminConsole';
import AdminLoginModal from './components/AdminLoginModal';
import Notifications from './pages/Notifications';

function NavigationBar({ userSession, onAdminClick }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isLoggedIn = !!userSession;

  return (
    <nav className="bg-brand text-white shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
        
        <Link to="/" className="flex items-center space-x-3 cursor-pointer" onClick={() => setIsMenuOpen(false)}>
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-md overflow-hidden p-0.5 border-2 border-emerald-300 shrink-0">
            <img 
              src="/logo.png" 
              alt="AnnaSetu Official Emblem" 
              className="w-full h-full object-cover rounded-full"
              style={{ imageRendering: '-webkit-optimize-contrast' }}
            />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">AnnaSetu</h1>
        </Link>
        
        <ul className="hidden md:flex space-x-6 text-sm font-medium items-center">
          <li><Link to="/register" className="cursor-pointer hover:text-green-200 transition-colors">Register</Link></li>
          <li><Link to="/book-slot" className="cursor-pointer hover:text-green-200 transition-colors">Book Slot</Link></li>
          <li>
            <Link to="/notifications" className="cursor-pointer hover:text-green-200 transition-colors flex items-center gap-1.5">
              <span>Notifications</span>
              <span className="bg-emerald-400 text-emerald-950 text-[10px] font-black px-1.5 py-0.5 rounded-full">New</span>
            </Link>
          </li>
          
          {/* Manager Link */}
          <li>
            <button 
              onClick={onAdminClick}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isLoggedIn 
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-500 shadow-inner' 
                  : 'bg-brand-dark text-white hover:bg-emerald-700 border border-green-700'
              }`}
            >
              {isLoggedIn ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span>● {userSession.name.split(' ')[0]}</span>
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
        <div className="md:hidden bg-brand-dark px-4 pt-2 pb-4 space-y-2 shadow-inner border-t border-brand">
          <Link to="/register" className="block px-3 py-2 rounded-md text-base font-medium hover:bg-brand transition-colors cursor-pointer" onClick={() => setIsMenuOpen(false)}>Register</Link>
          <Link to="/book-slot" className="block px-3 py-2 rounded-md text-base font-medium hover:bg-brand transition-colors cursor-pointer" onClick={() => setIsMenuOpen(false)}>Book Slot</Link>
          <Link to="/notifications" className="block px-3 py-2 rounded-md text-base font-medium hover:bg-brand transition-colors cursor-pointer" onClick={() => setIsMenuOpen(false)}>Notifications</Link>
          <button 
            onClick={() => { setIsMenuOpen(false); onAdminClick(); }}
            className="w-full text-left block px-3 py-2 rounded-md text-base font-medium hover:bg-brand transition-colors cursor-pointer font-bold text-yellow-300"
          >
            {isLoggedIn ? `● ${userSession.name}` : '🔒 Manager Login'}
          </button>
        </div>
      )}
    </nav>
  );
}

function MainLayout() {
  const navigate = useNavigate();
  const [userSession, setUserSession] = useState(null);
  const [showAdminModal, setShowAdminModal] = useState(false);

  const handleAdminClick = () => {
    if (userSession) {
      navigate('/admin');
    } else {
      setShowAdminModal(true);
    }
  };

  const handleLoginSuccess = (account) => {
    setUserSession(account);
    setShowAdminModal(false);
    navigate('/admin');
  };

  const handleLogout = () => {
    setUserSession(null);
    navigate('/');
  };

  return (
    <div className="relative min-h-screen bg-gray-50 font-sans">
      
      {/* Login Popup Window */}
      <AdminLoginModal 
        isOpen={showAdminModal} 
        onClose={() => setShowAdminModal(false)} 
        onLoginSuccess={handleLoginSuccess}
      />

      {/* Watermark Background */}
      <div 
        className="fixed inset-0 z-0 bg-cover bg-center opacity-15"
        style={{ backgroundImage: "url('/wheat-bg.jpg')" }}
      ></div>

      {/* Content */}
      <div className="relative z-10">
        
        {/* Navigation Bar */}
        <NavigationBar 
          userSession={userSession} 
          onAdminClick={handleAdminClick} 
        />
        
        {/* Main Content Area */}
        <main className="max-w-7xl mx-auto">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/register" element={<Registration />} />
            <Route path="/book-slot" element={<SlotBooking />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route 
              path="/admin" 
              element={
                <AdminConsole 
                  userSession={userSession} 
                  onLogout={handleLogout} 
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
    <Router>
      <MainLayout />
    </Router>
  );
}
