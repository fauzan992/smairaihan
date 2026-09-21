import React, { useMemo, useState, useEffect } from 'react';
import { User, Student, ClassRoom, AttendanceRecord, Teacher } from '../types';
import { getTodayWibDate, isTodayRecord, normalizeDateToYMD } from '../utils/studentAuthHelper';
import {
  Users, UserCheck, Clock, Calendar, AlertTriangle, CheckCircle2,
  XCircle, TrendingUp, BarChart3, Activity, ArrowUpRight, ArrowRight,
  Shield, School, FileSpreadsheet, Barcode, Sparkles, AlertCircle, Heart, Building2,
  RefreshCw, Search, Filter, ChevronRight, Check
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';

interface MainDashboardOverviewProps {
  user: User;
  students: Student[];
  teachers: Teacher[];
  classes: ClassRoom[];
  attendanceRecords: AttendanceRecord[];
  onNavigateTab: (tab: 'dashboard' | 'master' | 'discipline' | 'bk' | 'teacherAdmin' | 'scan' | 'reports' | 'import' | 'settings', subTab?: 'students' | 'teachers' | 'classes' | 'guardians') => void;
  onRefreshData?: () => void;
  onOpenScanner?: () => void;
}

export const MainDashboardOverview: React.FC<MainDashboardOverviewProps> = ({
  user,
  students,
  teachers,
  classes,
  attendanceRecords,
  onNavigateTab,
  onRefreshData,
  onOpenScanner
}) => {
  const [chartViewMode, setChartViewMode] = useState<'trend' | 'classes' | 'donut'>('trend');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedTime, setLastRefreshedTime] = useState<string>(() => {
    try {
      return new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(new Date()).replace(/\./g, ':');
    } catch {
      return new Date().toLocaleTimeString('id-ID');
    }
  });

  // Filter attendance records to include valid students in master data (or any record with studentName)
  const validAttendanceRecords = useMemo(() => {
    if (!students || students.length === 0) return attendanceRecords;
    const validNisns = new Set(students.map(s => (s.nisn || '').trim()));
    const validIds = new Set(students.map(s => (s.id || '').trim()));
    const validNames = new Set(students.map(s => (s.name || '').trim().toLowerCase()));
    return attendanceRecords.filter(r =>
      validNisns.has((r.nisn || '').trim()) ||
      validIds.has((r.studentId || '').trim()) ||
      (r.studentName && validNames.has(r.studentName.trim().toLowerCase())) ||
      (r.studentName && r.studentName.trim().length > 0)
    );
  }, [attendanceRecords, students]);

  // Current Date string (YYYY-MM-DD) for Asia/Jakarta (WIB)
  const todayStr = useMemo(() => getTodayWibDate(), []);

  // Compute all available dates in the attendance dataset (sorted newest to oldest)
  const availableDates = useMemo(() => {
    const set = new Set<string>();
    validAttendanceRecords.forEach(r => {
      const norm = normalizeDateToYMD(r.date);
      if (norm) set.add(norm);
      else if (r.date && /^\d{4}-\d{2}-\d{2}$/.test(r.date.trim())) set.add(r.date.trim());
    });
    return Array.from(set).sort().reverse();
  }, [validAttendanceRecords]);

  // Today's records count
  const todayRecordsCount = useMemo(() => {
    return validAttendanceRecords.filter(r => isTodayRecord(r.date)).length;
  }, [validAttendanceRecords]);

  // Latest recorded date from history (if today has no records)
  const latestRecordedDate = useMemo(() => {
    return availableDates[0] || todayStr;
  }, [availableDates, todayStr]);

  const latestRecordsCount = useMemo(() => {
    return validAttendanceRecords.filter(r => {
      const norm = normalizeDateToYMD(r.date);
      return r.date === latestRecordedDate || norm === latestRecordedDate;
    }).length;
  }, [validAttendanceRecords, latestRecordedDate]);

  // Selected date state for the dashboard:
  // Defaults to today if today has records, otherwise defaults to the latest active attendance date
  // so the user immediately sees the recorded student data!
  const [userPickedDate, setUserPickedDate] = useState<boolean>(false);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return todayRecordsCount > 0 ? todayStr : latestRecordedDate;
  });

  // Keep selectedDate updated if attendance data loads later or records arrive for today
  useEffect(() => {
    if (todayRecordsCount > 0 && !userPickedDate) {
      setSelectedDate(todayStr);
    } else if (todayRecordsCount === 0 && !userPickedDate && latestRecordedDate) {
      setSelectedDate(latestRecordedDate);
    }
  }, [todayRecordsCount, todayStr, userPickedDate, latestRecordedDate]);

  // Auto-polling every 15 seconds to fetch fresh attendance records
  useEffect(() => {
    if (!onRefreshData) return;
    const interval = setInterval(() => {
      onRefreshData();
      try {
        setLastRefreshedTime(
          new Intl.DateTimeFormat('id-ID', {
            timeZone: 'Asia/Jakarta',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
          }).format(new Date()).replace(/\./g, ':')
        );
      } catch {}
    }, 15000);
    return () => clearInterval(interval);
  }, [onRefreshData]);

  const handleManualRefresh = async () => {
    if (!onRefreshData || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await onRefreshData();
      setLastRefreshedTime(
        new Intl.DateTimeFormat('id-ID', {
          timeZone: 'Asia/Jakarta',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }).format(new Date()).replace(/\./g, ':')
      );
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  };

  // Selected Date Records matching selectedDate
  const currentRecords = useMemo(() => {
    if (selectedDate === todayStr || isTodayRecord(selectedDate)) {
      return validAttendanceRecords.filter(r => isTodayRecord(r.date));
    }
    return validAttendanceRecords.filter(r => {
      const norm = normalizeDateToYMD(r.date);
      return r.date === selectedDate || norm === selectedDate;
    });
  }, [validAttendanceRecords, selectedDate, todayStr]);

  // Summary counts for current selected date
  const currentHadir = useMemo(() => currentRecords.filter(r => r.status === 'Hadir').length, [currentRecords]);
  const currentSakit = useMemo(() => currentRecords.filter(r => r.status === 'Sakit').length, [currentRecords]);
  const currentIzin = useMemo(() => currentRecords.filter(r => r.status === 'Izin').length, [currentRecords]);
  const currentAlpa = useMemo(() => currentRecords.filter(r => r.status === 'Alpa').length, [currentRecords]);

  const totalStudents = students.length || 1;
  const currentRecordedCount = currentRecords.length;
  const currentUnrecordedCount = Math.max(0, students.length - currentRecordedCount);
  const currentHadirPercentage = students.length > 0 ? Math.round((currentHadir / students.length) * 100) : 0;

  // Late students on selected date (arrived after 07:15)
  const currentLateStudents = useMemo(() => {
    return currentRecords.filter(r => {
      if (r.status !== 'Hadir' || !r.time || r.time === '-') return false;
      return r.time > '07:15:00' || (r.notes && r.notes.toLowerCase().includes('terlambat'));
    });
  }, [currentRecords]);

  const onTimeCount = Math.max(0, currentHadir - currentLateStudents.length);

  // Filters inside Activity Feed
  const [feedSearch, setFeedSearch] = useState('');
  const [feedClassFilter, setFeedClassFilter] = useState('all');
  const [feedStatusFilter, setFeedStatusFilter] = useState('all');

  // Filtered Activity Feed
  const filteredFeedRecords = useMemo(() => {
    return currentRecords.filter(rec => {
      // Search filter
      const q = feedSearch.trim().toLowerCase();
      const matchSearch = !q ||
        rec.studentName.toLowerCase().includes(q) ||
        rec.nisn.includes(q) ||
        (rec.notes && rec.notes.toLowerCase().includes(q));

      // Class filter
      const selectedClassObj = classes.find(c => c.id === feedClassFilter);
      const matchClass = feedClassFilter === 'all' ||
        rec.classId === feedClassFilter ||
        (selectedClassObj && rec.className && rec.className.trim().toLowerCase() === selectedClassObj.name.trim().toLowerCase());

      // Status filter
      let matchStatus = true;
      if (feedStatusFilter === 'terlambat') {
        matchStatus = rec.status === 'Hadir' && (rec.time > '07:15:00' || (rec.notes && rec.notes.toLowerCase().includes('terlambat')));
      } else if (feedStatusFilter !== 'all') {
        matchStatus = rec.status === feedStatusFilter;
      }

      return matchSearch && matchClass && matchStatus;
    }).sort((a, b) => {
      if (a.time === '-') return 1;
      if (b.time === '-') return -1;
      return b.time.localeCompare(a.time);
    });
  }, [currentRecords, feedSearch, feedClassFilter, feedStatusFilter, classes]);

  // Calculate 30 Days Statistics Data for Charts (aligned with WIB date)
  const past30DaysData = useMemo(() => {
    const dayMap = new Map<string, { date: string; displayDate: string; Hadir: number; Sakit: number; Izin: number; Alpa: number; Total: number }>();

    // Generate date sequence for the last 30 days based on Asia/Jakarta
    const wibStr = getTodayWibDate();
    const [wYear, wMonth, wDay] = wibStr.split('-').map(Number);
    for (let i = 29; i >= 0; i--) {
      // Use noon UTC to avoid any daylight savings or timezone day-shift
      const d = new Date(Date.UTC(wYear, wMonth - 1, wDay - i, 12, 0, 0));
      const yStr = d.getUTCFullYear();
      const mStr = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dStr = String(d.getUTCDate()).padStart(2, '0');
      const dateKey = `${yStr}-${mStr}-${dStr}`;
      const displayDate = `${dStr}/${mStr}`;

      dayMap.set(dateKey, {
        date: dateKey,
        displayDate,
        Hadir: 0,
        Sakit: 0,
        Izin: 0,
        Alpa: 0,
        Total: 0
      });
    }

    // Populate counts from validAttendanceRecords
    validAttendanceRecords.forEach(rec => {
      let targetKey = normalizeDateToYMD(rec.date) || rec.date;
      if (!dayMap.has(targetKey) && isTodayRecord(rec.date)) {
        targetKey = wibStr;
      }
      if (dayMap.has(targetKey)) {
        const item = dayMap.get(targetKey)!;
        if (rec.status === 'Hadir') item.Hadir += 1;
        else if (rec.status === 'Sakit') item.Sakit += 1;
        else if (rec.status === 'Izin') item.Izin += 1;
        else if (rec.status === 'Alpa') item.Alpa += 1;
        item.Total += 1;
      }
    });

    return Array.from(dayMap.values());
  }, [validAttendanceRecords]);

  // Class Attendance Rate Comparison (BarChart data)
  const classAttendanceRates = useMemo(() => {
    return classes.map(c => {
      const classStudents = students.filter(s =>
        s.classId === c.id ||
        (s.className && c.name && s.className.trim().toLowerCase() === c.name.trim().toLowerCase())
      );
      const studentNisns = new Set(classStudents.map(s => (s.nisn || '').trim()));

      const classRecs = validAttendanceRecords.filter(r =>
        studentNisns.has((r.nisn || '').trim()) ||
        r.classId === c.id ||
        (r.className && c.name && r.className.trim().toLowerCase() === c.name.trim().toLowerCase())
      );
      const hadirCount = classRecs.filter(r => r.status === 'Hadir').length;
      const totalLogged = classRecs.length || 1;
      const rate = Math.round((hadirCount / totalLogged) * 100);

      return {
        className: c.name,
        persentase: rate,
        totalSiswa: classStudents.length,
        hadir: hadirCount,
        totalLog: classRecs.length
      };
    });
  }, [classes, students, validAttendanceRecords]);

  // 30 Days Status Distribution for Donut Chart
  const statusDistribution30Days = useMemo(() => {
    let sumH = 0, sumS = 0, sumI = 0, sumA = 0;
    past30DaysData.forEach(d => {
      sumH += d.Hadir;
      sumS += d.Sakit;
      sumI += d.Izin;
      sumA += d.Alpa;
    });

    return [
      { name: 'Hadir', value: sumH, color: '#10b981' }, // Emerald
      { name: 'Sakit', value: sumS, color: '#3b82f6' }, // Blue
      { name: 'Izin', value: sumI, color: '#f59e0b' },  // Amber
      { name: 'Alpa', value: sumA, color: '#f43f5e' },  // Rose
    ];
  }, [past30DaysData]);

  // Helper date formatter
  const formatIndonesianDate = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      if (!y || !m || !d) return dateStr;
      const dt = new Date(y, m - 1, d);
      return dt.toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const isViewingToday = selectedDate === todayStr;
  const isViewingLatest = selectedDate === latestRecordedDate && latestRecordedDate !== todayStr;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Header Hero Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-850 text-white p-6 rounded-3xl shadow-xl border border-emerald-800/80 relative overflow-hidden">
        {/* Background Decorative Ripples */}
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute right-32 top-0 w-32 h-32 bg-amber-400/10 rounded-full blur-xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 bg-amber-400 text-slate-950 text-[11px] font-black rounded-full uppercase tracking-wider shadow-xs flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> Dashboard Utama
              </span>
              <span className="text-emerald-300 text-xs font-semibold flex items-center gap-1.5 bg-emerald-900/80 px-3 py-1 rounded-full border border-emerald-700/60">
                <Calendar className="w-3.5 h-3.5 text-amber-300" /> {formatIndonesianDate(todayStr)} (WIB)
              </span>
              <span className="text-[11px] text-emerald-200/90 font-mono bg-emerald-950/60 px-2.5 py-0.5 rounded-lg border border-emerald-800/60 flex items-center gap-1">
                <Clock className="w-3 h-3 text-emerald-400" /> Sinkron: {lastRefreshedTime} WIB
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Selamat Datang, <span className="text-amber-300">{user.name}</span>!
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100 max-w-2xl font-medium">
              Sistem Informasi Presensi Digital Barcode NISN SMA Islam Ra'iyatul Husnan. Pantau statistik dan rekapan kehadiran siswa secara terpadu dan real-time.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto pt-2 lg:pt-0">
            {onRefreshData && (
              <button
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-800/90 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs border border-emerald-600/80 shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                title="Segarkan data presensi terbaru dari server"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-emerald-300 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{isRefreshing ? 'Memuat...' : 'Segarkan Data'}</span>
              </button>
            )}

            <button
              onClick={() => onOpenScanner ? onOpenScanner() : onNavigateTab('scan')}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-2xl text-xs shadow-md transition-all active:scale-95 cursor-pointer border border-amber-300"
            >
              <Barcode className="w-4 h-4 text-emerald-950" />
              <span>Buka Scanner NISN</span>
            </button>

            {user.role === 'admin' && (
              <button
                onClick={() => onNavigateTab('settings')}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-800 hover:bg-emerald-700 text-white font-extrabold rounded-2xl text-xs border border-emerald-600 shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <Building2 className="w-4 h-4 text-amber-300" />
                <span>Pengaturan</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Tanggal Presensi & Filter Toolbar (SOLVES: Data belum terbaca / 0) */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold shrink-0 border border-emerald-100">
              <Calendar className="w-4 h-4 text-emerald-700" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <span>Pantau Presensi Berdasarkan Tanggal</span>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {currentRecords.length} Siswa Terbaca
                </span>
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                Pilih tanggal untuk melihat data siswa yang sudah melakukan scan barcode pada hari tersebut
              </p>
            </div>
          </div>

          {/* Quick Date Switcher Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap w-full md:w-auto">
            {/* Shortcut: Hari Ini */}
            <button
              onClick={() => {
                setUserPickedDate(false);
                setSelectedDate(todayStr);
              }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                isViewingToday
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${todayRecordsCount > 0 ? 'bg-emerald-400' : 'bg-slate-400'}`} />
              <span>Hari Ini</span>
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${isViewingToday ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-200 text-slate-700'}`}>
                {todayRecordsCount}
              </span>
            </button>

            {/* Shortcut: Tanggal Terakhir Presensi (if different from today) */}
            {latestRecordedDate && latestRecordedDate !== todayStr && (
              <button
                onClick={() => {
                  setUserPickedDate(true);
                  setSelectedDate(latestRecordedDate);
                }}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  isViewingLatest
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>Sesi Terakhir ({latestRecordedDate})</span>
                <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${isViewingLatest ? 'bg-emerald-800 text-emerald-100' : 'bg-amber-200/80 text-amber-950'}`}>
                  {latestRecordsCount}
                </span>
              </button>
            )}

            {/* Custom Date Picker */}
            <div className="flex items-center gap-1 bg-slate-100 px-3 py-1 rounded-xl border border-slate-200 text-xs">
              <span className="text-[11px] font-bold text-slate-500">Pilih:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  if (e.target.value) {
                    setUserPickedDate(true);
                    setSelectedDate(e.target.value);
                  }
                }}
                className="bg-transparent text-slate-800 font-bold text-xs focus:outline-none cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Dynamic Context Notice Banner */}
        {isViewingToday && todayRecordsCount === 0 ? (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-xs">
                <p className="font-extrabold text-amber-950">
                  Belum Ada Presensi Barcode untuk Hari Ini ({formatIndonesianDate(todayStr)})
                </p>
                <p className="text-amber-800 text-[11px] mt-0.5">
                  Tersedia <strong>{latestRecordsCount} rekaman presensi siswa</strong> pada sesi tanggal <strong>{formatIndonesianDate(latestRecordedDate)}</strong>. Anda dapat melihat rekapan tersebut atau langsung memindai barcode siswa.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
              {latestRecordedDate !== todayStr && (
                <button
                  onClick={() => setSelectedDate(latestRecordedDate)}
                  className="flex-1 sm:flex-none px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1"
                >
                  <span>Lihat Sesi {latestRecordedDate}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => onOpenScanner ? onOpenScanner() : onNavigateTab('scan')}
                className="flex-1 sm:flex-none px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1"
              >
                <Barcode className="w-3.5 h-3.5" />
                <span>Scan Barcode</span>
              </button>
            </div>
          </div>
        ) : !isViewingToday ? (
          <div className="p-3 bg-emerald-50/80 border border-emerald-200/80 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-emerald-950 text-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Menampilkan rekapan presensi <strong>{formatIndonesianDate(selectedDate)}</strong>: <strong>{currentHadir} Hadir</strong>, <strong>{currentSakit} Sakit</strong>, <strong>{currentIzin} Izin</strong>, <strong>{currentAlpa} Alpa</strong> ({currentRecordedCount} siswa telah terekam).
              </span>
            </div>
            <button
              onClick={() => {
                setUserPickedDate(false);
                setSelectedDate(todayStr);
              }}
              className="px-3 py-1 bg-white hover:bg-emerald-100 text-emerald-800 font-extrabold text-xs rounded-xl border border-emerald-200 transition-all cursor-pointer shrink-0"
            >
              Kembali ke Hari Ini
            </button>
          </div>
        ) : null}
      </div>

      {/* 3. Top KPI Summary Cards (Reflects Selected Date) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Siswa */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Total Siswa Terdaftar</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <h3 className="text-2xl font-black text-slate-900">{students.length}</h3>
            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
              {classes.length} Rombel
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
            <span>Master Data Siswa Aktif</span>
            <button
              onClick={() => onNavigateTab('master', 'students')}
              className="text-emerald-700 font-bold hover:underline cursor-pointer"
            >
              Kelola
            </button>
          </div>
        </div>

        {/* Card 2: Hadir (Selected Date) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-extrabold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
              <span>Hadir</span>
              <span className="text-[10px] font-bold text-slate-500 lowercase">({isViewingToday ? 'hari ini' : selectedDate})</span>
            </span>
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <h3 className="text-2xl font-black text-emerald-800">{currentHadir}</h3>
            <span className={`text-xs font-extrabold px-2.5 py-1 rounded-lg ${
              currentHadirPercentage >= 85 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
            }`}>
              {currentHadirPercentage}% Kehadiran
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium mt-2">
            {onTimeCount} Tepat Waktu • {currentLateStudents.length} Terlambat
          </p>
        </div>

        {/* Card 3: Sakit & Izin */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-extrabold text-blue-800 uppercase tracking-wider flex items-center gap-1">
              <span>Sakit & Izin</span>
              <span className="text-[10px] font-bold text-slate-500 lowercase">({isViewingToday ? 'hari ini' : selectedDate})</span>
            </span>
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <h3 className="text-2xl font-black text-slate-900">{currentSakit + currentIzin}</h3>
            <div className="flex gap-1">
              <span className="text-[11px] font-extrabold text-blue-800 bg-blue-100 px-2 py-0.5 rounded-md">
                {currentSakit} Sakit
              </span>
              <span className="text-[11px] font-extrabold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                {currentIzin} Izin
              </span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 font-medium mt-2">
            Surat dokter & keterangan izin orang tua
          </p>
        </div>

        {/* Card 4: Alpa / Belum Presensi */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-extrabold text-rose-800 uppercase tracking-wider flex items-center gap-1">
              <span>Alpa / Belum Absen</span>
              <span className="text-[10px] font-bold text-slate-500 lowercase">({isViewingToday ? 'hari ini' : selectedDate})</span>
            </span>
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-800 flex items-center justify-center font-bold">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <h3 className="text-2xl font-black text-rose-800">{currentAlpa + currentUnrecordedCount}</h3>
            <span className="text-[11px] font-extrabold text-rose-800 bg-rose-100 px-2 py-1 rounded-lg">
              {currentAlpa} Alpa • {currentUnrecordedCount} Belum
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium mt-2">
            Siswa yang belum ada catatan presensi
          </p>
        </div>
      </div>

      {/* 4. Detailed Attendance Record Roster / Activity Feed for Selected Date */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Student Attendance Roster on Selected Date */}
        <div className="lg:col-span-2 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Activity className="w-5 h-5 text-emerald-600" />
                {isViewingToday && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />}
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <span>Data Siswa yang Sudah Absen</span>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">
                    {filteredFeedRecords.length} / {currentRecords.length} Siswa
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  {formatIndonesianDate(selectedDate)}
                </p>
              </div>
            </div>

            <button
              onClick={() => onNavigateTab('reports')}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer self-end sm:self-auto"
            >
              <span>Laporan Lengkap & Rekap</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Search and Filters inside Feed */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari siswa atau NISN..."
                value={feedSearch}
                onChange={(e) => setFeedSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-emerald-600 transition-all"
              />
            </div>

            <div>
              <select
                value={feedClassFilter}
                onChange={(e) => setFeedClassFilter(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-emerald-600 transition-all cursor-pointer"
              >
                <option value="all">Semua Kelas ({classes.length})</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={feedStatusFilter}
                onChange={(e) => setFeedStatusFilter(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-emerald-600 transition-all cursor-pointer"
              >
                <option value="all">Semua Status</option>
                <option value="Hadir">Hadir ({currentHadir})</option>
                <option value="terlambat">Terlambat ({currentLateStudents.length})</option>
                <option value="Sakit">Sakit ({currentSakit})</option>
                <option value="Izin">Izin ({currentIzin})</option>
                <option value="Alpa">Alpa ({currentAlpa})</option>
              </select>
            </div>
          </div>

          {/* Student List View */}
          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
            {filteredFeedRecords.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-500 space-y-2">
                <p className="font-bold">Tidak ada data presensi yang sesuai dengan filter.</p>
                {isViewingToday && todayRecordsCount === 0 && (
                  <div className="pt-2">
                    <button
                      onClick={() => {
                        setUserPickedDate(true);
                        setSelectedDate(latestRecordedDate);
                      }}
                      className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Buka Data Tanggal Terakhir ({latestRecordedDate})</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              filteredFeedRecords.map((rec) => {
                const isLate = rec.status === 'Hadir' && (rec.time > '07:15:00' || (rec.notes && rec.notes.toLowerCase().includes('terlambat')));
                return (
                  <div
                    key={rec.id}
                    className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100/90 rounded-2xl border border-slate-100 hover:border-slate-200 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl font-black flex items-center justify-center text-xs shrink-0 shadow-xs ${
                        rec.status === 'Hadir' ? 'bg-emerald-800 text-amber-300' :
                        rec.status === 'Sakit' ? 'bg-blue-700 text-white' :
                        rec.status === 'Izin' ? 'bg-amber-600 text-white' : 'bg-rose-700 text-white'
                      }`}>
                        {rec.studentName ? rec.studentName.charAt(0) : '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-black text-slate-900 truncate">{rec.studentName}</p>
                        <p className="text-[10px] text-slate-500 font-mono">
                          NISN: <span className="font-bold text-slate-700">{rec.nisn}</span> • <span className="font-semibold text-emerald-800">{rec.className || '-'}</span>
                          {rec.notes ? ` • ${rec.notes}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 text-right shrink-0">
                      <div>
                        <div className="flex items-center justify-end gap-1">
                          <span className={`inline-block px-2 py-0.5 rounded-full font-black text-[10px] ${
                            rec.status === 'Hadir' ? 'bg-emerald-100 text-emerald-800' :
                            rec.status === 'Sakit' ? 'bg-blue-100 text-blue-800' :
                            rec.status === 'Izin' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {rec.status}
                          </span>
                          {isLate && (
                            <span className="inline-block px-1.5 py-0.5 rounded-md font-extrabold text-[9px] bg-amber-100 text-amber-800 border border-amber-200">
                              Terlambat
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] font-mono text-slate-500 mt-0.5">
                          {rec.time && rec.time !== '-' ? `${rec.time} WIB` : 'Dispensasi/KBM'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column (1 Col): Late Arrivals & Quick Rombel Breakdown */}
        <div className="space-y-6">
          {/* Box 1: Late Arrivals on Selected Date */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600" />
                <div>
                  <h3 className="text-sm font-black text-slate-900">Siswa Terlambat</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Masuk setelah jam 07:15 WIB</p>
                </div>
              </div>
              <span className="text-xs font-black px-2 py-0.5 bg-amber-100 text-amber-800 rounded-lg">
                {currentLateStudents.length} Siswa
              </span>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {currentLateStudents.length === 0 ? (
                <div className="p-4 text-center bg-emerald-50/60 rounded-2xl border border-emerald-100 text-xs text-emerald-800 font-bold">
                  🎉 Luar biasa! Tidak ada siswa terlambat pada tanggal ini.
                </div>
              ) : (
                currentLateStudents.map(rec => (
                  <div key={rec.id} className="p-2.5 bg-amber-50/80 border border-amber-200/80 rounded-2xl flex items-center justify-between text-xs">
                    <div>
                      <p className="font-extrabold text-amber-950 truncate">{rec.studentName}</p>
                      <p className="text-[10px] text-amber-800 font-mono">{rec.className} • Jam: {rec.time}</p>
                    </div>
                    <span className="text-[10px] font-black text-amber-900 bg-amber-200 px-2 py-0.5 rounded-md">
                      Terlambat
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Box 2: Quick Rombel Attendance Status */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <School className="w-5 h-5 text-emerald-700" />
                <div>
                  <h3 className="text-sm font-black text-slate-900">Rekap per Rombel Kelas</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Partisipasi siswa pada tanggal ini</p>
                </div>
              </div>
            </div>

            <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
              {classes.map(c => {
                const classStudents = students.filter(s =>
                  s.classId === c.id ||
                  (s.className && c.name && s.className.trim().toLowerCase() === c.name.trim().toLowerCase())
                );
                const classNisns = new Set(classStudents.map(s => (s.nisn || '').trim()));
                const classAtt = currentRecords.filter(r =>
                  classNisns.has((r.nisn || '').trim()) ||
                  r.classId === c.id ||
                  (r.className && c.name && r.className.trim().toLowerCase() === c.name.trim().toLowerCase())
                );
                const classHadir = classAtt.filter(r => r.status === 'Hadir').length;
                const totalInClass = classStudents.length || 1;
                const pct = Math.round((classHadir / totalInClass) * 100);

                return (
                  <div key={c.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-extrabold text-slate-900">{c.name}</span>
                      <span className="font-bold text-emerald-700">{classHadir} / {classStudents.length} Hadir ({pct}%)</span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-600 h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 5. Visual Charts Section: 30-Day Attendance Statistics */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        {/* Chart Header Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="space-y-0.5">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-700" />
              <span>Statistik Kehadiran Siswa 30 Hari Terakhir</span>
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Grafik rekapitulasi tren kehadiran, ketidakhadiran, dan tingkat partisipasi per kelas.
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl self-stretch sm:self-auto justify-center">
            <button
              onClick={() => setChartViewMode('trend')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                chartViewMode === 'trend'
                  ? 'bg-emerald-800 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tren 30 Hari
            </button>
            <button
              onClick={() => setChartViewMode('classes')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                chartViewMode === 'classes'
                  ? 'bg-emerald-800 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Per Kelas (%)
            </button>
            <button
              onClick={() => setChartViewMode('donut')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                chartViewMode === 'donut'
                  ? 'bg-emerald-800 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Komposisi
            </button>
          </div>
        </div>

        {/* View Mode 1: 30-Day Area Chart */}
        {chartViewMode === 'trend' && (
          <div className="space-y-3">
            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={past30DaysData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorHadir" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                    </linearGradient>
                    <linearGradient id="colorSakit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0}/>
                    </linearGradient>
                    <linearGradient id="colorIzin" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0}/>
                    </linearGradient>
                    <linearGradient id="colorAlpa" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="displayDate" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', borderColor: '#334155', color: '#fff', fontSize: '12px' }}
                    itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                    labelStyle={{ color: '#fbbf24', fontWeight: 'black', marginBottom: '4px' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Area type="monotone" dataKey="Hadir" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorHadir)" />
                  <Area type="monotone" dataKey="Sakit" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorSakit)" />
                  <Area type="monotone" dataKey="Izin" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorIzin)" />
                  <Area type="monotone" dataKey="Alpa" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#colorAlpa)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 font-semibold border-t border-slate-100">
              <span>* Data dihimpun dari rekaman scan barcode NISN harian</span>
              <span className="text-emerald-800 font-extrabold">Total Record Terbaca: {validAttendanceRecords.length} Data</span>
            </div>
          </div>
        )}

        {/* View Mode 2: Per Class Attendance Rate (Bar Chart) */}
        {chartViewMode === 'classes' && (
          <div className="space-y-3">
            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={classAttendanceRates} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="className" tick={{ fontSize: 11, fill: '#334155', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} unit="%" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', borderColor: '#334155', color: '#fff', fontSize: '12px' }}
                    formatter={(value: any) => [`${value}%`, 'Tingkat Kehadiran']}
                  />
                  <Bar dataKey="persentase" fill="#047857" radius={[8, 8, 0, 0]} barSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] text-slate-500 text-center font-medium">
              Persentase kehadiran rata-rata per rombel kelas terdaftar di SMA Islam Ra'iyatul Husnan.
            </p>
          </div>
        )}

        {/* View Mode 3: Status Distribution (Donut Chart) */}
        {chartViewMode === 'donut' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusDistribution30Days}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {statusDistribution30Days.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2.5">
              <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                Rincian Status 30 Hari Terakhir
              </h4>
              {statusDistribution30Days.map(item => (
                <div key={item.name} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-xs font-bold text-slate-800">{item.name}</span>
                  </div>
                  <span className="text-xs font-black text-slate-900">{item.value} Record</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
