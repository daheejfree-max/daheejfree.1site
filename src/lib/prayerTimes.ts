// ==============================================================================
// ISLAMIC PRAYER TIMES CALCULATION & API ENGINE (src/lib/prayerTimes.ts)
// Astronomical calculations, Aladhan API client, Qibla direction, and Hijri calendar
// ==============================================================================

export interface PrayerTimes {
  Fajr: string;
  Sunrise: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
  Imsak?: string;
  Midnight?: string;
  Firstthird?: string;
  Lastthird?: string;
}

export interface PrayerInfo {
  name: 'Fajr' | 'Sunrise' | 'Dhuhr' | 'Asr' | 'Maghrib' | 'Isha';
  arabicName: string;
  time: string; // "HH:MM"
  timeFormatted: string; // "05:12 AM"
  dateObj: Date;
  isNext: boolean;
  isCurrent: boolean;
  passed: boolean;
  meaning: string;
}

export interface HijriDate {
  day: string;
  monthEn: string;
  monthAr: string;
  year: string;
  formatted: string;
}

export interface PrayerTimesData {
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
  timings: PrayerTimes;
  hijri: HijriDate;
  methodName: string;
  qiblaDirection: number;
  nextPrayer: PrayerInfo | null;
  currentPrayer: PrayerInfo | null;
  timeRemainingSeconds: number;
}

export interface CalculationMethod {
  id: number;
  name: string;
  description: string;
}

export const CALCULATION_METHODS: CalculationMethod[] = [
  { id: 2, name: 'ISNA (North America)', description: 'Islamic Society of North America (15°/15°)' },
  { id: 1, name: 'Karachi (Univ. of Islamic Sciences)', description: 'University of Islamic Sciences, Karachi (18°/18°)' },
  { id: 3, name: 'Muslim World League', description: 'Muslim World League (18°/17°)' },
  { id: 4, name: 'Umm Al-Qura (Makkah)', description: 'Umm Al-Qura University, Makkah' },
  { id: 5, name: 'Egyptian General Authority', description: 'Egyptian General Authority of Survey (19.5°/17.5°)' },
  { id: 12, name: 'Dubai (UAE)', description: 'General Authority of Islamic Affairs & Endowments, UAE' },
];

export interface PredefinedCity {
  city: string;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  timezone: string;
  methodId: number;
}

