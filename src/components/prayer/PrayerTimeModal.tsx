// ==============================================================================
// PRAYER TIME MODAL POPUP (src/components/prayer/PrayerTimeModal.tsx)
// Fullscreen or dialog view for detailed prayer times, Qibla Compass, & Alerts
// ==============================================================================

import React, { useState } from 'react';
import { X, Clock, Compass } from 'lucide-react';
import { PrayerTimeWidget } from './PrayerTimeWidget';
import { QiblaCompass } from './QiblaCompass';

interface PrayerTimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCity?: string;
  initialCountry?: string;
  defaultTab?: 'prayers' | 'qibla';
}

export const PrayerTimeModal: React.FC<PrayerTimeModalProps> = ({
  isOpen,
  onClose,
  initialCity,
  initialCountry,
  defaultTab = 'prayers',
}) => {
  const [activeTab, setActiveTab] = useState<'prayers' | 'qibla'>(defaultTab);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-3xl my-6">
        {/* Modal Top Bar Switcher & Close */}
        <div className="flex items-center justify-between gap-2 mb-3 px-1">
          <div className="inline-flex p-1 rounded-2xl bg-zinc-900/90 border border-zinc-700/60 shadow-xl backdrop-blur-sm">
            <button
              onClick={() => setActiveTab('prayers')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'prayers'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Prayer Times & Adhan</span>
            </button>
            <button
              onClick={() => setActiveTab('qibla')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'qibla'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Qibla Compass (Live GPS)</span>
            </button>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-900/90 text-zinc-300 border border-zinc-700/60 flex items-center justify-center shadow-lg hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer"
            aria-label="Close Prayer Times"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Tabs */}
        {activeTab === 'prayers' ? (
          <PrayerTimeWidget
            initialCity={initialCity}
            initialCountry={initialCountry}
            className="shadow-2xl ring-1 ring-emerald-500/20"
          />
        ) : (
          <QiblaCompass
            initialCity={initialCity}
            initialCountry={initialCountry}
            className="shadow-2xl ring-1 ring-emerald-500/20"
          />
        )}
      </div>
    </div>
  );
};

