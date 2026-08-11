import React, { useState, useMemo, useEffect } from 'react';
import { Student, ClassRoom, AttendanceRecord, BKNote, User, SchoolSettings } from '../types';
import { apiService } from '../services/apiService';
import { SchoolLogo } from './SchoolLogo';
import {
  Heart, AlertTriangle, ShieldAlert, CheckCircle2, Search, Filter, Plus,
  FileText, Mail, Calendar, UserCheck, Phone, RefreshCw, Printer, Edit, Trash2,
  X, ChevronRight, Award, MessageSquare, Clock, UserX, School
} from 'lucide-react';

interface BKCounselingSectionProps {
  user: User | null;
  students: Student[];
  classes: ClassRoom[];
  attendanceRecords: AttendanceRecord[];
  bkNotes: BKNote[];
  onRefreshData: () => void;
}

export const BKCounselingSection: React.FC<BKCounselingSectionProps> = ({
  user,
  students,
  classes,
  attendanceRecords,
  bkNotes,
  onRefreshData
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'monitoring' | 'history' | 'letter'>('monitoring');

  // Filters
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  const [riskFilter, setRiskFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings | null>(() => {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('app_school_settings');
      if (raw) {
        try { return JSON.parse(raw); } catch { return null; }
      }
    }
    return null;
  });

  useEffect(() => {
    apiService.getSettings().then(res => {
      if (res.success && res.settings) {
        setSchoolSettings(res.settings);
      }
    });

    const handleSettingsEvent = (e: Event) => {
      const customEvent = e as CustomEvent<SchoolSettings>;
      if (customEvent.detail) {
        setSchoolSettings(customEvent.detail);
      }
    };

    window.addEventListener('school-settings-updated', handleSettingsEvent);
    return () => {
      window.removeEventListener('school-settings-updated', handleSettingsEvent);
    };
  }, []);

  // Modals state
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [editingNote, setEditingNote] = useState<BKNote | null>(null);
  const [selectedStudentForAction, setSelectedStudentForAction] = useState<Student | null>(null);

  const [showLetterModal, setShowLetterModal] = useState(false);
  const [letterData, setLetterData] = useState({
    studentId: '',
    studentName: '',
    nisn: '',
    className: '',
    parentName: '',
    letterNumber: `421.3/BK/${Math.floor(100 + Math.random() * 900)}/2026`,
    meetingDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    meetingTime: '09:00',
    venue: 'Ruangan Bimbingan Konseling (BK) SMA Islam Ra\'iyatul Husnan',
    counselorName: user?.name || 'Ibu Rahmawati, S.Psi',
    reason: 'Penyelesaian dan klarifikasi ketidakhadiran (Alpa/Sakit/Izin berulang).'
  });

  const [showDetailHistoryModal, setShowDetailHistoryModal] = useState(false);
  const [historyStudent, setHistoryStudent] = useState<Student | null>(null);

  // Form State
  const [isSaving, setIsSaving] = useState(false);
  const [noteForm, setNoteForm] = useState({
    category: 'Konseling Individual' as BKNote['category'],
    statusResiko: 'Sedang' as BKNote['statusResiko'],
    note: '',
    actionTaken: '',
    spLevel: 'Tanpa SP' as BKNote['spLevel'],
    followUpDate: ''
  });

  // Compute attendance stats per student
  const studentRiskList = useMemo(() => {
    return students.map(student => {
      const studentRecords = attendanceRecords.filter(r => r.studentId === student.id || r.nisn === student.nisn);
      const hadir = studentRecords.filter(r => r.status === 'Hadir').length;
      const sakit = studentRecords.filter(r => r.status === 'Sakit').length;
      const izin = studentRecords.filter(r => r.status === 'Izin').length;
      const alpa = studentRecords.filter(r => r.status === 'Alpa').length;
      const terlambat = studentRecords.filter(r => r.time && r.time > '07:15').length;

      const totalAbsent = sakit + izin + alpa;

      let riskLevel: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
      if (alpa >= 3 || totalAbsent >= 7) {
        riskLevel = 'HIGH';
      } else if (alpa >= 1 || totalAbsent >= 3 || terlambat >= 3) {
        riskLevel = 'MEDIUM';
      }

      // Check existing BK notes for this student
      const studentNotes = bkNotes.filter(n => n.studentId === student.id || n.nisn === student.nisn);

      return {
        student,
        stats: { hadir, sakit, izin, alpa, terlambat, totalAbsent },
        riskLevel,
        studentNotesCount: studentNotes.length,
        latestNote: studentNotes[0] || null
      };
    });
  }, [students, attendanceRecords, bkNotes]);

  // Filtered student list based on selected class, risk filter, and search
  const filteredRiskStudents = useMemo(() => {
    return studentRiskList.filter(item => {
      const matchClass = selectedClass === 'ALL' || item.student.classId === selectedClass;
      const matchRisk = riskFilter === 'ALL' || item.riskLevel === riskFilter;
      const matchSearch =
        item.student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.student.nisn.includes(searchQuery) ||
        item.student.className.toLowerCase().includes(searchQuery.toLowerCase());

      return matchClass && matchRisk && matchSearch;
    }).sort((a, b) => a.student.name.localeCompare(b.student.name, 'id', { sensitivity: 'base' }));
  }, [studentRiskList, selectedClass, riskFilter, searchQuery]);

  // Overall BK Dashboard Metrics
  const metrics = useMemo(() => {
    const highRiskCount = studentRiskList.filter(s => s.riskLevel === 'HIGH').length;
    const mediumRiskCount = studentRiskList.filter(s => s.riskLevel === 'MEDIUM').length;
    const totalBKNotes = bkNotes.length;
    const totalSPCount = bkNotes.filter(n => n.spLevel && n.spLevel !== 'Tanpa SP').length;

    return { highRiskCount, mediumRiskCount, totalBKNotes, totalSPCount };
  }, [studentRiskList, bkNotes]);

  // Handle open Form Note for a student
  const handleOpenNoteModal = (studentItem?: { student: Student; riskLevel: 'HIGH' | 'MEDIUM' | 'LOW' }, existingNote?: BKNote) => {
    if (existingNote) {
      setEditingNote(existingNote);
      setNoteForm({
        category: existingNote.category,
        statusResiko: existingNote.statusResiko,
        note: existingNote.note,
        actionTaken: existingNote.actionTaken,
        spLevel: existingNote.spLevel || 'Tanpa SP',
        followUpDate: existingNote.followUpDate || ''
      });
      const st = students.find(s => s.id === existingNote.studentId || s.nisn === existingNote.nisn) || null;
      setSelectedStudentForAction(st);
    } else if (studentItem) {
      setEditingNote(null);
      setSelectedStudentForAction(studentItem.student);
      setNoteForm({
        category: studentItem.riskLevel === 'HIGH' ? 'Pemanggilan Orang Tua' : 'Konseling Individual',
        statusResiko: studentItem.riskLevel === 'HIGH' ? 'Tinggi (Kritis)' : studentItem.riskLevel === 'MEDIUM' ? 'Sedang' : 'Rendah',
        note: '',
        actionTaken: '',
        spLevel: studentItem.riskLevel === 'HIGH' ? 'SP-1' : 'Tanpa SP',
        followUpDate: ''
      });
    }
    setShowNoteModal(true);
  };

  // Save BK Note
  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentForAction && !editingNote) {
      alert('Siswa wajib dipilih!');
      return;
    }

    setIsSaving(true);
    try {
      if (editingNote) {
        const res = await apiService.updateBKNote(editingNote.id, noteForm);
        if (res.success) {
          onRefreshData();
          setShowNoteModal(false);
        } else {
          alert(res.error || 'Gagal memperbarui catatan BK');
        }
      } else if (selectedStudentForAction) {
        const res = await apiService.addBKNote({
          studentId: selectedStudentForAction.id,
          studentName: selectedStudentForAction.name,
          nisn: selectedStudentForAction.nisn,
          className: selectedStudentForAction.className,
          counselorName: user?.name || 'Ibu Rahmawati, S.Psi (Guru BK)',
          ...noteForm
        });
        if (res.success) {
          onRefreshData();
          setShowNoteModal(false);
        } else {
          alert(res.error || 'Gagal menyimpan catatan BK');
        }
      }
    } catch (err: any) {
      alert(err?.message || 'Terjadi kesalahan.');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle open Call Letter generator for student
  const handleOpenLetterModal = (student: Student) => {
    setLetterData({
      studentId: student.id,
      studentName: student.name,
      nisn: student.nisn,
      className: student.className,
      parentName: student.parentName || 'Bapak/Ibu Orang Tua / Wali',
      letterNumber: `421.3/BK/${Math.floor(100 + Math.random() * 900)}/2026`,
      meetingDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      meetingTime: '09:00',
      venue: 'Ruang Bimbingan Konseling (BK) SMA Islam Ra\'iyatul Husnan',
      counselorName: user?.name || 'Ibu Rahmawati, S.Psi',
      reason: 'Koordinasi dan tindak lanjut penanganan kedisiplinan serta presensi ketidakhadiran siswa di sekolah.'
    });
    setShowLetterModal(true);
  };

  // Delete Note Modal State
  const [deleteNoteTarget, setDeleteNoteTarget] = useState<BKNote | null>(null);
  const [isDeletingNote, setIsDeletingNote] = useState(false);

  const handleDeleteNote = (note: BKNote) => {
    setDeleteNoteTarget(note);
  };

  const handleConfirmDeleteNote = async () => {
    if (!deleteNoteTarget) return;
    setIsDeletingNote(true);
    try {
      const res = await apiService.deleteBKNote(deleteNoteTarget.id);
      if (res.success) {
        onRefreshData();
        setDeleteNoteTarget(null);
      } else {
        alert(res.error || 'Gagal menghapus catatan BK.');
      }
    } catch (err: any) {
      alert(err?.message || 'Terjadi kesalahan saat menghapus catatan.');
    } finally {
      setIsDeletingNote(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-teal-900 via-emerald-900 to-slate-900 text-white rounded-3xl p-6 shadow-xl border border-teal-800/80 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 opacity-10 pointer-events-none">
          <Heart className="w-64 h-64 text-teal-300" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-800/80 text-amber-300 border border-teal-600/80 rounded-full text-xs font-bold uppercase tracking-widest">
              <Heart className="w-3.5 h-3.5 fill-amber-300" /> Pusat Bimbingan & Konseling (BK) Presensi
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white">
              Layanan Penanganan & Presensi Siswa BK
            </h2>
            <p className="text-xs text-teal-100/90 leading-relaxed">
              Fasilitas khusus Guru BK untuk memantau siswa berisiko absensi, mencatat histori bimbingan konseling individual, serta menerbitkan Surat Pemanggilan Wali Murid resmi.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-emerald-950/80 p-3 rounded-2xl border border-teal-700/80">
            <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 font-black flex items-center justify-center text-sm shadow-sm shrink-0">
              BK
            </div>
            <div className="text-left">
              <p className="text-xs font-extrabold text-amber-300">{user?.name || 'Ibu Rahmawati, S.Psi'}</p>
              <p className="text-[10px] text-teal-200">Konselor & Guru BK Sekolah</p>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl shadow-xs flex items-center gap-3">
          <div className="p-3 bg-rose-500 text-white rounded-xl shadow-xs shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[11px] font-extrabold text-rose-700 uppercase tracking-wider">Risiko Tinggi (Kritis)</p>
            <h3 className="text-2xl font-black text-rose-950">{metrics.highRiskCount} Siswa</h3>
            <p className="text-[10px] text-rose-600">Alpa ≥ 3x / Presensi Rendah</p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl shadow-xs flex items-center gap-3">
          <div className="p-3 bg-amber-500 text-white rounded-xl shadow-xs shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[11px] font-extrabold text-amber-800 uppercase tracking-wider">Risiko Sedang (Waspada)</p>
            <h3 className="text-2xl font-black text-amber-950">{metrics.mediumRiskCount} Siswa</h3>
            <p className="text-[10px] text-amber-700">Perlu perhatian bimbingan</p>
          </div>
        </div>

        <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-2xl shadow-xs flex items-center gap-3">
          <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-xs shrink-0">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[11px] font-extrabold text-indigo-800 uppercase tracking-wider">Catatan Konseling</p>
            <h3 className="text-2xl font-black text-indigo-950">{metrics.totalBKNotes} Records</h3>
            <p className="text-[10px] text-indigo-700">Tercatat di sistem BK</p>
          </div>
        </div>

        <div className="bg-purple-50 border border-purple-200 p-4 rounded-2xl shadow-xs flex items-center gap-3">
          <div className="p-3 bg-purple-600 text-white rounded-xl shadow-xs shrink-0">
            <Mail className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[11px] font-extrabold text-purple-800 uppercase tracking-wider">Surat Pemanggilan</p>
            <h3 className="text-2xl font-black text-purple-950">{metrics.totalSPCount} SP</h3>
            <p className="text-[10px] text-purple-700">Peringatan / Pemanggilan</p>
          </div>
        </div>
      </div>

      {/* Sub Tabs Navigation */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap gap-2">
        <button
          onClick={() => setActiveSubTab('monitoring')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'monitoring'
              ? 'bg-teal-700 text-white shadow-sm font-extrabold'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Monitoring & Penanganan Siswa Berisiko</span>
          {metrics.highRiskCount > 0 && (
            <span className="px-2 py-0.5 bg-rose-500 text-white text-[10px] rounded-full font-black animate-pulse">
              {metrics.highRiskCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('history')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'history'
              ? 'bg-teal-700 text-white shadow-sm font-extrabold'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Histori & Log Catatan Konseling BK ({bkNotes.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('letter')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'letter'
              ? 'bg-teal-700 text-white shadow-sm font-extrabold'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Mail className="w-4 h-4" />
          <span>Cetak Surat Pemanggilan Wali Murid</span>
        </button>
      </div>

      {/* SUBTAB 1: MONITORING SISWA BERISIKO ABSENSI */}
      {activeSubTab === 'monitoring' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row gap-3 justify-between items-center pb-4 border-b border-slate-100">
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              {/* Search */}
              <div className="relative flex-1 md:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Cari nama, NISN, atau kelas..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-1 focus:ring-teal-500 focus:bg-white focus:outline-none"
                />
              </div>

              {/* Class Filter */}
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
              >
                <option value="ALL">Semua Kelas ({classes.length})</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              {/* Risk Level Filter */}
              <select
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value as any)}
                className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
              >
                <option value="ALL">Semua Tingkat Risiko</option>
                <option value="HIGH">🔴 Risiko Tinggi (Kritis)</option>
                <option value="MEDIUM">🟡 Risiko Sedang (Waspada)</option>
                <option value="LOW">🟢 Risiko Rendah (Aman)</option>
              </select>
            </div>

            <p className="text-xs text-slate-500 font-medium self-end md:self-auto">
              Menampilkan <strong>{filteredRiskStudents.length}</strong> siswa
            </p>
          </div>

          {/* Table list */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold uppercase text-[10px]">
                  <th className="py-3 px-4">Siswa & NISN</th>
                  <th className="py-3 px-3">Kelas</th>
                  <th className="py-3 px-3">Rekap Absensi (H/S/I/A/T)</th>
                  <th className="py-3 px-3">Status Risiko BK</th>
                  <th className="py-3 px-3">Penanganan Terakhir</th>
                  <th className="py-3 px-4 text-center">Aksi Bimbingan BK</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredRiskStudents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      Tidak ada data siswa berisiko sesuai kriteria filter.
                    </td>
                  </tr>
                ) : (
                  filteredRiskStudents.map(({ student, stats, riskLevel, studentNotesCount, latestNote }) => (
                    <tr key={student.id} className="hover:bg-teal-50/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl font-bold flex items-center justify-center text-xs text-white shrink-0 shadow-xs ${
                            riskLevel === 'HIGH' ? 'bg-rose-600' : riskLevel === 'MEDIUM' ? 'bg-amber-500' : 'bg-emerald-600'
                          }`}>
                            {student.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-extrabold text-slate-900 text-xs">{student.name}</p>
                            <p className="text-[11px] text-slate-500">NISN: {student.nisn} • Orang tua: {student.parentName || '-'}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-3">
                        <span className="font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                          {student.className}
                        </span>
                      </td>

                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-1.5 font-bold">
                          <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-[11px]" title="Hadir">
                            H:{stats.hadir}
                          </span>
                          <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded-md text-[11px]" title="Sakit">
                            S:{stats.sakit}
                          </span>
                          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded-md text-[11px]" title="Izin">
                            I:{stats.izin}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded-md text-[11px] ${
                            stats.alpa > 0 ? 'bg-rose-100 text-rose-800 font-black border border-rose-300 animate-pulse' : 'bg-slate-100 text-slate-600'
                          }`} title="Alpa/Tanpa Keterangan">
                            A:{stats.alpa}
                          </span>
                          {stats.terlambat > 0 && (
                            <span className="px-1.5 py-0.5 bg-purple-100 text-purple-800 rounded-md text-[11px]" title="Terlambat">
                              T:{stats.terlambat}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-3">
                        {riskLevel === 'HIGH' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-100 text-rose-800 border border-rose-300 rounded-lg text-xs font-black">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> 🔴 Kritis (Perlu Pemanggilan)
                          </span>
                        ) : riskLevel === 'MEDIUM' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-black">
                            <Clock className="w-3.5 h-3.5 text-amber-600" /> 🟡 Waspada (Perlu Konseling)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> 🟢 Aman / Baik
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-3">
                        {latestNote ? (
                          <div>
                            <p className="font-bold text-slate-800 text-[11px]">{latestNote.category}</p>
                            <p className="text-[10px] text-slate-500">{latestNote.date} • {latestNote.spLevel || 'Tanpa SP'}</p>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Belum ada bimbingan</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenNoteModal({ student, riskLevel })}
                            className="px-2.5 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-[11px] font-bold shadow-2xs flex items-center gap-1 cursor-pointer transition-transform hover:scale-105"
                            title="Beri Catatan Bimbingan Konseling"
                          >
                            <Plus className="w-3.5 h-3.5" /> Konseling BK
                          </button>

                          <button
                            onClick={() => handleOpenLetterModal(student)}
                            className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-[11px] font-bold shadow-2xs flex items-center gap-1 cursor-pointer transition-colors"
                            title="Cetak Surat Pemanggilan Wali Murid"
                          >
                            <Mail className="w-3.5 h-3.5" /> Pemanggilan
                          </button>

                          <button
                            onClick={() => {
                              setHistoryStudent(student);
                              setShowDetailHistoryModal(true);
                            }}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl cursor-pointer"
                            title="Lihat Histori Bimbingan"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 2: HISTORI CATATAN BK */}
      {activeSubTab === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <FileText className="w-5 h-5 text-teal-700" /> Log Histori Catatan Bimbingan BK
              </h3>
              <p className="text-xs text-slate-500">
                Arsip seluruh catatan penanganan, bimbingan individual, dan pemanggilan orang tua yang telah diterbitkan.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {bkNotes.length === 0 ? (
              <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                Belum ada catatan Bimbingan Konseling yang tersimpan.
              </div>
            ) : (
              bkNotes.map(note => (
                <div key={note.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 hover:border-teal-300 transition-all">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-200/80 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-slate-900 text-sm">{note.studentName}</span>
                      <span className="px-2 py-0.5 bg-teal-100 text-teal-800 rounded-md font-bold text-xs border border-teal-200">
                        {note.className}
                      </span>
                      <span className="text-xs text-slate-500">NISN: {note.nisn}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black ${
                        note.statusResiko === 'Tinggi (Kritis)' ? 'bg-rose-100 text-rose-800 border border-rose-300' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {note.statusResiko}
                      </span>
                      <span className="text-xs font-bold text-slate-600 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                        📅 {note.date} {note.time ? `(${note.time})` : ''}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1">
                      <p className="font-extrabold text-teal-900 flex items-center gap-1">
                        <MessageSquare className="w-3.5 h-3.5 text-teal-600" /> Jenis Bimbingan: {note.category}
                      </p>
                      <p className="text-slate-700 bg-white p-2.5 rounded-xl border border-slate-200 font-medium">
                        <strong>Catatan Bimbingan:</strong> {note.note || 'Tidak ada uraian.'}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <p className="font-extrabold text-slate-800 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Hasil / Tindakan Komitmen:
                      </p>
                      <p className="text-slate-700 bg-white p-2.5 rounded-xl border border-slate-200 font-medium">
                        {note.actionTaken || 'Belum ada tindakan khusus.'}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-between items-center text-xs border-t border-slate-200/80">
                    <div className="flex items-center gap-3 text-slate-500">
                      <span>Guru BK: <strong className="text-slate-800">{note.counselorName}</strong></span>
                      {note.spLevel && note.spLevel !== 'Tanpa SP' && (
                        <span className="px-2 py-0.5 bg-rose-600 text-white font-extrabold rounded-md text-[10px]">
                          {note.spLevel}
                        </span>
                      )}
                      {note.followUpDate && (
                        <span>Tindak Lanjut: <strong className="text-teal-800">{note.followUpDate}</strong></span>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleOpenNoteModal(undefined, note)}
                        className="px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-600 border border-slate-200 rounded-lg font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Edit className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button
                        onClick={() => handleDeleteNote(note)}
                        className="px-2.5 py-1 bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 rounded-lg font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Hapus
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 3: CETAK SURAT PEMANGGILAN WALI MURID */}
      {activeSubTab === 'letter' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
          <div className="border-b border-slate-100 pb-4 flex justify-between items-center">
            <div>
              <h3 className="font-extrabold text-slate-900 text-lg flex items-center gap-2">
                <Mail className="w-5 h-5 text-teal-700" /> Generator & Cetak Surat Pemanggilan Orang Tua / Wali
              </h3>
              <p className="text-xs text-slate-500">
                Pilih siswa dan atur jadwal pemanggilan resmi untuk dicetak langsung dari sistem sekolah.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Form controls */}
            <div className="space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-200 text-xs">
              <h4 className="font-extrabold text-slate-800 text-sm border-b pb-2">Formulir Surat Pemanggilan</h4>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Pilih Siswa yang Dipanggil*</label>
                <select
                  value={letterData.studentId}
                  onChange={(e) => {
                    const st = students.find(s => s.id === e.target.value);
                    if (st) {
                      setLetterData({
                        ...letterData,
                        studentId: st.id,
                        studentName: st.name,
                        nisn: st.nisn,
                        className: st.className,
                        parentName: st.parentName || 'Bapak/Ibu Orang Tua / Wali'
                      });
                    }
                  }}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-bold text-xs"
                >
                  <option value="">-- Pilih Siswa --</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.className}) - NISN: {s.nisn}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nomor Surat</label>
                  <input
                    type="text"
                    value={letterData.letterNumber}
                    onChange={(e) => setLetterData({ ...letterData, letterNumber: e.target.value })}
                    className="w-full p-2 bg-white border border-slate-300 rounded-xl font-medium"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nama Orang Tua/Wali</label>
                  <input
                    type="text"
                    value={letterData.parentName}
                    onChange={(e) => setLetterData({ ...letterData, parentName: e.target.value })}
                    className="w-full p-2 bg-white border border-slate-300 rounded-xl font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tanggal Pertemuan</label>
                  <input
                    type="date"
                    value={letterData.meetingDate}
                    onChange={(e) => setLetterData({ ...letterData, meetingDate: e.target.value })}
                    className="w-full p-2 bg-white border border-slate-300 rounded-xl font-medium"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Waktu Pertemuan</label>
                  <input
                    type="text"
                    value={letterData.meetingTime}
                    onChange={(e) => setLetterData({ ...letterData, meetingTime: e.target.value })}
                    placeholder="misal: 09:00 WIB"
                    className="w-full p-2 bg-white border border-slate-300 rounded-xl font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Tempat Pertemuan</label>
                <input
                  type="text"
                  value={letterData.venue}
                  onChange={(e) => setLetterData({ ...letterData, venue: e.target.value })}
                  className="w-full p-2 bg-white border border-slate-300 rounded-xl font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Alasan / Hal Pemanggilan</label>
                <textarea
                  rows={3}
                  value={letterData.reason}
                  onChange={(e) => setLetterData({ ...letterData, reason: e.target.value })}
                  className="w-full p-2 bg-white border border-slate-300 rounded-xl font-medium"
                />
              </div>

              <button
                type="button"
                onClick={() => window.print()}
                className="w-full py-3 bg-teal-800 hover:bg-teal-900 text-white rounded-xl font-black flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-transform hover:scale-[1.02]"
              >
                <Printer className="w-4 h-4" /> Cetak Surat Pemanggilan Resmi
              </button>
            </div>

            {/* Right Printable Official Letter Live Preview */}
            <div className="bg-white p-8 rounded-2xl border-2 border-slate-300 shadow-md font-serif text-slate-900 text-xs space-y-4 printable-call-letter">
              {/* Kop Surat Sekolah */}
              <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3 gap-3">
                <div className="shrink-0">
                  <SchoolLogo size={64} logoUrl={schoolSettings?.logoUrl} schoolName={schoolSettings?.namaSekolah} subName={schoolSettings?.subNamaSekolah} />
                </div>
                <div className="text-center flex-1 space-y-0.5">
                  <h3 className="font-black text-xs uppercase tracking-wide text-slate-800 font-sans">
                    {schoolSettings?.naunganYayasan || "YAYASAN RA'IYATUL HUSNAN"}
                  </h3>
                  <h2 className="font-black text-base uppercase text-emerald-900 tracking-wider">
                    {schoolSettings?.namaSekolah || "SMA ISLAM RA'IYATUL HUSNAN"}
                  </h2>
                  <p className="text-[10px] font-sans text-slate-600">
                    {schoolSettings?.alamat || "Jl. Raya Wringin No. 45"}, {schoolSettings?.kecamatan || "Wringin"} - {schoolSettings?.kabupatenKota || "Bondowoso"} • Telp: {schoolSettings?.telepon || "(0332) 421xxx"}
                  </p>
                  <p className="text-[9px] font-sans text-emerald-700 font-bold uppercase tracking-widest">
                    AKREDITASI {schoolSettings?.akreditasi || "B"} • NPSN: {schoolSettings?.npsn || "20521620"} • TERINTEGRASI ABSENSI DIGITAL BARCODE NISN
                  </p>
                </div>
                <div className="shrink-0 w-16 invisible hidden sm:block">
                  {/* Symmetrical balance spacer */}
                </div>
              </div>

              {/* Header Surat */}
              <div className="flex justify-between text-[11px] pt-2">
                <div>
                  <p>No: <strong>{letterData.letterNumber}</strong></p>
                  <p>Hal: <strong>SURAT PEMANGGILAN ORANG TUA / WALI</strong></p>
                  <p>Lamp: -</p>
                </div>
                <div className="text-right">
                  <p>{schoolSettings?.kabupatenKota || "Bondowoso"}, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
              </div>

              {/* Tujuan */}
              <div className="space-y-1 pt-2">
                <p>Kepada Yth.</p>
                <p><strong>{letterData.parentName}</strong></p>
                <p>Orang Tua / Wali Murid dari: <strong>{letterData.studentName || '....................'}</strong> (Kelas {letterData.className || '...'})</p>
                <p>Di Tempat</p>
              </div>

              {/* Isi Surat */}
              <div className="space-y-2 leading-relaxed text-justify pt-2">
                <p><em>Assalamu'alaikum Warahmatullahi Wabarakatuh,</em></p>
                <p>
                  Dengan hormat, sehubungan dengan upaya pembinaan kedisiplinan dan monitoring kehadiran siswa di {schoolSettings?.namaSekolah || "SMA Islam Ra'iyatul Husnan"}, bersama ini kami mengharapkan kehadiran Bapak/Ibu Orang Tua / Wali murid pada:
                </p>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 font-sans space-y-1 my-2">
                  <p><strong>Hari / Tanggal:</strong> {new Date(letterData.meetingDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  <p><strong>Waktu:</strong> Pukul {letterData.meetingTime}</p>
                  <p><strong>Tempat:</strong> {letterData.venue}</p>
                  <p><strong>Acara / Maksud:</strong> {letterData.reason}</p>
                </div>

                <p>
                  Mengingat pentingnya hal tersebut demi kebaikan dan kelancaran pendidikan putra/putri Bapak/Ibu, kehadiran Bapak/Ibu sangat kami harapkan tepat pada waktunya.
                </p>
                <p>Demikian surat pemanggilan ini kami sampaikan. Atas perhatian dan kerja samanya, kami ucapkan terima kasih.</p>
                <p><em>Wassalamu'alaikum Warahmatullahi Wabarakatuh.</em></p>
              </div>

              {/* Tanda Tangan */}
              <div className="pt-6 grid grid-cols-2 text-center text-[11px]">
                <div>
                  <p>Mengetahui,</p>
                  <p className="font-bold">Kepala {schoolSettings?.namaSekolah || "SMA Islam Ra'iyatul Husnan"}</p>
                  <div className="h-14"></div>
                  <p className="font-bold underline">{schoolSettings?.namaKepalaSekolah || "Ust. Ahmad Fausan, S.Pd"}</p>
                  <p className="text-[10px]">NIP. {schoolSettings?.nipKepalaSekolah || "198504122010011002"}</p>
                </div>

                <div>
                  <p>Guru / Konselor BK,</p>
                  <p className="font-bold">Guru Bimbingan Konseling</p>
                  <div className="h-14"></div>
                  <p className="font-bold underline">{letterData.counselorName}</p>
                  <p className="text-[10px]">NIP. 199105152016022005</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: FORM CATATAN BIMBINGAN BK */}
      {showNoteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Heart className="w-5 h-5 text-teal-600" />
                {editingNote ? 'Edit Catatan Bimbingan BK' : 'Tambah Catatan Bimbingan BK'}
              </h3>
              <button onClick={() => setShowNoteModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedStudentForAction && (
              <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-xs space-y-1">
                <p className="font-extrabold text-teal-900">{selectedStudentForAction.name} ({selectedStudentForAction.className})</p>
                <p className="text-slate-600">NISN: {selectedStudentForAction.nisn} • Ortu: {selectedStudentForAction.parentName || '-'}</p>
              </div>
            )}

            <form onSubmit={handleSaveNote} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jenis Bimbingan BK*</label>
                  <select
                    value={noteForm.category}
                    onChange={(e) => setNoteForm({ ...noteForm, category: e.target.value as any })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-bold bg-white"
                  >
                    <option value="Konseling Individual">Konseling Individual</option>
                    <option value="Pemanggilan Orang Tua">Pemanggilan Orang Tua</option>
                    <option value="Surat Peringatan (SP)">Surat Peringatan (SP)</option>
                    <option value="Home Visit">Home Visit / Kunjungan Rumah</option>
                    <option value="Konseling Akademik/Sikap">Konseling Akademik / Kedisiplinan</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tingkat Risiko Siswa*</label>
                  <select
                    value={noteForm.statusResiko}
                    onChange={(e) => setNoteForm({ ...noteForm, statusResiko: e.target.value as any })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-bold bg-white"
                  >
                    <option value="Rendah">🟢 Rendah (Aman)</option>
                    <option value="Sedang">🟡 Sedang (Waspada)</option>
                    <option value="Tinggi (Kritis)">🔴 Tinggi (Kritis)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Uraian / Permasalahan Presensi*</label>
                <textarea
                  required
                  rows={3}
                  value={noteForm.note}
                  onChange={(e) => setNoteForm({ ...noteForm, note: e.target.value })}
                  placeholder="Misal: Siswa tidak hadir tanpa keterangan selama 3 hari berturut-turut karena kendala transportasi..."
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-medium focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Tindakan BK & Komitmen Siswa*</label>
                <textarea
                  required
                  rows={2}
                  value={noteForm.actionTaken}
                  onChange={(e) => setNoteForm({ ...noteForm, actionTaken: e.target.value })}
                  placeholder="Misal: Siswa menandatangani surat pernyataan tidak mengulangi alpa dan akan hadir sebelum 07:00..."
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-medium focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tingkat SP (Jika ada)</label>
                  <select
                    value={noteForm.spLevel}
                    onChange={(e) => setNoteForm({ ...noteForm, spLevel: e.target.value as any })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-bold bg-white"
                  >
                    <option value="Tanpa SP">Tanpa SP</option>
                    <option value="SP-1">Surat Peringatan 1 (SP-1)</option>
                    <option value="SP-2">Surat Peringatan 2 (SP-2)</option>
                    <option value="SP-3">Surat Peringatan 3 (SP-3)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tanggal Evaluasi Ulang</label>
                  <input
                    type="date"
                    value={noteForm.followUpDate}
                    onChange={(e) => setNoteForm({ ...noteForm, followUpDate: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-medium"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNoteModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-bold flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Simpan Catatan BK</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: DETAIL HISTORI BIMBINGAN SISWA */}
      {showDetailHistoryModal && historyStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-slate-100 space-y-4 animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <FileText className="w-5 h-5 text-teal-700" />
                Histori Bimbingan BK: {historyStudent.name}
              </h3>
              <button onClick={() => setShowDetailHistoryModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex justify-between">
              <div>
                <p className="font-extrabold text-slate-900">{historyStudent.name}</p>
                <p className="text-slate-500">Kelas: {historyStudent.className} • NISN: {historyStudent.nisn}</p>
              </div>
              <div className="text-right">
                <p className="text-slate-600">Orang tua: {historyStudent.parentName || '-'}</p>
                <p className="text-slate-500">HP: {historyStudent.parentPhone || '-'}</p>
              </div>
            </div>

            <div className="space-y-3">
              {bkNotes.filter(n => n.studentId === historyStudent.id || n.nisn === historyStudent.nisn).length === 0 ? (
                <p className="text-center py-8 text-slate-400 text-xs italic">
                  Belum ada catatan Bimbingan Konseling untuk siswa ini.
                </p>
              ) : (
                bkNotes
                  .filter(n => n.studentId === historyStudent.id || n.nisn === historyStudent.nisn)
                  .map(note => (
                    <div key={note.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
                      <div className="flex justify-between items-center font-bold">
                        <span className="text-teal-900">{note.category}</span>
                        <span className="text-slate-500">{note.date}</span>
                      </div>
                      <p className="text-slate-700"><strong>Masalah:</strong> {note.note}</p>
                      <p className="text-slate-700"><strong>Hasil / Komitmen:</strong> {note.actionTaken}</p>
                      <div className="flex justify-between items-center text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                        <span>Konselor: {note.counselorName}</span>
                        <span className="font-bold text-rose-700">{note.spLevel || 'Tanpa SP'}</span>
                      </div>
                    </div>
                  ))
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowDetailHistoryModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold cursor-pointer text-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Popup Modal */}
      {deleteNoteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden transform transition-all">
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-rose-100 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0 shadow-2xs">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-extrabold text-slate-900">
                    Konfirmasi Hapus Catatan BK
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Apakah Anda yakin ingin menghapus catatan bimbingan konseling ini?
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDeleteNoteTarget(null)}
                  disabled={isDeletingNote}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-1.5">
                <div className="text-sm font-extrabold text-slate-900">
                  {deleteNoteTarget.studentName} ({deleteNoteTarget.className})
                </div>
                <div className="text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-lg inline-block">
                  Kategori: {deleteNoteTarget.category}
                </div>
                <p className="text-xs text-slate-600 line-clamp-2">
                  "{deleteNoteTarget.note}"
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isDeletingNote}
                  onClick={() => setDeleteNoteTarget(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isDeletingNote}
                  onClick={handleConfirmDeleteNote}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isDeletingNote ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Menghapus...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" /> Ya, Hapus Catatan
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
