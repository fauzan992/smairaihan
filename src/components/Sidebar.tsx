import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { SchoolLogo } from './SchoolLogo';
import {
  School, QrCode, FileSpreadsheet, Upload, Users, GraduationCap,
  ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen, X, Shield,
  Sparkles, CheckCircle2, UserCheck, LayoutDashboard, Heart, Settings, Clock, Database, Award, HeartHandshake, Building2, BookOpen
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  user: User | null;
  activeTab: 'dashboard' | 'master' | 'discipline' | 'bk' | 'teacherAdmin' | 'scan' | 'reports' | 'import' | 'settings';
  onSelectTab: (tab: 'dashboard' | 'master' | 'discipline' | 'bk' | 'teacherAdmin' | 'scan' | 'reports' | 'import' | 'settings', subTab?: 'students' | 'teachers' | 'classes' | 'guardians') => void;
  masterSubTab?: 'students' | 'teachers' | 'classes' | 'guardians';
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onToggle,
  user,
  activeTab,
  onSelectTab,
  masterSubTab = 'students'
}) => {
  const [isMasterExpanded, setIsMasterExpanded] = useState(true);

  if (!user) return null;

  const handleNavClick = (
    tab: 'dashboard' | 'master' | 'discipline' | 'bk' | 'teacherAdmin' | 'scan' | 'reports' | 'import' | 'settings',
    subTab?: 'students' | 'teachers' | 'classes' | 'guardians'
  ) => {
    onSelectTab(tab, subTab);
    if (isOpen) {
      onToggle();
    }
  };

  return (
    <>
      {/* Mobile Backdrop Overlay when sidebar is open */}
      {isOpen && (
        <div
          className="fixed top-[64px] inset-x-0 bottom-0 bg-slate-950/60 backdrop-blur-xs z-30 lg:hidden transition-opacity"
          onClick={onToggle}
        />
      )}

      {/* Slide-out Left Sidebar Container - Positioned below HeaderNavbar (top-[64px]) */}
      <aside
        className={`fixed lg:sticky top-[64px] left-0 z-40 h-[calc(100vh-64px)] bg-emerald-950 text-white flex flex-col border-r border-emerald-800/80 shadow-2xl transition-all duration-300 ease-in-out shrink-0 overflow-y-auto ${
          isOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full border-r-0 pointer-events-none'
        }`}
      >
        {/* Navigation Items List */}
        <nav className="flex-1 p-3 space-y-2 overflow-y-auto">
          {/* Section Label */}
          {isOpen && (
            <div className="px-3 pt-2 pb-1 text-[10px] font-extrabold text-amber-300/80 uppercase tracking-widest">
              Menu Utama
            </div>
          )}

          {/* 0. DASHBOARD UTAMA MENU */}
          <button
            onClick={() => handleNavClick('dashboard')}
            className={`w-full flex items-center gap-3 p-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-emerald-800/90 text-white shadow-md border-l-4 border-amber-400'
                : 'text-emerald-200/90 hover:bg-emerald-900/60 hover:text-white'
            }`}
            title="Dashboard Utama"
          >
            <LayoutDashboard className="w-5 h-5 text-amber-300 shrink-0" />
            {isOpen && <span className="truncate">Dashboard Utama</span>}
          </button>

          {/* 1. DATA MASTER SEKOLAH MENU */}
          {user.role === 'admin' && (
            <div>
              <div
                onClick={() => handleNavClick('master')}
                className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'master'
                    ? 'bg-emerald-800/90 text-white shadow-md border-l-4 border-amber-400'
                    : 'text-emerald-200/90 hover:bg-emerald-900/60 hover:text-white'
                }`}
                title="Data Master Sekolah"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <School className="w-5 h-5 text-amber-300 shrink-0" />
                  {isOpen && <span className="truncate">Data Master Sekolah</span>}
                </div>
                {isOpen && (
                  <span
                    role="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMasterExpanded(!isMasterExpanded);
                    }}
                    className="p-1 hover:bg-emerald-700/50 rounded-lg text-emerald-300 cursor-pointer"
                  >
                    {isMasterExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </span>
                )}
              </div>

              {/* Master Submenu Items */}
              {isOpen && isMasterExpanded && (
                <div className="ml-4 mt-1 pl-3 border-l-2 border-emerald-800/60 space-y-1 animate-in fade-in duration-150">
                  <button
                    onClick={() => handleNavClick('master', 'students')}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-between cursor-pointer ${
                      activeTab === 'master' && masterSubTab === 'students'
                        ? 'bg-amber-400 text-slate-950 font-extrabold shadow-xs'
                        : 'text-emerald-300 hover:text-white hover:bg-emerald-900/40'
                    }`}
                  >
                    <span>🎓 Data Siswa</span>
                  </button>
                  <button
                    onClick={() => handleNavClick('master', 'teachers')}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-between cursor-pointer ${
                      activeTab === 'master' && masterSubTab === 'teachers'
                        ? 'bg-amber-400 text-slate-950 font-extrabold shadow-xs'
                        : 'text-emerald-300 hover:text-white hover:bg-emerald-900/40'
                    }`}
                  >
                    <span>👨‍🏫 Data Guru & Staf</span>
                  </button>
                  <button
                    onClick={() => handleNavClick('master', 'classes')}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-between cursor-pointer ${
                      activeTab === 'master' && masterSubTab === 'classes'
                        ? 'bg-amber-400 text-slate-950 font-extrabold shadow-xs'
                        : 'text-emerald-300 hover:text-white hover:bg-emerald-900/40'
                    }`}
                  >
                    <span>🏫 Data Kelas</span>
                  </button>
                  <button
                    onClick={() => handleNavClick('master', 'guardians')}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-between cursor-pointer ${
                      activeTab === 'master' && masterSubTab === 'guardians'
                        ? 'bg-amber-400 text-slate-950 font-extrabold shadow-xs'
                        : 'text-emerald-300 hover:text-white hover:bg-emerald-900/40'
                    }`}
                  >
                    <span>👨‍👩‍👦 Data Wali Murid</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 1.5. ANALISIS KEDISIPLINAN (ADMIN & BK) */}
          {(user.role === 'admin' || user.role === 'bk') && (
            <button
              onClick={() => handleNavClick('discipline')}
              className={`w-full flex items-center gap-3 p-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'discipline'
                  ? 'bg-emerald-800/90 text-white shadow-md border-l-4 border-amber-400'
                  : 'text-emerald-200/90 hover:bg-emerald-900/60 hover:text-white'
              }`}
              title="Analisis Kedisiplinan"
            >
              <Award className="w-5 h-5 text-amber-300 shrink-0" />
              {isOpen && <span className="truncate">Analisis Kedisiplinan</span>}
            </button>
          )}

          {/* 1.7. ADMINISTRASI KELAS & KBM (GURU, BK & ADMIN) */}
          {(user.role === 'guru' || user.role === 'admin' || user.role === 'bk') && (
            <button
              onClick={() => handleNavClick('teacherAdmin')}
              className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'teacherAdmin'
                  ? 'bg-emerald-800/90 text-white shadow-md border-l-4 border-amber-400'
                  : 'text-emerald-200/90 hover:bg-emerald-900/60 hover:text-white'
              }`}
              title="Administrasi Kelas & KBM"
            >
              <div className="flex items-center gap-3 min-w-0">
                <BookOpen className="w-5 h-5 text-amber-300 shrink-0" />
                {isOpen && <span className="truncate">Administrasi Kelas & KBM</span>}
              </div>
              {isOpen && (
                <span className="text-[9px] bg-amber-400/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded-full font-extrabold uppercase">
                  GURU
                </span>
              )}
            </button>
          )}

          {/* 1.8. LAYANAN BIMBINGAN KONSELING (BK) MENU - KHUSUS GURU BK & ADMIN */}
          {(user.role === 'bk' || user.role === 'admin') && (
            <button
              onClick={() => handleNavClick('bk')}
              className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'bk'
                  ? 'bg-emerald-800/90 text-white shadow-md border-l-4 border-amber-400'
                  : 'text-emerald-200/90 hover:bg-emerald-900/60 hover:text-white'
              }`}
              title="Layanan Bimbingan & Konseling (BK)"
            >
              <div className="flex items-center gap-3 min-w-0">
                <HeartHandshake className="w-5 h-5 text-teal-300 shrink-0" />
                {isOpen && <span className="truncate">Bimbingan Konseling (BK)</span>}
              </div>
              {isOpen && (
                <span className="text-[9px] bg-teal-500/30 text-teal-200 border border-teal-400/30 px-2 py-0.5 rounded-full font-extrabold uppercase">
                  BK
                </span>
              )}
            </button>
          )}

          {/* 2. SCAN QR CODE NISN MENU */}
          <button
            onClick={() => handleNavClick('scan')}
            className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'scan'
                ? 'bg-emerald-800/90 text-white shadow-md border-l-4 border-amber-400'
                : 'text-emerald-200/90 hover:bg-emerald-900/60 hover:text-white'
            }`}
            title="Scan QR Code NISN"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative shrink-0">
                <QrCode className="w-5 h-5 text-emerald-300" />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full animate-ping"></span>
              </div>
              {isOpen && <span className="truncate">Scan QR Code NISN</span>}
            </div>
            {isOpen && (
              <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wider">
                READY
              </span>
            )}
          </button>

          {/* 3. REKAPITULASI LAPORAN EXCEL MENU */}
          <button
            onClick={() => handleNavClick('reports')}
            className={`w-full flex items-center gap-3 p-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'reports'
                ? 'bg-emerald-800/90 text-white shadow-md border-l-4 border-amber-400'
                : 'text-emerald-200/90 hover:bg-emerald-900/60 hover:text-white'
            }`}
            title="Rekapitulasi Laporan (.xlsx)"
          >
            <FileSpreadsheet className="w-5 h-5 text-emerald-300 shrink-0" />
            {isOpen && <span className="truncate">Rekapitulasi Laporan</span>}
          </button>

          {/* 4. DATABASE CONNECTION MENU */}
          {user.role === 'admin' && (
            <button
              onClick={() => handleNavClick('import')}
              className={`w-full flex items-center gap-3 p-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'import'
                  ? 'bg-emerald-800/90 text-white shadow-md border-l-4 border-amber-400'
                  : 'text-emerald-200/90 hover:bg-emerald-900/60 hover:text-white'
              }`}
              title="Database Connection"
            >
              <Database className="w-5 h-5 text-emerald-300 shrink-0" />
              {isOpen && <span className="truncate">Database Connection</span>}
            </button>
          )}

          {/* 5. PENGATURAN IDENTITAS & JAM SEKOLAH MENU */}
          {user.role === 'admin' && (
            <button
              onClick={() => handleNavClick('settings')}
              className={`w-full flex items-center gap-3 p-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-emerald-800/90 text-white shadow-md border-l-4 border-amber-400'
                  : 'text-emerald-200/90 hover:bg-emerald-900/60 hover:text-white'
              }`}
              title="Identitas & Pengaturan Sekolah"
            >
              <Building2 className="w-5 h-5 text-amber-300 shrink-0" />
              {isOpen && <span className="truncate">Identitas & Pengaturan Sekolah</span>}
            </button>
          )}
        </nav>

        {/* Footer User Info Profile Badge */}
        <div className="p-3 border-t border-emerald-800/60 bg-emerald-950/90">
          <div className="flex items-center gap-3 p-2 bg-emerald-900/60 rounded-2xl border border-emerald-800/80">
            <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 font-black flex items-center justify-center text-xs shrink-0 shadow-xs border border-amber-300">
              {user.name.charAt(0)}
            </div>
            {isOpen && (
              <div className="flex-1 overflow-hidden">
                <p className="text-xs font-extrabold truncate text-white">{user.name}</p>
                <p className="text-[10px] text-amber-300 font-semibold uppercase tracking-wider truncate">
                  {user.role === 'admin' ? 'System Administrator' : user.role === 'bk' ? 'Guru BK / Konselor' : user.role === 'guru' ? 'Guru / Wali Kelas' : 'Wali Murid'}
                </p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};
