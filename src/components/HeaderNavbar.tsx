import React, { useState, useEffect } from 'react';
import { User, UserRole, SchoolSettings } from '../types';
import { School, LogOut, Shield, UserCheck, Heart, RotateCcw, Key, Sparkles, Menu, PanelLeftOpen } from 'lucide-react';
import { SchoolLogo } from './SchoolLogo';
import { apiService } from '../services/apiService';

interface HeaderNavbarProps {
  user: User | null;
  onLogout: () => void;
  onQuickLogin: (role: UserRole, username?: string) => void;
  onResetData: () => void;
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
  schoolSettings?: SchoolSettings;
}

export const HeaderNavbar: React.FC<HeaderNavbarProps> = ({
  user,
  onLogout,
  onQuickLogin,
  onResetData,
  onToggleSidebar,
  isSidebarOpen,
  schoolSettings
}) => {
  const [settings, setSettings] = useState<SchoolSettings | null>(schoolSettings || null);

  useEffect(() => {
    if (schoolSettings) {
      setSettings(schoolSettings);
    } else {
      apiService.getSettings().then(res => {
        if (res.success && res.settings) {
          setSettings(res.settings);
        }
      });
    }

    const handleSettingsEvent = (e: Event) => {
      const customEvent = e as CustomEvent<SchoolSettings>;
      if (customEvent.detail) {
        setSettings(customEvent.detail);
      }
    };

    window.addEventListener('school-settings-updated', handleSettingsEvent);
    return () => {
      window.removeEventListener('school-settings-updated', handleSettingsEvent);
    };
  }, [schoolSettings]);

  const currentDateStr = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const schoolName = settings?.namaSekolah || "SMA ISLAM RA'IYATUL HUSNAN";
  const subSchoolName = settings?.subNamaSekolah || "WRINGIN BONDOWOSO";
  const logoUrl = settings?.logoUrl || "/school-logo.png";

  return (
    <header className="bg-emerald-900 text-white shadow-xl border-b border-emerald-800/80 sticky top-0 z-50 min-h-[64px] flex items-center">
      <div className="w-full px-4 md:px-6 py-2.5 flex flex-wrap justify-between items-center gap-3">
        
        {/* Sidebar Toggle & School Identity Bento Brand */}
        <div className="flex items-center gap-3">
          {user && user.role !== 'wali' && onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className={`p-2.5 rounded-xl transition-all cursor-pointer border flex items-center justify-center shadow-sm font-extrabold text-xs ${
                isSidebarOpen
                  ? 'bg-amber-400 text-slate-950 border-amber-300 hover:bg-amber-300'
                  : 'bg-emerald-950/90 text-amber-300 border-emerald-700/80 hover:bg-emerald-800'
              }`}
              title={isSidebarOpen ? "Tutup Sidebar Menu" : "Buka Sidebar Menu"}
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <SchoolLogo size={42} logoUrl={logoUrl} schoolName={schoolName} subName={subSchoolName} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-sm md:text-base leading-tight tracking-wide text-amber-300 uppercase">
                {schoolName}
              </h1>
              <span className="hidden sm:inline-block px-2 py-0.5 bg-emerald-800 text-emerald-200 text-[9px] font-extrabold uppercase rounded-full border border-emerald-700">
                VERIFIED NISN
              </span>
            </div>
            <p className="text-[11px] text-emerald-200/90 font-medium">Sistem Absensi Digital Barcode NISN • {subSchoolName}</p>
          </div>
        </div>

        {/* Demo Quick Role Switcher Bar */}
        <div className="hidden lg:flex items-center bg-emerald-950/80 p-1 rounded-2xl border border-emerald-700/60 text-xs shadow-inner">
          <span className="text-[10px] text-amber-300 font-extrabold px-3 uppercase tracking-wider flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" /> Demo Role:
          </span>
          <button
            onClick={() => onQuickLogin('admin')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
              user?.role === 'admin'
                ? 'bg-amber-400 text-slate-950 shadow-md font-extrabold scale-105'
                : 'text-emerald-200 hover:text-white hover:bg-emerald-800/50'
            }`}
          >
            🔑 Admin
          </button>
          <button
            onClick={() => onQuickLogin('guru', 'ahmad')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
              user?.role === 'guru'
                ? 'bg-amber-400 text-slate-950 shadow-md font-extrabold scale-105'
                : 'text-emerald-200 hover:text-white hover:bg-emerald-800/50'
            }`}
          >
            👨‍🏫 Guru Kelas
          </button>
          <button
            onClick={() => onQuickLogin('bk', 'rahma')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
              user?.role === 'bk'
                ? 'bg-amber-400 text-slate-950 shadow-md font-extrabold scale-105'
                : 'text-emerald-200 hover:text-white hover:bg-emerald-800/50'
            }`}
          >
            💚 Guru BK
          </button>
          <button
            onClick={() => onQuickLogin('wali', '0061234501')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
              user?.role === 'wali'
                ? 'bg-amber-400 text-slate-950 shadow-md font-extrabold scale-105'
                : 'text-emerald-200 hover:text-white hover:bg-emerald-800/50'
            }`}
          >
            👨‍👩‍👦 Wali Murid
          </button>
        </div>

        {/* User Status / Auth Controls */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 text-xs text-emerald-200 bg-emerald-950/40 px-3 py-1.5 rounded-xl border border-emerald-800/60 font-medium">
            <span className="text-[11px] font-semibold">{currentDateStr}</span>
          </div>

          {user ? (
            <div className="flex items-center gap-2 bg-emerald-950/60 p-1.5 rounded-2xl border border-emerald-800">
              <div className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 font-black flex items-center justify-center text-xs shrink-0 shadow-xs">
                {user.name.charAt(0)}
              </div>
              <div className="text-left hidden sm:block pr-2">
                <span className="text-xs font-extrabold text-white block leading-tight truncate max-w-[120px]">
                  {user.name}
                </span>
                <span className="text-[9px] font-bold text-amber-300 uppercase tracking-widest block">
                  {user.role === 'admin' ? 'Administrator' : user.role === 'bk' ? 'Guru BK' : user.role === 'guru' ? 'Guru' : 'Wali Murid'}
                </span>
              </div>
              <button
                onClick={onLogout}
                className="flex items-center gap-1 px-3 py-1.5 bg-emerald-800 hover:bg-rose-700 text-emerald-100 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer border border-emerald-700"
                title="Keluar dari akun"
              >
                <LogOut className="w-3.5 h-3.5" /> Logout
              </button>
            </div>
          ) : (
            <button
              onClick={() => onQuickLogin('admin')}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl text-xs font-black shadow-md cursor-pointer transition-transform hover:scale-105"
            >
              <Key className="w-4 h-4" /> Login Masuk
            </button>
          )}

          <button
            onClick={onResetData}
            className="p-2 text-emerald-300 hover:text-white hover:bg-emerald-800/80 rounded-xl text-xs transition-colors border border-emerald-800"
            title="Reset Data Demo ke Kondisi Awal"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
