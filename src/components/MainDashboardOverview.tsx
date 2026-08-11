import React, { useMemo, useState } from 'react';
import { User, Student, ClassRoom, AttendanceRecord, Teacher } from '../types';
import {
  Users, UserCheck, Clock, Calendar, AlertTriangle, CheckCircle2,
  XCircle, TrendingUp, BarChart3, Activity, ArrowUpRight, ArrowRight,
  Shield, School, FileSpreadsheet, Barcode, Sparkles, AlertCircle, Heart, Building2
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
  onNavigateTab: (tab: 'master' | 'scan' | 'reports' | 'import' | 'settings', subTab?: 'students' | 'teachers' | 'classes' | 'guardians') => void;
}

export const MainDashboardOverview: React.FC<MainDashboardOverviewProps> = ({
  user,
  students,
  teachers,
  classes,
  attendanceRecords,
  onNavigateTab
}) => {
  const [chartViewMode, setChartViewMode] = useState<'trend' | 'classes' | 'donut'>('trend');

  // Current Date string (YYYY-MM-DD)
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Today's records
  const todayRecords = useMemo(() => {
    return attendanceRecords.filter(r => r.date === todayStr);
  }, [attendanceRecords, todayStr]);

  // Today's summary counts
  const todayHadir = useMemo(() => todayRecords.filter(r => r.status === 'Hadir').length, [todayRecords]);
  const todaySakit = useMemo(() => todayRecords.filter(r => r.status === 'Sakit').length, [todayRecords]);
  const todayIzin = useMemo(() => todayRecords.filter(r => r.status === 'Izin').length, [todayRecords]);
  const todayAlpa = useMemo(() => todayRecords.filter(r => r.status === 'Alpa').length, [todayRecords]);
  
  const totalStudents = students.length || 1;
  const todayRecordedCount = todayRecords.length;
  const todayUnrecordedCount = Math.max(0, totalStudents - todayRecordedCount);
  const todayHadirPercentage = Math.round((todayHadir / totalStudents) * 100);

  // Late students today (arrived after 07:15)
  const todayLateStudents = useMemo(() => {
    return todayRecords.filter(r => r.status === 'Hadir' && r.time && r.time > '07:15:00');
  }, [todayRecords]);

  // Recent scan feed today (sorted by time descending)
  const recentActivityFeed = useMemo(() => {
    return [...todayRecords].sort((a, b) => {
      if (a.time === '-') return 1;
      if (b.time === '-') return -1;
      return b.time.localeCompare(a.time);
    }).slice(0, 8);
  }, [todayRecords]);

  // Calculate 30 Days Statistics Data for Charts
  const past30DaysData = useMemo(() => {
    const dayMap = new Map<string, { date: string; displayDate: string; Hadir: number; Sakit: number; Izin: number; Alpa: number; Total: number }>();

    // Generate date sequence for the last 30 days
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateKey = d.toISOString().split('T')[0];
      
      // Indonesian short date format e.g. "04/08"
      const dayNum = String(d.getDate()).padStart(2, '0');
      const monthNum = String(d.getMonth() + 1).padStart(2, '0');
      const displayDate = `${dayNum}/${monthNum}`;

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

    // Populate counts from attendanceRecords
    attendanceRecords.forEach(rec => {
      if (dayMap.has(rec.date)) {
        const item = dayMap.get(rec.date)!;
        if (rec.status === 'Hadir') item.Hadir += 1;
        else if (rec.status === 'Sakit') item.Sakit += 1;
        else if (rec.status === 'Izin') item.Izin += 1;
        else if (rec.status === 'Alpa') item.Alpa += 1;
        item.Total += 1;
      }
    });

    return Array.from(dayMap.values());
  }, [attendanceRecords]);

  // Class Attendance Rate Comparison (BarChart data)
  const classAttendanceRates = useMemo(() => {
    return classes.map(c => {
      const classStudents = students.filter(s => s.classId === c.id);
      const studentNisns = new Set(classStudents.map(s => s.nisn));
      
      const classRecs = attendanceRecords.filter(r => studentNisns.has(r.nisn));
      const hadirCount = classRecs.filter(r => r.status === 'Hadir').length;
      const totalLogged = classRecs.length || 1;
      const rate = Math.round((hadirCount / totalLogged) * 100);

      return {
        className: c.name,
        persentase: rate,
        totalSiswa: classStudents.length,
        hadir: hadirCount
      };
    });
  }, [classes, students, attendanceRecords]);

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

  // Date formatting in Indonesian
  const formattedTodayDate = useMemo(() => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    return new Date().toLocaleDateString('id-ID', options);
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Header Hero Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-850 text-white p-6 rounded-3xl shadow-xl border border-emerald-800/80 relative overflow-hidden">
        {/* Background Decorative Ripples */}
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute right-32 top-0 w-32 h-32 bg-amber-400/10 rounded-full blur-xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 bg-amber-400 text-slate-950 text-[11px] font-black rounded-full uppercase tracking-wider shadow-xs flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> Dashboard Utama
              </span>
              <span className="text-emerald-300 text-xs font-semibold flex items-center gap-1.5 bg-emerald-900/80 px-3 py-1 rounded-full border border-emerald-700/60">
                <Calendar className="w-3.5 h-3.5 text-amber-300" /> {formattedTodayDate}
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Selamat Datang, <span className="text-amber-300">{user.name}</span>!
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100 max-w-2xl font-medium">
              Sistem Informasi & Presensi Digital Barcode NISN SMA Islam Ra'iyatul Husnan. Pantau statistik dan aktivitas kehadiran real-time seluruh siswa.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto pt-2 lg:pt-0">
            <button
              onClick={() => onNavigateTab('scan')}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold rounded-2xl text-xs shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Barcode className="w-4 h-4 text-emerald-950" />
              <span>Scan NISN</span>
            </button>
            {user.role === 'admin' && (
              <button
                onClick={() => onNavigateTab('settings')}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-800 hover:bg-emerald-700 text-white font-extrabold rounded-2xl text-xs border border-emerald-600 shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <Building2 className="w-4 h-4 text-amber-300" />
                <span>Identitas & Presensi Sekolah</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Top KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Siswa */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Total Siswa</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <h3 className="text-2xl font-black text-slate-900">{totalStudents}</h3>
            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
              {classes.length} Kelas
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium mt-2">
            Terdaftar di SMA Islam Ra'iyatul Husnan
          </p>
        </div>

        {/* Card 2: Hadir Hari Ini */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-extrabold text-emerald-800 uppercase tracking-wider">Hadir Hari Ini</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <h3 className="text-2xl font-black text-emerald-800">{todayHadir}</h3>
            <span className={`text-xs font-extrabold px-2.5 py-1 rounded-lg ${
              todayHadirPercentage >= 85 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
            }`}>
              {todayHadirPercentage}% Kehadiran
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium mt-2">
            Dari {totalStudents} total siswa terdaftar
          </p>
        </div>

        {/* Card 3: Sakit & Izin Hari Ini */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-extrabold text-blue-800 uppercase tracking-wider">Sakit & Izin Hari Ini</span>
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <h3 className="text-2xl font-black text-slate-900">{todaySakit + todayIzin}</h3>
            <div className="flex gap-1">
              <span className="text-[11px] font-extrabold text-blue-800 bg-blue-100 px-2 py-0.5 rounded-md">
                {todaySakit} Sakit
              </span>
              <span className="text-[11px] font-extrabold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                {todayIzin} Izin
              </span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 font-medium mt-2">
            Siswa berhalangan dengan keterangan
          </p>
        </div>

        {/* Card 4: Alpa / Belum Presensi */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-extrabold text-rose-800 uppercase tracking-wider">Alpa / Belum Absen</span>
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-800 flex items-center justify-center font-bold">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <h3 className="text-2xl font-black text-rose-800">{todayAlpa + todayUnrecordedCount}</h3>
            <span className="text-[11px] font-extrabold text-rose-800 bg-rose-100 px-2 py-1 rounded-lg">
              {todayAlpa} Alpa • {todayUnrecordedCount} Belum
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium mt-2">
            Siswa belum melalukan scan presensi
          </p>
        </div>
      </div>

      {/* 3. Visual Charts Section: 30-Day Attendance Statistics */}
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
              <span className="text-emerald-800 font-extrabold">Total Record 30 Hari: {attendanceRecords.length} Data</span>
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
              Persentase kehadiran rata-rata per kelas terdaftar di SMA Islam Ra'iyatul Husnan.
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

      {/* 4. Bottom Grid: Real-Time Scan Activity Feed & Class Ranking */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Real-Time Scan Activity Feed */}
        <div className="lg:col-span-2 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Activity className="w-5 h-5 text-emerald-600" />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">Aktivitas Scan Real-Time Hari Ini</h3>
                <p className="text-[11px] text-slate-500 font-medium">Rekaman kehadiran siswa terbaru yang diproses oleh sistem</p>
              </div>
            </div>

            <button
              onClick={() => onNavigateTab('reports')}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
            >
              <span>Lihat Semua</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {recentActivityFeed.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-400">
                Belum ada data scan presensi tercatat untuk hari ini.
              </div>
            ) : (
              recentActivityFeed.map((rec) => (
                <div key={rec.id} className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-100 transition-all">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-emerald-800 text-amber-300 font-black flex items-center justify-center text-xs shrink-0 shadow-xs">
                      {rec.studentName.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-900 truncate">{rec.studentName}</p>
                      <p className="text-[10px] text-slate-500 font-mono">
                        NISN: <span className="font-bold text-slate-700">{rec.nisn}</span> • {rec.className}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-right shrink-0">
                    <div>
                      <span className={`inline-block px-2 py-0.5 rounded-full font-black text-[10px] ${
                        rec.status === 'Hadir' ? 'bg-emerald-100 text-emerald-800' :
                        rec.status === 'Sakit' ? 'bg-blue-100 text-blue-800' :
                        rec.status === 'Izin' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {rec.status}
                      </span>
                      <p className="text-[10px] font-mono text-slate-500 mt-0.5">
                        {rec.time !== '-' ? rec.time : 'Izin/Sakit'}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column (1 Col): Late Arrivals & Quick Highlights */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <div>
              <h3 className="text-sm font-black text-slate-900">Siswa Terlambat Hari Ini</h3>
              <p className="text-[11px] text-slate-500 font-medium">Hadir setelah jam 07:15 WIB</p>
            </div>
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {todayLateStudents.length === 0 ? (
              <div className="p-6 text-center bg-emerald-50/60 rounded-2xl border border-emerald-100 text-xs text-emerald-800 font-bold">
                🎉 Luar biasa! Tidak ada siswa terlambat hari ini. Semua tepat waktu.
              </div>
            ) : (
              todayLateStudents.map(rec => (
                <div key={rec.id} className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-2xl flex items-center justify-between">
                  <div>
                    <p className="text-xs font-extrabold text-amber-950 truncate">{rec.studentName}</p>
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
      </div>
    </div>
  );
};
