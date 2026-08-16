import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { ClassRoom, Teacher, Student, AttendanceRecord, SchoolSettings, BKNote } from '../types';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  autoSync: boolean;
  lastSyncTime?: string;
  status: 'connected' | 'disconnected' | 'unconfigured' | 'error';
  errorMessage?: string;
}

const CONFIG_PATH = path.join(process.cwd(), 'data', 'supabase-config.json');
const LOCAL_DB_PATH = path.join(process.cwd(), 'data', 'local-db.json');

// Default config
let currentSupabaseConfig: SupabaseConfig = {
  url: process.env.SUPABASE_URL || 'https://zxnkiqupojwydazkurfv.supabase.co',
  anonKey: process.env.SUPABASE_ANON_KEY || 'sb_publishable_PvMiB0Or-lpYWjVSaa0FeQ_a33a0ISz',
  autoSync: true,
  status: 'connected'
};

// Ensure data folder exists
const ensureDataDir = () => {
  const dir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Load saved config
export function loadSupabaseConfig(): SupabaseConfig {
  try {
    ensureDataDir();
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
      const parsed = JSON.parse(data);
      currentSupabaseConfig = { ...currentSupabaseConfig, ...parsed };
    }
  } catch (err) {
    console.error('Error loading Supabase config file:', err);
  }
  return currentSupabaseConfig;
}

// Save config
export function saveSupabaseConfig(config: Partial<SupabaseConfig>): SupabaseConfig {
  ensureDataDir();
  currentSupabaseConfig = { ...currentSupabaseConfig, ...config };
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(currentSupabaseConfig, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving Supabase config file:', err);
  }
  return currentSupabaseConfig;
}

// Save Local DB backup
export function saveLocalDBBackup(data: {
  classes: ClassRoom[];
  teachers: Teacher[];
  students: Student[];
  attendance: AttendanceRecord[];
  bkNotes?: BKNote[];
  settings?: SchoolSettings;
}) {
  try {
    ensureDataDir();
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving local db backup:', err);
  }
}

// Read Local DB backup
export function readLocalDBBackup(): {
  classes?: ClassRoom[];
  teachers?: Teacher[];
  students?: Student[];
  attendance?: AttendanceRecord[];
  bkNotes?: BKNote[];
  settings?: SchoolSettings;
} | null {
  try {
    ensureDataDir();
    if (fs.existsSync(LOCAL_DB_PATH)) {
      const content = fs.readFileSync(LOCAL_DB_PATH, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error('Error reading local db backup:', err);
  }
  return null;
}

// Get Supabase Client instance
export function getSupabaseClient(): SupabaseClient | null {
  const cfg = loadSupabaseConfig();
  if (!cfg.url || !cfg.anonKey) {
    return null;
  }
  try {
    return createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: false }
    });
  } catch (err) {
    console.error('Failed to create Supabase client:', err);
    return null;
  }
}

// Check Supabase connection health
export async function testSupabaseConnection(): Promise<{ success: boolean; message: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    saveSupabaseConfig({ status: 'unconfigured', errorMessage: 'Supabase URL atau Anon Key belum dikonfigurasi.' });
    return { success: false, message: 'Supabase URL atau Anon Key belum diatur.' };
  }

  try {
    // Ping students table or check health
    const { data, error } = await supabase.from('students').select('id').limit(1);
    if (error) {
      // If table missing or invalid credentials
      if (error.code === 'PGRST301' || error.message.includes('JWT') || error.message.includes('apiKey')) {
        saveSupabaseConfig({ status: 'error', errorMessage: `Autentikasi Supabase Gagal: ${error.message}` });
        return { success: false, message: `Kredensial Supabase tidak valid: ${error.message}` };
      }
      // If table doesn't exist yet, but connection was made
      if (error.code === '42P01') {
        saveSupabaseConfig({ status: 'connected', errorMessage: 'Tabel Supabase belum dibuat. Jalankan SQL setup script.' });
        return { success: true, message: 'Koneksi ke Supabase berhasil! (Tabel belum dibuat, klik Pembuat Tabel SQL).' };
      }
    }
    
    saveSupabaseConfig({ status: 'connected', errorMessage: undefined });
    return { success: true, message: 'Koneksi ke Supabase Database berhasil & aktif!' };
  } catch (err: any) {
    const msg = err.message || 'Gagal terhubung ke Supabase server.';
    saveSupabaseConfig({ status: 'error', errorMessage: msg });
    return { success: false, message: msg };
  }
}

