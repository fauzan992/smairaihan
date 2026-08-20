import React, { useState, useEffect } from 'react';
import { User, Student, AttendanceRecord, SchoolSettings } from '../types';
import { StudentQRCodeCardModal } from './StudentQRCodeCardModal';
import { apiService } from '../services/apiService';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import {
  UserCheck, Clock, AlertTriangle, XCircle, Calendar, ShieldCheck,
  CheckCircle2, Barcode, TrendingUp, ChevronRight, Info, BookOpen,
  DoorOpen, HeartHandshake, Search, Filter, Sparkles, FileText, PhoneCall,
  AlertCircle, Check, RefreshCw
} from 'lucide-react';

interface WaliMuridDashboardProps {
  user: User;
  students: Student[];
  attendanceRecords: AttendanceRecord[];
  onRefreshData?: () => Promise<void> | void;
}

export const WaliMuridDashboard: React.FC<WaliMuridDashboardProps> = ({
  user,
  students,
  attendanceRecords,
  onRefreshData
}) => {
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('2026-08');
  const [activeTab, setActiveTab] = useState<'overview' | 'kbm' | 'history'>('overview');
  const [kbmSearchQuery, setKbmSearchQuery] = useState('');
  const [kbmStatusFilter, setKbmStatusFilter] = useState<'all' | 'problem' | 'hadir' | 'izin_sakit'>('all');
  const [historyPeriodFilter, setHistoryPeriodFilter] = useState<'7' | '30' | 'all'>('7');
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings | null>(null);

  // Formatted last sync time in WIB
  const [lastSyncTime, setLastSyncTime] = useState<string>(() => {
    try {
      return new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date()).replace(/\./g, ':');
    } catch {
      return new Date().toTimeString().substring(0, 8);
    }
  });

  // Fetch school settings on mount
  useEffect(() => {
    apiService.getSettings().then(res => {
      if (res.settings) setSchoolSettings(res.settings);
    }).catch(err => console.warn('Failed to load settings in WaliMuridDashboard:', err));
  }, []);

  // Real-time automatic polling every 4 seconds
  useEffect(() => {
    let isMounted = true;
    const interval = setInterval(async () => {
      try {
        if (onRefreshData) {
          await onRefreshData();
          if (isMounted) {
            try {
              setLastSyncTime(new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date()).replace(/\./g, ':'));
            } catch {
              setLastSyncTime(new Date().toTimeString().substring(0, 8));
            }
          }
        }
      } catch (err) {
        console.warn('Real-time polling attendance error:', err);
      }
    }, 4000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [onRefreshData]);

  // Manual refresh handler
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (onRefreshData) await onRefreshData();
      const settingsRes = await apiService.getSettings();
      if (settingsRes.settings) setSchoolSettings(settingsRes.settings);
      setLastSyncTime(new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date()).replace(/\./g, ':'));
    } catch (e) {
      console.warn('Manual refresh error:', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Helper for current date in YYYY-MM-DD (Asia/Jakarta / WIB)
  const getTodayWibDate = () => {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    } catch {
      const d = new Date();
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  };

  const todayStr = getTodayWibDate();
  const utcTodayStr = new Date().toISOString().split('T')[0];

  // Robust child student record matching
  const childTargetNisn = (user.childNisn || user.nisn || user.username || '').trim();
  const student = students.find(s => 
    (childTargetNisn && s.nisn.trim() === childTargetNisn) ||
    (user.childName && s.name.trim().toLowerCase() === user.childName.trim().toLowerCase()) ||
    (s.id === user.id)
  ) || {
    id: 'std-1',
    nisn: childTargetNisn || '0061234501',
    name: user.childName || (user.name ? user.name.replace(/^Wali\s+(dari\s+)?/i, '') : 'Siswa'),
    className: user.className || 'X MIPA 1',
    parentName: user.name,
    parentPhone: '-',
    gender: 'L' as 'L'
  };

  // All attendance records belonging to this student
  const childRecords = attendanceRecords.filter(r => 
    (r.nisn && r.nisn.trim() === student.nisn.trim()) ||
    (r.studentId && r.studentId === student.id) ||
    (r.studentName && student.name && r.studentName.trim().toLowerCase() === student.name.trim().toLowerCase())
  );

  // Today's records matching WIB or UTC date
  const todayRecords = childRecords.filter(r => r.date === todayStr || r.date === utcTodayStr);

  // Separate Gate Scan (Piket Pos Gerbang) vs KBM (Teacher Subject) records today
  const todayGateRecord = todayRecords.find(r => 
    r.recordedByRole === 'guru_piket' || 
    r.recordedByRole === 'piket' || 
    r.recordedByRole === 'admin' || 
    (!r.notes?.includes('[KBM') && r.recordedByRole !== 'guru_mapel')
  );

  const todayKbmRecords = todayRecords.filter(r => r.notes?.includes('[KBM') || r.recordedByRole === 'guru_mapel');

  // Check if today's gate scan is late (telat)
  const batasMasukLimit = schoolSettings?.batasTerlambat || '07:15';
  const isGateLate = Boolean(
    todayGateRecord && (
      todayGateRecord.notes?.toLowerCase().includes('terlambat') ||
      todayGateRecord.notes?.toLowerCase().includes('telat') ||
      (todayGateRecord.time && todayGateRecord.time !== '-' && todayGateRecord.time.substring(0, 5) > batasMasukLimit)
    )
  );

  // Calculate minutes late if applicable
  let lateMinutes = 0;
  if (isGateLate && todayGateRecord?.time && todayGateRecord.time !== '-') {
    const [recH, recM] = todayGateRecord.time.substring(0, 5).split(':').map(Number);
    const [limH, limM] = batasMasukLimit.split(':').map(Number);
    if (!isNaN(recH) && !isNaN(recM) && !isNaN(limH) && !isNaN(limM)) {
      lateMinutes = Math.max(0, (recH * 60 + recM) - (limH * 60 + limM));
    }
  }

  // All KBM Records across time
  const allKbmRecords = childRecords.filter(r => r.notes?.includes('[KBM') || r.recordedByRole === 'guru_mapel');

  // Helper parser for KBM info
  const parseKbmRecord = (rec: AttendanceRecord) => {
    let subject = 'Mata Pelajaran';
    let cleanNote = rec.notes || '';

    if (rec.notes && rec.notes.includes('[KBM')) {
      const match = rec.notes.match(/\[KBM\s+([^\]]+)\]/);
      if (match && match[1]) {
        subject = match[1];
      }
      cleanNote = rec.notes.replace(/\[KBM\s+[^\]]+\]:?/, '').trim();
    }

    const isPulangAwal = rec.checkOutStatus === 'Bolos / Pulang Awal' || cleanNote.toLowerCase().includes('pulang sebelum waktunya') || cleanNote.toLowerCase().includes('pulang awal');
    const isBolos = cleanNote.toLowerCase().includes('bolos') || cleanNote.toLowerCase().includes('meninggalkan kbm') || cleanNote.toLowerCase().includes('meninggalkan kelas');

    let displayStatus = rec.status as string;
    if (isPulangAwal) displayStatus = 'Pulang Awal';
    if (isBolos) displayStatus = 'Bolos / Meninggalkan Kelas';

    return {
      subject,
      cleanNote,
      isPulangAwal,
      isBolos,
      displayStatus,
      checkOutTime: rec.checkOutTime || '10:15'
    };
  };

  // Check if child has problem records today (Pulang awal / Bolos)
  const todayAlertRecord = todayKbmRecords.find(r => {
    const info = parseKbmRecord(r);
    return info.isPulangAwal || info.isBolos || r.status === 'Alpa';
  });

  // Filter records by selected month
  const monthRecords = childRecords.filter(r => r.date.startsWith(selectedMonth));

  // Attendance stats for selected month
  const hadirCount = monthRecords.filter(r => r.status === 'Hadir').length;
  const izinCount = monthRecords.filter(r => r.status === 'Izin').length;
  const sakitCount = monthRecords.filter(r => r.status === 'Sakit').length;
  const alpaCount = monthRecords.filter(r => r.status === 'Alpa').length;

  // Counts for Pulang Awal & Bolos incidents in KBM
  const pulangAwalMonthCount = monthRecords.filter(r => {
    const info = parseKbmRecord(r);
    return info.isPulangAwal;
  }).length;

  const bolosMonthCount = monthRecords.filter(r => {
    const info = parseKbmRecord(r);
    return info.isBolos;
  }).length;

  const totalDays = monthRecords.length || 1;
  const attendancePercentage = Math.round((hadirCount / totalDays) * 100);

  // Data for Recharts Bar Chart
  const chartData = [
    { name: 'Hadir', count: hadirCount, color: '#059669' },
    { name: 'Izin', count: izinCount, color: '#f59e0b' },
    { name: 'Sakit', count: sakitCount, color: '#2563eb' },
    { name: 'Alpa', count: alpaCount, color: '#e11d48' },
  ];

  // Filtered KBM List for dedicated view
  const filteredKbmRecords = allKbmRecords.filter(rec => {
    const info = parseKbmRecord(rec);
    const matchesQuery = info.subject.toLowerCase().includes(kbmSearchQuery.toLowerCase()) ||
                         rec.recordedBy.toLowerCase().includes(kbmSearchQuery.toLowerCase()) ||
                         info.cleanNote.toLowerCase().includes(kbmSearchQuery.toLowerCase()) ||
                         rec.date.includes(kbmSearchQuery);

    if (!matchesQuery) return false;

    if (kbmStatusFilter === 'problem') {
      return info.isPulangAwal || info.isBolos || rec.status === 'Alpa';
    } else if (kbmStatusFilter === 'hadir') {
      return rec.status === 'Hadir' && !info.isPulangAwal && !info.isBolos;
    } else if (kbmStatusFilter === 'izin_sakit') {
      return rec.status === 'Izin' || rec.status === 'Sakit';
    }

    return true;
  });

  // Calculate cutoff dates for history filter
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

  // Sort history records descending (newest first)
  const sortedChildRecords = [...childRecords].sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date);
    if (dateCompare !== 0) return dateCompare;
    return (b.time || '').localeCompare(a.time || '');
  });

  // Filter history records by 7 days / 30 days / all and search query
  const filteredHistoryRecords = sortedChildRecords.filter(rec => {
    if (historyPeriodFilter === '7' && rec.date < sevenDaysAgoStr) return false;
    if (historyPeriodFilter === '30' && rec.date < thirtyDaysAgoStr) return false;

    if (historySearchQuery.trim()) {
      const q = historySearchQuery.toLowerCase();
      const info = parseKbmRecord(rec);
      const matches = rec.date.includes(q) ||
                      rec.status.toLowerCase().includes(q) ||
                      info.subject.toLowerCase().includes(q) ||
                      (rec.notes || '').toLowerCase().includes(q) ||
                      (rec.recordedBy || '').toLowerCase().includes(q);
      if (!matches) return false;
    }

    return true;
  });

  // Stats for the selected history period
  const historyPeriodHadir = filteredHistoryRecords.filter(r => r.status === 'Hadir').length;
  const historyPeriodIzinSakit = filteredHistoryRecords.filter(r => r.status === 'Izin' || r.status === 'Sakit').length;
  const historyPeriodAlerts = filteredHistoryRecords.filter(r => {
    const info = parseKbmRecord(r);
    return r.status === 'Alpa' || info.isPulangAwal || info.isBolos;
  }).length;

  return (
    <div className="space-y-6">
      {/* Student Profile Bento Header */}
      <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-950 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden border border-emerald-800">
        <div className="absolute -right-8 -bottom-8 w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-16 h-20 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black text-2xl shadow-lg border-2 border-amber-300 shrink-0 overflow-hidden">
              {student.photoUrl ? (
                <img src={student.photoUrl} alt={student.name} className="w-full h-full object-cover" />
              ) : (
                student.name.charAt(0)
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-extrabold text-amber-300 uppercase tracking-widest bg-emerald-950/80 px-3 py-0.5 rounded-full border border-emerald-700/60">
                  DASHBOARD WALI MURID
                </span>
                <span className="text-[10px] text-slate-950 font-extrabold bg-amber-400 px-2.5 py-0.5 rounded-lg">
                  {student.className}
                </span>
              </div>
              <h2 className="text-2xl font-black">{student.name}</h2>
              <p className="text-xs text-emerald-200/90 mt-0.5 font-medium">
                NISN: <span className="font-mono font-bold text-amber-300">{student.nisn}</span> • Orang Tua/Wali:{' '}
                <strong className="text-white">{student.parentName}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowBarcodeModal(true)}
            className="flex items-center gap-2 px-5 py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-2xl shadow-lg transition-transform hover:scale-105 cursor-pointer border border-amber-300 shrink-0"
          >
            <Barcode className="w-4 h-4" /> Lihat Kartu Barcode NISN
          </button>
        </div>
      </div>

      {/* URGENT WARNING BANNER IF CHILD PULANG AWAL OR BOLOS TODAY */}
      {todayAlertRecord && (
        <div className="p-5 bg-gradient-to-r from-amber-500 via-orange-600 to-rose-600 text-white rounded-3xl shadow-lg border border-amber-400 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-white/20 rounded-2xl shrink-0 backdrop-blur-xs">
              <AlertTriangle className="w-7 h-7 text-amber-200 animate-bounce" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider bg-black/30 px-2.5 py-0.5 rounded-full border border-white/20">
                  PERINGATAN DINI KEHADIRAN KELAS
                </span>
                <span className="text-xs font-extrabold bg-white text-slate-900 px-2 py-0.5 rounded-lg">
                  {todayStr}
                </span>
              </div>
              <h3 className="font-black text-base text-white">
                Pemberitahuan Khusus Wali Murid tentang Kehadiran KBM Anak Anda
              </h3>
              <p className="text-xs text-amber-100 font-medium leading-relaxed">
                Anak Anda (<strong>{student.name}</strong>) dicatat oleh Guru Mapel (
                <strong>{todayAlertRecord.recordedBy}</strong>) dengan status{' '}
                <strong className="underline underline-offset-2 bg-black/20 px-1.5 py-0.5 rounded">
                  {parseKbmRecord(todayAlertRecord).displayStatus}
                </strong>{' '}
                pada pelajaran <strong>{parseKbmRecord(todayAlertRecord).subject}</strong>.
                {parseKbmRecord(todayAlertRecord).cleanNote && (
                  <span> Catatan: "{parseKbmRecord(todayAlertRecord).cleanNote}".</span>
                )}
              </p>
              <div className="pt-2 flex items-center gap-3">
                <span className="text-[11px] font-bold text-amber-200 flex items-center gap-1">
                  <PhoneCall className="w-3.5 h-3.5" />
                  Gunakan informasi ini untuk koordinasi bersama Guru Kelas / Bimbingan Konseling (BK).
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Real-Time Pemantauan Harian Bento Banner (Gate Scan vs KBM Teacher Status) */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-600"></span>
            </span>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">Pemantauan Presensi Harian Real-Time</h3>
              <span className="text-[11px] text-slate-500 font-medium">
                Live monitoring otomatis tersinkronisasi • Terakhir diperbarui: <strong className="text-emerald-800 font-mono font-bold">{lastSyncTime} WIB</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 border border-slate-200 transition-colors cursor-pointer disabled:opacity-50"
              title="Segarkan Data Presensi Sekarang"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-600' : 'text-slate-600'}`} />
              <span>{isRefreshing ? 'Menyinkronkan...' : 'Segarkan Data'}</span>
            </button>

            <span className="text-xs font-extrabold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-emerald-700" />
              Hari Ini: {todayStr}
            </span>
          </div>
        </div>

        {/* Dual Grid Card: Gate Barcode vs KBM Subject Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: Gate Barcode Scan */}
          <div className={`p-4 rounded-2xl border transition-all ${
            todayGateRecord
              ? isGateLate
                ? 'border-amber-400 bg-gradient-to-br from-amber-50 to-orange-50/40 shadow-xs'
                : 'border-emerald-300 bg-gradient-to-br from-emerald-50 to-teal-50/40 shadow-xs'
              : 'border-slate-200 bg-slate-50'
          } space-y-3`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-emerald-700" />
                1. Presensi Masuk Gerbang Sekolah (Piket Barcode)
              </span>
              <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-lg border ${
                todayGateRecord
                  ? isGateLate
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                  : 'bg-slate-200 text-slate-700 border-slate-300'
              }`}>
                Pos Piket Gerbang
              </span>
            </div>

            {todayGateRecord ? (
              <div className="space-y-2.5 pt-1">
                <div className="flex items-start gap-3">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
                    todayGateRecord.status === 'Hadir'
                      ? isGateLate
                        ? 'bg-amber-500 text-white border border-amber-400'
                        : 'bg-emerald-600 text-white border border-emerald-500'
                      : todayGateRecord.status === 'Izin'
                      ? 'bg-amber-500 text-white'
                      : todayGateRecord.status === 'Sakit'
                      ? 'bg-blue-600 text-white'
                      : 'bg-rose-600 text-white'
                  }`}>
                    {todayGateRecord.status === 'Hadir' && (
                      isGateLate ? <Clock className="w-6 h-6 text-white" /> : <CheckCircle2 className="w-6 h-6 text-white" />
                    )}
                    {todayGateRecord.status === 'Izin' && <Clock className="w-6 h-6" />}
                    {todayGateRecord.status === 'Sakit' && <AlertTriangle className="w-6 h-6" />}
                    {todayGateRecord.status === 'Alpa' && <XCircle className="w-6 h-6" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-lg text-xs font-black tracking-wide ${
                        todayGateRecord.status === 'Hadir'
                          ? isGateLate
                            ? 'bg-amber-500 text-white shadow-xs'
                            : 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-800 text-white'
                      }`}>
                        {todayGateRecord.status === 'Hadir'
                          ? isGateLate
                            ? 'HADIR (TERLAMBAT)'
                            : 'HADIR (TEPAT WAKTU)'
                          : `STATUS: ${todayGateRecord.status.toUpperCase()}`}
                      </span>
                      <span className="text-xs font-mono font-black text-emerald-950 bg-white/90 border border-slate-200 px-2 py-0.5 rounded-md shadow-2xs">
                        Jam {todayGateRecord.time} WIB
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 font-semibold mt-1.5 leading-snug">
                      {isGateLate ? (
                        <span className="text-amber-950">
                          Siswa telah tiba di sekolah & memindai kartu NISN pada pukul <strong>{todayGateRecord.time} WIB</strong> (Tercatat melewati batas toleransi masuk <strong>{batasMasukLimit} WIB</strong>{lateMinutes > 0 ? `, terlambat ${lateMinutes} menit` : ''}).
                        </span>
                      ) : (
                        <span className="text-emerald-950">
                          Siswa telah berhasil memindai kartu NISN di pos gerbang sekolah dan tiba tepat waktu.
                        </span>
                      )}
                    </p>

                    <div className="mt-2 pt-2 border-t border-slate-200/70 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 font-medium">
                      <span>Petugas Piket: <strong className="text-slate-900">{todayGateRecord.recordedBy || 'Guru Piket Gerbang'}</strong></span>
                      {todayGateRecord.checkOutTime && (
                        <span className="text-emerald-800 font-bold bg-emerald-100/80 px-2 py-0.5 rounded border border-emerald-300">
                          Pulang: {todayGateRecord.checkOutTime} WIB
                        </span>
                      )}
                    </div>

                    {todayGateRecord.notes && (
                      <p className="text-[11px] font-medium text-slate-600 bg-white/70 p-1.5 rounded-lg border border-slate-200/60 mt-1.5">
                        Catatan: "{todayGateRecord.notes}"
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-xl flex items-start gap-2.5 text-xs text-slate-700">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-extrabold text-amber-950">
                    Belum melakukan pindaian barcode di pos piket gerbang hari ini.
                  </p>
                  <p className="text-[11px] text-slate-600 mt-0.5 font-medium">
                    Sistem sedang menunggu kartu barcode NISN siswa dipindai oleh petugas piket saat tiba di pintu gerbang sekolah.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Card 2: Teacher KBM Class Status */}
          <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-amber-600" />
                2. Status Kehadiran KBM di Kelas (Guru Mapel)
              </span>
              <span className="text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded">
                Catatan KBM
              </span>
            </div>

            {todayKbmRecords.length > 0 ? (
              <div className="space-y-2 pt-1">
                {todayKbmRecords.map(kbmRec => {
                  const info = parseKbmRecord(kbmRec);
                  return (
                    <div
                      key={kbmRec.id}
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                        info.isPulangAwal ? 'bg-orange-50 border-orange-300 text-orange-950' :
                        info.isBolos ? 'bg-purple-50 border-purple-300 text-purple-950' :
                        kbmRec.status === 'Hadir' ? 'bg-emerald-50 border-emerald-200 text-emerald-950' :
                        'bg-amber-50 border-amber-200 text-amber-950'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-xs">{info.subject}</span>
                          <span className="text-[10px] font-bold text-slate-500">
                            • Guru: {kbmRec.recordedBy}
                          </span>
                        </div>
                        {info.cleanNote && (
                          <p className="text-[11px] font-medium text-slate-700 mt-0.5">
                            Catatan: {info.cleanNote}
                          </p>
                        )}
                      </div>

                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black shrink-0 ${
                        info.isPulangAwal ? 'bg-orange-600 text-white' :
                        info.isBolos ? 'bg-purple-700 text-white' :
                        kbmRec.status === 'Hadir' ? 'bg-emerald-700 text-white' :
                        'bg-amber-600 text-white'
                      }`}>
                        {info.displayStatus}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-slate-500 pt-2 font-medium">
                <Info className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Belum ada entri presensi KBM dari Guru Mata Pelajaran hari ini.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* NAVIGATION SUB-TABS */}
      <div className="flex border-b border-slate-200 bg-white rounded-2xl p-1.5 shadow-xs gap-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold cursor-pointer transition-all ${
            activeTab === 'overview'
              ? 'bg-emerald-800 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <TrendingUp className="w-4 h-4 text-amber-300" />
          Ringkasan Bulanan
        </button>

        <button
          onClick={() => setActiveTab('kbm')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold cursor-pointer transition-all ${
            activeTab === 'kbm'
              ? 'bg-amber-400 text-slate-950 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <BookOpen className="w-4 h-4 text-emerald-800" />
          Monitoring Absensi Mapel / KBM ({allKbmRecords.length})
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold cursor-pointer transition-all ${
            activeTab === 'history'
              ? 'bg-emerald-800 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-4 h-4 text-amber-300" />
          Log Presensi Lengkap ({childRecords.length})
        </button>
      </div>

      {/* TAB 1: OVERVIEW & MONTHLY CHARTS */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left Stats Cards */}
            <div className="space-y-4">
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Persentase Kehadiran</span>
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black text-emerald-700">{attendancePercentage}%</span>
                  <span className="text-xs text-slate-500 font-bold">Tingkat Kehadiran</span>
                </div>
                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden p-0.5 border border-slate-200">
                  <div
                    className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${attendancePercentage}%` }}
                  ></div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl">
                  <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-widest block">Hadir</span>
                  <span className="text-2xl font-black text-emerald-900">{hadirCount} <span className="text-xs font-bold text-emerald-700">Hari</span></span>
                </div>
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl">
                  <span className="text-[10px] font-extrabold text-amber-800 uppercase tracking-widest block">Izin</span>
                  <span className="text-2xl font-black text-amber-900">{izinCount} <span className="text-xs font-bold text-amber-700">Hari</span></span>
                </div>
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl">
                  <span className="text-[10px] font-extrabold text-blue-800 uppercase tracking-widest block">Sakit</span>
                  <span className="text-2xl font-black text-blue-900">{sakitCount} <span className="text-xs font-bold text-blue-700">Hari</span></span>
                </div>
                <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl">
                  <span className="text-[10px] font-extrabold text-rose-800 uppercase tracking-widest block">Alpa</span>
                  <span className="text-2xl font-black text-rose-900">{alpaCount} <span className="text-xs font-bold text-rose-700">Hari</span></span>
                </div>
              </div>

              {/* Special KBM Alert Incident Stat Box */}
              <div className="bg-slate-900 text-white p-4 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase text-amber-400 tracking-wider flex items-center gap-1">
                    <DoorOpen className="w-3.5 h-3.5 text-amber-300" />
                    Catatan KBM Bulan Ini
                  </span>
                  <span className="text-[10px] bg-amber-400/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded font-bold">
                    Khusus KBM
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700">
                    <span className="text-[10px] font-extrabold text-orange-300 block">Pulang Awal</span>
                    <span className="text-xl font-black text-white">{pulangAwalMonthCount} <span className="text-[10px] font-normal text-slate-400">kali</span></span>
                  </div>

                  <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700">
                    <span className="text-[10px] font-extrabold text-purple-300 block">Bolos KBM</span>
                    <span className="text-xl font-black text-white">{bolosMonthCount} <span className="text-[10px] font-normal text-slate-400">kali</span></span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Chart Box Bento Card */}
            <div className="md:col-span-2 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="font-extrabold text-slate-800 text-sm">Grafik Ringkasan Kehadiran Bulanan</h3>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded-xl text-xs font-bold bg-white"
                >
                  <option value="2026-08">Agustus 2026</option>
                  <option value="2026-07">Juli 2026</option>
                  <option value="2026-06">Juni 2026</option>
                </select>
              </div>

              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 12, fontWeight: 600 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value: any) => [`${value} Hari`, 'Total']}
                      contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DETAILED KBM SUBJECT ATTENDANCE MONITORING */}
      {activeTab === 'kbm' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-amber-500" />
                Pemantauan Kehadiran Mata Pelajaran / Kelas (KBM)
              </h3>
              <p className="text-xs text-slate-500">
                Pencatatan langsung oleh Guru Mata Pelajaran saat jam pelajaran di kelas.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari mapel / guru..."
                  value={kbmSearchQuery}
                  onChange={(e) => setKbmSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 w-48 font-medium"
                />
              </div>

              <select
                value={kbmStatusFilter}
                onChange={(e) => setKbmStatusFilter(e.target.value as any)}
                className="p-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
              >
                <option value="all">Semua Status KBM</option>
                <option value="problem">⚠️ Pulang Awal / Bolos / Alpa</option>
                <option value="hadir">✅ Hadir Kelas</option>
                <option value="izin_sakit">🟡 Izin / Sakit</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-2xl">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100 border-b border-slate-200 font-extrabold uppercase text-[10px] text-slate-600">
                <tr>
                  <th className="p-3.5 w-12 text-center">No</th>
                  <th className="p-3.5">Tanggal & Waktu</th>
                  <th className="p-3.5">Mata Pelajaran</th>
                  <th className="p-3.5">Guru Pengajar</th>
                  <th className="p-3.5">Status Kehadiran KBM</th>
                  <th className="p-3.5">Catatan / Alasan Guru</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredKbmRecords.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-xs text-slate-400">
                      Belum ada catatan kehadiran mata pelajaran yang ditemukan.
                    </td>
                  </tr>
                ) : (
                  filteredKbmRecords.map((rec, idx) => {
                    const info = parseKbmRecord(rec);
                    const isAlert = info.isPulangAwal || info.isBolos || rec.status === 'Alpa';

                    return (
                      <tr
                        key={rec.id}
                        className={`hover:bg-slate-50 transition-colors ${
                          isAlert ? 'bg-amber-50/40' : ''
                        }`}
                      >
                        <td className="p-3.5 text-center font-bold text-slate-400">{idx + 1}</td>
                        <td className="p-3.5">
                          <div className="font-extrabold text-slate-900">{rec.date}</div>
                          <div className="font-mono text-[11px] text-slate-500 font-semibold">{rec.time} WIB</div>
                        </td>
                        <td className="p-3.5">
                          <span className="font-black text-slate-900 text-xs">{info.subject}</span>
                          <span className="text-[10px] font-bold text-slate-500 block">Kelas {rec.className}</span>
                        </td>
                        <td className="p-3.5 font-bold text-slate-800">{rec.recordedBy}</td>
                        <td className="p-3.5">
                          <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black inline-flex items-center gap-1 ${
                            info.isPulangAwal ? 'bg-orange-600 text-white shadow-xs' :
                            info.isBolos ? 'bg-purple-700 text-white shadow-xs' :
                            rec.status === 'Hadir' ? 'bg-emerald-600 text-white shadow-xs' :
                            rec.status === 'Izin' ? 'bg-amber-500 text-white' :
                            rec.status === 'Sakit' ? 'bg-blue-600 text-white' : 'bg-rose-600 text-white'
                          }`}>
                            {info.isPulangAwal && <DoorOpen className="w-3 h-3 text-amber-200" />}
                            {info.isBolos && <AlertCircle className="w-3 h-3 text-amber-200" />}
                            {info.displayStatus}
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-700 font-medium">
                          {info.cleanNote ? (
                            <span className={isAlert ? 'font-semibold text-rose-950' : ''}>
                              {info.cleanNote}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: DETAILED HISTORY LOG TABLE WITH PERIOD FILTER (7 DAYS / 30 DAYS / ALL) */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
          {/* Header & Filter Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-700" />
                Riwayat Log Absensi Detail Siswa
              </h3>
              <p className="text-xs text-slate-500">
                Laporan log presensi gerbang sekolah & kelas anak Anda secara transparan.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Filter Rentang Waktu (7 Hari / 30 Hari / Semua) */}
              <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner">
                <button
                  type="button"
                  onClick={() => setHistoryPeriodFilter('7')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer transition-all ${
                    historyPeriodFilter === '7'
                      ? 'bg-emerald-800 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                  }`}
                >
                  📅 7 Hari Terakhir
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryPeriodFilter('30')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer transition-all ${
                    historyPeriodFilter === '30'
                      ? 'bg-emerald-800 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                  }`}
                >
                  📅 30 Hari Terakhir
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryPeriodFilter('all')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer transition-all ${
                    historyPeriodFilter === 'all'
                      ? 'bg-emerald-800 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                  }`}
                >
                  🌐 Semua
                </button>
              </div>

              {/* Search Box */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari tanggal / status / catatan..."
                  value={historySearchQuery}
                  onChange={(e) => setHistorySearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 w-52 font-medium"
                />
              </div>
            </div>
          </div>

          {/* Period Summary Mini Dashboard Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">
                Total Entri Log ({historyPeriodFilter === '7' ? '7 Hari' : historyPeriodFilter === '30' ? '30 Hari' : 'Semua'})
              </span>
              <span className="text-xl font-black text-slate-900">
                {filteredHistoryRecords.length} <span className="text-xs font-bold text-slate-500">Record</span>
              </span>
            </div>

            <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-2xl space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 block">
                Total Hadir
              </span>
              <span className="text-xl font-black text-emerald-900">
                {historyPeriodHadir} <span className="text-xs font-bold text-emerald-700">Kali</span>
              </span>
            </div>

            <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-2xl space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 block">
                Izin / Sakit
              </span>
              <span className="text-xl font-black text-amber-900">
                {historyPeriodIzinSakit} <span className="text-xs font-bold text-amber-700">Kali</span>
              </span>
            </div>

            <div className="p-3.5 bg-rose-50/80 border border-rose-200 rounded-2xl space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-800 block">
                Alpa / Catatan Khusus
              </span>
              <span className="text-xl font-black text-rose-900">
                {historyPeriodAlerts} <span className="text-xs font-bold text-rose-700">Kejadian</span>
              </span>
            </div>
          </div>

          {/* Detailed Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-2xl">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100 border-b border-slate-200 font-extrabold uppercase text-[10px] text-slate-600">
                <tr>
                  <th className="p-3.5 w-12 text-center">No</th>
                  <th className="p-3.5">Tanggal & Waktu</th>
                  <th className="p-3.5">Kategori Presensi</th>
                  <th className="p-3.5">Status Kehadiran</th>
                  <th className="p-3.5">Keterangan / Catatan</th>
                  <th className="p-3.5">Petugas / Guru</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredHistoryRecords.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-xs text-slate-400">
                      Tidak ditemukan riwayat absensi pada rentang waktu yang dipilih.
                    </td>
                  </tr>
                ) : (
                  filteredHistoryRecords.map((rec, idx) => {
                    const isKbm = rec.notes?.includes('[KBM') || rec.recordedByRole === 'guru_mapel';
                    const info = parseKbmRecord(rec);

                    return (
                      <tr key={rec.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3.5 text-center font-bold text-slate-400">{idx + 1}</td>
                        <td className="p-3.5">
                          <div className="font-extrabold text-slate-900">{rec.date}</div>
                          <div className="font-mono text-[11px] text-slate-500 font-semibold">{rec.time} WIB</div>
                        </td>
                        <td className="p-3.5">
                          {isKbm ? (
                            <div>
                              <span className="font-extrabold text-slate-900 text-xs flex items-center gap-1">
                                <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                                KBM: {info.subject}
                              </span>
                              <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 inline-block mt-0.5">
                                Presensi Kelas
                              </span>
                            </div>
                          ) : (
                            <div>
                              <span className="font-extrabold text-slate-900 text-xs flex items-center gap-1">
                                <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                                Pos Piket Gerbang
                              </span>
                              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 inline-block mt-0.5">
                                Barcode Gate Scan
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="p-3.5">
                          <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black inline-flex items-center gap-1 ${
                            info.isPulangAwal ? 'bg-orange-600 text-white' :
                            info.isBolos ? 'bg-purple-700 text-white' :
                            rec.status === 'Hadir' ? 'bg-emerald-600 text-white' :
                            rec.status === 'Izin' ? 'bg-amber-500 text-white' :
                            rec.status === 'Sakit' ? 'bg-blue-600 text-white' : 'bg-rose-600 text-white'
                          }`}>
                            {info.displayStatus}
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-700 font-medium">
                          {info.cleanNote ? (
                            <span>{info.cleanNote}</span>
                          ) : (
                            <span className="text-slate-400 italic">-</span>
                          )}
                        </td>
                        <td className="p-3.5 font-bold text-slate-800">{rec.recordedBy}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Barcode Printable Card Modal */}
      {showBarcodeModal && (
        <StudentQRCodeCardModal
          student={student}
          onClose={() => setShowBarcodeModal(false)}
        />
      )}
    </div>
  );
};

