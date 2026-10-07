import { User, Student, Teacher, ClassRoom, AttendanceRecord, AttendanceStatus, UserRole, SchoolSettings, BKNote, KBMJournalEntry } from '../types';
import { INITIAL_CLASSES, INITIAL_TEACHERS, INITIAL_STUDENTS, generateInitialAttendance, INITIAL_BK_NOTES, generateInitialKBMJournals } from '../data/mockDatabase';
import { getStoredSupabaseConfig, isBrowserSupabaseConfigured, pushAllFromBrowser, pullAllFromBrowser, getBrowserSupabaseClient, deleteTeacherFromBrowserSupabase, deleteClassFromBrowserSupabase, deleteStudentFromBrowserSupabase, upsertTeacherToBrowserSupabase, upsertSettingsToBrowserSupabase, upsertStudentToBrowserSupabase, upsertAttendanceToBrowserSupabase, decodeStudentFromSupabaseRow } from './clientSupabase';
import { syncClassesAndStudentsData } from '../utils/dataSync';
import { normalizeDateToYMD, isStudentNameMatch, isStudentBirthDateMatch, getTodayWibDate, isTodayRecord } from '../utils/studentAuthHelper';

// Safe JSON fetch wrapper that checks Content-Type to prevent HTML "Unexpected token T" errors on Vercel
async function safeFetchJson<T = any>(url: string, options?: RequestInit): Promise<{ ok: boolean; status: number; data?: T; isHtml?: boolean; error?: string }> {
  try {
    const headers = new Headers(options?.headers);
    if (!headers.has('Cache-Control')) {
      headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      headers.set('Pragma', 'no-cache');
    }
    const finalOptions: RequestInit = {
      ...options,
      headers,
      cache: 'no-store'
    };
    const res = await fetch(url, finalOptions);
    const contentType = res.headers.get('content-type') || '';

    if (!contentType.includes('application/json')) {
      return {
        ok: false,
        status: res.status,
        isHtml: true,
        error: 'Backend endpoint tidak tersedia (Response HTML/Vercel static mode).'
      };
    }

    const data = await res.json();
    if (!res.ok) {
      return { ok: false, status: res.status, data, error: data?.error || `HTTP Error ${res.status}` };
    }
    return { ok: true, status: res.status, data };
  } catch (err: any) {
    return { ok: false, status: 0, error: err?.message || 'Gagal terhubung ke server.' };
  }
}

// Client-side LocalStorage Helpers for Vercel Static Fallback Mode
const DEFAULT_SETTINGS: SchoolSettings = {
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
  hariLiburRutin: [0, 6],
  hariLiburKhusus: [
    { id: 'hol-1', date: '2026-08-17', name: 'HUT Kemerdekaan RI ke-81', isNational: true },
    { id: 'hol-2', date: '2026-05-01', name: 'Hari Buruh Nasional', isNational: true },
    { id: 'hol-3', date: '2026-06-01', name: 'Hari Lahir Pancasila', isNational: true }
  ],
  allowAbsenLibur: false
};

function getLocalClasses(): ClassRoom[] {
  const raw = localStorage.getItem('app_master_classes');
  if (!raw) {
    localStorage.setItem('app_master_classes', JSON.stringify(INITIAL_CLASSES));
    return [...INITIAL_CLASSES];
  }
  try { return JSON.parse(raw); } catch { return [...INITIAL_CLASSES]; }
}

function saveLocalClasses(data: ClassRoom[]) {
  localStorage.setItem('app_master_classes', JSON.stringify(data));
}

function getLocalTeachers(): Teacher[] {
  const raw = localStorage.getItem('app_master_teachers');
  if (!raw) {
    localStorage.setItem('app_master_teachers', JSON.stringify(INITIAL_TEACHERS));
    return [...INITIAL_TEACHERS];
  }
  try { return JSON.parse(raw); } catch { return [...INITIAL_TEACHERS]; }
}

function saveLocalTeachers(data: Teacher[]) {
  localStorage.setItem('app_master_teachers', JSON.stringify(data));
}

function getLocalStudents(): Student[] {
  const raw = localStorage.getItem('app_master_students');
  if (!raw) {
    localStorage.setItem('app_master_students', JSON.stringify(INITIAL_STUDENTS));
    return [...INITIAL_STUDENTS];
  }
  try { return JSON.parse(raw); } catch { return [...INITIAL_STUDENTS]; }
}

function saveLocalStudents(data: Student[]) {
  localStorage.setItem('app_master_students', JSON.stringify(data));
}

function getLocalAttendance(): AttendanceRecord[] {
  const raw = localStorage.getItem('app_attendance_records');
  const localStudents = getLocalStudents();
  const validNisns = new Set(localStudents.map(s => s.nisn));
  const validIds = new Set(localStudents.map(s => s.id));
  const validNames = new Set(localStudents.map(s => (s.name || '').trim().toLowerCase()));

  if (!raw) {
    const initial = generateInitialAttendance().filter(a =>
      validNisns.has(a.nisn) || validIds.has(a.studentId) || (a.studentName && validNames.has(a.studentName.trim().toLowerCase()))
    );
    localStorage.setItem('app_attendance_records', JSON.stringify(initial));
    return initial;
  }
  try {
    const parsed: AttendanceRecord[] = JSON.parse(raw);
    const cleaned = parsed.filter(a =>
      validNisns.has(a.nisn) || validIds.has(a.studentId) || (a.studentName && validNames.has(a.studentName.trim().toLowerCase()))
    );
    if (cleaned.length !== parsed.length) {
      localStorage.setItem('app_attendance_records', JSON.stringify(cleaned));
    }
    return cleaned;
  } catch {
    return [];
  }
}

function saveLocalAttendance(data: AttendanceRecord[]) {
  localStorage.setItem('app_attendance_records', JSON.stringify(data));
}

