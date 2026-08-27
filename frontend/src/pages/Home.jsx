import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="w-36 h-36 bg-white rounded-full flex items-center justify-center mb-8 border-4 border-brand shadow-xl p-2 overflow-hidden transform hover:scale-105 transition-transform duration-300">
        <img 
          src="/logo.png" 
          alt="AnnaSetu Official Logo" 
          className="w-full h-full object-cover rounded-full"
          style={{ imageRendering: '-webkit-optimize-contrast' }}
        />
      </div>
      
      <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-4 tracking-tight shadow-sm">
        Welcome to <span className="text-brand">AnnaSetu</span>
      </h1>
      <p className="text-lg text-gray-700 font-medium max-w-2xl mx-auto mb-10 leading-relaxed">
        Your gateway to a direct and sustainable agricultural marketplace.
      </p>
      
      <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
        <button 
          onClick={() => navigate('/register')}
          className="bg-brand text-white px-8 py-4 rounded-lg font-bold text-lg hover:bg-brand-dark transition-colors shadow-lg flex items-center justify-center gap-2"
        >
          Register as a New Farmer
        </button>
        <button 
          onClick={() => navigate('/book-slot')}
          className="bg-white text-brand border-2 border-brand px-8 py-4 rounded-lg font-bold text-lg hover:bg-gray-50 transition-colors shadow-lg flex items-center justify-center gap-2"
        >
          Book a Slot
        </button>
      </div>
    </div>
  );
}
