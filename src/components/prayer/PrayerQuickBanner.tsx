// ==============================================================================
// PRAYER QUICK BANNER (src/components/prayer/PrayerQuickBanner.tsx)
// Sleek, ambient status bar showing the active & next Salah with quick modal expand
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { Clock, MapPin, Sparkles, ChevronRight, Compass, Volume2 } from 'lucide-react';
import {
  getPrayerTimes,
  computeNextPrayerState,
  formatPrayerTime,
  PrayerTimesData,
} from '../../lib/prayerTimes';

interface PrayerQuickBannerProps {
  userCity?: string;
  onOpenFullWidget: () => void;
  className?: string;
}

export const PrayerQuickBanner: React.FC<PrayerQuickBannerProps> = ({
  userCity,
  onOpenFullWidget,
  className = '',
}) => {
  const [city, setCity] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('daheej_prayer_city') || userCity || 'Karachi';
    }
    return userCity || 'Karachi';
  });

  const [prayerData, setPrayerData] = useState<PrayerTimesData | null>(null);
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    let isMounted = true;
    const fetchTimings = async () => {
      try {
        const data = await getPrayerTimes(city, 'Global');
        if (isMounted) setPrayerData(data);
      } catch (err) {
        console.warn('Prayer quick banner fetch note:', err);
      }
    };
    fetchTimings();
    return () => {
      isMounted = false;
    };
  }, [city]);

  // Second-by-second countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const liveState = prayerData ? computeNextPrayerState(prayerData.timings, now) : null;
  const nextPrayer = liveState?.nextPrayer || prayerData?.nextPrayer;
  const timeRemainingSeconds = liveState?.timeRemainingSeconds ?? 0;

  const formatCountdown = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m ${seconds}s`;
  };

  return (
    <div
      onClick={onOpenFullWidget}
      role="button"
      tabIndex={0}
      className={`group cursor-pointer bg-gradient-to-r from-emerald-900/10 via-teal-900/5 to-emerald-950/10 dark:from-emerald-950/30 dark:via-zinc-900 dark:to-teal-950/20 border border-emerald-500/20 dark:border-emerald-500/30 rounded-2xl p-3 sm:px-5 shadow-sm hover:border-emerald-500/50 hover:shadow-md transition-all duration-200 flex flex-wrap items-center justify-between gap-3 animate-fadeIn ${className}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
          <Clock className="w-4 h-4" />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
              <span>Next Prayer:</span>
              <span className="text-emerald-700 dark:text-emerald-400 font-extrabold">
                {nextPrayer?.name || 'Fajr'}
              </span>
              <span className="font-arabic text-xs text-zinc-500 dark:text-zinc-400">
                ({nextPrayer?.arabicName || 'الفجر'})
              </span>
            </span>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
              in {formatCountdown(timeRemainingSeconds)}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3 text-emerald-600" />
              <span>{city}</span>
            </span>
            <span>•</span>
            <span>Adhan at {formatPrayerTime(nextPrayer?.time || '', false)}</span>
            <span className="hidden md:inline-block">•</span>
            <span className="hidden md:inline-block text-emerald-600 dark:text-emerald-400 font-medium">
              {prayerData?.hijri.formatted}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 shrink-0 group-hover:translate-x-0.5 transition-transform">
        <span className="hidden sm:inline">View Prayer Schedule & Qibla</span>
        <ChevronRight className="w-4 h-4" />
      </div>
    </div>
  );
};
