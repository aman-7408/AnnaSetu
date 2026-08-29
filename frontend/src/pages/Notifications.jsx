import { useState, useEffect, useRef } from 'react';

const API_BASE = (import.meta.env.VITE_API_URL || '') + '/api/notifications';

const CATEGORY_CONFIG = {
  registration: { label: 'Sign-up & Account', dot: 'bg-purple-400' },
  booking:      { label: 'Slot Booking',       dot: 'bg-blue-400'   },
  queue:        { label: 'Mandi Queue',         dot: 'bg-amber-400'  },
  payment:      { label: 'Payment & Money',     dot: 'bg-green-500'  },
  advisory:     { label: 'Mandi Advisory',      dot: 'bg-orange-400' }
};

const CATEGORY_TABS = [
  { id: 'all',          label: 'All'           },
  { id: 'booking',      label: 'Slot Bookings' },
  { id: 'queue',        label: 'Mandi Queue'   },
  { id: 'payment',      label: 'Payments'      },
  { id: 'registration', label: 'Account'       },
  { id: 'advisory',     label: 'Advisories'    }
];

/**
 * Utility to highlight key values (Token #, Rs. Amount, Quintals, Dates) in bold
 */
function HighlightedText({ text }) {
  if (!text) return null;

  // Regex targeting tokens (#TK-xxx), money (Rs. xxx), quantities (xx Quintals), IDs (AS-xxx), UTRs (#DBTxxx)
  const pattern = /(#[A-Z0-9-]+|Rs\.\s*[\d,]+|\d+\s*Quintals|AS-\d+-\d+)/g;
  const parts = text.split(pattern);

  return (
    <span>
      {parts.map((part, i) =>
        pattern.test(part) ? (
          <strong key={i} className="font-extrabold text-gray-900 bg-green-50 px-1 py-0.5 rounded border border-green-200/60">
            {part}
          </strong>
        ) : (
          part
        )
      )}
    </span>
  );
}

export default function Notifications() {
  const savedFarmer = (() => {
    try {
      return JSON.parse(localStorage.getItem('farmer_user')) || {};
    } catch {
      return {};
    }
  })();

  const [farmerId]    = useState(localStorage.getItem('farmer_aadhar') || savedFarmer.aadhar_number || '111122223333');
  const [farmerName]  = useState(localStorage.getItem('farmer_name') || savedFarmer.name || 'Aman Kumar');
  const [notifications, setNotifications]     = useState([]);
  const [unreadCount, setUnreadCount]         = useState(0);
  const [loading, setLoading]                 = useState(false);
  const [activeCategory, setActiveCategory]   = useState('all');
  const [unreadOnly, setUnreadOnly]           = useState(false);
  const [searchQuery, setSearchQuery]         = useState('');
  const [seeding, setSeeding]                 = useState(false);
  const [triggering, setTriggering]           = useState(false);
  const [showTestMenu, setShowTestMenu]       = useState(false);

  // Native Browser Notification Permission State
  const [pushPermission, setPushPermission]   = useState('default');
  const knownNotifIdsRef                      = useRef(new Set());

  // Expanded state lives only in memory — resets on every page visit
  const [expandedId, setExpandedId]           = useState(null);

  // Check & Request Native Push Notification Permission
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPushPermission(window.Notification.permission);
    }
  }, []);

  const requestPushPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const perm = await window.Notification.requestPermission();
      setPushPermission(perm);
      if (perm === 'granted') {
        triggerNativeOSNotification(
          '🔔 Phone Alerts Enabled!',
          'You will now get instant sound and vibration updates for all your mandi dates and payments.'
        );
      }
    }
  };

  // Helper to fire Native Smartphone OS Notification Popup + Vibration
  const triggerNativeOSNotification = (title, message) => {
    if (typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === 'granted') {
      try {
        const notif = new window.Notification(title, {
          body: message,
          icon: '/logo.png',
          tag: Date.now().toString(),
          vibrate: [200, 100, 200]
        });
        notif.onclick = () => {
          window.focus();
        };
      } catch (err) {
        console.error('Native push notification error:', err);
      }
    }
  };

  // ── Fetch notifications from backend ──────────────────────────────────────
  const fetchNotifications = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      let url = `${API_BASE}/farmer/${farmerId}?category=${activeCategory}`;
      if (unreadOnly) url += '&unread_only=true';
      const res  = await fetch(url);
      const data = await res.json();

      const fetchedList = data.notifications || [];

      // Check for BRAND NEW notifications to trigger Native Phone OS Banner
      if (knownNotifIdsRef.current.size > 0) {
        const brandNewItems = fetchedList.filter(n => !knownNotifIdsRef.current.has(n._id));
        brandNewItems.forEach(newItem => {
          triggerNativeOSNotification(newItem.title, newItem.message);
        });
      }

      // Update set of known IDs
      fetchedList.forEach(n => knownNotifIdsRef.current.add(n._id));

      setNotifications(fetchedList);
      setUnreadCount(data.unread_count || 0);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // 🔄 Smart 15-Second Auto-Polling + Visibility Check
  useEffect(() => {
    fetchNotifications(true);
    setExpandedId(null);

    const interval = setInterval(() => {
      // Prevent aggressive DDOS: Only poll if the user is actually looking at the tab
      if (document.visibilityState === 'visible') {
        fetchNotifications(false);
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [activeCategory, unreadOnly, farmerId]);

  const toggleExpand = (id) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  // ⚡ INSTANT OPTIMISTIC MARK AS READ (0ms UI Delay)
  const markAsRead = async (e, id) => {
    e.stopPropagation(); // don't collapse when clicking mark read
    
    // 1. INSTANT UI UPDATE (0ms delay)
    setNotifications(prev =>
      prev.map(n => n._id === id ? { ...n, is_read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
    window.dispatchEvent(new CustomEvent('notifications-updated'));

    // 2. Background Database Update
    try {
      await fetch(`${API_BASE}/${id}/read`, { method: 'PUT' });
      window.dispatchEvent(new CustomEvent('notifications-updated'));
    } catch (err) {
      console.error('Failed background mark read:', err);
    }
  };

  // ⚡ INSTANT OPTIMISTIC MARK ALL AS READ (0ms UI Delay)
  const markAllAsRead = async () => {
    // 1. INSTANT UI UPDATE (0ms delay)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
    window.dispatchEvent(new CustomEvent('notifications-updated'));

    // 2. Background Database Update
    try {
      await fetch(`${API_BASE}/farmer/${farmerId}/read-all`, { method: 'PUT' });
      window.dispatchEvent(new CustomEvent('notifications-updated'));
    } catch (err) {
      console.error('Failed background mark all read:', err);
    }
  };

  // ⚡ Trigger Test Notification
  const handleTriggerTest = async (trigger_event, metadata = {}) => {
    setTriggering(true);
    setShowTestMenu(false);
    try {
      const res = await fetch(`${API_BASE}/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          farmer_id: farmerId,
          recipient_name: farmerName,
          recipient_phone: '9876543210',
          trigger_event,
          metadata
        })
      });
      const result = await res.json();
      
      // If native push is granted, trigger phone banner immediately
      if (result.notification) {
        triggerNativeOSNotification(result.notification.title, result.notification.message);
      }

      await fetchNotifications(false);
    } catch (err) {
      console.error('Failed to trigger test notification:', err);
    } finally {
      setTriggering(false);
    }
  };

  const handleSeedDemo = async () => {
    setSeeding(true);
    try {
      await fetch(`${API_BASE}/seed-demo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ farmer_id: farmerId, name: farmerName, phone: '9876543210' })
      });
      await fetchNotifications(true);
    } catch (err) { console.error(err); }
    finally { setSeeding(false); }
  };

  const filtered = notifications.filter(n => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (n.title       && n.title.toLowerCase().includes(q))       ||
      (n.message     && n.message.toLowerCase().includes(q))     ||
      (n.action_hint && n.action_hint.toLowerCase().includes(q))
    );
  });

  const formatTime = (dateStr) => {
    if (!dateStr) return 'Just now';
    const d     = new Date(dateStr);
    const today = new Date();
    const isToday =
      d.getDate()     === today.getDate()     &&
      d.getMonth()    === today.getMonth()    &&
      d.getFullYear() === today.getFullYear();
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return isToday
      ? `Today, ${time}`
      : `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`;
  };

  return (
    <div className="py-8 px-4 max-w-3xl mx-auto space-y-6">

      {/* ── Farmer-Friendly Push Notification Banner ── */}
      {pushPermission !== 'granted' && (
        <div className="bg-emerald-900 text-white rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs shadow-md">
          <div className="flex items-center gap-2">
            <span className="text-base">🔔</span>
            <span className="font-semibold">Turn on Phone Alerts to get instant sound and vibration updates for your mandi dates and payments.</span>
          </div>
          <button
            onClick={requestPushPermission}
            className="bg-emerald-500 hover:bg-emerald-400 text-white px-3 py-1.5 rounded-lg font-bold transition shrink-0 cursor-pointer"
          >
            Turn On Alerts
          </button>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-sm text-gray-500 mt-0.5">{farmerName} · {farmerId}</p>
        </div>
        <div className="flex items-center gap-3 mt-1">
          {unreadCount > 0 && (
            <span className="bg-green-600 text-white text-xs font-semibold px-2.5 py-0.5 rounded-full">
              {unreadCount} new
            </span>
          )}
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-sm text-green-700 hover:underline font-medium"
            >
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* ── Category Tabs (Horizontally scrollable on mobile) ── */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto pb-1 no-scrollbar touch-manipulation">
        {CATEGORY_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveCategory(tab.id)}
            className={`px-3.5 py-2 text-xs sm:text-sm font-bold transition-colors border-b-2 -mb-px whitespace-nowrap shrink-0 cursor-pointer ${
              activeCategory === tab.id
                ? 'border-brand text-emerald-800 bg-emerald-50/60 rounded-t-lg font-extrabold'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Search, Matching Blue Refresh & Send Alert Controls (Height aligned: h-10) ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 relative">
          
          {/* Search Input Box */}
          <input
            type="text"
            placeholder="Search notifications..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="h-10 border border-gray-200 rounded-lg px-3.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-green-500 w-44 sm:w-60 shadow-2xs"
          />
          
          {/* 🔄 MATCHING BLUE REFRESH BUTTON */}
          <button
            onClick={() => fetchNotifications(true)}
            disabled={loading}
            className="h-10 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 px-3.5 rounded-lg text-sm font-semibold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
            title="Manual Refresh"
          >
            <span className={loading ? 'animate-spin' : ''}>🔄</span>
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={e => setUnreadOnly(e.target.checked)}
            className="w-3.5 h-3.5 accent-green-600 cursor-pointer"
          />
          Unread only
        </label>
      </div>

      {/* ── Notification Feed ── */}
      <div className="space-y-2.5">
        {loading ? (
          <div className="py-16 text-center text-gray-400 text-sm" role="status" aria-label="Loading notifications">
            <div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading...
          </div>

        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-gray-500 text-sm">No notifications yet.</p>
            <button
              onClick={handleSeedDemo}
              disabled={seeding}
              className="mt-4 text-sm text-green-700 font-medium hover:underline"
            >
              {seeding ? 'Loading...' : 'Load sample notifications'}
            </button>
          </div>

        ) : (
          filtered.map(notif => {
            const cat      = CATEGORY_CONFIG[notif.category] || CATEGORY_CONFIG.advisory;
            const isUnread = !notif.is_read;
            const isOpen   = expandedId === notif._id;

            return (
              <div
                key={notif._id}
                onClick={() => toggleExpand(notif._id)}
                className={`rounded-xl border cursor-pointer transition-colors select-none ${
                  isUnread
                    ? 'bg-white border-gray-200 hover:border-gray-300 shadow-2xs'
                    : 'bg-gray-50 border-gray-100 hover:border-gray-200'
                } ${isOpen ? 'border-gray-300' : ''}`}
              >
                {/* ── Collapsed Row ── */}
                <div className="flex items-center gap-3 px-4 py-3.5">
                  {/* Unread indicator dot */}
                  <span className={`shrink-0 w-3 h-3 rounded-full transition-all ${
                    isUnread ? 'bg-green-500 shadow-xs ring-2 ring-green-100' : 'bg-transparent'
                  }`} />

                  {/* Title — Matching Soft Blue background badge for NEW (unread) notifications */}
                  <div className="flex-1 min-w-0">
                    <p className={`inline-block text-base md:text-lg font-bold leading-snug transition-all ${
                      isUnread
                        ? 'text-blue-950 bg-blue-50/90 border border-blue-100 px-2.5 py-0.5 rounded-lg'
                        : 'text-gray-400'
                    }`}>
                      {notif.title}
                    </p>
                  </div>

                  {/* Chevron */}
                  <span className={`shrink-0 text-gray-300 text-xs transition-transform duration-200 ${
                    isOpen ? 'rotate-180' : ''
                  }`}>
                    ▼
                  </span>
                </div>

                {/* ── Expanded Detail Panel ── */}
                {isOpen && (
                  <div
                    className="px-4 pb-4 border-t border-gray-100 space-y-2.5"
                    onClick={e => e.stopPropagation()}
                  >
                    {/* Meta row */}
                    <div className="flex items-center gap-2 pt-3">
                      <span className={`inline-block w-2.5 h-2.5 rounded-full ${cat.dot}`} />
                      <span className="text-xs font-semibold text-gray-500">{cat.label}</span>
                      <span className="text-xs text-gray-400 ml-auto">{formatTime(notif.sent_at)}</span>
                    </div>

                    {/* Message Body */}
                    <p className="text-base text-gray-800 leading-relaxed font-normal">
                      <HighlightedText text={notif.message} />
                    </p>

                    {/* Action hint */}
                    {notif.action_hint && (
                      <div className="text-sm text-green-800 bg-green-50/70 border border-green-200/60 rounded-lg p-2.5 mt-1 leading-relaxed">
                        <span className="font-extrabold text-green-900 mr-1.5">👉 Next Step:</span>
                        <HighlightedText text={notif.action_hint} />
                      </div>
                    )}

                    {/* Bottom Row: Checkbox on Bottom Right */}
                    <div className="flex justify-end items-center pt-2 border-t border-gray-100/80">
                      <label 
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-2 text-xs font-semibold text-gray-600 hover:text-green-700 cursor-pointer select-none"
                      >
                        <input
                          type="checkbox"
                          checked={!isUnread}
                          onChange={(e) => markAsRead(e, notif._id)}
                          disabled={!isUnread}
                          className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-500 cursor-pointer disabled:cursor-not-allowed"
                        />
                        <span>{isUnread ? 'Mark as read' : 'Read'}</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
