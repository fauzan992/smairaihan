import React, { useState, useEffect } from 'react';
import { User, Student, Teacher, ClassRoom, AttendanceRecord, BKNote, AttendanceStatus, KBMAssignment } from '../types';
import { apiService } from '../services/apiService';
import {
  BookOpen, Users, CheckCircle2, Clock, AlertTriangle, XCircle,
  DoorOpen, HeartHandshake, Save, FileSpreadsheet, Search, RefreshCw,
  Send, Sparkles, Filter, Check, Calendar, FileText, Printer, ArrowRight,
  Settings, Plus, Edit2, Trash2, ChevronUp, ChevronDown, PlusCircle, RotateCcw,
  Bell, ClipboardCheck, ListTodo, HelpCircle, CheckSquare, FolderOpen
} from 'lucide-react';

interface TeacherClassAdminSectionProps {
  user: User;
  students: Student[];
  teachers?: Teacher[];
  classes: ClassRoom[];
  attendanceRecords: AttendanceRecord[];
  onRefreshData: () => void;
}

const DEFAULT_ASSIGNMENTS: KBMAssignment[] = [
  {
    id: 'asg-1',
    classId: 'class-1',
    className: 'X IPA 1',
    subjectName: 'Matematika',
    teacherName: 'Guru Matematika',
    givenDate: '2026-08-01',
    dueDate: '2026-08-08',
    title: 'Latihan Soal Persamaan & Fungsi Kuadrat',
    description: 'Kerjakan Soal Latihan Halaman 45 - 47 Nomor 1 sampai 10 di buku catatan/tugas.',
    status: 'PENDING'
  },
  {
    id: 'asg-2',
    classId: 'class-1',
    className: 'X IPA 1',
    subjectName: 'Bahasa Indonesia',
    teacherName: 'Guru Bahasa Indonesia',
    givenDate: '2026-08-02',
    dueDate: '2026-08-07',
    title: 'Draf Ringkasan Teks Laporan Hasil Observasi (LHO)',
    description: 'Menyusun laporan hasil observasi lingkungan sekitar sekolah SMA Islam Ra\'iyatul Husnan Wringin.',
    status: 'COMPLETED',
    checkedDate: '2026-08-07'
  },
  {
    id: 'asg-3',
    classId: 'class-1',
    className: 'X IPA 1',
    subjectName: 'Pendidikan Agama Islam',
    teacherName: 'Guru PAI',
    givenDate: '2026-08-03',
    dueDate: '2026-08-08',
    title: 'Hafalan Surah Al-Hujurat Ayat 10-12 beserta Tajwid',
    description: 'Hafalan mandiri di rumah dan disetorkan pada jam pembelajaran PAI berikutnya.',
    status: 'PENDING'
  }
];

const DEFAULT_SUBJECTS = [
  'Matematika', 'Fisika', 'Biologi', 'Kimia',
  'Bahasa Indonesia', 'Bahasa Inggris', 'Bahasa Arab',
  'Pendidikan Agama Islam', 'Pendidikan Pancasila / PKn',
  'Sejarah', 'Geografi', 'Sosiologi', 'Ekonomi',
  'PJOK (Olahraga)', 'Seni Budaya', 'Informatika / Komputer',
  'Prakarya & Kewirausahaan', 'Bimbingan Konseling (BK)'
];

const DEFAULT_SESSIONS = [
  'Jam ke 1 - 2 (07:00 - 08:30)',
  'Jam ke 3 - 4 (08:30 - 10:00)',
  'Istirahat Pertama (10:00 - 10:15)',
  'Jam ke 5 - 6 (10:15 - 11:45)',
  'Istirahat Kedua / ISHOMA (11:45 - 12:30)',
  'Jam ke 7 - 8 (12:30 - 14:00)',
  'Jam ke 9 - 10 (14:00 - 15:15)'
];

