import React, { useState } from 'react';
import { Student, Teacher, ClassRoom, AttendanceRecord, AttendanceStatus } from '../types';
import { apiService } from '../services/apiService';
import { exportAttendanceToExcel, downloadStudentTemplate, downloadTeacherTemplate, parseExcelFile } from '../utils/excelHelper';
import { findMatchingClass } from '../utils/dataSync';
import { NISNBarcode } from './NISNBarcode';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { GoogleSheetsManager } from './GoogleSheetsManager';
import { SupabaseManager } from './SupabaseManager';
import { DismissalAttendanceSection } from './DismissalAttendanceSection';
import { BulkStudentCardPrinter } from './BulkStudentCardPrinter';
import { QRCodeGeneratorModal } from './QRCodeGeneratorModal';
import { StudentQRCodeCardModal } from './StudentQRCodeCardModal';
import { AttendanceSettingsSection } from './AttendanceSettingsSection';
import { MonthlyAttendanceReport } from './MonthlyAttendanceReport';
import { MainDashboardOverview } from './MainDashboardOverview';
import { DisciplineAnalysis } from './DisciplineAnalysis';
import { BKCounselingSection } from './BKCounselingSection';
import { TeacherClassAdminSection } from './TeacherClassAdminSection';
import { BKNote } from '../types';
import {
  Users, UserCheck, GraduationCap, School, Barcode, FileSpreadsheet,
  Plus, Edit, Trash2, Search, Filter, Download, Upload, CheckCircle2,
  XCircle, Clock, AlertTriangle, RefreshCw, Key, ArrowDownToLine, Eye, DoorOpen,
  Printer, CreditCard, Image as ImageIcon, Camera, X, Award, HeartHandshake, QrCode
} from 'lucide-react';

