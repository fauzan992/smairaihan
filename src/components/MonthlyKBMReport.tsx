import React, { useState, useEffect, useMemo } from 'react';
import { Student, ClassRoom, AttendanceRecord, Teacher, SchoolSettings, KBMJournalEntry, KBMAttendanceStatus } from '../types';
import { apiService, INITIAL_MASTER_SUBJECTS } from '../services/apiService';
import { exportKBMRecapToExcel } from '../utils/excelHelper';
import {
  BookOpen, Calendar, Download, School, UserCheck, FileText, CheckCircle2,
  Clock, AlertTriangle, XCircle, DoorOpen, Printer, RefreshCw, Layers, ListOrdered
} from 'lucide-react';

interface MonthlyKBMReportProps {
  students: Student[];
  classes: ClassRoom[];
  teachers?: Teacher[];
  attendanceRecords?: AttendanceRecord[];
  defaultClassId?: string;
  defaultSubjectName?: string;
  currentTeacherName?: string;
  schoolSettings?: SchoolSettings;
}

export const MonthlyKBMReport: React.FC<MonthlyKBMReportProps> = ({
  students,
  classes,
  teachers = [],
  attendanceRecords = [],
  defaultClassId,
  defaultSubjectName,
  currentTeacherName,
  schoolSettings
}) => {
  const currentDate = new Date();
  const defaultMonth = String(currentDate.getMonth() + 1).padStart(2, '0');
  const defaultYear = String(currentDate.getFullYear());

  // Master Subject List
  const [masterSubjects, setMasterSubjects] = useState<string[]>(INITIAL_MASTER_SUBJECTS);
  useEffect(() => {
    const raw = localStorage.getItem('app_master_subjects');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) setMasterSubjects(parsed);
      } catch (e) {
        // ignore
      }
    }
  }, []);

  // Filter States
  const [selectedSubject, setSelectedSubject] = useState<string>(defaultSubjectName || 'Matematika');
  const [selectedClassId, setSelectedClassId] = useState<string>(defaultClassId || (classes[0]?.id || 'cls-1'));
  const [selectedMonth, setSelectedMonth] = useState<string>(defaultMonth);
  const [selectedYear, setSelectedYear] = useState<string>(defaultYear);
  const [activeReportTab, setActiveReportTab] = useState<'matrix' | 'journal' | 'summary'>('matrix');

  // KBM Journals State
  const [kbmJournals, setKbmJournals] = useState<KBMJournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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

  // Load KBM Journals
  const loadKBMData = async () => {
    setIsLoading(true);
    const res = await apiService.getKBMJournals({
      classId: selectedClassId,
      subjectName: selectedSubject === 'all' ? undefined : selectedSubject,
      month: selectedMonth,
      year: selectedYear
    });
    if (res.success) {
      setKbmJournals(res.data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadKBMData();
  }, [selectedClassId, selectedSubject, selectedMonth, selectedYear]);

  // Dynamically extract all available subjects across system
  const allAvailableSubjects = useMemo(() => {
    const set = new Set<string>(masterSubjects);
    teachers.forEach(t => {
      if (t.subject) {
        t.subject.split(',').forEach(s => {
          const trimmed = s.trim();
          if (trimmed && trimmed !== 'Guru Mata Pelajaran' && trimmed !== 'Mata Pelajaran') {
            set.add(trimmed);
          }
        });
      }
    });
    attendanceRecords.forEach(rec => {
      if (rec.notes) {
        const match = rec.notes.match(/\[KBM\s+([^\]]+)\]/i);
        if (match && match[1]) {
          set.add(match[1].trim());
        }
      }
    });
    kbmJournals.forEach(j => {
      if (j.subjectName) set.add(j.subjectName.trim());
    });
    return Array.from(set).sort();
  }, [masterSubjects, teachers, attendanceRecords, kbmJournals]);

  // Current class details
  const currentClassObj = useMemo(() => {
    return classes.find(c => c.id === selectedClassId) || { id: selectedClassId, name: selectedClassId };
  }, [classes, selectedClassId]);

  // Students in selected class
  const classStudents = useMemo(() => {
    return students
      .filter(st => st.classId === selectedClassId || st.className === currentClassObj.name)
      .sort((a, b) => a.name.localeCompare(b.name, 'id', { sensitivity: 'base' }));
  }, [students, selectedClassId, currentClassObj]);

  // Teacher teaching this subject in this class
  const assignedTeacherName = useMemo(() => {
    if (selectedSubject === 'all') return 'Semua Guru Pengampu';

    // Check teacher-subject mapping
    const rawMap = localStorage.getItem('app_teacher_subject_map');
    if (rawMap) {
      try {
        const mappings: Array<{ teacherId: string; subject: string; classIds: string[] }> = JSON.parse(rawMap);
        const match = mappings.find(m => 
          m.subject.toLowerCase() === selectedSubject.toLowerCase() && 
          (m.classIds.length === 0 || m.classIds.includes(selectedClassId))
        );
        if (match) {
          const t = teachers.find(tch => tch.id === match.teacherId);
          if (t) return t.name;
        }
      } catch (e) {
        // ignore
      }
    }

    const tObj = teachers.find(t => t.subject?.toLowerCase() === selectedSubject.toLowerCase());
    if (tObj) return tObj.name;

    if (kbmJournals.length > 0 && kbmJournals[0].teacherName) {
      return kbmJournals[0].teacherName;
    }

    return currentTeacherName || currentClassObj.teacherName || 'Guru Mata Pelajaran';
  }, [teachers, selectedSubject, selectedClassId, kbmJournals, currentTeacherName, currentClassObj]);

  // Distinct KBM dates for this class and subject in the selected month
  const kbmDates = useMemo(() => {
    const datesSet = new Set<string>();
    const monthPad = selectedMonth.padStart(2, '0');
    const prefix = `${selectedYear}-${monthPad}`;

    // 1. From KBM Journals
    kbmJournals.forEach(j => {
      if (j.date.startsWith(prefix)) {
        if (selectedSubject === 'all' || j.subjectName.toLowerCase() === selectedSubject.toLowerCase()) {
          datesSet.add(j.date);
        }
      }
    });

    // 2. From attendance records with [KBM SubjectName] in notes
    const isAll = selectedSubject === 'all';
    const subKey = `[kbm ${selectedSubject.toLowerCase()}]`;
    attendanceRecords.forEach(rec => {
      if (
        (rec.classId === selectedClassId || rec.className === currentClassObj.name) &&
        rec.date.startsWith(prefix) &&
        rec.notes &&
        (isAll ? rec.notes.toLowerCase().includes('[kbm') : rec.notes.toLowerCase().includes(subKey))
      ) {
        datesSet.add(rec.date);
      }
    });

    return Array.from(datesSet).sort((a, b) => a.localeCompare(b));
  }, [kbmJournals, attendanceRecords, selectedClassId, currentClassObj, selectedSubject, selectedMonth, selectedYear]);

  // Fast mapping: student NISN + date -> { status, notes, timePulangAwal }
  const studentAttendanceMap = useMemo(() => {
    const map = new Map<string, { status: KBMAttendanceStatus; notes?: string; timePulangAwal?: string }>();

    // 1. Populate from KBM Journals (highest precision)
    kbmJournals.forEach(j => {
      if (selectedSubject === 'all' || j.subjectName.toLowerCase() === selectedSubject.toLowerCase()) {
        j.studentAttendance?.forEach(st => {
          const key = `${st.nisn}_${j.date}`;
          map.set(key, {
            status: st.status,
            notes: st.notes,
            timePulangAwal: st.timePulangAwal
          });
        });
      }
    });

    // 2. Fallback from attendanceRecords if missing
    const isAll = selectedSubject === 'all';
    const subKey = `[kbm ${selectedSubject.toLowerCase()}]`;
    attendanceRecords.forEach(rec => {
      if (
        (rec.classId === selectedClassId || rec.className === currentClassObj.name) &&
        rec.notes &&
        (isAll ? rec.notes.toLowerCase().includes('[kbm') : rec.notes.toLowerCase().includes(subKey))
      ) {
        const key = `${rec.nisn}_${rec.date}`;
        if (!map.has(key)) {
          let st: KBMAttendanceStatus = 'Hadir';
          let timeP: string | undefined = undefined;

          if (rec.checkOutStatus === 'Bolos / Pulang Awal') {
            if (rec.notes.toLowerCase().includes('pulang')) {
              st = 'Pulang Awal';
              timeP = rec.checkOutTime || '10:15';
            } else {
              st = 'Bolos';
            }
          } else if (rec.status === 'Sakit') {
            st = 'Sakit';
          } else if (rec.status === 'Izin') {
            st = 'Izin';
          } else if (rec.status === 'Alpa') {
            st = 'Alpa';
          } else {
            st = 'Hadir';
          }

          map.set(key, { status: st, notes: rec.notes, timePulangAwal: timeP });
        }
      }
    });

    return map;
  }, [kbmJournals, attendanceRecords, selectedClassId, currentClassObj, selectedSubject]);

  // Process Student Matrix Rows
  const studentRows = useMemo(() => {
    return classStudents.map((st, idx) => {
      const sessionStatuses: Record<string, string> = {};
      let countH = 0;
      let countI = 0;
      let countS = 0;
      let countP = 0; // Pulang Awal
      let countB = 0; // Bolos
      let countA = 0;

      kbmDates.forEach(dateStr => {
        const key = `${st.nisn}_${dateStr}`;
        const item = studentAttendanceMap.get(key);
        const status = item ? item.status : 'Hadir'; // default active in class if logged

        sessionStatuses[dateStr] = status;

        if (status === 'Hadir') countH++;
        else if (status === 'Izin') countI++;
        else if (status === 'Sakit') countS++;
        else if (status === 'Pulang Awal') countP++;
        else if (status === 'Bolos') countB++;
        else if (status === 'Alpa') countA++;
      });

      const totalMeetings = kbmDates.length;
      // Effective presence: Hadir = 100%, Pulang Awal = 50%
      const effectivePresence = countH + (countP * 0.5);
      const percentage = totalMeetings > 0 ? Math.round((effectivePresence / totalMeetings) * 100) : 100;

      return {
        no: idx + 1,
        studentId: st.id,
        nisn: st.nisn,
        studentName: st.name,
        gender: st.gender || 'L',
        sessionStatuses,
        countH,
        countI,
        countS,
        countP,
        countB,
        countA,
        totalMeetings,
        percentage
      };
    });
  }, [classStudents, kbmDates, studentAttendanceMap]);

  // Aggregate Stats
  const aggregateStats = useMemo(() => {
    let totalH = 0;
    let totalI = 0;
    let totalS = 0;
    let totalP = 0;
    let totalB = 0;
    let totalA = 0;

    studentRows.forEach(r => {
      totalH += r.countH;
      totalI += r.countI;
      totalS += r.countS;
      totalP += r.countP;
      totalB += r.countB;
      totalA += r.countA;
    });

    const totalSlots = studentRows.length * kbmDates.length;
    const avgPercentage = studentRows.length > 0
      ? Math.round(studentRows.reduce((acc, curr) => acc + curr.percentage, 0) / studentRows.length)
      : 0;

    return {
      totalH,
      totalI,
      totalS,
      totalP,
      totalB,
      totalA,
      totalSlots,
      avgPercentage,
      totalMeetings: kbmDates.length,
      totalStudents: studentRows.length
    };
  }, [studentRows, kbmDates]);

  const monthName = monthsList.find(m => m.value === selectedMonth)?.label || '';

  // Export to Excel
  const handleExportExcel = () => {
    const journalList = kbmJournals.map(j => ({
      date: j.date,
      sessionHour: j.sessionHour,
      topic: j.topic,
      notes: j.notes,
      assignmentTitle: j.assignmentGiven?.title
    }));

    exportKBMRecapToExcel({
      subjectName: selectedSubject,
      className: currentClassObj.name || selectedClassId,
      teacherName: assignedTeacherName,
      monthName,
      year: selectedYear,
      kbmDates,
      studentRows,
      journalEntries: journalList
    });
  };

  // Print Report
  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header Title Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white p-6 rounded-3xl shadow-md border border-emerald-800/40 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="p-2 bg-amber-400 text-slate-950 rounded-xl font-black">
              <BookOpen className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-300 bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-700/50">
              Format Laporan Khusus KBM
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Rekapitulasi Bulanan KBM & Mata Pelajaran
          </h2>
          <p className="text-xs text-teal-100/90 mt-1 max-w-2xl leading-relaxed">
            Format laporan kegiatan belajar mengajar khusus per mata pelajaran dan kelas, terpisah dari laporan gerbang harian siswa. Dilengkapi matriks presensi per pertemuan, agenda jurnal materi, dan catatan kendala kelas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={loadKBMData}
            disabled={isLoading}
            className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer backdrop-blur-xs border border-white/20"
            title="Muat Ulang Data KBM"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-amber-300 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Segarkan Data</span>
          </button>
          <button
            onClick={handlePrintReport}
            className="px-4 py-2 bg-white/15 hover:bg-white/25 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-white/25 shadow-xs"
          >
            <Printer className="w-4 h-4 text-emerald-300" />
            <span>Cetak Rekap</span>
          </button>
          <button
            onClick={handleExportExcel}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
          >
            <Download className="w-4 h-4 text-slate-950" />
            <span>Ekspor Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* FILTER CONTROLS BAR */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* 1. Mata Pelajaran */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
              Mata Pelajaran (KBM)
            </label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">🌐 Semua Mata Pelajaran (KBM)</option>
              <optgroup label="── Pilih Mata Pelajaran ──">
                {allAvailableSubjects.map((sub, idx) => (
                  <option key={idx} value={sub}>📖 {sub}</option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* 2. Filter Kelas */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <School className="w-3.5 h-3.5 text-emerald-600" />
              Kelas Siswa
            </label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500"
            >
              {classes.map(c => (
                <option key={c.id} value={c.id}>Kelas {c.name} ({c.studentCount || 0} Siswa)</option>
              ))}
            </select>
          </div>

          {/* 3. Bulan */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-emerald-600" />
              Bulan Pembelajaran
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500"
            >
              {monthsList.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* 4. Tahun */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-emerald-600" />
              Tahun Ajaran
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500"
            >
              {yearOptions.map(y => (
                <option key={y} value={y}>Tahun {y}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Info Strip */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-4 text-slate-600">
            <span>Guru Pengampu: <strong className="text-slate-900 font-bold">{assignedTeacherName}</strong></span>
            <span>•</span>
            <span>Total Pertemuan KBM Terlaksana: <strong className="text-emerald-800 font-bold">{kbmDates.length} Kali Sesi</strong></span>
            <span>•</span>
            <span>Jumlah Siswa Kelas: <strong className="text-slate-900 font-bold">{classStudents.length} Siswa</strong></span>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveReportTab('matrix')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeReportTab === 'matrix' ? 'bg-white text-emerald-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Matriks Presensi KBM</span>
            </button>
            <button
              onClick={() => setActiveReportTab('journal')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeReportTab === 'journal' ? 'bg-white text-emerald-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Agenda Jurnal Materi ({kbmJournals.length})</span>
            </button>
            <button
              onClick={() => setActiveReportTab('summary')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeReportTab === 'summary' ? 'bg-white text-emerald-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Statistik & Ringkasan</span>
            </button>
          </div>
        </div>
      </div>

      {/* QUICK STATS CARDS BAR */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-[10px] font-extrabold uppercase text-emerald-700">Rata-rata Keaktifan</p>
            <p className="text-xl font-black text-emerald-950">{aggregateStats.avgPercentage}%</p>
          </div>
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
        </div>

        <div className="bg-emerald-50/70 border border-emerald-200 p-3.5 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-[10px] font-extrabold uppercase text-emerald-800">Total Hadir (H)</p>
            <p className="text-xl font-black text-emerald-950">{aggregateStats.totalH}</p>
          </div>
          <UserCheck className="w-5 h-5 text-emerald-700" />
        </div>

        <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-[10px] font-extrabold uppercase text-amber-700">Izin (I)</p>
            <p className="text-xl font-black text-amber-950">{aggregateStats.totalI}</p>
          </div>
          <Clock className="w-5 h-5 text-amber-600" />
        </div>

        <div className="bg-blue-50 border border-blue-200 p-3.5 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-[10px] font-extrabold uppercase text-blue-700">Sakit (S)</p>
            <p className="text-xl font-black text-blue-950">{aggregateStats.totalS}</p>
          </div>
          <AlertTriangle className="w-5 h-5 text-blue-600" />
        </div>

        <div className="bg-orange-50 border border-orange-200 p-3.5 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-[10px] font-extrabold uppercase text-orange-800">Pulang Awal (P)</p>
            <p className="text-xl font-black text-orange-950">{aggregateStats.totalP}</p>
          </div>
          <DoorOpen className="w-5 h-5 text-orange-600" />
        </div>

        <div className="bg-purple-50 border border-purple-200 p-3.5 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-[10px] font-extrabold uppercase text-purple-800">Bolos / Alpa</p>
            <p className="text-xl font-black text-purple-950">{aggregateStats.totalB + aggregateStats.totalA}</p>
          </div>
          <XCircle className="w-5 h-5 text-purple-600" />
        </div>
      </div>

      {/* TAB 1: MATRIKS PRESENSI KBM */}
      {activeReportTab === 'matrix' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Formal School Document Header (For Preview and Print) */}
          <div className="p-6 bg-slate-50 border-b border-slate-200 text-center space-y-1">
            <h3 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight">
              {schoolSettings?.namaSekolah || "SMA ISLAM RA'IYATUL HUSNAN WRINGIN"}
            </h3>
            <h4 className="text-xs sm:text-sm font-extrabold text-emerald-800 uppercase tracking-wide">
              REKAPITULASI KEGIATAN BELAJAR MENGAJAR (KBM) & PRESENSI MATA PELAJARAN
            </h4>
            <div className="text-[11px] text-slate-600 font-semibold flex flex-wrap items-center justify-center gap-3 pt-1">
              <span>Mata Pelajaran: <strong>{selectedSubject}</strong></span>
              <span>•</span>
              <span>Kelas: <strong>{currentClassObj.name || selectedClassId}</strong></span>
              <span>•</span>
              <span>Guru: <strong>{assignedTeacherName}</strong></span>
              <span>•</span>
              <span>Periode: <strong>{monthName} {selectedYear}</strong></span>
            </div>
          </div>

          {/* Matrix Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-emerald-950 text-white font-extrabold text-[10px] uppercase border-b border-emerald-900">
                  <th className="p-3 w-10 text-center border-r border-emerald-900/50">No</th>
                  <th className="p-3 w-28 border-r border-emerald-900/50">NISN</th>
                  <th className="p-3 min-w-44 border-r border-emerald-900/50">Nama Lengkap Siswa</th>
                  <th className="p-3 w-12 text-center border-r border-emerald-900/50">L/P</th>

                  {/* KBM Dates Columns */}
                  {kbmDates.length === 0 ? (
                    <th className="p-3 text-center border-r border-emerald-900/50">Pertemuan KBM</th>
                  ) : (
                    kbmDates.map((d, i) => (
                      <th key={d} className="p-2.5 text-center min-w-16 border-r border-emerald-900/50" title={`Pertemuan ${i + 1}: ${d}`}>
                        <div>P{i + 1}</div>
                        <div className="text-[9px] font-normal text-emerald-300 font-mono">
                          {d.slice(8, 10)}/{d.slice(5, 7)}
                        </div>
                      </th>
                    ))
                  )}

                  {/* Summary Columns */}
                  <th className="p-2.5 text-center w-10 bg-emerald-900 border-r border-emerald-800 text-emerald-200" title="Hadir">H</th>
                  <th className="p-2.5 text-center w-10 bg-emerald-900 border-r border-emerald-800 text-amber-200" title="Izin">I</th>
                  <th className="p-2.5 text-center w-10 bg-emerald-900 border-r border-emerald-800 text-blue-200" title="Sakit">S</th>
                  <th className="p-2.5 text-center w-10 bg-emerald-900 border-r border-emerald-800 text-orange-200" title="Pulang Awal">P</th>
                  <th className="p-2.5 text-center w-10 bg-emerald-900 border-r border-emerald-800 text-purple-200" title="Bolos">B</th>
                  <th className="p-2.5 text-center w-10 bg-emerald-900 border-r border-emerald-800 text-rose-200" title="Alpa">A</th>
                  <th className="p-3 text-center min-w-20 bg-emerald-900 text-amber-300">Keaktifan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {studentRows.length === 0 ? (
                  <tr>
                    <td colSpan={12 + kbmDates.length} className="p-8 text-center text-xs text-slate-400">
                      Tidak ada siswa ditemukan di kelas {currentClassObj.name}.
                    </td>
                  </tr>
                ) : (
                  studentRows.map((row) => (
                    <tr key={row.studentId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 text-center font-bold text-slate-400 border-r border-slate-100">{row.no}</td>
                      <td className="p-3 font-mono text-[11px] font-bold text-emerald-800 border-r border-slate-100">{row.nisn}</td>
                      <td className="p-3 font-extrabold text-slate-900 border-r border-slate-100">
                        {row.studentName}
                      </td>
                      <td className="p-3 text-center font-semibold text-slate-500 border-r border-slate-100">{row.gender}</td>

                      {/* Per-session status badges */}
                      {kbmDates.length === 0 ? (
                        <td className="p-3 text-center text-slate-400 italic text-[11px] border-r border-slate-100">
                          Belum ada data sesi KBM
                        </td>
                      ) : (
                        kbmDates.map((d) => {
                          const st = row.sessionStatuses[d] || '-';
                          let badgeBg = 'bg-slate-100 text-slate-400';
                          let label = '-';

                          if (st === 'Hadir') {
                            badgeBg = 'bg-emerald-100 text-emerald-900 font-bold border border-emerald-300';
                            label = 'H';
                          } else if (st === 'Izin') {
                            badgeBg = 'bg-amber-100 text-amber-900 font-bold border border-amber-300';
                            label = 'I';
                          } else if (st === 'Sakit') {
                            badgeBg = 'bg-blue-100 text-blue-900 font-bold border border-blue-300';
                            label = 'S';
                          } else if (st === 'Pulang Awal') {
                            badgeBg = 'bg-orange-100 text-orange-950 font-black border border-orange-400';
                            label = 'P';
                          } else if (st === 'Bolos') {
                            badgeBg = 'bg-purple-100 text-purple-950 font-black border border-purple-400';
                            label = 'B';
                          } else if (st === 'Alpa') {
                            badgeBg = 'bg-rose-100 text-rose-950 font-black border border-rose-400';
                            label = 'A';
                          }

                          return (
                            <td key={d} className="p-2 text-center border-r border-slate-100">
                              <span className={`inline-block w-6 h-6 leading-6 rounded-lg text-[10px] text-center ${badgeBg}`}>
                                {label}
                              </span>
                            </td>
                          );
                        })
                      )}

                      {/* Totals */}
                      <td className="p-2 text-center font-bold text-emerald-900 bg-emerald-50/40 border-r border-slate-100">{row.countH}</td>
                      <td className="p-2 text-center font-bold text-amber-900 bg-amber-50/40 border-r border-slate-100">{row.countI}</td>
                      <td className="p-2 text-center font-bold text-blue-900 bg-blue-50/40 border-r border-slate-100">{row.countS}</td>
                      <td className="p-2 text-center font-bold text-orange-900 bg-orange-50/40 border-r border-slate-100">{row.countP}</td>
                      <td className="p-2 text-center font-bold text-purple-900 bg-purple-50/40 border-r border-slate-100">{row.countB}</td>
                      <td className="p-2 text-center font-bold text-rose-900 bg-rose-50/40 border-r border-slate-100">{row.countA}</td>
                      <td className="p-2.5 text-center font-black bg-slate-50">
                        <span className={`px-2 py-1 rounded-lg text-[10px] font-black ${
                          row.percentage >= 85 ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' :
                          row.percentage >= 75 ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                          'bg-rose-100 text-rose-900 border border-rose-300'
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

          {/* Legend and Signature Sheet */}
          <div className="p-6 bg-slate-50 border-t border-slate-200 space-y-6">
            {/* Legend Codes */}
            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-700 bg-white p-3.5 rounded-2xl border border-slate-200">
              <span className="font-extrabold text-slate-900">Keterangan Kode:</span>
              <span className="flex items-center gap-1"><span className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-900 font-bold flex items-center justify-center text-[10px] border border-emerald-300">H</span> Hadir</span>
              <span className="flex items-center gap-1"><span className="w-5 h-5 rounded-md bg-amber-100 text-amber-900 font-bold flex items-center justify-center text-[10px] border border-amber-300">I</span> Izin</span>
              <span className="flex items-center gap-1"><span className="w-5 h-5 rounded-md bg-blue-100 text-blue-900 font-bold flex items-center justify-center text-[10px] border border-blue-300">S</span> Sakit</span>
              <span className="flex items-center gap-1"><span className="w-5 h-5 rounded-md bg-orange-100 text-orange-950 font-bold flex items-center justify-center text-[10px] border border-orange-400">P</span> Pulang Awal</span>
              <span className="flex items-center gap-1"><span className="w-5 h-5 rounded-md bg-purple-100 text-purple-950 font-bold flex items-center justify-center text-[10px] border border-purple-400">B</span> Bolos KBM</span>
              <span className="flex items-center gap-1"><span className="w-5 h-5 rounded-md bg-rose-100 text-rose-950 font-bold flex items-center justify-center text-[10px] border border-rose-400">A</span> Alpa</span>
            </div>

            {/* Formal Lembar Pengesahan */}
            <div className="grid grid-cols-2 gap-8 pt-4 text-xs text-slate-800">
              <div className="text-center space-y-16">
                <p>Mengetahui,<br /><strong className="font-bold">Kepala Sekolah</strong></p>
                <div>
                  <p className="font-bold underline text-slate-900">{schoolSettings?.namaKepalaSekolah || "SAIFURRAHMAN, SH"}</p>
                  {schoolSettings?.nipKepalaSekolah && schoolSettings.nipKepalaSekolah.trim() ? (
                    <p className="text-[11px] text-slate-500 font-mono">NIP. {schoolSettings.nipKepalaSekolah}</p>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic">NIP. -</p>
                  )}
                </div>
              </div>

              <div className="text-center space-y-16">
                <p>Wringin, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}<br /><strong className="font-bold">Guru Mata Pelajaran</strong></p>
                <div>
                  <p className="font-bold underline text-slate-900">{assignedTeacherName}</p>
                  <p className="text-[11px] text-slate-500">Mata Pelajaran: {selectedSubject}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: AGENDA JURNAL MATERI KBM */}
      {activeReportTab === 'journal' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-600" />
                Catatan Jurnal Mengajar & Agenda Materi ({selectedSubject})
              </h3>
              <p className="text-xs text-slate-500">
                Riwayat materi pokok bahasan yang diajarkan pada kelas {currentClassObj.name} bulan {monthName} {selectedYear}
              </p>
            </div>
            <span className="text-xs font-bold bg-emerald-50 text-emerald-800 px-3 py-1 rounded-full border border-emerald-200">
              {kbmJournals.length} Catatan Jurnal
            </span>
          </div>

          {kbmJournals.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              Belum ada catatan jurnal KBM tersimpan untuk mata pelajaran {selectedSubject} di kelas ini pada periode {monthName} {selectedYear}.
            </div>
          ) : (
            <div className="space-y-3">
              {kbmJournals.map((jrn, index) => (
                <div key={jrn.id || index} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-emerald-800 text-white font-bold text-xs flex items-center justify-center">
                        {index + 1}
                      </span>
                      <span className="font-extrabold text-slate-900 text-xs font-mono">{jrn.date}</span>
                      <span className="text-[11px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                        {jrn.sessionHour || 'Jam Sesi Standar'}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-slate-600">
                      Pengajar: <strong className="text-slate-800">{jrn.teacherName}</strong>
                    </span>
                  </div>

                  <div>
                    <h4 className="text-xs font-black text-emerald-950 mb-0.5">Pokok Bahasan / Materi:</h4>
                    <p className="text-xs text-slate-700 bg-white p-3 rounded-xl border border-slate-200/80 leading-relaxed font-medium">
                      {jrn.topic || 'Materi pembelajaran KBM.'}
                    </p>
                  </div>

                  {jrn.notes && (
                    <div>
                      <h4 className="text-[11px] font-bold text-slate-600 mb-0.5">Catatan / Kendala Kelas:</h4>
                      <p className="text-xs text-slate-600 bg-amber-50/60 p-2.5 rounded-xl border border-amber-200/80">
                        {jrn.notes}
                      </p>
                    </div>
                  )}

                  {jrn.assignmentGiven?.title && (
                    <div className="flex items-center gap-2 text-xs text-emerald-900 bg-emerald-50 p-2 rounded-xl border border-emerald-200">
                      <ListOrdered className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span>Tugas Diberikan: <strong>{jrn.assignmentGiven.title}</strong></span>
                      {jrn.assignmentGiven.dueDate && (
                        <span className="text-[11px] text-emerald-700 ml-auto font-mono">
                          Batas: {jrn.assignmentGiven.dueDate}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: STATISTIK & RINGKASAN EVALUASI */}
      {activeReportTab === 'summary' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Problematic Student Watchlist */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3">
            <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Siswa Perlu Perhatian Khusus KBM
            </h3>
            <p className="text-xs text-slate-500">
              Daftar siswa yang memiliki catatan Bolos, Pulang Awal, atau Keaktifan di bawah 80% pada mata pelajaran {selectedSubject}.
            </p>

            <div className="space-y-2">
              {studentRows
                .filter(st => st.countB > 0 || st.countP > 0 || st.countA > 0 || st.percentage < 80)
                .map(st => (
                  <div key={st.studentId} className="p-3 bg-amber-50/50 border border-amber-200 rounded-2xl flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-xs text-slate-900">{st.studentName}</h4>
                      <p className="text-[11px] text-slate-600 font-mono">NISN: {st.nisn}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-black text-rose-800 block">
                        Keaktifan: {st.percentage}%
                      </span>
                      <div className="text-[10px] text-slate-500 flex gap-1 justify-end mt-0.5">
                        {st.countB > 0 && <span className="bg-purple-100 text-purple-800 px-1.5 py-0.2 rounded">Bolos: {st.countB}</span>}
                        {st.countP > 0 && <span className="bg-orange-100 text-orange-800 px-1.5 py-0.2 rounded">Pulang Awal: {st.countP}</span>}
                        {st.countA > 0 && <span className="bg-rose-100 text-rose-800 px-1.5 py-0.2 rounded">Alpa: {st.countA}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              {studentRows.filter(st => st.countB > 0 || st.countP > 0 || st.countA > 0 || st.percentage < 80).length === 0 && (
                <div className="p-6 text-center text-xs text-emerald-700 bg-emerald-50 rounded-2xl border border-emerald-200">
                  Semua siswa aktif dan tertib mengikuti KBM {selectedSubject} dengan baik!
                </div>
              )}
            </div>
          </div>

          {/* Subject Overview Card */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3">
            <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-emerald-600" />
              Rangkuman Capaian KBM Kelas
            </h3>
            <p className="text-xs text-slate-500">
              Evaluasi ketercapaian jam tatap muka dan efektivitas pembelajaran kelas {currentClassObj.name}.
            </p>

            <div className="space-y-2.5 pt-2">
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                <span className="font-bold text-slate-700">Mata Pelajaran</span>
                <span className="font-black text-emerald-900">{selectedSubject}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                <span className="font-bold text-slate-700">Kelas</span>
                <span className="font-black text-emerald-900">{currentClassObj.name}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                <span className="font-bold text-slate-700">Guru Pengampu</span>
                <span className="font-bold text-slate-900">{assignedTeacherName}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                <span className="font-bold text-slate-700">Persentase Rata-rata Partisipasi</span>
                <span className="font-black text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-xl">
                  {aggregateStats.avgPercentage}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