function getLocalSettings(): SchoolSettings {
  const raw = localStorage.getItem('app_school_settings');
  if (!raw) {
    localStorage.setItem('app_school_settings', JSON.stringify(DEFAULT_SETTINGS));
    return DEFAULT_SETTINGS;
  }
  try {
    const parsed = JSON.parse(raw);
    let changed = false;
    if (!parsed.namaKepalaSekolah || parsed.namaKepalaSekolah === "Ust. Ahmad Fausan, S.Pd") {
      parsed.namaKepalaSekolah = "SAIFURRAHMAN, SH";
      changed = true;
    }
    if (parsed.nipKepalaSekolah === "198504122010011002") {
      parsed.nipKepalaSekolah = "";
      changed = true;
    }
    if (changed) {
      localStorage.setItem('app_school_settings', JSON.stringify(parsed));
    }
    return parsed;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveLocalSettings(data: SchoolSettings) {
  localStorage.setItem('app_school_settings', JSON.stringify(data));
}

function getLocalBKNotes(): BKNote[] {
  const raw = localStorage.getItem('app_bk_notes');
  if (!raw) {
    localStorage.setItem('app_bk_notes', JSON.stringify(INITIAL_BK_NOTES));
    return [...INITIAL_BK_NOTES];
  }
  try { return JSON.parse(raw); } catch { return [...INITIAL_BK_NOTES]; }
}

function saveLocalBKNotes(data: BKNote[]) {
  localStorage.setItem('app_bk_notes', JSON.stringify(data));
}

function getLocalKBMJournals(): KBMJournalEntry[] {
  const raw = localStorage.getItem('app_kbm_journals');
  if (!raw) {
    const initial = generateInitialKBMJournals();
    localStorage.setItem('app_kbm_journals', JSON.stringify(initial));
    return initial;
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalKBMJournals(data: KBMJournalEntry[]) {
  localStorage.setItem('app_kbm_journals', JSON.stringify(data));
}

export const INITIAL_MASTER_SUBJECTS = [
  'Matematika', 'Fisika', 'Biologi', 'Kimia',
  'Bahasa Indonesia', 'Bahasa Inggris', 'Bahasa Arab',
  'Pendidikan Agama Islam', 'Pendidikan Pancasila / PKn',
  'Sejarah', 'Geografi', 'Sosiologi', 'Ekonomi',
  'PJOK (Olahraga)', 'Seni Budaya', 'Informatika / Komputer',
  'Prakarya & Kewirausahaan', 'Bimbingan Konseling (BK)'
];

function getLocalSubjects(): string[] {
  const raw = localStorage.getItem('app_master_subjects');
  if (!raw) {
    localStorage.setItem('app_master_subjects', JSON.stringify(INITIAL_MASTER_SUBJECTS));
    return [...INITIAL_MASTER_SUBJECTS];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [...INITIAL_MASTER_SUBJECTS];
  } catch {
    return [...INITIAL_MASTER_SUBJECTS];
  }
}

function saveLocalSubjects(data: string[]) {
  localStorage.setItem('app_master_subjects', JSON.stringify(data));
}

// Background auto-sync to Supabase if configured in browser
async function triggerAutoSupabaseSync() {
  try {
    const config = getStoredSupabaseConfig();
    if (config.status === 'connected' && config.url && config.anonKey && config.autoSync) {
      await pushAllFromBrowser(config.url, config.anonKey, {
        classes: getLocalClasses(),
        teachers: getLocalTeachers(),
        students: getLocalStudents(),
        attendance: getLocalAttendance()
      });
    }
  } catch (err) {
    console.warn('Background Supabase client auto-sync:', err);
  }
}

// Auto-sync Supabase Credentials from Server to Client localStorage
export async function syncSupabaseCredentialsWithServer() {
  try {
    const res = await safeFetchJson<{ url?: string; anonKey?: string; autoSync?: boolean }>('/api/supabase/config');
    if (res.ok && res.data?.url && res.data?.anonKey) {
      localStorage.setItem('app_supabase_url', res.data.url);
      localStorage.setItem('app_supabase_anon_key', res.data.anonKey);
      if (res.data.autoSync !== undefined) {
        localStorage.setItem('app_supabase_auto_sync', res.data.autoSync ? 'true' : 'false');
      }
    }
  } catch (err) {
    console.warn('Background Supabase config sync:', err);
  }
}

// Dynamic Favicon Helper
export function updateAppFavicon(logoUrl?: string) {
  if (typeof document === 'undefined') return;
  const href = logoUrl || "/school-logo.png";
  let link: HTMLLinkElement | null = document.querySelector("#app-favicon") || document.querySelector("link[rel*='icon']");
  if (!link) {
    link = document.createElement('link');
    link.id = 'app-favicon';
    link.rel = 'icon';
    document.getElementsByTagName('head')[0].appendChild(link);
  }
  link.href = href;
  if (href.startsWith('data:image/svg')) {
    link.type = 'image/svg+xml';
  } else if (href.startsWith('data:image/png')) {
    link.type = 'image/png';
  } else if (href.startsWith('data:image/webp')) {
    link.type = 'image/webp';
  } else {
    link.type = 'image/jpeg';
  }
}

export const apiService = {
  // Settings
  async getSettings(): Promise<{ success: boolean; settings?: SchoolSettings; error?: string }> {
    const res = await safeFetchJson<{ settings?: SchoolSettings }>('/api/settings');
    let settings: SchoolSettings;
    if (res.ok && res.data?.settings) {
      settings = res.data.settings;
      saveLocalSettings(settings);
    } else {
      const supabase = getBrowserSupabaseClient();
      let supabaseSettingsFetched = false;
      if (supabase) {
        try {
          const { data: rawSettings } = await supabase.from('school_settings').select('*').maybeSingle();
          if (rawSettings) {
            settings = {
              namaSekolah: rawSettings.nama_sekolah || "SMA ISLAM RA'IYATUL HUSNAN",
              subNamaSekolah: rawSettings.sub_nama_sekolah || "WRINGIN BONDOWOSO",
              npsn: rawSettings.npsn || "20521620",
              nss: rawSettings.nss || "302052202010",
              akreditasi: rawSettings.akreditasi || "B",
              alamat: rawSettings.alamat || "Jl. Raya Wringin No. 45",
              desaKelurahan: rawSettings.desa_kelurahan || "Wringin",
              kecamatan: rawSettings.kecamatan || "Wringin",
              kabupatenKota: rawSettings.kabupaten_kota || "Bondowoso",
              provinsi: rawSettings.provinsi || "Jawa Timur",
              kodePos: rawSettings.kode_pos || "68252",
              telepon: rawSettings.telepon || "(0332) 421xxx / 081234567890",
              email: rawSettings.email || "smaislam.raiyatulhusnan@gmail.sch.id",
              website: rawSettings.website || "www.smaislam-raiyatulhusnan.sch.id",
              logoUrl: rawSettings.logo_url || "/school-logo.png",
              namaKepalaSekolah: (rawSettings.nama_kepala_sekolah && rawSettings.nama_kepala_sekolah !== "Ust. Ahmad Fausan, S.Pd") ? rawSettings.nama_kepala_sekolah : "SAIFURRAHMAN, SH",
              nipKepalaSekolah: (rawSettings.nip_kepala_sekolah && rawSettings.nip_kepala_sekolah !== "198504122010011002") ? rawSettings.nip_kepala_sekolah : "",
              naunganYayasan: rawSettings.naungan_yayasan || "Yayasan Ra'iyatul Husnan Wringin",
              jamMasuk: rawSettings.jam_masuk || '07:00',
              batasTerlambat: rawSettings.batas_terlambat || '07:15',
              jamPulang: rawSettings.jam_pulang || '14:00',
              batasPulang: rawSettings.batas_pulang || '16:00',
              hariLiburRutin: [0, 6],
              hariLiburKhusus: [],
              allowAbsenLibur: false
            };
            saveLocalSettings(settings);
            supabaseSettingsFetched = true;
          }
        } catch (e) {
          console.warn('Error fetching school_settings from browser Supabase:', e);
        }
      }
      if (!supabaseSettingsFetched) {
        settings = getLocalSettings();
      }
    }
    updateAppFavicon(settings.logoUrl);
    return { success: true, settings };
  },

  async getSubjects(): Promise<{ success: boolean; subjects: string[] }> {
    const subjects = getLocalSubjects();
    return { success: true, subjects };
  },

  async saveSubjects(subjects: string[]): Promise<{ success: boolean; subjects: string[]; message: string }> {
    saveLocalSubjects(subjects);
    return { success: true, subjects, message: 'Daftar mata pelajaran berhasil disimpan.' };
  },

  async updateSettings(settingsData: Partial<SchoolSettings>): Promise<{ success: boolean; settings?: SchoolSettings; message?: string; error?: string }> {
    const res = await safeFetchJson<{ settings?: SchoolSettings; message?: string }>('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settingsData)
    });

    let settings: SchoolSettings;
    if (res.ok && res.data?.settings) {
      settings = res.data.settings;
    } else {
      const current = getLocalSettings();
      settings = { ...current, ...settingsData };
    }

    saveLocalSettings(settings);
    updateAppFavicon(settings.logoUrl);
    await upsertSettingsToBrowserSupabase(settings);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('school-settings-updated', { detail: settings }));
    }
    return { success: true, settings, message: res.data?.message || 'Pengaturan sekolah berhasil diperbarui.' };
  },

  // Auth
  async login(role: UserRole | 'staff', username: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> {
    const res = await safeFetchJson<{ user?: User; error?: string }>('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, username, password })
    });
    if (res.ok && res.data?.user) {
      return { success: true, user: res.data.user };
    }

    // Attempt to pull latest data from Supabase directly in browser if on static mode or new device
    try {
      const sbConfig = getStoredSupabaseConfig();
      if (sbConfig.url && sbConfig.anonKey) {
        const pullRes = await pullAllFromBrowser(sbConfig.url, sbConfig.anonKey);
        if (pullRes.success && pullRes.data) {
          if (pullRes.data.classes?.length > 0) saveLocalClasses(pullRes.data.classes);
          if (pullRes.data.teachers?.length > 0) saveLocalTeachers(pullRes.data.teachers);
          if (pullRes.data.students?.length > 0) saveLocalStudents(pullRes.data.students);
          if (pullRes.data.attendance?.length > 0) saveLocalAttendance(pullRes.data.attendance);
        }
      }
    } catch (err) {
      console.warn('Browser Supabase pull on login:', err);
    }

    // Client fallback authentication
    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();
    const lowerUname = trimmedUsername.toLowerCase();

    if (role === 'wali') {
      const students = getLocalStudents();
      const cleanInput = trimmedUsername.replace(/\D/g, '');
      
      // 1. Check NISN
      let student = students.find(s => s.nisn === trimmedUsername);

      // 2. Check Parent Phone
      if (!student && cleanInput.length >= 8) {
        student = students.find(s => {
          const sPhoneClean = (s.parentPhone || '').replace(/\D/g, '');
          if (!sPhoneClean) return false;
          return sPhoneClean === cleanInput || 
                 sPhoneClean.endsWith(cleanInput) || 
                 cleanInput.endsWith(sPhoneClean) ||
                 (cleanInput.startsWith('0') && sPhoneClean === '62' + cleanInput.slice(1)) ||
                 (cleanInput.startsWith('62') && sPhoneClean === '0' + cleanInput.slice(2));
        });
      }

      if (student) {
        return {
          success: true,
          user: {
            id: `wali-${student.id}`,
            username: student.nisn,
            name: student.parentName || `Wali dari ${student.name}`,
            role: 'wali',
            nisn: student.nisn,
            childNisn: student.nisn,
            childName: student.name,
            className: student.className
          }
        };
      }
      return { 
        success: false, 
        error: (res.data?.error && !res.isHtml) ? res.data.error : 'Data Siswa / Nomor HP Wali tidak terdaftar dalam database sekolah.' 
      };
    }

    // Staff auto-detection (Admin / Guru / BK)
    if (lowerUname === 'admin' || lowerUname === '123456') {
      if (trimmedPassword === 'admin123' || trimmedPassword === '123456' || trimmedPassword === '123') {
        return {
          success: true,
          user: { id: 'admin-1', username: 'admin', name: 'Administrator Utama', role: 'admin' }
        };
      }
      return { success: false, error: 'Password Admin salah.' };
    }

    const teachers = getLocalTeachers();
    const teacher = teachers.find(t => t.username.toLowerCase() === lowerUname || t.nip === trimmedUsername);
    if (teacher) {
      if ((teacher.password && trimmedPassword === teacher.password) || trimmedPassword === '123' || trimmedPassword === 'guru123' || trimmedPassword === 'admin123' || trimmedPassword === 'bk123' || trimmedPassword === teacher.nip || trimmedPassword === teacher.nip.slice(-6)) {
        return {
          success: true,
          user: {
            id: teacher.id,
            username: teacher.username,
            name: teacher.name,
            role: (teacher.role as UserRole) || 'guru',
            nip: teacher.nip,
            classId: teacher.assignedClassId,
            className: teacher.assignedClassName
          }
        };
      }
      return { success: false, error: 'Password yang Anda masukkan salah.' };
    }

    if (lowerUname === 'bk' || lowerUname === 'rahma') {
      if (trimmedPassword === 'bk123' || trimmedPassword === 'guru123' || trimmedPassword === 'admin123' || trimmedPassword === '123') {
        return {
          success: true,
          user: { id: 'tch-bk', username: 'rahma', name: 'Ibu Rahmawati, S.Psi', role: 'bk', nip: '199105152016022005' }
        };
      }
      return { success: false, error: 'Password Guru BK salah.' };
    }

    const cleanError = (res.data?.error && !res.isHtml) ? res.data.error : 'Username/NIP atau Password yang Anda masukkan tidak terdaftar.';
    return { success: false, error: cleanError };
  },

  // Secure Targeted Verification for Wali Murid (Name + Birth Date)
  async verifyWaliStudent(params: {
    studentName: string;
    birthDate?: string;
    parentPhone?: string;
    classId?: string;
  }): Promise<{
    success: boolean;
    user?: User;
    studentInfo?: { name: string; className: string; nisn: string };
    error?: string;
  }> {
    const res = await safeFetchJson<{
      success: boolean;
      user?: User;
      studentInfo?: { name: string; className: string; nisn: string };
      error?: string;
    }>('/api/auth/wali/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });

    if (res.ok && res.data?.success && res.data?.user) {
      return {
        success: true,
        user: res.data.user,
        studentInfo: res.data.studentInfo
      };
    }

    // Client fallback verification
    const performClientMatch = (studentsList: Student[]): Student | undefined => {
      const cleanInputPhone = (params.parentPhone || '').replace(/\D/g, '');
      return studentsList.find(s => {
        const nameMatches = isStudentNameMatch(s.name, params.studentName);
        if (!nameMatches) return false;

        // Match birth date
        if (params.birthDate) {
          if (isStudentBirthDateMatch(s.birthDate, params.birthDate)) {
            return true;
          }
        }

        // Match phone fallback
        if (cleanInputPhone && cleanInputPhone.length >= 4) {
          const sPhoneClean = (s.parentPhone || '').replace(/\D/g, '');
          if (sPhoneClean) {
            return sPhoneClean === cleanInputPhone ||
                   sPhoneClean.endsWith(cleanInputPhone) ||
                   cleanInputPhone.endsWith(sPhoneClean) ||
                   (cleanInputPhone.startsWith('0') && sPhoneClean === '62' + cleanInputPhone.slice(1)) ||
                   (cleanInputPhone.startsWith('62') && sPhoneClean === '0' + cleanInputPhone.slice(2));
          }
        }

        return false;
      });
    };

    let students = getLocalStudents();
    let matched = performClientMatch(students);

    // If not found in localStorage, check browser Supabase client directly
    if (!matched) {
      try {
        const supabase = getBrowserSupabaseClient();
        if (supabase) {
          const { data: supaStudents } = await supabase.from('students').select('*');
          if (supaStudents && supaStudents.length > 0) {
            const mappedSupa: Student[] = supaStudents.map((s: any) => decodeStudentFromSupabaseRow(s));
            matched = performClientMatch(mappedSupa);
            if (matched) {
              // Cache into local storage
              const currentLocal = getLocalStudents();
              if (!currentLocal.some(cs => cs.id === matched!.id)) {
                localStorage.setItem('app_master_students', JSON.stringify([...currentLocal, matched]));
              }
            }
          }
        }
      } catch (e) {
        console.warn('Browser Supabase fallback error in verifyWaliStudent:', e);
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
      return {
        success: true,
        user: waliUser,
        studentInfo: {
          name: matched.name,
          className: matched.className,
          nisn: matched.nisn
        }
      };
    }

    return {
      success: false,
      error: res.data?.error || 'Data tidak cocok. Pastikan Nama Lengkap Siswa dan Tanggal Lahir sesuai dengan data yang terdaftar di sekolah.'
    };
  },

  // Master Data
  async getMasterData(): Promise<{ classes: ClassRoom[]; teachers: Teacher[]; students: Student[] }> {
    // Automatically ensure client has active Supabase credentials from server
    syncSupabaseCredentialsWithServer().catch(() => {});

    // 1. Try Browser Supabase Client FIRST if configured and connected
    try {
      const sbConfig = getStoredSupabaseConfig();
      if (sbConfig.url && sbConfig.anonKey && sbConfig.status === 'connected') {
        const pullRes = await pullAllFromBrowser(sbConfig.url, sbConfig.anonKey);
        if (pullRes.success && pullRes.data && pullRes.data.students.length > 0) {
          const localStudents = getLocalStudents();
          // Merge with any fresh local updates to prevent race conditions
          const mergedStudents = pullRes.data.students.map(remoteStudent => {
            const local = localStudents.find(l => l.id === remoteStudent.id || l.nisn === remoteStudent.nisn);
            if (local && local.classId && (local.classId !== remoteStudent.classId || local.className !== remoteStudent.className)) {
              return {
                ...remoteStudent,
                classId: local.classId,
                className: local.className
              };
            }
            return remoteStudent;
          });

          const synced = syncClassesAndStudentsData(pullRes.data.classes, mergedStudents, pullRes.data.teachers);
          saveLocalClasses(synced.classes);
          saveLocalStudents(synced.students);
          saveLocalTeachers(synced.teachers);
          saveLocalAttendance(pullRes.data.attendance);
          return synced;
        }
      }
    } catch (err) {
      console.warn('Browser Supabase pull in getMasterData:', err);
    }

    // 2. Fetch from backend API
    const res = await safeFetchJson<{ classes: ClassRoom[]; teachers: Teacher[]; students: Student[] }>(`/api/master/data?t=${Date.now()}`);
    if (res.ok && res.data) {
      const localStudents = getLocalStudents();
      const serverStudents = res.data.students || [];
      const mergedStudents = serverStudents.map(serverStudent => {
        const local = localStudents.find(l => l.id === serverStudent.id || l.nisn === serverStudent.nisn);
        if (local && local.classId && (local.classId !== serverStudent.classId || local.className !== serverStudent.className)) {
          return {
            ...serverStudent,
            classId: local.classId,
            className: local.className
          };
        }
        return serverStudent;
      });

      const synced = syncClassesAndStudentsData(res.data.classes || [], mergedStudents, res.data.teachers || []);
      // Sync local storage cache for offline / fallback
      saveLocalClasses(synced.classes);
      saveLocalStudents(synced.students);
      saveLocalTeachers(synced.teachers);
      return synced;
    }

    const localSynced = syncClassesAndStudentsData(getLocalClasses(), getLocalStudents(), getLocalTeachers());
    saveLocalClasses(localSynced.classes);
    saveLocalStudents(localSynced.students);
    saveLocalTeachers(localSynced.teachers);
    return localSynced;
  },

  async addStudent(studentData: Partial<Student>): Promise<{ success: boolean; student?: Student; error?: string; message?: string }> {
    const normalizedData = {
      ...studentData,
      birthDate: studentData.birthDate ? (normalizeDateToYMD(studentData.birthDate) || String(studentData.birthDate).trim()) : undefined
    };

    const res = await safeFetchJson<{ student?: Student; message?: string }>('/api/master/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(normalizedData)
    });

    if (res.ok && res.data && res.data.student) {
      const students = getLocalStudents();
      const idx = students.findIndex(s => s.id === res.data!.student!.id || (res.data!.student!.nisn && s.nisn === res.data!.student!.nisn));
      if (idx !== -1) {
        students[idx] = res.data.student;
      } else {
        students.push(res.data.student);
      }
      saveLocalStudents(students);
      upsertStudentToBrowserSupabase(res.data.student);
      return { success: true, student: res.data.student, message: res.data.message };
    }

    const students = getLocalStudents();
    const newStudent: Student = {
      id: `std-${Date.now()}`,
      nisn: String(normalizedData.nisn || '').trim(),
      name: String(normalizedData.name || '').trim(),
      gender: normalizedData.gender || 'L',
      classId: normalizedData.classId || 'cls-1',
      className: normalizedData.className || 'X MIPA 1',
      birthDate: normalizedData.birthDate || undefined,
      address: normalizedData.address || undefined,
      academicYear: normalizedData.academicYear || '2024/2025',
      parentName: normalizedData.parentName || 'Wali Siswa',
      parentPhone: normalizedData.parentPhone || '-',
      photoUrl: normalizedData.photoUrl || '',
      defaultPassword: normalizedData.defaultPassword || '123'
    };
    students.push(newStudent);
    saveLocalStudents(students);
    upsertStudentToBrowserSupabase(newStudent);
    triggerAutoSupabaseSync();

    return { success: true, student: newStudent, message: 'Data siswa berhasil ditambahkan.' };
  },

  async updateStudent(id: string, studentData: Partial<Student>): Promise<{ success: boolean; student?: Student; error?: string; message?: string }> {
    const cleanBirthDate = studentData.birthDate !== undefined
      ? (studentData.birthDate ? (normalizeDateToYMD(studentData.birthDate) || String(studentData.birthDate).trim()) : '')
      : undefined;

    const normalizedData = {
      ...studentData,
      ...(cleanBirthDate !== undefined ? { birthDate: cleanBirthDate } : {})
    };

    // 1. Immediately update Local Storage with the user-selected class
    const students = getLocalStudents();
    const idx = students.findIndex(s => s.id === id || (normalizedData.nisn && s.nisn === String(normalizedData.nisn).trim()));
    const updatedStudent: Student = {
      ...(idx !== -1 ? students[idx] : {} as Student),
      ...normalizedData,
      id: id || (idx !== -1 ? students[idx].id : `std-${Date.now()}`),
      nisn: normalizedData.nisn ? String(normalizedData.nisn).trim() : (idx !== -1 ? students[idx].nisn : ''),
      name: normalizedData.name ? String(normalizedData.name).trim() : (idx !== -1 ? students[idx].name : ''),
      gender: (normalizedData.gender as any) || (idx !== -1 ? students[idx].gender : 'L'),
      classId: normalizedData.classId || (idx !== -1 ? students[idx].classId : ''),
      className: normalizedData.className || (idx !== -1 ? students[idx].className : ''),
      birthDate: cleanBirthDate !== undefined ? (cleanBirthDate || undefined) : (idx !== -1 ? students[idx].birthDate : undefined)
    };

    if (idx !== -1) {
      students[idx] = updatedStudent;
    } else {
      students.push(updatedStudent);
    }
    saveLocalStudents(students);

    // Update local classes studentCount
    const localClasses = getLocalClasses();
    const updatedLocalClasses = localClasses.map(c => ({
      ...c,
      studentCount: students.filter(s => s.classId === c.id || (c.name && s.className && s.className.trim().toLowerCase() === c.name.trim().toLowerCase())).length
    }));
    saveLocalClasses(updatedLocalClasses);

    // Update local attendance records for this student to reflect new class
    const localAtt = getLocalAttendance();
    const updatedAtt = localAtt.map(a => (a.nisn === updatedStudent.nisn || a.studentId === updatedStudent.id) ? { ...a, classId: updatedStudent.classId, className: updatedStudent.className } : a);
    saveLocalAttendance(updatedAtt);

    // 2. Direct sync to Supabase Cloud from browser (ensures persistent cloud DB is immediately updated)
    try {
      await upsertStudentToBrowserSupabase(updatedStudent);
    } catch (sbErr) {
      console.warn('Supabase browser sync notice in updateStudent:', sbErr);
    }

    // 3. Notify backend server API
    try {
      const res = await safeFetchJson<{ student?: Student; message?: string }>(`/api/master/students/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normalizedData)
      });
      if (res.ok && res.data?.student) {
        const serverStudent = res.data.student;
        const finalStudent: Student = {
          ...serverStudent,
          classId: updatedStudent.classId,
          className: updatedStudent.className
        };
        const curList = getLocalStudents();
        const curIdx = curList.findIndex(s => s.id === id || s.nisn === updatedStudent.nisn);
        if (curIdx !== -1) {
          curList[curIdx] = finalStudent;
          saveLocalStudents(curList);
        }
        return { success: true, student: finalStudent, message: res.data.message || 'Data siswa berhasil diperbarui!' };
      }
    } catch (apiErr) {
      console.warn('Backend API updateStudent notice:', apiErr);
    }

    triggerAutoSupabaseSync();
    return { success: true, student: updatedStudent, message: 'Data siswa berhasil diperbarui.' };
  },

  async deleteStudent(id: string): Promise<{ success: boolean; error?: string; message?: string }> {
    const res = await safeFetchJson<{ message?: string }>(`/api/master/students/${id}`, { method: 'DELETE' });
    if (res.ok && res.data) {
      // Clean local attendance for this student as well
      const localAttendance = getLocalAttendance();
      const cleaned = localAttendance.filter(a => a.studentId !== id);
      saveLocalAttendance(cleaned);

      deleteStudentFromBrowserSupabase(id);
      return { success: true, message: res.data.message };
    }

    if (res.error && !res.isHtml) {
      return { success: false, error: res.error };
    }

    let students = getLocalStudents();
    const targetStudent = students.find(s => s.id === id);
    students = students.filter(s => s.id !== id);
    saveLocalStudents(students);

    // Clean local attendance for this student
    const localAttendance = getLocalAttendance();
    const cleaned = localAttendance.filter(a => a.studentId !== id && a.nisn !== targetStudent?.nisn);
    saveLocalAttendance(cleaned);

    deleteStudentFromBrowserSupabase(id, targetStudent?.nisn);
    return { success: true, message: 'Data siswa berhasil dihapus.' };
  },

  async deleteStudents(ids: string[]): Promise<{ success: boolean; count?: number; error?: string; message?: string }> {
    if (!ids || ids.length === 0) {
      return { success: false, error: 'Pilih minimal satu siswa untuk dihapus.' };
    }

    const res = await safeFetchJson<{ count?: number; message?: string }>('/api/master/students/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    });

    const idSet = new Set(ids);

    if (res.ok && res.data) {
      let students = getLocalStudents();
      const deletedList = students.filter(s => idSet.has(s.id));
      students = students.filter(s => !idSet.has(s.id));
      saveLocalStudents(students);

      const targetNisns = new Set(deletedList.map(s => s.nisn));
      const localAttendance = getLocalAttendance();
      const cleaned = localAttendance.filter(a => !idSet.has(a.studentId) && !targetNisns.has(a.nisn));
      saveLocalAttendance(cleaned);

      deletedList.forEach(st => {
        deleteStudentFromBrowserSupabase(st.id, st.nisn);
      });

      return {
        success: true,
        count: res.data.count || deletedList.length,
        message: res.data.message || `Berhasil menghapus masal ${res.data.count || deletedList.length} data siswa.`
      };
    }

    if (res.error && !res.isHtml) {
      return { success: false, error: res.error };
    }

    let students = getLocalStudents();
    const deletedList = students.filter(s => idSet.has(s.id));
    students = students.filter(s => !idSet.has(s.id));
    saveLocalStudents(students);

    const targetNisns = new Set(deletedList.map(s => s.nisn));
    const localAttendance = getLocalAttendance();
    const cleaned = localAttendance.filter(a => !idSet.has(a.studentId) && !targetNisns.has(a.nisn));
    saveLocalAttendance(cleaned);

    deletedList.forEach(st => {
      deleteStudentFromBrowserSupabase(st.id, st.nisn);
    });

    return {
      success: true,
      count: deletedList.length,
      message: `Berhasil menghapus masal ${deletedList.length} data siswa secara lokal.`
    };
  },

  async uploadStudentPhoto(base64Data: string, nisn: string): Promise<{ success: boolean; photoUrl?: string; isSupabase?: boolean; error?: string; message?: string }> {
    const res = await safeFetchJson<{ photoUrl?: string; isSupabase?: boolean; message?: string }>('/api/upload/student-photo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Data, nisn })
    });
    if (res.ok && res.data) {
      return { success: true, photoUrl: res.data.photoUrl, isSupabase: res.data.isSupabase, message: res.data.message };
    }

    // Client fallback: Return base64 data directly as photo URL
    return { success: true, photoUrl: base64Data, isSupabase: false, message: 'Foto disimpan secara lokal.' };
  },

  async addTeacher(teacherData: Partial<Teacher>): Promise<{ success: boolean; teacher?: Teacher; error?: string; message?: string }> {
    const res = await safeFetchJson<{ teacher?: Teacher; message?: string }>('/api/master/teachers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(teacherData)
    });
    if (res.ok && res.data) {
      return { success: true, teacher: res.data.teacher, message: res.data.message };
    }

    const teachers = getLocalTeachers();
    const newTeacher: Teacher = {
      id: `tch-${Date.now()}`,
      nip: (teacherData.nip || '').trim(),
      name: (teacherData.name || '').trim(),
      gender: teacherData.gender || 'L',
      username: (teacherData.username || 'guru').trim().toLowerCase(),
      password: teacherData.password ? teacherData.password.trim() : undefined,
      subject: teacherData.subject || 'Mata Pelajaran',
      assignedClassId: teacherData.assignedClassId,
      assignedClassName: teacherData.assignedClassName,
      role: teacherData.role || 'guru'
    };
    teachers.push(newTeacher);
    saveLocalTeachers(teachers);
    await upsertTeacherToBrowserSupabase(newTeacher);
    triggerAutoSupabaseSync();

    return { success: true, teacher: newTeacher, message: 'Data guru berhasil ditambahkan.' };
  },

  async updateTeacher(id: string, teacherData: Partial<Teacher>): Promise<{ success: boolean; teacher?: Teacher; error?: string; message?: string }> {
    const res = await safeFetchJson<{ teacher?: Teacher; message?: string }>(`/api/master/teachers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(teacherData)
    });
    if (res.ok && res.data) {
      return { success: true, teacher: res.data.teacher, message: res.data.message };
    }

    const teachers = getLocalTeachers();
    const idx = teachers.findIndex(t => t.id === id);
    if (idx !== -1) {
      teachers[idx] = { ...teachers[idx], ...teacherData };
      saveLocalTeachers(teachers);
      await upsertTeacherToBrowserSupabase(teachers[idx]);
      triggerAutoSupabaseSync();
      return { success: true, teacher: teachers[idx], message: 'Data guru berhasil diperbarui.' };
    }
    return { success: false, error: 'Data guru tidak ditemukan.' };
  },

  async deleteTeacher(id: string): Promise<{ success: boolean; error?: string; message?: string }> {
    const res = await safeFetchJson<{ message?: string }>(`/api/master/teachers/${id}`, { method: 'DELETE' });
    if (res.ok && res.data) {
      deleteTeacherFromBrowserSupabase(id);
      return { success: true, message: res.data.message };
    }

    if (res.error && !res.isHtml) {
      return { success: false, error: res.error };
    }

    let teachers = getLocalTeachers();
    const targetTeacher = teachers.find(t => t.id === id);
    teachers = teachers.filter(t => t.id !== id);
    saveLocalTeachers(teachers);

    // Unassign teacher from any assigned class
    const classes = getLocalClasses();
    let classUpdated = false;
    classes.forEach(c => {
      if (c.teacherId === id) {
        c.teacherId = undefined;
        c.teacherName = undefined;
        classUpdated = true;
      }
    });
    if (classUpdated) saveLocalClasses(classes);

    deleteTeacherFromBrowserSupabase(id, targetTeacher?.nip);
    return { success: true, message: 'Data guru berhasil dihapus.' };
  },

  async addClass(classData: Partial<ClassRoom>): Promise<{ success: boolean; class?: ClassRoom; error?: string; message?: string }> {
    const res = await safeFetchJson<{ class?: ClassRoom; message?: string }>('/api/master/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(classData)
    });
    if (res.ok && res.data) {
      return { success: true, class: res.data.class, message: res.data.message };
    }

    const classes = getLocalClasses();
    const newClass: ClassRoom = {
      id: `cls-${Date.now()}`,
      name: classData.name || '',
      gradeLevel: classData.gradeLevel || 'X',
      teacherId: classData.teacherId,
      teacherName: classData.teacherName,
      studentCount: 0
    };
    classes.push(newClass);
    saveLocalClasses(classes);
    triggerAutoSupabaseSync();

    return { success: true, class: newClass, message: 'Data kelas berhasil ditambahkan.' };
  },

  async updateClass(id: string, classData: Partial<ClassRoom>): Promise<{ success: boolean; class?: ClassRoom; error?: string; message?: string }> {
    const res = await safeFetchJson<{ class?: ClassRoom; message?: string }>(`/api/master/classes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(classData)
    });
    if (res.ok && res.data) {
      return { success: true, class: res.data.class, message: res.data.message };
    }

    const classes = getLocalClasses();
    const idx = classes.findIndex(c => c.id === id);
    if (idx !== -1) {
      classes[idx] = { ...classes[idx], ...classData };
      saveLocalClasses(classes);
      triggerAutoSupabaseSync();
      return { success: true, class: classes[idx], message: 'Data kelas berhasil diperbarui.' };
    }
    return { success: false, error: 'Data kelas tidak ditemukan.' };
  },

  async deleteClass(id: string): Promise<{ success: boolean; error?: string; message?: string }> {
    const res = await safeFetchJson<{ message?: string }>(`/api/master/classes/${id}`, { method: 'DELETE' });
    if (res.ok && res.data) {
      deleteClassFromBrowserSupabase(id);
      return { success: true, message: res.data.message };
    }

    if (res.error && !res.isHtml) {
      return { success: false, error: res.error };
    }

    const classes = getLocalClasses();
    const cls = classes.find(c => c.id === id);
    if (!cls) return { success: false, error: 'Kelas tidak ditemukan.' };

    const students = getLocalStudents();
    const studentCount = students.filter(s => s.classId === id).length;
    if (studentCount > 0) {
      return {
        success: false,
        error: `Kelas "${cls.name}" tidak dapat dihapus karena masih terdapat ${studentCount} siswa! Pindahkan atau hapus siswa di kelas ini terlebih dahulu.`
      };
    }

    const updatedClasses = classes.filter(c => c.id !== id);
    saveLocalClasses(updatedClasses);

    // Unassign teacher if assigned to this class
    const teachers = getLocalTeachers();
    let teacherUpdated = false;
    teachers.forEach(t => {
      if (t.assignedClassId === id) {
        t.assignedClassId = undefined;
        t.assignedClassName = undefined;
        teacherUpdated = true;
      }
    });
    if (teacherUpdated) saveLocalTeachers(teachers);

    deleteClassFromBrowserSupabase(id);
    return { success: true, message: 'Data kelas berhasil dihapus.' };
  },

  // BK Counseling Notes
  async getBKNotes(params?: { studentId?: string; search?: string; statusResiko?: string }): Promise<{ success: boolean; notes?: BKNote[]; error?: string }> {
    const query = new URLSearchParams();
    if (params?.studentId) query.append('studentId', params.studentId);
    if (params?.search) query.append('search', params.search);
    if (params?.statusResiko) query.append('statusResiko', params.statusResiko);

    const res = await safeFetchJson<{ notes?: BKNote[] }>(`/api/bk/notes?${query.toString()}`);
    if (res.ok && res.data?.notes) {
      return { success: true, notes: res.data.notes };
    }

    let notes = getLocalBKNotes();
    if (params?.studentId) notes = notes.filter(n => n.studentId === params.studentId);
    if (params?.statusResiko) notes = notes.filter(n => n.statusResiko === params.statusResiko);
    if (params?.search) {
      const q = params.search.toLowerCase();
      notes = notes.filter(n => n.studentName.toLowerCase().includes(q) || n.nisn.includes(q) || n.note.toLowerCase().includes(q));
    }
    return { success: true, notes };
  },

  async addBKNote(noteData: Partial<BKNote>): Promise<{ success: boolean; note?: BKNote; message?: string; error?: string }> {
    const res = await safeFetchJson<{ note?: BKNote; message?: string }>('/api/bk/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(noteData)
    });
    if (res.ok && res.data) {
      return { success: true, note: res.data.note, message: res.data.message };
    }

    const notes = getLocalBKNotes();
    const newNote: BKNote = {
      id: `bk-${Date.now()}`,
      studentId: noteData.studentId || '',
      studentName: noteData.studentName || '',
      nisn: noteData.nisn || '',
      className: noteData.className || '',
      date: noteData.date || new Date().toISOString().split('T')[0],
      time: noteData.time || new Date().toTimeString().split(' ')[0],
      counselorName: noteData.counselorName || 'Guru BK',
      category: noteData.category || 'Konseling Individual',
      statusResiko: noteData.statusResiko || 'Rendah',
      note: noteData.note || '',
      actionTaken: noteData.actionTaken || '',
      spLevel: noteData.spLevel || 'Tanpa SP',
      followUpDate: noteData.followUpDate
    };
    notes.unshift(newNote);
    saveLocalBKNotes(notes);

    return { success: true, note: newNote, message: 'Catatan BK berhasil ditambahkan.' };
  },

  async updateBKNote(id: string, noteData: Partial<BKNote>): Promise<{ success: boolean; note?: BKNote; message?: string; error?: string }> {
    const res = await safeFetchJson<{ note?: BKNote; message?: string }>(`/api/bk/notes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(noteData)
    });
    if (res.ok && res.data) {
      return { success: true, note: res.data.note, message: res.data.message };
    }

    const notes = getLocalBKNotes();
    const idx = notes.findIndex(n => n.id === id);
    if (idx !== -1) {
      notes[idx] = { ...notes[idx], ...noteData };
      saveLocalBKNotes(notes);
      return { success: true, note: notes[idx], message: 'Catatan BK berhasil diperbarui.' };
    }
    return { success: false, error: 'Catatan BK tidak ditemukan.' };
  },

  async deleteBKNote(id: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const res = await safeFetchJson<{ message?: string }>(`/api/bk/notes/${id}`, { method: 'DELETE' });
    if (res.ok && res.data) {
      return { success: true, message: res.data.message };
    }

    let notes = getLocalBKNotes();
    notes = notes.filter(n => n.id !== id);
    saveLocalBKNotes(notes);
    return { success: true, message: 'Catatan BK berhasil dihapus.' };
  },

  // Attendance Scanning
  async scanBarcode(nisn: string, status: AttendanceStatus = 'Hadir', notes: string = '', recordedBy: string = 'Scan QR Code', recordedByRole: string = 'admin'): Promise<{ success: boolean; record?: AttendanceRecord; student?: Student; error?: string; message?: string }> {
    const cleanNisn = String(nisn).trim();
    const res = await safeFetchJson<{ record?: AttendanceRecord; student?: Student; message?: string }>('/api/attendance/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nisn: cleanNisn, status, notes, recordedBy, recordedByRole })
    });
    if (res.ok && res.data) {
      if (res.data.record) {
        try {
          const currentLocal = getLocalAttendance();
          const existingIdx = currentLocal.findIndex(r => (r.nisn || '').trim() === cleanNisn && (r.date === res.data!.record!.date || isTodayRecord(r.date)));
          if (existingIdx !== -1) {
            currentLocal[existingIdx] = res.data.record;
          } else {
            currentLocal.unshift(res.data.record);
          }
          saveLocalAttendance(currentLocal);

          // Direct browser Supabase sync to guarantee durability across environments
          await upsertAttendanceToBrowserSupabase(res.data.record);
        } catch (sbErr) {
          console.warn('Notice syncing scan to Supabase browser client:', sbErr);
        }
      }
      return { success: true, record: res.data.record, student: res.data.student, message: res.data.message };
    }

    // Client mode attendance scanning
    const students = getLocalStudents();
    const student = students.find(s => (s.nisn || '').trim() === cleanNisn);
    if (!student) {
      return { success: false, error: `Siswa dengan NISN ${nisn} tidak ditemukan dalam database.` };
    }

    const dateStr = getTodayWibDate();
    let timeStr = '07:00:00';
    try {
      timeStr = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date()).replace(/\./g, ':');
    } catch {
      timeStr = new Date().toTimeString().split(' ')[0];
    }

    const records = getLocalAttendance();
    const existingIndex = records.findIndex(r => (r.nisn || '').trim() === cleanNisn && (r.date === dateStr || isTodayRecord(r.date)));

    let record: AttendanceRecord;
    if (existingIndex !== -1) {
      record = {
        ...records[existingIndex],
        status,
        time: timeStr,
        notes: notes || records[existingIndex].notes,
        recordedBy,
        recordedByRole
      };
      records[existingIndex] = record;
    } else {
      record = {
        id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        studentId: student.id,
        nisn: student.nisn,
        studentName: student.name,
        classId: student.classId,
        className: student.className,
        date: dateStr,
        time: timeStr,
        status,
        notes,
        recordedBy,
        recordedByRole
      };
      records.unshift(record);
    }

    saveLocalAttendance(records);
    try {
      await upsertAttendanceToBrowserSupabase(record);
    } catch {}
    triggerAutoSupabaseSync();

    return {
      success: true,
      record,
      student,
      message: `Presensi ${student.name} (${student.className}) berhasil dicatat: ${status}`
    };
  },

  // Attendance list query
  async getAttendance(params: { classId?: string; startDate?: string; endDate?: string; nisn?: string; status?: string; search?: string }): Promise<{ records: AttendanceRecord[]; total: number }> {
    const query = new URLSearchParams();
    if (params.classId) query.append('classId', params.classId);
    if (params.startDate) query.append('startDate', params.startDate);
    if (params.endDate) query.append('endDate', params.endDate);
    if (params.nisn) query.append('nisn', params.nisn);
    if (params.status) query.append('status', params.status);
    if (params.search) query.append('search', params.search);

    query.append('_t', String(Date.now()));
    const res = await safeFetchJson<{ records: AttendanceRecord[]; total: number }>(`/api/attendance?${query.toString()}`, {
      headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
    });
    if (res.ok && res.data) {
      try {
        const serverRecords = res.data.records || [];
        const localRecords = getLocalAttendance();

        // Merge records so locally scanned records or recent attendances are preserved
        const mergedMap = new Map<string, AttendanceRecord>();
        serverRecords.forEach(r => mergedMap.set(`${r.date}_${String(r.nisn).trim()}`, r));
        localRecords.forEach(r => {
          const key = `${r.date}_${String(r.nisn).trim()}`;
          if (!mergedMap.has(key)) {
            mergedMap.set(key, r);
          }
        });

        const combined = Array.from(mergedMap.values());
        combined.sort((a, b) => {
          if (b.date !== a.date) return b.date.localeCompare(a.date);
          return (b.time || '').localeCompare(a.time || '');
        });

        if (!params.classId && !params.startDate && !params.endDate && !params.nisn && !params.status && !params.search) {
          saveLocalAttendance(combined);
        }
        return { records: combined, total: combined.length };
      } catch {}
      return res.data;
    }

    // Fallback: If server endpoint is unreachable, pull directly from browser Supabase if configured
    if (isBrowserSupabaseConfigured()) {
      try {
        const sbClient = getBrowserSupabaseClient();
        if (sbClient) {
          const { data: sbAtt } = await sbClient
            .from('attendance')
            .select('*')
            .order('date', { ascending: false })
            .limit(2000);

          if (sbAtt && sbAtt.length > 0) {
            const mapped: AttendanceRecord[] = sbAtt.map((r: any) => ({
              id: r.id,
              studentId: r.student_id || '',
              nisn: String(r.nisn || '').trim(),
              studentName: String(r.student_name || '').trim(),
              classId: r.class_id || '',
              className: r.class_name || '',
              date: r.date,
              time: r.time || '-',
              status: r.status,
              notes: r.notes || '',
              recordedBy: r.recorded_by || 'System',
              recordedByRole: r.recorded_by_role || 'guru',
              checkOutTime: r.check_out_time || '-',
              checkOutStatus: r.check_out_status || '-',
              checkOutBy: r.check_out_by || '-'
            }));
            saveLocalAttendance(mapped);
            return { records: mapped, total: mapped.length };
          }
        }
      } catch (sbErr) {
        console.warn('Error pulling attendance directly from browser Supabase:', sbErr);
      }
    }

    let records = getLocalAttendance();
    if (params.classId) records = records.filter(r => r.classId === params.classId);
    if (params.nisn) records = records.filter(r => (r.nisn || '').trim() === params.nisn?.trim());
    if (params.status) records = records.filter(r => r.status === params.status);
    if (params.startDate) records = records.filter(r => r.date >= params.startDate!);
    if (params.endDate) records = records.filter(r => r.date <= params.endDate!);
    if (params.search) {
      const q = params.search.toLowerCase();
      records = records.filter(r => (r.studentName || '').toLowerCase().includes(q) || (r.nisn || '').includes(q) || (r.className || '').toLowerCase().includes(q));
    }

    return { records, total: records.length };
  },

  // Bulk manual attendance update
  async saveBulkAttendance(recordsInput: { nisn: string; status: AttendanceStatus; notes?: string }[], date?: string, recordedBy?: string, recordedByRole?: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const res = await safeFetchJson<{ message?: string }>('/api/attendance/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: recordsInput, date, recordedBy, recordedByRole })
    });

    const dateStr = date || getTodayWibDate();
    let timeStr = '07:00:00';
    try {
      timeStr = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date()).replace(/\./g, ':');
    } catch {
      timeStr = new Date().toTimeString().split(' ')[0];
    }
    const students = getLocalStudents();
    const currentRecords = getLocalAttendance();
    const syncedRecords: AttendanceRecord[] = [];

    for (const item of recordsInput) {
      const cleanItemNisn = String(item.nisn).trim();
      const std = students.find(s => (s.nisn || '').trim() === cleanItemNisn);

      const idx = currentRecords.findIndex(r => (r.nisn || '').trim() === cleanItemNisn && (r.date === dateStr || isTodayRecord(r.date)));
      if (idx !== -1) {
        currentRecords[idx].status = item.status;
        currentRecords[idx].notes = item.notes !== undefined ? item.notes : currentRecords[idx].notes;
        currentRecords[idx].recordedBy = recordedBy || currentRecords[idx].recordedBy;
        currentRecords[idx].recordedByRole = recordedByRole || currentRecords[idx].recordedByRole;
        syncedRecords.push(currentRecords[idx]);
      } else if (std) {
        const newRec: AttendanceRecord = {
          id: `att-${dateStr}-${std.nisn}`,
          studentId: std.id,
          nisn: std.nisn,
          studentName: std.name,
          classId: std.classId,
          className: std.className,
          date: dateStr,
          time: item.status === 'Hadir' ? timeStr : '-',
          status: item.status,
          notes: item.notes || '',
          recordedBy: recordedBy || 'Guru Kelas',
          recordedByRole: recordedByRole || 'guru'
        };
        currentRecords.unshift(newRec);
        syncedRecords.push(newRec);
      }
    }

    saveLocalAttendance(currentRecords);
    try {
      await upsertAttendanceToBrowserSupabase(syncedRecords);
    } catch (sbErr) {
      console.warn('Notice upserting manual attendance to Supabase browser client:', sbErr);
    }
    triggerAutoSupabaseSync();

    if (res.ok && res.data) {
      return { success: true, message: res.data.message };
    }

    return { success: true, message: `Berhasil menyimpan presensi manual untuk ${recordsInput.length} siswa.` };
  },

  // Bulk dismissal / checkout attendance update
  async saveCheckoutAttendance(classId: string, studentsInput: { nisn: string; checkedOut: boolean; notes?: string }[], recordedBy: string, date?: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const res = await safeFetchJson<{ message?: string }>('/api/attendance/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classId, students: studentsInput, recordedBy, date })
    });
    if (res.ok && res.data) {
      return { success: true, message: res.data.message };
    }

    const dateStr = date || getTodayWibDate();
    const timeStr = new Date().toTimeString().split(' ')[0];
    const currentRecords = getLocalAttendance();

    for (const item of studentsInput) {
      const idx = currentRecords.findIndex(r => r.nisn === item.nisn && (r.date === dateStr || isTodayRecord(r.date)));
      if (idx !== -1) {
        currentRecords[idx].checkOutTime = timeStr;
        currentRecords[idx].checkOutStatus = item.checkedOut ? 'Pulang' : 'Bolos / Pulang Awal';
        currentRecords[idx].checkOutBy = recordedBy;
        if (item.notes) currentRecords[idx].notes = item.notes;
      }
    }

    saveLocalAttendance(currentRecords);
    triggerAutoSupabaseSync();

    return { success: true, message: `Berhasil mencatat kepulangan siswa kelas ${classId}.` };
  },

  // Import batch students
  async importStudents(studentsInput: any[]): Promise<{ success: boolean; message?: string; error?: string }> {
    const res = await safeFetchJson<{ message?: string; students?: Student[]; classes?: ClassRoom[] }>('/api/import/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ students: studentsInput })
    });

    if (res.ok && res.data) {
      if (Array.isArray(res.data.students) && res.data.students.length > 0) {
        saveLocalStudents(res.data.students);
      }
      if (Array.isArray(res.data.classes) && res.data.classes.length > 0) {
        saveLocalClasses(res.data.classes);
      }
      // Also ensure browser Supabase is synced before returning
      await triggerAutoSupabaseSync();
      return { success: true, message: res.data.message };
    }

    const existingStudents = getLocalStudents();
    const existingClasses = getLocalClasses();
    const existingTeachers = getLocalTeachers();
    const batchTs = Date.now().toString().slice(-5);

    for (let sIdx = 0; sIdx < studentsInput.length; sIdx++) {
      const s = studentsInput[sIdx];
      const cleanName = String(s.name || '').trim();
      if (!cleanName) continue;

      let cleanNisn = String(s.nisn || '').replace(/^['`]+/, '').trim();
      if (!cleanNisn || cleanNisn === '-' || cleanNisn === '0') {
        cleanNisn = `NIS${batchTs}${String(sIdx + 1).padStart(3, '0')}`;
      }

      const idx = existingStudents.findIndex(
        e => (cleanNisn && e.nisn === cleanNisn) || (s.id && e.id === s.id)
      );
      if (idx !== -1) {
        existingStudents[idx] = {
          ...existingStudents[idx],
          ...s,
          nisn: cleanNisn,
          name: cleanName,
          birthDate: s.birthDate !== undefined ? s.birthDate : existingStudents[idx].birthDate,
          address: s.address !== undefined ? s.address : existingStudents[idx].address,
          academicYear: s.academicYear || existingStudents[idx].academicYear || '2024/2025'
        };
      } else {
        existingStudents.push({
          id: s.id || `std-${Date.now()}-${sIdx}-${Math.random().toString(36).substring(2, 7)}`,
          nisn: cleanNisn,
          name: cleanName,
          gender: s.gender || 'L',
          classId: s.classId || '',
          className: s.className || '',
          birthDate: s.birthDate || undefined,
          address: s.address || undefined,
          academicYear: s.academicYear || '2024/2025',
          parentName: s.parentName || 'Wali Murid',
          parentPhone: s.parentPhone || '-',
          defaultPassword: s.defaultPassword || '123'
        });
      }
    }

    // Bidirectionally sync classes and auto-create missing class if needed
    const synced = syncClassesAndStudentsData(existingClasses, existingStudents, existingTeachers);
    saveLocalClasses(synced.classes);
    saveLocalStudents(synced.students);
    saveLocalTeachers(synced.teachers);

    await triggerAutoSupabaseSync();

    return { success: true, message: `Berhasil mengimpor ${studentsInput.length} data siswa.` };
  },

  // Import batch teachers
  async importTeachers(teachersInput: any[]): Promise<{ success: boolean; message?: string; error?: string }> {
    const res = await safeFetchJson<{ message?: string; teachers?: Teacher[] }>('/api/import/teachers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teachers: teachersInput })
    });
    if (res.ok && res.data) {
      if (Array.isArray(res.data.teachers) && res.data.teachers.length > 0) {
        saveLocalTeachers(res.data.teachers);
      }
      await triggerAutoSupabaseSync();
      return { success: true, message: res.data.message };
    }

    const existingTeachers = getLocalTeachers();
    for (const t of teachersInput) {
      const idx = existingTeachers.findIndex(e => e.nip === t.nip || e.id === t.id);
      if (idx !== -1) {
        existingTeachers[idx] = { ...existingTeachers[idx], ...t };
      } else {
        existingTeachers.push({
          id: t.id || `tch-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          nip: t.nip,
          name: t.name,
          gender: t.gender || 'L',
          username: t.username || 'guru',
          subject: t.subject,
          assignedClassId: t.assignedClassId,
          assignedClassName: t.assignedClassName,
          role: t.role || 'guru'
        });
      }
    }

    saveLocalTeachers(existingTeachers);
    await triggerAutoSupabaseSync();

    return { success: true, message: `Berhasil mengimpor ${teachersInput.length} data guru.` };
  },

  // Reset database
  async resetData(): Promise<{ success: boolean; message?: string }> {
    const res = await safeFetchJson<{ message?: string }>('/api/reset-data', { method: 'POST' });
    if (res.ok && res.data) {
      return { success: true, message: res.data.message };
    }

    localStorage.removeItem('app_master_classes');
    localStorage.removeItem('app_master_teachers');
    localStorage.removeItem('app_master_students');
    localStorage.removeItem('app_attendance_records');
    localStorage.removeItem('app_bk_notes');
    return { success: true, message: 'Data lokal berhasil direset ke kondisi awal.' };
  },

  // Google Sheets Integration
  async getSheetsStatus(): Promise<{ spreadsheetId: string | null; spreadsheetUrl: string | null; lastSyncTime: string | null; autoSync: boolean }> {
    const res = await safeFetchJson<{ spreadsheetId?: string; spreadsheetUrl?: string; lastSyncTime?: string; autoSync?: boolean }>('/api/sheets/status');
    if (res.ok && res.data) {
      return {
        spreadsheetId: res.data.spreadsheetId || null,
        spreadsheetUrl: res.data.spreadsheetUrl || null,
        lastSyncTime: res.data.lastSyncTime || null,
        autoSync: res.data.autoSync ?? true
      };
    }
    return { spreadsheetId: null, spreadsheetUrl: null, lastSyncTime: null, autoSync: true };
  },

  async initGoogleSheets(accessToken: string, spreadsheetId?: string): Promise<{ success: boolean; spreadsheetId?: string; spreadsheetUrl?: string; message?: string; error?: string }> {
    const res = await safeFetchJson<{ spreadsheetId?: string; spreadsheetUrl?: string; message?: string }>('/api/sheets/init', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ accessToken, spreadsheetId })
    });
    if (res.ok && res.data) {
      return { success: true, spreadsheetId: res.data.spreadsheetId, spreadsheetUrl: res.data.spreadsheetUrl, message: res.data.message };
    }
    return { success: false, error: res.error || 'Server backend tidak merespons koneksi Google Sheets.' };
  },

  async syncToGoogleSheets(accessToken: string, spreadsheetId?: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const res = await safeFetchJson<{ message?: string }>('/api/sheets/sync-to-sheet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ accessToken, spreadsheetId })
    });
    if (res.ok && res.data) {
      return { success: true, message: res.data.message };
    }
    return { success: false, error: res.error || 'Gagal mengekspor data ke Google Sheets.' };
  },

  async syncFromGoogleSheets(accessToken: string, spreadsheetId?: string): Promise<{ success: boolean; counts?: any; message?: string; error?: string }> {
    const res = await safeFetchJson<{ counts?: any; message?: string }>('/api/sheets/sync-from-sheet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ accessToken, spreadsheetId })
    });
    if (res.ok && res.data) {
      return { success: true, counts: res.data.counts, message: res.data.message };
    }
    return { success: false, error: res.error || 'Gagal mengimpor data dari Google Sheets.' };
  },

  // KBM Journal & Teaching Report Services
  async getKBMJournals(filters?: { classId?: string; subjectName?: string; month?: string; year?: string }): Promise<{ success: boolean; data: KBMJournalEntry[] }> {
    let journals = getLocalKBMJournals();
    if (filters) {
      if (filters.classId && filters.classId !== 'all') {
        journals = journals.filter(j => j.classId === filters.classId || j.className === filters.classId);
      }
      if (filters.subjectName && filters.subjectName !== 'all') {
        journals = journals.filter(j => j.subjectName.toLowerCase() === filters.subjectName!.toLowerCase());
      }
      if (filters.month && filters.year) {
        const monthPad = filters.month.padStart(2, '0');
        const prefix = `${filters.year}-${monthPad}`;
        journals = journals.filter(j => j.date.startsWith(prefix));
      }
    }
    // Sort descending by date
    journals.sort((a, b) => b.date.localeCompare(a.date));
    return { success: true, data: journals };
  },

  async saveKBMJournal(entry: KBMJournalEntry): Promise<{ success: boolean; entry?: KBMJournalEntry; error?: string }> {
    try {
      const journals = getLocalKBMJournals();
      const existingIdx = journals.findIndex(
        j => (j.id && j.id === entry.id) || (j.date === entry.date && j.classId === entry.classId && j.subjectName === entry.subjectName)
      );

      const entryToSave: KBMJournalEntry = {
        ...entry,
        id: entry.id || `kbm-jrn-${Date.now()}`,
        createdAt: entry.createdAt || new Date().toISOString()
      };

      if (existingIdx >= 0) {
        journals[existingIdx] = entryToSave;
      } else {
        journals.unshift(entryToSave);
      }

      saveLocalKBMJournals(journals);
      return { success: true, entry: entryToSave };
    } catch (err: any) {
      return { success: false, error: err.message || 'Gagal menyimpan Jurnal KBM' };
    }
  },

  async deleteKBMJournal(id: string): Promise<{ success: boolean }> {
    const journals = getLocalKBMJournals();
    const filtered = journals.filter(j => j.id !== id);
    saveLocalKBMJournals(filtered);
    return { success: true };
  }
};
