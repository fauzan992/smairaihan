import React, { useState, useMemo } from 'react';
import { Student, ClassRoom, AttendanceRecord } from '../types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart, Line, Cell, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import {
  Award, TrendingUp, AlertTriangle, CheckCircle2, ShieldAlert, School,
  Calendar, Users, Clock, Filter, ArrowUpRight, Sparkles, FileSpreadsheet, ShieldCheck
} from 'lucide-react';

interface DisciplineAnalysisProps {
  students: Student[];
  classes: ClassRoom[];
  attendanceRecords: AttendanceRecord[];
}

export const DisciplineAnalysis: React.FC<DisciplineAnalysisProps> = ({
  students,
  classes,
  attendanceRecords
}) => {
  const [selectedMonth, setSelectedMonth] = useState<string>('08');
  const [selectedYear, setSelectedYear] = useState<string>('2026');

  const monthsList = [
    { value: '01', label: 'Januari' },
    { value: '02', label: 'Februari' },
    { value: '03', label: 'Maret' },
    { value: '04', label: 'April' },
    { value: '05', label: 'Mei' },
    { value: '06', label: 'Juni' },
    { value: '07', label: 'Juli' },
    { value: '08', label: 'Agustus' },
    { value: '09', label: 'September' },
    { value: '10', label: 'Oktober' },
    { value: '11', label: 'November' },
    { value: '12', label: 'Desember' }
  ];

  // Filter records by selected Month and Year (YYYY-MM) and validate against Master Data Siswa
  const filteredRecords = useMemo(() => {
    const validNisns = new Set(students.map(s => s.nisn));
    const validIds = new Set(students.map(s => s.id));
    const validNames = new Set(students.map(s => (s.name || '').trim().toLowerCase()));
    const targetPrefix = `${selectedYear}-${selectedMonth}`;

    return attendanceRecords.filter(r =>
      r.date.startsWith(targetPrefix) &&
      (validNisns.has(r.nisn) || validIds.has(r.studentId) || (r.studentName && validNames.has(r.studentName.trim().toLowerCase())))
    );
  }, [attendanceRecords, students, selectedMonth, selectedYear]);

  // Compute detailed discipline analytics per class
  const classDisciplineData = useMemo(() => {
    return classes.map(cls => {
      const classStudents = students.filter(s => s.classId === cls.id);
      const studentNisns = new Set(classStudents.map(s => s.nisn));

      const recs = filteredRecords.filter(r => studentNisns.has(r.nisn));

      let countHadir = 0;
      let countLate = 0;
      let countSakit = 0;
      let countIzin = 0;
      let countAlpa = 0;

      recs.forEach(r => {
        if (r.status === 'Hadir') {
          countHadir++;
          // Late if arrived after 07:15
          if (r.time && r.time > '07:15:00') {
            countLate++;
          }
        } else if (r.status === 'Sakit') countSakit++;
        else if (r.status === 'Izin') countIzin++;
        else if (r.status === 'Alpa') countAlpa++;
      });

      const totalLogged = recs.length || 1;
      const attendanceRate = Math.round((countHadir / totalLogged) * 100);
      const onTimeCount = countHadir - countLate;
      const onTimeRate = Math.round((onTimeCount / totalLogged) * 100);
      const lateRate = Math.round((countLate / totalLogged) * 100);
      const alpaRate = Math.round((countAlpa / totalLogged) * 100);

      // Discipline Score (0 - 100): Weighted formula
      // Base attendance = 60%, On-time bonus = 30%, Penalty for Alpa = -10%
      let disciplineScore = Math.round(
        (attendanceRate * 0.6) + (onTimeRate * 0.3) - (alpaRate * 0.2 * 10)
      );
      if (disciplineScore > 100) disciplineScore = 100;
      if (disciplineScore < 0) disciplineScore = 0;

      return {
        classId: cls.id,
        className: cls.name,
        totalStudents: classStudents.length,
        totalLogged: recs.length,
        countHadir,
        countOnTime: onTimeCount,
        countLate,
        countSakit,
        countIzin,
        countAlpa,
        attendanceRate,
        onTimeRate,
        lateRate,
        alpaRate,
        disciplineScore
      };
    });
  }, [classes, students, filteredRecords]);

  // Ranked classes by Discipline Score
  const rankedClasses = useMemo(() => {
    return [...classDisciplineData].sort((a, b) => b.disciplineScore - a.disciplineScore);
  }, [classDisciplineData]);

  // Overall statistics
  const totalSchoolRecordCount = filteredRecords.length;
  const overallDisciplineScore = useMemo(() => {
    if (classDisciplineData.length === 0) return 0;
    const sum = classDisciplineData.reduce((acc, curr) => acc + curr.disciplineScore, 0);
    return Math.round(sum / classDisciplineData.length);
  }, [classDisciplineData]);

  const mostDisciplinedClass = rankedClasses[0];
  const leastDisciplinedClass = rankedClasses[rankedClasses.length - 1];

  // Recharts Radar Chart Data for multi-dimensional comparison
  const radarComparisonData = useMemo(() => {
    return [
      { metric: 'Kehadiran (%)', ...Object.fromEntries(classDisciplineData.map(c => [c.className, c.attendanceRate])) },
      { metric: 'Ketepatan Waktu (%)', ...Object.fromEntries(classDisciplineData.map(c => [c.className, c.onTimeRate])) },
      { metric: 'Bebas Alpa (%)', ...Object.fromEntries(classDisciplineData.map(c => [c.className, Math.max(0, 100 - (c.alpaRate * 2))])) },
      { metric: 'Skor Kedisiplinan', ...Object.fromEntries(classDisciplineData.map(c => [c.className, c.disciplineScore])) },
    ];
  }, [classDisciplineData]);

  const monthName = monthsList.find(m => m.value === selectedMonth)?.label || 'Bulan Ini';

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-slate-900 text-white p-6 rounded-3xl shadow-xl border border-emerald-800 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <span className="px-3 py-1 bg-amber-400 text-slate-950 text-[11px] font-black rounded-full uppercase tracking-wider shadow-xs flex items-center gap-1 w-fit">
              <Award className="w-3.5 h-3.5" /> Modul Analisis Khusus Admin
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Analisis Kedisiplinan Siswa Antar Kelas
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100 max-w-2xl font-medium">
              Komparasi komprehensif tingkat kehadiran, ketepatan waktu scan, serta angka ketidakhadiran siswa antar kelas di SMA Islam Ra'iyatul Husnan.
            </p>
          </div>

          {/* Month & Year Selectors */}
          <div className="bg-emerald-900/90 p-2.5 rounded-2xl border border-emerald-700/80 flex items-center gap-2 shrink-0 self-stretch md:self-auto justify-between">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-amber-300" />
              <span className="text-xs font-bold text-emerald-100">Periode:</span>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-xl border border-emerald-600 focus:outline-none cursor-pointer"
              >
                {monthsList.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-xl border border-emerald-600 focus:outline-none cursor-pointer"
              >
                <option value="2025">2025</option>
                <option value="2026">2026</option>
                <option value="2027">2027</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Highlight Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Skor Kedisiplinan Sekolah */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Skor Kedisiplinan Sekolah</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <h3 className="text-2xl font-black text-emerald-800">{overallDisciplineScore} <span className="text-sm font-bold text-slate-400">/ 100</span></h3>
            <span className="text-xs font-extrabold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-lg">
              {overallDisciplineScore >= 80 ? 'Sangat Baik' : 'Cukup Baik'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium mt-2">
            Rata-rata agregat seluruh kelas ({monthName} {selectedYear})
          </p>
        </div>

        {/* Card 2: Kelas Terdisiplin */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-extrabold text-amber-800 uppercase tracking-wider">Kelas Paling Disiplin</span>
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <h3 className="text-xl font-black text-slate-900">{mostDisciplinedClass?.className || '-'}</h3>
            <span className="text-xs font-extrabold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
              Skor {mostDisciplinedClass?.disciplineScore || 0}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium mt-2">
            Kehadiran {mostDisciplinedClass?.attendanceRate || 0}% • Terlambat {mostDisciplinedClass?.countLate || 0} kali
          </p>
        </div>

        {/* Card 3: Kelas Perlu Perhatian */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-extrabold text-rose-800 uppercase tracking-wider">Perlu Evaluasi Kedisiplinan</span>
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-800 flex items-center justify-center font-bold">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <h3 className="text-xl font-black text-rose-900">{leastDisciplinedClass?.className || '-'}</h3>
            <span className="text-xs font-extrabold text-rose-800 bg-rose-100 px-2 py-0.5 rounded-md">
              Skor {leastDisciplinedClass?.disciplineScore || 0}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium mt-2">
            Alpa {leastDisciplinedClass?.countAlpa || 0} • Terlambat {leastDisciplinedClass?.countLate || 0} kali
          </p>
        </div>

        {/* Card 4: Total Record Presensi */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-extrabold text-blue-800 uppercase tracking-wider">Total Record Diproses</span>
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <h3 className="text-2xl font-black text-slate-900">{totalSchoolRecordCount}</h3>
            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-lg">
              {classes.length} Kelas
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium mt-2">
            Rekam data scan barcode NISN periode ini
          </p>
        </div>
      </div>

      {/* Main Visual Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Perbandingan Tingkat Kehadiran & Ketepatan Waktu per Kelas (ComposedChart) */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="space-y-0.5 border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-700" />
              <span>Tingkat Kehadiran vs Ketepatan Waktu (%)</span>
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">
              Batang hijau menunjukkan persentase hadir, garis oranye menunjukkan persentase tepat waktu (sebelum 07:15)
            </p>
          </div>

          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={classDisciplineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="className" tick={{ fontSize: 11, fill: '#334155', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', borderColor: '#334155', color: '#fff', fontSize: '12px' }}
                  formatter={(value: any, name: any) => [`${value}%`, name === 'attendanceRate' ? 'Kehadiran' : 'Tepat Waktu']}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar dataKey="attendanceRate" name="Kehadiran Total (%)" fill="#047857" radius={[8, 8, 0, 0]} barSize={32} />
                <Line type="monotone" dataKey="onTimeRate" name="Tepat Waktu (%)" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, fill: '#f59e0b' }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Distribusi Ketidakhadiran per Kelas (Sakit, Izin, Alpa) */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="space-y-0.5 border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>Komposisi Ketidakhadiran & Keterlambatan (Frekuensi)</span>
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">
              Perbandingan jumlah kejadian Sakit, Izin, Alpa, dan Terlambat di tiap-tiap kelas
            </p>
          </div>

          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={classDisciplineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="className" tick={{ fontSize: 11, fill: '#334155', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', borderColor: '#334155', color: '#fff', fontSize: '12px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar dataKey="countLate" name="Terlambat" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={16} />
                <Bar dataKey="countSakit" name="Sakit" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={16} />
                <Bar dataKey="countIzin" name="Izin" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={16} />
                <Bar dataKey="countAlpa" name="Alpa" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Leaderboard Peringkat Kedisiplinan Kelas & Table */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" />
              <span>Matriks & Peringkat Kedisiplinan Kelas</span>
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">
              Skor kedisiplinan dihitung berdasarkan bobot tingkat kehadiran (60%), ketepatan waktu (30%), dan penalti alpa (10%).
            </p>
          </div>
          <span className="text-xs font-black text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full">
            SMA Islam Ra'iyatul Husnan
          </span>
        </div>

        {/* Detailed Metrics Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-2xl">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-800 text-white font-extrabold uppercase text-[10px]">
              <tr>
                <th className="p-3 text-center w-12">Rank</th>
                <th className="p-3 min-w-[120px]">Nama Kelas</th>
                <th className="p-3 text-center">Total Siswa</th>
                <th className="p-3 text-center">Hadir</th>
                <th className="p-3 text-center text-amber-300">Tepat Waktu</th>
                <th className="p-3 text-center text-amber-300">Terlambat</th>
                <th className="p-3 text-center text-blue-300">Sakit</th>
                <th className="p-3 text-center text-purple-300">Izin</th>
                <th className="p-3 text-center text-rose-300">Alpa</th>
                <th className="p-3 text-center">Kehadiran (%)</th>
                <th className="p-3 text-center bg-emerald-950 text-amber-300 min-w-[110px]">Skor Disiplin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {rankedClasses.map((row, idx) => (
                <tr key={row.classId} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-3 text-center font-black">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-black ${
                      idx === 0 ? 'bg-amber-400 text-slate-950 shadow-xs' :
                      idx === 1 ? 'bg-slate-300 text-slate-800' :
                      idx === 2 ? 'bg-amber-700 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {idx + 1}
                    </span>
                  </td>
                  <td className="p-3 font-extrabold text-slate-900">{row.className}</td>
                  <td className="p-3 text-center text-slate-600 font-bold">{row.totalStudents}</td>
                  <td className="p-3 text-center font-bold text-emerald-800 bg-emerald-50/50">{row.countHadir}</td>
                  <td className="p-3 text-center font-bold text-emerald-700">{row.countOnTime}</td>
                  <td className="p-3 text-center font-bold text-amber-700 bg-amber-50/50">{row.countLate}</td>
                  <td className="p-3 text-center text-blue-700 font-semibold">{row.countSakit}</td>
                  <td className="p-3 text-center text-purple-700 font-semibold">{row.countIzin}</td>
                  <td className="p-3 text-center text-rose-700 font-extrabold bg-rose-50/50">{row.countAlpa}</td>
                  <td className="p-3 text-center font-black text-slate-900">{row.attendanceRate}%</td>
                  <td className="p-3 text-center bg-emerald-50/80">
                    <div className="flex items-center justify-center gap-1.5">
                      <div className="w-12 bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            row.disciplineScore >= 85 ? 'bg-emerald-600' :
                            row.disciplineScore >= 70 ? 'bg-amber-500' : 'bg-rose-500'
                          }`}
                          style={{ width: `${row.disciplineScore}%` }}
                        />
                      </div>
                      <span className="font-black text-xs text-emerald-900">{row.disciplineScore}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
