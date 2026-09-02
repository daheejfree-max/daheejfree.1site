// ==============================================================================
// ISLAMIC PRAYER TIME & PRACTICE ENGAGEMENT WIDGET (src/components/prayer/PrayerTimeWidget.tsx)
// Live Salah countdown, Hijri calendar, Qibla compass, city selector, & Islamic reminders
// ==============================================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Clock,
  MapPin,
  Compass,
  Volume2,
  VolumeX,
  RefreshCw,
  Sun,
  Sunrise,
  Sunset,
  Moon,
  ChevronDown,
  Sparkles,
  CheckCircle2,
  Navigation,
  BookOpen,
  Info,
  Calendar,
  Layers,
  Settings,
  Bell,
  BellRing,
  BellOff,
  Search,
  Check,
  AlertCircle,
  X,
} from 'lucide-react';
import {
  PrayerTimesData,
  PrayerInfo,
  getPrayerTimes,
  computeNextPrayerState,
  formatPrayerTime,
  POPULAR_CITIES,
  CALCULATION_METHODS,
  PRAYER_METADATA,
} from '../../lib/prayerTimes';
import { QiblaCompass } from './QiblaCompass';

interface PrayerTimeWidgetProps {
  initialCity?: string;
  initialCountry?: string;
  compact?: boolean;
  onCityChange?: (city: string, country: string) => void;
  className?: string;
}

const ISLAMIC_QUOTES = [
  {
    arabic: 'إِنَّ الصَّلَاةَ كَانَتْ عَلَى الْمُؤْمِنِينَ كِتَابًا مَّوْقُوتًا',
    translation: 'Indeed, prayer has been decreed upon the believers a decree of specified times.',
    source: 'Surah An-Nisa 4:103',
  },
  {
    arabic: 'وَأَقِمِ الصَّلَاةَ لِذِكْرِي',
    translation: 'And establish prayer for My remembrance.',
    source: 'Surah Ta-Ha 20:14',
  },
  {
    arabic: 'الصَّلَاةُ عِمَادُ الدِّينِ',
    translation: 'Prayer is the pillar of faith.',
    source: 'Hadith (Al-Bayhaqi)',
  },
  {
    arabic: 'أَحَبُّ الْأَعْمَالِ إِلَى اللَّهِ الصَّلَاةُ عَلَى وَقْتِهَا',
    translation: 'The most beloved deed to Allah is prayer at its proper time.',
    source: 'Sahih Al-Bukhari & Muslim',
  },
];

