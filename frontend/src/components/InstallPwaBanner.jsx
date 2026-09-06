import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export default function InstallPwaBanner() {
  const { t, i18n } = useTranslation();
  const isHindi = i18n.language === 'hi';

  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showBackOnline, setShowBackOnline] = useState(false);

  useEffect(() => {
    // 1. Capture PWA Install Prompt
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Check if user dismissed it recently in localStorage
      const isDismissed = sessionStorage.getItem('pwa_prompt_dismissed');
      if (!isDismissed) {
        setShowInstallBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // 2. Online / Offline Network Monitoring
    const handleOnline = () => {
      setIsOffline(false);
      setShowBackOnline(true);
      setTimeout(() => setShowBackOnline(false), 4000);
    };

    const handleOffline = () => {
      setIsOffline(true);
      setShowBackOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowInstallBanner(false);
    sessionStorage.setItem('pwa_prompt_dismissed', 'true');
  };

  return (
    <>
      {/* Offline Status Alert Banner */}
      {isOffline && (
        <div className="bg-amber-600 text-white text-xs py-2 px-4 text-center font-bold sticky top-0 z-[120] shadow-md flex items-center justify-center gap-2 animate-fade-in-down">
          <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping"></span>
          <span>
            {isHindi 
              ? '⚡ ऑफलाइन मोड सक्रिय: आप सहेजे गए टोकन पास व रसीदें देख रहे हैं।'
              : '⚡ Offline Mode Active: You are viewing cached Mandi passes & receipts.'}
          </span>
        </div>
      )}

      {/* Back Online Toast */}
      {showBackOnline && (
        <div className="bg-emerald-600 text-white text-xs py-2 px-4 text-center font-bold sticky top-0 z-[120] shadow-md flex items-center justify-center gap-2 animate-fade-in-down">
          <span>✅</span>
          <span>
            {isHindi 
              ? 'इंटरनेट पुनः जुड़ गया! डेटा स्वतः सिंक हो रहा है।'
              : 'Back Online! Synchronizing latest Mandi records.'}
          </span>
        </div>
      )}

      {/* PWA In-App Install Prompt Banner */}
      {showInstallBanner && (
        <aside 
          aria-label="PWA Application Installation"
          className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-[110] bg-white border-2 border-emerald-600 rounded-2xl shadow-2xl p-4 flex items-center gap-3 animate-slide-up"
        >
          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-2xl shrink-0 border border-emerald-300 shadow-inner">
            🌾
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-xs font-black text-gray-900 leading-tight">
              {isHindi ? 'अन्नासेतु ऐप इंस्टॉल करें' : 'Install AnnaSetu App'}
            </h3>
            <p className="text-3xs text-gray-600 mt-0.5 leading-snug">
              {isHindi ? 'बिना इंटरनेट के भी पास व पर्ची देखें' : 'Fast access & offline Mandi gate passes'}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleInstallClick}
              className="bg-emerald-700 hover:bg-emerald-800 text-white text-2xs font-extrabold px-3 py-2 rounded-lg shadow-sm transition-transform active:scale-95 cursor-pointer"
            >
              {isHindi ? 'इंस्टॉल' : 'Install'}
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Dismiss Install Banner"
              className="text-gray-400 hover:text-gray-600 p-1.5 text-xs font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        </aside>
      )}
    </>
  );
}
