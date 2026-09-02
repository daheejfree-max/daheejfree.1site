'use client';

import React, { useEffect, useRef } from 'react';

declare global {
  interface Window {
    google: unknown;
    googleTranslateElementInit: () => void;
  }
}

export const GoogleTranslateBridge: React.FC = () => {
  const isInitialized = useRef(false);

  useEffect(() => {
    // Aggressively remove Google Translate tooltip & banner elements if injected
    const cleanTooltips = () => {
      const tooltips = document.querySelectorAll('#goog-gt-tt, .goog-te-balloon-frame, .VIpgJd-ZVi9od-ORHb-OEVmcd, .VIpgJd-yAWNEb-L7lbkb');
      tooltips.forEach((el) => {
        el.remove();
      });
      if (document.body && document.body.style.top && document.body.style.top !== '0px') {
        document.body.style.top = '0px';
      }
    };

    const interval = setInterval(cleanTooltips, 500);

    if (isInitialized.current) return;
    
    // Check if script is already added
    const existingScript = document.getElementById('google-translate-script');
    if (existingScript) {
      isInitialized.current = true;
      return () => clearInterval(interval);
    }

    // Initialize callback
    window.googleTranslateElementInit = () => {
      const googleAny = window.google as any;
      if (googleAny && googleAny.translate) {
        new googleAny.translate.TranslateElement(
          { 
            pageLanguage: 'en',
            autoDisplay: false,
            multilanguagePage: true,
          },
          'google_translate_element'
        );
      }
    };

    // Load script
    const script = document.createElement('script');
    script.id = 'google-translate-script';
    script.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    script.async = true;
    document.body.appendChild(script);

    isInitialized.current = true;

    return () => {
      clearInterval(interval);
    };
  }, []);

  return (
    <div 
      id="google_translate_element" 
      className="notranslate opacity-0 pointer-events-none fixed -top-[9999px] left-0 w-px h-px overflow-hidden"
      translate="no"
    />
  );
};