// SQL Schema Generator for Supabase SQL Editor
export const SUPABASE_SQL_SCHEMA = `-- SQL Schema Setup for SMA Islam Ra'iyatul Husnan Attendance System

-- 1. Table: classes
CREATE TABLE IF NOT EXISTS classes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  grade_level TEXT,
  teacher_id TEXT,
  teacher_name TEXT,
  student_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Table: teachers
CREATE TABLE IF NOT EXISTS teachers (
  id TEXT PRIMARY KEY,
  nip TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  gender TEXT DEFAULT 'L',
  username TEXT NOT NULL,
  password TEXT,
  subject TEXT,
  role TEXT DEFAULT 'guru',
  assigned_class_id TEXT,
  assigned_class_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Table: students
CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  nisn TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  gender TEXT DEFAULT 'L',
  class_id TEXT NOT NULL,
  class_name TEXT NOT NULL,
  parent_name TEXT,
  parent_phone TEXT,
  photo_url TEXT,
  default_password TEXT DEFAULT '123',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure missing columns exist for existing tables
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'guru';
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS password TEXT;

ALTER TABLE students ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS default_password TEXT DEFAULT '123';
ALTER TABLE students ADD COLUMN IF NOT EXISTS parent_name TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS parent_phone TEXT;

ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_out_time TEXT;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_out_status TEXT;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_out_by TEXT;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS recorded_by_role TEXT;

-- 4. Table: attendance
CREATE TABLE IF NOT EXISTS attendance (
  id TEXT PRIMARY KEY,
  student_id TEXT,
  nisn TEXT NOT NULL,
  student_name TEXT NOT NULL,
  class_id TEXT NOT NULL,
  class_name TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  status TEXT NOT NULL,
  notes TEXT,
  recorded_by TEXT NOT NULL,
  recorded_by_role TEXT,
  check_out_time TEXT,
  check_out_status TEXT,
  check_out_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Table: school_settings
CREATE TABLE IF NOT EXISTS school_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  nama_sekolah TEXT,
  sub_nama_sekolah TEXT,
  npsn TEXT,
  nss TEXT,
  akreditasi TEXT,
  alamat TEXT,
  desa_kelurahan TEXT,
  kecamatan TEXT,
  kabupaten_kota TEXT,
  provinsi TEXT,
  kode_pos TEXT,
  telepon TEXT,
  email TEXT,
  website TEXT,
  logo_url TEXT,
  nama_kepala_sekolah TEXT,
  nip_kepala_sekolah TEXT,
  naungan_yayasan TEXT,
  jam_masuk TEXT,
  batas_terlambat TEXT,
  jam_pulang TEXT,
  batas_pulang TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS) or Allow Public Anon Access
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow public anon access to classes" ON classes;
DROP POLICY IF EXISTS "Allow public anon access to teachers" ON teachers;
DROP POLICY IF EXISTS "Allow public anon access to students" ON students;
DROP POLICY IF EXISTS "Allow public anon access to attendance" ON attendance;
DROP POLICY IF EXISTS "Allow public anon access to school_settings" ON school_settings;

-- Create Policies for Anon Read/Write Access
CREATE POLICY "Allow public anon access to classes" ON classes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public anon access to teachers" ON teachers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public anon access to students" ON students FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public anon access to attendance" ON attendance FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public anon access to school_settings" ON school_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Storage Read Access" ON storage.objects FOR SELECT USING (bucket_id = 'student-photos');
CREATE POLICY "Public Storage Upload Access" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'student-photos');
`;