export const POPULAR_CITIES: PredefinedCity[] = [
  // Holy & Major Islamic Sanctuaries
  { city: 'Makkah', country: 'Saudi Arabia', countryCode: 'SA', latitude: 21.4225, longitude: 39.8262, timezone: 'Asia/Riyadh', methodId: 4 },
  { city: 'Madinah', country: 'Saudi Arabia', countryCode: 'SA', latitude: 24.4672, longitude: 39.6111, timezone: 'Asia/Riyadh', methodId: 4 },
  { city: 'Jerusalem', country: 'Palestine', countryCode: 'PS', latitude: 31.7683, longitude: 35.2137, timezone: 'Asia/Jerusalem', methodId: 3 },
  
  // India (Extensive coverage across North, South, East, West & J&K)
  { city: 'Srinagar', country: 'India', countryCode: 'IN', latitude: 34.0837, longitude: 74.7973, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Jammu', country: 'India', countryCode: 'IN', latitude: 32.7266, longitude: 74.8570, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Delhi', country: 'India', countryCode: 'IN', latitude: 28.6139, longitude: 77.2090, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'New Delhi', country: 'India', countryCode: 'IN', latitude: 28.6139, longitude: 77.2090, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Mumbai', country: 'India', countryCode: 'IN', latitude: 19.0760, longitude: 72.8777, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Hyderabad', country: 'India', countryCode: 'IN', latitude: 17.3850, longitude: 78.4867, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Bengaluru', country: 'India', countryCode: 'IN', latitude: 12.9716, longitude: 77.5946, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Chennai', country: 'India', countryCode: 'IN', latitude: 13.0827, longitude: 80.2707, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Kolkata', country: 'India', countryCode: 'IN', latitude: 22.5726, longitude: 88.3639, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Lucknow', country: 'India', countryCode: 'IN', latitude: 26.8467, longitude: 80.9462, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Patna', country: 'India', countryCode: 'IN', latitude: 25.5941, longitude: 85.1376, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Ahmedabad', country: 'India', countryCode: 'IN', latitude: 23.0225, longitude: 72.5714, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Pune', country: 'India', countryCode: 'IN', latitude: 18.5204, longitude: 73.8567, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Surat', country: 'India', countryCode: 'IN', latitude: 21.1702, longitude: 72.8311, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Jaipur', country: 'India', countryCode: 'IN', latitude: 26.9124, longitude: 75.7873, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Kanpur', country: 'India', countryCode: 'IN', latitude: 26.4499, longitude: 80.3319, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Nagpur', country: 'India', countryCode: 'IN', latitude: 21.1458, longitude: 79.0882, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Indore', country: 'India', countryCode: 'IN', latitude: 22.7196, longitude: 75.8577, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Bhopal', country: 'India', countryCode: 'IN', latitude: 23.2599, longitude: 77.4126, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Agra', country: 'India', countryCode: 'IN', latitude: 27.1767, longitude: 78.0081, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Varanasi', country: 'India', countryCode: 'IN', latitude: 25.3176, longitude: 82.9739, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Aligarh', country: 'India', countryCode: 'IN', latitude: 27.8974, longitude: 78.0880, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Bareilly', country: 'India', countryCode: 'IN', latitude: 28.3670, longitude: 79.4304, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Moradabad', country: 'India', countryCode: 'IN', latitude: 28.8386, longitude: 78.7733, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Meerut', country: 'India', countryCode: 'IN', latitude: 28.9845, longitude: 77.7064, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Saharanpur', country: 'India', countryCode: 'IN', latitude: 29.9671, longitude: 77.5510, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Muzaffarnagar', country: 'India', countryCode: 'IN', latitude: 29.4727, longitude: 77.7085, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Deoband', country: 'India', countryCode: 'IN', latitude: 29.6933, longitude: 77.6766, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Rampur', country: 'India', countryCode: 'IN', latitude: 28.8154, longitude: 79.0257, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Prayagraj (Allahabad)', country: 'India', countryCode: 'IN', latitude: 25.4358, longitude: 81.8463, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Gorakhpur', country: 'India', countryCode: 'IN', latitude: 26.7606, longitude: 83.3732, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Gaya', country: 'India', countryCode: 'IN', latitude: 24.7914, longitude: 85.0002, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Bhagalpur', country: 'India', countryCode: 'IN', latitude: 25.2425, longitude: 86.9842, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Darbhanga', country: 'India', countryCode: 'IN', latitude: 26.1542, longitude: 85.8918, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Ranchi', country: 'India', countryCode: 'IN', latitude: 23.3441, longitude: 85.3096, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Jamshedpur', country: 'India', countryCode: 'IN', latitude: 22.8046, longitude: 86.2029, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Guwahati', country: 'India', countryCode: 'IN', latitude: 26.1445, longitude: 91.7362, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Bhopal', country: 'India', countryCode: 'IN', latitude: 23.2599, longitude: 77.4126, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Jabalpur', country: 'India', countryCode: 'IN', latitude: 23.1815, longitude: 79.9864, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Gwalior', country: 'India', countryCode: 'IN', latitude: 26.2183, longitude: 78.1828, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Aurangabad (Chhatrapati Sambhajinagar)', country: 'India', countryCode: 'IN', latitude: 19.8762, longitude: 75.3433, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Nashik', country: 'India', countryCode: 'IN', latitude: 19.9975, longitude: 73.7898, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Malegaon', country: 'India', countryCode: 'IN', latitude: 20.5579, longitude: 74.5287, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Bhiwandi', country: 'India', countryCode: 'IN', latitude: 19.2967, longitude: 73.0631, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Thane', country: 'India', countryCode: 'IN', latitude: 19.2183, longitude: 72.9781, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Navi Mumbai', country: 'India', countryCode: 'IN', latitude: 19.0330, longitude: 73.0297, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Nanded', country: 'India', countryCode: 'IN', latitude: 19.1383, longitude: 77.3210, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Calicut (Kozhikode)', country: 'India', countryCode: 'IN', latitude: 11.2588, longitude: 75.7804, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Kochi', country: 'India', countryCode: 'IN', latitude: 9.9312, longitude: 76.2673, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Thiruvananthapuram', country: 'India', countryCode: 'IN', latitude: 8.5241, longitude: 76.9366, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Bhatkal', country: 'India', countryCode: 'IN', latitude: 13.9874, longitude: 74.5539, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Mangalore', country: 'India', countryCode: 'IN', latitude: 12.9141, longitude: 74.8560, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Mysuru (Mysore)', country: 'India', countryCode: 'IN', latitude: 12.2958, longitude: 76.6394, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Gulbarga (Kalaburagi)', country: 'India', countryCode: 'IN', latitude: 17.3297, longitude: 76.8343, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Bidar', country: 'India', countryCode: 'IN', latitude: 17.9104, longitude: 77.5199, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Hubballi (Hubli)', country: 'India', countryCode: 'IN', latitude: 15.3647, longitude: 75.1240, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Belgaum (Belagavi)', country: 'India', countryCode: 'IN', latitude: 15.8497, longitude: 74.4977, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Kurnool', country: 'India', countryCode: 'IN', latitude: 15.8281, longitude: 78.0373, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Guntur', country: 'India', countryCode: 'IN', latitude: 16.3067, longitude: 80.4365, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Vijayawada', country: 'India', countryCode: 'IN', latitude: 16.5062, longitude: 80.6480, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Visakhapatnam', country: 'India', countryCode: 'IN', latitude: 17.6868, longitude: 83.2185, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Nizamabad', country: 'India', countryCode: 'IN', latitude: 18.6725, longitude: 78.0941, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Warangal', country: 'India', countryCode: 'IN', latitude: 17.9784, longitude: 79.5941, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Chandigarh', country: 'India', countryCode: 'IN', latitude: 30.7333, longitude: 76.7794, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Ludhiana', country: 'India', countryCode: 'IN', latitude: 30.9010, longitude: 75.8573, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Amritsar', country: 'India', countryCode: 'IN', latitude: 31.6340, longitude: 74.8723, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Noida', country: 'India', countryCode: 'IN', latitude: 28.5355, longitude: 77.3910, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Gurugram (Gurgaon)', country: 'India', countryCode: 'IN', latitude: 28.4595, longitude: 77.0266, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Faridabad', country: 'India', countryCode: 'IN', latitude: 28.4089, longitude: 77.3178, timezone: 'Asia/Kolkata', methodId: 1 },
  { city: 'Ghaziabad', country: 'India', countryCode: 'IN', latitude: 28.6692, longitude: 77.4538, timezone: 'Asia/Kolkata', methodId: 1 },

  // Pakistan
  { city: 'Karachi', country: 'Pakistan', countryCode: 'PK', latitude: 24.8607, longitude: 67.0011, timezone: 'Asia/Karachi', methodId: 1 },
  { city: 'Lahore', country: 'Pakistan', countryCode: 'PK', latitude: 31.5497, longitude: 74.3436, timezone: 'Asia/Karachi', methodId: 1 },
  { city: 'Islamabad', country: 'Pakistan', countryCode: 'PK', latitude: 33.6844, longitude: 73.0479, timezone: 'Asia/Karachi', methodId: 1 },
  { city: 'Rawalpindi', country: 'Pakistan', countryCode: 'PK', latitude: 33.5651, longitude: 73.0169, timezone: 'Asia/Karachi', methodId: 1 },
  { city: 'Faisalabad', country: 'Pakistan', countryCode: 'PK', latitude: 31.4504, longitude: 73.1350, timezone: 'Asia/Karachi', methodId: 1 },
  { city: 'Multan', country: 'Pakistan', countryCode: 'PK', latitude: 30.1575, longitude: 71.5249, timezone: 'Asia/Karachi', methodId: 1 },
  { city: 'Peshawar', country: 'Pakistan', countryCode: 'PK', latitude: 34.0151, longitude: 71.5249, timezone: 'Asia/Karachi', methodId: 1 },
  { city: 'Quetta', country: 'Pakistan', countryCode: 'PK', latitude: 30.1798, longitude: 66.9750, timezone: 'Asia/Karachi', methodId: 1 },
  { city: 'Sialkot', country: 'Pakistan', countryCode: 'PK', latitude: 32.4945, longitude: 74.5229, timezone: 'Asia/Karachi', methodId: 1 },
  { city: 'Gujranwala', country: 'Pakistan', countryCode: 'PK', latitude: 32.1877, longitude: 74.1945, timezone: 'Asia/Karachi', methodId: 1 },
  { city: 'Hyderabad', country: 'Pakistan', countryCode: 'PK', latitude: 25.3960, longitude: 68.3578, timezone: 'Asia/Karachi', methodId: 1 },

  // Bangladesh & Sri Lanka
  { city: 'Dhaka', country: 'Bangladesh', countryCode: 'BD', latitude: 23.8103, longitude: 90.4125, timezone: 'Asia/Dhaka', methodId: 1 },
  { city: 'Chittagong', country: 'Bangladesh', countryCode: 'BD', latitude: 22.3569, longitude: 91.7832, timezone: 'Asia/Dhaka', methodId: 1 },
  { city: 'Sylhet', country: 'Bangladesh', countryCode: 'BD', latitude: 24.8949, longitude: 91.8687, timezone: 'Asia/Dhaka', methodId: 1 },
  { city: 'Colombo', country: 'Sri Lanka', countryCode: 'LK', latitude: 6.9271, longitude: 79.8612, timezone: 'Asia/Colombo', methodId: 1 },
  { city: 'Kandy', country: 'Sri Lanka', countryCode: 'LK', latitude: 7.2906, longitude: 80.6337, timezone: 'Asia/Colombo', methodId: 1 },

  // Middle East & GCC
  { city: 'Dubai', country: 'United Arab Emirates', countryCode: 'AE', latitude: 25.2048, longitude: 55.2708, timezone: 'Asia/Dubai', methodId: 12 },
  { city: 'Abu Dhabi', country: 'United Arab Emirates', countryCode: 'AE', latitude: 24.4539, longitude: 54.3773, timezone: 'Asia/Dubai', methodId: 12 },
  { city: 'Sharjah', country: 'United Arab Emirates', countryCode: 'AE', latitude: 25.3463, longitude: 55.4209, timezone: 'Asia/Dubai', methodId: 12 },
  { city: 'Riyadh', country: 'Saudi Arabia', countryCode: 'SA', latitude: 24.7136, longitude: 46.6753, timezone: 'Asia/Riyadh', methodId: 4 },
  { city: 'Jeddah', country: 'Saudi Arabia', countryCode: 'SA', latitude: 21.4858, longitude: 39.1925, timezone: 'Asia/Riyadh', methodId: 4 },
  { city: 'Dammam', country: 'Saudi Arabia', countryCode: 'SA', latitude: 26.4207, longitude: 50.0888, timezone: 'Asia/Riyadh', methodId: 4 },
  { city: 'Doha', country: 'Qatar', countryCode: 'QA', latitude: 25.2854, longitude: 51.5310, timezone: 'Asia/Qatar', methodId: 4 },
  { city: 'Kuwait City', country: 'Kuwait', countryCode: 'KW', latitude: 29.3759, longitude: 47.9774, timezone: 'Asia/Kuwait', methodId: 4 },
  { city: 'Manama', country: 'Bahrain', countryCode: 'BH', latitude: 26.2285, longitude: 50.5860, timezone: 'Asia/Bahrain', methodId: 4 },
  { city: 'Muscat', country: 'Oman', countryCode: 'OM', latitude: 23.5880, longitude: 58.3829, timezone: 'Asia/Muscat', methodId: 4 },
  { city: 'Amman', country: 'Jordan', countryCode: 'JO', latitude: 31.9454, longitude: 35.9284, timezone: 'Asia/Amman', methodId: 3 },
  { city: 'Beirut', country: 'Lebanon', countryCode: 'LB', latitude: 33.8938, longitude: 35.5018, timezone: 'Asia/Beirut', methodId: 3 },
  { city: 'Cairo', country: 'Egypt', countryCode: 'EG', latitude: 30.0444, longitude: 31.2357, timezone: 'Africa/Cairo', methodId: 5 },
  { city: 'Alexandria', country: 'Egypt', countryCode: 'EG', latitude: 31.2001, longitude: 29.9187, timezone: 'Africa/Cairo', methodId: 5 },
  { city: 'Istanbul', country: 'Turkey', countryCode: 'TR', latitude: 41.0082, longitude: 28.9784, timezone: 'Europe/Istanbul', methodId: 3 },
  { city: 'Ankara', country: 'Turkey', countryCode: 'TR', latitude: 39.9334, longitude: 32.8597, timezone: 'Europe/Istanbul', methodId: 3 },
  { city: 'Baghdad', country: 'Iraq', countryCode: 'IQ', latitude: 33.3152, longitude: 44.3661, timezone: 'Asia/Baghdad', methodId: 3 },
  { city: 'Tehran', country: 'Iran', countryCode: 'IR', latitude: 35.6892, longitude: 51.3890, timezone: 'Asia/Tehran', methodId: 3 },

  // Southeast Asia & Far East
  { city: 'Jakarta', country: 'Indonesia', countryCode: 'ID', latitude: -6.2088, longitude: 106.8456, timezone: 'Asia/Jakarta', methodId: 3 },
  { city: 'Surabaya', country: 'Indonesia', countryCode: 'ID', latitude: -7.2575, longitude: 112.7521, timezone: 'Asia/Jakarta', methodId: 3 },
  { city: 'Bandung', country: 'Indonesia', countryCode: 'ID', latitude: -6.9175, longitude: 107.6191, timezone: 'Asia/Jakarta', methodId: 3 },
  { city: 'Kuala Lumpur', country: 'Malaysia', countryCode: 'MY', latitude: 3.1390, longitude: 101.6869, timezone: 'Asia/Kuala_Lumpur', methodId: 3 },
  { city: 'Penang', country: 'Malaysia', countryCode: 'MY', latitude: 5.4141, longitude: 100.3288, timezone: 'Asia/Kuala_Lumpur', methodId: 3 },
  { city: 'Singapore', country: 'Singapore', countryCode: 'SG', latitude: 1.3521, longitude: 103.8198, timezone: 'Asia/Singapore', methodId: 3 },
  { city: 'Bangkok', country: 'Thailand', countryCode: 'TH', latitude: 13.7563, longitude: 100.5018, timezone: 'Asia/Bangkok', methodId: 3 },
  { city: 'Tokyo', country: 'Japan', countryCode: 'JP', latitude: 35.6762, longitude: 139.6503, timezone: 'Asia/Tokyo', methodId: 3 },

  // Europe
  { city: 'London', country: 'United Kingdom', countryCode: 'GB', latitude: 51.5074, longitude: -0.1278, timezone: 'Europe/London', methodId: 3 },
  { city: 'Birmingham', country: 'United Kingdom', countryCode: 'GB', latitude: 52.4862, longitude: -1.8904, timezone: 'Europe/London', methodId: 3 },
  { city: 'Manchester', country: 'United Kingdom', countryCode: 'GB', latitude: 53.4808, longitude: -2.2426, timezone: 'Europe/London', methodId: 3 },
  { city: 'Paris', country: 'France', countryCode: 'FR', latitude: 48.8566, longitude: 2.3522, timezone: 'Europe/Paris', methodId: 3 },
  { city: 'Berlin', country: 'Germany', countryCode: 'DE', latitude: 52.5200, longitude: 13.4050, timezone: 'Europe/Berlin', methodId: 3 },
  { city: 'Frankfurt', country: 'Germany', countryCode: 'DE', latitude: 50.1109, longitude: 8.6821, timezone: 'Europe/Berlin', methodId: 3 },
  { city: 'Amsterdam', country: 'Netherlands', countryCode: 'NL', latitude: 52.3676, longitude: 4.9041, timezone: 'Europe/Amsterdam', methodId: 3 },
  { city: 'Brussels', country: 'Belgium', countryCode: 'BE', latitude: 50.8503, longitude: 4.3517, timezone: 'Europe/Brussels', methodId: 3 },
  { city: 'Madrid', country: 'Spain', countryCode: 'ES', latitude: 40.4168, longitude: -3.7038, timezone: 'Europe/Madrid', methodId: 3 },
  { city: 'Rome', country: 'Italy', countryCode: 'IT', latitude: 41.9028, longitude: 12.4964, timezone: 'Europe/Rome', methodId: 3 },
  { city: 'Stockholm', country: 'Sweden', countryCode: 'SE', latitude: 59.3293, longitude: 18.0686, timezone: 'Europe/Stockholm', methodId: 3 },
  { city: 'Oslo', country: 'Norway', countryCode: 'NO', latitude: 59.9139, longitude: 10.7522, timezone: 'Europe/Oslo', methodId: 3 },

  // North America
  { city: 'New York', country: 'United States', countryCode: 'US', latitude: 40.7128, longitude: -74.0060, timezone: 'America/New_York', methodId: 2 },
  { city: 'Chicago', country: 'United States', countryCode: 'US', latitude: 41.8781, longitude: -87.6298, timezone: 'America/Chicago', methodId: 2 },
  { city: 'Houston', country: 'United States', countryCode: 'US', latitude: 29.7604, longitude: -95.3698, timezone: 'America/Chicago', methodId: 2 },
  { city: 'Dallas', country: 'United States', countryCode: 'US', latitude: 32.7767, longitude: -96.7970, timezone: 'America/Chicago', methodId: 2 },
  { city: 'Los Angeles', country: 'United States', countryCode: 'US', latitude: 34.0522, longitude: -118.2437, timezone: 'America/Los_Angeles', methodId: 2 },
  { city: 'San Francisco', country: 'United States', countryCode: 'US', latitude: 37.7749, longitude: -122.4194, timezone: 'America/Los_Angeles', methodId: 2 },
  { city: 'Seattle', country: 'United States', countryCode: 'US', latitude: 47.6062, longitude: -122.3321, timezone: 'America/Los_Angeles', methodId: 2 },
  { city: 'Washington D.C.', country: 'United States', countryCode: 'US', latitude: 38.9072, longitude: -77.0369, timezone: 'America/New_York', methodId: 2 },
  { city: 'Atlanta', country: 'United States', countryCode: 'US', latitude: 33.7490, longitude: -84.3880, timezone: 'America/New_York', methodId: 2 },
  { city: 'Toronto', country: 'Canada', countryCode: 'CA', latitude: 43.6532, longitude: -79.3832, timezone: 'America/Toronto', methodId: 2 },
  { city: 'Montreal', country: 'Canada', countryCode: 'CA', latitude: 45.5017, longitude: -73.5673, timezone: 'America/Toronto', methodId: 2 },
  { city: 'Vancouver', country: 'Canada', countryCode: 'CA', latitude: 49.2827, longitude: -123.1207, timezone: 'America/Vancouver', methodId: 2 },
  { city: 'Calgary', country: 'Canada', countryCode: 'CA', latitude: 51.0447, longitude: -114.0719, timezone: 'America/Edmonton', methodId: 2 },

  // Australia & Africa
  { city: 'Sydney', country: 'Australia', countryCode: 'AU', latitude: -33.8688, longitude: 151.2093, timezone: 'Australia/Sydney', methodId: 3 },
  { city: 'Melbourne', country: 'Australia', countryCode: 'AU', latitude: -37.8136, longitude: 144.9631, timezone: 'Australia/Melbourne', methodId: 3 },
  { city: 'Auckland', country: 'New Zealand', countryCode: 'NZ', latitude: -36.8485, longitude: 174.7633, timezone: 'Pacific/Auckland', methodId: 3 },
  { city: 'Johannesburg', country: 'South Africa', countryCode: 'ZA', latitude: -26.2041, longitude: 28.0473, timezone: 'Africa/Johannesburg', methodId: 3 },
  { city: 'Cape Town', country: 'South Africa', countryCode: 'ZA', latitude: -33.9249, longitude: 18.4241, timezone: 'Africa/Johannesburg', methodId: 3 },
  { city: 'Casablanca', country: 'Morocco', countryCode: 'MA', latitude: 33.5731, longitude: -7.5898, timezone: 'Africa/Casablanca', methodId: 5 },
  { city: 'Algiers', country: 'Algeria', countryCode: 'DZ', latitude: 36.7538, longitude: 3.0588, timezone: 'Africa/Algiers', methodId: 5 },
  { city: 'Tunis', country: 'Tunisia', countryCode: 'TN', latitude: 36.8065, longitude: 10.1815, timezone: 'Africa/Tunis', methodId: 5 },
];

export const PRAYER_METADATA: Record<
  string,
  { arabic: string; meaning: string; virtues: string; icon: string }
> = {
  Fajr: {
    arabic: 'الفجر',
    meaning: 'Dawn Prayer',
    virtues: 'Whoever prays the dawn prayer is under the protection of Allah. (Muslim)',
    icon: 'sunrise',
  },
  Sunrise: {
    arabic: 'الشروق',
    meaning: 'Sunrise (Ishraq)',
    virtues: 'Remembrance of Allah until sunrise brings peace to the heart.',
    icon: 'sun-medium',
  },
  Dhuhr: {
    arabic: 'الظهر',
    meaning: 'Noon Prayer',
    virtues: 'This is an hour when the gates of heaven are opened. (Tirmidhi)',
    icon: 'sun',
  },
  Asr: {
    arabic: 'العصر',
    meaning: 'Afternoon Prayer',
    virtues: 'Whoever prays the two cool prayers (Fajr & Asr) will enter Paradise. (Bukhari)',
    icon: 'sunset',
  },
  Maghrib: {
    arabic: 'المغرب',
    meaning: 'Sunset Prayer',
    virtues: 'The time of Maghrib enters as soon as the sun disappears behind the horizon.',
    icon: 'sunset',
  },
  Isha: {
    arabic: 'العشاء',
    meaning: 'Night Prayer',
    virtues: 'Whoever prays Isha in congregation is as if he prayed half the night. (Muslim)',
    icon: 'moon',
  },
};

// ==============================================================================
// QIBLA BEARING CALCULATION (Kaaba Coordinates: 21.4225° N, 39.8262° E)
// ==============================================================================
export const MAKKAH_COORDINATES = {
  latitude: 21.4225,
  longitude: 39.8262,
  city: 'Makkah',
  country: 'Saudi Arabia',
};

export function calculateQiblaDirection(latitude: number, longitude: number): number {
  const makkahLat = (MAKKAH_COORDINATES.latitude * Math.PI) / 180;
  const makkahLng = (MAKKAH_COORDINATES.longitude * Math.PI) / 180;
  const userLat = (latitude * Math.PI) / 180;
  const userLng = (longitude * Math.PI) / 180;

  const dLng = makkahLng - userLng;
  const y = Math.sin(dLng);
  const x = Math.cos(userLat) * Math.tan(makkahLat) - Math.sin(userLat) * Math.cos(dLng);

  let qibla = (Math.atan2(y, x) * 180) / Math.PI;
  qibla = (qibla + 360) % 360;
  return Math.round(qibla * 10) / 10;
}

export function calculateDistanceToKaaba(
  latitude: number,
  longitude: number
): { km: number; miles: number } {
  const R = 6371; // Earth radius in km
  const dLat = ((MAKKAH_COORDINATES.latitude - latitude) * Math.PI) / 180;
  const dLon = ((MAKKAH_COORDINATES.longitude - longitude) * Math.PI) / 180;
  const lat1 = (latitude * Math.PI) / 180;
  const lat2 = (MAKKAH_COORDINATES.latitude * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const km = Math.round(R * c);
  const miles = Math.round(km * 0.621371);

  return { km, miles };
}

export function getCompassDirectionName(degrees: number): string {
  const normalized = (degrees % 360 + 360) % 360;
  const directions = [
    'N',
    'NNE',
    'NE',
    'ENE',
    'E',
    'ESE',
    'SE',
    'SSE',
    'S',
    'SSW',
    'SW',
    'WSW',
    'W',
    'WNW',
    'NW',
    'NNW',
  ];
  const index = Math.round(normalized / 22.5) % 16;
  return directions[index];
}

export function calculateRelativeQibla(
  qiblaBearing: number,
  deviceHeading: number
): {
  relativeAngle: number;
  isAligned: boolean;
  offsetDegrees: number;
  turnDirection: 'left' | 'right' | 'aligned';
} {
  // relative angle = where to point relative to top of phone
  const diff = (qiblaBearing - deviceHeading + 360) % 360;
  
  // offset between -180 and +180
  let offset = (diff > 180) ? diff - 360 : diff;
  const isAligned = Math.abs(offset) <= 3; // Within 3 degrees is aligned!

  let turnDirection: 'left' | 'right' | 'aligned' = 'aligned';
  if (offset > 3) {
    turnDirection = 'right';
  } else if (offset < -3) {
    turnDirection = 'left';
  }

  return {
    relativeAngle: diff,
    isAligned,
    offsetDegrees: Math.round(Math.abs(offset)),
    turnDirection,
  };
}

// ==============================================================================
// APPROXIMATE HIJRI DATE CALCULATION
// ==============================================================================
const HIJRI_MONTHS_EN = [
  'Muharram',
  'Safar',
  'Rabi al-Awwal',
  'Rabi al-Thani',
  'Jumada al-Awwal',
  'Jumada al-Thani',
  'Rajab',
  'Sha\'ban',
  'Ramadan',
  'Shawwal',
  'Dhu al-Qi\'dah',
  'Dhu al-Hijjah',
];

const HIJRI_MONTHS_AR = [
  'محرم',
  'صفر',
  'ربيع الأول',
  'ربيع الثاني',
  'جمادى الأولى',
  'جمادى الثانية',
  'رجب',
  'شعبان',
  'رمضان',
  'شوال',
  'ذو القعدة',
  'ذو الحجة',
];

export function getApproximateHijriDate(date: Date = new Date()): HijriDate {
  // Astronomical Julian day estimate for Hijri conversion
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  let jd =
    Math.floor((1461 * (year + 4800 + Math.floor((month - 14) / 12))) / 4) +
    Math.floor((367 * (month - 2 - 12 * Math.floor((month - 14) / 12))) / 12) -
    Math.floor((3 * Math.floor((year + 4900 + Math.floor((month - 14) / 12)) / 100)) / 4) +
    day -
    32075;

  let l = jd - 1948440 + 10632;
  let n = Math.floor((l - 1) / 10631);
  l = l - 10631 * n + 354;
  let j =
    Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719) +
    Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
  l =
    l -
    Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) -
    Math.floor(j / 16) * Math.floor((15238 * j) / 43) +
    29;
  let m = Math.floor((24 * l) / 709);
  let d = l - Math.floor((709 * m) / 24);
  let y = 30 * n + j - 30;

  // Bound checks
  const mIndex = Math.max(0, Math.min(11, m - 1));
  const monthEn = HIJRI_MONTHS_EN[mIndex] || 'Safar';
  const monthAr = HIJRI_MONTHS_AR[mIndex] || 'صفر';

  return {
    day: String(d),
    monthEn,
    monthAr,
    year: `${y} AH`,
    formatted: `${d} ${monthEn} ${y} AH`,
  };
}

