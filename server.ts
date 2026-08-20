import express from 'express';
import path from 'path';
import { INITIAL_CLASSES, INITIAL_TEACHERS, INITIAL_STUDENTS, generateInitialAttendance, INITIAL_BK_NOTES } from './src/data/mockDatabase';
import { ClassRoom, Teacher, Student, AttendanceRecord, User, SchoolSettings, HolidayConfig, BKNote, UserRole } from './src/types';
import {
  getCurrentSheetsConfig,
  setCurrentSheetsConfig,
  initGoogleSpreadsheet,
  pushAllToSpreadsheet,
  pullAllFromSpreadsheet,
  appendAttendanceToSpreadsheet
} from './src/services/sheetsServer';
import {
  loadSupabaseConfig,
  saveSupabaseConfig,
  saveLocalDBBackup,
  readLocalDBBackup,
  testSupabaseConnection,
  pushAllToSupabase,
  pullAllFromSupabase,
  uploadStudentPhotoToSupabase,
  deleteTeacherFromSupabase,
  deleteClassFromSupabase,
  deleteStudentFromSupabase,
  upsertStudentToSupabase,
  getSupabaseClient,
  SUPABASE_SQL_SCHEMA
} from './src/services/supabaseService';
import { syncClassesAndStudentsData, findMatchingClass, inferGradeLevel } from './src/utils/dataSync';
import { normalizeDateToYMD, isStudentNameMatch, isStudentBirthDateMatch } from './src/utils/studentAuthHelper';

// In-memory data store for the application
let classesDB: ClassRoom[] = [...INITIAL_CLASSES];
let teachersDB: Teacher[] = [...INITIAL_TEACHERS];
let studentsDB: Student[] = [...INITIAL_STUDENTS];
let attendanceDB: AttendanceRecord[] = generateInitialAttendance();
let bkNotesDB: BKNote[] = [...INITIAL_BK_NOTES];
let schoolSettingsDB: SchoolSettings = {
  namaSekolah: "SMA ISLAM RA'IYATUL HUSNAN",
  subNamaSekolah: "WRINGIN BONDOWOSO",
  npsn: "20521620",
  nss: "302052202010",
  akreditasi: "B",
  alamat: "Jl. Raya Wringin No. 45",
  desaKelurahan: "Wringin",
  kecamatan: "Wringin",
  kabupatenKota: "Bondowoso",
  provinsi: "Jawa Timur",
  kodePos: "68252",
  telepon: "(0332) 421xxx / 081234567890",
  email: "smaislam.raiyatulhusnan@gmail.sch.id",
  website: "www.smaislam-raiyatulhusnan.sch.id",
  logoUrl: "/school-logo.png",
  namaKepalaSekolah: "SAIFURRAHMAN, SH",
  nipKepalaSekolah: "",
  naunganYayasan: "Yayasan Ra'iyatul Husnan Wringin",

  jamMasuk: '07:00',
  batasTerlambat: '07:15',
  jamPulang: '14:00',
  batasPulang: '16:00',
  hariLiburRutin: [0, 6], // 0 = Minggu, 6 = Sabtu
  hariLiburKhusus: [
    { id: 'hol-1', date: '2026-08-17', name: 'HUT Kemerdekaan RI ke-81', isNational: true },
    { id: 'hol-2', date: '2026-05-01', name: 'Hari Buruh Nasional', isNational: true },
    { id: 'hol-3', date: '2026-06-01', name: 'Hari Lahir Pancasila', isNational: true },
    { id: 'hol-4', date: '2026-12-25', name: 'Hari Raya Natal & Libur Semester', isNational: true }
  ],
  allowAbsenLibur: false
};

// Load local persistent backup if exists
const savedBackup = readLocalDBBackup();
if (savedBackup) {
  if (savedBackup.classes && savedBackup.classes.length > 0) classesDB = savedBackup.classes;
  if (savedBackup.teachers && savedBackup.teachers.length > 0) teachersDB = savedBackup.teachers;
  if (savedBackup.students && savedBackup.students.length > 0) studentsDB = savedBackup.students;
  if (savedBackup.attendance && savedBackup.attendance.length > 0) attendanceDB = savedBackup.attendance;
  if (savedBackup.bkNotes && savedBackup.bkNotes.length > 0) bkNotesDB = savedBackup.bkNotes;
  if (savedBackup.settings) {
    schoolSettingsDB = { ...schoolSettingsDB, ...savedBackup.settings };
    if (!schoolSettingsDB.namaKepalaSekolah || schoolSettingsDB.namaKepalaSekolah === "Ust. Ahmad Fausan, S.Pd") {
      schoolSettingsDB.namaKepalaSekolah = "SAIFURRAHMAN, SH";
    }
    if (schoolSettingsDB.nipKepalaSekolah === "198504122010011002") {
      schoolSettingsDB.nipKepalaSekolah = "";
    }
  }
}

// Initial auto-sync of class, student, and teacher relations
const initialSynced = syncClassesAndStudentsData(classesDB, studentsDB, teachersDB);
classesDB = initialSynced.classes;
studentsDB = initialSynced.students;
teachersDB = initialSynced.teachers;

// Helper to clean attendance records belonging to non-existent students (orphans / dummy)
const cleanOrphanAttendance = () => {
  if (studentsDB && studentsDB.length > 0) {
    const validNisns = new Set(studentsDB.map(s => s.nisn));
    const validIds = new Set(studentsDB.map(s => s.id));
    const validNames = new Set(studentsDB.map(s => (s.name || '').trim().toLowerCase()));
    attendanceDB = attendanceDB.filter(a =>
      validNisns.has(a.nisn) || validIds.has(a.studentId) || (a.studentName && validNames.has(a.studentName.trim().toLowerCase()))
    );
  }
};

cleanOrphanAttendance();

if (!savedBackup) {
  // Save initial mock data to local backup
  saveLocalDBBackup({ classes: classesDB, teachers: teachersDB, students: studentsDB, attendance: attendanceDB, bkNotes: bkNotesDB, settings: schoolSettingsDB });
}

// Helper to save local DB & background push to Supabase if enabled
const persistData = () => {
  const synced = syncClassesAndStudentsData(classesDB, studentsDB, teachersDB);
  classesDB = synced.classes;
  studentsDB = synced.students;
  teachersDB = synced.teachers;

  cleanOrphanAttendance();

  saveLocalDBBackup({ classes: classesDB, teachers: teachersDB, students: studentsDB, attendance: attendanceDB, bkNotes: bkNotesDB, settings: schoolSettingsDB });
  const cfg = loadSupabaseConfig();
  if (cfg.autoSync && cfg.url && cfg.anonKey && cfg.status === 'connected') {
    pushAllToSupabase({ classes: classesDB, teachers: teachersDB, students: studentsDB, attendance: attendanceDB, settings: schoolSettingsDB })
      .catch(err => console.error('Auto-sync to Supabase background error:', err));
  }
};

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

