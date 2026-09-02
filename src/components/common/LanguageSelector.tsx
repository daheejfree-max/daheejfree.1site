'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Globe, Check, ChevronDown, Search, X, Sparkles, RotateCcw } from 'lucide-react';

export interface Language {
  code: string;
  name: string;
  nativeName: string;
  dir?: 'ltr' | 'rtl';
  popular?: boolean;
}

export const POPULAR_LANGUAGE_CODES = [
  'default', 'en', 'ur', 'ar', 'hi', 'bn', 'fa', 'tr', 'id', 
  'fr', 'de', 'es', 'ru', 'pa', 'so', 'ms', 'zh-CN'
];

export const LANGUAGES: Language[] = [
  { code: 'default', name: 'Default (Original Website)', nativeName: 'Original Website / اصل ویب سائٹ', dir: 'ltr', popular: true },
  { code: 'en', name: 'English (Original)', nativeName: 'English (اصل)', dir: 'ltr', popular: true },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', dir: 'rtl', popular: true },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', dir: 'rtl', popular: true },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', dir: 'ltr', popular: true },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', dir: 'ltr', popular: true },
  { code: 'fa', name: 'Persian', nativeName: 'فارسی', dir: 'rtl', popular: true },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', dir: 'ltr', popular: true },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', dir: 'ltr', popular: true },
  { code: 'fr', name: 'French', nativeName: 'Français', dir: 'ltr', popular: true },
  { code: 'de', name: 'German', nativeName: 'Deutsch', dir: 'ltr', popular: true },
  { code: 'es', name: 'Spanish', nativeName: 'Español', dir: 'ltr', popular: true },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', dir: 'ltr', popular: true },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', dir: 'ltr', popular: true },
  { code: 'so', name: 'Somali', nativeName: 'Soomaali', dir: 'ltr', popular: true },
  { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu', dir: 'ltr', popular: true },
  { code: 'zh-CN', name: 'Chinese (Simplified)', nativeName: '中文 (简体)', dir: 'ltr', popular: true },
  { code: 'zh-TW', name: 'Chinese (Traditional)', nativeName: '中文 (繁體)', dir: 'ltr' },
  { code: 'af', name: 'Afrikaans', nativeName: 'Afrikaans', dir: 'ltr' },
  { code: 'sq', name: 'Albanian', nativeName: 'Shqip', dir: 'ltr' },
  { code: 'am', name: 'Amharic', nativeName: 'አማርኛ', dir: 'ltr' },
  { code: 'hy', name: 'Armenian', nativeName: 'Հայերեն', dir: 'ltr' },
  { code: 'as', name: 'Assamese', nativeName: 'অসমীয়া', dir: 'ltr' },
  { code: 'ay', name: 'Aymara', nativeName: 'Aymar aru', dir: 'ltr' },
  { code: 'az', name: 'Azerbaijani', nativeName: 'Azərbaycan dili', dir: 'ltr' },
  { code: 'bm', name: 'Bambara', nativeName: 'Bamanankan', dir: 'ltr' },
  { code: 'eu', name: 'Basque', nativeName: 'Euskara', dir: 'ltr' },
  { code: 'be', name: 'Belarusian', nativeName: 'Беларуская', dir: 'ltr' },
  { code: 'bho', name: 'Bhojpuri', nativeName: 'भोजपुरी', dir: 'ltr' },
  { code: 'bs', name: 'Bosnian', nativeName: 'Bosanski', dir: 'ltr' },
  { code: 'bg', name: 'Bulgarian', nativeName: 'Български', dir: 'ltr' },
  { code: 'ca', name: 'Catalan', nativeName: 'Català', dir: 'ltr' },
  { code: 'ceb', name: 'Cebuano', nativeName: 'Cebuano', dir: 'ltr' },
  { code: 'ny', name: 'Chichewa', nativeName: 'Chichewa', dir: 'ltr' },
  { code: 'co', name: 'Corsican', nativeName: 'Corsu', dir: 'ltr' },
  { code: 'hr', name: 'Croatian', nativeName: 'Hrvatski', dir: 'ltr' },
  { code: 'cs', name: 'Czech', nativeName: 'Čeština', dir: 'ltr' },
  { code: 'da', name: 'Danish', nativeName: 'Dansk', dir: 'ltr' },
  { code: 'dv', name: 'Dhivehi', nativeName: 'ދިވެހި', dir: 'rtl' },
  { code: 'doi', name: 'Dogri', nativeName: 'डोगरी', dir: 'ltr' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', dir: 'ltr' },
  { code: 'eo', name: 'Esperanto', nativeName: 'Esperanto', dir: 'ltr' },
  { code: 'et', name: 'Estonian', nativeName: 'Eesti', dir: 'ltr' },
  { code: 'ee', name: 'Ewe', nativeName: 'Eʋegbe', dir: 'ltr' },
  { code: 'tl', name: 'Filipino (Tagalog)', nativeName: 'Filipino', dir: 'ltr' },
  { code: 'fi', name: 'Finnish', nativeName: 'Suomi', dir: 'ltr' },
  { code: 'fy', name: 'Frisian', nativeName: 'Frysk', dir: 'ltr' },
  { code: 'gl', name: 'Galician', nativeName: 'Galego', dir: 'ltr' },
  { code: 'ka', name: 'Georgian', nativeName: 'ქართული', dir: 'ltr' },
  { code: 'el', name: 'Greek', nativeName: 'Ελληνικά', dir: 'ltr' },
  { code: 'gn', name: 'Guarani', nativeName: 'Avañeʼẽ', dir: 'ltr' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', dir: 'ltr' },
  { code: 'ht', name: 'Haitian Creole', nativeName: 'Kreyòl ayisyen', dir: 'ltr' },
  { code: 'ha', name: 'Hausa', nativeName: 'Hausa', dir: 'ltr' },
  { code: 'haw', name: 'Hawaiian', nativeName: 'ʻŌlelo Hawaiʻi', dir: 'ltr' },
  { code: 'he', name: 'Hebrew', nativeName: 'עברית', dir: 'rtl' },
  { code: 'hmn', name: 'Hmong', nativeName: 'Hmoob', dir: 'ltr' },
  { code: 'hu', name: 'Hungarian', nativeName: 'Magyar', dir: 'ltr' },
  { code: 'is', name: 'Icelandic', nativeName: 'Íslenska', dir: 'ltr' },
  { code: 'ig', name: 'Igbo', nativeName: 'Igbo', dir: 'ltr' },
  { code: 'ilo', name: 'Ilocano', nativeName: 'Ilokano', dir: 'ltr' },
  { code: 'ga', name: 'Irish', nativeName: 'Gaeilge', dir: 'ltr' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', dir: 'ltr' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', dir: 'ltr' },
  { code: 'jv', name: 'Javanese', nativeName: 'Basa Jawa', dir: 'ltr' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', dir: 'ltr' },
  { code: 'kk', name: 'Kazakh', nativeName: 'Қазақ тілі', dir: 'ltr' },
  { code: 'km', name: 'Khmer', nativeName: 'ខ្មែរ', dir: 'ltr' },
  { code: 'rw', name: 'Kinyarwanda', nativeName: 'Ikinyarwanda', dir: 'ltr' },
  { code: 'gom', name: 'Konkani', nativeName: 'कोंकणी', dir: 'ltr' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', dir: 'ltr' },
  { code: 'kri', name: 'Krio', nativeName: 'Krio', dir: 'ltr' },
  { code: 'ku', name: 'Kurdish (Kurmanji)', nativeName: 'Kurdî', dir: 'rtl' },
  { code: 'ckb', name: 'Kurdish (Sorani)', nativeName: 'کوردی', dir: 'rtl' },
  { code: 'ky', name: 'Kyrgyz', nativeName: 'Кыргызча', dir: 'ltr' },
  { code: 'lo', name: 'Lao', nativeName: 'ລາວ', dir: 'ltr' },
  { code: 'la', name: 'Latin', nativeName: 'Latina', dir: 'ltr' },
  { code: 'lv', name: 'Latvian', nativeName: 'Latviešu', dir: 'ltr' },
  { code: 'ln', name: 'Lingala', nativeName: 'Lingála', dir: 'ltr' },
  { code: 'lt', name: 'Lithuanian', nativeName: 'Lietuvių', dir: 'ltr' },
  { code: 'lg', name: 'Luganda', nativeName: 'Oluganda', dir: 'ltr' },
  { code: 'lb', name: 'Luxembourgish', nativeName: 'Lëtzebuergesch', dir: 'ltr' },
  { code: 'mk', name: 'Macedonian', nativeName: 'Македонски', dir: 'ltr' },
  { code: 'mai', name: 'Maithili', nativeName: 'मैथिली', dir: 'ltr' },
  { code: 'mg', name: 'Malagasy', nativeName: 'Malagasy', dir: 'ltr' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', dir: 'ltr' },
  { code: 'mt', name: 'Maltese', nativeName: 'Malti', dir: 'ltr' },
  { code: 'mi', name: 'Maori', nativeName: 'Te Reo Māori', dir: 'ltr' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', dir: 'ltr' },
  { code: 'mni-Mtei', name: 'Meiteilon (Manipuri)', nativeName: 'মৈতৈলোন্', dir: 'ltr' },
  { code: 'lus', name: 'Mizo', nativeName: 'Mizo ṭawng', dir: 'ltr' },
  { code: 'mn', name: 'Mongolian', nativeName: 'Монгол', dir: 'ltr' },
  { code: 'my', name: 'Myanmar (Burmese)', nativeName: 'ဗမာစာ', dir: 'ltr' },
  { code: 'ne', name: 'Nepali', nativeName: 'नेपाली', dir: 'ltr' },
  { code: 'no', name: 'Norwegian', nativeName: 'Norsk', dir: 'ltr' },
  { code: 'or', name: 'Odia (Oriya)', nativeName: 'ଓଡ଼ିଆ', dir: 'ltr' },
  { code: 'om', name: 'Oromo', nativeName: 'Afaan Oromoo', dir: 'ltr' },
  { code: 'ps', name: 'Pashto', nativeName: 'پښتو', dir: 'rtl' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', dir: 'ltr' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', dir: 'ltr' },
  { code: 'qu', name: 'Quechua', nativeName: 'Runasimi', dir: 'ltr' },
  { code: 'ro', name: 'Romanian', nativeName: 'Română', dir: 'ltr' },
  { code: 'sm', name: 'Samoan', nativeName: 'Gagana faʻa Sāmoa', dir: 'ltr' },
  { code: 'sa', name: 'Sanskrit', nativeName: 'संस्कृतम्', dir: 'ltr' },
  { code: 'gd', name: 'Scots Gaelic', nativeName: 'Gàidhlig', dir: 'ltr' },
  { code: 'nso', name: 'Sepedi', nativeName: 'Sepedi', dir: 'ltr' },
  { code: 'sr', name: 'Serbian', nativeName: 'Српски', dir: 'ltr' },
  { code: 'st', name: 'Sesotho', nativeName: 'Sesotho', dir: 'ltr' },
  { code: 'sn', name: 'Shona', nativeName: 'ChiShona', dir: 'ltr' },
  { code: 'sd', name: 'Sindhi', nativeName: 'سنڌي', dir: 'rtl' },
  { code: 'si', name: 'Sinhala', nativeName: 'සිංහල', dir: 'ltr' },
  { code: 'sk', name: 'Slovak', nativeName: 'Slovenčina', dir: 'ltr' },
  { code: 'sl', name: 'Slovenian', nativeName: 'Slovenščina', dir: 'ltr' },
  { code: 'su', name: 'Sundanese', nativeName: 'Basa Sunda', dir: 'ltr' },
  { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili', dir: 'ltr' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska', dir: 'ltr' },
  { code: 'tg', name: 'Tajik', nativeName: 'Тоҷикӣ', dir: 'ltr' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', dir: 'ltr' },
  { code: 'tt', name: 'Tatar', nativeName: 'Татар', dir: 'ltr' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', dir: 'ltr' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย', dir: 'ltr' },
  { code: 'ti', name: 'Tigrinya', nativeName: 'ትግርኛ', dir: 'ltr' },
  { code: 'ts', name: 'Tsonga', nativeName: 'Xitsonga', dir: 'ltr' },
  { code: 'tk', name: 'Turkmen', nativeName: 'Türkmen', dir: 'ltr' },
  { code: 'ak', name: 'Twi (Akan)', nativeName: 'Twi', dir: 'ltr' },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська', dir: 'ltr' },
  { code: 'ug', name: 'Uyghur', nativeName: 'ئۇيغۇرچە', dir: 'rtl' },
  { code: 'uz', name: 'Uzbek', nativeName: 'Oʻzbek', dir: 'ltr' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', dir: 'ltr' },
  { code: 'cy', name: 'Welsh', nativeName: 'Cymraeg', dir: 'ltr' },
  { code: 'xh', name: 'Xhosa', nativeName: 'isiXhosa', dir: 'ltr' },
  { code: 'yi', name: 'Yiddish', nativeName: 'ייִדיש', dir: 'rtl' },
  { code: 'yo', name: 'Yoruba', nativeName: 'Yorùbá', dir: 'ltr' },
  { code: 'zu', name: 'Zulu', nativeName: 'isiZulu', dir: 'ltr' }
];

export const openLanguageSelectorModal = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('daheej:open_language_selector'));
  }
};

export const setGoogleTranslateLanguage = (code: string) => {
  if (typeof window === 'undefined') return;

  const isDefault = code === 'default' || code === 'en';
  localStorage.setItem('daheej_lang', isDefault ? 'default' : code);

  const langObj = LANGUAGES.find((l) => l.code === code);
  const isRtl = !isDefault && langObj?.dir === 'rtl';

  document.documentElement.setAttribute('dir', isRtl ? 'rtl' : 'ltr');
  document.documentElement.setAttribute('lang', isDefault ? 'en' : code);
  if (document.body) {
    document.body.dir = isRtl ? 'rtl' : 'ltr';
  }

  const host = window.location.hostname;
  const parts = host.split('.');
  const rootDomain = parts.length > 1 ? parts.slice(-2).join('.') : host;

  // Clear previous Google Translate cookies thoroughly across all paths & domain combinations
  const expires = 'Thu, 01 Jan 1970 00:00:00 UTC';
  const paths = ['/', ''];
  const domains = ['', host, `.${host}`, rootDomain, `.${rootDomain}`];

  paths.forEach((path) => {
    domains.forEach((dom) => {
      const domPart = dom ? ` domain=${dom};` : '';
      document.cookie = `googtrans=; expires=${expires}; path=${path};${domPart}`;
      document.cookie = `googtrans=; expires=${expires}; path=${path}/;${domPart}`;
    });
  });

  if (!isDefault) {
    const val = `/auto/${code}`;
    document.cookie = `googtrans=${val}; path=/;`;
    document.cookie = `googtrans=${val}; path=/; domain=${host};`;
    document.cookie = `googtrans=${val}; path=/; domain=.${host};`;
    if (rootDomain !== host) {
      document.cookie = `googtrans=${val}; path=/; domain=.${rootDomain};`;
    }
  }

  // Trigger Google Translate select change if loaded in DOM
  try {
    const gtSelect = document.querySelector<HTMLSelectElement>('.goog-te-combo');
    if (gtSelect) {
      gtSelect.value = isDefault ? '' : code;
      gtSelect.dispatchEvent(new Event('change'));
    }
  } catch (e) {
    console.error(e);
  }

  // Notify listeners
  window.dispatchEvent(new CustomEvent('daheej:language_changed', { detail: { code: isDefault ? 'default' : code } }));
};

interface LanguageSelectorProps {
  direction?: 'up' | 'down';
  variant?: 'compact' | 'full' | 'pill' | 'button' | 'bottom-bar';
  onLanguageSelected?: (code: string) => void;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  variant = 'compact',
  onLanguageSelected,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState<string>('default');
  const [searchQuery, setSearchQuery] = useState('');
  const [isMounted, setIsMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
    const readCurrentLang = () => {
      const saved = localStorage.getItem('daheej_lang');
      if (saved) {
        setCurrentLang(saved);
        return;
      }
      // Check cookies
      const match = document.cookie.match(/googtrans=\/auto\/([^;]+)/);
      if (match && match[1] && match[1] !== 'en') {
        setCurrentLang(match[1]);
        localStorage.setItem('daheej_lang', match[1]);
      } else {
        setCurrentLang('default');
      }
    };

    readCurrentLang();

    const handleLangChange = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (detail?.code) {
        setCurrentLang(detail.code);
      }
    };

    const handleOpenSelector = () => {
      setIsOpen(true);
    };

    window.addEventListener('daheej:language_changed', handleLangChange);
    window.addEventListener('daheej:open_language_selector', handleOpenSelector);

    return () => {
      window.removeEventListener('daheej:language_changed', handleLangChange);
      window.removeEventListener('daheej:open_language_selector', handleOpenSelector);
    };
  }, []);

  const handleSelectLanguage = (code: string) => {
    const isDefault = code === 'default';
    setGoogleTranslateLanguage(code);
    setCurrentLang(isDefault ? 'default' : code);
    setIsOpen(false);
    if (onLanguageSelected) {
      onLanguageSelected(code);
    }
    // Smooth reload to apply or clear all translations cleanly
    setTimeout(() => {
      window.location.reload();
    }, 80);
  };

  const filteredLanguages = LANGUAGES.filter(
    (l) =>
      l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.nativeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isDefaultSelected = currentLang === 'default' || currentLang === 'en';
  const selectedLangObj = LANGUAGES.find((l) => l.code === currentLang) || (isDefaultSelected ? LANGUAGES[0] : LANGUAGES[1]);
  const popularLanguages = LANGUAGES.filter((l) => l.popular);

  const renderModal = () => {
    if (!isOpen || !isMounted || typeof document === 'undefined') return null;

    return createPortal(
      <div
        className="notranslate fixed inset-0 z-[999999] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-hidden"
        translate="no"
      >
        {/* Darkened Backdrop */}
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
          onClick={() => setIsOpen(false)}
        />

        {/* Bottom Sheet / Modal Dialog */}
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Language Selector"
          className="relative w-full max-w-lg bg-white dark:bg-zinc-950 rounded-t-[28px] sm:rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[580px] z-10 animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-200"
        >
          {/* Mobile Drag Pill */}
          <div className="sm:hidden w-full flex items-center justify-center pt-2.5 pb-1">
            <div className="w-12 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
          </div>

          {/* Header */}
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/70 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shadow-xs">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  Select Language <span className="text-xs font-normal text-zinc-400">/ زبان منتخب کریں</span>
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  135+ Worldwide Languages Supported
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              aria-label="Close Language Selector"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Top Feature Card: Default (Original Website / اصل ویب سائٹ) */}
          <div className="p-3.5 border-b border-zinc-200 dark:border-zinc-800 bg-emerald-50/50 dark:bg-emerald-950/20">
            <button
              type="button"
              translate="no"
              onClick={() => handleSelectLanguage('default')}
              className={`notranslate w-full flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
                isDefaultSelected
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-500/30'
                  : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white hover:border-emerald-500 hover:shadow-xs'
              }`}
            >
              <div className="flex items-center gap-3 text-left">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  isDefaultSelected ? 'bg-white/20 text-white' : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                }`}>
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-bold">Default (Original Website)</span>
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                      isDefaultSelected ? 'bg-white text-emerald-800' : 'bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200'
                    }`}>
                      اصل ویب سائٹ
                    </span>
                  </div>
                  <p className={`text-[11px] mt-0.5 ${isDefaultSelected ? 'text-emerald-100' : 'text-zinc-500 dark:text-zinc-400'}`}>
                    Show authentic website in English (No translation delay)
                  </p>
                </div>
              </div>
              {isDefaultSelected ? (
                <div className="w-6 h-6 rounded-full bg-white text-emerald-700 flex items-center justify-center shrink-0 shadow-xs font-bold">
                  <Check className="w-3.5 h-3.5" />
                </div>
              ) : (
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline">
                  Select
                </span>
              )}
            </button>
          </div>

          {/* Quick Popular Languages Pills */}
          <div className="p-3.5 border-b border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/30 space-y-2">
            <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Popular Languages
            </span>

            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {popularLanguages.map((lang) => {
                const isSelected = lang.code === currentLang || (lang.code === 'default' && isDefaultSelected);
                return (
                  <button
                    key={lang.code}
                    type="button"
                    translate="no"
                    onClick={() => handleSelectLanguage(lang.code)}
                    className={`notranslate px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-sm scale-105'
                        : 'bg-zinc-200/80 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {lang.nativeName}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search Input */}
          <div className="p-3.5 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 pointer-events-none" />
              <input
                type="text"
                translate="no"
                placeholder="Search 135+ languages (e.g. Urdu, Arabic, Deutsch, Bengali)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="notranslate w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-emerald-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 p-1 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Languages List */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-1 max-h-60 sm:max-h-72 custom-scrollbar">
            {filteredLanguages.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-500">
                No matching languages found
              </div>
            ) : (
              filteredLanguages.map((lang) => {
                const isSelected = lang.code === currentLang || (lang.code === 'default' && isDefaultSelected);
                return (
                  <button
                    key={lang.code}
                    type="button"
                    translate="no"
                    onClick={() => handleSelectLanguage(lang.code)}
                    className={`notranslate w-full min-h-[46px] flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-300 dark:border-emerald-800'
                        : 'text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3 text-left">
                      <span className="w-8 text-[10px] font-mono text-zinc-400 dark:text-zinc-500 uppercase">
                        {lang.code === 'default' ? 'DEF' : lang.code}
                      </span>
                      <div>
                        <span className="font-semibold">{lang.name}</span>
                        <span className="ml-2 text-zinc-500 dark:text-zinc-400 font-normal">
                          ({lang.nativeName})
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer & Safe Area */}
          <div className="p-3 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-500 text-center flex items-center justify-center gap-2 pb-safe">
            <Globe className="w-3.5 h-3.5 text-emerald-500" />
            <span>Google AI Cloud Multilingual Translation (135+ Languages)</span>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  return (
    <div className="notranslate relative inline-block text-left" ref={dropdownRef} translate="no">
      {/* Trigger Button Variants */}
      {variant === 'pill' ? (
        <button
          type="button"
          translate="no"
          onClick={() => setIsOpen(true)}
          className="notranslate flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-all shadow-xs cursor-pointer text-xs font-bold"
          title="Select Language / زبان منتخب کریں"
        >
          <Globe className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span className="font-semibold">{isDefaultSelected ? 'Original (English)' : selectedLangObj.nativeName}</span>
          <span className="text-[10px] opacity-70 uppercase font-mono">({isDefaultSelected ? 'EN' : selectedLangObj.code})</span>
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      ) : variant === 'full' ? (
        <button
          type="button"
          translate="no"
          onClick={() => setIsOpen(true)}
          className="notranslate w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 hover:border-emerald-500 transition-all cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-700 dark:text-emerald-300">
              <Globe className="w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="text-xs font-bold text-zinc-900 dark:text-white">
                {isDefaultSelected ? 'Original Website (English / اصل ویب سائٹ)' : `${selectedLangObj.nativeName} (${selectedLangObj.name})`}
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                135+ Languages Available • Tap to Change
              </p>
            </div>
          </div>
          <ChevronDown className="w-4 h-4 text-zinc-400" />
        </button>
      ) : variant === 'bottom-bar' ? (
        <button
          type="button"
          translate="no"
          onClick={() => setIsOpen(true)}
          className="notranslate flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900/90 dark:bg-zinc-100/95 text-white dark:text-zinc-900 text-xs font-bold shadow-lg border border-zinc-700 dark:border-zinc-300 cursor-pointer hover:scale-105 transition-all"
          title="Change Language / زبان تبدیل کریں"
        >
          <Globe className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-600" />
          <span>{isDefaultSelected ? 'Original (EN)' : selectedLangObj.nativeName}</span>
        </button>
      ) : (
        <button
          type="button"
          translate="no"
          onClick={() => setIsOpen(true)}
          className="notranslate flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-emerald-300/80 dark:border-emerald-700/60 bg-emerald-50/90 dark:bg-emerald-950/70 hover:bg-emerald-100 dark:hover:bg-emerald-900/80 text-emerald-900 dark:text-emerald-200 text-xs font-semibold transition-all shadow-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
          title="Change Language / زبان منتخب کریں"
          aria-label="Language Selector"
        >
          <Globe className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="hidden sm:inline font-medium">{isDefaultSelected ? 'Original (EN)' : selectedLangObj.nativeName}</span>
          <span className="sm:hidden uppercase font-bold text-[11px]">{isDefaultSelected ? 'EN' : selectedLangObj.code}</span>
          <ChevronDown className="w-3 h-3 text-emerald-600 dark:text-emerald-400 transition-transform" />
        </button>
      )}

      {/* Render Portal Modal directly to document.body */}
      {renderModal()}
    </div>
  );
};

export default LanguageSelector;