export const TeacherClassAdminSection: React.FC<TeacherClassAdminSectionProps> = ({
  user,
  students,
  teachers = [],
  classes,
  attendanceRecords,
  onRefreshData
}) => {
  // Select Class (Defaults to assigned class or first class)
  const [selectedClassId, setSelectedClassId] = useState<string>(
    user.classId || classes[0]?.id || ''
  );

  // Find current teacher object to parse assigned subjects from Admin
  const currentTeacher = teachers.find(
    t => t.id === user.id || t.username === user.username || t.nip === user.nip
  );
  const rawSubjectStr = currentTeacher?.subject || user.subject || '';
  const assignedSubjects = Array.from(
    new Set(
      rawSubjectStr
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
    )
  );

  // Master Subjects list from settings
  const [masterSubjectsList, setMasterSubjectsList] = useState<string[]>(DEFAULT_SUBJECTS);

  useEffect(() => {
    apiService.getSubjects().then(res => {
      if (res.success && res.subjects && res.subjects.length > 0) {
        setMasterSubjectsList(res.subjects);
      }
    });
  }, []);

  const allSubjects = Array.from(
    new Set([...assignedSubjects, ...masterSubjectsList])
  ).sort();

  // Subject Form state & Custom input toggle
  const [subjectName, setSubjectName] = useState<string>(() => {
    if (assignedSubjects.length > 0) return assignedSubjects[0];
    return user.subject || 'Matematika';
  });
  const [isCustomSubject, setIsCustomSubject] = useState<boolean>(false);

  // Lesson Session / Hour configuration & persistence
  const [sessionList, setSessionList] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('app_kbm_sessions');
      return saved ? JSON.parse(saved) : DEFAULT_SESSIONS;
    } catch {
      return DEFAULT_SESSIONS;
    }
  });

  const [sessionHour, setSessionHour] = useState<string>(sessionList[0] || DEFAULT_SESSIONS[0]);
  const [kbmDate, setKbmDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [topicSubject, setTopicSubject] = useState<string>('');
  const [classNotes, setClassNotes] = useState<string>('');

  // Session Manager Modal State
  const [showSessionModal, setShowSessionModal] = useState<boolean>(false);
  const [newSessionInput, setNewSessionInput] = useState<string>('');
  const [editingSessionIndex, setEditingSessionIndex] = useState<number | null>(null);
  const [editingSessionText, setEditingSessionText] = useState<string>('');

  const saveSessions = (updated: string[]) => {
    setSessionList(updated);
    try {
      localStorage.setItem('app_kbm_sessions', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save sessions:', e);
    }
  };

  const handleAddSession = () => {
    if (!newSessionInput.trim()) return;
    const updated = [...sessionList, newSessionInput.trim()];
    saveSessions(updated);
    setNewSessionInput('');
  };

  const handleDeleteSession = (index: number) => {
    if (sessionList.length <= 1) {
      alert('Minimal harus ada 1 sesi jam pelajaran.');
      return;
    }
    const updated = sessionList.filter((_, i) => i !== index);
    saveSessions(updated);
    if (sessionHour === sessionList[index]) {
      setSessionHour(updated[0] || '');
    }
  };

  const handleMoveSession = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sessionList.length) return;
    const updated = [...sessionList];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    saveSessions(updated);
  };

  const handleStartEditSession = (index: number) => {
    setEditingSessionIndex(index);
    setEditingSessionText(sessionList[index]);
  };

  const handleSaveEditSession = (index: number) => {
    if (!editingSessionText.trim()) return;
    const updated = [...sessionList];
    const oldVal = updated[index];
    updated[index] = editingSessionText.trim();
    saveSessions(updated);
    setEditingSessionIndex(null);
    if (sessionHour === oldVal) {
      setSessionHour(editingSessionText.trim());
    }
  };

  const handleResetSessions = () => {
    if (confirm('Apakah Anda yakin ingin mengembalikan susunan jam pelajaran / sesi ke standar sekolah?')) {
      saveSessions(DEFAULT_SESSIONS);
      setSessionHour(DEFAULT_SESSIONS[0]);
    }
  };

  // KBM Assignment Reminders State & Functions
  const [assignmentsList, setAssignmentsList] = useState<KBMAssignment[]>(() => {
    try {
      const saved = localStorage.getItem('app_kbm_assignments');
      return saved ? JSON.parse(saved) : DEFAULT_ASSIGNMENTS;
    } catch {
      return DEFAULT_ASSIGNMENTS;
    }
  });

  // State for adding today's assignment
  const [hasTodayAssignment, setHasTodayAssignment] = useState<boolean>(false);
  const [todayAssignmentTitle, setTodayAssignmentTitle] = useState<string>('');
  const [todayAssignmentDesc, setTodayAssignmentDesc] = useState<string>('');
  const [todayAssignmentDueDate, setTodayAssignmentDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });

  // Modals for Assignment History & New Manual Assignment
  const [showAssignmentHistoryModal, setShowAssignmentHistoryModal] = useState<boolean>(false);
  const [showNewAssignmentModal, setShowNewAssignmentModal] = useState<boolean>(false);
  const [manualAssignmentForm, setManualAssignmentForm] = useState({
    title: '',
    description: '',
    givenDate: kbmDate,
    dueDate: todayAssignmentDueDate,
    status: 'PENDING' as KBMAssignment['status']
  });

  const saveAssignments = (updated: KBMAssignment[]) => {
    setAssignmentsList(updated);
    try {
      localStorage.setItem('app_kbm_assignments', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save assignments:', e);
    }
  };

  const handleMarkAssignmentChecked = (asgId: string) => {
    const updated = assignmentsList.map(a => {
      if (a.id === asgId) {
        return {
          ...a,
          status: 'CHECKED_TODAY' as const,
          checkedDate: kbmDate,
          notes: `Ditagih & diperiksa saat KBM ${kbmDate}`
        };
      }
      return a;
    });
    saveAssignments(updated);
  };

  const handleMarkAssignmentCompleted = (asgId: string) => {
    const updated = assignmentsList.map(a => {
      if (a.id === asgId) {
        return {
          ...a,
          status: 'COMPLETED' as const,
          checkedDate: kbmDate
        };
      }
      return a;
    });
    saveAssignments(updated);
  };

  const handleAppendAssignmentToJournal = (asg: KBMAssignment) => {
    const noteSnippet = `[PENAGIHAN TUGAS PERTEMUAN LALU]: Ditagih tugas "${asg.title}" (Diberikan: ${asg.givenDate}).`;
    if (!classNotes.includes(asg.title)) {
      setClassNotes(prev => (prev ? `${prev}\n${noteSnippet}` : noteSnippet));
    }
  };

  const handleAddManualAssignment = () => {
    if (!manualAssignmentForm.title.trim()) {
      alert('Judul tugas tidak boleh kosong.');
      return;
    }
    const currentClassObj = classes.find(c => c.id === selectedClassId);
    const newAsg: KBMAssignment = {
      id: `asg-${Date.now()}`,
      classId: selectedClassId,
      className: currentClassObj?.name || selectedClassId,
      subjectName: subjectName.trim(),
      teacherName: user.name,
      givenDate: manualAssignmentForm.givenDate || kbmDate,
      dueDate: manualAssignmentForm.dueDate,
      title: manualAssignmentForm.title.trim(),
      description: manualAssignmentForm.description.trim(),
      status: manualAssignmentForm.status
    };
    saveAssignments([newAsg, ...assignmentsList]);
    setShowNewAssignmentModal(false);
    setManualAssignmentForm({
      title: '',
      description: '',
      givenDate: kbmDate,
      dueDate: todayAssignmentDueDate,
      status: 'PENDING'
    });
  };

  const handleDeleteAssignment = (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus catatan tugas ini?')) {
      const updated = assignmentsList.filter(a => a.id !== id);
      saveAssignments(updated);
    }
  };

  // Search filter inside roster
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Roster Status map for each student in current class
  const currentClassObj = classes.find(c => c.id === selectedClassId);
  const classStudents = students.filter(s =>
    s.classId === selectedClassId ||
    (currentClassObj && s.className && s.className.trim().toLowerCase() === currentClassObj.name.trim().toLowerCase())
  ).sort((a, b) => a.name.localeCompare(b.name, 'id', { sensitivity: 'base' }));

  // Today existing records for this class
  const classRecordsToday = attendanceRecords.filter(a => a.classId === selectedClassId && a.date === kbmDate);

  // Status map: nisn -> { status, notes, timePulangAwal, isEarlyDeparture, isBolos }
  type StudentStatusItem = {
    status: AttendanceStatus | 'Pulang Awal' | 'Bolos';
    notes: string;
    timePulangAwal?: string;
  };

  const [rosterMap, setRosterMap] = useState<{ [nisn: string]: StudentStatusItem }>({});

  useEffect(() => {
    const initialMap: { [nisn: string]: StudentStatusItem } = {};
    classStudents.forEach(st => {
      const existing = classRecordsToday.find(r => r.nisn === st.nisn);
      if (existing) {
        let stStatus: AttendanceStatus | 'Pulang Awal' | 'Bolos' = existing.status;
        if (existing.checkOutStatus === 'Bolos / Pulang Awal' || (existing.notes && existing.notes.toLowerCase().includes('pulang awal'))) {
          stStatus = 'Pulang Awal';
        } else if (existing.notes && (existing.notes.toLowerCase().includes('bolos') || existing.notes.toLowerCase().includes('meninggalkan kelas'))) {
          stStatus = 'Bolos';
        }
        initialMap[st.nisn] = {
          status: stStatus,
          notes: existing.notes || '',
          timePulangAwal: existing.checkOutTime || '10:15'
        };
      } else {
        initialMap[st.nisn] = {
          status: 'Hadir',
          notes: '',
          timePulangAwal: '10:15'
        };
      }
    });
    setRosterMap(initialMap);
  }, [selectedClassId, kbmDate, classStudents.length]);

  const handleStatusChange = (nisn: string, status: AttendanceStatus | 'Pulang Awal' | 'Bolos') => {
    setRosterMap(prev => ({
      ...prev,
      [nisn]: {
        ...prev[nisn],
        status
      }
    }));
  };

  const handleNotesChange = (nisn: string, notes: string) => {
    setRosterMap(prev => ({
      ...prev,
      [nisn]: {
        ...prev[nisn],
        notes
      }
    }));
  };

  const handleTimePulangAwalChange = (nisn: string, time: string) => {
    setRosterMap(prev => ({
      ...prev,
      [nisn]: {
        ...prev[nisn],
        timePulangAwal: time
      }
    }));
  };

  // Bulk action: Set all to Hadir
  const handleSetAllHadir = () => {
    const updated = { ...rosterMap };
    classStudents.forEach(st => {
      updated[st.nisn] = {
        status: 'Hadir',
        notes: '',
        timePulangAwal: '10:15'
      };
    });
    setRosterMap(updated);
  };

  // Save Attendance & Journal State
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const handleSaveKbmAttendance = async () => {
    setIsSaving(true);
    setSaveSuccessMsg(null);

    const payload = classStudents.map(st => {
      const item = rosterMap[st.nisn] || { status: 'Hadir', notes: '' };
      
      let finalStatus: AttendanceStatus = 'Hadir';
      let checkOutStatus: 'Pulang' | 'Bolos / Pulang Awal' | 'Belum Pulang' | undefined = undefined;
      let checkOutTime: string | undefined = undefined;
      let notesStr = item.notes;

      if (item.status === 'Pulang Awal') {
        finalStatus = 'Hadir'; // Counted present until left early
        checkOutStatus = 'Bolos / Pulang Awal';
        checkOutTime = item.timePulangAwal || '10:15';
        notesStr = `Pulang Sebelum Waktunya (Jam ${checkOutTime}) - ${notesStr || 'Izin Meninggalkan Sekolah'}`;
      } else if (item.status === 'Bolos') {
        finalStatus = 'Alpa';
        checkOutStatus = 'Bolos / Pulang Awal';
        notesStr = `Bolos / Meninggalkan KBM Tanpa Izin - ${notesStr || 'Keluar Saat Jam Pelajaran'}`;
      } else {
        finalStatus = item.status as AttendanceStatus;
      }

      return {
        nisn: st.nisn,
        status: finalStatus,
        notes: notesStr ? `[KBM ${subjectName}]: ${notesStr}` : `[KBM ${subjectName}]`,
        checkOutStatus,
        checkOutTime
      };
    });

    const res = await apiService.saveBulkAttendance(payload, kbmDate, user.name, 'guru');
    setIsSaving(false);

    if (res.success) {
      // Also save today's assignment if entered
      if (hasTodayAssignment && todayAssignmentTitle.trim()) {
        const newAsg: KBMAssignment = {
          id: `asg-${Date.now()}`,
          classId: selectedClassId,
          className: currentClassObj?.name || selectedClassId,
          subjectName: subjectName.trim(),
          teacherName: user.name,
          givenDate: kbmDate,
          dueDate: todayAssignmentDueDate,
          title: todayAssignmentTitle.trim(),
          description: todayAssignmentDesc.trim(),
          status: 'PENDING'
        };
        saveAssignments([newAsg, ...assignmentsList]);
        setTodayAssignmentTitle('');
        setTodayAssignmentDesc('');
        setHasTodayAssignment(false);
      }

      setSaveSuccessMsg(`Presensi KBM, Jurnal & Tugas Kelas ${currentClassObj?.name || selectedClassId} berhasil disimpan!`);
      onRefreshData();
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } else {
      alert(res.error || 'Gagal menyimpan presensi');
    }
  };

  // Modal State for Sending Referral Report to Guru BK
  const [bkReferralStudent, setBkReferralStudent] = useState<Student | null>(null);
  const [showBkModal, setShowBkModal] = useState(false);
  const [sendingBk, setSendingBk] = useState(false);
  const [bkForm, setBkForm] = useState({
    category: 'Konseling Akademik/Sikap' as BKNote['category'],
    statusResiko: 'Sedang' as BKNote['statusResiko'],
    incidentType: 'Pulang Sebelum Waktunya',
    note: '',
    actionTaken: ''
  });

  const handleOpenBkModal = (student: Student) => {
    const stItem = rosterMap[student.nisn] || { status: 'Hadir', notes: '' };
    let defaultIncident = 'Kendala Pembelajaran di Kelas';
    let defaultRisk: BKNote['statusResiko'] = 'Sedang';

    if (stItem.status === 'Pulang Awal') {
      defaultIncident = `Izin Pulang Sebelum Waktunya (Jam ${stItem.timePulangAwal || '10:15'})`;
    } else if (stItem.status === 'Bolos') {
      defaultIncident = 'Bolos / Meninggalkan Jam Pelajaran Tanpa Izin Guru';
      defaultRisk = 'Tinggi (Kritis)';
    } else if (stItem.status === 'Alpa') {
      defaultIncident = 'Alpa / Tidak Mengikuti KBM Tanpa Keterangan';
    }

    setBkReferralStudent(student);
    setBkForm({
      category: 'Konseling Akademik/Sikap',
      statusResiko: defaultRisk,
      incidentType: defaultIncident,
      note: `Laporan Guru Kelas/Mapel (${subjectName}): Siswa ${defaultIncident}. ${stItem.notes ? 'Catatan: ' + stItem.notes : ''}`,
      actionTaken: 'Mengarahkan rujukan laporan ke Guru Bimbingan Konseling (BK) untuk pemanggilan & pendampingan.'
    });
    setShowBkModal(true);
  };

  const handleSendBkReferral = async () => {
    if (!bkReferralStudent) return;
    setSendingBk(true);

    const res = await apiService.addBKNote({
      studentId: bkReferralStudent.id,
      studentName: bkReferralStudent.name,
      nisn: bkReferralStudent.nisn,
      className: bkReferralStudent.className,
      date: kbmDate,
      time: new Date().toTimeString().split(' ')[0].substring(0, 5),
      counselorName: `Rujukan dari Guru: ${user.name} (${subjectName})`,
      category: bkForm.category,
      statusResiko: bkForm.statusResiko,
      note: bkForm.note,
      actionTaken: bkForm.actionTaken,
      spLevel: 'Tanpa SP'
    });

    setSendingBk(false);
    if (res.success) {
      alert(`Laporan rujukan siswa ${bkReferralStudent.name} berhasil dikirim ke Guru BK!`);
      setShowBkModal(false);
      setBkReferralStudent(null);
      onRefreshData();
    } else {
      alert(res.error || 'Gagal mengirim laporan ke BK');
    }
  };

  // Roster Filtered Search
  const filteredStudents = classStudents.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.nisn.includes(searchQuery)
  );

  // Counts
  const countHadir = Object.values(rosterMap).filter((v: StudentStatusItem) => v.status === 'Hadir').length;
  const countIzin = Object.values(rosterMap).filter((v: StudentStatusItem) => v.status === 'Izin').length;
  const countSakit = Object.values(rosterMap).filter((v: StudentStatusItem) => v.status === 'Sakit').length;
  const countPulangAwal = Object.values(rosterMap).filter((v: StudentStatusItem) => v.status === 'Pulang Awal').length;
  const countBolos = Object.values(rosterMap).filter((v: StudentStatusItem) => v.status === 'Bolos').length;
  const countAlpa = Object.values(rosterMap).filter((v: StudentStatusItem) => v.status === 'Alpa').length;

  return (
    <div className="space-y-6">
      {/* Top Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-950 text-white rounded-3xl p-6 shadow-xl border border-emerald-800 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold text-amber-300 uppercase tracking-widest bg-emerald-950/90 px-3 py-1 rounded-full border border-amber-400/30">
                MODUL ADMINISTRASI KELAS & KBM
              </span>
              <span className="text-[10px] font-extrabold text-teal-200 uppercase tracking-widest bg-teal-900/80 px-2.5 py-1 rounded-full border border-teal-500/30">
                KHUSUS AKSES GURU
              </span>
            </div>
            <h2 className="text-2xl font-black mt-2 tracking-tight flex items-center gap-2.5">
              <BookOpen className="w-7 h-7 text-amber-400" />
              Presensi & Administrasi Pembelajaran
            </h2>
            <p className="text-xs text-emerald-200/90 mt-1 max-w-2xl font-medium">
              Pengelolaan kehadiran siswa saat jam pelajaran, pencatatan izin pulang awal / meninggalkan kelas, serta integrasi rujukan instan ke Guru BK.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveKbmAttendance}
              disabled={isSaving}
              className="flex items-center gap-2 px-5 py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-2xl shadow-lg transition-transform hover:scale-105 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Simpan Presensi KBM Kelas
            </button>
          </div>
        </div>
      </div>

      {saveSuccessMsg && (
        <div className="p-4 bg-emerald-50 text-emerald-900 rounded-2xl border border-emerald-300 font-bold text-xs flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
          <button onClick={() => setSaveSuccessMsg(null)} className="text-xs text-emerald-700 underline font-bold">Tutup</button>
        </div>
      )}

      {/* Class & KBM Subject Control Card */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
            <Filter className="w-4 h-4 text-emerald-600" />
            Pengaturan Sesi Pembelajaran & Kelas
          </h3>
          <span className="text-xs font-semibold text-slate-500">
            Pengajar: <strong className="text-emerald-800">{user.name}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">
              Pilih Kelas Target
            </label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500"
            >
              {classes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.studentCount} Siswa)
                </option>
              ))}
            </select>
          </div>

          <div>
            {isCustomSubject ? (
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                    Mata Pelajaran (Manual)
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCustomSubject(false)}
                    className="text-[10px] font-bold text-emerald-700 hover:underline cursor-pointer"
                  >
                    Pilih dari Daftar
                  </button>
                </div>
                <input
                  type="text"
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  placeholder="Ketik nama mata pelajaran..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                  autoFocus
                />
              </div>
            ) : assignedSubjects.length === 1 ? (
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                    Mata Pelajaran Diampu
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCustomSubject(true)}
                    className="text-[10px] font-bold text-emerald-700 hover:underline cursor-pointer"
                  >
                    Substitusi Mapel
                  </button>
                </div>
                <div className="bg-emerald-50/90 border border-emerald-200 rounded-xl p-2.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                      📚
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-extrabold text-slate-900 truncate">{subjectName}</p>
                        <span className="bg-emerald-200/70 text-emerald-900 text-[9px] font-bold px-1.5 py-0.2 rounded-full border border-emerald-300">
                          Otomatis Admin
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 truncate">1 Mapel diampu, tidak perlu pilih manual</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : assignedSubjects.length > 1 ? (
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                    Mata Pelajaran ({assignedSubjects.length} Diampu)
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCustomSubject(true)}
                    className="text-[10px] font-bold text-emerald-700 hover:underline cursor-pointer"
                  >
                    + Mapel Lain
                  </button>
                </div>
                <select
                  value={subjectName}
                  onChange={(e) => {
                    if (e.target.value === '__CUSTOM__') {
                      setIsCustomSubject(true);
                    } else {
                      setSubjectName(e.target.value);
                    }
                  }}
                  className="w-full p-2.5 bg-amber-50/80 border border-amber-300 rounded-xl text-xs font-extrabold text-amber-950 focus:ring-2 focus:ring-amber-500 cursor-pointer"
                >
                  {assignedSubjects.map((sbj) => (
                    <option key={sbj} value={sbj}>
                      📚 {sbj} (Mapel Diampu)
                    </option>
                  ))}
                  <option value="__CUSTOM__">➕ Input Mapel Lain (Substitusi)...</option>
                </select>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                    Mata Pelajaran
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCustomSubject(true)}
                    className="text-[10px] font-bold text-emerald-700 hover:underline cursor-pointer"
                  >
                    + Manual
                  </button>
                </div>
                <select
                  value={allSubjects.includes(subjectName) ? subjectName : subjectName ? '__CUSTOM__' : ''}
                  onChange={(e) => {
                    if (e.target.value === '__CUSTOM__') {
                      setIsCustomSubject(true);
                    } else {
                      setSubjectName(e.target.value);
                    }
                  }}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  {allSubjects.map((sbj) => (
                    <option key={sbj} value={sbj}>
                      {sbj}
                    </option>
                  ))}
                  <option value="__CUSTOM__">➕ Input Mapel Lain (Manual)...</option>
                </select>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                Jam Pelajaran / Sesi
              </label>
              <button
                type="button"
                onClick={() => setShowSessionModal(true)}
                className="text-[10px] font-extrabold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 px-2 py-0.5 rounded-lg border border-emerald-300 flex items-center gap-1 cursor-pointer transition-all"
                title="Atur & Sesuaikan Sesi Jam Pelajaran"
              >
                <Settings className="w-3 h-3 text-emerald-800" />
                Atur Sesi
              </button>
            </div>
            <select
              value={sessionHour}
              onChange={(e) => setSessionHour(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500"
            >
              {sessionList.map((ses, idx) => (
                <option key={idx} value={ses}>
                  {ses}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">
              Tanggal Pembelajaran
            </label>
            <input
              type="date"
              value={kbmDate}
              onChange={(e) => setKbmDate(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Metrics Counter Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-[10px] font-extrabold uppercase text-emerald-700">Hadir</p>
            <p className="text-xl font-black text-emerald-950">{countHadir}</p>
          </div>
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
        </div>

        <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-[10px] font-extrabold uppercase text-amber-700">Izin</p>
            <p className="text-xl font-black text-amber-950">{countIzin}</p>
          </div>
          <Clock className="w-5 h-5 text-amber-600" />
        </div>

        <div className="bg-blue-50 border border-blue-200 p-3.5 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-[10px] font-extrabold uppercase text-blue-700">Sakit</p>
            <p className="text-xl font-black text-blue-950">{countSakit}</p>
          </div>
          <AlertTriangle className="w-5 h-5 text-blue-600" />
        </div>

        <div className="bg-orange-50 border border-orange-200 p-3.5 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-[10px] font-extrabold uppercase text-orange-800">Pulang Awal</p>
            <p className="text-xl font-black text-orange-950">{countPulangAwal}</p>
          </div>
          <DoorOpen className="w-5 h-5 text-orange-600" />
        </div>

        <div className="bg-purple-50 border border-purple-200 p-3.5 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-[10px] font-extrabold uppercase text-purple-800">Bolos Kelas</p>
            <p className="text-xl font-black text-purple-950">{countBolos}</p>
          </div>
          <XCircle className="w-5 h-5 text-purple-600" />
        </div>

        <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-[10px] font-extrabold uppercase text-rose-800">Alpa</p>
            <p className="text-xl font-black text-rose-950">{countAlpa}</p>
          </div>
          <XCircle className="w-5 h-5 text-rose-600" />
        </div>
      </div>

      {/* Main Roster & Status Table Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Table Header Controls */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-700" />
            <h3 className="font-black text-slate-900 text-sm">
              Daftar Presensi KBM - Kelas {currentClassObj?.name || selectedClassId} ({classStudents.length} Siswa)
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Cari siswa..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 w-44"
              />
            </div>

            <button
              onClick={handleSetAllHadir}
              className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5 text-amber-300" />
              Tandai Semua Hadir
            </button>
          </div>
        </div>

        {/* Roster Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-100 border-b border-slate-200 font-extrabold uppercase text-[10px] text-slate-600">
              <tr>
                <th className="p-3.5 w-12 text-center">No</th>
                <th className="p-3.5">NISN & Nama Siswa</th>
                <th className="p-3.5">Status Kehadiran KBM Hari Ini</th>
                <th className="p-3.5">Jam & Alasan Pulang / Bolos</th>
                <th className="p-3.5 text-right">Aksi BK & Laporan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-xs text-slate-400">
                    Tidak ada siswa ditemukan di kelas {currentClassObj?.name}.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((st, index) => {
                  const currentStItem = rosterMap[st.nisn] || { status: 'Hadir', notes: '', timePulangAwal: '10:15' };
                  const isProblematic = currentStItem.status === 'Pulang Awal' || currentStItem.status === 'Bolos' || currentStItem.status === 'Alpa';

                  return (
                    <tr
                      key={`${st.id}-${index}`}
                      className={`hover:bg-slate-50 transition-colors ${
                        isProblematic ? 'bg-amber-50/30' : ''
                      }`}
                    >
                      <td className="p-3.5 text-center font-bold text-slate-400">{index + 1}</td>
                      <td className="p-3.5">
                        <div className="font-black text-slate-900 text-xs">{st.name}</div>
                        <div className="font-mono text-[11px] text-slate-500 font-semibold">
                          NISN: {st.nisn} • Gender: {st.gender === 'L' ? 'Laki-laki' : 'Perempuan'}
                        </div>
                      </td>

                      {/* Status Selector Pills */}
                      <td className="p-3.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleStatusChange(st.nisn, 'Hadir')}
                            className={`px-2.5 py-1 rounded-xl text-[11px] font-black cursor-pointer transition-all ${
                              currentStItem.status === 'Hadir'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            Hadir
                          </button>

                          <button
                            type="button"
                            onClick={() => handleStatusChange(st.nisn, 'Izin')}
                            className={`px-2.5 py-1 rounded-xl text-[11px] font-black cursor-pointer transition-all ${
                              currentStItem.status === 'Izin'
                                ? 'bg-amber-500 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            Izin
                          </button>

                          <button
                            type="button"
                            onClick={() => handleStatusChange(st.nisn, 'Sakit')}
                            className={`px-2.5 py-1 rounded-xl text-[11px] font-black cursor-pointer transition-all ${
                              currentStItem.status === 'Sakit'
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            Sakit
                          </button>

                          <button
                            type="button"
                            onClick={() => handleStatusChange(st.nisn, 'Pulang Awal')}
                            className={`px-2.5 py-1 rounded-xl text-[11px] font-black cursor-pointer transition-all ${
                              currentStItem.status === 'Pulang Awal'
                                ? 'bg-orange-600 text-white shadow-xs ring-2 ring-orange-300'
                                : 'bg-orange-50 text-orange-800 hover:bg-orange-100 border border-orange-200'
                            }`}
                            title="Pulang Sebelum Waktunya"
                          >
                            🚪 Pulang Awal
                          </button>

                          <button
                            type="button"
                            onClick={() => handleStatusChange(st.nisn, 'Bolos')}
                            className={`px-2.5 py-1 rounded-xl text-[11px] font-black cursor-pointer transition-all ${
                              currentStItem.status === 'Bolos'
                                ? 'bg-purple-700 text-white shadow-xs ring-2 ring-purple-300'
                                : 'bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200'
                            }`}
                            title="Meninggalkan Kelas / Bolos"
                          >
                            ⚠️ Bolos
                          </button>

                          <button
                            type="button"
                            onClick={() => handleStatusChange(st.nisn, 'Alpa')}
                            className={`px-2.5 py-1 rounded-xl text-[11px] font-black cursor-pointer transition-all ${
                              currentStItem.status === 'Alpa'
                                ? 'bg-rose-600 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            Alpa
                          </button>
                        </div>
                      </td>

                      {/* Detail inputs for Pulang Awal / Notes */}
                      <td className="p-3.5">
                        {currentStItem.status === 'Pulang Awal' && (
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-[10px] font-extrabold text-orange-900 bg-orange-100 px-1.5 py-0.5 rounded">
                              Jam:
                            </span>
                            <input
                              type="time"
                              value={currentStItem.timePulangAwal || '10:15'}
                              onChange={(e) => handleTimePulangAwalChange(st.nisn, e.target.value)}
                              className="px-2 py-1 border border-orange-300 bg-orange-50/80 rounded-lg text-xs font-mono font-bold text-orange-900 w-24"
                            />
                          </div>
                        )}

                        <input
                          type="text"
                          placeholder={
                            currentStItem.status === 'Pulang Awal'
                              ? 'Alasan pulang sebelum waktunya (mis: Sakit/dijemput ortu)...'
                              : currentStItem.status === 'Bolos'
                              ? 'Catatan kejadian bolos di jam KBM...'
                              : 'Catatan siswa saat KBM...'
                          }
                          value={currentStItem.notes}
                          onChange={(e) => handleNotesChange(st.nisn, e.target.value)}
                          className={`w-full p-1.5 border rounded-xl text-xs font-medium focus:ring-2 ${
                            currentStItem.status === 'Pulang Awal'
                              ? 'border-orange-300 bg-orange-50/50 text-orange-950'
                              : currentStItem.status === 'Bolos'
                              ? 'border-purple-300 bg-purple-50/50 text-purple-950'
                              : 'border-slate-300 bg-white text-slate-800'
                          }`}
                        />
                      </td>

                      {/* BK Referral Action Button */}
                      <td className="p-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenBkModal(st)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all inline-flex items-center gap-1.5 ${
                            isProblematic
                              ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-md animate-pulse border border-amber-500'
                              : 'bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200'
                          }`}
                          title="Kirim Catatan Kejadian / Presensi Siswa ke Guru BK"
                        >
                          <HeartHandshake className="w-3.5 h-3.5 text-teal-900" />
                          <span>Laporkan ke Guru BK</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION PENGINGAT TUGAS MATA PELAJARAN PERTEMUAN SEBELUMNYA */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
              <Bell className="w-5 h-5 text-amber-700 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-slate-900 text-sm">
                  Pengingat Tugas Pertemuan Sebelumnya ({subjectName} - Kelas {currentClassObj?.name || selectedClassId})
                </h3>
                <span className="bg-amber-100 text-amber-900 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-amber-300">
                  Penagihan & Pemeriksaan
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Daftar tugas yang telah diberikan kepada siswa pada pertemuan sebelumnya untuk ditagih, diperiksa, atau dimasukkan dalam catatan KBM hari ini.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAssignmentHistoryModal(true)}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <FolderOpen className="w-4 h-4 text-slate-600" />
              Semua Riwayat Tugas ({assignmentsList.length})
            </button>
            <button
              type="button"
              onClick={() => setShowNewAssignmentModal(true)}
              className="px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Plus className="w-4 h-4 text-amber-300" />
              + Buat Tugas Baru
            </button>
          </div>
        </div>

        {/* List of relevant assignments for current selected class/subject */}
        {(() => {
          const classAssignments = assignmentsList.filter(
            a => a.classId === selectedClassId || a.className === currentClassObj?.name
          );
          const pendingAssignments = classAssignments.filter(a => a.status === 'PENDING');

          if (classAssignments.length === 0) {
            return (
              <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center">
                <ClipboardCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <h4 className="font-bold text-slate-700 text-xs">Belum ada catatan tugas untuk kelas & mata pelajaran ini.</h4>
                <p className="text-[11px] text-slate-500 mt-0.5 mb-3">
                  Anda dapat membuat catatan tugas baru yang akan diberikan kepada siswa hari ini untuk ditagih pada pertemuan berikutnya.
                </p>
                <button
                  type="button"
                  onClick={() => setShowNewAssignmentModal(true)}
                  className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Buat Tugas Baru Hari Ini
                </button>
              </div>
            );
          }

          return (
            <div className="space-y-3">
              {pendingAssignments.length > 0 && (
                <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="text-xs font-bold text-amber-900">
                      Ada {pendingAssignments.length} tugas aktif pertemuan sebelumnya yang BELUM diperiksa/ditagih!
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-amber-800 bg-amber-200/80 px-2.5 py-0.5 rounded-full">
                    Perlu Penagihan
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {classAssignments.slice(0, 4).map((asg) => {
                  const isPending = asg.status === 'PENDING';
                  const isCheckedToday = asg.status === 'CHECKED_TODAY';

                  return (
                    <div
                      key={asg.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        isPending
                          ? 'bg-amber-50/40 border-amber-200 shadow-xs'
                          : isCheckedToday
                          ? 'bg-emerald-50/50 border-emerald-200'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2 mb-1.5">
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700">
                          {asg.subjectName || subjectName}
                        </span>
                        <div className="flex items-center gap-1">
                          {isPending && (
                            <span className="text-[10px] font-bold text-amber-800 bg-amber-200/80 px-2 py-0.5 rounded-md flex items-center gap-1">
                              <Clock className="w-3 h-3 text-amber-700" /> Ditagih Hari Ini
                            </span>
                          )}
                          {isCheckedToday && (
                            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-200/80 px-2 py-0.5 rounded-md flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-700" /> Sudah Ditagih ({asg.checkedDate})
                            </span>
                          )}
                          {asg.status === 'COMPLETED' && (
                            <span className="text-[10px] font-bold text-slate-600 bg-slate-200 px-2 py-0.5 rounded-md">
                              Selesai
                            </span>
                          )}
                        </div>
                      </div>

                      <h4 className="font-bold text-slate-900 text-xs leading-snug">{asg.title}</h4>
                      {asg.description && (
                        <p className="text-[11px] text-slate-600 mt-1 line-clamp-2 leading-relaxed bg-white/70 p-2 rounded-xl border border-slate-100">
                          {asg.description}
                        </p>
                      )}

                      <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                        <div className="flex items-center gap-2">
                          <span>Diberikan: <strong className="text-slate-700 font-mono">{asg.givenDate}</strong></span>
                          {asg.dueDate && (
                            <span>Batas: <strong className="text-rose-700 font-mono">{asg.dueDate}</strong></span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {isPending && (
                            <button
                              type="button"
                              onClick={() => handleMarkAssignmentChecked(asg.id)}
                              className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[10px] font-bold cursor-pointer transition-colors flex items-center gap-1"
                              title="Tandai tugas ini telah diperiksa saat KBM berlangsung"
                            >
                              <CheckSquare className="w-3 h-3 text-amber-300" /> Tandai Sudah Ditagih
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleAppendAssignmentToJournal(asg)}
                            className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg text-[10px] font-bold cursor-pointer transition-colors"
                            title="Masukkan info penagihan tugas ini ke Jurnal Mengajar Hari Ini"
                          >
                            + Ke Jurnal KBM
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteAssignment(asg.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Hapus Catatan Tugas"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Quick Input Form for New Assignment given today */}
              <div className="mt-3 pt-3 border-t border-slate-100 bg-slate-50 p-3.5 rounded-2xl border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <ListTodo className="w-4 h-4 text-emerald-700" />
                    Beri Tugas Baru untuk Ditagih pada Pertemuan Berikutnya?
                  </span>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasTodayAssignment}
                      onChange={(e) => setHasTodayAssignment(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                    />
                    Ya, Beri Tugas Hari Ini
                  </label>
                </div>

                {hasTodayAssignment && (
                  <div className="space-y-2.5 mt-2.5 animate-in fade-in duration-150">
                    <div>
                      <input
                        type="text"
                        placeholder="Judul / Nama Tugas (Cth: Latihan Soal Bab 4 Halaman 80 No. 1-5)"
                        value={todayAssignmentTitle}
                        onChange={(e) => setTodayAssignmentTitle(e.target.value)}
                        className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="sm:col-span-2">
                        <input
                          type="text"
                          placeholder="Instruksi / Catatan Pengerjaan Tugas (Opsional)"
                          value={todayAssignmentDesc}
                          onChange={(e) => setTodayAssignmentDesc(e.target.value)}
                          className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <input
                          type="date"
                          value={todayAssignmentDueDate}
                          onChange={(e) => setTodayAssignmentDueDate(e.target.value)}
                          className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                        />
                      </div>
                    </div>
                    <p className="text-[11px] text-emerald-700 font-medium">
                      *Tugas yang ditulis di sini akan otomatis disimpan bersama Presensi & Jurnal KBM, dan muncul sebagai pengingat di pertemuan berikutnya.
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Jurnal Mengajar & Catatan Guru Section */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-600" />
            Jurnal Mengajar & Catatan Guru Kelas ({subjectName})
          </h3>
          <span className="text-xs font-extrabold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
            {kbmDate}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Materi / Pokok Bahasan Pembelajaran Hari Ini
            </label>
            <textarea
              rows={3}
              value={topicSubject}
              onChange={(e) => setTopicSubject(e.target.value)}
              placeholder="Contoh: Bab 3 - Persamaan & Fungsi Kuadrat, Diskusi kelompok & latihan soal halaman 45."
              className="w-full p-3 bg-slate-50 border border-slate-300 rounded-2xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Catatan / Kendala Kelas Selama KBM
            </label>
            <textarea
              rows={3}
              value={classNotes}
              onChange={(e) => setClassNotes(e.target.value)}
              placeholder="Contoh: Siswa aktif berdiskusi. 1 siswa izin ke ruang UKS pada jam ke-2 dan diizinkan pulang awal."
              className="w-full p-3 bg-slate-50 border border-slate-300 rounded-2xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={handleSaveKbmAttendance}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-800 hover:bg-emerald-900 text-white font-black text-xs rounded-2xl shadow-md cursor-pointer transition-all"
          >
            {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 text-amber-300" />}
            Simpan Presensi & Jurnal KBM Kelas
          </button>
        </div>
      </div>

      {/* MODAL REFERRAL TO GURU BK */}
      {showBkModal && bkReferralStudent && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-emerald-950 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <HeartHandshake className="w-6 h-6 text-amber-300" />
                <div>
                  <h3 className="font-extrabold text-sm">Laporan Rujukan ke Guru BK</h3>
                  <p className="text-[11px] text-teal-200">Layanan Bimbingan & Konseling SMA Islam Ra'iyatul Husnan</p>
                </div>
              </div>
              <button
                onClick={() => setShowBkModal(false)}
                className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-xl cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3.5 bg-teal-50 border border-teal-200 rounded-2xl flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-700 text-white font-black flex items-center justify-center text-sm">
                  {bkReferralStudent.name.charAt(0)}
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-sm">{bkReferralStudent.name}</h4>
                  <p className="text-xs text-teal-800 font-semibold">
                    NISN: {bkReferralStudent.nisn} • Kelas: {bkReferralStudent.className}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Kategori Masalah BK</label>
                <select
                  value={bkForm.category}
                  onChange={(e) => setBkForm({ ...bkForm, category: e.target.value as any })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                >
                  <option value="Konseling Akademik/Sikap">Konseling Akademik/Sikap</option>
                  <option value="Konseling Individual">Konseling Individual</option>
                  <option value="Pemanggilan Orang Tua">Pemanggilan Orang Tua</option>
                  <option value="Surat Peringatan (SP)">Surat Peringatan (SP)</option>
                  <option value="Home Visit">Home Visit</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tingkat Risiko Siswa</label>
                <select
                  value={bkForm.statusResiko}
                  onChange={(e) => setBkForm({ ...bkForm, statusResiko: e.target.value as any })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                >
                  <option value="Rendah">Rendah (Peringatan Ringan)</option>
                  <option value="Sedang">Sedang (Perlu Konseling/Pendampingan)</option>
                  <option value="Tinggi (Kritis)">Tinggi (Kritis / Pemanggilan Ortu)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Isi Laporan Guru Kelas</label>
                <textarea
                  rows={4}
                  value={bkForm.note}
                  onChange={(e) => setBkForm({ ...bkForm, note: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tindakan Awal Guru / Harapan Tindak Lanjut BK</label>
                <input
                  type="text"
                  value={bkForm.actionTaken}
                  onChange={(e) => setBkForm({ ...bkForm, actionTaken: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowBkModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSendBkReferral}
                  disabled={sendingBk}
                  className="px-5 py-2.5 bg-teal-800 hover:bg-teal-900 text-white font-extrabold text-xs rounded-xl cursor-pointer flex items-center gap-1.5 shadow-md"
                >
                  {sendingBk ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 text-amber-300" />}
                  Kirim Laporan ke Guru BK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL BUAT TUGAS BARU MANUAL */}
      {showNewAssignmentModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-emerald-900 to-teal-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ListTodo className="w-6 h-6 text-amber-300" />
                <div>
                  <h3 className="font-extrabold text-sm">Buat Catatan Tugas Mata Pelajaran</h3>
                  <p className="text-[11px] text-teal-200">Kelas {currentClassObj?.name || selectedClassId} - {subjectName}</p>
                </div>
              </div>
              <button
                onClick={() => setShowNewAssignmentModal(false)}
                className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-xl cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Judul / Materi Tugas</label>
                <input
                  type="text"
                  placeholder="Contoh: Latihan Soal Persamaan Kuadrat Hal 45"
                  value={manualAssignmentForm.title}
                  onChange={(e) => setManualAssignmentForm({ ...manualAssignmentForm, title: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Instruksi & Deskripsi Tugas</label>
                <textarea
                  rows={3}
                  placeholder="Instruksi pengerjaan di buku tugas/catatan..."
                  value={manualAssignmentForm.description}
                  onChange={(e) => setManualAssignmentForm({ ...manualAssignmentForm, description: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tanggal Diberikan</label>
                  <input
                    type="date"
                    value={manualAssignmentForm.givenDate}
                    onChange={(e) => setManualAssignmentForm({ ...manualAssignmentForm, givenDate: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tanggal Penagihan / Batas</label>
                  <input
                    type="date"
                    value={manualAssignmentForm.dueDate}
                    onChange={(e) => setManualAssignmentForm({ ...manualAssignmentForm, dueDate: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Status Awal</label>
                <select
                  value={manualAssignmentForm.status}
                  onChange={(e) => setManualAssignmentForm({ ...manualAssignmentForm, status: e.target.value as any })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                >
                  <option value="PENDING">PENDING (Perlu Ditagih pada Pertemuan Berikutnya)</option>
                  <option value="CHECKED_TODAY">CHECKED_TODAY (Sudah Ditagih/Diperiksa Hari Ini)</option>
                  <option value="COMPLETED">COMPLETED (Selesai)</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewAssignmentModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleAddManualAssignment}
                  className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold text-xs rounded-xl cursor-pointer shadow-md flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4 text-amber-300" />
                  Simpan Catatan Tugas
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SEMUA RIWAYAT TUGAS */}
      {showAssignmentHistoryModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-emerald-950 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FolderOpen className="w-6 h-6 text-amber-300" />
                <div>
                  <h3 className="font-extrabold text-sm">Riwayat & Modul Penagihan Tugas KBM</h3>
                  <p className="text-[11px] text-teal-200">Seluruh tugas terdaftar untuk Kelas {currentClassObj?.name || selectedClassId}</p>
                </div>
              </div>
              <button
                onClick={() => setShowAssignmentHistoryModal(false)}
                className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-xl cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
              {assignmentsList.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  Belum ada riwayat tugas yang disimpan.
                </div>
              ) : (
                assignmentsList.map((asg) => (
                  <div key={asg.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 mr-2">
                          {asg.className || selectedClassId} • {asg.subjectName || subjectName}
                        </span>
                        <h4 className="font-extrabold text-slate-900 text-xs inline-block mt-1">{asg.title}</h4>
                      </div>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                        asg.status === 'PENDING'
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : asg.status === 'CHECKED_TODAY'
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          : 'bg-slate-200 text-slate-700'
                      }`}>
                        {asg.status}
                      </span>
                    </div>

                    {asg.description && (
                      <p className="text-xs text-slate-600 bg-white p-2 rounded-xl border border-slate-100">
                        {asg.description}
                      </p>
                    )}

                    <div className="flex justify-between items-center pt-1 text-[11px] text-slate-500">
                      <span>Diberikan oleh: <strong>{asg.teacherName}</strong> ({asg.givenDate})</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteAssignment(asg.id)}
                        className="text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Hapus
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
              <span className="text-xs text-slate-500 font-medium">Total Tugas: <strong>{assignmentsList.length}</strong></span>
              <button
                type="button"
                onClick={() => setShowAssignmentHistoryModal(false)}
                className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIGURATION JAM PELAJARAN / SESI */}
      {showSessionModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-950 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Settings className="w-6 h-6 text-amber-300" />
                <div>
                  <h3 className="font-extrabold text-sm">Pengaturan Jam Pelajaran / Sesi KBM</h3>
                  <p className="text-[11px] text-emerald-200">Sesuaikan jadwal & rentang jam pelajaran sekolah</p>
                </div>
              </div>
              <button
                onClick={() => setShowSessionModal(false)}
                className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-xl cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Add New Session Form */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <PlusCircle className="w-4 h-4 text-emerald-600" />
                  Tambah Sesi / Jam Pelajaran Baru
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSessionInput}
                    onChange={(e) => setNewSessionInput(e.target.value)}
                    placeholder="Contoh: Jam ke 9 - 10 (14:00 - 15:15) / Sesi Ke-0"
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSession();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddSession}
                    className="px-4 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold text-xs rounded-xl cursor-pointer flex items-center gap-1 shrink-0"
                  >
                    <Plus className="w-4 h-4 text-amber-300" />
                    Tambah
                  </button>
                </div>
              </div>

              {/* Existing Session List */}
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-700">Daftar Sesi Jam Pelajaran ({sessionList.length})</span>
                  <button
                    type="button"
                    onClick={handleResetSessions}
                    className="text-[11px] font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset ke Standar
                  </button>
                </div>

                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                  {sessionList.map((sesItem, idx) => (
                    <div key={idx} className="p-3 flex items-center justify-between gap-2 hover:bg-slate-50 transition-colors">
                      {editingSessionIndex === idx ? (
                        <div className="flex items-center gap-2 w-full">
                          <input
                            type="text"
                            value={editingSessionText}
                            onChange={(e) => setEditingSessionText(e.target.value)}
                            className="w-full p-1.5 border border-emerald-400 bg-white rounded-lg text-xs font-bold text-slate-800"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEditSession(idx)}
                            className="px-2.5 py-1.5 bg-emerald-700 text-white text-xs font-bold rounded-lg cursor-pointer"
                          >
                            Simpan
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingSessionIndex(null)}
                            className="px-2 py-1.5 bg-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-black flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <span className="text-xs font-bold text-slate-800">{sesItem}</span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleMoveSession(idx, 'up')}
                              disabled={idx === 0}
                              className="p-1 hover:bg-slate-200 text-slate-500 rounded disabled:opacity-30 cursor-pointer"
                              title="Naikkan urutan"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveSession(idx, 'down')}
                              disabled={idx === sessionList.length - 1}
                              className="p-1 hover:bg-slate-200 text-slate-500 rounded disabled:opacity-30 cursor-pointer"
                              title="Turunkan urutan"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStartEditSession(idx)}
                              className="p-1 hover:bg-emerald-100 text-emerald-700 rounded cursor-pointer"
                              title="Edit Teks"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSession(idx)}
                              className="p-1 hover:bg-rose-100 text-rose-600 rounded cursor-pointer"
                              title="Hapus Sesi"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowSessionModal(false)}
                  className="px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-black text-xs rounded-xl shadow-md cursor-pointer"
                >
                  Selesai & Gunakan Sesi Ini
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
