import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

const API_BASE = (import.meta.env.VITE_API_URL || '') + '/api/notifications';

/**
 * Utility to highlight key values (Token #, Rs. Amount, Quintals, Dates) in bold
 */
function HighlightedText({ text }) {
  if (!text) return null;

  // Regex targeting tokens (#TK-xxx, #AS-xxx), money (Rs. xxx, ₹xxx), quantities (xx Quintals, xx क्विंटल), IDs (AS-xxx), UTRs (#DBTxxx)
  const pattern = /(#[A-Z0-9-]+|Rs\.\s*[\d,]+|₹\s*[\d,]+|रु\.\s*[\d,]+|\d+\s*Quintals|\d+\s*क्विंटल|AS-\d+-[A-Z0-9-]+)/g;
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

function getLocalizedNotification(notif, isHindi) {
  if (!isHindi || !notif) {
    return {
      title: notif?.title || '',
      message: notif?.message || '',
      action_hint: notif?.action_hint || ''
    };
  }

  let title = notif.title || '';
  let message = notif.message || '';
  let action_hint = notif.action_hint || '';

  // 1. Localize Titles
  if (/Mandi Slot Confirmed/i.test(title)) {
    title = 'मंडी स्लॉट की पुष्टि हुई!';
  } else if (/Mandi Slot & Token Cancelled|Slot & Token Cancelled/i.test(title)) {
    title = 'मंडी स्लॉट व टोकन रद्द किया गया';
  } else if (/Mandi Slot Rescheduled|Slot Rescheduled/i.test(title)) {
    title = 'मंडी स्लॉट पुनः निर्धारित किया गया!';
  } else if (/Welcome to AnnaSetu/i.test(title)) {
    title = 'अन्नसेतु में आपका स्वागत है!';
  } else if (/Land Details in Review/i.test(title)) {
    title = 'भूमि विवरण समीक्षाधीन है';
  } else if (/Reminder: Mandi Shift Tomorrow|Mandi Shift Tomorrow/i.test(title)) {
    title = 'स्मरण: कल आपकी मंडी शिफ्ट है';
  } else if (/Missed Your Slot/i.test(title)) {
    title = 'आपकी निर्धारित शिफ्ट छूट गई';
  } else if (/Mandi Gate Check-in Completed|Gate Check-in/i.test(title)) {
    title = 'मंडी गेट चेक-इन पूर्ण हुआ';
  } else if (/Quality Lab Test Passed/i.test(title)) {
    title = 'गुणवत्ता लैब जांच उत्तीर्ण!';
  } else if (/Weighbridge Weight Confirmed/i.test(title)) {
    title = 'वेब्रिज वजन की पुष्टि हुई';
  } else if (/Mandi Consignment Rejected|Consignment Rejected/i.test(title)) {
    title = '⚠️ मंडी कंसाइनमेंट अस्वीकृत';
  } else if (/J-Form Approved/i.test(title)) {
    title = 'जे-फॉर्म स्वीकृत — DBT प्रक्रिया जारी';
  } else if (/Money Sent to Your Bank via DBT/i.test(title)) {
    title = 'DBT द्वारा बैंक खाते में राशि जमा!';
  } else if (/Rain Advisory at Mandi|Weather Advisory/i.test(title)) {
    title = 'मंडी में वर्षा चेतावनी / परामर्श';
  } else if (/Issue faced in transaction/i.test(title)) {
    title = 'लेनदेन में समस्या आई';
  }

  // 2. Helper to translate Mandi and Date phrases
  const translateMandi = (str) => {
    return str
      .replace(/Ludhiana Grain Logistics Terminal/gi, 'लुधियाना अनाज लॉजिस्टिक्स टर्मिनल')
      .replace(/Meerut Central Agro Warehouse/gi, 'मेरठ केंद्रीय कृषि गोदाम')
      .replace(/Guwahati Regional Silo complex/gi, 'गुवाहाटी क्षेत्रीय साइलो परिसर')
      .replace(/Assam Agro Silo Depot/gi, 'असम कृषि साइलो डिपो')
      .replace(/\(Gate #1\)/gi, '(गेट #1)');
  };

  const translateDaysMonths = (str) => {
    return str
      .replace(/Monday/gi, 'सोमवार')
      .replace(/Tuesday/gi, 'मंगलवार')
      .replace(/Wednesday/gi, 'बुधवार')
      .replace(/Thursday/gi, 'गुरुवार')
      .replace(/Friday/gi, 'शुक्रवार')
      .replace(/Saturday/gi, 'शनिवार')
      .replace(/Sunday/gi, 'रविवार')
      .replace(/Jan/gi, 'जनवरी')
      .replace(/Feb/gi, 'फरवरी')
      .replace(/Mar/gi, 'मार्च')
      .replace(/Apr/gi, 'अप्रैल')
      .replace(/May/gi, 'मई')
      .replace(/Jun/gi, 'जून')
      .replace(/Jul/gi, 'जुलाई')
      .replace(/Aug/gi, 'अगस्त')
      .replace(/Sep/gi, 'सितंबर')
      .replace(/Oct/gi, 'अक्टूबर')
      .replace(/Nov/gi, 'नवंबर')
      .replace(/Dec/gi, 'दिसंबर');
  };

  // 3. Localize Message Bodies
  if (/slot to sell grain is booked for/i.test(message) || /slot is booked for/i.test(message)) {
    const m = message.match(/booked for (.*?)\s*(\(.*?\))?\s*at\s*(.*?)(?:\.|$)/i);
    if (m) {
      const datePart = translateDaysMonths(m[1] || '').trim();
      const shiftPart = m[2] ? ` ${m[2]}` : '';
      const centrePart = translateMandi(m[3] || 'मंडी केंद्र').trim();
      message = `${centrePart} पर अनाज लाने के लिए आपका स्लॉट ${datePart}${shiftPart} के लिए बुक हो गया है।`;
    }
  } else if (/scheduled shift.*is scheduled at/i.test(message) || /grain selling shift.*is scheduled at/i.test(message)) {
    const m = message.match(/shift\s*(\(.*?\))?\s*is scheduled at\s*(.*?)(?:\.|$)/i);
    const shift = m ? m[1] || '' : '';
    const centre = m ? translateMandi(m[2] || '') : 'मंडी';
    message = `${centre} पर आपकी अनाज बिक्री शिफ्ट ${shift} निर्धारित है।`;
  } else if (/Your sign-up is complete/i.test(message) || /Hello .*!/i.test(message)) {
    const nameMatch = message.match(/Hello (.*?)!/i);
    const idMatch = message.match(/Farmer ID is (.*?)(?:\.|$)/i);
    const name = nameMatch ? nameMatch[1] : 'किसान';
    const fId = idMatch ? idMatch[1] : '';
    message = `नमस्ते ${name}! आपका पंजीकरण पूरा हो गया है। आपका किसान आईडी ${fId} है।`;
  } else if (/land record for Plot/i.test(message)) {
    const plotMatch = message.match(/Plot #(.*?)(?: is|$)/i);
    const plot = plotMatch ? plotMatch[1] : '';
    message = `प्लॉट #${plot} के लिए आपके भूमि रिकॉर्ड की प्रशासनिक जांच की जा रही है।`;
  } else if (/Entry cleared and verified against Gate Pass/i.test(message)) {
    const gpMatch = message.match(/Gate Pass #(.*?)(?:\.|$)/i);
    const gp = gpMatch ? gpMatch[1] : '';
    message = `गेट पास #${gp} के विरुद्ध मंडी में प्रवेश सत्यापित कर लिया गया है।`;
  } else if (/Grain lot verified:/i.test(message)) {
    message = message
      .replace(/Grain lot verified:/gi, 'अनाज लॉट सत्यापित:')
      .replace(/with/gi, 'सहित')
      .replace(/moisture content/gi, 'नमी मात्रा');
  } else if (/Net Grain Weight:/i.test(message)) {
    message = message
      .replace(/Net Grain Weight:/gi, 'शुद्ध अनाज वजन:')
      .replace(/packaged/gi, 'बोरियां पैक');
  } else if (/Consignment #/i.test(message) && /rejected/i.test(message)) {
    message = message
      .replace(/Consignment #/gi, 'कंसाइनमेंट #')
      .replace(/rejected at/gi, 'पर अस्वीकृत:')
      .replace(/Reason:/gi, 'कारण:')
      .replace(/High Moisture/gi, 'अधिक नमी')
      .replace(/Station 3 \(Quality Lab\)/gi, 'स्टेशन 3 (गुणवत्ता लैब)')
      .replace(/Station 4 \(Weighbridge\)/gi, 'स्टेशन 4 (वेब्रिज)');
  } else if (/J-Form #/i.test(message) && /generated for Rs\./i.test(message)) {
    message = message
      .replace(/J-Form #/gi, 'जे-फॉर्म #')
      .replace(/generated for Rs\./gi, 'रु.')
      .replace(/Quintals/gi, 'क्विंटल')
      .replace(/@ Rs\./gi, '@ रु.')
      .replace(/\)\./gi, ') के लिए स्वीकृत हुआ।');
  } else if (/has arrived in your/i.test(message) || /Money Sent/i.test(message)) {
    message = message
      .replace(/Rs\./gi, 'रु.')
      .replace(/has arrived in your/gi, 'आपके')
      .replace(/Account \(ending in/gi, 'खाते (अंतिम अंक')
      .replace(/Account/gi, 'खाते में जमा हुआ')
      .replace(/\)\./gi, ') में DBT द्वारा जमा हो गई है।');
  } else if (/Heavy moisture expected near/i.test(message)) {
    message = translateMandi(message)
      .replace(/Heavy moisture expected near/gi, 'अत्यधिक नमी/वर्षा की संभावना:')
      .replace(/Covered grain silo sheds are fully active\./gi, 'शेड वाले साइलो पूरी तरह सक्रिय हैं।');
  } else if (/slot for Token.*has been cancelled/i.test(message) || /Token.*has been cancelled/i.test(message)) {
    const tokMatch = message.match(/Token #(.*?)(?:\s|$)/i);
    const tok = tokMatch ? tokMatch[1] : '';
    const reasonMatch = message.match(/Reason:\s*(.*?)(?:\.|$)/i);
    const reason = reasonMatch ? reasonMatch[1] : '';
    message = `टोकन #${tok} के लिए आपकी मंडी बुकिंग रद्द कर दी गई है।${reason ? ` (कारण: ${reason})` : ''}`;
  } else if (/slot for Token.*has been moved to/i.test(message) || /has been rescheduled/i.test(message)) {
    const tokMatch = message.match(/Token #(.*?)(?:\s|$)/i);
    const tok = tokMatch ? tokMatch[1] : '';
    message = `टोकन #${tok} के लिए आपका मंडी स्लॉट सफलतापूर्वक पुनः निर्धारित (रीशेड्यूल) कर दिया गया है।`;
  } else if (/missed your scheduled shift/i.test(message)) {
    message = 'आज आपकी निर्धारित मंडी शिफ्ट छूट गई है।';
  } else if (/Error in bank details found/i.test(message)) {
    message = 'बैंक विवरण में त्रुटि पाई गई है।';
  }

  // 4. Localize Action Hints
  if (/reserved slot capacity has been released/i.test(action_hint)) {
    action_hint = 'आरक्षित स्लॉट क्षमता मुक्त कर दी गई है। आप कभी भी नया स्लॉट बुक कर सकते हैं।';
  } else if (/security QR pass has been updated/i.test(action_hint)) {
    action_hint = 'आपका सुरक्षा QR पास अपडेट हो गया है। कृपया अपनी नई निर्धारित शिफ्ट पर पहुंचें।';
  } else if (/Please carry your Aadhaar card and tractor pass/i.test(action_hint)) {
    const tokMatch = action_hint.match(/Token #(.*?)(?:\.|$)/i);
    const tok = tokMatch ? tokMatch[1].trim() : '';
    action_hint = `टोकन #${tok}। कृपया अपना आधार कार्ड और ट्रैक्टर पास साथ लाएं।`;
  } else if (/Please arrive at Gate/i.test(action_hint)) {
    action_hint = action_hint
      .replace(/Please arrive at Gate #1 with your Token/gi, 'कृपया अपने टोकन सहित गेट #1 पर पहुंचें:');
  } else if (/Proceed to Quality Assaying station/i.test(action_hint)) {
    action_hint = 'नमी जांच के लिए गुणवत्ता लैब स्टेशन पर आगे बढ़ें।';
  } else if (/Proceed to Weighbridge station/i.test(action_hint)) {
    action_hint = 'सकल वजन माप के लिए वेब्रिज स्टेशन पर आगे बढ़ें।';
  } else if (/Proceed to Mandi Manager desk/i.test(action_hint)) {
    action_hint = 'जे-फॉर्म स्वीकृति और DBT भुगतान जारी करने हेतु मंडी प्रबंधक डेस्क पर जाएं।';
  } else if (/Please consult the Mandi In-Charge desk/i.test(action_hint)) {
    action_hint = 'कृपया अपना ट्रैक्टर गेट पास प्राप्त करने हेतु गेट पर मंडी प्रभारी से संपर्क करें।';
  } else if (/Govt PFMS Direct Benefit Transfer is in progress/i.test(action_hint)) {
    action_hint = 'सरकारी PFMS प्रत्यक्ष लाभ हस्तांतरण (DBT) प्रक्रिया में है।';
  } else if (/Official J-Form receipt available for download/i.test(action_hint)) {
    action_hint = 'आधिकारिक जे-फॉर्म रसीद डाउनलोड के लिए उपलब्ध है।';
  } else if (/Cover tractor-trolley with waterproof tarpaulin/i.test(action_hint)) {
    action_hint = 'प्रस्थान से पहले ट्रैक्टर-ट्रॉली को वाटरप्रूफ तिरपाल से ढक लें।';
  } else if (/You can now book a day to sell your grain/i.test(action_hint)) {
    action_hint = 'अब आप अपनी फसल बेचने के लिए स्लॉट बुक कर सकते हैं।';
  } else if (/Message will be sent once it is approved/i.test(action_hint)) {
    action_hint = 'स्वीकृति मिलने के बाद संदेश भेजा जाएगा।';
  } else if (/Tap "Book Slot" to choose a new 3-hour shift/i.test(action_hint)) {
    action_hint = 'नई 3-घंटे की शिफ्ट चुनने के लिए "स्लॉट बुक करें" पर टैप करें।';
  } else if (/Fix the error with the bank/i.test(action_hint)) {
    action_hint = 'कृपया बैंक शाखा से संपर्क कर विवरण सुधारें।';
  }

  return { title, message, action_hint };
}

export default function Notifications() {
  const { t, i18n } = useTranslation();
  const isHindi = i18n.language === 'hi';

  const CATEGORY_CONFIG = {
    registration: { label: t("notif_label_reg"), dot: 'bg-purple-400' },
    booking:      { label: t("notif_label_booking"), dot: 'bg-blue-400' },
    queue:        { label: t("notif_label_queue"), dot: 'bg-amber-400' },
    payment:      { label: t("notif_label_payment"), dot: 'bg-green-500' },
    advisory:     { label: t("notif_label_advisory"), dot: 'bg-orange-400' }
  };

  const CATEGORY_TABS = [
    { id: 'all',          label: t("notif_cat_all") },
    { id: 'booking',      label: t("notif_cat_booking") },
    { id: 'queue',        label: t("notif_cat_queue") },
    { id: 'payment',      label: t("notif_cat_payment") },
    { id: 'registration', label: t("notif_cat_registration") },
    { id: 'advisory',     label: t("notif_cat_advisory") }
  ];

  const savedFarmer = (() => {
    try {
      return JSON.parse(localStorage.getItem('farmer_user')) || {};
    } catch {
      return {};
    }
  })();

  const [farmerId]    = useState(localStorage.getItem('farmer_aadhar') || savedFarmer.aadhar_number || '');
  const [farmerName]  = useState(localStorage.getItem('farmer_name') || savedFarmer.name || 'Registered Kisan');
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

  const filtered = notifications.filter(notif => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const loc = getLocalizedNotification(notif, isHindi);
    return (
      (notif.title       && notif.title.toLowerCase().includes(q))       ||
      (notif.message     && notif.message.toLowerCase().includes(q))     ||
      (notif.action_hint && notif.action_hint.toLowerCase().includes(q)) ||
      (loc.title         && loc.title.toLowerCase().includes(q))         ||
      (loc.message       && loc.message.toLowerCase().includes(q))       ||
      (loc.action_hint   && loc.action_hint.toLowerCase().includes(q))
    );
  });

  const formatTime = (dateStr) => {
    if (!dateStr) return t("notif_just_now");
    const d     = new Date(dateStr);
    const today = new Date();
    const isToday =
      d.getDate()     === today.getDate()     &&
      d.getMonth()    === today.getMonth()    &&
      d.getFullYear() === today.getFullYear();
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return isToday
      ? `${t("notif_today")}, ${time}`
      : `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`;
  };

  return (
    <div className="py-4 px-3 sm:py-8 sm:px-4 max-w-3xl mx-auto space-y-4 sm:space-y-6">

      {/* ── Farmer-Friendly Push Notification Banner ── */}
      {pushPermission !== 'granted' && (
        <div className="bg-emerald-900 text-white rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs shadow-md">
          <div className="flex items-center gap-2">
            <span className="text-base">🔔</span>
            <span className="font-semibold">{t("notif_phone_alerts_msg")}</span>
          </div>
          <button
            onClick={requestPushPermission}
            className="bg-emerald-500 hover:bg-emerald-400 text-white px-3 py-1.5 rounded-lg font-bold transition shrink-0 cursor-pointer"
          >
            {t("notif_turn_on_btn")}
          </button>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("notif_title")}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{farmerName} · {farmerId}</p>
        </div>
        <div className="flex items-center gap-3 mt-1">
          {unreadCount > 0 && (
            <span className="bg-green-600 text-white text-xs font-semibold px-2.5 py-0.5 rounded-full">
              {unreadCount} {t("notif_new_badge")}
            </span>
          )}
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-sm text-green-700 hover:underline font-medium cursor-pointer"
            >
              {t("notif_mark_all_read")}
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
            placeholder={t("notif_search_placeholder")}
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
            <span className="hidden sm:inline">{t("notif_refresh")}</span>
          </button>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={e => setUnreadOnly(e.target.checked)}
            className="w-3.5 h-3.5 accent-green-600 cursor-pointer"
          />
          {t("notif_unread_only")}
        </label>
      </div>

      {/* ── Notification Feed ── */}
      <div className="space-y-2.5">
        {loading ? (
          <div className="py-16 text-center text-gray-400 text-sm" role="status" aria-label="Loading notifications">
            <div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            {t("notif_loading")}
          </div>

        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-gray-500 text-sm">{t("notif_empty")}</p>
            <button
              onClick={handleSeedDemo}
              disabled={seeding}
              className="mt-4 text-sm text-green-700 font-medium hover:underline cursor-pointer"
            >
              {seeding ? t("notif_loading") : t("notif_load_samples")}
            </button>
          </div>

        ) : (
          filtered.map(notif => {
            const cat      = CATEGORY_CONFIG[notif.category] || CATEGORY_CONFIG.advisory;
            const isUnread = !notif.is_read;
            const isOpen   = expandedId === notif._id;
            const loc      = getLocalizedNotification(notif, isHindi);

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
                      {loc.title}
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
                      <HighlightedText text={loc.message} />
                    </p>

                    {/* Action hint */}
                    {loc.action_hint && (
                      <div className="text-sm text-green-800 bg-green-50/70 border border-green-200/60 rounded-lg p-2.5 mt-1 leading-relaxed">
                        <span className="font-extrabold text-green-900 mr-1.5">{t("notif_next_step")}</span>
                        <HighlightedText text={loc.action_hint} />
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
                        <span>{isUnread ? t("notif_mark_read") : t("notif_read")}</span>
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