export const PrayerTimeWidget: React.FC<PrayerTimeWidgetProps> = ({
  initialCity,
  initialCountry,
  compact = false,
  onCityChange,
  className = '',
}) => {
  // Stored city and settings state
  const [selectedCity, setSelectedCity] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('daheej_prayer_city');
      if (saved) return saved;
    }
    return initialCity || 'Karachi';
  });

  const [selectedCountry, setSelectedCountry] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('daheej_prayer_country');
      if (saved) return saved;
    }
    return initialCountry || 'Location Unknown';
  });

  const [methodId, setMethodId] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('daheej_prayer_method');
      if (saved) return parseInt(saved, 10);
    }
    return 2; // ISNA / Standard
  });

  const [use24Hour, setUse24Hour] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('daheej_prayer_24h') === 'true';
    }
    return false;
  });

  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('daheej_prayer_sound') === 'true';
    }
    return false;
  });

  // Real-time 10-minute prayer notifications state
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('daheej_prayer_notifications') === 'true';
    }
    return false;
  });

  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'unsupported';
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [inAppAlert, setInAppAlert] = useState<{
    prayerName: string;
    arabicName: string;
    time: string;
    minutesRemaining: number;
  } | null>(null);

  const notifiedPrayersRef = useRef<Set<string>>(new Set());

  const [prayerData, setPrayerData] = useState<PrayerTimesData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDetectingLocation, setIsDetectingLocation] = useState<boolean>(false);
  const [showCityPicker, setShowCityPicker] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showQibla, setShowQibla] = useState<boolean>(false);
  const [citySearchInput, setCitySearchInput] = useState<string>('');
  const [quoteIndex, setQuoteIndex] = useState<number>(0);

  // Live countdown state
  const [nowDate, setNowDate] = useState<Date>(new Date());

  // Auto-dismiss toast after 4 seconds
  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 4500);
    return () => clearTimeout(t);
  }, [toastMessage]);

  // Update quote periodically
  useEffect(() => {
    const quoteInterval = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % ISLAMIC_QUOTES.length);
    }, 15000);
    return () => clearInterval(quoteInterval);
  }, []);

  // Fetch prayer times whenever city, country, or calculation method changes
  const loadPrayerTimes = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getPrayerTimes(selectedCity, selectedCountry, methodId);
      setPrayerData(data);
    } catch (err) {
      console.error('Failed to load prayer times:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCity, selectedCountry, methodId]);

  useEffect(() => {
    loadPrayerTimes();
  }, [loadPrayerTimes]);

  // Live second-by-second countdown clock
  useEffect(() => {
    const timer = setInterval(() => {
      setNowDate(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Compute live next prayer from current timings
  const liveState = prayerData ? computeNextPrayerState(prayerData.timings, nowDate) : null;
  const nextPrayer = liveState?.nextPrayer || prayerData?.nextPrayer || null;
  const currentPrayer = liveState?.currentPrayer || prayerData?.currentPrayer || null;
  const timeRemainingSeconds = liveState?.timeRemainingSeconds ?? 0;

  // Format countdown string
  const formatCountdown = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  // Play peaceful Adhan / chime preview
  const playAdhanPreview = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(432, audioCtx.currentTime); // 432 Hz healing tone
      osc.frequency.exponentialRampToValueAtTime(576, audioCtx.currentTime + 0.8);
      osc.frequency.exponentialRampToValueAtTime(432, audioCtx.currentTime + 1.8);

      gain.gain.setValueAtTime(0.01, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.18, audioCtx.currentTime + 0.4);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 2.2);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 2.3);
    } catch {
      // Ignore audio sandbox errors
    }
  };

  // Play gentle harmonic chime for 10-minute notification
  const playNotificationChime = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any as any).webkitAudioContext)();
      const now = audioCtx.currentTime;

      // Note 1: 528 Hz
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(528, now);
      gain1.gain.setValueAtTime(0.01, now);
      gain1.gain.linearRampToValueAtTime(0.2, now + 0.1);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 1.2);

      // Note 2: 660 Hz (harmonic fifth)
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(660, now + 0.35);
      gain2.gain.setValueAtTime(0.01, now + 0.35);
      gain2.gain.linearRampToValueAtTime(0.25, now + 0.45);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.start(now + 0.35);
      osc2.stop(now + 1.8);
    } catch {
      // Audio fallback
    }
  };

  // Trigger browser notification helper
  const sendPrayerNotification = (title: string, body: string, tag: string) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      try {
        const n = new Notification(title, {
          body,
          icon: '/icon.png',
          badge: '/icon.png',
          tag: `prayer-10min-${tag}`,
        });
        setTimeout(() => {
          try {
            n.close();
          } catch {}
        }, 12000);
      } catch (err) {
        console.warn('Native notification trigger fallback:', err);
      }
    }
  };

  // Toggle real-time notifications with browser permission prompt
  const toggleNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setToastMessage('Browser notifications are not supported on this browser/device.');
      return;
    }

    if (!notificationsEnabled) {
      let perm = Notification.permission;
      if (perm === 'default') {
        try {
          perm = await Notification.requestPermission();
        } catch (err) {
          console.warn('Notification permission error:', err);
        }
      }

      setNotificationPermission(perm);

      if (perm === 'granted') {
        setNotificationsEnabled(true);
        localStorage.setItem('daheej_prayer_notifications', 'true');
        setToastMessage('🔔 10-Minute Prayer Notifications enabled! You will be alerted before each Salah.');

        // Initial confirmation notification
        sendPrayerNotification(
          '🕌 Salah Reminders Active',
          `You will now receive a browser notification 10 minutes before every prayer in ${selectedCity}.`,
          'confirmation'
        );
        playNotificationChime();
      } else if (perm === 'denied') {
        setToastMessage('⚠️ Notifications are blocked in your browser settings. Please allow notifications for this site.');
      }
    } else {
      setNotificationsEnabled(false);
      localStorage.setItem('daheej_prayer_notifications', 'false');
      setToastMessage('🔕 10-Minute Prayer notifications paused.');
    }
  };

  // Test Notification Trigger
  const sendTestNotification = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setToastMessage('Browser notifications not supported.');
      return;
    }

    let perm = Notification.permission;
    if (perm !== 'granted') {
      try {
        perm = await Notification.requestPermission();
        setNotificationPermission(perm);
      } catch (err) {
        console.warn('Permission error:', err);
      }
    }

    if (perm === 'granted') {
      sendPrayerNotification(
        '🕌 [Test Alert] Fajr Prayer in 10 Minutes',
        `Time for Fajr (الفجر) in ${selectedCity} is approaching. Prepare for Wudu and Salah.`,
        'test-alert'
      );
      playNotificationChime();
      setToastMessage('✅ Test notification sent! Check your system notification tray.');
    } else {
      setToastMessage('⚠️ Notification permission is required to send alerts.');
    }
  };

  // Real-time 10-minute check engine
  useEffect(() => {
    if (!prayerData) return;

    const prayers = liveState?.prayers || [];

    for (const prayer of prayers) {
      if (prayer.passed) continue;

      const diffSeconds = Math.floor((prayer.dateObj.getTime() - nowDate.getTime()) / 1000);

      // Check if within the 10-minute window (diffSeconds <= 600s and > 0s)
      const todayDateKey = prayer.dateObj.toISOString().slice(0, 10);
      const notifKey = `${todayDateKey}_${prayer.name}_10min`;

      const alreadyTriggered =
        notifiedPrayersRef.current.has(notifKey) ||
        (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(notifKey) === 'true');

      if (diffSeconds <= 600 && diffSeconds > 0) {
        if (!alreadyTriggered && notificationsEnabled) {
          notifiedPrayersRef.current.add(notifKey);
          try {
            sessionStorage.setItem(notifKey, 'true');
          } catch {}

          // Send native notification
          sendPrayerNotification(
            `🕌 ${prayer.name} Prayer in 10 Minutes`,
            `Salah for ${prayer.name} (${prayer.arabicName}) in ${selectedCity} starts at ${formatPrayerTime(
              prayer.time,
              use24Hour
            )}. Make Wudu & prepare for prayer.`,
            prayer.name
          );

          // Set in-app alert card
          setInAppAlert({
            prayerName: prayer.name,
            arabicName: prayer.arabicName,
            time: formatPrayerTime(prayer.time, use24Hour),
            minutesRemaining: Math.max(1, Math.ceil(diffSeconds / 60)),
          });

          // Audio chime
          playNotificationChime();
        }
      }
    }
  }, [nowDate, notificationsEnabled, prayerData, liveState, selectedCity, use24Hour]);

  // Detect location via GPS
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setIsDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        try {
          // Reverse geocoding lookup or coordinate-based calculation
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=en`
          );
          if (res.ok) {
            const loc = await res.json();
            const address = loc.address || {};
            const cityName = address.city || address.town || address.village || 'Location Unknown';
            const countryName = address.country || 'Location Unknown';
            setSelectedCity(cityName);
            setSelectedCountry(countryName);
            localStorage.setItem('daheej_prayer_city', cityName);
            localStorage.setItem('daheej_prayer_country', countryName);
            if (onCityChange) onCityChange(cityName, countryName);
          }
          const data = await getPrayerTimes(selectedCity, selectedCountry, methodId, lat, lng);
          setPrayerData(data);
        } catch {
          // Fallback to calculation with coords
          const data = await getPrayerTimes('Current Location', 'GPS', methodId, lat, lng);
          setPrayerData(data);
        } finally {
          setIsDetectingLocation(false);
          setShowCityPicker(false);
        }
      },
      (err) => {
        console.warn('Geolocation error:', err);
        setIsDetectingLocation(false);
        alert('Could not retrieve your location. Please select a city manually from the list.');
      },
      { timeout: 8000 }
    );
  };

  // City selection handler
  const handleSelectCity = (city: string, country: string, method?: number) => {
    setSelectedCity(city);
    setSelectedCountry(country);
    if (method) {
      setMethodId(method);
      localStorage.setItem('daheej_prayer_method', String(method));
    }
    localStorage.setItem('daheej_prayer_city', city);
    localStorage.setItem('daheej_prayer_country', country);
    if (onCityChange) onCityChange(city, country);
    setShowCityPicker(false);
  };

  const filteredCities = POPULAR_CITIES.filter(
    (c) =>
      c.city.toLowerCase().includes(citySearchInput.toLowerCase()) ||
      c.country.toLowerCase().includes(citySearchInput.toLowerCase())
  );

  const prayerIcons: Record<string, React.ReactNode> = {
    Fajr: <Sunrise className="w-4 h-4 text-amber-500" />,
    Sunrise: <Sun className="w-4 h-4 text-amber-400" />,
    Dhuhr: <Sun className="w-4 h-4 text-yellow-500" />,
    Asr: <Sunset className="w-4 h-4 text-orange-500" />,
    Maghrib: <Sunset className="w-4 h-4 text-rose-500" />,
    Isha: <Moon className="w-4 h-4 text-indigo-400" />,
  };

  // Compact Header Bar View
  if (compact) {
    if (isLoading && !prayerData) {
      return (
        <div
          className={`bg-white/80 dark:bg-zinc-900/90 backdrop-blur-md border border-emerald-500/20 dark:border-emerald-500/30 rounded-2xl p-3 sm:px-4 shadow-sm flex items-center justify-between gap-3 text-xs animate-fadeIn ${className}`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-zinc-200 dark:bg-zinc-800 animate-pulse shrink-0" />
            <div className="space-y-1.5 min-w-0">
              <div className="h-3 w-28 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
              <div className="h-2.5 w-20 bg-zinc-100 dark:bg-zinc-800/60 rounded animate-pulse" />
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="w-6 h-6 rounded-lg bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
            <div className="w-6 h-6 rounded-lg bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
          </div>
        </div>
      );
    }

    return (
      <div
        className={`bg-white/80 dark:bg-zinc-900/90 backdrop-blur-md border border-emerald-500/20 dark:border-emerald-500/30 rounded-2xl p-3 sm:px-4 shadow-sm flex items-center justify-between gap-3 text-xs animate-fadeIn transition-all duration-300 ${className}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div className="min-w-0 truncate">
            <div className="flex items-center gap-1.5 font-medium text-zinc-900 dark:text-white truncate">
              <span>{selectedCity}</span>
              <span className="text-zinc-400 dark:text-zinc-500 text-[10px]">•</span>
              <span className="text-emerald-700 dark:text-emerald-400 font-bold truncate">
                Next: {nextPrayer?.name || 'Fajr'}
              </span>
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono flex items-center gap-1">
              <span>{nextPrayer?.timeFormatted || '--:--'}</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                ({formatCountdown(timeRemainingSeconds)})
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Notification Toggle Quick Button */}
          <button
            id="btn-compact-prayer-notifications"
            onClick={toggleNotifications}
            className={`p-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
              notificationsEnabled
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                : 'text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200'
            }`}
            title={
              notificationsEnabled
                ? '10-Minute Prayer Notifications Active (Click to Pause)'
                : 'Enable 10-Minute Prayer Notifications'
            }
          >
            {notificationsEnabled ? (
              <BellRing className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 animate-pulse" />
            ) : (
              <BellOff className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            onClick={() => setShowCityPicker(true)}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Change City"
          >
            <MapPin className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // Initial Full Loading Skeleton with Fade-In & Shimmer
  if (isLoading && !prayerData) {
    return (
      <div
        className={`bg-white dark:bg-zinc-900 border border-emerald-500/20 dark:border-emerald-500/30 rounded-3xl p-5 sm:p-7 shadow-sm dark:shadow-2xl relative overflow-hidden animate-fadeIn ${className}`}
      >
        {/* Shimmer Ambient Background */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-emerald-500/5 via-teal-500/5 to-transparent rounded-full pointer-events-none blur-3xl" />
        
        {/* Header Skeleton */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-zinc-200 dark:bg-zinc-800 animate-pulse shrink-0" />
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                <div className="h-4 w-20 bg-emerald-100 dark:bg-emerald-950/60 rounded-full animate-pulse" />
              </div>
              <div className="h-3 w-40 bg-zinc-100 dark:bg-zinc-800/70 rounded animate-pulse" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-7 w-20 bg-zinc-200 dark:bg-zinc-800 rounded-xl animate-pulse" />
            <div className="h-7 w-16 bg-zinc-200 dark:bg-zinc-800 rounded-xl animate-pulse" />
            <div className="h-7 w-7 bg-zinc-200 dark:bg-zinc-800 rounded-xl animate-pulse" />
          </div>
        </div>

        {/* Hero Banner Skeleton */}
        <div className="mt-5 p-5 rounded-2xl bg-zinc-100 dark:bg-zinc-800/70 animate-pulse space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-2.5">
              <div className="h-4 w-36 bg-zinc-200 dark:bg-zinc-700/60 rounded-full" />
              <div className="h-8 w-44 bg-zinc-300 dark:bg-zinc-700 rounded-lg" />
              <div className="h-3 w-48 bg-zinc-200 dark:bg-zinc-700/60 rounded" />
            </div>
            <div className="h-20 w-36 bg-zinc-200/80 dark:bg-zinc-700/80 rounded-2xl" />
          </div>
          <div className="pt-3 border-t border-zinc-200 dark:border-zinc-700/50 flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
            <div className="h-3 w-3/4 bg-zinc-200 dark:bg-zinc-700/50 rounded" />
          </div>
        </div>

        {/* 6 Prayer Cards Grid Skeleton */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl p-3 sm:p-3.5 border border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-950/40 flex flex-col items-center justify-between min-h-[110px] animate-pulse space-y-2"
            >
              <div className="w-full flex items-center justify-between">
                <div className="w-6 h-6 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
              </div>
              <div className="space-y-1 w-full flex flex-col items-center">
                <div className="h-3 w-12 bg-zinc-200 dark:bg-zinc-800 rounded" />
                <div className="h-2.5 w-8 bg-zinc-100 dark:bg-zinc-800/60 rounded" />
              </div>
              <div className="w-full pt-1 border-t border-zinc-100 dark:border-zinc-800/60">
                <div className="h-3 w-14 bg-zinc-200 dark:bg-zinc-800 rounded mx-auto" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      key={`${selectedCity}-${selectedCountry}-${methodId}`}
      className={`bg-white dark:bg-zinc-900 border border-emerald-500/20 dark:border-emerald-500/30 rounded-3xl p-5 sm:p-7 shadow-sm dark:shadow-2xl transition-all duration-300 relative overflow-hidden animate-fadeIn ${className}`}
    >
      {/* Subtle Top Loading Bar during Background Refresh */}
      {isLoading && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 animate-shimmer z-30" />
      )}
      {/* Subtle Islamic Geometric Ambient Pattern */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-emerald-500/5 via-teal-500/5 to-transparent rounded-full pointer-events-none blur-3xl -z-0" />
      <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-gradient-to-tr from-amber-500/5 to-transparent rounded-full pointer-events-none blur-2xl -z-0" />

      {/* Toast Feedback Banner */}
      {toastMessage && (
        <div className="relative z-20 mb-4 p-3 rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-medium flex items-center justify-between gap-2 shadow-xl border border-zinc-700/40 dark:border-zinc-300/40 animate-fadeIn">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="p-1 rounded-lg hover:bg-white/20 dark:hover:bg-black/10 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 10-Minute Pre-Prayer Live Alert Card */}
      {inAppAlert && (
        <div className="relative z-20 mb-4 p-4 rounded-2xl bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 text-white shadow-lg shadow-emerald-900/30 flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <BellRing className="w-5 h-5 text-amber-300 animate-bounce" />
            </div>
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-300 block">
                🕌 10-Minute Prayer Alert
              </span>
              <p className="text-xs text-white/95 mt-0.5">
                <strong>{inAppAlert.prayerName}</strong> ({inAppAlert.arabicName}) prayer begins in ~
                {inAppAlert.minutesRemaining} mins at <strong>{inAppAlert.time}</strong>. Time to prepare for Wudu &
                Salah.
              </p>
            </div>
          </div>
          <button
            onClick={() => setInAppAlert(null)}
            className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white transition-colors shrink-0"
            title="Dismiss Alert"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Bar: City, Hijri Date, and Controls */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                Islamic Prayer Times
              </h3>
              <button
                onClick={() => setShowCityPicker(true)}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors cursor-pointer"
              >
                <MapPin className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span>{selectedCity}</span>
                <ChevronDown className="w-3 h-3 text-emerald-500" />
              </button>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 mt-0.5">
              <Calendar className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              <span>{prayerData?.hijri.formatted || 'Loading Hijri Date...'}</span>
              <span className="text-zinc-300 dark:text-zinc-700">•</span>
              <span className="font-arabic text-[11px] text-zinc-600 dark:text-zinc-300">
                {prayerData?.hijri.monthAr}
              </span>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          {/* 10-Minute Real-Time Notification Toggle Button */}
          <button
            id="btn-prayer-notification-toggle"
            onClick={toggleNotifications}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer ${
              notificationsEnabled
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 shadow-sm ring-1 ring-emerald-500/20'
                : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:text-zinc-900 dark:hover:text-white'
            }`}
            title={
              notificationsEnabled
                ? '10-Minute Prayer Notifications Active (Click to Pause)'
                : 'Enable 10-Minute Prayer Notifications'
            }
          >
            {notificationsEnabled ? (
              <BellRing className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 animate-pulse" />
            ) : (
              <BellOff className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">
              {notificationsEnabled ? '10m Alerts ON' : '10m Alerts'}
            </span>
            {notificationsEnabled && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            )}
          </button>

          {/* Qibla Direction Button */}
          <button
            onClick={() => setShowQibla(!showQibla)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer ${
              showQibla
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:text-zinc-900 dark:hover:text-white'
            }`}
            title="Qibla Direction"
          >
            <Compass className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Qibla</span>
            <span>{prayerData?.qiblaDirection || 260}°</span>
          </button>

          {/* Adhan Sound Chime Preview Button */}
          <button
            onClick={() => {
              const newSound = !soundEnabled;
              setSoundEnabled(newSound);
              localStorage.setItem('daheej_prayer_sound', String(newSound));
              if (newSound) playAdhanPreview();
            }}
            className={`p-2 rounded-xl border text-xs transition-colors cursor-pointer ${
              soundEnabled
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200'
            }`}
            title={soundEnabled ? 'Mute Adhan Tone' : 'Enable Adhan Tone Chime'}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>

          {/* Settings Drawer Button */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-xl border text-xs transition-colors cursor-pointer ${
              showSettings
                ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white border-zinc-300 dark:border-zinc-700'
                : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200'
            }`}
            title="Calculation & Alert Settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>

          {/* Refresh Timings Button */}
          <button
            onClick={loadPrayerTimes}
            disabled={isLoading}
            className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50 cursor-pointer"
            title="Refresh Timings"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* Settings Drawer (Notifications, Calculations & 24h toggle) */}
      {showSettings && (
        <div className="relative z-10 my-4 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800 space-y-3.5 animate-fadeIn">
          {/* Notification Feature Card in Settings */}
          <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    notificationsEnabled
                      ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
                  }`}
                >
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-zinc-900 dark:text-white block">
                    10-Minute Salah Alert
                  </span>
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Triggers a browser notification 10 minutes before each prayer time
                  </span>
                </div>
              </div>

              {/* Native-styled Toggle Switch */}
              <button
                type="button"
                onClick={toggleNotifications}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  notificationsEnabled ? 'bg-emerald-600' : 'bg-zinc-300 dark:bg-zinc-700'
                }`}
                role="switch"
                aria-checked={notificationsEnabled}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    notificationsEnabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800/80 text-[11px]">
              <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    notificationsEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'
                  }`}
                />
                <span>
                  Status:{' '}
                  <strong
                    className={
                      notificationsEnabled
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-zinc-600 dark:text-zinc-400'
                    }
                  >
                    {notificationsEnabled ? 'Active (Alerts armed for all 5 prayers)' : 'Disabled'}
                  </strong>
                </span>
              </span>

              <button
                type="button"
                onClick={sendTestNotification}
                className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 hover:text-emerald-700 dark:hover:text-emerald-300 text-zinc-700 dark:text-zinc-300 font-semibold transition-colors flex items-center gap-1 text-[11px] cursor-pointer"
              >
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>Send Test Alert</span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Calculation Method</span>
            <button
              onClick={() => {
                const next = !use24Hour;
                setUse24Hour(next);
                localStorage.setItem('daheej_prayer_24h', String(next));
              }}
              className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
            >
              Toggle {use24Hour ? '12-Hour (AM/PM)' : '24-Hour'}
            </button>
          </div>
          <select
            value={methodId}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              setMethodId(val);
              localStorage.setItem('daheej_prayer_method', String(val));
            }}
            className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-emerald-500"
          >
            {CALCULATION_METHODS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} — {m.description}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Interactive Qibla Compass Panel */}
      {showQibla && (
        <div className="relative z-10 my-4 animate-fadeIn">
          <QiblaCompass
            initialCity={selectedCity}
            initialCountry={selectedCountry}
            initialLatitude={prayerData?.latitude}
            initialLongitude={prayerData?.longitude}
            onCityChange={(city, country, lat, lng) => {
              setSelectedCity(city);
              setSelectedCountry(country);
              localStorage.setItem('daheej_prayer_city', city);
              localStorage.setItem('daheej_prayer_country', country);
              if (onCityChange) onCityChange(city, country);
            }}
          />
        </div>
      )}

      {/* Primary Hero: Next Prayer Live Countdown Banner */}
      <div className="relative z-10 mt-5 p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white shadow-lg shadow-emerald-900/20 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/30 text-emerald-100 text-xs font-semibold">
                <Sparkles className="w-3 h-3 text-amber-300" />
                <span>Next Upcoming Prayer</span>
              </div>

              {notificationsEnabled && (
                <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-400/20 text-emerald-100 text-[11px] font-medium border border-emerald-400/30">
                  <BellRing className="w-3 h-3 text-emerald-300 animate-pulse" />
                  <span>10m alert armed</span>
                </div>
              )}
            </div>

            <div className="flex items-baseline gap-2.5">
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {nextPrayer?.name || 'Fajr'}
              </h2>
              <span className="font-arabic text-xl sm:text-2xl text-emerald-200 font-semibold">
                {nextPrayer?.arabicName || 'الفجر'}
              </span>
            </div>
            <p className="text-xs text-emerald-100/90 mt-1">
              Adhan at <span className="font-bold text-white">{formatPrayerTime(nextPrayer?.time || '', use24Hour)}</span>{' '}
              in {selectedCity}
            </p>
          </div>

          {/* Countdown Clock */}
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-3.5 sm:px-5 text-center shrink-0">
            <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-200 block mb-0.5">
              Time Remaining
            </span>
            <div className="font-mono text-2xl sm:text-3xl font-black tracking-widest text-white drop-shadow-sm">
              {formatCountdown(timeRemainingSeconds)}
            </div>
            <div className="flex items-center justify-center gap-1 text-[10px] text-emerald-200 mt-1">
              <Clock className="w-3 h-3" />
              <span>Until {nextPrayer?.name}</span>
            </div>
          </div>
        </div>

        {/* Dynamic Prayer Quote / Hadith */}
        <div className="mt-4 pt-3 border-t border-white/15 text-xs text-emerald-100/90 flex items-start gap-2">
          <BookOpen className="w-3.5 h-3.5 text-amber-300 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <span className="italic">"{ISLAMIC_QUOTES[quoteIndex].translation}"</span>
            <span className="text-[10px] text-emerald-300 font-medium ml-1.5">
              — {ISLAMIC_QUOTES[quoteIndex].source}
            </span>
          </div>
        </div>
      </div>

      {/* 5 Daily Prayers & Sunrise Grid */}
      <div className="relative z-10 mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
        {liveState?.prayers.map((prayer) => {
          const isNext = prayer.name === nextPrayer?.name;
          const isPassed = prayer.passed;

          return (
            <div
              key={prayer.name}
              className={`rounded-2xl p-3 sm:p-3.5 transition-all duration-200 border text-center flex flex-col items-center justify-between min-h-[110px] ${
                isNext
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-400 dark:border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
                  : isPassed
                  ? 'bg-zinc-50/70 dark:bg-zinc-950/40 border-zinc-200/60 dark:border-zinc-800/60 opacity-85'
                  : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
              }`}
            >
              <div className="w-full flex items-center justify-between text-[11px]">
                <span
                  className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                    isNext
                      ? 'bg-emerald-500 text-white'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  {prayerIcons[prayer.name] || <Clock className="w-3.5 h-3.5" />}
                </span>
                {isNext ? (
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-600 text-white">
                    Next
                  </span>
                ) : isPassed ? (
                  <span className="text-[10px] text-zinc-400 flex items-center gap-0.5">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  </span>
                ) : null}
              </div>

              <div className="my-1">
                <span className="text-xs font-bold text-zinc-900 dark:text-white block">
                  {prayer.name}
                </span>
                <span className="font-arabic text-[11px] text-zinc-400 dark:text-zinc-500">
                  {prayer.arabicName}
                </span>
              </div>

              <div className="w-full pt-1 border-t border-zinc-100 dark:border-zinc-800/80">
                <span
                  className={`text-xs font-bold font-mono ${
                    isNext
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : isPassed
                      ? 'text-zinc-400 dark:text-zinc-500'
                      : 'text-zinc-800 dark:text-zinc-200'
                  }`}
                >
                  {formatPrayerTime(prayer.time, use24Hour)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* City Switcher Modal / Dropdown */}
      {showCityPicker && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-600" />
                <h4 className="text-sm font-bold text-zinc-900 dark:text-white">
                  Select City for Prayer Times
                </h4>
              </div>
              <button
                onClick={() => setShowCityPicker(false)}
                className="text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-white px-2 py-1 rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>

            {/* GPS Auto-Detect Button */}
            <button
              onClick={handleDetectLocation}
              disabled={isDetectingLocation}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 font-semibold text-xs flex items-center justify-center gap-2 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors cursor-pointer"
            >
              <Navigation className={`w-3.5 h-3.5 text-emerald-600 ${isDetectingLocation ? 'animate-spin' : ''}`} />
              <span>{isDetectingLocation ? 'Locating Your City...' : 'Use My Current GPS Location'}</span>
            </button>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={citySearchInput}
                onChange={(e) => setCitySearchInput(e.target.value)}
                placeholder="Search all global cities (e.g. Srinagar, Hyderabad, London)..."
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Popular Cities Grid & Dynamic Custom Selection */}
            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
              {citySearchInput.trim() && !filteredCities.some(c => c.city.toLowerCase() === citySearchInput.trim().toLowerCase()) && (
                <button
                  type="button"
                  onClick={() => handleSelectCity(citySearchInput.trim(), 'Global', 1)}
                  className="w-full text-left p-2.5 rounded-xl text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-dashed border-emerald-300 dark:border-emerald-700 flex items-center justify-between hover:bg-emerald-100 transition-colors cursor-pointer"
                >
                  <span className="font-semibold">
                    Set Custom City: &ldquo;{citySearchInput.trim()}&rdquo;
                  </span>
                  <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded-md font-bold">
                    Calculate Live
                  </span>
                </button>
              )}

              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block px-1">
                {citySearchInput ? `Matching Cities (${filteredCities.length})` : 'Global & Regional Cities'}
              </span>
              
              {filteredCities.length === 0 && (
                <div className="p-4 text-center text-xs text-zinc-500">
                  No predefined city found for &ldquo;{citySearchInput}&rdquo;. Click the custom button above to calculate live prayer times for this location.
                </div>
              )}

              {filteredCities.map((item) => {
                const isSelected = selectedCity.toLowerCase() === item.city.toLowerCase();
                return (
                  <button
                    key={`${item.city}-${item.country}`}
                    onClick={() => handleSelectCity(item.city, item.country, item.methodId)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600 text-white font-bold'
                        : 'bg-zinc-50 dark:bg-zinc-950/60 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <span>
                      {item.city}, <span className="opacity-75">{item.country}</span>
                    </span>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

