import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import Registration from './pages/Registration';

function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <Router>
      <div className="relative min-h-screen bg-gray-50 font-sans">
        
        {/* Watermark Background */}
        <div 
          className="fixed inset-0 z-0 bg-cover bg-center opacity-15"
          style={{ backgroundImage: "url('/wheat-bg.jpg')" }}
        ></div>

        {/* Content */}
        <div className="relative z-10">
          
          {/* Navigation Bar */}
          <nav className="bg-brand text-white shadow-md sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
              
              <Link to="/" className="flex items-center space-x-3 cursor-pointer" onClick={() => setIsMenuOpen(false)}>
                <div className="w-8 h-8 bg-white rounded-full opacity-90 flex items-center justify-center shadow-sm">
                  <span className="text-brand text-xs font-bold">AS</span>
                </div>
                <h1 className="text-2xl font-extrabold tracking-tight">AnnaSetu</h1>
              </Link>
              
              <ul className="hidden md:flex space-x-6 text-sm font-medium">
                <li><Link to="/register" className="cursor-pointer hover:text-green-200 transition-colors">Register</Link></li>
                <li className="cursor-pointer hover:text-green-200 transition-colors">Book Slot</li>
                <li className="cursor-pointer hover:text-green-200 transition-colors">Notifications</li>
                <li className="cursor-pointer hover:text-green-200 transition-colors">Admin</li>
              </ul>

              <div className="md:hidden flex items-center cursor-pointer p-1" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 hover:text-green-200 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </div>
            </div>

            {isMenuOpen && (
              <div className="md:hidden bg-brand-dark px-4 pt-2 pb-4 space-y-2 shadow-inner border-t border-brand">
                <Link to="/register" className="block px-3 py-2 rounded-md text-base font-medium hover:bg-brand transition-colors cursor-pointer" onClick={() => setIsMenuOpen(false)}>Register</Link>
                <div className="block px-3 py-2 rounded-md text-base font-medium hover:bg-brand transition-colors cursor-pointer">Book Slot</div>
                <div className="block px-3 py-2 rounded-md text-base font-medium hover:bg-brand transition-colors cursor-pointer">Notifications</div>
                <div className="block px-3 py-2 rounded-md text-base font-medium hover:bg-brand transition-colors cursor-pointer">Admin Console</div>
              </div>
            )}
          </nav>
          
          {/* Main Content Area */}
          <main className="max-w-7xl mx-auto">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/register" element={<Registration />} />
            </Routes>
          </main>
        
        </div>
      </div>
    </Router>
  );
}
export default App;
