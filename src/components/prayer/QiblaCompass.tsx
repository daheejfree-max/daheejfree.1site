import React, { useState, useEffect, useRef } from 'react';
import {
  Compass,
  MapPin,
  Navigation,
  Sparkles,
  Volume2,
  VolumeX,
  RotateCcw,
  Info,
  CheckCircle2,
  ArrowUp,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  HelpCircle,
  Sliders,
  Globe,
  Radio,
  Search,
  Crosshair,
} from 'lucide-react';
import {
  calculateQiblaDirection,
  calculateDistanceToKaaba,
  getCompassDirectionName,
  calculateRelativeQibla,
  POPULAR_CITIES,
  MAKKAH_COORDINATES,
} from '../../lib/prayerTimes';

interface QiblaCompassProps {
  initialLatitude?: number;
  initialLongitude?: number;
  initialCity?: string;
  initialCountry?: string;
  onCityChange?: (city: string, country: string, lat: number, lng: number) => void;
  className?: string;
  isCompact?: boolean;
}

export const QiblaCompass: React.FC<QiblaCompassProps> = ({
  initialLatitude,
  initialLongitude,
  initialCity = 'Karachi',
  initialCountry = '',
  onCityChange,
  className = '',
  isCompact = false,
}) => {
  // Coordinates & Location state
  const [latitude, setLatitude] = useState<number>(() => {
    if (initialLatitude !== undefined) return initialLatitude;
    const found = POPULAR_CITIES.find(
      (c) => c.city.toLowerCase() === initialCity.toLowerCase()
    );
    return found ? found.latitude : 24.8607;
  });

  const [longitude, setLongitude] = useState<number>(() => {
    if (initialLongitude !== undefined) return initialLongitude;
    const found = POPULAR_CITIES.find(
      (c) => c.city.toLowerCase() === initialCity.toLowerCase()
    );
    return found ? found.longitude : 67.0011;
  });

  const [cityName, setCityName] = useState<string>(initialCity);
  const [countryName, setCountryName] = useState<string>(initialCountry);
  const [locationSource, setLocationSource] = useState<'gps' | 'city' | 'custom'>('city');
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Compass Heading & Sensors
  const [deviceHeading, setDeviceHeading] = useState<number>(0);
  const [hasCompassSensor, setHasCompassSensor] = useState<boolean | null>(null);
  const [needsIosPermission, setNeedsIosPermission] = useState<boolean>(false);
  const [manualRotation, setManualRotation] = useState<number>(0);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  // Sound & Haptics
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('daheej_qibla_sound') !== 'false';
    }
    return true;
  });

  // UI state
  const [showCityPicker, setShowCityPicker] = useState<boolean>(false);
  const [citySearchInput, setCitySearchInput] = useState<string>('');
  const [showCalibrationHelp, setShowCalibrationHelp] = useState<boolean>(false);
  const [hasPlayedAlignmentChime, setHasPlayedAlignmentChime] = useState<boolean>(false);

  // Active compass heading (either sensor or manual simulation)
  const effectiveHeading = isSimulating ? manualRotation : deviceHeading;

  // Qibla Calculations
  const qiblaBearing = calculateQiblaDirection(latitude, longitude);
  const distance = calculateDistanceToKaaba(latitude, longitude);
  const directionName = getCompassDirectionName(qiblaBearing);
  const relativeCalc = calculateRelativeQibla(qiblaBearing, effectiveHeading);

  // Play harmonic alignment tone
  const playAlignmentChime = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any as any).webkitAudioContext)();
      const now = audioCtx.currentTime;

      // Note 1: 587.33 Hz (D5)
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0.01, now);
      gain1.gain.linearRampToValueAtTime(0.15, now + 0.08);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.8);

      // Note 2: 880 Hz (A5 - harmonious fifth)
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.15);
      gain2.gain.setValueAtTime(0.01, now + 0.15);
      gain2.gain.linearRampToValueAtTime(0.2, now + 0.22);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.start(now + 0.15);
      osc2.stop(now + 1.2);
    } catch {
      // Audio fallback
    }
  };

  // Trigger haptic feedback and sound on alignment
  useEffect(() => {
    if (relativeCalc.isAligned) {
      if (!hasPlayedAlignmentChime) {
        setHasPlayedAlignmentChime(true);
        playAlignmentChime();

        // Vibration
        if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
          try {
            navigator.vibrate([40, 50, 40]);
          } catch {}
        }
      }
    } else {
      if (hasPlayedAlignmentChime) {
        setHasPlayedAlignmentChime(false);
      }
    }
  }, [relativeCalc.isAligned, hasPlayedAlignmentChime, soundEnabled]);

  // Request high-precision GPS Geolocation
  const requestCurrentLocation = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLatitude(lat);
        setLongitude(lng);
        setGpsAccuracy(Math.round(pos.coords.accuracy));
        setLocationSource('gps');
        setIsLocating(false);

        // Reverse geocoding lookup
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=en`
          );
          if (res.ok) {
            const loc = await res.json();
            const address = loc.address || {};
            const city = address.city || address.town || address.village || 'Location Unknown';
            const country = address.country || 'Location Unknown';
            setCityName(city);
            setCountryName(country);
            if (onCityChange) onCityChange(city, country, lat, lng);
          } else {
            setCityName('Location Unknown');
            setCountryName('');
          }
        } catch {
          setCityName('Location Unknown');
          setCountryName('');
        }
      },
      (err) => {
        setIsLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          setLocationError('Location permission denied. Please allow location access or select your city manually.');
        } else {
          setLocationError('Unable to retrieve your precise location. Using selected city.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  // Device orientation & sensor listening
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check for iOS 13+ permission requirement
    if (
      typeof (DeviceOrientationEvent as any as any) !== 'undefined' &&
      typeof (DeviceOrientationEvent as any as any).requestPermission === 'function'
    ) {
      setNeedsIosPermission(true);
    }

    const handleOrientation = (e: DeviceOrientationEvent) => {
      // 1. iOS webkitCompassHeading (True Heading)
      if ((e as any as any).webkitCompassHeading !== undefined) {
        const heading = (e as any as any).webkitCompassHeading;
        setDeviceHeading(heading);
        setHasCompassSensor(true);
        setIsSimulating(false);
      }
      // 2. Android absolute alpha orientation
      else if (e.alpha !== null && e.alpha !== undefined) {
        // e.alpha is counter-clockwise 0-360, compass heading is (360 - alpha) % 360
        const heading = (360 - e.alpha) % 360;
        setDeviceHeading(heading);
        setHasCompassSensor(true);
        setIsSimulating(false);
      } else {
        if (hasCompassSensor === null) {
          setHasCompassSensor(false);
        }
      }
    };

    // Try absolute event first (Android Chrome)
    window.addEventListener('deviceorientationabsolute' as any as any, handleOrientation, true);
    // Standard event fallback
    window.addEventListener('deviceorientation', handleOrientation, true);

    return () => {
      window.removeEventListener('deviceorientationabsolute' as any as any, handleOrientation, true);
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, []);

  // Request iOS Sensor Permissions
  const requestIosCompass = async () => {
    if (
      typeof (DeviceOrientationEvent as any as any) !== 'undefined' &&
      typeof (DeviceOrientationEvent as any as any).requestPermission === 'function'
    ) {
      try {
        const response = await (DeviceOrientationEvent as any as any).requestPermission();
        if (response === 'granted') {
          setNeedsIosPermission(false);
          setHasCompassSensor(true);
        } else {
          alert('Compass orientation permission was denied.');
        }
      } catch (err) {
        console.warn('iOS orientation permission error:', err);
      }
    }
  };

  // City selection handler
  const handleSelectCity = (item: (typeof POPULAR_CITIES)[0]) => {
    setLatitude(item.latitude);
    setLongitude(item.longitude);
    setCityName(item.city);
    setCountryName(item.country);
    setLocationSource('city');
    setGpsAccuracy(null);
    setShowCityPicker(false);
    if (onCityChange) {
      onCityChange(item.city, item.country, item.latitude, item.longitude);
    }
  };

  // Filter popular cities
  const filteredCities = POPULAR_CITIES.filter(
    (c) =>
      c.city.toLowerCase().includes(citySearchInput.toLowerCase()) ||
      c.country.toLowerCase().includes(citySearchInput.toLowerCase())
  );

  return (
    <div
      id="qibla-compass-widget"
      className={`relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 sm:p-7 shadow-sm overflow-hidden ${className}`}
    >
      {/* Background Subtle Gradient Accents */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-emerald-500/10 via-teal-500/5 to-transparent rounded-full pointer-events-none blur-3xl" />
      <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-gradient-to-tr from-amber-500/5 to-transparent rounded-full pointer-events-none blur-2xl" />

      {/* Header Bar */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
            <Compass className="w-5 h-5 animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white">
                Qibla Direction Finder
              </h3>
              <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300">
                {qiblaBearing}° {directionName}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              <button
                onClick={() => setShowCityPicker(true)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                title="Change city"
              >
                <MapPin className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span>
                  {cityName}, {countryName}
                </span>
              </button>
              {locationSource === 'gps' && gpsAccuracy && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 font-medium">
                  GPS ±{gpsAccuracy}m
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          {/* GPS Locate Button */}
          <button
            id="btn-qibla-gps-locate"
            onClick={requestCurrentLocation}
            disabled={isLocating}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer ${
              locationSource === 'gps'
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 shadow-sm'
                : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:text-zinc-900 dark:hover:text-white'
            }`}
            title="Use precise GPS coordinates"
          >
            <Navigation className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin text-emerald-600' : ''}`} />
            <span className="hidden sm:inline">{isLocating ? 'Locating...' : 'Use GPS'}</span>
          </button>

          {/* Sound Toggle */}
          <button
            id="btn-qibla-sound-toggle"
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              localStorage.setItem('daheej_qibla_sound', String(next));
              if (next) playAlignmentChime();
            }}
            className={`p-2 rounded-xl border text-xs transition-colors cursor-pointer ${
              soundEnabled
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200'
            }`}
            title={soundEnabled ? 'Mute Alignment Chime' : 'Enable Alignment Chime'}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>

          {/* Help & Calibration */}
          <button
            onClick={() => setShowCalibrationHelp(!showCalibrationHelp)}
            className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title="How to use & calibrate"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* iOS Compass Permission Request Banner */}
      {needsIosPermission && (
        <div className="relative z-10 my-3 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Enable device motion & orientation sensors for real-time compass movement.</span>
          </div>
          <button
            onClick={requestIosCompass}
            className="px-3 py-1.5 rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-700 transition-colors shrink-0 cursor-pointer"
          >
            Enable Compass
          </button>
        </div>
      )}

      {/* Error alert */}
      {locationError && (
        <div className="relative z-10 my-3 p-3 rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{locationError}</span>
        </div>
      )}

      {/* Calibration Help Banner */}
      {showCalibrationHelp && (
        <div className="relative z-10 my-3 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800 text-xs space-y-2 animate-fadeIn">
          <div className="flex items-center justify-between font-bold text-zinc-900 dark:text-white">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              How Qibla Compass Works
            </span>
            <button
              onClick={() => setShowCalibrationHelp(false)}
              className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white"
            >
              Close
            </button>
          </div>
          <ul className="list-disc list-inside text-zinc-600 dark:text-zinc-400 space-y-1">
            <li>
              <strong>Flat Surface:</strong> Hold your phone flat horizontally like a real compass.
            </li>
            <li>
              <strong>Calibrate Sensors:</strong> Move your device in a smooth figure-8 motion if the reading seems offset.
            </li>
            <li>
              <strong>Kaaba Lock:</strong> Turn yourself until the gold Kaaba needle points straight UP (0° offset) and the ring glows green.
            </li>
            <li>
              <strong>Magnetic Interference:</strong> Keep away from laptops, metallic tables, or strong magnets.
            </li>
          </ul>
        </div>
      )}

      {/* Main Interactive Compass Display */}
      <div className="relative z-10 my-6 flex flex-col items-center justify-center">
        {/* Status Alignment Banner */}
        <div className="mb-4 text-center">
          {relativeCalc.isAligned ? (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-600 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 animate-pulse">
              <CheckCircle2 className="w-4 h-4" />
              <span>You are facing the Qibla (Kaaba)</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-semibold text-xs border border-zinc-200 dark:border-zinc-700">
              {relativeCalc.turnDirection === 'right' ? (
                <>
                  <ArrowRight className="w-3.5 h-3.5 text-amber-500 animate-bounce" />
                  <span>Turn {relativeCalc.offsetDegrees}° to your Right</span>
                </>
              ) : (
                <>
                  <ArrowLeft className="w-3.5 h-3.5 text-amber-500 animate-bounce" />
                  <span>Turn {relativeCalc.offsetDegrees}° to your Left</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Dynamic Rotating Compass Dial */}
        <div className="relative w-64 h-64 sm:w-80 sm:h-80 flex items-center justify-center select-none">
          {/* Outer Alignment Glow Ring */}
          <div
            className={`absolute inset-0 rounded-full transition-all duration-500 ${
              relativeCalc.isAligned
                ? 'bg-emerald-500/20 ring-4 ring-emerald-500 shadow-2xl shadow-emerald-500/40 scale-105'
                : 'ring-1 ring-zinc-200 dark:ring-zinc-800'
            }`}
          />

          {/* Compass Rose Ring (Rotates opposite to device heading so True North stays aligned) */}
          <div
            className="absolute inset-2 rounded-full border-2 border-zinc-300 dark:border-zinc-700 bg-gradient-to-b from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-zinc-900 shadow-inner flex items-center justify-center transition-transform duration-150 ease-out"
            style={{
              transform: `rotate(${-effectiveHeading}deg)`,
            }}
          >
            {/* Degree Tick Marks */}
            {Array.from({ length: 24 }).map((_, i) => {
              const deg = i * 15;
              const isMajor = deg % 45 === 0;
              return (
                <div
                  key={deg}
                  className="absolute w-full h-full flex flex-col items-center justify-start pointer-events-none"
                  style={{ transform: `rotate(${deg}deg)` }}
                >
                  <div
                    className={`${
                      isMajor
                        ? 'w-1 h-3 bg-zinc-700 dark:bg-zinc-300'
                        : 'w-0.5 h-1.5 bg-zinc-300 dark:bg-zinc-700'
                    } rounded-full mt-1.5`}
                  />
                </div>
              );
            })}

            {/* Cardinal Directions */}
            <div className="absolute top-4 text-xs font-black text-red-600 tracking-wider">N</div>
            <div className="absolute right-4 text-xs font-bold text-zinc-500 dark:text-zinc-400">E</div>
            <div className="absolute bottom-4 text-xs font-bold text-zinc-500 dark:text-zinc-400">S</div>
            <div className="absolute left-4 text-xs font-bold text-zinc-500 dark:text-zinc-400">W</div>

            {/* Ordinal Directions */}
            <div className="absolute top-9 right-9 text-[10px] font-medium text-zinc-400">NE</div>
            <div className="absolute bottom-9 right-9 text-[10px] font-medium text-zinc-400">SE</div>
            <div className="absolute bottom-9 left-9 text-[10px] font-medium text-zinc-400">SW</div>
            <div className="absolute top-9 left-9 text-[10px] font-medium text-zinc-400">NW</div>

            {/* Kaaba Direction Needle on Dial (Fixed to true bearing on the compass card) */}
            <div
              className="absolute w-full h-full flex flex-col items-center justify-start pointer-events-none"
              style={{
                transform: `rotate(${qiblaBearing}deg)`,
              }}
            >
              {/* Golden Kaaba Beacon */}
              <div className="flex flex-col items-center mt-2 animate-pulse">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-600 via-amber-400 to-yellow-300 text-zinc-900 flex items-center justify-center shadow-lg border-2 border-white dark:border-zinc-900 font-bold text-[10px]">
                  🕌
                </div>
                <div className="w-1.5 h-20 bg-gradient-to-b from-amber-400 to-transparent rounded-full mt-0.5" />
              </div>
            </div>
          </div>

          {/* Device Top Reference Marker (Fixed Top Needle) */}
          <div className="absolute top-0 flex flex-col items-center pointer-events-none z-20">
            <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[10px] border-t-emerald-600 drop-shadow" />
          </div>

          {/* Central Degree & Status Hub */}
          <div className="relative z-10 w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-700 shadow-xl flex flex-col items-center justify-center text-center p-2">
            <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
              {relativeCalc.isAligned ? 'ALIGNED' : 'HEADING'}
            </span>
            <div className="font-mono text-lg sm:text-xl font-black text-zinc-900 dark:text-white">
              {Math.round(effectiveHeading)}°
            </div>
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              Qibla {qiblaBearing}°
            </span>
          </div>
        </div>

        {/* Manual Heading Dial for Desktops & Simulation */}
        <div className="w-full max-w-xs mt-5 space-y-2 text-center">
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 px-1">
            <span className="flex items-center gap-1 font-medium">
              <Sliders className="w-3.5 h-3.5 text-zinc-400" />
              {hasCompassSensor ? 'Rotate phone or adjust manually:' : 'Simulate phone rotation:'}
            </span>
            <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">
              {Math.round(effectiveHeading)}°
            </span>
          </div>

          <input
            type="range"
            min="0"
            max="359"
            value={effectiveHeading}
            onChange={(e) => {
              setIsSimulating(true);
              setManualRotation(Number(e.target.value));
            }}
            className="w-full h-2 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-600"
          />

          <div className="flex items-center justify-between text-[10px] text-zinc-400">
            <button
              onClick={() => {
                setIsSimulating(true);
                setManualRotation(0);
              }}
              className="hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
            >
              North (0°)
            </button>
            <button
              onClick={() => {
                setIsSimulating(true);
                setManualRotation(qiblaBearing);
              }}
              className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
            >
              Snap to Qibla ({qiblaBearing}°)
            </button>
            <button
              onClick={() => {
                setIsSimulating(false);
              }}
              className="hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
            >
              Reset Live Sensor
            </button>
          </div>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
        <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/70 dark:border-zinc-800/70 text-center">
          <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-0.5">
            Qibla Bearing
          </span>
          <span className="font-mono text-base font-extrabold text-emerald-700 dark:text-emerald-400">
            {qiblaBearing}° {directionName}
          </span>
          <span className="text-[10px] text-zinc-400 block mt-0.5">From True North</span>
        </div>

        <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/70 dark:border-zinc-800/70 text-center">
          <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-0.5">
            Distance to Kaaba
          </span>
          <span className="font-mono text-base font-extrabold text-zinc-900 dark:text-white">
            {distance.km.toLocaleString()} km
          </span>
          <span className="text-[10px] text-zinc-400 block mt-0.5">
            ({distance.miles.toLocaleString()} mi)
          </span>
        </div>

        <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/70 dark:border-zinc-800/70 text-center">
          <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-0.5">
            Your Coordinates
          </span>
          <span className="font-mono text-xs font-bold text-zinc-800 dark:text-zinc-200 block truncate">
            {latitude.toFixed(4)}°, {longitude.toFixed(4)}°
          </span>
          <span className="text-[10px] text-zinc-400 block mt-0.5">
            {locationSource === 'gps' ? 'Live GPS Fix' : 'City Geocode'}
          </span>
        </div>

        <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/70 dark:border-zinc-800/70 text-center">
          <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-0.5">
            Kaaba Location
          </span>
          <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400 block">
            {MAKKAH_COORDINATES.latitude}° N, {MAKKAH_COORDINATES.longitude}° E
          </span>
          <span className="text-[10px] text-zinc-400 block mt-0.5">Makkah Al-Mukarramah</span>
        </div>
      </div>

      {/* City Switcher Modal */}
      {showCityPicker && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-600" />
                <h4 className="text-sm font-bold text-zinc-900 dark:text-white">
                  Select City for Qibla Calculation
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
              onClick={() => {
                requestCurrentLocation();
                setShowCityPicker(false);
              }}
              disabled={isLocating}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 font-semibold text-xs flex items-center justify-center gap-2 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors cursor-pointer"
            >
              <Navigation className={`w-3.5 h-3.5 text-emerald-600 ${isLocating ? 'animate-spin' : ''}`} />
              <span>Use Precise GPS Coordinates</span>
            </button>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={citySearchInput}
                onChange={(e) => setCitySearchInput(e.target.value)}
                placeholder="Search global cities (e.g. London, Toronto, Cairo)..."
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Cities List */}
            <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block px-1">
                Popular Cities
              </span>
              {filteredCities.map((item) => {
                const isSelected = cityName.toLowerCase() === item.city.toLowerCase();
                const itemQibla = calculateQiblaDirection(item.latitude, item.longitude);
                return (
                  <button
                    key={`${item.city}-${item.country}`}
                    onClick={() => handleSelectCity(item)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600 text-white font-bold'
                        : 'bg-zinc-50 dark:bg-zinc-950/60 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <span>
                      {item.city}, <span className="opacity-75">{item.country}</span>
                    </span>
                    <span className="text-[11px] opacity-85 font-mono">{itemQibla}°</span>
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
