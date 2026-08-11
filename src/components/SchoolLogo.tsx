import React, { useState, useEffect } from 'react';
import { SchoolSettings } from '../types';
import { apiService } from '../services/apiService';

interface SchoolLogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  showText?: boolean;
  logoUrl?: string;
  schoolName?: string;
  subName?: string;
}

export const SchoolLogo: React.FC<SchoolLogoProps> = ({
  className = '',
  size = 'md',
  showText = false,
  logoUrl: logoUrlProp,
  schoolName: schoolNameProp,
  subName: subNameProp
}) => {
  const [imgError, setImgError] = useState(false);
  const [fetchedSettings, setFetchedSettings] = useState<SchoolSettings | null>(() => {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('app_school_settings');
      if (raw) {
        try { return JSON.parse(raw); } catch { return null; }
      }
    }
    return null;
  });

  useEffect(() => {
    // Always fetch latest settings to keep in sync across devices
    apiService.getSettings().then(res => {
      if (res.success && res.settings) {
        setFetchedSettings(res.settings);
      }
    });

    const handleSettingsEvent = (e: Event) => {
      const customEvent = e as CustomEvent<SchoolSettings>;
      if (customEvent.detail) {
        setFetchedSettings(customEvent.detail);
        setImgError(false);
      }
    };

    window.addEventListener('school-settings-updated', handleSettingsEvent);
    return () => {
      window.removeEventListener('school-settings-updated', handleSettingsEvent);
    };
  }, []);

  const srcImage = logoUrlProp || fetchedSettings?.logoUrl || "/school-logo.png";
  const nameText = schoolNameProp || fetchedSettings?.namaSekolah || "SMA ISLAM RA'IYATUL HUSNAN";
  const subText = subNameProp || fetchedSettings?.subNamaSekolah || "WRINGIN BONDOWOSO";

  useEffect(() => {
    setImgError(false);
  }, [srcImage]);

  let pixelSize = 40;
  if (typeof size === 'number') {
    pixelSize = size;
  } else {
    switch (size) {
      case 'xs': pixelSize = 24; break;
      case 'sm': pixelSize = 32; break;
      case 'md': pixelSize = 40; break;
      case 'lg': pixelSize = 56; break;
      case 'xl': pixelSize = 80; break;
    }
  }

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <div 
        className="relative flex items-center justify-center shrink-0 bg-transparent"
        style={{ width: `${pixelSize}px`, height: `${pixelSize}px` }}
      >
        {!imgError ? (
          <img
            src={srcImage}
            alt={nameText}
            className="w-full h-full object-contain"
            onError={() => setImgError(true)}
          />
        ) : (
          /* SVG Fallback Emblem */
          <svg
            viewBox="0 0 200 200"
            className="w-full h-full"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Heptagon outer shape */}
            <polygon
              points="100,5 168,25 195,85 170,155 100,195 30,155 5,85 32,25"
              fill="#FFF200"
              stroke="#212121"
              strokeWidth="6"
            />
            <polygon
              points="100,12 162,30 187,85 164,148 100,186 36,148 13,85 38,30"
              fill="none"
              stroke="#212121"
              strokeWidth="2"
            />
            {/* Inner turquoise circle */}
            <circle cx="100" cy="100" r="62" fill="#00E5FF" stroke="#212121" strokeWidth="4" />
            {/* Central Shield */}
            <g transform="translate(68, 55)">
              {/* Left side green */}
              <path d="M 0 0 L 34 0 L 34 80 L 17 90 L 0 80 Z" fill="#00A859" stroke="#212121" strokeWidth="2" />
              {/* Right side yellow */}
              <path d="M 34 0 L 64 0 L 64 80 L 34 80 Z" fill="#FFF200" stroke="#212121" strokeWidth="2" />
              {/* SMAI Text */}
              <text x="5" y="16" fontFamily="sans-serif" fontWeight="900" fontSize="13" fill="#000000">SMAI</text>
              {/* Stack of books & pen */}
              <rect x="10" y="32" width="18" height="4" fill="#FFFFFF" stroke="#000" strokeWidth="1" />
              <rect x="8" y="38" width="22" height="4" fill="#FFFFFF" stroke="#000" strokeWidth="1" />
              <rect x="6" y="44" width="25" height="4" fill="#FFFFFF" stroke="#000" strokeWidth="1" />
              {/* Stars on right */}
              <polygon points="49,12 51,17 56,17 52,20 54,25 49,22 44,25 46,20 42,17 47,17" fill="#FFFFFF" stroke="#000" strokeWidth="1" />
              <polygon points="49,30 51,35 56,35 52,38 54,43 49,40 44,43 46,38 42,35 47,35" fill="#FFFFFF" stroke="#000" strokeWidth="1" />
              <polygon points="49,48 51,53 56,53 52,56 54,61 49,58 44,61 46,56 42,53 47,53" fill="#FFFFFF" stroke="#000" strokeWidth="1" />
              <polygon points="49,66 51,71 56,71 52,74 54,79 49,76 44,79 46,74 42,71 47,71" fill="#FFFFFF" stroke="#000" strokeWidth="1" />
              {/* RAIHAN Text */}
              <text x="3" y="74" fontFamily="sans-serif" fontWeight="800" fontSize="8" fill="#000000">RAIHAN</text>
            </g>
          </svg>
        )}
      </div>

      {showText && (
        <div className="flex flex-col min-w-0">
          <span className="font-black text-xs md:text-sm tracking-tight text-slate-900 leading-none uppercase truncate">
            {nameText}
          </span>
          <span className="text-[10px] text-emerald-700 font-bold tracking-wider leading-tight uppercase mt-0.5 truncate">
            {subText}
          </span>
        </div>
      )}
    </div>
  );
};