// ==============================================================================
// OFFLINE ASTRONOMICAL SOLAR CALCULATION FALLBACK
// High precision solar coordinates & prayer angle formulas
// ==============================================================================
export function calculateSolarPrayerTimes(
  latitude: number,
  longitude: number,
  date: Date = new Date(),
  methodId: number = 2
): PrayerTimes {
  const dayOfYear = Math.floor(
    (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) -
      Date.UTC(date.getFullYear(), 0, 0)) /
      (24 * 60 * 60 * 1000)
  );

  // Approximate solar declination (delta) in radians
  const delta = 0.4093 * Math.sin(((2 * Math.PI) / 365) * (dayOfYear - 81));

  // Equation of time in hours
  const b = ((2 * Math.PI) / 365) * (dayOfYear - 81);
  const eqtime = (9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b)) / 60;

  // Local Timezone Offset in hours
  const timezoneOffsetHours = -date.getTimezoneOffset() / 60;

  // Solar Noon (Dhuhr) in local hours
  const solarNoon = 12 + timezoneOffsetHours - longitude / 15 - eqtime;

  const latRad = (latitude * Math.PI) / 180;

  // Fajr angle depending on method
  let fajrAngle = 18; // default
  let ishaAngle = 18; // default
  if (methodId === 2) {
    fajrAngle = 15;
    ishaAngle = 15;
  } else if (methodId === 3) {
    fajrAngle = 18;
    ishaAngle = 17;
  } else if (methodId === 4) {
    fajrAngle = 18.5;
    ishaAngle = 19;
  } else if (methodId === 5) {
    fajrAngle = 19.5;
    ishaAngle = 17.5;
  }

  // Hour angle helper
  const calculateHourAngle = (angleDegrees: number, isDepression: boolean = true): number => {
    const angleRad = ((isDepression ? -angleDegrees : angleDegrees) * Math.PI) / 180;
    const cosHA = (Math.sin(angleRad) - Math.sin(latRad) * Math.sin(delta)) / (Math.cos(latRad) * Math.cos(delta));
    if (cosHA < -1) return 12; // Polar day
    if (cosHA > 1) return 0; // Polar night
    return (Math.acos(cosHA) * 180) / Math.PI / 15;
  };

  const fajrHA = calculateHourAngle(fajrAngle, true);
  const sunriseHA = calculateHourAngle(0.833, true); // Sun's center 50 arcminutes below horizon

  // Asr hour angle: shadow length = 1 + tan|lat - delta| (Shafi'i/Standard)
  const asrAlt = (Math.atan(1 / (1 + Math.tan(Math.abs(latRad - delta)))) * 180) / Math.PI;
  const asrHA = calculateHourAngle(asrAlt, false);

  const ishaHA = calculateHourAngle(ishaAngle, true);

  const formatHours = (hours: number): string => {
    let normalized = (hours + 24) % 24;
    const h = Math.floor(normalized);
    const m = Math.floor((normalized - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const fajrHours = solarNoon - fajrHA;
  const sunriseHours = solarNoon - sunriseHA;
  const dhuhrHours = solarNoon + 0.05; // 3-4 mins after exact zenith
  const asrHours = solarNoon + asrHA;
  const maghribHours = solarNoon + sunriseHA; // Maghrib starts at sunset
  const ishaHours = solarNoon + ishaHA;

  return {
    Fajr: formatHours(fajrHours),
    Sunrise: formatHours(sunriseHours),
    Dhuhr: formatHours(dhuhrHours),
    Asr: formatHours(asrHours),
    Maghrib: formatHours(maghribHours),
    Isha: formatHours(ishaHours),
  };
}

// ==============================================================================
// TIME FORMATTING HELPER (12-hour AM/PM vs 24-hour)
// ==============================================================================
export function formatPrayerTime(timeStr: string, use24Hour: boolean = false): string {
  if (!timeStr) return '--:--';
  const cleanTime = timeStr.split(' ')[0]; // Remove (EST) or timezone suffix if any
  const parts = cleanTime.split(':');
  if (parts.length < 2) return timeStr;

  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);

  if (isNaN(hours) || isNaN(minutes)) return timeStr;

  if (use24Hour) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
}

// ==============================================================================
// NEXT PRAYER & COUNTDOWN PARSER
// ==============================================================================
export function computeNextPrayerState(
  timings: PrayerTimes,
  now: Date = new Date()
): {
  prayers: PrayerInfo[];
  nextPrayer: PrayerInfo | null;
  currentPrayer: PrayerInfo | null;
  timeRemainingSeconds: number;
} {
  const prayerNames: Array<'Fajr' | 'Sunrise' | 'Dhuhr' | 'Asr' | 'Maghrib' | 'Isha'> = [
    'Fajr',
    'Sunrise',
    'Dhuhr',
    'Asr',
    'Maghrib',
    'Isha',
  ];

  const prayers: PrayerInfo[] = [];

  for (const name of prayerNames) {
    const rawTime = timings[name];
    if (!rawTime) continue;

    const cleanTime = rawTime.split(' ')[0];
    const [h, m] = cleanTime.split(':').map((v) => parseInt(v, 10));

    const pDate = new Date(now);
    pDate.setHours(h, m, 0, 0);

    const isPassed = now.getTime() >= pDate.getTime();

    prayers.push({
      name,
      arabicName: PRAYER_METADATA[name]?.arabic || name,
      time: cleanTime,
      timeFormatted: formatPrayerTime(cleanTime, false),
      dateObj: pDate,
      isNext: false,
      isCurrent: false,
      passed: isPassed,
      meaning: PRAYER_METADATA[name]?.meaning || '',
    });
  }

  // Determine current and next prayer
  let nextPrayer: PrayerInfo | null = null;
  let currentPrayer: PrayerInfo | null = null;

  for (let i = 0; i < prayers.length; i++) {
    if (!prayers[i].passed) {
      nextPrayer = prayers[i];
      prayers[i].isNext = true;
      if (i > 0) {
        currentPrayer = prayers[i - 1];
        prayers[i - 1].isCurrent = true;
      } else {
        // Current prayer is Isha from previous night
        currentPrayer = prayers[prayers.length - 1];
      }
      break;
    }
  }

  // If all prayers today have passed, next prayer is Fajr tomorrow
  if (!nextPrayer && prayers.length > 0) {
    const tomorrowFajrDate = new Date(prayers[0].dateObj);
    tomorrowFajrDate.setDate(tomorrowFajrDate.getDate() + 1);

    nextPrayer = {
      ...prayers[0],
      dateObj: tomorrowFajrDate,
      isNext: true,
    };
    currentPrayer = prayers[prayers.length - 1]; // Isha
    if (currentPrayer) {
      currentPrayer.isCurrent = true;
    }
  }

  const timeRemainingSeconds = nextPrayer
    ? Math.max(0, Math.floor((nextPrayer.dateObj.getTime() - now.getTime()) / 1000))
    : 0;

  return {
    prayers,
    nextPrayer,
    currentPrayer,
    timeRemainingSeconds,
  };
}

// ==============================================================================
// FETCH PRAYER TIMES (Aladhan API with Instant Cache & Astronomical Fallback)
// ==============================================================================
const prayerCache = new Map<string, { data: PrayerTimesData; timestamp: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function getPrayerTimes(
  city: string = 'Karachi',
  country: string = 'Location Unknown',
  methodId: number = 2,
  latitude?: number,
  longitude?: number
): Promise<PrayerTimesData> {
  const cacheKey = `${city.toLowerCase()}_${country.toLowerCase()}_${methodId}_${new Date().toDateString()}`;
  const cached = prayerCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    // Re-evaluate next prayer for live time
    const nextState = computeNextPrayerState(cached.data.timings, new Date());
    return {
      ...cached.data,
      nextPrayer: nextState.nextPrayer,
      currentPrayer: nextState.currentPrayer,
      timeRemainingSeconds: nextState.timeRemainingSeconds,
    };
  }

  // Find coordinates if known
  let lat = latitude;
  let lng = longitude;
  if (lat === undefined || lng === undefined) {
    const matchedCity = POPULAR_CITIES.find(
      (c) => c.city.toLowerCase() === city.toLowerCase() || c.country.toLowerCase() === country.toLowerCase()
    );
    if (matchedCity) {
      lat = matchedCity.latitude;
      lng = matchedCity.longitude;
    } else {
      lat = 24.8607; // Default Karachi
      lng = 67.0011;
    }
  }

  const qiblaDirection = calculateQiblaDirection(lat, lng);
  const hijriApprox = getApproximateHijriDate(new Date());

  // Attempt fetch from Aladhan API
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    let apiUrl = '';
    if (latitude !== undefined && longitude !== undefined) {
      apiUrl = `https://api.aladhan.com/v1/timings?latitude=${latitude}&longitude=${longitude}&method=${methodId}`;
    } else {
      apiUrl = `https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(
        city
      )}&country=${encodeURIComponent(country)}&method=${methodId}`;
    }

    const res = await fetch(apiUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const json = await res.json();
      if (json.data && json.data.timings) {
        const timings: PrayerTimes = {
          Fajr: json.data.timings.Fajr,
          Sunrise: json.data.timings.Sunrise,
          Dhuhr: json.data.timings.Dhuhr,
          Asr: json.data.timings.Asr,
          Maghrib: json.data.timings.Maghrib,
          Isha: json.data.timings.Isha,
          Imsak: json.data.timings.Imsak,
          Midnight: json.data.timings.Midnight,
        };

        const apiHijri = json.data.date?.hijri;
        const hijri: HijriDate = apiHijri
          ? {
              day: apiHijri.day || hijriApprox.day,
              monthEn: apiHijri.month?.en || hijriApprox.monthEn,
              monthAr: apiHijri.month?.ar || hijriApprox.monthAr,
              year: `${apiHijri.year || '1448'} AH`,
              formatted: `${apiHijri.day} ${apiHijri.month?.en} ${apiHijri.year} AH`,
            }
          : hijriApprox;

        const nextState = computeNextPrayerState(timings, new Date());

        const result: PrayerTimesData = {
          city,
          country,
          latitude: lat,
          longitude: lng,
          timezone: json.data.meta?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
          timings,
          hijri,
          methodName: json.data.meta?.method?.name || 'Standard Calculation',
          qiblaDirection,
          nextPrayer: nextState.nextPrayer,
          currentPrayer: nextState.currentPrayer,
          timeRemainingSeconds: nextState.timeRemainingSeconds,
        };

        prayerCache.set(cacheKey, { data: result, timestamp: Date.now() });
        return result;
      }
    }
  } catch (err) {
    // Graceful offline fallback
    console.warn('Aladhan API fetch note (using solar fallback):', err);
  }

  // Fallback to Astronomical Solar Engine
  const calculatedTimings = calculateSolarPrayerTimes(lat, lng, new Date(), methodId);
  const nextState = computeNextPrayerState(calculatedTimings, new Date());

  const fallbackData: PrayerTimesData = {
    city,
    country,
    latitude: lat,
    longitude: lng,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timings: calculatedTimings,
    hijri: hijriApprox,
    methodName: CALCULATION_METHODS.find((m) => m.id === methodId)?.name || 'Solar Astronomical Calculation',
    qiblaDirection,
    nextPrayer: nextState.nextPrayer,
    currentPrayer: nextState.currentPrayer,
    timeRemainingSeconds: nextState.timeRemainingSeconds,
  };

  prayerCache.set(cacheKey, { data: fallbackData, timestamp: Date.now() });
  return fallbackData;
}