async function startServer() {

  // Helper for current date in YYYY-MM-DD (Asia/Jakarta / WIB)
  const getTodayStr = () => {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    } catch {
      const d = new Date();
      return d.toISOString().split('T')[0];
    }
  };

  // Helper for current time in HH:mm:ss (Asia/Jakarta / WIB)
  const getTimeStr = () => {
    try {
      return new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date()).replace(/\./g, ':');
    } catch {
      const d = new Date();
      return d.toTimeString().split(' ')[0];
    }
  };

  // Helper: Check if date is a holiday (routine or custom)
  const checkIsHoliday = (dateStr: string) => {
    const d = new Date(dateStr);
    const dayOfWeek = d.getDay(); // 0 = Minggu, 6 = Sabtu
    const isRoutine = schoolSettingsDB.hariLiburRutin.includes(dayOfWeek);
    const customHoliday = schoolSettingsDB.hariLiburKhusus.find(h => h.date === dateStr);

    if (customHoliday) {
      return { isHoliday: true, name: customHoliday.name };
    }
    if (isRoutine) {
      const daysName = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      return { isHoliday: true, name: `Libur Rutin (${daysName[dayOfWeek]})` };
    }
    return { isHoliday: false, name: '' };
  };

  // Helper: Check if scan time is late
  const checkIsLate = (timeStr: string) => {
    if (!schoolSettingsDB.batasTerlambat) return false;
    const currentHHMM = timeStr.substring(0, 5);
    return currentHHMM > schoolSettingsDB.batasTerlambat;
  };

  // Helper: Check if checkout time is early dismissal
  const checkIsEarlyDismissal = (timeStr: string) => {
    if (!schoolSettingsDB.jamPulang) return false;
    const currentHHMM = timeStr.substring(0, 5);
    return currentHHMM < schoolSettingsDB.jamPulang;
  };

  // ==================== API ROUTES ====================

  // Settings Endpoints
  app.get('/api/settings', async (req, res) => {
    const cfg = loadSupabaseConfig();
    if (cfg.url && cfg.anonKey && cfg.status === 'connected') {
      try {
        const pulled = await pullAllFromSupabase();
        if (pulled.success && pulled.data?.settings) {
          schoolSettingsDB = { ...schoolSettingsDB, ...pulled.data.settings };
        }
      } catch (e) {
        console.warn('Error syncing settings from Supabase on GET /api/settings:', e);
      }
    }
    res.json({ success: true, settings: schoolSettingsDB });
  });

  app.post('/api/settings', async (req, res) => {
    const {
      namaSekolah,
      subNamaSekolah,
      npsn,
      nss,
      akreditasi,
      alamat,
      desaKelurahan,
      kecamatan,
      kabupatenKota,
      provinsi,
      kodePos,
      telepon,
      email,
      website,
      logoUrl,
      namaKepalaSekolah,
      nipKepalaSekolah,
      naunganYayasan,
      jamMasuk,
      batasTerlambat,
      jamPulang,
      batasPulang,
      hariLiburRutin,
      hariLiburKhusus,
      allowAbsenLibur
    } = req.body;

    schoolSettingsDB = {
      namaSekolah: namaSekolah !== undefined ? namaSekolah : (schoolSettingsDB.namaSekolah || "SMA ISLAM RA'IYATUL HUSNAN"),
      subNamaSekolah: subNamaSekolah !== undefined ? subNamaSekolah : (schoolSettingsDB.subNamaSekolah || "WRINGIN BONDOWOSO"),
      npsn: npsn !== undefined ? npsn : schoolSettingsDB.npsn,
      nss: nss !== undefined ? nss : schoolSettingsDB.nss,
      akreditasi: akreditasi !== undefined ? akreditasi : schoolSettingsDB.akreditasi,
      alamat: alamat !== undefined ? alamat : schoolSettingsDB.alamat,
      desaKelurahan: desaKelurahan !== undefined ? desaKelurahan : schoolSettingsDB.desaKelurahan,
      kecamatan: kecamatan !== undefined ? kecamatan : schoolSettingsDB.kecamatan,
      kabupatenKota: kabupatenKota !== undefined ? kabupatenKota : schoolSettingsDB.kabupatenKota,
      provinsi: provinsi !== undefined ? provinsi : schoolSettingsDB.provinsi,
      kodePos: kodePos !== undefined ? kodePos : schoolSettingsDB.kodePos,
      telepon: telepon !== undefined ? telepon : schoolSettingsDB.telepon,
      email: email !== undefined ? email : schoolSettingsDB.email,
      website: website !== undefined ? website : schoolSettingsDB.website,
      logoUrl: logoUrl !== undefined ? logoUrl : schoolSettingsDB.logoUrl,
      namaKepalaSekolah: namaKepalaSekolah !== undefined ? namaKepalaSekolah : schoolSettingsDB.namaKepalaSekolah,
      nipKepalaSekolah: nipKepalaSekolah !== undefined ? nipKepalaSekolah : schoolSettingsDB.nipKepalaSekolah,
      naunganYayasan: naunganYayasan !== undefined ? naunganYayasan : schoolSettingsDB.naunganYayasan,

      jamMasuk: jamMasuk || schoolSettingsDB.jamMasuk,
      batasTerlambat: batasTerlambat || schoolSettingsDB.batasTerlambat,
      jamPulang: jamPulang || schoolSettingsDB.jamPulang,
      batasPulang: batasPulang || schoolSettingsDB.batasPulang,
      hariLiburRutin: Array.isArray(hariLiburRutin) ? hariLiburRutin : schoolSettingsDB.hariLiburRutin,
      hariLiburKhusus: Array.isArray(hariLiburKhusus) ? hariLiburKhusus : schoolSettingsDB.hariLiburKhusus,
      allowAbsenLibur: typeof allowAbsenLibur === 'boolean' ? allowAbsenLibur : schoolSettingsDB.allowAbsenLibur
    };

    persistData();
    res.json({ success: true, settings: schoolSettingsDB, message: 'Pengaturan identitas & presensi sekolah berhasil disimpan!' });
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', school: "SMA Islam Ra'iyatul Husnan" });
  });

  // Login authentication
  app.post('/api/auth/login', (req, res) => {
    const { role, username, password } = req.body;

    if (!username) {
      return res.status(400).json({ error: 'Username/NIP/NISN wajib diisi.' });
    }

    const trimmedUsername = username.trim();
    const trimmedPassword = (password || '').trim();

    if (role === 'wali') {
      const cleanInput = trimmedUsername.replace(/\D/g, '');
      
      // 1. Try finding by NISN
      let student = studentsDB.find(s => s.nisn === trimmedUsername);

      // 2. Try finding by Parent Phone (if input is numeric and length >= 8)
      if (!student && cleanInput.length >= 8) {
        student = studentsDB.find(s => {
          const sPhoneClean = (s.parentPhone || '').replace(/\D/g, '');
          if (!sPhoneClean) return false;
          return sPhoneClean === cleanInput || 
                 sPhoneClean.endsWith(cleanInput) || 
                 cleanInput.endsWith(sPhoneClean) ||
                 (cleanInput.startsWith('0') && sPhoneClean === '62' + cleanInput.slice(1)) ||
                 (cleanInput.startsWith('62') && sPhoneClean === '0' + cleanInput.slice(2));
        });
      }

      // 3. Fallback: check persistent backup or Supabase if not in studentsDB
      if (!student) {
        const backup = readLocalDBBackup();
        if (backup && backup.students) {
          student = backup.students.find(s => s.nisn === trimmedUsername || ((s.parentPhone || '').replace(/\D/g, '') === cleanInput && cleanInput.length >= 8));
          if (student && !studentsDB.some(s => s.id === student!.id)) {
            studentsDB.push(student);
          }
        }
      }

      if (student) {
        const waliUser: User = {
          id: `wali-${student.id}`,
          username: student.nisn,
          name: student.parentName || `Wali dari ${student.name}`,
          role: 'wali',
          nisn: student.nisn,
          childNisn: student.nisn,
          childName: student.name,
          className: student.className
        };
        return res.json({ success: true, user: waliUser, student });
      } else {
        return res.status(404).json({ 
          error: `Data Siswa / Nomor HP Wali tidak ditemukan. Pastikan NISN atau No. WhatsApp sudah benar dan terdaftar di sekolah.` 
        });
      }
    }

    // Auto-detect Staff Role (Admin / Guru / BK) based on Username & Password
    const lowerUname = trimmedUsername.toLowerCase();

    // 1. Check Default Admin Account
    if ((lowerUname === 'admin' || lowerUname === 'admin@smaislam.sch.id' || lowerUname === '123456') && (trimmedPassword === 'admin123' || trimmedPassword === '123456' || trimmedPassword === '123')) {
      const adminUser: User = {
        id: 'admin-1',
        username: 'admin',
        name: 'Administrator Utama',
        role: 'admin'
      };
      return res.json({ success: true, user: adminUser });
    }

    // 2. Check Teacher in DB (Guru / BK / Admin Teacher)
    const teacher = teachersDB.find(
      t => (t.username.toLowerCase() === lowerUname || t.nip === trimmedUsername)
    );

    if (teacher) {
      const validPass = (teacher.password && trimmedPassword === teacher.password) ||
                        trimmedPassword === 'guru123' || 
                        trimmedPassword === 'admin123' || 
                        trimmedPassword === 'bk123' ||
                        trimmedPassword === '123' || 
                        trimmedPassword === teacher.nip || 
                        trimmedPassword === teacher.nip.slice(-6);

      if (validPass) {
        const teacherRole: UserRole = (teacher.role as UserRole) || 'guru';
        const userObj: User = {
          id: teacher.id,
          username: teacher.username,
          name: teacher.name,
          role: teacherRole,
          nip: teacher.nip,
          classId: teacher.assignedClassId,
          className: teacher.assignedClassName
        };
        return res.json({ success: true, user: userObj });
      } else {
        return res.status(401).json({ error: 'Password yang Anda masukkan salah.' });
      }
    }

    // 3. Check BK default alias
    if ((lowerUname === 'bk' || lowerUname === 'rahma') && (trimmedPassword === 'bk123' || trimmedPassword === 'guru123' || trimmedPassword === 'admin123' || trimmedPassword === '123')) {
      const defaultBkUser: User = {
        id: 'tch-bk',
        username: 'rahma',
        name: 'Ibu Rahmawati, S.Psi',
        role: 'bk',
        nip: '199105152016022005'
      };
      return res.json({ success: true, user: defaultBkUser });
    }

    return res.status(401).json({ error: 'Username/NIP atau password yang Anda masukkan salah.' });
  });

  // Secure Wali Murid Verification Endpoint (Verification by Student Name & Birth Date)
  app.post('/api/auth/wali/verify', async (req, res) => {
    const { studentName, birthDate, parentPhone } = req.body;

    if (!studentName || (!birthDate && !parentPhone)) {
      return res.status(400).json({ error: 'Nama Lengkap Siswa dan Tanggal Lahir wajib diisi.' });
    }

    const cleanInputPhone = parentPhone ? String(parentPhone).replace(/\D/g, '') : '';

    const performMatch = (studentsList: Student[]): Student | undefined => {
      return studentsList.find(s => {
        // Name matching using flexible helper
        const nameMatches = isStudentNameMatch(s.name, studentName);
        if (!nameMatches) return false;

        // Birth date matching
        if (birthDate) {
          if (isStudentBirthDateMatch(s.birthDate, birthDate)) {
            return true;
          }
        }

        // Optional phone fallback if provided
        if (cleanInputPhone && cleanInputPhone.length >= 4) {
          const sPhoneClean = (s.parentPhone || '').replace(/\D/g, '');
          if (sPhoneClean) {
            const phoneMatches = sPhoneClean === cleanInputPhone ||
                                 sPhoneClean.endsWith(cleanInputPhone) ||
                                 cleanInputPhone.endsWith(sPhoneClean) ||
                                 (cleanInputPhone.startsWith('0') && sPhoneClean === '62' + cleanInputPhone.slice(1)) ||
                                 (cleanInputPhone.startsWith('62') && sPhoneClean === '0' + cleanInputPhone.slice(2));
            if (phoneMatches) return true;
          }
        }

        return false;
      });
    };

    // 1. Search in current in-memory studentsDB
    let matched = performMatch(studentsDB);

    // 2. If not found, check local file backup
    if (!matched) {
      const backup = readLocalDBBackup();
      if (backup && backup.students && backup.students.length > 0) {
        matched = performMatch(backup.students);
        if (matched && !studentsDB.some(s => s.id === matched!.id)) {
          studentsDB.push(matched);
        }
      }
    }

    // 3. If still not found, check Supabase directly if connected
    if (!matched) {
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          const { data: supaStudents } = await supabase.from('students').select('*');
          if (supaStudents && supaStudents.length > 0) {
            const mappedSupa: Student[] = supaStudents.map((s: any) => ({
              id: s.id,
              nisn: s.nisn,
              name: s.name,
              gender: s.gender || 'L',
              classId: s.class_id,
              className: s.class_name,
              birthDate: s.birth_date || s.birthDate || undefined,
              address: s.address || undefined,
              academicYear: s.academic_year || s.academicYear || '2024/2025',
              parentName: s.parent_name || undefined,
              parentPhone: s.parent_phone || undefined,
              photoUrl: s.photo_url || undefined,
              defaultPassword: s.default_password || '123'
            }));
            matched = performMatch(mappedSupa);
            if (matched && !studentsDB.some(s => s.id === matched!.id)) {
              studentsDB.push(matched);
            }
          }
        }
      } catch (err) {
        console.warn('Supabase verify lookup fallback error:', err);
      }
    }

    if (matched) {
      const waliUser: User = {
        id: `wali-${matched.id}`,
        username: matched.nisn,
        name: matched.parentName || `Wali dari ${matched.name}`,
        role: 'wali',
        nisn: matched.nisn,
        childNisn: matched.nisn,
        childName: matched.name,
        className: matched.className
      };
      return res.json({
        success: true,
        user: waliUser,
        studentInfo: {
          name: matched.name,
          className: matched.className,
          nisn: matched.nisn
        },
        message: 'Verifikasi identitas wali murid berhasil!'
      });
    }

    return res.status(404).json({
      error: 'Data tidak cocok. Pastikan Nama Lengkap Siswa dan Tanggal Lahir sesuai dengan data yang terdaftar di sekolah.'
    });
  });

  // Get master data
  app.get('/api/master/data', (req, res) => {
    const synced = syncClassesAndStudentsData(classesDB, studentsDB, teachersDB);
    classesDB = synced.classes;
    studentsDB = synced.students;
    teachersDB = synced.teachers;

    res.json({
      classes: classesDB,
      teachers: teachersDB,
      students: studentsDB
    });
  });

  // Student CRUD
  app.post('/api/master/students', (req, res) => {
    const { nisn, name, gender, classId, birthDate, address, parentName, parentPhone, photoUrl } = req.body;

    if (!nisn || !name || !classId) {
      return res.status(400).json({ error: 'NISN, Nama, dan Kelas wajib diisi.' });
    }

    if (studentsDB.some(s => s.nisn === nisn)) {
      return res.status(400).json({ error: `Siswa dengan NISN ${nisn} sudah ada!` });
    }

    const selectedClass = classesDB.find(c => c.id === classId);
    const newStudent: Student = {
      id: `std-${Date.now()}`,
      nisn: nisn.trim(),
      name: name.trim(),
      gender: gender || 'L',
      classId,
      className: selectedClass?.name || 'Unassigned',
      birthDate: birthDate || undefined,
      address: address || undefined,
      parentName: parentName || 'Wali Siswa',
      parentPhone: parentPhone || '-',
      photoUrl: photoUrl || '',
      defaultPassword: '123'
    };

    studentsDB.push(newStudent);

    // Update student count in class
    if (selectedClass) {
      selectedClass.studentCount = studentsDB.filter(s => s.classId === classId).length;
    }

    persistData();

    // Sync to Supabase if connected
    upsertStudentToSupabase(newStudent).catch(e => console.error('Error syncing new student to Supabase:', e));

    res.json({ success: true, student: newStudent, message: 'Data siswa berhasil ditambahkan!' });
  });

  app.put('/api/master/students/:id', (req, res) => {
    const { id } = req.params;
    const index = studentsDB.findIndex(s => s.id === id);

    if (index === -1) {
      return res.status(404).json({ error: 'Siswa tidak ditemukan.' });
    }

    const { nisn, name, gender, classId, birthDate, address, parentName, parentPhone, photoUrl } = req.body;
    const selectedClass = classesDB.find(c => c.id === classId);

    studentsDB[index] = {
      ...studentsDB[index],
      nisn: nisn || studentsDB[index].nisn,
      name: name || studentsDB[index].name,
      gender: gender || studentsDB[index].gender,
      classId: classId || studentsDB[index].classId,
      className: selectedClass ? selectedClass.name : studentsDB[index].className,
      birthDate: birthDate !== undefined ? birthDate : studentsDB[index].birthDate,
      address: address !== undefined ? address : studentsDB[index].address,
      parentName: parentName || studentsDB[index].parentName,
      parentPhone: parentPhone || studentsDB[index].parentPhone,
      photoUrl: photoUrl !== undefined ? photoUrl : studentsDB[index].photoUrl
    };

    // Update counts
    classesDB.forEach(c => {
      c.studentCount = studentsDB.filter(s => s.classId === c.id).length;
    });

    persistData();

    // Sync to Supabase if connected
    upsertStudentToSupabase(studentsDB[index]).catch(e => console.error('Error updating student in Supabase:', e));

    res.json({ success: true, student: studentsDB[index], message: 'Data siswa berhasil diperbarui!' });
  });

  app.delete('/api/master/students/:id', (req, res) => {
    const { id } = req.params;
    const student = studentsDB.find(s => s.id === id);
    if (!student) {
      return res.status(404).json({ error: 'Siswa tidak ditemukan.' });
    }

    studentsDB = studentsDB.filter(s => s.id !== id);
    // Remove attendance records belonging to deleted student
    attendanceDB = attendanceDB.filter(a => a.studentId !== id && a.nisn !== student.nisn);

    // Update class counts
    classesDB.forEach(c => {
      c.studentCount = studentsDB.filter(s => s.classId === c.id).length;
    });

    persistData();
    deleteStudentFromSupabase(id, student.nisn).catch(e => console.error('Error deleting student from Supabase:', e));
    res.json({ success: true, message: 'Data siswa berhasil dihapus!' });
  });

  // Bulk Delete Students
  app.post('/api/master/students/bulk-delete', (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Daftar ID siswa tidak boleh kosong.' });
    }

    const idSet = new Set(ids.map(id => String(id)));
    const targetStudents = studentsDB.filter(s => idSet.has(s.id));

    if (targetStudents.length === 0) {
      return res.status(404).json({ error: 'Tidak ada siswa yang cocok untuk dihapus.' });
    }

    const targetNisns = new Set(targetStudents.map(s => s.nisn));
    studentsDB = studentsDB.filter(s => !idSet.has(s.id));
    // Remove attendance records belonging to deleted students
    attendanceDB = attendanceDB.filter(a => !idSet.has(a.studentId) && !targetNisns.has(a.nisn));

    // Update class counts
    classesDB.forEach(c => {
      c.studentCount = studentsDB.filter(s => s.classId === c.id).length;
    });

    persistData();

    // Async deletion from Supabase
    targetStudents.forEach(st => {
      deleteStudentFromSupabase(st.id, st.nisn).catch(e => console.error('Error deleting student from Supabase:', e));
    });

    res.json({
      success: true,
      count: targetStudents.length,
      message: `Berhasil menghapus masal ${targetStudents.length} data siswa!`
    });
  });

  // Upload student 3x4 photo (Supabase Storage with Base64 fallback)
  app.post('/api/upload/student-photo', async (req, res) => {
    try {
      const { base64Data, nisn } = req.body;
      if (!base64Data) {
        return res.status(400).json({ error: 'Data foto 3x4 wajib disertakan.' });
      }

      const uploadResult = await uploadStudentPhotoToSupabase(base64Data, nisn || '0000000000');
      res.json({
        success: true,
        photoUrl: uploadResult.url,
        isSupabase: uploadResult.isSupabase,
        message: uploadResult.isSupabase 
          ? 'Pas foto berhasil diunggah ke Supabase Storage bucket!' 
          : 'Pas foto disimpan (Base64 fallback). Hubungkan Supabase untuk penyimpanan CDN cloud.'
      });
    } catch (err: any) {
      console.error('Error photo upload endpoint:', err);
      res.status(500).json({ error: err?.message || 'Gagal memproses unggah pas foto.' });
    }
  });

  // Teacher CRUD
  app.post('/api/master/teachers', (req, res) => {
    const { nip, name, gender, username, password, subject, assignedClassId, role } = req.body;

    if (!nip || !name || !username) {
      return res.status(400).json({ error: 'NIP, Nama, dan Username wajib diisi.' });
    }

    const assignedClass = classesDB.find(c => c.id === assignedClassId);
    const newTeacher: Teacher = {
      id: `tch-${Date.now()}`,
      nip: nip.trim(),
      name: name.trim(),
      gender: gender || 'L',
      username: username.trim().toLowerCase(),
      password: password ? password.trim() : undefined,
      subject: subject || 'Mata Pelajaran',
      role: role || 'guru',
      assignedClassId: assignedClassId || undefined,
      assignedClassName: assignedClass?.name || undefined
    };

    teachersDB.push(newTeacher);

    if (assignedClass) {
      assignedClass.teacherId = newTeacher.id;
      assignedClass.teacherName = newTeacher.name;
    }

    persistData();
    res.json({ success: true, teacher: newTeacher, message: 'Data guru berhasil ditambahkan!' });
  });

  app.put('/api/master/teachers/:id', (req, res) => {
    const { id } = req.params;
    const index = teachersDB.findIndex(t => t.id === id);

    if (index === -1) {
      return res.status(404).json({ error: 'Guru tidak ditemukan.' });
    }

    const { nip, name, gender, username, password, subject, assignedClassId, role } = req.body;
    const assignedClass = classesDB.find(c => c.id === assignedClassId);

    teachersDB[index] = {
      ...teachersDB[index],
      nip: nip || teachersDB[index].nip,
      name: name || teachersDB[index].name,
      gender: gender || teachersDB[index].gender,
      username: username ? username.toLowerCase() : teachersDB[index].username,
      password: password !== undefined ? (password.trim() || undefined) : teachersDB[index].password,
      subject: subject || teachersDB[index].subject,
      role: role || teachersDB[index].role || 'guru',
      assignedClassId: assignedClassId || undefined,
      assignedClassName: assignedClass ? assignedClass.name : undefined
    };

    if (assignedClass) {
      assignedClass.teacherId = teachersDB[index].id;
      assignedClass.teacherName = teachersDB[index].name;
    }

    persistData();
    res.json({ success: true, teacher: teachersDB[index], message: 'Data guru berhasil diperbarui!' });
  });

  app.delete('/api/master/teachers/:id', (req, res) => {
    const { id } = req.params;
    const teacher = teachersDB.find(t => t.id === id);
    teachersDB = teachersDB.filter(t => t.id !== id);
    classesDB.forEach(c => {
      if (c.teacherId === id) {
        c.teacherId = undefined;
        c.teacherName = undefined;
      }
    });
    persistData();
    deleteTeacherFromSupabase(id, teacher?.nip).catch(e => console.error('Error deleting teacher from Supabase:', e));
    res.json({ success: true, message: 'Data guru berhasil dihapus!' });
  });

  // Class CRUD
  app.post('/api/master/classes', (req, res) => {
    const { name, gradeLevel, teacherId } = req.body;
    if (!name || !gradeLevel) {
      return res.status(400).json({ error: 'Nama Kelas dan Tingkat wajib diisi.' });
    }

    const trimmedName = name.trim();
    if (classesDB.some(c => c.name.toLowerCase() === trimmedName.toLowerCase())) {
      return res.status(400).json({ error: `Kelas dengan nama "${trimmedName}" sudah ada!` });
    }

    const teacher = teachersDB.find(t => t.id === teacherId);
    const newClass: ClassRoom = {
      id: `cls-${Date.now()}`,
      name: trimmedName,
      gradeLevel,
      teacherId: teacher?.id,
      teacherName: teacher?.name,
      studentCount: 0
    };

    classesDB.push(newClass);

    if (teacher) {
      teachersDB.forEach(t => {
        if (t.assignedClassId === newClass.id && t.id !== teacher.id) {
          t.assignedClassId = undefined;
          t.assignedClassName = undefined;
        }
      });
      teacher.assignedClassId = newClass.id;
      teacher.assignedClassName = newClass.name;
    }

    persistData();
    res.json({ success: true, class: newClass, message: 'Kelas berhasil dibuat!' });
  });

  app.put('/api/master/classes/:id', (req, res) => {
    const { id } = req.params;
    const index = classesDB.findIndex(c => c.id === id);

    if (index === -1) {
      return res.status(404).json({ error: 'Kelas tidak ditemukan.' });
    }

    const { name, gradeLevel, teacherId } = req.body;
    const newName = name ? name.trim() : classesDB[index].name;
    const newGrade = gradeLevel || classesDB[index].gradeLevel;

    if (name && newName.toLowerCase() !== classesDB[index].name.toLowerCase()) {
      if (classesDB.some(c => c.id !== id && c.name.toLowerCase() === newName.toLowerCase())) {
        return res.status(400).json({ error: `Kelas dengan nama "${newName}" sudah ada!` });
      }
    }

    const oldTeacherId = classesDB[index].teacherId;
    const teacher = teacherId ? teachersDB.find(t => t.id === teacherId) : undefined;

    classesDB[index] = {
      ...classesDB[index],
      name: newName,
      gradeLevel: newGrade,
      teacherId: teacherId !== undefined ? (teacher ? teacher.id : undefined) : classesDB[index].teacherId,
      teacherName: teacherId !== undefined ? (teacher ? teacher.name : undefined) : classesDB[index].teacherName
    };

    if (teacherId !== undefined) {
      if (oldTeacherId && oldTeacherId !== teacherId) {
        const oldT = teachersDB.find(t => t.id === oldTeacherId);
        if (oldT && oldT.assignedClassId === id) {
          oldT.assignedClassId = undefined;
          oldT.assignedClassName = undefined;
        }
      }
      if (teacher) {
        teachersDB.forEach(t => {
          if (t.assignedClassId === id && t.id !== teacher.id) {
            t.assignedClassId = undefined;
            t.assignedClassName = undefined;
          }
        });
        teacher.assignedClassId = id;
        teacher.assignedClassName = newName;
      }
    } else if (name && newName !== classesDB[index].name) {
      const currentT = teachersDB.find(t => t.id === classesDB[index].teacherId);
      if (currentT) {
        currentT.assignedClassName = newName;
      }
    }

    if (name) {
      studentsDB.forEach(s => {
        if (s.classId === id) {
          s.className = newName;
        }
      });
    }

    persistData();
    res.json({ success: true, class: classesDB[index], message: 'Data kelas berhasil diperbarui!' });
  });

  app.delete('/api/master/classes/:id', (req, res) => {
    const { id } = req.params;
    const cls = classesDB.find(c => c.id === id);
    if (!cls) {
      return res.status(404).json({ error: 'Kelas tidak ditemukan.' });
    }

    const studentCount = studentsDB.filter(s => s.classId === id).length;
    if (studentCount > 0) {
      return res.status(400).json({
        error: `Kelas "${cls.name}" tidak dapat dihapus karena masih memiliki ${studentCount} siswa!`
      });
    }

    if (cls.teacherId) {
      const t = teachersDB.find(tech => tech.id === cls.teacherId);
      if (t) {
        t.assignedClassId = undefined;
        t.assignedClassName = undefined;
      }
    }

    classesDB = classesDB.filter(c => c.id !== id);
    persistData();
    deleteClassFromSupabase(id).catch(e => console.error('Error deleting class from Supabase:', e));
    res.json({ success: true, message: `Kelas "${cls.name}" berhasil dihapus!` });
  });

  // ==================== BK COUNSELING ENDPOINTS ====================
  app.get('/api/bk/notes', (req, res) => {
    const { studentId, search, statusResiko } = req.query;
    let filtered = [...bkNotesDB];

    if (studentId) {
      filtered = filtered.filter(n => n.studentId === studentId);
    }
    if (statusResiko) {
      filtered = filtered.filter(n => n.statusResiko === statusResiko);
    }
    if (search) {
      const q = String(search).toLowerCase();
      filtered = filtered.filter(n =>
        n.studentName.toLowerCase().includes(q) ||
        n.nisn.includes(q) ||
        n.className.toLowerCase().includes(q) ||
        n.category.toLowerCase().includes(q) ||
        n.note.toLowerCase().includes(q)
      );
    }

    res.json({ success: true, notes: filtered });
  });

  app.post('/api/bk/notes', (req, res) => {
    const { studentId, date, counselorName, category, statusResiko, note, actionTaken, spLevel, followUpDate } = req.body;

    const student = studentsDB.find(s => s.id === studentId || s.nisn === studentId);
    if (!student && !req.body.studentName) {
      return res.status(400).json({ error: 'Data siswa wajib dipilih untuk mencatat bimbingan BK.' });
    }

    const newNote: BKNote = {
      id: `bk-${Date.now()}`,
      studentId: student ? student.id : studentId,
      studentName: student ? student.name : (req.body.studentName || 'Siswa'),
      nisn: student ? student.nisn : (req.body.nisn || '-'),
      className: student ? student.className : (req.body.className || '-'),
      date: date || new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().split(' ')[0].substring(0, 5),
      counselorName: counselorName || 'Ibu Rahmawati, S.Psi (Guru BK)',
      category: category || 'Konseling Individual',
      statusResiko: statusResiko || 'Sedang',
      note: note || '',
      actionTaken: actionTaken || '',
      spLevel: spLevel || 'Tanpa SP',
      followUpDate: followUpDate || ''
    };

    bkNotesDB.unshift(newNote);
    persistData();
    res.json({ success: true, note: newNote, message: 'Catatan Bimbingan BK berhasil disimpan!' });
  });

  app.put('/api/bk/notes/:id', (req, res) => {
    const { id } = req.params;
    const index = bkNotesDB.findIndex(n => n.id === id);

    if (index === -1) {
      return res.status(404).json({ error: 'Catatan Bimbingan BK tidak ditemukan.' });
    }

    bkNotesDB[index] = {
      ...bkNotesDB[index],
      ...req.body
    };

    persistData();
    res.json({ success: true, note: bkNotesDB[index], message: 'Catatan Bimbingan BK berhasil diperbarui!' });
  });

  app.delete('/api/bk/notes/:id', (req, res) => {
    const { id } = req.params;
    const initialLen = bkNotesDB.length;
    bkNotesDB = bkNotesDB.filter(n => n.id !== id);

    if (bkNotesDB.length === initialLen) {
      return res.status(404).json({ error: 'Catatan BK tidak ditemukan.' });
    }

    persistData();
    res.json({ success: true, message: 'Catatan Bimbingan BK berhasil dihapus!' });
  });

  // Attendance Scanning & Recording
  app.post('/api/attendance/scan', (req, res) => {
    const { nisn, status = 'Hadir', notes = '', recordedBy = 'Sistem QR Code', recordedByRole = 'admin' } = req.body;

    if (!nisn) {
      return res.status(400).json({ error: 'Kode QR Code / NISN wajib diisi.' });
    }

    const student = studentsDB.find(s => s.nisn.trim() === nisn.trim());
    if (!student) {
      return res.status(444).json({ error: `NISN "${nisn}" tidak terdaftar di sistem SMA Islam Ra'iyatul Husnan!` });
    }

    const todayStr = getTodayStr();
    const timeStr = getTimeStr();

    // Check Holiday Status
    const holidayCheck = checkIsHoliday(todayStr);
    if (holidayCheck.isHoliday && !schoolSettingsDB.allowAbsenLibur) {
      return res.status(403).json({
        error: `Hari ini adalah HARI LIBUR: "${holidayCheck.name}". Sistem presensi non-aktif.`
      });
    }

    // Check Late Status
    let autoNotes = notes || '';
    if (status === 'Hadir' && checkIsLate(timeStr)) {
      const lateTag = `[TERLAMBAT] (Batas: ${schoolSettingsDB.batasTerlambat} WIB)`;
      if (!autoNotes.includes(lateTag)) {
        autoNotes = autoNotes ? `${autoNotes} | ${lateTag}` : lateTag;
      }
    }

    // Check if record exists for today
    const existingIndex = attendanceDB.findIndex(a => a.nisn === student.nisn && a.date === todayStr);

    let record: AttendanceRecord;
    if (existingIndex !== -1) {
      attendanceDB[existingIndex] = {
        ...attendanceDB[existingIndex],
        status: status as any,
        time: status === 'Hadir' ? timeStr : '-',
        notes: autoNotes || attendanceDB[existingIndex].notes,
        recordedBy,
        recordedByRole
      };
      record = attendanceDB[existingIndex];
    } else {
      record = {
        id: `att-${todayStr}-${student.nisn}`,
        studentId: student.id,
        nisn: student.nisn,
        studentName: student.name,
        classId: student.classId,
        className: student.className,
        date: todayStr,
        time: status === 'Hadir' ? timeStr : '-',
        status: status as any,
        notes: autoNotes,
        recordedBy,
        recordedByRole
      };
      attendanceDB.unshift(record);
    }

    persistData();
    res.json({
      success: true,
      record,
      student,
      message: `Presensi ${student.name} (${student.className}) berhasil dicatat sebagai "${status}" pada pukul ${timeStr} WIB.`
    });
  });

  // Bulk manual attendance submission
  app.post('/api/attendance/manual', (req, res) => {
    const { records, date, recordedBy, recordedByRole } = req.body;
    if (!Array.isArray(records)) {
      return res.status(400).json({ error: 'Format data presensi tidak valid.' });
    }

    const targetDate = date || getTodayStr();
    const currentTime = getTimeStr();

    records.forEach((item: { nisn: string; status: any; notes?: string }) => {
      const student = studentsDB.find(s => s.nisn === item.nisn);
      if (!student) return;

      const existingIndex = attendanceDB.findIndex(a => a.nisn === item.nisn && a.date === targetDate);
      if (existingIndex !== -1) {
        attendanceDB[existingIndex] = {
          ...attendanceDB[existingIndex],
          status: item.status,
          time: item.status === 'Hadir' ? (attendanceDB[existingIndex].time !== '-' ? attendanceDB[existingIndex].time : currentTime) : '-',
          notes: item.notes || '',
          recordedBy: recordedBy || 'Guru Kelas',
          recordedByRole: recordedByRole || 'guru'
        };
      } else {
        attendanceDB.unshift({
          id: `att-${targetDate}-${student.nisn}`,
          studentId: student.id,
          nisn: student.nisn,
          studentName: student.name,
          classId: student.classId,
          className: student.className,
          date: targetDate,
          time: item.status === 'Hadir' ? currentTime : '-',
          status: item.status,
          notes: item.notes || '',
          recordedBy: recordedBy || 'Guru Kelas',
          recordedByRole: recordedByRole || 'guru'
        });
      }
    });

    persistData();
    res.json({ success: true, message: `Presensi ${records.length} siswa berhasil disimpan.` });
  });

  // Bulk dismissal / checkout attendance submission (Absensi Pulang Jam Terakhir)
  app.post('/api/attendance/checkout', (req, res) => {
    const { classId, date, recordedBy, students } = req.body;
    if (!Array.isArray(students)) {
      return res.status(400).json({ error: 'Data absensi jam pulang tidak valid.' });
    }

    const targetDate = date || getTodayStr();
    const currentTime = getTimeStr();
    let updatedCount = 0;

    students.forEach((item: { nisn: string; checkedOut: boolean; notes?: string }) => {
      const student = studentsDB.find(s => s.nisn === item.nisn);
      if (!student) return;

      const existingIndex = attendanceDB.findIndex(a => a.nisn === item.nisn && a.date === targetDate);
      const isCheckedOut = !!item.checkedOut;
      const isEarly = checkIsEarlyDismissal(currentTime);
      const computedCheckOutStatus = isCheckedOut
        ? (isEarly ? 'Bolos / Pulang Awal' : 'Pulang')
        : 'Bolos / Pulang Awal';

      if (existingIndex !== -1) {
        attendanceDB[existingIndex] = {
          ...attendanceDB[existingIndex],
          checkOutTime: isCheckedOut ? currentTime : '-',
          checkOutStatus: computedCheckOutStatus,
          checkOutBy: recordedBy || 'Guru Jam Terakhir',
          notes: item.notes
            ? (attendanceDB[existingIndex].notes ? `${attendanceDB[existingIndex].notes} | Jam Pulang: ${item.notes}` : `Jam Pulang: ${item.notes}`)
            : attendanceDB[existingIndex].notes
        };
        updatedCount++;
      } else {
        attendanceDB.unshift({
          id: `att-${targetDate}-${student.nisn}`,
          studentId: student.id,
          nisn: student.nisn,
          studentName: student.name,
          classId: student.classId,
          className: student.className,
          date: targetDate,
          time: '-',
          status: isCheckedOut ? 'Hadir' : 'Alpa',
          recordedBy: recordedBy || 'Guru Jam Terakhir',
          recordedByRole: 'guru',
          checkOutTime: isCheckedOut ? currentTime : '-',
          checkOutStatus: computedCheckOutStatus,
          checkOutBy: recordedBy || 'Guru Jam Terakhir',
          notes: item.notes ? `Jam Pulang: ${item.notes}` : ''
        });
        updatedCount++;
      }
    });

    const targetClass = classesDB.find(c => c.id === classId);
    const className = targetClass ? targetClass.name : '';

    persistData();
    res.json({
      success: true,
      message: `Absensi jam pulang ${className ? 'Kelas ' + className : ''} (${updatedCount} siswa) berhasil disimpan pada pukul ${currentTime} WIB.`
    });
  });

  // Get attendance records
  app.get('/api/attendance', (req, res) => {
    cleanOrphanAttendance();
    const { classId, startDate, endDate, nisn, status, search } = req.query;

    let filtered = [...attendanceDB];

    if (studentsDB && studentsDB.length > 0) {
      const validNisns = new Set(studentsDB.map(s => s.nisn));
      const validIds = new Set(studentsDB.map(s => s.id));
      const validNames = new Set(studentsDB.map(s => (s.name || '').trim().toLowerCase()));
      filtered = filtered.filter(a =>
        validNisns.has(a.nisn) || validIds.has(a.studentId) || (a.studentName && validNames.has(a.studentName.trim().toLowerCase()))
      );
    }

    if (classId && classId !== 'all') {
      filtered = filtered.filter(a => a.classId === classId);
    }

    if (nisn) {
      filtered = filtered.filter(a => a.nisn === nisn);
    }

    if (startDate) {
      filtered = filtered.filter(a => a.date >= (startDate as string));
    }

    if (endDate) {
      filtered = filtered.filter(a => a.date <= (endDate as string));
    }

    if (status && status !== 'all') {
      filtered = filtered.filter(a => a.status === status);
    }

    if (search) {
      const q = (search as string).toLowerCase();
      filtered = filtered.filter(a => a.studentName.toLowerCase().includes(q) || a.nisn.includes(q) || a.className.toLowerCase().includes(q));
    }

    // Sort by date desc then time desc
    filtered.sort((a, b) => {
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return b.time.localeCompare(a.time);
    });

    res.json({ records: filtered, total: filtered.length });
  });

  // Import Batch Students
  app.post('/api/import/students', (req, res) => {
    const { students } = req.body;
    if (!Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ error: 'Data import siswa kosong atau tidak valid.' });
    }

    let addedCount = 0;
    let updatedCount = 0;
    let createdClassesCount = 0;
    const newlyCreatedClassNames: string[] = [];

    students.forEach((item, itemIdx) => {
      if (!item.nisn || !item.name) return;

      const rawClassName = String(item.className || item.class || item.NamaKelas || item['Nama Kelas'] || item['Kelas'] || '').trim();
      let cls = findMatchingClass(rawClassName, item.classId, classesDB);

      // Auto create class if specified className does not exist yet
      if (!cls && rawClassName) {
        const gradeLevel = inferGradeLevel(rawClassName);
        cls = {
          id: `cls-${Date.now()}-${itemIdx}-${Math.random().toString(36).substring(2, 7)}`,
          name: rawClassName,
          gradeLevel: gradeLevel,
          studentCount: 0
        };
        classesDB.push(cls);
        createdClassesCount++;
        newlyCreatedClassNames.push(rawClassName);
      } else if (!cls && classesDB.length > 0) {
        cls = classesDB[0];
      }

      const genderCode: 'L' | 'P' = (String(item.gender || '').trim().toUpperCase().startsWith('P') || item.gender === 'Perempuan') ? 'P' : 'L';
      const cleanNisn = String(item.nisn).trim();
      const cleanBirthDate = item.birthDate ? String(item.birthDate).trim() : undefined;
      const cleanAddress = item.address ? String(item.address).trim() : undefined;
      const cleanAcademicYear = item.academicYear ? String(item.academicYear).trim() : '2024/2025';

      const existingIndex = studentsDB.findIndex(s => s.nisn === cleanNisn);
      if (existingIndex !== -1) {
        studentsDB[existingIndex] = {
          ...studentsDB[existingIndex],
          name: String(item.name).trim() || studentsDB[existingIndex].name,
          gender: genderCode,
          classId: cls ? cls.id : studentsDB[existingIndex].classId,
          className: cls ? cls.name : studentsDB[existingIndex].className,
          birthDate: cleanBirthDate !== undefined ? cleanBirthDate : studentsDB[existingIndex].birthDate,
          address: cleanAddress !== undefined ? cleanAddress : studentsDB[existingIndex].address,
          academicYear: cleanAcademicYear || studentsDB[existingIndex].academicYear || '2024/2025',
          parentName: item.parentName ? String(item.parentName).trim() : studentsDB[existingIndex].parentName,
          parentPhone: item.parentPhone ? String(item.parentPhone).trim() : studentsDB[existingIndex].parentPhone
        };
        updatedCount++;
        upsertStudentToSupabase(studentsDB[existingIndex]).catch(e => console.error('Error syncing imported student update to Supabase:', e));
      } else {
        const newSt: Student = {
          id: item.id || `std-${Date.now()}-${itemIdx}-${Math.random().toString(36).substring(2, 7)}`,
          nisn: cleanNisn,
          name: String(item.name).trim(),
          gender: genderCode,
          classId: cls ? cls.id : 'cls-1',
          className: cls ? cls.name : 'X MIPA 1',
          birthDate: cleanBirthDate,
          address: cleanAddress,
          academicYear: cleanAcademicYear || '2024/2025',
          parentName: item.parentName ? String(item.parentName).trim() : 'Wali Murid',
          parentPhone: item.parentPhone ? String(item.parentPhone).trim() : '-',
          defaultPassword: '123'
        };
        studentsDB.push(newSt);
        addedCount++;
        upsertStudentToSupabase(newSt).catch(e => console.error('Error syncing new imported student to Supabase:', e));
      }
    });

    // Run full sync & persist data
    persistData();

    let extraMsg = '';
    if (createdClassesCount > 0) {
      extraMsg = ` (${createdClassesCount} kelas baru otomatis dibuat: ${newlyCreatedClassNames.join(', ')})`;
    }

    res.json({
      success: true,
      message: `Import Berhasil! ${addedCount} data siswa baru ditambahkan, ${updatedCount} data diperbarui.${extraMsg}`
    });
  });

  // Import Batch Teachers
  app.post('/api/import/teachers', (req, res) => {
    const { teachers } = req.body;
    if (!Array.isArray(teachers) || teachers.length === 0) {
      return res.status(400).json({ error: 'Data import guru kosong atau tidak valid.' });
    }

    let count = 0;
    teachers.forEach(item => {
      if (!item.nip || !item.name) return;
      const existing = teachersDB.find(t => t.nip === String(item.nip).trim());
      if (!existing) {
        teachersDB.push({
          id: `tch-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          nip: String(item.nip).trim(),
          name: item.name.trim(),
          gender: item.gender === 'P' ? 'P' : 'L',
          username: (item.username || item.name.split(' ')[0]).toLowerCase(),
          subject: item.subject || 'Guru Pengajar'
        });
        count++;
      }
    });

    res.json({ success: true, message: `Import Berhasil! ${count} data guru baru ditambahkan.` });
  });

  // Reset demo database to initial state
  app.post('/api/reset-data', (req, res) => {
    classesDB = [...INITIAL_CLASSES];
    teachersDB = [...INITIAL_TEACHERS];
    studentsDB = [...INITIAL_STUDENTS];
    attendanceDB = generateInitialAttendance();
    res.json({ success: true, message: 'Database telah direset ke kondisi awal!' });
  });

  // ==================== GOOGLE SHEETS DATABASE ENDPOINTS ====================

  // Get current spreadsheet configuration status
  app.get('/api/sheets/status', (req, res) => {
    res.json(getCurrentSheetsConfig());
  });

  // Initialize or connect to Google Spreadsheet
  app.post('/api/sheets/init', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const { accessToken: bodyToken, spreadsheetId } = req.body;
      const accessToken = (authHeader && authHeader.startsWith('Bearer '))
        ? authHeader.split(' ')[1]
        : bodyToken;

      if (!accessToken) {
        return res.status(401).json({ error: 'OAuth Access Token Google tidak ditemukan. Harap Sign-in via Google.' });
      }

      const config = await initGoogleSpreadsheet(accessToken, spreadsheetId);
      // Automatically push initial data to the spreadsheet
      await pushAllToSpreadsheet(accessToken, config.spreadsheetId, studentsDB, teachersDB, classesDB, attendanceDB);

      res.json({
        success: true,
        ...config,
        message: 'Database Google Spreadsheet berhasil terhubung & disinkronisasi!'
      });
    } catch (error: any) {
      console.error('Error init Google Sheets:', error);
      const rawMsg = error?.response?.data?.error?.message || error?.message || '';
      let userMsg = 'Gagal mengonfigurasi Google Spreadsheet database.';
      if (rawMsg.includes('invalid authentication credentials') || rawMsg.includes('Invalid Credentials') || error?.code === 401) {
        userMsg = 'Token Akses Google OAuth tidak valid atau sudah kadaluarsa. Silakan lakukan Sign-In Google ulang atau perbarui Access Token secara manual.';
      } else if (rawMsg) {
        userMsg = `Google API Error: ${rawMsg}`;
      }
      res.status(500).json({ error: userMsg });
    }
  });

  // Sync state from server DB -> Google Spreadsheet
  app.post('/api/sheets/sync-to-sheet', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const { accessToken: bodyToken, spreadsheetId } = req.body;
      const accessToken = (authHeader && authHeader.startsWith('Bearer '))
        ? authHeader.split(' ')[1]
        : bodyToken;
      const targetId = spreadsheetId || getCurrentSheetsConfig().spreadsheetId;

      if (!accessToken || !targetId) {
        return res.status(400).json({ error: 'Membutuhkan Access Token dan Spreadsheet ID.' });
      }

      const result = await pushAllToSpreadsheet(accessToken, targetId, studentsDB, teachersDB, classesDB, attendanceDB);
      res.json({ success: true, ...result, message: 'Seluruh data berhasil diekspor ke Google Spreadsheet!' });
    } catch (error: any) {
      console.error('Error sync-to-sheet:', error);
      const rawMsg = error?.response?.data?.error?.message || error?.message || '';
      let userMsg = 'Gagal mengekspor data ke Google Spreadsheet.';
      if (rawMsg.includes('invalid authentication credentials') || rawMsg.includes('Invalid Credentials') || error?.code === 401) {
        userMsg = 'Token Akses Google OAuth tidak valid atau sudah kadaluarsa. Silakan lakukan Sign-In Google ulang.';
      } else if (rawMsg) {
        userMsg = `Google API Error: ${rawMsg}`;
      }
      res.status(500).json({ error: userMsg });
    }
  });

  // Sync state from Google Spreadsheet -> server DB
  app.post('/api/sheets/sync-from-sheet', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const { accessToken: bodyToken, spreadsheetId } = req.body;
      const accessToken = (authHeader && authHeader.startsWith('Bearer '))
        ? authHeader.split(' ')[1]
        : bodyToken;
      const targetId = spreadsheetId || getCurrentSheetsConfig().spreadsheetId;

      if (!accessToken || !targetId) {
        return res.status(400).json({ error: 'Membutuhkan Access Token dan Spreadsheet ID.' });
      }

      const pulledData = await pullAllFromSpreadsheet(accessToken, targetId);
      if (pulledData.students.length > 0) studentsDB = pulledData.students;
      if (pulledData.teachers.length > 0) teachersDB = pulledData.teachers;
      if (pulledData.classes.length > 0) classesDB = pulledData.classes;
      if (pulledData.attendanceRecords.length > 0) attendanceDB = pulledData.attendanceRecords;

      res.json({
        success: true,
        counts: {
          students: studentsDB.length,
          teachers: teachersDB.length,
          classes: classesDB.length,
          attendance: attendanceDB.length
        },
        message: 'Data berhasil diimpor & disinkronkan dari Google Spreadsheet database!'
      });
    } catch (error: any) {
      console.error('Error sync-from-sheet:', error);
      const rawMsg = error?.response?.data?.error?.message || error?.message || '';
      let userMsg = 'Gagal mengimpor data dari Google Spreadsheet.';
      if (rawMsg.includes('invalid authentication credentials') || rawMsg.includes('Invalid Credentials') || error?.code === 401) {
        userMsg = 'Token Akses Google OAuth tidak valid atau sudah kadaluarsa. Silakan lakukan Sign-In Google ulang.';
      } else if (rawMsg) {
        userMsg = `Google API Error: ${rawMsg}`;
      }
      res.status(500).json({ error: userMsg });
    }
  });

  // ==================== SUPABASE API ROUTES ====================

  // Get Supabase config & status
  app.get('/api/supabase/config', async (req, res) => {
    const config = loadSupabaseConfig();
    res.json({
      ...config,
      schema: SUPABASE_SQL_SCHEMA
    });
  });

  // Save Supabase config & test connection
  app.post('/api/supabase/config', async (req, res) => {
    const { url, anonKey, autoSync } = req.body;
    if (!url || !anonKey) {
      return res.status(400).json({ error: 'Supabase URL dan Anon Key wajib diisi.' });
    }

    saveSupabaseConfig({
      url: url.trim(),
      anonKey: anonKey.trim(),
      autoSync: autoSync ?? true
    });

    const health = await testSupabaseConnection();
    if (health.success) {
      res.json({
        success: true,
        message: health.message,
        status: 'connected'
      });
    } else {
      res.status(400).json({
        error: health.message,
        status: 'error'
      });
    }
  });

  // Push local data -> Supabase
  app.post('/api/supabase/push', async (req, res) => {
    try {
      const result = await pushAllToSupabase({
        classes: classesDB,
        teachers: teachersDB,
        students: studentsDB,
        attendance: attendanceDB,
        settings: schoolSettingsDB
      });

      if (result.success) {
        res.json(result);
      } else {
        res.status(500).json({ error: result.message });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Gagal mengekspor data ke Supabase.' });
    }
  });

  // Pull data from Supabase -> local memory
  app.post('/api/supabase/pull', async (req, res) => {
    try {
      const result = await pullAllFromSupabase();
      if (result.success && result.data) {
        if (result.data.classes.length > 0) classesDB = result.data.classes;
        if (result.data.teachers.length > 0) teachersDB = result.data.teachers;
        if (result.data.students.length > 0) studentsDB = result.data.students;
        if (result.data.attendance.length > 0) attendanceDB = result.data.attendance;
        if (result.data.settings) schoolSettingsDB = { ...schoolSettingsDB, ...result.data.settings };

        saveLocalDBBackup({ classes: classesDB, teachers: teachersDB, students: studentsDB, attendance: attendanceDB, bkNotes: bkNotesDB, settings: schoolSettingsDB });

        res.json({
          success: true,
          message: result.message,
          counts: {
            students: studentsDB.length,
            teachers: teachersDB.length,
            classes: classesDB.length,
            attendance: attendanceDB.length
          }
        });
      } else {
        res.status(500).json({ error: result.message });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Gagal mengimpor data dari Supabase.' });
    }
  });

  // Vite middleware for development (only when not on Vercel)
  if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (!process.env.VERCEL) {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', async () => {
      console.log(`[SMA Islam Ra'iyatul Husnan Server] running on http://localhost:${PORT}`);
      try {
        const initSync = await pullAllFromSupabase();
        if (initSync && initSync.success && initSync.data) {
          if (initSync.data.classes.length > 0) classesDB = initSync.data.classes;
          if (initSync.data.teachers.length > 0) teachersDB = initSync.data.teachers;
          if (initSync.data.students.length > 0) studentsDB = initSync.data.students;
          if (initSync.data.attendance.length > 0) attendanceDB = initSync.data.attendance;
          console.log(`[Supabase Boot Sync] Auto-synced ${studentsDB.length} students, ${classesDB.length} classes from Supabase.`);
        }
      } catch (err) {
        console.warn('[Supabase Boot Sync] Warning during startup pull:', err);
      }
    });
  }
}

startServer();

export default app;
