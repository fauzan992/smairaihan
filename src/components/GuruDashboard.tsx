import React, { useState, useEffect } from 'react';
import { User, Student, Teacher, AttendanceRecord, AttendanceStatus, ClassRoom } from '../types';
import { apiService } from '../services/apiService';
import { exportAttendanceToExcel } from '../utils/excelHelper';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { NISNBarcode } from './NISNBarcode';
import { DismissalAttendanceSection } from './DismissalAttendanceSection';
import { MonthlyAttendanceReport } from './MonthlyAttendanceReport';
import { MonthlyKBMReport } from './MonthlyKBMReport';
import { MainDashboardOverview } from './MainDashboardOverview';
import { TeacherClassAdminSection } from './TeacherClassAdminSection';
import { TeacherProfileModal } from './TeacherProfileModal';
import { BKNote } from '../types';
import {
  UserCheck, Barcode, Calendar, FileSpreadsheet, CheckCircle2,
  XCircle, Clock, AlertTriangle, ArrowDownToLine, Search, Save, Check, RefreshCw, DoorOpen, Heart, BookOpen, Key
} from 'lucide-react';

interface GuruDashboardProps {
  user: User;
  students: Student[];
  teachers?: Teacher[];
  classes: ClassRoom[];
  attendanceRecords: AttendanceRecord[];
  bkNotes?: BKNote[];
  onRefreshData: () => void;
  externalActiveTab?: string;
  onTabChange?: (tab: 'dashboard' | 'master' | 'teacherAdmin' | 'scan' | 'reports' | 'import' | 'settings') => void;
  onUserUpdate?: (updatedUser: User) => void;
}

