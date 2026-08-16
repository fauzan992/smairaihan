import React, { useState, useMemo, useEffect } from 'react';
import { Student, ClassRoom, AttendanceRecord, SchoolSettings } from '../types';
import { exportMonthlyRecapToExcel } from '../utils/excelHelper';
import { apiService } from '../services/apiService';
import {
  Calendar, Download, School, Printer, Info, Sparkles
} from 'lucide-react';

interface MonthlyAttendanceReportProps {
  students: Student[];
  classes: ClassRoom[];
  attendanceRecords: AttendanceRecord[];
  schoolSettings?: SchoolSettings;
}

export const MonthlyAttendanceReport: React.FC<MonthlyAttendanceReportProps> = ({
  students,
  classes,
  attendanceRecords,
  schoolSettings: initialSchoolSettings
}) => {
  const currentDate = new Date();
  const defaultMonth = String(currentDate.getMonth() + 1).padStart(2, '0');
  const defaultYear = String(currentDate.getFullYear());

  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>(defaultMonth);
  const [selectedYear, setSelectedYear] = useState<string>(defaultYear);

  const [settings, setSettings] = useState<SchoolSettings | null>(initialSchoolSettings || null);

  useEffect(() => {
    if (initialSchoolSettings) {
      setSettings(initialSchoolSettings);
    } else {
      apiService.getSettings().then(res => {
        if (res.success && res.settings) {
          setSettings(res.settings);
        }
      });
    }

    const handleSettingsUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<SchoolSettings>;
      if (customEvent.detail) {
        setSettings(customEvent.detail);
      }
    };
    window.addEventListener('school_settings_updated', handleSettingsUpdated);
    window.addEventListener('school-settings-updated', handleSettingsUpdated);
    return () => {
      window.removeEventListener('school_settings_updated', handleSettingsUpdated);
      window.removeEventListener('school-settings-updated', handleSettingsUpdated);
    };
  }, [initialSchoolSettings]);

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
    { value: '12', label: 'Desember' },
  ];

  const yearOptions = ['2024', '2025', '2026', '2027'];

  // Calculate total days in selected month and year
  const totalDays = useMemo(() => {
    const y = parseInt(selectedYear, 10) || currentDate.getFullYear();
    const m = parseInt(selectedMonth, 10) || (currentDate.getMonth() + 1);
    return new Date(y, m, 0).getDate();
  }, [selectedMonth, selectedYear]);

  // Holiday map for every single day in the selected month
  const dayHolidaysMap = useMemo(() => {
    const map: Record<number, { isHoliday: boolean; name: string; isCustom: boolean; isRoutine: boolean; dayName: string; fullDayName: string }> = {};
    const y = parseInt(selectedYear, 10) || currentDate.getFullYear();
    const m = parseInt(selectedMonth, 10) || (currentDate.getMonth() + 1);

    const routineHolidays = settings?.hariLiburRutin ?? [0]; // default: Sunday
    const customHolidays = settings?.hariLiburKhusus ?? [];

    const indonesianShortDays = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const indonesianFullDays = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

    for (let day = 1; day <= totalDays; day++) {
      const dayStr = String(day).padStart(2, '0');
      const dateStr = `${selectedYear}-${selectedMonth}-${dayStr}`;
      const dateObj = new Date(y, m - 1, day);
      const dayOfWeek = dateObj.getDay();

      const customMatch = customHolidays.find(h => h.date === dateStr);
      const isRoutine = routineHolidays.includes(dayOfWeek);

      if (customMatch) {
        map[day] = {
          isHoliday: true,
          name: customMatch.name || 'Hari Libur Khusus Sistem',
          isCustom: true,
          isRoutine,
          dayName: indonesianShortDays[dayOfWeek],
          fullDayName: indonesianFullDays[dayOfWeek]
        };
      } else if (isRoutine) {
        map[day] = {
          isHoliday: true,
          name: `Libur Rutin (${indonesianFullDays[dayOfWeek]})`,
          isCustom: false,
          isRoutine: true,
          dayName: indonesianShortDays[dayOfWeek],
          fullDayName: indonesianFullDays[dayOfWeek]
        };
      } else {
        map[day] = {
          isHoliday: false,
          name: '',
          isCustom: false,
          isRoutine: false,
          dayName: indonesianShortDays[dayOfWeek],
          fullDayName: indonesianFullDays[dayOfWeek]
        };
      }
    }
    return map;
  }, [totalDays, selectedYear, selectedMonth, settings]);

  // List of all holidays in current selected month for the summary banner
  const activeMonthHolidays = useMemo(() => {
    const list: Array<{ day: number; dateStr: string; name: string; isCustom: boolean; dayName: string }> = [];
    for (let day = 1; day <= totalDays; day++) {
      const hol = dayHolidaysMap[day];
      if (hol && hol.isHoliday) {
        const dayStr = String(day).padStart(2, '0');
        list.push({
          day,
          dateStr: `${dayStr}/${selectedMonth}/${selectedYear}`,
          name: hol.name,
          isCustom: hol.isCustom,
          dayName: hol.fullDayName
        });
      }
    }
    return list;
  }, [dayHolidaysMap, totalDays, selectedMonth, selectedYear]);

  // Filter students by class
  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      return selectedClassId === 'all' || student.classId === selectedClassId;
    }).sort((a, b) => a.name.localeCompare(b.name, 'id', { sensitivity: 'base' }));
  }, [students, selectedClassId]);

  // Create fast map of attendance records: key = `${nisn}_${YYYY-MM-DD}`
  const attendanceMap = useMemo(() => {
    const map = new Map<string, string>();
    attendanceRecords.forEach(rec => {
      map.set(`${rec.nisn}_${rec.date}`, rec.status);
    });
    return map;
  }, [attendanceRecords]);

  // Process matrix data for each student
  const monthlyData = useMemo(() => {
    return filteredStudents.map((student, idx) => {
      const dayStatuses: Record<number, string> = {};
      let countH = 0;
      let countS = 0;
      let countI = 0;
      let countA = 0;

      for (let day = 1; day <= totalDays; day++) {
        const dayStr = String(day).padStart(2, '0');
        const dateStr = `${selectedYear}-${selectedMonth}-${dayStr}`;
        const key = `${student.nisn}_${dateStr}`;
        const status = attendanceMap.get(key);

        if (status) {
          dayStatuses[day] = status;
          if (status === 'Hadir') countH++;
          else if (status === 'Sakit') countS++;
          else if (status === 'Izin') countI++;
          else if (status === 'Alpa') countA++;
        }
      }

      const totalLogged = countH + countS + countI + countA;
      const percentage = totalLogged > 0 ? Math.round((countH / totalLogged) * 100) : 0;

      return {
        no: idx + 1,
        studentId: student.id,
        nisn: student.nisn,
        studentName: student.name,
        className: student.className,
        dayStatuses,
        countH,
        countS,
        countI,
        countA,
        totalLogged,
        percentage
      };
    });
  }, [filteredStudents, totalDays, selectedMonth, selectedYear, attendanceMap]);

  // Overall statistics
  const monthName = monthsList.find(m => m.value === selectedMonth)?.label || '';
  const selectedClassName = selectedClassId === 'all'
    ? 'Semua Kelas'
    : classes.find(c => c.id === selectedClassId)?.name || 'Kelas';

  const handleExportExcel = () => {
    exportMonthlyRecapToExcel(
      monthlyData,
      totalDays,
      monthName,
      selectedYear,
      selectedClassName,
      dayHolidaysMap
    );
  };

  return (
    <div className="space-y-5">
      {/* Filter Header Box */}
      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
            <School className="w-3.5 h-3.5 text-emerald-600" /> Filter Kelas
          </label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white text-slate-800 focus:outline-none focus:border-emerald-600"
          >
            <option value="all">Semua Kelas ({students.length} Siswa)</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-emerald-600" /> Pilih Bulan
          </label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white text-slate-800 focus:outline-none focus:border-emerald-600"
          >
            {monthsList.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-emerald-600" /> Pilih Tahun
          </label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white text-slate-800 focus:outline-none focus:border-emerald-600"
          >
            {yearOptions.map(y => (
              <option key={y} value={y}>Tahun {y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Title Header above table */}
      <div className="bg-emerald-900 text-white p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="space-y-1 text-center sm:text-left">
          <h2 className="text-sm sm:text-base font-black tracking-wide uppercase text-amber-300 flex items-center gap-2 justify-center sm:justify-start">
            <Calendar className="w-5 h-5 text-emerald-300" />
            REKAPITULASI KEHADIRAN SISWA KELAS {selectedClassName.toUpperCase()} — {monthName.toUpperCase()} {selectedYear}
          </h2>
          <p className="text-xs text-emerald-100 font-medium">
            SMA Islam Ra'iyatul Husnan • Total Siswa: <span className="font-bold text-white">{filteredStudents.length}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 py-2 px-3.5 bg-emerald-800 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs border border-emerald-600 shadow-sm cursor-pointer transition-all active:scale-95 shrink-0"
            title="Cetak Laporan Presensi"
          >
            <Printer className="w-4 h-4 text-amber-300" /> Cetak
          </button>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 py-2 px-4 bg-amber-400 hover:bg-amber-300 text-emerald-950 font-black rounded-xl text-xs shadow-md cursor-pointer transition-all active:scale-95 shrink-0"
            title="Ekspor Rekapitulasi Bulanan ke Excel (.xlsx)"
          >
            <Download className="w-4 h-4" /> Ekspor Excel (.xlsx)
          </button>
        </div>
      </div>

      {/* Holiday Info Banner & Legend */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white border border-slate-200 rounded-xl text-xs">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="font-extrabold text-slate-700 text-xs">Keterangan:</span>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
              H = Hadir
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded-md">
              S = Sakit
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
              I = Izin
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded-md">
              A = Alpa
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-rose-900 bg-rose-100/90 border border-rose-300 px-2.5 py-0.5 rounded-md shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse"></span>
              L = Hari Libur (Merah)
            </span>
          </div>

          <div className="text-slate-600 font-bold text-[11px]">
            Periode: <span className="text-emerald-800 font-extrabold">{monthName} {selectedYear}</span> ({selectedClassName})
          </div>
        </div>

        {/* Highlighted List of Holidays in this selected Month */}
        {activeMonthHolidays.length > 0 && (
          <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-start sm:items-center gap-2">
              <div className="p-1.5 bg-rose-100 text-rose-700 rounded-lg shrink-0">
                <Info className="w-4 h-4" />
              </div>
              <div>
                <span className="font-extrabold text-rose-950 block sm:inline mr-2">
                  Daftar Hari Libur Bulan {monthName} {selectedYear}:
                </span>
                <div className="inline-flex flex-wrap gap-1.5 mt-1 sm:mt-0">
                  {activeMonthHolidays.map((h, i) => (
                    <span
                      key={i}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[11px] border ${
                        h.isCustom
                          ? 'bg-rose-200/90 text-rose-900 border-rose-300 font-black'
                          : 'bg-white text-rose-800 border-rose-200'
                      }`}
                      title={h.name}
                    >
                      <span className="font-mono text-[10px] text-rose-950 font-black">Tgl {h.day}</span>: {h.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <span className="text-[10px] text-rose-700 font-bold sm:text-right shrink-0 bg-white/80 px-2 py-1 rounded-lg border border-rose-200">
              Total {activeMonthHolidays.length} Hari Libur
            </span>
          </div>
        )}
      </div>

      {/* Monthly Attendance Table Matrix */}
      <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-2xs bg-white max-w-full">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-800 text-white text-[11px] font-extrabold uppercase">
              <th className="p-2.5 text-center border-b border-slate-700 w-10 sticky left-0 bg-slate-800 z-10">No</th>
              <th className="p-2.5 border-b border-slate-700 min-w-[170px] sticky left-10 bg-slate-800 z-10">Nama Siswa / NISN</th>
              
              {/* Day numbers 1 to totalDays */}
              {Array.from({ length: totalDays }, (_, i) => i + 1).map(day => {
                const hol = dayHolidaysMap[day];
                const isHoliday = hol?.isHoliday;
                return (
                  <th
                    key={day}
                    className={`p-1 text-center border-b border-r text-[10px] w-7 min-w-[28px] transition-colors ${
                      isHoliday
                        ? 'bg-rose-900/95 text-rose-100 border-rose-700 font-black'
                        : 'border-slate-700/60 font-mono text-slate-200'
                    }`}
                    title={isHoliday ? `HARI LIBUR: ${hol.name} (${hol.dayName})` : `${hol?.dayName}, ${day} ${monthName}`}
                  >
                    <div className="flex flex-col items-center">
                      <span className={isHoliday ? 'text-amber-300 font-black' : ''}>{day}</span>
                      <span className={`text-[8px] font-sans ${isHoliday ? 'text-rose-300 font-extrabold' : 'text-slate-400'}`}>
                        {hol?.dayName}
                      </span>
                    </div>
                  </th>
                );
              })}

              <th className="p-2 text-center border-b border-slate-700 bg-emerald-950/80 text-emerald-300 w-10">H</th>
              <th className="p-2 text-center border-b border-slate-700 bg-blue-950/80 text-blue-300 w-10">S</th>
              <th className="p-2 text-center border-b border-slate-700 bg-amber-950/80 text-amber-300 w-10">I</th>
              <th className="p-2 text-center border-b border-slate-700 bg-rose-950/80 text-rose-300 w-10">A</th>
              <th className="p-2.5 text-center border-b border-slate-700 bg-slate-900 text-amber-300 w-16">Kehadiran</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {monthlyData.length === 0 ? (
              <tr>
                <td colSpan={totalDays + 7} className="p-8 text-center text-xs text-slate-400 font-medium">
                  Tidak ada data siswa ditemukan untuk kriteria filter ini.
                </td>
              </tr>
            ) : (
              monthlyData.map((row) => (
                <tr key={row.studentId} className="hover:bg-slate-50 transition-colors">
                  {/* Sticky left columns */}
                  <td className="p-2 text-center font-bold text-slate-400 sticky left-0 bg-white group-hover:bg-slate-50 border-r border-slate-100">
                    {row.no}
                  </td>
                  <td className="p-2 sticky left-10 bg-white group-hover:bg-slate-50 border-r border-slate-100">
                    <p className="font-extrabold text-slate-900 text-xs truncate max-w-[180px]">{row.studentName}</p>
                    <p className="text-[10px] text-slate-500 font-mono">NISN: {row.nisn}</p>
                  </td>

                  {/* Days 1..N Matrix Cells */}
                  {Array.from({ length: totalDays }, (_, i) => i + 1).map(day => {
                    const st = row.dayStatuses[day];
                    const hol = dayHolidaysMap[day];
                    const isHoliday = hol?.isHoliday;

                    return (
                      <td
                        key={day}
                        className={`p-0.5 text-center border-r border-slate-100 transition-colors ${
                          isHoliday ? 'bg-rose-50/75' : ''
                        }`}
                        title={isHoliday ? `Hari Libur: ${hol.name}` : undefined}
                      >
                        {st === 'Hadir' && (
                          <span className="w-6 h-6 mx-auto rounded-md bg-emerald-100 text-emerald-900 font-black text-[10px] flex items-center justify-center shadow-2xs">
                            H
                          </span>
                        )}
                        {st === 'Sakit' && (
                          <span className="w-6 h-6 mx-auto rounded-md bg-blue-100 text-blue-900 font-black text-[10px] flex items-center justify-center shadow-2xs">
                            S
                          </span>
                        )}
                        {st === 'Izin' && (
                          <span className="w-6 h-6 mx-auto rounded-md bg-amber-100 text-amber-900 font-black text-[10px] flex items-center justify-center shadow-2xs">
                            I
                          </span>
                        )}
                        {st === 'Alpa' && (
                          <span className="w-6 h-6 mx-auto rounded-md bg-rose-100 text-rose-900 font-black text-[10px] flex items-center justify-center shadow-2xs">
                            A
                          </span>
                        )}
                        {!st && isHoliday && (
                          <span
                            className="w-6 h-6 mx-auto rounded-md bg-rose-100/90 text-rose-700 border border-rose-200/90 font-black text-[9px] flex items-center justify-center"
                            title={`Hari Libur: ${hol.name}`}
                          >
                            L
                          </span>
                        )}
                        {!st && !isHoliday && (
                          <span className="text-[10px] text-slate-300 font-mono">-</span>
                        )}
                      </td>
                    );
                  })}

                  {/* Summary Columns */}
                  <td className="p-2 text-center font-black text-emerald-800 bg-emerald-50/50 border-r border-slate-100">
                    {row.countH}
                  </td>
                  <td className="p-2 text-center font-black text-blue-800 bg-blue-50/50 border-r border-slate-100">
                    {row.countS}
                  </td>
                  <td className="p-2 text-center font-black text-amber-800 bg-amber-50/50 border-r border-slate-100">
                    {row.countI}
                  </td>
                  <td className="p-2 text-center font-black text-rose-800 bg-rose-50/50 border-r border-slate-100">
                    {row.countA}
                  </td>
                  <td className="p-2 text-center bg-slate-50 font-black text-xs text-slate-900">
                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-black ${
                      row.percentage >= 85 ? 'bg-emerald-100 text-emerald-800' :
                      row.percentage >= 70 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {row.percentage}%
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Formal Signature Section */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 mt-6 print:mt-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-xs text-slate-800">
          <div className="text-center space-y-16">
            <p>Mengetahui,<br /><strong className="font-bold">Kepala Sekolah</strong></p>
            <div>
              <p className="font-bold underline text-slate-900">{settings?.namaKepalaSekolah || "SAIFURRAHMAN, SH"}</p>
              {settings?.nipKepalaSekolah && settings.nipKepalaSekolah.trim() ? (
                <p className="text-[11px] text-slate-500 font-mono">NIP. {settings.nipKepalaSekolah}</p>
              ) : (
                <p className="text-[11px] text-slate-400 italic">NIP. -</p>
              )}
            </div>
          </div>

          <div className="text-center space-y-16">
            <p>Wringin, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}<br /><strong className="font-bold">Wali Kelas / Petugas Presensi</strong></p>
            <div>
              <p className="font-bold underline text-slate-900">
                {selectedClassId !== 'all' ? (classes.find(c => c.id === selectedClassId)?.teacherName || 'Wali Kelas') : 'Wali Kelas / Guru Piket'}
              </p>
              <p className="text-[11px] text-slate-500">Kelas: {selectedClassName}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