// Upload Student Photo to Supabase Storage Bucket
export async function uploadStudentPhotoToSupabase(
  base64Data: string,
  nisn: string
): Promise<{ success: boolean; url?: string; isSupabase?: boolean; error?: string }> {
  const supabase = getSupabaseClient();
  const cfg = loadSupabaseConfig();

  if (!base64Data) {
    return { success: true, url: '' };
  }

  // If already a remote HTTP URL (from prior Supabase upload), return as is
  if (base64Data.startsWith('http://') || base64Data.startsWith('https://')) {
    return { success: true, url: base64Data, isSupabase: true };
  }

  // Extract mime type and raw base64 buffer
  const matches = base64Data.match(/^data:(image\/[a-zA-Z0-9\+\-]+);base64,(.+)$/);
  let mimeType = 'image/jpeg';
  let base64Body = base64Data;
  if (matches && matches.length === 3) {
    mimeType = matches[1];
    base64Body = matches[2];
  }

  const fileBuffer = Buffer.from(base64Body, 'base64');
  const ext = mimeType.split('/')[1] || 'jpg';
  const filePath = `pas_foto_${nisn}_${Date.now()}.${ext}`;

  if (supabase && cfg.status === 'connected') {
    try {
      const { data, error } = await supabase.storage
        .from('student-photos')
        .upload(filePath, fileBuffer, {
          contentType: mimeType,
          upsert: true
        });

      if (error) {
        console.warn('Supabase Storage upload note (using base64 fallback):', error.message);
        return { success: true, url: base64Data, isSupabase: false, error: error.message };
      }

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('student-photos')
        .getPublicUrl(filePath);

      if (publicUrlData?.publicUrl) {
        return { success: true, url: publicUrlData.publicUrl, isSupabase: true };
      }
    } catch (err: any) {
      console.warn('Supabase storage upload error:', err?.message || err);
    }
  }

  // Fallback to base64 Data URI if Supabase Storage is unconfigured or unavailable
  return { success: true, url: base64Data, isSupabase: false };
}

