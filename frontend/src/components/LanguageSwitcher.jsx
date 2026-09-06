import React from 'react';
import { useTranslation } from 'react-i18next';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const currentLang = i18n.language ? i18n.language.split('-')[0] : 'en';

  const toggleLanguage = (lang) => {
    i18n.changeLanguage(lang);
    try {
      localStorage.setItem('i18nextLng', lang);
    } catch {}
  };

  return (
    <div className="inline-flex items-center bg-white/95 backdrop-blur-md border-2 border-emerald-500/80 rounded-full p-1 shadow-lg hover:shadow-xl transition-all duration-300">
      <span className="text-sm px-2 text-emerald-800 select-none flex items-center gap-1 font-bold">
        <span>🌐</span>
        <span className="text-2xs uppercase tracking-widest text-emerald-900 hidden sm:inline">Lang</span>
      </span>
      <div className="flex items-center gap-1 bg-gray-100/90 rounded-full p-0.5">
        <button
          onClick={() => toggleLanguage('en')}
          className={`px-3 py-1 rounded-full text-xs font-black transition-all cursor-pointer ${
            currentLang === 'en'
              ? 'bg-emerald-700 text-white shadow-sm scale-105'
              : 'text-gray-600 hover:text-emerald-900 hover:bg-gray-200/60'
          }`}
          title="Switch to English"
        >
          EN
        </button>
        <button
          onClick={() => toggleLanguage('hi')}
          className={`px-3 py-1 rounded-full text-xs font-black transition-all cursor-pointer ${
            currentLang === 'hi'
              ? 'bg-emerald-700 text-white shadow-sm scale-105'
              : 'text-gray-600 hover:text-emerald-900 hover:bg-gray-200/60'
          }`}
          title="हिन्दी में बदलें"
        >
          हिन्दी
        </button>
      </div>
    </div>
  );
}
