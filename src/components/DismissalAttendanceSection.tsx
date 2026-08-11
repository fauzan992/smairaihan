import React, { useState, useEffect } from 'react';
import { User, Student, ClassRoom, AttendanceRecord } from '../types';
import { apiService } from '../services/apiService';
import {
  DoorOpen, CheckCircle2, AlertTriangle, Clock, Users, Save, ShieldCheck, RefreshCw, XCircle, UserCheck, AlertCircle, Sparkles, Filter
} from 'lucide-react';

interface DismissalAttendanceSectionProps {
  user: User;
  students: Student[];
  classes: ClassRoom[];
  attendanceRecords: AttendanceRecord[];
  onRefreshData: () => void;
  isModal?: boolean;
  onCloseModal?: () => void;
}

export const DismissalAttendanceSection: React.FC<DismissalAttendanceSectionProps> = ({
  user,
  students,
  classes,
  attendanceRecords,
  onRefreshData,
  isModal = false,
  onCloseModal
}) => {
  // Class selection (default to teacher's class or first available)
  const defaultClassId = user.classId || classes[0]?.id || '';
  const [selectedClassId, setSelectedClassId] = useState<string>(defaultClassId);
  const [dutyTeacherName, setDutyTeacherName] = useState<string>(user.name || 'Guru Jam Terakhir');

  const todayStr = new Date().toISOString().split('T')[0];
  const selectedClass = classes.find(c => c.id === selectedClassId);
  const classStudents = students.filter(s => s.classId === selectedClassId || (selectedClass && s.className && s.className.trim().toLowerCase() === selectedClass.name.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, 'id', { sensitivity: 'base' }));

  // Today's attendance records for the selected class
  const todayClassRecords = attendanceRecords.filter(a => a.classId === selectedClassId && a.date === todayStr);

  // Map of NISN -> checkout checkbox state (true = Hadir Pulang, false = Bolos / Pulang Awal)
  const [checkedOutMap, setCheckedOutMap] = useState<{ [nisn: string]: boolean }>({});
  // Map of NISN -> optional notes
  const [checkoutNotesMap, setCheckoutNotesMap] = useState<{ [nisn: string]: string }>({});

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Auto-select students who checked in ("Hadir") today whenever class or today's records change
  useEffect(() => {
    const initialCheckedMap: { [nisn: string]: boolean } = {};
    const initialNotesMap: { [nisn: string]: string } = {};

    classStudents.forEach(st => {
      const existing = todayClassRecords.find(r => r.nisn === st.nisn);
      // AUTOMATIC SELECTION: If already checked out before OR if status morning was 'Hadir'
      if (existing) {
        if (existing.checkOutStatus === 'Pulang') {
          initialCheckedMap[st.nisn] = true;
        } else if (existing.checkOutStatus === 'Bolos / Pulang Awal') {
          initialCheckedMap[st.nisn] = false;
        } else {
          // Default: if student was Hadir in the morning, auto-select them for checkout!
          initialCheckedMap[st.nisn] = existing.status === 'Hadir';
        }
        if (existing.notes) initialNotesMap[st.nisn] = existing.notes;
      } else {
        // If no record exists yet, default to false or true if assuming present
        initialCheckedMap[st.nisn] = false;
      }
    });

    setCheckedOutMap(initialCheckedMap);
    setCheckoutNotesMap(initialNotesMap);
  }, [selectedClassId, attendanceRecords]);

  const toggleStudentCheckout = (nisn: string) => {
    setCheckedOutMap(prev => ({
      ...prev,
      [nisn]: !prev[nisn]
    }));
  };

  const handleSelectAllPresent = () => {
    const newMap = { ...checkedOutMap };
    classStudents.forEach(st => {
      const morningRecord = todayClassRecords.find(r => r.nisn === st.nisn);
      if (morningRecord && morningRecord.status === 'Hadir') {
        newMap[st.nisn] = true;
      }
    });
    setCheckedOutMap(newMap);
  };

  const handleDeselectAll = () => {
    const newMap = { ...checkedOutMap };
    classStudents.forEach(st => {
      newMap[st.nisn] = false;
    });
    setCheckedOutMap(newMap);
  };

  const handleSaveCheckout = async () => {
    if (!selectedClassId) {
      setErrorMsg('Harap pilih kelas terlebih dahulu.');
      return;
    }

    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    const payload = classStudents.map(st => ({
      nisn: st.nisn,
      checkedOut: !!checkedOutMap[st.nisn],
      notes: checkoutNotesMap[st.nisn] || ''
    }));

    const res = await apiService.saveCheckoutAttendance(
      selectedClassId,
      payload,
      dutyTeacherName.trim() || user.name,
      todayStr
    );

    setSaving(false);

    if (res.success) {
      setSuccessMsg(res.message || 'Absensi jam pulang berhasil disimpan!');
      onRefreshData();
      setTimeout(() => setSuccessMsg(null), 4000);
      if (isModal && onCloseModal) {
        setTimeout(() => onCloseModal(), 1500);
      }
    } else {
      setErrorMsg(res.error || 'Gagal menyimpan absensi jam pulang.');
    }
  };

  // Metrics calculation
  const morningPresentCount = classStudents.filter(st => {
    const rec = todayClassRecords.find(r => r.nisn === st.nisn);
    return rec && rec.status === 'Hadir';
  }).length;

  const confirmedCheckoutCount = classStudents.filter(st => checkedOutMap[st.nisn]).length;
  const flaggedBolosCount = morningPresentCount - classStudents.filter(st => {
    const rec = todayClassRecords.find(r => r.nisn === st.nisn);
    return rec && rec.status === 'Hadir' && checkedOutMap[st.nisn];
  }).length;

  const contentUI = (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-emerald-900 via-teal-900 to-emerald-950 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden border border-emerald-800">
        <div className="absolute right-0 top-0 w-72 h-72 bg-amber-400/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-[10px] font-black text-slate-950 bg-amber-400 px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
              <DoorOpen className="w-3.5 h-3.5" /> SESI ABSENSI JAM PULANG (JAM TERAKHIR)
            </span>
            <span className="text-xs font-mono font-bold text-emerald-200 bg-emerald-950/80 px-3 py-1 rounded-xl border border-emerald-700/60">
              📅 {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>

          <div>
            <h3 className="text-xl font-extrabold text-white tracking-tight">
              Verifikasi Kepulangan Siswa Jam Terakhir
            </h3>
            <p className="text-xs text-emerald-100/90 mt-1 max-w-2xl leading-relaxed">
              Mencatat kehadiran siswa saat jam pelajaran usai tanpa perlu scan QR Code. Sistem <strong className="text-amber-300">secara otomatis menyeleksi (centang)</strong> semua siswa yang tercatat <strong className="text-amber-300">Hadir Masuk</strong> hari ini.
            </p>
          </div>
        </div>
      </div>

      {/* Class & Duty Teacher Filters */}
      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
        <div>
          <label className="block text-xs font-extrabold text-slate-800 mb-1 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-emerald-700" /> Pilih Kelas Yang Diampu Jam Terakhir:
          </label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-full text-xs font-bold p-2.5 bg-white rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 cursor-pointer shadow-2xs"
          >
            {classes.map(c => (
              <option key={c.id} value={c.id}>
                Kelas {c.name} ({c.gradeLevel}) — Wali Kelas: {c.teacherName || 'Belum Ditentukan'}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-extrabold text-slate-800 mb-1 flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-emerald-700" /> Guru Penanggung Jawab Jam Terakhir:
          </label>
          <input
            type="text"
            value={dutyTeacherName}
            onChange={(e) => setDutyTeacherName(e.target.value)}
            placeholder="Masukkan Nama Guru Mengajar Jam Terakhir"
            className="w-full text-xs font-bold p-2.5 bg-white rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 shadow-2xs"
          />
        </div>
      </div>

      {/* Automated Selection Info Notice */}
      <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200/80 flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 space-y-1">
          <p className="font-extrabold">
            Sistem Otomatis: {morningPresentCount} Siswa Kelas {selectedClass?.name} Tercatat HADIR MASUK Pagi Ini.
          </p>
          <p className="text-[11px] text-amber-800/90">
            Semua siswa yang hadir di pagi hari sudah <strong className="text-amber-950 font-black">otomatis dicentang</strong>. Guru jam terakhir cukup <strong>hilangkan centang</strong> pada siswa yang pulang mendahului jam pelajaran / bolos sebelum jam terakhir.
          </p>
        </div>
      </div>

      {/* Metrics Counter Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Siswa Kelas</span>
          <span className="text-xl font-black text-slate-900 mt-0.5 block">{classStudents.length} Siswa</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 shadow-2xs">
          <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Hadir Masuk Pagi</span>
          <span className="text-xl font-black text-emerald-900 mt-0.5 block">{morningPresentCount} Siswa</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-emerald-800 text-white shadow-2xs">
          <span className="text-[10px] font-bold text-emerald-200 uppercase tracking-wider block">Siap Pulang (Centang)</span>
          <span className="text-xl font-black text-amber-300 mt-0.5 block">{confirmedCheckoutCount} Siswa</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 shadow-2xs">
          <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider block">Terindikasi Bolos/Awal</span>
          <span className="text-xl font-black text-rose-700 mt-0.5 block">{flaggedBolosCount < 0 ? 0 : flaggedBolosCount} Siswa</span>
        </div>
      </div>

      {/* Action Toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap bg-slate-100 p-2.5 rounded-2xl border border-slate-200">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSelectAllPresent}
            className="px-3 py-1.5 bg-white hover:bg-slate-50 text-emerald-800 font-extrabold text-xs rounded-xl border border-slate-300 shadow-2xs cursor-pointer flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Centang Semua Siswa Hadir Masuk
          </button>
          <button
            type="button"
            onClick={handleDeselectAll}
            className="px-3 py-1.5 bg-white hover:bg-slate-50 text-rose-700 font-extrabold text-xs rounded-xl border border-slate-300 shadow-2xs cursor-pointer flex items-center gap-1.5"
          >
            <XCircle className="w-3.5 h-3.5 text-rose-600" /> Hapus Semua Centang
          </button>
        </div>

        <span className="text-[11px] font-bold text-slate-500">
          Centang = Hadir Jam Terakhir &amp; Boleh Pulang
        </span>
      </div>

      {/* Student List Table */}
      <div className="overflow-x-auto border border-slate-200 rounded-2xl bg-white shadow-2xs">
        <table className="w-full text-left text-xs text-slate-700">
          <thead className="bg-slate-100/80 border-b border-slate-200 font-extrabold uppercase text-[10px] text-slate-600">
            <tr>
              <th className="p-3 text-center w-12">No</th>
              <th className="p-3 text-center w-16">Pilih</th>
              <th className="p-3">NISN &amp; Nama Siswa</th>
              <th className="p-3 text-center">Status Masuk Pagi</th>
              <th className="p-3">Status Jam Pulang (Jam Terakhir)</th>
              <th className="p-3">Catatan Khusus Pulang</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {classStudents.map((st, idx) => {
              const morningRecord = todayClassRecords.find(r => r.nisn === st.nisn);
              const morningStatus = morningRecord ? morningRecord.status : 'Belum Absen';
              const isChecked = !!checkedOutMap[st.nisn];

              return (
                <tr
                  key={st.id}
                  onClick={() => toggleStudentCheckout(st.nisn)}
                  className={`transition-colors cursor-pointer ${
                    isChecked ? 'bg-emerald-50/60 hover:bg-emerald-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="p-3 text-center font-bold text-slate-400">{idx + 1}</td>
                  
                  {/* Checkbox */}
                  <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleStudentCheckout(st.nisn)}
                      className="w-5 h-5 rounded-md text-emerald-700 border-slate-300 focus:ring-emerald-500 cursor-pointer"
                    />
                  </td>

                  {/* Student Info */}
                  <td className="p-3">
                    <p className="font-extrabold text-slate-900 text-xs">{st.name}</p>
                    <p className="text-[10px] font-mono font-bold text-slate-500">NISN: {st.nisn} ({st.gender === 'L' ? 'Laki-Laki' : 'Perempuan'})</p>
                  </td>

                  {/* Morning Status */}
                  <td className="p-3 text-center">
                    {morningStatus === 'Hadir' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" /> Hadir ({morningRecord?.time || '-'})
                      </span>
                    )}
                    {morningStatus === 'Izin' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-200">
                        <Clock className="w-3 h-3" /> Izin
                      </span>
                    )}
                    {morningStatus === 'Sakit' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-blue-800 bg-blue-100 px-2.5 py-0.5 rounded-full border border-blue-200">
                        <AlertTriangle className="w-3 h-3" /> Sakit
                      </span>
                    )}
                    {morningStatus === 'Alpa' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-rose-800 bg-rose-100 px-2.5 py-0.5 rounded-full border border-rose-200">
                        <XCircle className="w-3 h-3" /> Alpa
                      </span>
                    )}
                    {morningStatus === 'Belum Absen' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                        Belum Absen
                      </span>
                    )}
                  </td>

                  {/* Dismissal Status */}
                  <td className="p-3">
                    {isChecked ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-800 bg-emerald-100 px-3 py-1 rounded-xl border border-emerald-300">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        SIAP PULANG (SESI TERAKHIR)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-black text-rose-800 bg-rose-100 px-3 py-1 rounded-xl border border-rose-300">
                        <AlertCircle className="w-4 h-4 text-rose-600" />
                        {morningStatus === 'Hadir' ? 'TERINDIKASI BOLOS / PULANG AWAL' : 'TIDAK PULANG (Sakit/Izin/Alpa)'}
                      </span>
                    )}
                  </td>

                  {/* Notes input */}
                  <td className="p-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      value={checkoutNotesMap[st.nisn] || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCheckoutNotesMap(prev => ({ ...prev, [st.nisn]: val }));
                      }}
                      placeholder="Catatan jam pulang (Opsional)..."
                      className="w-full text-xs p-1.5 bg-slate-50 rounded-lg border border-slate-200 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="p-4 bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-2xl font-bold text-xs flex items-center gap-2 shadow-2xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-100 border border-rose-300 text-rose-900 rounded-2xl font-bold text-xs flex items-center gap-2 shadow-2xs">
          <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Submit Button */}
      <div className="flex items-center justify-end gap-3 pt-2">
        {isModal && onCloseModal && (
          <button
            type="button"
            onClick={onCloseModal}
            className="px-5 py-3 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Tutup
          </button>
        )}

        <button
          type="button"
          onClick={handleSaveCheckout}
          disabled={saving || classStudents.length === 0}
          className="px-6 py-3.5 bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold text-xs rounded-2xl shadow-lg hover:shadow-xl transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 text-amber-300" />}
          <span>KONFIRMASI &amp; SIMPAN ABSENSI PULANG KELAS {selectedClass?.name || ''}</span>
        </button>
      </div>
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto my-auto animate-in fade-in zoom-in duration-200">
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-200">
            <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
              <DoorOpen className="w-5 h-5 text-emerald-800" /> Sesi Absensi Jam Pulang
            </h3>
            <button
              onClick={onCloseModal}
              className="text-slate-400 hover:text-slate-600 font-bold p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              ✕
            </button>
          </div>
          {contentUI}
        </div>
      </div>
    );
  }

  return contentUI;
};