// Sync Push local database to Supabase
export async function pushAllToSupabase(data: {
  classes: ClassRoom[];
  teachers: Teacher[];
  students: Student[];
  attendance: AttendanceRecord[];
  settings?: SchoolSettings;
}): Promise<{ success: boolean; message: string; details?: any }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, message: 'Supabase URL atau Anon Key belum diatur.' };
  }

  try {
    // 1. Classes
    const classesData = data.classes.map(c => ({
      id: c.id,
      name: c.name,
      grade_level: c.gradeLevel,
      teacher_id: c.teacherId || '',
      teacher_name: c.teacherName || '',
      student_count: c.studentCount || 0
    }));

    if (classesData.length > 0) {
      const { error: errClasses } = await supabase.from('classes').upsert(classesData, { onConflict: 'id' });
      if (errClasses) throw new Error(`Tabel classes: ${errClasses.message}`);
    }

    // 2. Teachers
    const teachersData = data.teachers.map(t => ({
      id: t.id,
      nip: t.nip,
      name: t.name,
      gender: t.gender || 'L',
      username: t.username,
      subject: t.subject || 'Mata Pelajaran',
      assigned_class_id: t.assignedClassId || '',
      assigned_class_name: t.assignedClassName || '',
      role: t.role || 'guru',
      password: t.password || ''
    }));

    if (teachersData.length > 0) {
      let { error: errTeachers } = await supabase.from('teachers').upsert(teachersData, { onConflict: 'id' });
      if (errTeachers && errTeachers.message && (errTeachers.message.includes('role') || errTeachers.message.includes('password'))) {
        console.warn('Supabase teachers table missing role/password column. Retrying without them...');
        const teachersDataBasic = teachersData.map(({ role, password, ...rest }) => rest);
        const retryRes = await supabase.from('teachers').upsert(teachersDataBasic, { onConflict: 'id' });
        errTeachers = retryRes.error;
      }
      if (errTeachers) throw new Error(`Tabel teachers: ${errTeachers.message}`);
    }

    // 3. Students
    const studentsData = data.students.map(s => ({
      id: s.id,
      nisn: s.nisn,
      name: s.name,
      gender: s.gender || 'L',
      class_id: s.classId,
      class_name: s.className,
      parent_name: s.parentName || '',
      parent_phone: s.parentPhone || '',
      photo_url: s.photoUrl || '',
      default_password: s.defaultPassword || '123'
    }));

    if (studentsData.length > 0) {
      let { error: errStudents } = await supabase.from('students').upsert(studentsData, { onConflict: 'id' });
      if (errStudents && errStudents.message && errStudents.message.includes('photo_url')) {
        console.warn('Supabase students table missing photo_url column. Retrying without photo_url...');
        const studentsDataNoPhoto = studentsData.map(({ photo_url, ...rest }) => rest);
        const retryRes = await supabase.from('students').upsert(studentsDataNoPhoto, { onConflict: 'id' });
        errStudents = retryRes.error;
      }
      if (errStudents) throw new Error(`Tabel students: ${errStudents.message}`);
    }

    // 4. Attendance
    const attendanceData = data.attendance.map(a => ({
      id: a.id,
      student_id: a.studentId || '',
      nisn: a.nisn,
      student_name: a.studentName,
      class_id: a.classId,
      class_name: a.className,
      date: a.date,
      time: a.time,
      status: a.status,
      notes: a.notes || '',
      recorded_by: a.recordedBy,
      recorded_by_role: a.recordedByRole || 'guru',
      check_out_time: a.checkOutTime || '-',
      check_out_status: a.checkOutStatus || '-',
      check_out_by: a.checkOutBy || '-'
    }));

    if (attendanceData.length > 0) {
      let { error: errAtt } = await supabase.from('attendance').upsert(attendanceData, { onConflict: 'id' });
      if (errAtt && errAtt.message && (errAtt.message.includes('check_out') || errAtt.message.includes('recorded_by_role'))) {
        console.warn('Supabase attendance table missing checkout columns. Retrying with basic fields...');
        const attendanceDataBasic = attendanceData.map(({ check_out_time, check_out_status, check_out_by, recorded_by_role, ...rest }) => rest);
        const retryAtt = await supabase.from('attendance').upsert(attendanceDataBasic, { onConflict: 'id' });
        errAtt = retryAtt.error;
      }
      if (errAtt) throw new Error(`Tabel attendance: ${errAtt.message}`);
    }

    // 5. School Settings
    if (data.settings) {
      const s = data.settings;
      const settingsRow = {
        id: 'default',
        nama_sekolah: s.namaSekolah,
        sub_nama_sekolah: s.subNamaSekolah,
        npsn: s.npsn,
        nss: s.nss,
        akreditasi: s.akreditasi,
        alamat: s.alamat,
        desa_kelurahan: s.desaKelurahan,
        kecamatan: s.kecamatan,
        kabupaten_kota: s.kabupatenKota,
        provinsi: s.provinsi,
        kode_pos: s.kodePos,
        telepon: s.telepon,
        email: s.email,
        website: s.website,
        logo_url: s.logoUrl,
        nama_kepala_sekolah: s.namaKepalaSekolah,
        nip_kepala_sekolah: s.nipKepalaSekolah,
        naungan_yayasan: s.naunganYayasan,
        jam_masuk: s.jamMasuk,
        batas_terlambat: s.batasTerlambat,
        jam_pulang: s.jamPulang,
        batas_pulang: s.batasPulang
      };
      try {
        await supabase.from('school_settings').upsert([settingsRow], { onConflict: 'id' });
      } catch (e) {
        console.warn('Failed to upsert school_settings in pushAllToSupabase:', e);
      }
    }

    saveSupabaseConfig({
      lastSyncTime: new Date().toISOString(),
      status: 'connected',
      errorMessage: undefined
    });

    return {
      success: true,
      message: `Berhasil mengekspor data ke Supabase: ${data.students.length} Siswa, ${data.teachers.length} Guru, ${data.classes.length} Kelas, ${data.attendance.length} Absensi, Identitas Sekolah.`
    };
  } catch (err: any) {
    console.warn('[Supabase Sync Push] Warning:', err.message || err);
    saveSupabaseConfig({ status: 'disconnected', errorMessage: err.message || 'Tidak dapat terhubung ke Supabase' });
    return { success: false, message: `Gagal sinkronisasi Supabase (menggunakan penyimpanan lokal): ${err.message}` };
  }
}