export const GuruDashboard: React.FC<GuruDashboardProps> = ({
  user,
  students,
  teachers = [],
  classes,
  attendanceRecords,
  bkNotes = [],
  onRefreshData,
  externalActiveTab,
  onTabChange,
  onUserUpdate
}) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'scan' | 'checkout' | 'today' | 'reports' | 'teacherAdmin'>(
    externalActiveTab === 'teacherAdmin' ? 'teacherAdmin' : ((externalActiveTab as any) || 'dashboard')
  );
  const [reportsSubTab, setReportsSubTab] = useState<'daily' | 'monthly' | 'kbm'>('daily');
  const [reportSubjectFilter, setReportSubjectFilter] = useState('all');
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedStudentBarcode, setSelectedStudentBarcode] = useState<Student | null>(null);

  useEffect(() => {
    if (externalActiveTab) {
      if (externalActiveTab === 'dashboard' || externalActiveTab === 'reports' || externalActiveTab === 'scan' || externalActiveTab === 'teacherAdmin') {
        setActiveTab(externalActiveTab as any);
      } else if (externalActiveTab === 'master') {
        setActiveTab('today');
      } else if (externalActiveTab === 'bk') {
        setActiveTab('teacherAdmin');
      }
    }
  }, [externalActiveTab]);

  // Class assignment filter (Guru defaults to assigned class or first class if unassigned)
  const teacherClassId = user.classId || classes[0]?.id || '';
  const currentClass = classes.find(c => c.id === teacherClassId);

  // Class students
  const classStudents = students.filter(s =>
    s.classId === teacherClassId ||
    (currentClass && s.className && s.className.trim().toLowerCase() === currentClass.name.trim().toLowerCase())
  ).sort((a, b) => a.name.localeCompare(b.name, 'id', { sensitivity: 'base' }));

  const todayStr = new Date().toISOString().split('T')[0];
  const todayRecords = attendanceRecords.filter(a => a.classId === teacherClassId && a.date === todayStr);

  // Manual Roster State for batch updating
  const [rosterStatus, setRosterStatus] = useState<{ [nisn: string]: { status: AttendanceStatus; notes: string } }>(() => {
    const initialMap: { [nisn: string]: { status: AttendanceStatus; notes: string } } = {};
    classStudents.forEach(st => {
      const existing = todayRecords.find(r => r.nisn === st.nisn);
      initialMap[st.nisn] = {
        status: existing ? existing.status : 'Hadir',
        notes: existing ? (existing.notes || '') : ''
      };
    });
    return initialMap;
  });

  const [savingRoster, setSavingRoster] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Report Date Range Filters
  const [reportStartDate, setReportStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [reportEndDate, setReportEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [reportStatusFilter, setReportStatusFilter] = useState('all');

  const classHistoryRecords = attendanceRecords.filter(rec => {
    const matchClass = rec.classId === teacherClassId ||
                       (currentClass && rec.className && rec.className.trim().toLowerCase() === currentClass.name.trim().toLowerCase());
    const matchStatus = reportStatusFilter === 'all' || rec.status === reportStatusFilter;
    const matchStart = !reportStartDate || rec.date >= reportStartDate;
    const matchEnd = !reportEndDate || rec.date <= reportEndDate;

    return matchClass && matchStatus && matchStart && matchEnd;
  });

  // Handle Save Manual Roster
  const handleSaveRoster = async () => {
    setSavingRoster(true);
    setSaveSuccessMsg(null);

    const payload = Object.entries(rosterStatus).map(([nisn, item]) => {
      const typedItem = item as { status: AttendanceStatus; notes: string };
      return {
        nisn,
        status: typedItem.status,
        notes: typedItem.notes
      };
    });

    const res = await apiService.saveBulkAttendance(payload, todayStr, user.name, 'guru');
    setSavingRoster(false);

    if (res.success) {
      setSaveSuccessMsg('Daftar presensi kelas berhasil disimpan!');
      onRefreshData();
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    } else {
      alert(res.error || 'Gagal menyimpan presensi');
    }
  };

  // Export Class Excel
  const handleExportClassExcel = () => {
    exportAttendanceToExcel(
      classHistoryRecords,
      `Absensi_Kelas_${currentClass?.name || 'Guru'}`,
      currentClass?.name || 'Kelas'
    );
  };

  // Counts for today
  const hadirCount = todayRecords.filter(r => r.status === 'Hadir').length;
  const izinCount = todayRecords.filter(r => r.status === 'Izin').length;
  const sakitCount = todayRecords.filter(r => r.status === 'Sakit').length;
  const alpaCount = todayRecords.filter(r => r.status === 'Alpa').length;

  return (
    <div className="space-y-6">
      {/* TAB 0: DASHBOARD UTAMA */}
      {activeTab === 'dashboard' ? (
        <MainDashboardOverview
          user={user}
          students={students}
          teachers={[]}
          classes={classes}
          attendanceRecords={attendanceRecords}
          onNavigateTab={(tab, sub) => {
            if (tab === 'master') {
              setActiveTab('today');
            } else if (tab === 'scan' || tab === 'reports') {
              setActiveTab(tab as any);
            }
            if (onTabChange) onTabChange(tab, sub);
          }}
        />
      ) : (
        <>
          {/* Teacher Class Welcome Header Bento Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-950 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden border border-emerald-800">
        <div className="absolute right-0 bottom-0 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-wrap justify-between items-center gap-4 relative z-10">
          <div>
            <span className="text-[10px] font-extrabold text-amber-300 uppercase tracking-widest bg-emerald-950/80 px-3 py-1 rounded-full border border-emerald-700/60 inline-block">
              DASHBOARD GURU / WALI KELAS
            </span>
            <h2 className="text-2xl font-black mt-2 tracking-tight">{user.name}</h2>
            <p className="text-xs text-emerald-200/90 mt-1 font-medium">
              NIP: <span className="font-mono font-bold text-amber-300">{user.nip || '-'}</span> • Kelas Binaan:{' '}
              <strong className="text-slate-950 bg-amber-400 font-extrabold px-2.5 py-0.5 rounded-lg text-xs">{currentClass?.name || 'Umum'}</strong>
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowProfileModal(true)}
              className="flex items-center gap-2 px-4 py-3 bg-teal-800/90 hover:bg-teal-700 text-white font-extrabold text-xs rounded-2xl border border-teal-500/50 shadow-md transition-transform hover:scale-105 cursor-pointer"
              title="Edit Nama Lengkap, Username, dan Password Guru"
            >
              <Key className="w-4 h-4 text-amber-300" /> Edit Akun & Password
            </button>
            <button
              onClick={() => setActiveTab('checkout')}
              className="flex items-center gap-2 px-4 py-3 bg-emerald-950/90 hover:bg-emerald-950 text-amber-300 font-extrabold text-xs rounded-2xl border border-amber-400/40 shadow-md transition-transform hover:scale-105 cursor-pointer"
            >
              <DoorOpen className="w-4 h-4 text-amber-300" /> Absensi Jam Pulang
            </button>
            <button
              onClick={() => setShowScannerModal(true)}
              className="flex items-center gap-2 px-5 py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-2xl shadow-lg transition-transform hover:scale-105 cursor-pointer border border-amber-300"
            >
              <Barcode className="w-5 h-5" /> Scan Barcode NISN Instant
            </button>
          </div>
        </div>
      </div>

      {/* Class Daily Metrics Bento Grid (Hidden when activeTab === 'scan') */}
      {activeTab !== 'scan' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-emerald-600 p-5 rounded-2xl shadow-md text-white flex flex-col justify-between hover:bg-emerald-700 transition-all">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-100">Hadir Hari Ini</p>
              <div className="w-8 h-8 rounded-xl bg-emerald-500/80 text-white flex items-center justify-center font-bold">
                <UserCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-end justify-between">
              <span className="text-3xl font-black">{hadirCount}</span>
              <span className="text-[10px] font-bold bg-emerald-700/80 px-2 py-1 rounded-lg">
                {classStudents.length ? Math.round((hadirCount / classStudents.length) * 100) : 0}% Kelas
              </span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Izin</p>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-end justify-between">
              <span className="text-3xl font-black text-slate-900">{izinCount}</span>
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-lg border border-amber-100">
                Surat Izin
              </span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Sakit</p>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-end justify-between">
              <span className="text-3xl font-black text-slate-900">{sakitCount}</span>
              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100">
                Surat Dokter
              </span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Alpa</p>
              <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                <XCircle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-end justify-between">
              <span className="text-3xl font-black text-rose-600">{alpaCount}</span>
              <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-1 rounded-lg border border-rose-100">
                Tanpa Ket.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Bento Tabs Container */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-200 bg-slate-50/80 p-2 overflow-x-auto gap-1.5">
          <button
            onClick={() => setActiveTab('teacherAdmin')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-extrabold rounded-2xl transition-all cursor-pointer ${
              activeTab === 'teacherAdmin'
                ? 'bg-amber-400 text-slate-950 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <BookOpen className="w-4 h-4 text-emerald-800" /> Administrasi Kelas & KBM
          </button>
          <button
            onClick={() => setActiveTab('scan')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-extrabold rounded-2xl transition-all cursor-pointer ${
              activeTab === 'scan'
                ? 'bg-emerald-800 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Barcode className="w-4 h-4 text-amber-300" /> Presensi Kelas (Scan & Manual)
          </button>
          <button
            onClick={() => setActiveTab('checkout')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-extrabold rounded-2xl transition-all cursor-pointer ${
              activeTab === 'checkout'
                ? 'bg-emerald-800 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <DoorOpen className="w-4 h-4 text-amber-300" /> Sesi Absensi Jam Pulang
          </button>
          <button
            onClick={() => setActiveTab('today')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-extrabold rounded-2xl transition-all cursor-pointer ${
              activeTab === 'today'
                ? 'bg-white text-emerald-900 shadow-sm border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <UserCheck className="w-4 h-4 text-emerald-600" /> Daftar Hadir Hari Ini ({todayRecords.length})
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-extrabold rounded-2xl transition-all cursor-pointer ${
              activeTab === 'reports'
                ? 'bg-white text-emerald-900 shadow-sm border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Laporan & Ekspor Excel Kelas
          </button>
        </div>

        <div className="p-5">
          {/* TAB 1: PRESENSI KELAS (SCAN & ROSTER) */}
          {activeTab === 'scan' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-emerald-50 p-4 rounded-xl border border-emerald-200">
                <div>
                  <h4 className="font-bold text-emerald-900 text-sm">Absensi Barcode & QR NISN Kelas {currentClass?.name}</h4>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    Kamera terbuka otomatis & memindai tanpa henti. Arahkan kartu QR/barcode NISN siswa ke kamera.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowScannerModal(true)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                  >
                    <Barcode className="w-4 h-4" /> Layar Penuh
                  </button>
                </div>
              </div>

              {/* Embedded Live Scanner Camera */}
              <div className="max-w-xl mx-auto">
                <BarcodeScannerModal
                  isInline={true}
                  onSuccessScan={onRefreshData}
                  recordedByRole="guru_piket"
                  recordedByName={user.name ? `Guru Piket (${user.name})` : 'Guru Piket'}
                  studentsList={students && students.length > 0 ? students : classStudents}
                />
              </div>

              {saveSuccessMsg && (
                <div className="p-3 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> {saveSuccessMsg}
                </div>
              )}

              {/* Roster Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 border-b border-slate-200 font-bold uppercase text-[10px] text-slate-500">
                    <tr>
                      <th className="p-3">No</th>
                      <th className="p-3">NISN & Kartu</th>
                      <th className="p-3">Nama Siswa</th>
                      <th className="p-3">Status Presensi Hari Ini</th>
                      <th className="p-3">Keterangan / Catatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {classStudents.map((st, idx) => {
                      const cur = rosterStatus[st.nisn] || { status: 'Hadir', notes: '' };
                      return (
                        <tr key={st.id} className="hover:bg-slate-50">
                          <td className="p-3 font-semibold text-slate-400">{idx + 1}</td>
                          <td className="p-3 font-mono font-bold text-emerald-800">
                            <div className="flex items-center gap-2">
                              <span>{st.nisn}</span>
                              <button
                                onClick={() => setSelectedStudentBarcode(st)}
                                className="p-1 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 cursor-pointer"
                                title="Lihat Barcode NISN"
                              >
                                <Barcode className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                          <td className="p-3 font-bold text-slate-900">{st.name}</td>
                          <td className="p-3">
                            <div className="flex gap-1">
                              {(['Hadir', 'Izin', 'Sakit', 'Alpa'] as AttendanceStatus[]).map((stt) => (
                                <button
                                  key={stt}
                                  type="button"
                                  onClick={() => setRosterStatus({
                                    ...rosterStatus,
                                    [st.nisn]: { ...cur, status: stt }
                                  })}
                                  className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                                    cur.status === stt
                                      ? (stt === 'Hadir' ? 'bg-emerald-600 text-white shadow-xs' :
                                         stt === 'Izin' ? 'bg-amber-500 text-white shadow-xs' :
                                         stt === 'Sakit' ? 'bg-blue-600 text-white shadow-xs' : 'bg-rose-600 text-white shadow-xs')
                                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                  }`}
                                >
                                  {stt}
                                </button>
                              ))}
                            </div>
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              placeholder="Keterangan..."
                              value={cur.notes}
                              onChange={(e) => setRosterStatus({
                                ...rosterStatus,
                                [st.nisn]: { ...cur, notes: e.target.value }
                              })}
                              className="w-full px-2 py-1 border border-slate-200 rounded text-xs bg-white"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleSaveRoster}
                  disabled={savingRoster}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
                >
                  {savingRoster ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Simpan Presensi Kelas
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: SESI ABSENSI JAM PULANG */}
          {activeTab === 'checkout' && (
            <DismissalAttendanceSection
              user={user}
              students={students}
              classes={classes}
              attendanceRecords={attendanceRecords}
              onRefreshData={onRefreshData}
            />
          )}

          {/* TAB 2: DAFTAR HADIR HARI INI */}
          {activeTab === 'today' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-slate-800 text-sm">Daftar Kehadiran Siswa Tanggal {todayStr}</h4>
                <span className="text-xs text-slate-500 font-semibold">{todayRecords.length} Terdata</span>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 border-b border-slate-200 font-bold uppercase text-[10px] text-slate-500">
                    <tr>
                      <th className="p-3">No</th>
                      <th className="p-3">Waktu Check-In</th>
                      <th className="p-3">NISN</th>
                      <th className="p-3">Nama Siswa</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Catatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {todayRecords.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-xs text-slate-400">
                          Belum ada data presensi siswa tercatat hari ini.
                        </td>
                      </tr>
                    ) : (
                      todayRecords.map((rec, idx) => (
                        <tr key={rec.id} className="hover:bg-slate-50">
                          <td className="p-3 font-semibold text-slate-400">{idx + 1}</td>
                          <td className="p-3 font-mono font-bold text-slate-700">{rec.time} WIB</td>
                          <td className="p-3 font-mono font-bold text-emerald-800">{rec.nisn}</td>
                          <td className="p-3 font-bold text-slate-900">{rec.studentName}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              rec.status === 'Hadir' ? 'bg-emerald-100 text-emerald-800' :
                              rec.status === 'Izin' ? 'bg-amber-100 text-amber-800' :
                              rec.status === 'Sakit' ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {rec.status}
                            </span>
                          </td>
                          <td className="p-3 text-slate-500">{rec.notes || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: LAPORAN & EKSPOR KELAS */}
          {activeTab === 'reports' && (
            <div className="space-y-5">
              {/* Subtabs Navigation for Rekapitulasi Laporan */}
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
                <button
                  onClick={() => setReportsSubTab('daily')}
                  className={`px-4 py-2.5 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
                    reportsSubTab === 'daily'
                      ? 'bg-emerald-800 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4 text-amber-300" />
                  <span>Laporan Harian</span>
                </button>
                <button
                  onClick={() => setReportsSubTab('monthly')}
                  className={`px-4 py-2.5 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
                    reportsSubTab === 'monthly'
                      ? 'bg-emerald-800 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
                  }`}
                >
                  <Clock className="w-4 h-4 text-amber-300" />
                  <span>Rekapitulasi Bulanan</span>
                </button>
                <button
                  onClick={() => setReportsSubTab('kbm')}
                  className={`px-4 py-2.5 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
                    reportsSubTab === 'kbm'
                      ? 'bg-emerald-800 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
                  }`}
                >
                  <BookOpen className="w-4 h-4 text-amber-300" />
                  <span>Rekap Bulanan KBM (Mapel & Kelas)</span>
                </button>
              </div>

              {/* Subtab 1: LAPORAN HARIAN */}
              {reportsSubTab === 'daily' && (
                <div className="space-y-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-wrap gap-3 items-end justify-between">
                    <div className="flex flex-wrap gap-3 items-end">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Mulai Tanggal</label>
                        <input
                          type="date"
                          value={reportStartDate}
                          onChange={(e) => setReportStartDate(e.target.value)}
                          className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Sampai Tanggal</label>
                        <input
                          type="date"
                          value={reportEndDate}
                          onChange={(e) => setReportEndDate(e.target.value)}
                          className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Status Kehadiran</label>
                        <select
                          value={reportStatusFilter}
                          onChange={(e) => setReportStatusFilter(e.target.value)}
                          className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-semibold"
                        >
                          <option value="all">Semua Status</option>
                          <option value="Hadir">Hadir</option>
                          <option value="Izin">Izin</option>
                          <option value="Sakit">Sakit</option>
                          <option value="Alpa">Alpa</option>
                        </select>
                      </div>
                    </div>

                    <button
                      onClick={handleExportClassExcel}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg text-xs shadow-xs cursor-pointer"
                    >
                      <ArrowDownToLine className="w-4 h-4" /> Unduh Laporan Excel Kelas (.xlsx)
                    </button>
                  </div>

                  {/* History Table */}
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-slate-50 border-b border-slate-200 font-bold uppercase text-[10px] text-slate-500">
                        <tr>
                          <th className="p-3">No</th>
                          <th className="p-3">Tanggal</th>
                          <th className="p-3">Jam</th>
                          <th className="p-3">NISN</th>
                          <th className="p-3">Nama Siswa</th>
                          <th className="p-3">Status</th>
                          <th className="p-3">Catatan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {classHistoryRecords.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="p-6 text-center text-xs text-slate-400">
                              Tidak ada riwayat presensi dalam rentang tanggal ini.
                            </td>
                          </tr>
                        ) : (
                          classHistoryRecords.map((rec, idx) => (
                            <tr key={rec.id} className="hover:bg-slate-50">
                              <td className="p-3 font-semibold text-slate-400">{idx + 1}</td>
                              <td className="p-3 font-semibold text-slate-800">{rec.date}</td>
                              <td className="p-3 font-mono text-slate-600">{rec.time}</td>
                              <td className="p-3 font-mono font-bold text-emerald-800">{rec.nisn}</td>
                              <td className="p-3 font-bold text-slate-900">{rec.studentName}</td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                  rec.status === 'Hadir' ? 'bg-emerald-100 text-emerald-800' :
                                  rec.status === 'Izin' ? 'bg-amber-100 text-amber-800' :
                                  rec.status === 'Sakit' ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'
                                }`}>
                                  {rec.status}
                                </span>
                              </td>
                              <td className="p-3 text-slate-500">{rec.notes || '-'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Subtab 2: REKAPITULASI BULANAN */}
              {reportsSubTab === 'monthly' && (
                <MonthlyAttendanceReport
                  students={students}
                  classes={classes}
                  attendanceRecords={attendanceRecords}
                />
              )}

              {/* Subtab 3: REKAPITULASI BULANAN KBM (MAPEL & KELAS) */}
              {reportsSubTab === 'kbm' && (
                <MonthlyKBMReport
                  students={students}
                  classes={classes}
                  teachers={teachers}
                  attendanceRecords={attendanceRecords}
                  defaultClassId={teacherClassId}
                  defaultSubjectName={user.subject}
                  currentTeacherName={user.name}
                />
              )}
            </div>
          )}

          {/* TAB ADMINISTRASI KELAS & KBM */}
          {activeTab === 'teacherAdmin' && (
            <TeacherClassAdminSection
              user={user}
              students={students}
              teachers={teachers}
              classes={classes}
              attendanceRecords={attendanceRecords}
              onRefreshData={onRefreshData}
            />
          )}
        </div>
      </div>
      </>
      )}

      {/* Barcode Printable Card Modal */}
      {selectedStudentBarcode && (
        <NISNBarcode
          nisn={selectedStudentBarcode.nisn}
          studentName={selectedStudentBarcode.name}
          className={selectedStudentBarcode.className}
          displayMode="card"
          onClose={() => setSelectedStudentBarcode(null)}
        />
      )}

      {/* Barcode Scanner Modal */}
      {showScannerModal && (
        <BarcodeScannerModal
          onClose={() => setShowScannerModal(false)}
          onSuccessScan={onRefreshData}
          recordedByRole="guru_piket"
          recordedByName={user.name ? `Guru Piket (${user.name})` : 'Guru Piket'}
          studentsList={students && students.length > 0 ? students : classStudents}
        />
      )}

      {/* Teacher Profile Edit Modal */}
      {showProfileModal && (
        <TeacherProfileModal
          user={user}
          teachers={teachers}
          onClose={() => setShowProfileModal(false)}
          onSuccess={(updatedUser) => {
            setShowProfileModal(false);
            if (onUserUpdate) onUserUpdate(updatedUser);
            onRefreshData();
          }}
        />
      )}
    </div>
  );
};