interface AdminDashboardProps {
  students: Student[];
  teachers: Teacher[];
  classes: ClassRoom[];
  attendanceRecords: AttendanceRecord[];
  bkNotes?: BKNote[];
  onRefreshData: () => void;
  externalActiveTab?: 'dashboard' | 'master' | 'discipline' | 'bk' | 'teacherAdmin' | 'scan' | 'reports' | 'import' | 'settings';
  externalMasterSubTab?: 'students' | 'teachers' | 'classes' | 'guardians';
  onTabChange?: (tab: 'dashboard' | 'master' | 'discipline' | 'bk' | 'teacherAdmin' | 'scan' | 'reports' | 'import' | 'settings', subTab?: 'students' | 'teachers' | 'classes' | 'guardians') => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  students,
  teachers,
  classes,
  attendanceRecords,
  bkNotes = [],
  onRefreshData,
  externalActiveTab,
  externalMasterSubTab,
  onTabChange
}) => {
  const [activeTab, setActiveTabState] = useState<'dashboard' | 'master' | 'discipline' | 'bk' | 'teacherAdmin' | 'scan' | 'reports' | 'import' | 'settings'>('dashboard');
  const [masterSubTab, setMasterSubTabState] = useState<'students' | 'teachers' | 'classes' | 'guardians'>('students');

  React.useEffect(() => {
    if (externalActiveTab) setActiveTabState(externalActiveTab as any);
  }, [externalActiveTab]);

  React.useEffect(() => {
    if (externalMasterSubTab) setMasterSubTabState(externalMasterSubTab);
  }, [externalMasterSubTab]);

  const setActiveTab = (tab: 'dashboard' | 'master' | 'discipline' | 'bk' | 'teacherAdmin' | 'scan' | 'reports' | 'import' | 'settings') => {
    setActiveTabState(tab);
    if (onTabChange) onTabChange(tab);
  };

  const setMasterSubTab = (subTab: 'students' | 'teachers' | 'classes' | 'guardians') => {
    setMasterSubTabState(subTab);
    if (onTabChange) onTabChange(activeTab, subTab);
  };

  // Scanner modal state
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [showDismissalModal, setShowDismissalModal] = useState(false);

  // Barcode Card Modal state
  const [selectedStudentBarcode, setSelectedStudentBarcode] = useState<Student | null>(null);

  // Bulk Student Card Printing state
  const [showBulkPrintModal, setShowBulkPrintModal] = useState(false);
  const [selectedStudentIdsTable, setSelectedStudentIdsTable] = useState<string[]>([]);

  // QR Code Generator Massal state
  const [showQRCodeModal, setShowQRCodeModal] = useState(false);
  const [singleQRCodeStudent, setSingleQRCodeStudent] = useState<Student | null>(null);

  // Filters for Report & Export
  const [reportsSubTab, setReportsSubTab] = useState<'daily' | 'monthly'>('daily');
  const [reportClassFilter, setReportClassFilter] = useState('all');
  const [reportStartDate, setReportStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [reportEndDate, setReportEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [reportStatusFilter, setReportStatusFilter] = useState('all');
  const [reportSearch, setReportSearch] = useState('');

  // Search in Master Tables
  const [masterSearch, setMasterSearch] = useState('');
  const [masterClassFilter, setMasterClassFilter] = useState('all');
  const [studentCurrentPage, setStudentCurrentPage] = useState(1);

  React.useEffect(() => {
    setStudentCurrentPage(1);
  }, [masterSearch, masterClassFilter]);

  // Student Form Modal State
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [isSavingStudent, setIsSavingStudent] = useState(false);
  const [studentForm, setStudentForm] = useState({
    nisn: '',
    name: '',
    gender: 'L' as 'L' | 'P',
    classId: classes[0]?.id || '',
    parentName: '',
    parentPhone: '',
    photoUrl: ''
  });

  const handleStudentPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 3 * 1024 * 1024) {
        alert('Ukuran foto terlalu besar. Maksimal 3MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setStudentForm(prev => ({ ...prev, photoUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Class Form Modal State
  const [showClassModal, setShowClassModal] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassRoom | null>(null);
  const [isSavingClass, setIsSavingClass] = useState(false);
  const [selectedClassForDetail, setSelectedClassForDetail] = useState<ClassRoom | null>(null);
  const [classDetailSearch, setClassDetailSearch] = useState('');
  const [classForm, setClassForm] = useState({
    name: '',
    gradeLevel: 'X' as 'X' | 'XI' | 'XII',
    teacherId: ''
  });

  // Teacher Form Modal State
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [teacherForm, setTeacherForm] = useState({
    nip: '',
    name: '',
    gender: 'L' as 'L' | 'P',
    username: '',
    password: '',
    subject: '',
    assignedClassId: '',
    role: 'guru' as 'admin' | 'guru' | 'bk'
  });

  // Delete Target Modal State
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'siswa' | 'guru' | 'kelas' | 'siswa_masal';
    id: string;
    name: string;
    detail?: string;
  } | null>(null);
  const [isDeletingTarget, setIsDeletingTarget] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleConfirmDeleteTarget = async () => {
    if (!deleteTarget) return;
    setIsDeletingTarget(true);
    setDeleteError(null);

    try {
      if (deleteTarget.type === 'siswa') {
        const res = await apiService.deleteStudent(deleteTarget.id);
        if (res.success) {
          onRefreshData();
          setDeleteTarget(null);
        } else {
          setDeleteError(res.error || 'Gagal menghapus data siswa.');
        }
      } else if (deleteTarget.type === 'siswa_masal') {
        const res = await apiService.deleteStudents(selectedStudentIdsTable);
        if (res.success) {
          setSelectedStudentIdsTable([]);
          onRefreshData();
          setDeleteTarget(null);
        } else {
          setDeleteError(res.error || 'Gagal menghapus data siswa terpilih.');
        }
      } else if (deleteTarget.type === 'guru') {
        const res = await apiService.deleteTeacher(deleteTarget.id);
        if (res.success) {
          onRefreshData();
          setDeleteTarget(null);
        } else {
          setDeleteError(res.error || 'Gagal menghapus data guru.');
        }
      } else if (deleteTarget.type === 'kelas') {
        const res = await apiService.deleteClass(deleteTarget.id);
        if (res.success) {
          onRefreshData();
          setDeleteTarget(null);
        } else {
          setDeleteError(res.error || 'Gagal menghapus data kelas.');
        }
      }
    } catch (err: any) {
      setDeleteError(err?.message || 'Terjadi kesalahan sistem saat menghapus data.');
    } finally {
      setIsDeletingTarget(false);
    }
  };

  // Import file states
  const [importType, setImportType] = useState<'siswa' | 'guru'>('siswa');
  const [importPreviewData, setImportPreviewData] = useState<any[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importMessage, setImportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];
  const todayAttendance = attendanceRecords.filter(a => a.date === todayStr);

  const totalStudentsCount = students.length;
  const totalHadirToday = todayAttendance.filter(a => a.status === 'Hadir').length;
  const totalIzinToday = todayAttendance.filter(a => a.status === 'Izin').length;
  const totalSakitToday = todayAttendance.filter(a => a.status === 'Sakit').length;
  const totalAlpaToday = todayAttendance.filter(a => a.status === 'Alpa').length;

  // Filtered Students for Master Tab
  const filteredStudents = students.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(masterSearch.toLowerCase()) ||
                        s.nisn.includes(masterSearch) ||
                        s.parentName.toLowerCase().includes(masterSearch.toLowerCase());
    const selectedClassObj = classes.find(c => c.id === masterClassFilter);
    const matchClass = masterClassFilter === 'all' ||
                       s.classId === masterClassFilter ||
                       (selectedClassObj && s.className && s.className.trim().toLowerCase() === selectedClassObj.name.trim().toLowerCase());
    return matchSearch && matchClass;
  }).sort((a, b) => a.name.localeCompare(b.name, 'id', { sensitivity: 'base' }));

  // Filtered Reports
  const filteredReports = attendanceRecords.filter(rec => {
    const selectedClassObj = classes.find(c => c.id === reportClassFilter);
    const matchClass = reportClassFilter === 'all' ||
                       rec.classId === reportClassFilter ||
                       (selectedClassObj && rec.className && rec.className.trim().toLowerCase() === selectedClassObj.name.trim().toLowerCase());
    const matchStatus = reportStatusFilter === 'all' || rec.status === reportStatusFilter;
    const matchStart = !reportStartDate || rec.date >= reportStartDate;
    const matchEnd = !reportEndDate || rec.date <= reportEndDate;
    const matchSearch = !reportSearch || rec.studentName.toLowerCase().includes(reportSearch.toLowerCase()) ||
                        rec.nisn.includes(reportSearch) || rec.className.toLowerCase().includes(reportSearch.toLowerCase());
    return matchClass && matchStatus && matchStart && matchEnd && matchSearch;
  });

  // Handle Save Student
  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingStudent(true);

    try {
      let finalPhotoUrl = studentForm.photoUrl;

      // Automatically upload base64 to Supabase Storage if present
      if (finalPhotoUrl && finalPhotoUrl.startsWith('data:image/')) {
        const uploadRes = await apiService.uploadStudentPhoto(finalPhotoUrl, studentForm.nisn);
        if (uploadRes.success && uploadRes.photoUrl) {
          finalPhotoUrl = uploadRes.photoUrl;
        }
      }

      const selectedClassObj = classes.find(c => c.id === studentForm.classId);
      const payload = {
        ...studentForm,
        className: selectedClassObj?.name || '',
        photoUrl: finalPhotoUrl
      };

      if (editingStudent) {
        const res = await apiService.updateStudent(editingStudent.id, payload);
        if (res.success) {
          onRefreshData();
          setShowStudentModal(false);
        } else {
          alert(res.error || 'Gagal mengubah data');
        }
      } else {
        const res = await apiService.addStudent(payload);
        if (res.success) {
          onRefreshData();
          setShowStudentModal(false);
        } else {
          alert(res.error || 'Gagal menambah data');
        }
      }
    } catch (err: any) {
      alert(err?.message || 'Terjadi kesalahan saat menyimpan data siswa.');
    } finally {
      setIsSavingStudent(false);
    }
  };

  // Open Edit Student
  const handleOpenEditStudent = (st: Student) => {
    setEditingStudent(st);
    setStudentForm({
      nisn: st.nisn,
      name: st.name,
      gender: st.gender,
      classId: st.classId,
      parentName: st.parentName,
      parentPhone: st.parentPhone,
      photoUrl: st.photoUrl || ''
    });
    setShowStudentModal(true);
  };

  // Open New Student
  const handleOpenNewStudent = () => {
    setEditingStudent(null);
    setStudentForm({
      nisn: '',
      name: '',
      gender: 'L',
      classId: classes[0]?.id || '',
      parentName: '',
      parentPhone: '',
      photoUrl: ''
    });
    setShowStudentModal(true);
  };

  // Delete Student
  const handleDeleteStudent = (st: Student) => {
    setDeleteError(null);
    setDeleteTarget({
      type: 'siswa',
      id: st.id,
      name: st.name,
      detail: `NISN: ${st.nisn} • Kelas: ${st.className}`
    });
  };

  // Handle Save Teacher
  const handleSaveTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTeacher) {
      const res = await apiService.updateTeacher(editingTeacher.id, teacherForm);
      if (res.success) {
        onRefreshData();
        setShowTeacherModal(false);
      } else {
        alert(res.error || 'Gagal mengedit data guru');
      }
    } else {
      const res = await apiService.addTeacher(teacherForm);
      if (res.success) {
        onRefreshData();
        setShowTeacherModal(false);
      } else {
        alert(res.error || 'Gagal menambah data guru');
      }
    }
  };

  const handleOpenEditTeacher = (t: Teacher) => {
    setEditingTeacher(t);
    setTeacherForm({
      nip: t.nip,
      name: t.name,
      gender: t.gender,
      username: t.username,
      password: t.password || '',
      subject: t.subject,
      assignedClassId: t.assignedClassId || '',
      role: t.role || (t.subject.toLowerCase().includes('bk') ? 'bk' : 'guru')
    });
    setShowTeacherModal(true);
  };

  const handleOpenNewTeacher = () => {
    setEditingTeacher(null);
    setTeacherForm({
      nip: '',
      name: '',
      gender: 'L',
      username: '',
      password: '',
      subject: '',
      assignedClassId: '',
      role: 'guru'
    });
    setShowTeacherModal(true);
  };

  const handleDeleteTeacher = (t: Teacher) => {
    setDeleteError(null);
    setDeleteTarget({
      type: 'guru',
      id: t.id,
      name: t.name,
      detail: `NIP: ${t.nip || '-'} • Mapel: ${t.subject}`
    });
  };

  // Class Handlers
  const handleSaveClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classForm.name.trim()) {
      alert('Nama kelas wajib diisi!');
      return;
    }
    setIsSavingClass(true);
    try {
      if (editingClass) {
        const res = await apiService.updateClass(editingClass.id, classForm);
        if (res.success) {
          onRefreshData();
          setShowClassModal(false);
        } else {
          alert(res.error || 'Gagal memperbarui data kelas');
        }
      } else {
        const res = await apiService.addClass(classForm);
        if (res.success) {
          onRefreshData();
          setShowClassModal(false);
        } else {
          alert(res.error || 'Gagal menambah kelas baru');
        }
      }
    } catch (err: any) {
      alert(err?.message || 'Terjadi kesalahan saat menyimpan kelas.');
    } finally {
      setIsSavingClass(false);
    }
  };

  const handleOpenEditClass = (cls: ClassRoom) => {
    setEditingClass(cls);
    setClassForm({
      name: cls.name,
      gradeLevel: cls.gradeLevel,
      teacherId: cls.teacherId || ''
    });
    setShowClassModal(true);
  };

  const handleOpenNewClass = () => {
    setEditingClass(null);
    setClassForm({
      name: '',
      gradeLevel: 'X',
      teacherId: ''
    });
    setShowClassModal(true);
  };

  const handleDeleteClass = (c: ClassRoom) => {
    setDeleteError(null);
    setDeleteTarget({
      type: 'kelas',
      id: c.id,
      name: c.name,
      detail: `Tingkat ${c.gradeLevel} • Total ${c.studentCount} Siswa`
    });
  };

  // File import parser
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const json = await parseExcelFile(file);
      setImportPreviewData(json);
      setImportMessage(null);
    } catch (err) {
      setImportMessage({ type: 'error', text: 'Gagal membaca file Excel. Pastikan format sesuai.' });
    }
  };

  // Helper to flexibly extract column values regardless of column casing or naming variations
  const getRowValue = (row: Record<string, any>, possibleKeys: string[]): string => {
    if (!row) return '';
    const keys = Object.keys(row);
    for (const targetKey of possibleKeys) {
      if (row[targetKey] !== undefined && row[targetKey] !== null && String(row[targetKey]).trim() !== '') {
        return String(row[targetKey]).trim();
      }
      const foundKey = keys.find(k => k.trim().toLowerCase() === targetKey.toLowerCase());
      if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && String(row[foundKey]).trim() !== '') {
        return String(row[foundKey]).trim();
      }
    }
    return '';
  };

  const handleExecuteImport = async () => {
    if (importPreviewData.length === 0) return;
    setImportLoading(true);

    if (importType === 'siswa') {
      const formatted = importPreviewData.map(row => {
        const nisnVal = getRowValue(row, ['NISN', 'nisn', 'Nis', 'NIS', 'No Induk']);
        const nameVal = getRowValue(row, ['Nama Siswa', 'Nama', 'name', 'Nama Lengkap', 'Siswa', 'Nama_Siswa']);
        const genderVal = getRowValue(row, ['Jenis Kelamin (L/P)', 'Jenis Kelamin', 'JK', 'L/P', 'Gender', 'gender']);
        const classVal = getRowValue(row, ['Nama Kelas', 'Kelas', 'Rombel', 'Class', 'className', 'Nama_Kelas', 'nama_kelas', 'Rombongan Belajar']);
        const parentNameVal = getRowValue(row, ['Nama Wali Murid', 'Nama Wali', 'Wali', 'Nama Orang Tua', 'parentName', 'Wali Murid']);
        const parentPhoneVal = getRowValue(row, ['No HP Wali', 'No HP', 'No. HP', 'HP Wali', 'No WhatsApp', 'parentPhone', 'Telepon']);

        return {
          nisn: nisnVal,
          name: nameVal,
          gender: genderVal.toUpperCase().startsWith('P') ? 'P' : 'L',
          className: classVal,
          parentName: parentNameVal || 'Wali Murid',
          parentPhone: parentPhoneVal || '-'
        };
      });

      const res = await apiService.importStudents(formatted);
      setImportLoading(false);
      if (res.success) {
        setImportMessage({ type: 'success', text: res.message || 'Import data siswa berhasil!' });
        onRefreshData();
        setImportPreviewData([]);
      } else {
        setImportMessage({ type: 'error', text: res.error || 'Gagal import data.' });
      }
    } else {
      const formatted = importPreviewData.map(row => {
        const nipVal = getRowValue(row, ['NIP', 'nip', 'Nip', 'No NIP']);
        const nameVal = getRowValue(row, ['Nama Guru', 'Nama', 'name', 'Nama Lengkap', 'Guru']);
        const genderVal = getRowValue(row, ['Jenis Kelamin (L/P)', 'Jenis Kelamin', 'gender']);
        const usernameVal = getRowValue(row, ['Username Login', 'Username', 'username', 'User']);
        const subjectVal = getRowValue(row, ['Mata Pelajaran', 'Mapel', 'subject', 'Pelajaran']);

        return {
          nip: nipVal,
          name: nameVal,
          gender: genderVal.toUpperCase().startsWith('P') ? 'P' : 'L',
          username: usernameVal || nipVal || nameVal.toLowerCase().replace(/\s+/g, ''),
          subject: subjectVal || 'Pengajar'
        };
      });

      const res = await apiService.importTeachers(formatted);
      setImportLoading(false);
      if (res.success) {
        setImportMessage({ type: 'success', text: res.message || 'Import data guru berhasil!' });
        onRefreshData();
        setImportPreviewData([]);
      } else {
        setImportMessage({ type: 'error', text: res.error || 'Gagal import data.' });
      }
    }
  };

  // Export Excel action
  const handleExportExcel = () => {
    const selectedClassName = reportClassFilter === 'all'
      ? 'Semua Kelas'
      : (classes.find(c => c.id === reportClassFilter)?.name || reportClassFilter);

    exportAttendanceToExcel(
      filteredReports,
      `Rekap_Absensi_SMA_Islam_Raiyatul_Husnan`,
      selectedClassName
    );
  };

  return (
    <div className="space-y-6">
      {/* TAB 0: DASHBOARD UTAMA */}
      {activeTab === 'dashboard' ? (
        <MainDashboardOverview
          user={{ id: 'admin-1', username: 'admin', name: 'Administrator Utama', role: 'admin' }}
          students={students}
          teachers={teachers}
          classes={classes}
          attendanceRecords={attendanceRecords}
          onNavigateTab={(tab, sub) => {
            setActiveTab(tab);
            if (sub) setMasterSubTab(sub);
          }}
        />
      ) : activeTab === 'discipline' ? (
        <DisciplineAnalysis
          students={students}
          classes={classes}
          attendanceRecords={attendanceRecords}
        />
      ) : (
        <>
          {/* Top Overview Bento Grid (Hidden when activeTab === 'scan') */}
          {activeTab !== 'scan' && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {/* Total Siswa Bento Card */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest">Total Siswa</p>
                  <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <span className="text-3xl font-black text-slate-900">{totalStudentsCount}</span>
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">
                    {classes.length} Kelas
                  </span>
                </div>
              </div>

              {/* Hadir Hari Ini Bento Card (Hero Accent) */}
              <div className="bg-emerald-600 p-5 rounded-2xl shadow-lg text-white flex flex-col justify-between hover:bg-emerald-700 transition-all">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-emerald-100 font-extrabold uppercase tracking-widest">Hadir Hari Ini</p>
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/80 text-white flex items-center justify-center font-bold">
                    <UserCheck className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <span className="text-3xl font-black">{totalHadirToday}</span>
                  <span className="text-[10px] text-emerald-100 font-bold bg-emerald-700/80 px-2 py-1 rounded-lg">
                    {totalStudentsCount ? Math.round((totalHadirToday / totalStudentsCount) * 100) : 0}% Target
                  </span>
                </div>
              </div>

              {/* Izin Hari Ini Bento Card */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest">Izin</p>
                  <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <span className="text-3xl font-black text-slate-900">{totalIzinToday}</span>
                  <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-2 py-1 rounded-lg border border-amber-100">
                    Verifikasi
                  </span>
                </div>
              </div>

              {/* Sakit Hari Ini Bento Card */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest">Sakit</p>
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <span className="text-3xl font-black text-slate-900">{totalSakitToday}</span>
                  <span className="text-[10px] text-blue-700 font-bold bg-blue-50 px-2 py-1 rounded-lg border border-blue-100">
                    Surat Dokter
                  </span>
                </div>
              </div>

              {/* Alpa Hari Ini Bento Card */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all col-span-2 md:col-span-1">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest">Alpa</p>
                  <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                    <XCircle className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <span className="text-3xl font-black text-rose-600">{totalAlpaToday}</span>
                  <span className="text-[10px] text-rose-700 font-bold bg-rose-50 px-2 py-1 rounded-lg border border-rose-100">
                    Warning
                  </span>
                </div>
              </div>
            </div>
          )}

      {/* Main Content Area Controlled via Main Navbar / Sidebar */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-6">
        {/* TAB 1: DATA MASTER */}
          {activeTab === 'master' && (
            <div className="space-y-4">
              {/* Subtabs Data Master */}
              <div className="flex justify-between items-center border-b border-slate-200 pb-3 flex-wrap gap-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => setMasterSubTab('students')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      masterSubTab === 'students'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Data Siswa ({students.length})
                  </button>
                  <button
                    onClick={() => setMasterSubTab('teachers')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      masterSubTab === 'teachers'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Data Guru ({teachers.length})
                  </button>
                  <button
                    onClick={() => setMasterSubTab('classes')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      masterSubTab === 'classes'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Data Kelas ({classes.length})
                  </button>
                  <button
                    onClick={() => setMasterSubTab('guardians')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      masterSubTab === 'guardians'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Data Wali Murid
                  </button>
                </div>

                {masterSubTab === 'students' && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => {
                        setSingleQRCodeStudent(null);
                        setShowQRCodeModal(true);
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-extrabold shadow-sm cursor-pointer transition-all border border-slate-800"
                      title="Buat / Cetak QR Code Hitam Putih Massal"
                    >
                      <QrCode className="w-4 h-4 text-emerald-400" />
                      QR Code Massal
                    </button>
                    <button
                      onClick={() => setShowBulkPrintModal(true)}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-xl text-xs font-extrabold shadow-sm cursor-pointer transition-all border border-slate-800"
                    >
                      <CreditCard className="w-4 h-4 text-emerald-400" />
                      Cetak Kartu Pelajar Masal
                    </button>
                    <button
                      onClick={handleOpenNewStudent}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                    >
                      <Plus className="w-4 h-4" /> Tambah Siswa
                    </button>
                  </div>
                )}

                {masterSubTab === 'teachers' && (
                  <button
                    onClick={handleOpenNewTeacher}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Tambah Guru
                  </button>
                )}

                {masterSubTab === 'classes' && (
                  <button
                    onClick={handleOpenNewClass}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Tambah Kelas
                  </button>
                )}
              </div>

              {/* SUBTAB: DATA SISWA */}
              {masterSubTab === 'students' && (() => {
                const STUDENT_PAGE_SIZE = 30;
                const totalStudentPages = Math.ceil(filteredStudents.length / STUDENT_PAGE_SIZE) || 1;
                const validStudentPage = Math.min(Math.max(1, studentCurrentPage), totalStudentPages);
                const paginatedStudents = filteredStudents.slice((validStudentPage - 1) * STUDENT_PAGE_SIZE, validStudentPage * STUDENT_PAGE_SIZE);

                return (
                <div>
                  <div className="flex flex-wrap gap-3 mb-4 items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Cari NISN, nama siswa, atau nama wali..."
                          value={masterSearch}
                          onChange={(e) => setMasterSearch(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                        />
                      </div>

                      <select
                        value={masterClassFilter}
                        onChange={(e) => setMasterClassFilter(e.target.value)}
                        className="px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white"
                      >
                        <option value="all">Semua Kelas</option>
                        {classes.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {filteredStudents.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedStudentIdsTable.length === filteredStudents.length) {
                              setSelectedStudentIdsTable([]);
                            } else {
                              setSelectedStudentIdsTable(filteredStudents.map(s => s.id));
                            }
                          }}
                          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-300 cursor-pointer"
                        >
                          {selectedStudentIdsTable.length === filteredStudents.length ? 'Batal Pilih Semua' : `Pilih Semua (${filteredStudents.length})`}
                        </button>
                      )}

                      {selectedStudentIdsTable.length > 0 && (
                        <>
                          <button
                            onClick={() => {
                              setSingleQRCodeStudent(null);
                              setShowQRCodeModal(true);
                            }}
                            className="px-3.5 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-extrabold shadow-sm flex items-center gap-1.5 cursor-pointer animate-in fade-in duration-200"
                            title="Generate QR Code Massal Hitam Putih untuk Siswa Terpilih"
                          >
                            <QrCode className="w-4 h-4 text-emerald-400" /> QR Code ({selectedStudentIdsTable.length}) Siswa
                          </button>
                          <button
                            onClick={() => setShowBulkPrintModal(true)}
                            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold shadow-sm flex items-center gap-1.5 cursor-pointer animate-in fade-in duration-200"
                          >
                            <Printer className="w-4 h-4" /> Cetak ({selectedStudentIdsTable.length}) Kartu
                          </button>
                          <button
                            onClick={() => {
                              setDeleteError(null);
                              setDeleteTarget({
                                type: 'siswa_masal',
                                id: 'bulk-students',
                                name: `Hapus Masal ${selectedStudentIdsTable.length} Data Siswa Terpilih`,
                                detail: `Konfirmasi penghapusan ${selectedStudentIdsTable.length} siswa secara permanen.`
                              });
                            }}
                            className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-extrabold shadow-sm flex items-center gap-1.5 cursor-pointer animate-in fade-in duration-200"
                          >
                            <Trash2 className="w-4 h-4" /> Hapus ({selectedStudentIdsTable.length}) Siswa
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-slate-50 border-b border-slate-200 font-bold uppercase text-[10px] text-slate-500">
                        <tr>
                          <th className="p-3 w-8">
                            <input
                              type="checkbox"
                              checked={paginatedStudents.length > 0 && paginatedStudents.every(s => selectedStudentIdsTable.includes(s.id))}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  const newIds = new Set([...selectedStudentIdsTable, ...paginatedStudents.map(s => s.id)]);
                                  setSelectedStudentIdsTable(Array.from(newIds));
                                } else {
                                  const pageIds = new Set(paginatedStudents.map(s => s.id));
                                  setSelectedStudentIdsTable(prev => prev.filter(id => !pageIds.has(id)));
                                }
                              }}
                              className="w-4 h-4 text-emerald-600 rounded border-slate-300 cursor-pointer"
                            />
                          </th>
                          <th className="p-3">No</th>
                          <th className="p-3">Foto 3x4</th>
                          <th className="p-3">NISN & Code</th>
                          <th className="p-3">Nama Siswa</th>
                          <th className="p-3">L/P</th>
                          <th className="p-3">Kelas</th>
                          <th className="p-3">Wali Murid</th>
                          <th className="p-3 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {paginatedStudents.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="p-8 text-center text-slate-400">
                              Tidak ada data siswa yang ditemukan.
                            </td>
                          </tr>
                        ) : (
                          paginatedStudents.map((st, idx) => {
                            const isRowSelected = selectedStudentIdsTable.includes(st.id);
                            const rowNumber = (validStudentPage - 1) * STUDENT_PAGE_SIZE + idx + 1;
                            return (
                              <tr key={`${st.id}-${idx}`} className={`hover:bg-slate-50/80 transition-colors ${isRowSelected ? 'bg-emerald-50/50' : ''}`}>
                                <td className="p-3">
                                  <input
                                    type="checkbox"
                                    checked={isRowSelected}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedStudentIdsTable(prev => [...prev, st.id]);
                                      } else {
                                        setSelectedStudentIdsTable(prev => prev.filter(id => id !== st.id));
                                      }
                                    }}
                                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 cursor-pointer"
                                  />
                                </td>
                                <td className="p-3 font-semibold text-slate-400">{rowNumber}</td>
                                <td className="p-3">
                                  {st.photoUrl ? (
                                    <img
                                      src={st.photoUrl}
                                      alt={st.name}
                                      className="w-8 h-10 object-cover rounded-md border border-slate-200 shadow-2xs"
                                    />
                                  ) : (
                                    <div className="w-8 h-10 bg-slate-100 border border-slate-200 rounded-md flex flex-col items-center justify-center text-slate-400">
                                      <Users className="w-4 h-4" />
                                      <span className="text-[8px] font-bold">3x4</span>
                                    </div>
                                  )}
                                </td>
                                <td className="p-3 font-mono font-bold text-emerald-800">
                                  <div className="flex items-center gap-1.5">
                                    <span>{st.nisn}</span>
                                    <button
                                      onClick={() => setSelectedStudentBarcode(st)}
                                      title="Lihat / Cetak Barcode NISN"
                                      className="p-1 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 cursor-pointer"
                                    >
                                      <Barcode className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => {
                                        setSingleQRCodeStudent(st);
                                      }}
                                      title="Generate QR Code Hitam Putih (NISN & Nama)"
                                      className="p-1 text-slate-800 bg-slate-100 hover:bg-slate-200 rounded border border-slate-300 cursor-pointer"
                                    >
                                      <QrCode className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                                <td className="p-3 font-bold text-slate-900">{st.name}</td>
                                <td className="p-3">{st.gender}</td>
                                <td className="p-3 font-semibold text-slate-700">{st.className}</td>
                                <td className="p-3">{st.parentName} ({st.parentPhone})</td>
                                <td className="p-3 text-right space-x-1">
                                  <button
                                    onClick={() => {
                                      setSingleQRCodeStudent(st);
                                    }}
                                    className="p-1.5 text-slate-700 hover:bg-slate-100 rounded-md cursor-pointer"
                                    title="Generate QR Code Hitam Putih"
                                  >
                                    <QrCode className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleOpenEditStudent(st)}
                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md cursor-pointer"
                                    title="Edit Siswa"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteStudent(st)}
                                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md cursor-pointer"
                                    title="Hapus Siswa"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Bar for Data Siswa */}
                  {filteredStudents.length > 0 && (
                    <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs text-slate-600">
                      <div className="font-medium">
                        Menampilkan <span className="font-bold text-slate-900">{(validStudentPage - 1) * STUDENT_PAGE_SIZE + 1}</span> - <span className="font-bold text-slate-900">{Math.min(validStudentPage * STUDENT_PAGE_SIZE, filteredStudents.length)}</span> dari <span className="font-bold text-slate-900">{filteredStudents.length}</span> siswa (Maks 30/halaman)
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          disabled={validStudentPage === 1}
                          onClick={() => setStudentCurrentPage(1)}
                          className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition-all cursor-pointer"
                          title="Halaman Pertama"
                        >
                          &laquo;
                        </button>
                        <button
                          type="button"
                          disabled={validStudentPage === 1}
                          onClick={() => setStudentCurrentPage(p => Math.max(1, p - 1))}
                          className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition-all cursor-pointer flex items-center gap-1"
                        >
                          &lsaquo; Sebelumnya
                        </button>

                        <div className="px-3 py-1.5 bg-emerald-100 text-emerald-800 font-extrabold rounded-lg border border-emerald-200">
                          Halaman {validStudentPage} dari {totalStudentPages}
                        </div>

                        <button
                          type="button"
                          disabled={validStudentPage >= totalStudentPages}
                          onClick={() => setStudentCurrentPage(p => Math.min(totalStudentPages, p + 1))}
                          className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition-all cursor-pointer flex items-center gap-1"
                        >
                          Selanjutnya &rsaquo;
                        </button>
                        <button
                          type="button"
                          disabled={validStudentPage >= totalStudentPages}
                          onClick={() => setStudentCurrentPage(totalStudentPages)}
                          className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition-all cursor-pointer"
                          title="Halaman Terakhir"
                        >
                          &raquo;
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                );
              })()}

              {/* SUBTAB: DATA GURU */}
              {masterSubTab === 'teachers' && (
                <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 border-b border-slate-200 font-bold uppercase text-[10px] text-slate-500">
                      <tr>
                        <th className="p-3">No</th>
                        <th className="p-3">NIP</th>
                        <th className="p-3">Nama Guru</th>
                        <th className="p-3">Mata Pelajaran</th>
                        <th className="p-3">Role Akses</th>
                        <th className="p-3">Username Login</th>
                        <th className="p-3">Password Akses</th>
                        <th className="p-3">Wali Kelas</th>
                        <th className="p-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {teachers.map((t, idx) => (
                        <tr key={t.id} className="hover:bg-slate-50/80">
                          <td className="p-3 font-semibold text-slate-400">{idx + 1}</td>
                          <td className="p-3 font-mono font-bold text-slate-800">{t.nip}</td>
                          <td className="p-3 font-bold text-slate-900">{t.name}</td>
                          <td className="p-3">{t.subject}</td>
                          <td className="p-3 font-semibold">
                            {t.role === 'admin' ? (
                              <span className="px-2 py-0.5 text-[10px] font-extrabold text-purple-700 bg-purple-100 rounded-full border border-purple-200">
                                Admin
                              </span>
                            ) : t.role === 'bk' ? (
                              <span className="px-2 py-0.5 text-[10px] font-extrabold text-amber-700 bg-amber-100 rounded-full border border-amber-200">
                                Guru BK
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 text-[10px] font-extrabold text-blue-700 bg-blue-100 rounded-full border border-blue-200">
                                Guru Pengajar
                              </span>
                            )}
                          </td>
                          <td className="p-3 font-mono text-emerald-700">{t.username}</td>
                          <td className="p-3 font-mono">
                            {t.password ? (
                              <span className="px-2 py-0.5 text-[11px] font-extrabold text-amber-800 bg-amber-50 rounded border border-amber-200 inline-flex items-center gap-1">
                                <Key className="w-3 h-3 text-amber-600" />
                                {t.password}
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">
                                Default (guru123)
                              </span>
                            )}
                          </td>
                          <td className="p-3 font-semibold text-slate-700">{t.assignedClassName || '-'}</td>
                          <td className="p-3 text-right space-x-1">
                            <button
                              onClick={() => handleOpenEditTeacher(t)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md cursor-pointer"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteTeacher(t)}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* SUBTAB: DATA KELAS */}
              {masterSubTab === 'classes' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-slate-500 font-medium">
                      Total <strong>{classes.length}</strong> kelas terdaftar di SMA Islam Ra'iyatul Husnan.
                    </p>
                    <button
                      onClick={handleOpenNewClass}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer md:hidden"
                    >
                      <Plus className="w-4 h-4" /> Tambah Kelas
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {classes.map(c => (
                      <div key={c.id} className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 hover:border-emerald-300 transition-all flex flex-col justify-between group relative shadow-2xs">
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                              Tingkat {c.gradeLevel}
                            </span>
                            <button
                              type="button"
                              onClick={() => { setSelectedClassForDetail(c); setClassDetailSearch(''); }}
                              className="text-xs text-emerald-800 hover:text-emerald-900 font-extrabold bg-emerald-50 hover:bg-emerald-100 px-2.5 py-0.5 rounded-md border border-emerald-200 transition-colors cursor-pointer flex items-center gap-1"
                              title="Klik untuk melihat daftar siswa di kelas ini"
                            >
                              <Users className="w-3.5 h-3.5 text-emerald-600" />
                              {c.studentCount} Siswa
                            </button>
                          </div>
                          <h4 className="font-extrabold text-slate-900 text-lg group-hover:text-emerald-800 transition-colors">
                            {c.name}
                          </h4>
                          <p className="text-xs text-slate-600">
                            Wali Kelas: <strong className="text-slate-900">{c.teacherName || 'Belum ditugaskan'}</strong>
                          </p>
                        </div>

                        <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between gap-2">
                          <button
                            onClick={() => { setSelectedClassForDetail(c); setClassDetailSearch(''); }}
                            className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                            title="Lihat Daftar Siswa Terkoneksi"
                          >
                            <Users className="w-3.5 h-3.5 text-emerald-600" /> Siswa ({c.studentCount})
                          </button>
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => handleOpenEditClass(c)}
                              className="px-2.5 py-1.5 bg-white hover:bg-blue-50 text-blue-600 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                              title="Edit Data Kelas"
                            >
                              <Edit className="w-3.5 h-3.5" /> Edit
                            </button>
                            <button
                              onClick={() => handleDeleteClass(c)}
                              className="px-2.5 py-1.5 bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                              title="Hapus Kelas"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Hapus
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Card Tambah Kelas Baru */}
                    <button
                      onClick={handleOpenNewClass}
                      className="p-5 border-2 border-dashed border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/50 rounded-2xl flex flex-col items-center justify-center text-center transition-all cursor-pointer group min-h-[140px]"
                    >
                      <div className="w-10 h-10 rounded-full bg-emerald-100 group-hover:bg-emerald-600 group-hover:text-white text-emerald-700 flex items-center justify-center transition-all mb-2">
                        <Plus className="w-5 h-5" />
                      </div>
                      <span className="font-extrabold text-sm text-slate-700 group-hover:text-emerald-800">Tambah Kelas Baru</span>
                      <span className="text-[11px] text-slate-400 mt-0.5">Buat data rombel / kelas baru</span>
                    </button>
                  </div>
                </div>
              )}

              {/* SUBTAB: DATA WALI MURID */}
              {masterSubTab === 'guardians' && (
                <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 border-b border-slate-200 font-bold uppercase text-[10px] text-slate-500">
                      <tr>
                        <th className="p-3">No</th>
                        <th className="p-3">Nama Wali</th>
                        <th className="p-3">No HP Wali</th>
                        <th className="p-3">Nama Anak (Siswa)</th>
                        <th className="p-3">NISN (Username Login)</th>
                        <th className="p-3">Kelas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {students.map((st, idx) => (
                        <tr key={st.id} className="hover:bg-slate-50/80">
                          <td className="p-3 font-semibold text-slate-400">{idx + 1}</td>
                          <td className="p-3 font-bold text-slate-900">{st.parentName}</td>
                          <td className="p-3">{st.parentPhone}</td>
                          <td className="p-3 font-semibold text-emerald-800">{st.name}</td>
                          <td className="p-3 font-mono font-bold text-slate-700">{st.nisn}</td>
                          <td className="p-3">{st.className}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: BENTO SCANNER BARCODE */}
          {activeTab === 'scan' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Bento Dark Card - Active Continuous Live Scanner Box */}
              <div className="lg:col-span-7 flex flex-col space-y-4">
                <div className="flex flex-wrap justify-between items-center gap-2 bg-slate-900 p-4 rounded-2xl border border-slate-800 text-white">
                  <div className="flex items-center gap-2">
                    <Barcode className="w-5 h-5 text-emerald-400" />
                    <div>
                      <h3 className="font-extrabold text-sm uppercase tracking-wider text-amber-300">
                        SCANNER NISN LIVE AKTIF
                      </h3>
                      <p className="text-[11px] text-slate-400">Kamera terbuka & memindai otomatis tanpa henti</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowDismissalModal(true)}
                      className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl text-xs font-black shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <DoorOpen className="w-3.5 h-3.5" /> Absensi Jam Pulang
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowScannerModal(true)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                      title="Buka Layar Penuh / Modal Overlay"
                    >
                      Layar Penuh
                    </button>
                  </div>
                </div>

                {/* Embedded Live Camera Scanner */}
                <BarcodeScannerModal
                  isInline={true}
                  onSuccessScan={onRefreshData}
                  recordedByRole="admin"
                  recordedByName="Admin Piket Sekolah"
                  studentsList={students}
                />

                {/* Last Scan Status Badge */}
                <div className="p-3.5 bg-slate-900 border border-emerald-500/30 rounded-2xl flex items-center justify-between text-xs text-white">
                  <div>
                    <p className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider">Scan Presensi Terakhir</p>
                    <p className="font-bold text-white mt-0.5">
                      {todayAttendance.length > 0 ? todayAttendance[0].studentName : 'Belum Ada Scan Hari Ini'}
                    </p>
                  </div>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-extrabold px-2.5 py-1 rounded-lg uppercase tracking-wider">
                    {todayAttendance.length > 0 ? `${todayAttendance[0].className} • ${todayAttendance[0].time} WIB` : 'STANDBY'}
                  </span>
                </div>
              </div>

              {/* Right Bento Card - Real-Time Attendance Log */}
              <div className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-slate-900 font-extrabold text-base flex items-center gap-2">
                      <UserCheck className="w-5 h-5 text-emerald-600" /> Log Kehadiran Real-Time Hari Ini
                    </h3>
                    <span className="text-xs text-emerald-700 font-extrabold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                      {todayAttendance.length} Presensi
                    </span>
                  </div>

                  <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                    {todayAttendance.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        Belum ada siswa yang melakukan scan presensi barcode hari ini.
                      </div>
                    ) : (
                      todayAttendance.map((rec) => (
                        <div key={rec.id} className="flex items-center gap-3 p-3 border border-slate-100 rounded-2xl bg-slate-50/80 hover:bg-white hover:border-slate-200 hover:shadow-xs transition-all">
                          <div className="w-9 h-9 rounded-xl bg-emerald-700 text-amber-300 font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
                            {rec.studentName.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-extrabold text-slate-900 truncate">{rec.studentName}</p>
                            <p className="text-[10px] text-slate-500 font-medium">NISN: {rec.nisn} • {rec.className}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className={`px-2.5 py-0.5 rounded-lg font-extrabold text-[10px] block ${
                              rec.status === 'Hadir' ? 'bg-emerald-100 text-emerald-800' :
                              rec.status === 'Izin' ? 'bg-amber-100 text-amber-800' :
                              rec.status === 'Sakit' ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {rec.status.toUpperCase()}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 mt-0.5 block">{rec.time} WIB</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: LAPORAN & EKSPOR EXCEL */}
          {activeTab === 'reports' && (
            <div className="space-y-5">
              {/* Subtabs Navigation for Rekapitulasi Laporan */}
              <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
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
              </div>

              {/* Subtab 1: LAPORAN HARIAN */}
              {reportsSubTab === 'daily' && (
                <div className="space-y-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Filter Kelas</label>
                      <select
                        value={reportClassFilter}
                        onChange={(e) => setReportClassFilter(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold bg-white"
                      >
                        <option value="all">Semua Kelas</option>
                        {classes.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Tanggal Mulai</label>
                      <input
                        type="date"
                        value={reportStartDate}
                        onChange={(e) => setReportStartDate(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Tanggal Selesai</label>
                      <input
                        type="date"
                        value={reportEndDate}
                        onChange={(e) => setReportEndDate(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                      <select
                        value={reportStatusFilter}
                        onChange={(e) => setReportStatusFilter(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold bg-white"
                      >
                        <option value="all">Semua Status</option>
                        <option value="Hadir">Hadir</option>
                        <option value="Izin">Izin</option>
                        <option value="Sakit">Sakit</option>
                        <option value="Alpa">Alpa</option>
                      </select>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={handleExportExcel}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg text-xs shadow-xs cursor-pointer"
                      >
                        <ArrowDownToLine className="w-4 h-4" /> Ekspor Excel (.xlsx)
                      </button>
                    </div>
                  </div>

                  {/* Attendance Table */}
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-slate-50 border-b border-slate-200 font-bold uppercase text-[10px] text-slate-500">
                        <tr>
                          <th className="p-3">No</th>
                          <th className="p-3">Tanggal</th>
                          <th className="p-3">Jam</th>
                          <th className="p-3">NISN</th>
                          <th className="p-3">Nama Siswa</th>
                          <th className="p-3">Kelas</th>
                          <th className="p-3">Status</th>
                          <th className="p-3">Catatan</th>
                          <th className="p-3">Pencatat</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredReports.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="p-6 text-center text-xs text-slate-400">
                              Tidak ada data presensi sesuai filter.
                            </td>
                          </tr>
                        ) : (
                          filteredReports.map((rec, idx) => (
                            <tr key={rec.id} className="hover:bg-slate-50/80">
                              <td className="p-3 font-semibold text-slate-400">{idx + 1}</td>
                              <td className="p-3 font-semibold text-slate-800">{rec.date}</td>
                              <td className="p-3 font-mono text-slate-600">{rec.time}</td>
                              <td className="p-3 font-mono text-emerald-800 font-bold">{rec.nisn}</td>
                              <td className="p-3 font-bold text-slate-900">{rec.studentName}</td>
                              <td className="p-3 font-medium">{rec.className}</td>
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
                              <td className="p-3 text-[11px] text-slate-500">{rec.recordedBy}</td>
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
            </div>
          )}

          {/* TAB 4: DATABASE SUPABASE CLOUD & IMPORT DATA */}
          {activeTab === 'import' && (
            <div className="space-y-6 max-w-4xl mx-auto">
              {/* Primary Supabase Cloud Database Integration */}
              <SupabaseManager onRefreshMasterData={onRefreshData} />

              {/* Secondary Google Sheets Integration Option */}
              <details className="bg-slate-50 rounded-2xl border border-slate-200 p-4 transition-all group">
                <summary className="font-extrabold text-xs text-slate-700 cursor-pointer flex items-center justify-between">
                  <span>Google Sheets Database Integration (Opsional)</span>
                  <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">Klik untuk Buka</span>
                </summary>
                <div className="mt-4">
                  <GoogleSheetsManager onDataRefreshed={onRefreshData} />
                </div>
              </details>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-start gap-3">
                  <FileSpreadsheet className="w-6 h-6 text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-emerald-900 text-sm">Fitur Import Bulk Data File Excel</h4>
                    <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed">
                      Unggah file Excel (.xlsx/.csv) untuk menambah/memperbarui data master Siswa atau Guru sekaligus secara cepat.
                    </p>
                  </div>
                </div>

              <div className="flex gap-4 border-b border-slate-200 pb-3">
                <button
                  onClick={() => { setImportType('siswa'); setImportPreviewData([]); setImportMessage(null); }}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    importType === 'siswa' ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  Import Data Siswa
                </button>
                <button
                  onClick={() => { setImportType('guru'); setImportPreviewData([]); setImportMessage(null); }}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    importType === 'guru' ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  Import Data Guru
                </button>
              </div>

              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-xs text-slate-700 font-semibold">
                  1. Unduh Format Template Excel Official:
                </span>
                {importType === 'siswa' ? (
                  <button
                    onClick={downloadStudentTemplate}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-700 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-600" /> Template Siswa.xlsx
                  </button>
                ) : (
                  <button
                    onClick={downloadTeacherTemplate}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-700 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-600" /> Template Guru.xlsx
                  </button>
                )}
              </div>

              {/* File Uploader */}
              <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-6 text-center bg-slate-50/50 transition-colors">
                <Upload className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                <h4 className="font-bold text-slate-800 text-sm mb-1">Upload File Excel / CSV</h4>
                <p className="text-xs text-slate-500 mb-4">Pilih file berformat .xlsx atau .csv sesuai template di atas</p>

                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                  className="hidden"
                  id="excel-file-input"
                />
                <label
                  htmlFor="excel-file-input"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer inline-block"
                >
                  Pilih File Excel
                </label>
              </div>

              {importMessage && (
                <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  importMessage.type === 'success' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'
                }`}>
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{importMessage.text}</span>
                </div>
              )}

              {/* Preview Table */}
              {importPreviewData.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-slate-800 text-sm">
                      Pratinjau Data File ({importPreviewData.length} Baris):
                    </h4>
                    <button
                      onClick={handleExecuteImport}
                      disabled={importLoading}
                      className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-2"
                    >
                      {importLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      Simpan Data ke Database
                    </button>
                  </div>

                  <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-slate-100 font-bold sticky top-0">
                        {importType === 'siswa' ? (
                          <tr>
                            <th className="p-2.5 border-b border-slate-200">No</th>
                            <th className="p-2.5 border-b border-slate-200">NISN</th>
                            <th className="p-2.5 border-b border-slate-200">Nama Siswa</th>
                            <th className="p-2.5 border-b border-slate-200">L/P</th>
                            <th className="p-2.5 border-b border-slate-200">Kelas di File</th>
                            <th className="p-2.5 border-b border-slate-200">Koneksi Kelas Sistem</th>
                            <th className="p-2.5 border-b border-slate-200">Wali Murid</th>
                          </tr>
                        ) : (
                          <tr>
                            {Object.keys(importPreviewData[0] || {}).map((col, idx) => (
                              <th key={idx} className="p-2.5 border-b border-slate-200">{col}</th>
                            ))}
                          </tr>
                        )}
                      </thead>
                      <tbody>
                        {importType === 'siswa' ? (
                          importPreviewData.map((row, idx) => {
                            const rawClassName = getRowValue(row, ['Nama Kelas', 'Kelas', 'Rombel', 'Class', 'className', 'Nama_Kelas', 'nama_kelas']);
                            const matched = findMatchingClass(rawClassName, undefined, classes);
                            const studentName = getRowValue(row, ['Nama Siswa', 'Nama', 'name', 'Nama Lengkap', 'Siswa']);
                            const nisnVal = getRowValue(row, ['NISN', 'nisn', 'Nis', 'NIS']);
                            const genderVal = getRowValue(row, ['Jenis Kelamin (L/P)', 'Jenis Kelamin', 'JK', 'L/P', 'gender']);
                            const parentName = getRowValue(row, ['Nama Wali Murid', 'Nama Wali', 'Wali', 'parentName']);

                            return (
                              <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="p-2.5 font-bold text-slate-400">{idx + 1}</td>
                                <td className="p-2.5 font-mono font-bold text-slate-800">{nisnVal || '-'}</td>
                                <td className="p-2.5 font-bold text-emerald-900">{studentName || '-'}</td>
                                <td className="p-2.5 font-bold">{genderVal.toUpperCase().startsWith('P') ? 'P' : 'L'}</td>
                                <td className="p-2.5 font-semibold text-slate-700">{rawClassName || '(Tanpa Kelas)'}</td>
                                <td className="p-2.5">
                                  {matched ? (
                                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-md font-extrabold text-[10px] inline-flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                      Terkoneksi: {matched.name}
                                    </span>
                                  ) : rawClassName ? (
                                    <span className="px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 rounded-md font-extrabold text-[10px] inline-flex items-center gap-1" title="Kelas ini belum ada dan akan dibuat otomatis saat diklik Simpan">
                                      <Plus className="w-3 h-3 text-amber-600" />
                                      Akan Dibuat Kelas: {rawClassName}
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-300 rounded-md font-bold text-[10px]">
                                      Kelas Default ({classes[0]?.name || 'X MIPA 1'})
                                    </span>
                                  )}
                                </td>
                                <td className="p-2.5 text-slate-600">{parentName || '-'}</td>
                              </tr>
                            );
                          })
                        ) : (
                          importPreviewData.map((row, idx) => (
                            <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                              {Object.values(row).map((val: any, vIdx) => (
                                <td key={vIdx} className="p-2">{String(val)}</td>
                              ))}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              </div>
            </div>
          )}

          {/* TAB 4.5: LAYANAN BIMBINGAN KONSELING (BK) */}
          {activeTab === 'bk' && (
            <BKCounselingSection
              user={{ id: 'admin-1', username: 'admin', name: 'Administrator / Guru BK', role: 'admin' }}
              students={students}
              classes={classes}
              attendanceRecords={attendanceRecords}
              bkNotes={bkNotes}
              onRefreshData={onRefreshData}
            />
          )}

          {/* TAB 4.8: ADMINISTRASI KELAS & KBM (KHUSUS GURU & ADMIN) */}
          {activeTab === 'teacherAdmin' && (
            <TeacherClassAdminSection
              user={{ id: 'admin-1', username: 'admin', name: 'Administrator Utama', role: 'admin' }}
              students={students}
              teachers={teachers}
              classes={classes}
              attendanceRecords={attendanceRecords}
              onRefreshData={onRefreshData}
            />
          )}

          {/* TAB 5: PENGATURAN JAM ABSENSI & HARI LIBUR */}
          {activeTab === 'settings' && (
            <AttendanceSettingsSection onSettingsUpdated={onRefreshData} />
          )}
        </div>
        </>
      )}

      {/* Modal Barcode Card Display */}
      {selectedStudentBarcode && (
        <NISNBarcode
          nisn={selectedStudentBarcode.nisn}
          studentName={selectedStudentBarcode.name}
          className={selectedStudentBarcode.className}
          photoUrl={selectedStudentBarcode.photoUrl}
          displayMode="card"
          onClose={() => setSelectedStudentBarcode(null)}
        />
      )}

      {/* Modal Single Kartu Absen QR Code */}
      {singleQRCodeStudent && (
        <StudentQRCodeCardModal
          student={singleQRCodeStudent}
          onClose={() => setSingleQRCodeStudent(null)}
        />
      )}

      {/* Modal QR Code Generator Massal (Hitam Putih) */}
      {showQRCodeModal && (
        <QRCodeGeneratorModal
          students={students}
          classes={classes}
          onClose={() => {
            setShowQRCodeModal(false);
          }}
          initialSelectedIds={
            selectedStudentIdsTable.length > 0 ? selectedStudentIdsTable : undefined
          }
        />
      )}

      {/* Scanner Barcode Modal */}
      {showScannerModal && (
        <BarcodeScannerModal
          onClose={() => setShowScannerModal(false)}
          onSuccessScan={onRefreshData}
          recordedByRole="admin"
          recordedByName="Admin Piket Sekolah"
          studentsList={students}
        />
      )}

      {/* Modal Add/Edit Student Form */}
      {showStudentModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
            <h3 className="font-bold text-slate-900 text-lg mb-4">
              {editingStudent ? 'Edit Data Siswa' : 'Tambah Siswa Baru'}
            </h3>
            <form onSubmit={handleSaveStudent} className="space-y-3 text-xs">
              {/* Pas Foto 3x4 Upload Section */}
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
                <label className="block font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Pass Foto 3x4 Siswa</span>
                  <span className="text-[10px] text-slate-500 font-normal">Rasio 3:4 (Opsional)</span>
                </label>
                <div className="flex items-center gap-3">
                  <div className="relative w-18 h-24 bg-slate-200 border-2 border-dashed border-slate-300 rounded-lg overflow-hidden shrink-0 flex items-center justify-center group shadow-2xs">
                    {studentForm.photoUrl ? (
                      <>
                        <img
                          src={studentForm.photoUrl}
                          alt="Pas Foto 3x4"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setStudentForm({ ...studentForm, photoUrl: '' })}
                          className="absolute top-1 right-1 p-0.5 bg-rose-600 text-white rounded-full opacity-80 hover:opacity-100 shadow-xs cursor-pointer"
                          title="Hapus Pas Foto"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </>
                    ) : (
                      <div className="text-center p-1 text-slate-400 flex flex-col items-center">
                        <Camera className="w-5 h-5 mb-0.5" />
                        <span className="text-[9px] font-bold leading-tight">3x4</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <input
                      type="file"
                      accept="image/*"
                      id="student-photo-file-input"
                      onChange={handleStudentPhotoChange}
                      className="hidden"
                    />
                    <label
                      htmlFor="student-photo-file-input"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded-lg cursor-pointer text-xs shadow-2xs"
                    >
                      <Upload className="w-3.5 h-3.5 text-emerald-600" />
                      {studentForm.photoUrl ? 'Ganti Pas Foto' : 'Unggah Pass Foto 3x4'}
                    </label>
                    <p className="text-[10px] text-slate-500 leading-tight">
                      Format: JPG / PNG (Maks 3MB). Otomatis diunggah ke <strong>Supabase Storage</strong> jika terhubung.
                    </p>
                    {studentForm.photoUrl && (
                      <div className="flex items-center gap-1.5 text-[10px]">
                        {studentForm.photoUrl.startsWith('http') ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-semibold">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Supabase Storage Cloud
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-semibold">
                            <Clock className="w-3 h-3 text-amber-600" /> Siap Diunggah ke Storage
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">NISN (10 Digit)*</label>
                <input
                  type="text"
                  required
                  value={studentForm.nisn}
                  onChange={(e) => setStudentForm({ ...studentForm, nisn: e.target.value })}
                  placeholder="0061234501"
                  className="w-full p-2 border border-slate-300 rounded-lg font-mono font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Lengkap Siswa*</label>
                <input
                  type="text"
                  required
                  value={studentForm.name}
                  onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                  placeholder="Muhammad Farhan"
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jenis Kelamin</label>
                  <select
                    value={studentForm.gender}
                    onChange={(e) => setStudentForm({ ...studentForm, gender: e.target.value as any })}
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="L">Laki-laki (L)</option>
                    <option value="P">Perempuan (P)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Kelas*</label>
                  <select
                    value={studentForm.classId}
                    onChange={(e) => setStudentForm({ ...studentForm, classId: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white font-semibold"
                  >
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Wali Murid</label>
                <input
                  type="text"
                  value={studentForm.parentName}
                  onChange={(e) => setStudentForm({ ...studentForm, parentName: e.target.value })}
                  placeholder="H. Abdullah"
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">No HP Wali Murid</label>
                <input
                  type="text"
                  value={studentForm.parentPhone}
                  onChange={(e) => setStudentForm({ ...studentForm, parentPhone: e.target.value })}
                  placeholder="081234567890"
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <button
                  type="button"
                  disabled={isSavingStudent}
                  onClick={() => setShowStudentModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingStudent}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  {isSavingStudent ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      <span>Mengunggah Foto & Menyimpan...</span>
                    </>
                  ) : (
                    <span>Simpan Siswa</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Add/Edit Class Form */}
      {showClassModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                <School className="w-5 h-5 text-emerald-600" />
                {editingClass ? 'Edit Data Kelas' : 'Tambah Kelas Baru'}
              </h3>
              <button
                onClick={() => setShowClassModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveClass} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Kelas*</label>
                <input
                  type="text"
                  required
                  value={classForm.name}
                  onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
                  placeholder="Misal: X MIPA 1, XI IPS 2"
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-extrabold text-sm focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Tingkat Kelas*</label>
                <select
                  value={classForm.gradeLevel}
                  onChange={(e) => setClassForm({ ...classForm, gradeLevel: e.target.value as 'X' | 'XI' | 'XII' })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-bold bg-white focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="X">Tingkat X (Sepuluh)</option>
                  <option value="XI">Tingkat XI (Sebelas)</option>
                  <option value="XII">Tingkat XII (Dua Belas)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Wali Kelas (Opsional)</label>
                <select
                  value={classForm.teacherId}
                  onChange={(e) => setClassForm({ ...classForm, teacherId: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-white focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="">-- Belum Ditugaskan / Tanpa Wali Kelas --</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.subject})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSavingClass}
                  onClick={() => setShowClassModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingClass}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold cursor-pointer flex items-center gap-2 disabled:opacity-50 shadow-sm"
                >
                  {isSavingClass ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      <span>Menyimpan Kelas...</span>
                    </>
                  ) : (
                    <span>{editingClass ? 'Simpan Perubahan' : 'Buat Kelas'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Add/Edit Teacher Form */}
      {showTeacherModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
            <h3 className="font-bold text-slate-900 text-lg mb-4">
              {editingTeacher ? 'Edit Data Guru' : 'Tambah Guru Baru'}
            </h3>
            <form onSubmit={handleSaveTeacher} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">NIP*</label>
                <input
                  type="text"
                  required
                  value={teacherForm.nip}
                  onChange={(e) => setTeacherForm({ ...teacherForm, nip: e.target.value })}
                  placeholder="198504122010011002"
                  className="w-full p-2 border border-slate-300 rounded-lg font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Lengkap & Gelar*</label>
                <input
                  type="text"
                  required
                  value={teacherForm.name}
                  onChange={(e) => setTeacherForm({ ...teacherForm, name: e.target.value })}
                  placeholder="Ust. Ahmad Fausan, S.Pd"
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Username Login*</label>
                  <input
                    type="text"
                    required
                    value={teacherForm.username}
                    onChange={(e) => setTeacherForm({ ...teacherForm, username: e.target.value })}
                    placeholder="ahmad"
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Password Akses Role</label>
                  <input
                    type="text"
                    value={teacherForm.password}
                    onChange={(e) => setTeacherForm({ ...teacherForm, password: e.target.value })}
                    placeholder="Contoh: guru123"
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono font-bold text-amber-900 bg-amber-50/50"
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-500">
                Password khusus untuk login akun ini. Jika dikosongkan, guru dapat login dengan password default (<code>guru123</code> / NIP).
              </p>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Mata Pelajaran</label>
                <input
                  type="text"
                  value={teacherForm.subject}
                  onChange={(e) => setTeacherForm({ ...teacherForm, subject: e.target.value })}
                  placeholder="Matematika"
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Role Akses Sistem*</label>
                <select
                  value={teacherForm.role}
                  onChange={(e) => setTeacherForm({ ...teacherForm, role: e.target.value as 'admin' | 'guru' | 'bk' })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white font-bold text-slate-800"
                >
                  <option value="guru">Guru Pengajar (Akses Absensi & Jurnal Kelas)</option>
                  <option value="bk">Guru BK / Bimbingan Konseling (Akses Layanan BK)</option>
                  <option value="admin">Administrator / Operator (Akses Penuh Master Data & System)</option>
                </select>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Menentukan jenis portal & hak akses akun saat guru login ke sistem.
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Tugaskan sebagai Wali Kelas</label>
                <select
                  value={teacherForm.assignedClassId}
                  onChange={(e) => setTeacherForm({ ...teacherForm, assignedClassId: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="">-- Tidak Ditugaskan --</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setShowTeacherModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold cursor-pointer"
                >
                  Simpan Guru
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Popup Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden transform transition-all">
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-rose-100 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0 shadow-2xs">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-extrabold text-slate-900">
                    Konfirmasi Hapus Data {deleteTarget.type === 'siswa' ? 'Siswa' : deleteTarget.type === 'guru' ? 'Guru' : 'Kelas'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Apakah Anda yakin ingin menghapus data ini?
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  disabled={isDeletingTarget}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-1.5">
                <div className="text-sm font-extrabold text-slate-900">
                  {deleteTarget.name}
                </div>
                {deleteTarget.detail && (
                  <div className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg inline-block">
                    {deleteTarget.detail}
                  </div>
                )}
                <p className="text-[11px] text-slate-500 pt-1">
                  ⚠️ Data yang telah dihapus akan terhapus dari sistem dan tidak dapat dikembalikan.
                </p>
              </div>

              {deleteError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                  <span>{deleteError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isDeletingTarget}
                  onClick={() => setDeleteTarget(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isDeletingTarget}
                  onClick={handleConfirmDeleteTarget}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isDeletingTarget ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Menghapus...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" /> Ya, Hapus Data
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dismissal Attendance Modal */}
      {showDismissalModal && (
        <DismissalAttendanceSection
          user={{
            id: 'admin-1',
            username: 'admin',
            name: 'Administrator Sekolah',
            role: 'admin'
          }}
          students={students}
          classes={classes}
          attendanceRecords={attendanceRecords}
          onRefreshData={onRefreshData}
          isModal={true}
          onCloseModal={() => setShowDismissalModal(false)}
        />
      )}

      {/* Bulk Student Card Printer Modal */}
      {showBulkPrintModal && (
        <BulkStudentCardPrinter
          students={students}
          classes={classes}
          initialSelectedIds={selectedStudentIdsTable.length > 0 ? selectedStudentIdsTable : undefined}
          onClose={() => setShowBulkPrintModal(false)}
        />
      )}

      {/* Class Connected Students Detail Modal */}
      {selectedClassForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-5 border-b border-slate-200 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-lg text-white">
                    Daftar Siswa Kelas {selectedClassForDetail.name}
                  </h3>
                  <span className="text-xs font-bold px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg">
                    Tingkat {selectedClassForDetail.gradeLevel}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  Wali Kelas: <strong className="text-amber-300">{selectedClassForDetail.teacherName || 'Belum ditugaskan'}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedClassForDetail(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Filter & Summary */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari nama, NISN, atau wali murid..."
                    value={classDetailSearch}
                    onChange={(e) => setClassDetailSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-xl text-xs font-extrabold border border-emerald-200">
                    Total: {
                      students.filter(s => s.classId === selectedClassForDetail.id || (s.className && s.className.trim().toLowerCase() === selectedClassForDetail.name.trim().toLowerCase())).length
                    } Siswa Terkoneksi
                  </span>
                </div>
              </div>

              {/* Table of Students in Class */}
              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-100 font-bold uppercase text-[10px] text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="p-3">No</th>
                      <th className="p-3">Foto</th>
                      <th className="p-3">NISN</th>
                      <th className="p-3">Nama Siswa</th>
                      <th className="p-3">L/P</th>
                      <th className="p-3">Nama Wali</th>
                      <th className="p-3">No HP Wali</th>
                      <th className="p-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(() => {
                      const classStudents = students.filter(s => {
                        const matchClass = s.classId === selectedClassForDetail.id ||
                                           (s.className && s.className.trim().toLowerCase() === selectedClassForDetail.name.trim().toLowerCase());
                        const matchSearch = !classDetailSearch ||
                          s.name.toLowerCase().includes(classDetailSearch.toLowerCase()) ||
                          s.nisn.includes(classDetailSearch) ||
                          s.parentName.toLowerCase().includes(classDetailSearch.toLowerCase());
                        return matchClass && matchSearch;
                      }).sort((a, b) => a.name.localeCompare(b.name, 'id', { sensitivity: 'base' }));

                      if (classStudents.length === 0) {
                        return (
                          <tr>
                            <td colSpan={8} className="p-8 text-center text-xs text-slate-400">
                              Belum ada data siswa yang terhubung dengan kelas {selectedClassForDetail.name}.
                            </td>
                          </tr>
                        );
                      }

                      return classStudents.map((st, idx) => (
                        <tr key={`${st.id}-${idx}`} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-semibold text-slate-400">{idx + 1}</td>
                          <td className="p-3">
                            {st.photoUrl ? (
                              <img src={st.photoUrl} alt={st.name} className="w-7 h-9 object-cover rounded border border-slate-200" />
                            ) : (
                              <div className="w-7 h-9 bg-slate-100 border border-slate-200 rounded flex items-center justify-center text-slate-400">
                                <Users className="w-3.5 h-3.5" />
                              </div>
                            )}
                          </td>
                          <td className="p-3 font-mono font-bold text-emerald-800">{st.nisn}</td>
                          <td className="p-3 font-extrabold text-slate-900">{st.name}</td>
                          <td className="p-3">{st.gender}</td>
                          <td className="p-3 font-medium text-slate-800">{st.parentName}</td>
                          <td className="p-3 font-mono text-slate-600">{st.parentPhone}</td>
                          <td className="p-3 text-right space-x-1">
                            <button
                              type="button"
                              onClick={() => {
                                handleOpenEditStudent(st);
                                setSelectedClassForDetail(null);
                              }}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer"
                              title="Edit Siswa Ini"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setMasterSubTab('students');
                  setMasterClassFilter(selectedClassForDetail.id);
                  setSelectedClassForDetail(null);
                }}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Users className="w-4 h-4" /> Buka di Tab Master Data Siswa
              </button>

              <button
                type="button"
                onClick={() => setSelectedClassForDetail(null)}
                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-all"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