// Pull data from Supabase to local store
export async function pullAllFromSupabase(): Promise<{
  success: boolean;
  message: string;
  data?: {
    classes: ClassRoom[];
    teachers: Teacher[];
    students: Student[];
    attendance: AttendanceRecord[];
    settings?: SchoolSettings;
  };
}> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    const backup = readLocalDBBackup();
    if (backup && (backup.classes || backup.students)) {
      return {
        success: true,
        message: 'Supabase belum dikonfigurasi. Menggunakan data lokal.',
        data: {
          classes: backup.classes || [],
          teachers: backup.teachers || [],
          students: backup.students || [],
          attendance: backup.attendance || [],
          settings: backup.settings
        }
      };
    }
    return { success: false, message: 'Supabase URL atau Anon Key belum diatur.' };
  }

  try {
    const [resClasses, resTeachers, resStudents, resAtt, resSettings] = await Promise.all([
      supabase.from('classes').select('*'),
      supabase.from('teachers').select('*'),
      supabase.from('students').select('*'),
      supabase.from('attendance').select('*'),
      supabase.from('school_settings').select('*').maybeSingle()
    ]);

    if (resClasses.error) throw new Error(`Classes: ${resClasses.error.message}`);
    if (resTeachers.error) throw new Error(`Teachers: ${resTeachers.error.message}`);
    if (resStudents.error) throw new Error(`Students: ${resStudents.error.message}`);
    if (resAtt.error) throw new Error(`Attendance: ${resAtt.error.message}`);

    const classes: ClassRoom[] = (resClasses.data || []).map(c => ({
      id: c.id,
      name: c.name,
      gradeLevel: c.grade_level || '',
      teacherId: c.teacher_id,
      teacherName: c.teacher_name,
      studentCount: c.student_count || 0
    }));

    const savedBackup = readLocalDBBackup();
    const teachers: Teacher[] = (resTeachers.data || []).map(t => {
      const existing = (savedBackup?.teachers || []).find(l => l.id === t.id || l.nip === t.nip);
      return {
        id: t.id,
        nip: t.nip,
        name: t.name,
        gender: (t.gender === 'P' ? 'P' : 'L') as 'L' | 'P',
        username: t.username,
        subject: t.subject || 'Mata Pelajaran',
        role: (t.role as any) || existing?.role || (t.subject && t.subject.toLowerCase().includes('bk') ? 'bk' : 'guru'),
        password: t.password || existing?.password || undefined,
        assignedClassId: t.assigned_class_id || undefined,
        assignedClassName: t.assigned_class_name || undefined
      };
    });

    const students: Student[] = (resStudents.data || []).map(s => ({
      id: s.id,
      nisn: s.nisn,
      name: s.name,
      gender: s.gender || 'L',
      classId: s.class_id,
      className: s.class_name,
      parentName: s.parent_name || '',
      parentPhone: s.parent_phone || '',
      photoUrl: s.photo_url || '',
      defaultPassword: s.default_password || '123'
    }));

    const attendance: AttendanceRecord[] = (resAtt.data || []).map(a => ({
      id: a.id,
      studentId: a.student_id,
      nisn: a.nisn,
      studentName: a.student_name,
      classId: a.class_id,
      className: a.class_name,
      date: a.date,
      time: a.time,
      status: a.status,
      notes: a.notes,
      recordedBy: a.recorded_by,
      recordedByRole: a.recorded_by_role,
      checkOutTime: a.check_out_time,
      checkOutStatus: a.check_out_status,
      checkOutBy: a.check_out_by
    }));

    let settings: SchoolSettings | undefined = undefined;
    if (resSettings.data) {
      const st = resSettings.data;
      settings = {
        namaSekolah: st.nama_sekolah || "SMA ISLAM RA'IYATUL HUSNAN",
        subNamaSekolah: st.sub_nama_sekolah || "WRINGIN BONDOWOSO",
        npsn: st.npsn || "20521620",
        nss: st.nss || "302052202010",
        akreditasi: st.akreditasi || "B",
        alamat: st.alamat || "Jl. Raya Wringin No. 45",
        desaKelurahan: st.desa_kelurahan || "Wringin",
        kecamatan: st.kecamatan || "Wringin",
        kabupatenKota: st.kabupaten_kota || "Bondowoso",
        provinsi: st.provinsi || "Jawa Timur",
        kodePos: st.kode_pos || "68252",
        telepon: st.telepon || "(0332) 421xxx / 081234567890",
        email: st.email || "smaislam.raiyatulhusnan@gmail.sch.id",
        website: st.website || "www.smaislam-raiyatulhusnan.sch.id",
        logoUrl: st.logo_url || "/school-logo.png",
        namaKepalaSekolah: (st.nama_kepala_sekolah && st.nama_kepala_sekolah !== "Ust. Ahmad Fausan, S.Pd") ? st.nama_kepala_sekolah : "SAIFURRAHMAN, SH",
        nipKepalaSekolah: (st.nip_kepala_sekolah && st.nip_kepala_sekolah !== "198504122010011002") ? st.nip_kepala_sekolah : "",
        naunganYayasan: st.naungan_yayasan || "Yayasan Ra'iyatul Husnan Wringin",
        jamMasuk: st.jam_masuk || '07:00',
        batasTerlambat: st.batas_terlambat || '07:15',
        jamPulang: st.jam_pulang || '14:00',
        batasPulang: st.batas_pulang || '16:00',
        hariLiburRutin: [0, 6],
        hariLiburKhusus: savedBackup?.settings?.hariLiburKhusus || [
          { id: 'hol-1', date: '2026-08-17', name: 'HUT Kemerdekaan RI ke-81', isNational: true }
        ],
        allowAbsenLibur: savedBackup?.settings?.allowAbsenLibur || false
      };
    }

    const fetchedData = { classes, teachers, students, attendance, ...(settings ? { settings } : {}) };
    saveLocalDBBackup(fetchedData);

    saveSupabaseConfig({
      lastSyncTime: new Date().toISOString(),
      status: 'connected',
      errorMessage: undefined
    });

    return {
      success: true,
      message: `Berhasil mengimpor data dari Supabase: ${students.length} Siswa, ${teachers.length} Guru, ${classes.length} Kelas, ${attendance.length} Record Presensi${settings ? ', Identitas Sekolah' : ''}.`,
      data: fetchedData
    };
  } catch (err: any) {
    console.warn('[Supabase Sync Pull] Unable to connect to Supabase:', err.message || err);
    saveSupabaseConfig({ status: 'disconnected', errorMessage: 'Server Supabase tidak dapat terhubung (menggunakan data lokal).' });
    
    const backup = readLocalDBBackup();
    if (backup && (backup.classes || backup.students)) {
      return {
        success: true,
        message: 'Menggunakan database lokal (Supabase offline).',
        data: {
          classes: backup.classes || [],
          teachers: backup.teachers || [],
          students: backup.students || [],
          attendance: backup.attendance || [],
          settings: backup.settings
        }
      };
    }
    return { success: false, message: `Gagal mengimpor dari Supabase: ${err.message}` };
  }
}

export async function deleteTeacherFromSupabase(id: string, nip?: string) {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  try {
    if (id) await supabase.from('teachers').delete().eq('id', id);
    if (nip) await supabase.from('teachers').delete().eq('nip', nip);
    if (id) {
      await supabase.from('classes').update({ teacher_id: null, teacher_name: null }).eq('teacher_id', id);
    }
  } catch (err) {
    console.error('Error deleting teacher from Supabase:', err);
  }
}

export async function deleteClassFromSupabase(id: string) {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  try {
    if (id) await supabase.from('classes').delete().eq('id', id);
    if (id) {
      await supabase.from('teachers').update({ assigned_class_id: null, assigned_class_name: null }).eq('assigned_class_id', id);
    }
  } catch (err) {
    console.error('Error deleting class from Supabase:', err);
  }
}

export async function deleteStudentFromSupabase(id: string, nisn?: string) {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  try {
    if (id) await supabase.from('students').delete().eq('id', id);
    if (nisn) await supabase.from('students').delete().eq('nisn', nisn);
  } catch (err) {
    console.error('Error deleting student from Supabase:', err);
  }
}
