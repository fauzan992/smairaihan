import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ClassRoom, Teacher, Student, AttendanceRecord, SchoolSettings, BKNote } from '../types';
import { normalizeDateToYMD } from '../utils/studentAuthHelper';

const STORAGE_KEY_URL = 'app_supabase_url';
const STORAGE_KEY_KEY = 'app_supabase_anon_key';
const STORAGE_KEY_AUTO = 'app_supabase_auto_sync';
const STORAGE_KEY_LAST_SYNC = 'app_supabase_last_sync';

export interface ClientSupabaseConfig {
  url: string;
  anonKey: string;
  autoSync: boolean;
  lastSyncTime?: string;
  status: 'connected' | 'disconnected' | 'unconfigured' | 'error';
  errorMessage?: string;
}

export const DEFAULT_SUPABASE_URL = 'https://zxnkiqupojwydazkurfv.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_PvMiB0Or-lpYWjVSaa0FeQ_a33a0ISz';

// Encode extended student metadata (birthDate, address, academicYear, photoUrl) into default_password
// so it persists in Supabase even when the students table only has the core 10 columns
export function encodeStudentMetaPassword(s: Partial<Student>): string {
  let basePwd = '123';
  if (s.defaultPassword && typeof s.defaultPassword === 'string') {
    if (s.defaultPassword.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(s.defaultPassword);
        basePwd = parsed.p || '123';
      } catch {
        basePwd = '123';
      }
    } else {
      basePwd = s.defaultPassword;
    }
  }
  const meta: Record<string, string> = { p: basePwd };
  if (s.birthDate) meta.b = String(s.birthDate).trim();
  if (s.address) meta.a = String(s.address).trim();
  if (s.academicYear) meta.y = String(s.academicYear).trim();
  if (s.photoUrl && !s.photoUrl.startsWith('data:')) meta.u = s.photoUrl;

  if (Object.keys(meta).length === 1) return basePwd;
  return JSON.stringify(meta);
}

export function decodeStudentFromSupabaseRow(s: any, fallbackLocal?: Partial<Student>): Student {
  let defaultPassword = s.default_password || s.defaultPassword || '123';
  let metaBirthDate: string | undefined;
  let metaAddress: string | undefined;
  let metaAcademicYear: string | undefined;
  let metaPhotoUrl: string | undefined;

  if (typeof defaultPassword === 'string' && defaultPassword.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(defaultPassword);
      defaultPassword = parsed.p || '123';
      metaBirthDate = parsed.b || undefined;
      metaAddress = parsed.a || undefined;
      metaAcademicYear = parsed.y || undefined;
      metaPhotoUrl = parsed.u || undefined;
    } catch {
      defaultPassword = '123';
    }
  }

  return {
    id: s.id,
    nisn: String(s.nisn || '').trim(),
    name: String(s.name || '').trim(),
    gender: (String(s.gender || 'L').toUpperCase().startsWith('P') ? 'P' : 'L') as 'L' | 'P',
    classId: s.class_id || s.classId || fallbackLocal?.classId || '',
    className: s.class_name || s.className || fallbackLocal?.className || '',
    birthDate: s.birth_date || s.birthDate || metaBirthDate || fallbackLocal?.birthDate || undefined,
    address: s.address || metaAddress || fallbackLocal?.address || undefined,
    academicYear: s.academic_year || s.academicYear || metaAcademicYear || fallbackLocal?.academicYear || '2024/2025',
    parentName: s.parent_name || s.parentName || fallbackLocal?.parentName || undefined,
    parentPhone: s.parent_phone || s.parentPhone || fallbackLocal?.parentPhone || undefined,
    photoUrl: s.photo_url || s.photoUrl || metaPhotoUrl || fallbackLocal?.photoUrl || undefined,
    defaultPassword
  };
}

// Get saved config from localStorage
export function getStoredSupabaseConfig(): ClientSupabaseConfig {
  const url = localStorage.getItem(STORAGE_KEY_URL) || DEFAULT_SUPABASE_URL;
  const anonKey = localStorage.getItem(STORAGE_KEY_KEY) || DEFAULT_SUPABASE_ANON_KEY;
  const autoSync = localStorage.getItem(STORAGE_KEY_AUTO) !== 'false';
  const lastSyncTime = localStorage.getItem(STORAGE_KEY_LAST_SYNC) || undefined;

  if (!url || !anonKey) {
    return {
      url: DEFAULT_SUPABASE_URL,
      anonKey: DEFAULT_SUPABASE_ANON_KEY,
      autoSync: true,
      status: 'connected'
    };
  }

  return {
    url,
    anonKey,
    autoSync,
    lastSyncTime,
    status: 'connected'
  };
}

export function isBrowserSupabaseConfigured(): boolean {
  const cfg = getStoredSupabaseConfig();
  return Boolean(cfg.url && cfg.anonKey);
}

// Save config to localStorage
export function setStoredSupabaseConfig(url: string, anonKey: string, autoSync: boolean) {
  localStorage.setItem(STORAGE_KEY_URL, url.trim());
  localStorage.setItem(STORAGE_KEY_KEY, anonKey.trim());
  localStorage.setItem(STORAGE_KEY_AUTO, autoSync ? 'true' : 'false');
}

// Get Supabase browser client
export function getBrowserSupabaseClient(url?: string, anonKey?: string): SupabaseClient | null {
  const targetUrl = url || localStorage.getItem(STORAGE_KEY_URL) || DEFAULT_SUPABASE_URL;
  const targetKey = anonKey || localStorage.getItem(STORAGE_KEY_KEY) || DEFAULT_SUPABASE_ANON_KEY;

  if (!targetUrl || !targetKey) return null;

  try {
    return createClient(targetUrl, targetKey, {
      auth: { persistSession: false }
    });
  } catch (err) {
    console.error('Failed to create browser Supabase client:', err);
    return null;
  }
}

// Test Supabase connection directly from browser
export async function testBrowserSupabaseConnection(url: string, anonKey: string): Promise<{ success: boolean; message: string }> {
  const supabase = getBrowserSupabaseClient(url, anonKey);
  if (!supabase) {
    return { success: false, message: 'Supabase URL atau Anon Key tidak valid.' };
  }

  try {
    const { data, error } = await supabase.from('students').select('id').limit(1);
    if (error) {
      if (error.code === 'PGRST301' || error.message.includes('JWT') || error.message.includes('apiKey')) {
        return { success: false, message: `Autentikasi Supabase Gagal: ${error.message}` };
      }
      if (error.code === '42P01') {
        return { success: true, message: 'Koneksi ke Supabase berhasil! (Tabel belum dibuat, klik Pembuat Script Tabel SQL).' };
      }
    }
    return { success: true, message: 'Koneksi ke Supabase Database berhasil & aktif dari browser!' };
  } catch (err: any) {
    return { success: false, message: err.message || 'Gagal terhubung ke Supabase server.' };
  }
}

// Push all local data directly from browser to Supabase
export async function pushAllFromBrowser(url: string, anonKey: string, localData: {
  classes: ClassRoom[];
  teachers: Teacher[];
  students: Student[];
  attendance: AttendanceRecord[];
}): Promise<{ success: boolean; message?: string; error?: string }> {
  const supabase = getBrowserSupabaseClient(url, anonKey);
  if (!supabase) {
    return { success: false, error: 'Klien Supabase browser tidak dapat diinisialisasi.' };
  }

  try {
    // 1. Classes
    const classesData = localData.classes.map(c => ({
      id: c.id,
      name: c.name,
      grade_level: c.gradeLevel || null,
      teacher_id: c.teacherId || null,
      teacher_name: c.teacherName || null,
      student_count: c.studentCount || 0
    }));
    if (classesData.length > 0) {
      const { error: errClasses } = await supabase.from('classes').upsert(classesData, { onConflict: 'id' });
      if (errClasses) throw new Error(`Tabel classes: ${errClasses.message}`);
    }

    // 2. Teachers (reconcile unique nip with existing Supabase rows to avoid unique constraint conflicts)
    const { data: existingSupaTeachers } = await supabase.from('teachers').select('id, nip');
    const teacherIdByNip = new Map<string, string>();
    (existingSupaTeachers || []).forEach((et: any) => {
      if (et.nip && et.id) teacherIdByNip.set(String(et.nip).trim(), et.id);
    });

    const dedupTeachersMap = new Map<string, Teacher>();
    localData.teachers.forEach((t, idx) => {
      const cleanNip = String(t.nip || '').trim() || `nip-${idx}`;
      dedupTeachersMap.set(cleanNip, { ...t, nip: cleanNip });
    });

    const teachersData = Array.from(dedupTeachersMap.values()).map(t => ({
      id: teacherIdByNip.get(t.nip) || t.id,
      nip: t.nip,
      name: t.name,
      gender: t.gender || 'L',
      username: t.username,
      subject: t.subject || null,
      assigned_class_id: t.assignedClassId || null,
      assigned_class_name: t.assignedClassName || null,
      role: t.role || 'guru',
      password: t.password || null
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

    // 3. Students (use verified core columns and reconcile unique nisn with existing Supabase rows)
    const { data: existingSupaStudents } = await supabase.from('students').select('id, nisn');
    const studentIdByNisn = new Map<string, string>();
    (existingSupaStudents || []).forEach((es: any) => {
      if (es.nisn && es.id) studentIdByNisn.set(String(es.nisn).trim(), es.id);
    });

    const dedupStudentsMap = new Map<string, Student>();
    localData.students.forEach((s, idx) => {
      const rawNisn = String(s.nisn || '').trim();
      const validNisn = (rawNisn && rawNisn !== '-' && rawNisn !== '0')
        ? rawNisn
        : `NIS-${s.id || idx}`;
      dedupStudentsMap.set(validNisn, { ...s, nisn: validNisn });
    });

    const studentsData = Array.from(dedupStudentsMap.values()).map((s, idx) => ({
      id: studentIdByNisn.get(s.nisn) || s.id || `std-${Date.now()}-${idx}`,
      nisn: s.nisn,
      name: String(s.name || '').trim(),
      gender: s.gender || 'L',
      class_id: s.classId || 'cls-1',
      class_name: s.className || 'X 1',
      parent_name: s.parentName || null,
      parent_phone: s.parentPhone || null,
      default_password: encodeStudentMetaPassword(s)
    }));

    if (studentsData.length > 0) {
      const chunkSize = 200;
      for (let i = 0; i < studentsData.length; i += chunkSize) {
        const chunk = studentsData.slice(i, i + chunkSize);
        let { error: errStudents } = await supabase.from('students').upsert(chunk, { onConflict: 'id' });
        if (errStudents) {
          console.warn('Supabase students upsert notice, retrying minimal core columns:', errStudents.message);
          const chunkMinimal = chunk.map(({ id, nisn, name, gender, class_id, class_name }) => ({
            id, nisn, name, gender, class_id, class_name
          }));
          const retryRes = await supabase.from('students').upsert(chunkMinimal, { onConflict: 'id' });
          errStudents = retryRes.error;
        }
        if (errStudents) throw new Error(`Tabel students: ${errStudents.message}`);
      }
    }

    // 4. Attendance
    const attendanceData = localData.attendance.map(a => ({
      id: a.id,
      nisn: a.nisn,
      student_name: a.studentName,
      class_id: a.classId,
      class_name: a.className,
      date: a.date,
      time: a.time,
      status: a.status,
      notes: a.notes || null,
      recorded_by: a.recordedBy || 'System',
      recorded_by_role: a.recordedByRole || 'admin',
      check_out_time: a.checkOutTime || null,
      check_out_status: a.checkOutStatus || null,
      check_out_by: a.checkOutBy || null
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
    try {
      const rawSettings = localStorage.getItem('app_school_settings');
      if (rawSettings) {
        const settings = JSON.parse(rawSettings);
        const settingsRow = {
          id: 'default',
          nama_sekolah: settings.namaSekolah,
          sub_nama_sekolah: settings.subNamaSekolah,
          npsn: settings.npsn,
          nss: settings.nss,
          akreditasi: settings.akreditasi,
          alamat: settings.alamat,
          desa_kelurahan: settings.desaKelurahan,
          kecamatan: settings.kecamatan,
          kabupaten_kota: settings.kabupatenKota,
          provinsi: settings.provinsi,
          kode_pos: settings.kodePos,
          telepon: settings.telepon,
          email: settings.email,
          website: settings.website,
          logo_url: settings.logoUrl,
          nama_kepala_sekolah: settings.namaKepalaSekolah,
          nip_kepala_sekolah: settings.nipKepalaSekolah,
          naungan_yayasan: settings.naunganYayasan,
          jam_masuk: settings.jamMasuk,
          batas_terlambat: settings.batasTerlambat,
          jam_pulang: settings.jamPulang,
          batas_pulang: settings.batasPulang
        };
        await supabase.from('school_settings').upsert([settingsRow], { onConflict: 'id' });
      }
    } catch (e) {
      console.warn('Sync school_settings to Supabase error:', e);
    }

    const nowIso = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY_LAST_SYNC, nowIso);

    return {
      success: true,
      message: `Berhasil sinkronisasi ke Supabase Cloud (${classesData.length} kelas, ${teachersData.length} guru, ${studentsData.length} siswa, ${attendanceData.length} presensi).`
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Gagal mengirim data ke Supabase.' };
  }
}

// Pull all data directly from browser from Supabase
export async function pullAllFromBrowser(url: string, anonKey: string): Promise<{
  success: boolean;
  data?: {
    classes: ClassRoom[];
    teachers: Teacher[];
    students: Student[];
    attendance: AttendanceRecord[];
  };
  message?: string;
  error?: string;
}> {
  const supabase = getBrowserSupabaseClient(url, anonKey);
  if (!supabase) {
    return { success: false, error: 'Klien Supabase browser tidak dapat diinisialisasi.' };
  }

  try {
    const { data: rawClasses, error: errClasses } = await supabase.from('classes').select('*');
    if (errClasses) throw new Error(`Classes: ${errClasses.message}`);

    const { data: rawTeachers, error: errTeachers } = await supabase.from('teachers').select('*');
    if (errTeachers) throw new Error(`Teachers: ${errTeachers.message}`);

    const { data: rawStudents, error: errStudents } = await supabase.from('students').select('*');
    if (errStudents) throw new Error(`Students: ${errStudents.message}`);

    const { data: rawAtt, error: errAtt } = await supabase.from('attendance').select('*');
    if (errAtt) throw new Error(`Attendance: ${errAtt.message}`);

    // Pull school settings if available
    try {
      const { data: rawSettings } = await supabase.from('school_settings').select('*').single();
      if (rawSettings) {
        const settingsObj: SchoolSettings = {
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
          telepon: rawSettings.telepon || "(0332) 421xxx",
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
        localStorage.setItem('app_school_settings', JSON.stringify(settingsObj));
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('school-settings-updated', { detail: settingsObj }));
        }
      }
    } catch (e) {
      console.warn('Pull school_settings error:', e);
    }

    const classes: ClassRoom[] = (rawClasses || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      gradeLevel: c.grade_level || '10',
      teacherId: c.teacher_id || undefined,
      teacherName: c.teacher_name || undefined,
      studentCount: c.student_count || 0
    }));

    let localTeachersList: Teacher[] = [];
    try {
      const rawLocal = localStorage.getItem('app_master_teachers');
      if (rawLocal) localTeachersList = JSON.parse(rawLocal);
    } catch (e) {}

    const teachers: Teacher[] = (rawTeachers || []).map((t: any) => {
      const existing = localTeachersList.find(l => l.id === t.id || l.nip === t.nip);
      return {
        id: t.id,
        nip: t.nip,
        name: t.name,
        gender: (t.gender === 'P' ? 'P' : 'L') as 'L' | 'P',
        username: t.username,
        subject: t.subject || undefined,
        role: (t.role as any) || existing?.role || (t.subject && t.subject.toLowerCase().includes('bk') ? 'bk' : 'guru'),
        password: t.password || existing?.password || undefined,
        assignedClassId: t.assigned_class_id || undefined,
        assignedClassName: t.assigned_class_name || undefined
      };
    });

    let localStudentsList: Student[] = [];
    try {
      const rawLocalSt = localStorage.getItem('app_master_students');
      if (rawLocalSt) localStudentsList = JSON.parse(rawLocalSt);
    } catch (e) {}

    const students: Student[] = (rawStudents || []).map((s: any) => {
      const existingLocal = localStudentsList.find(l => l.id === s.id || l.nisn === s.nisn);
      return decodeStudentFromSupabaseRow(s, existingLocal);
    });

    const attendance: AttendanceRecord[] = (rawAtt || []).map((a: any) => ({
      id: a.id,
      studentId: a.student_id || a.nisn,
      nisn: a.nisn,
      studentName: a.student_name,
      classId: a.class_id,
      className: a.class_name,
      date: a.date,
      time: a.time,
      status: a.status,
      notes: a.notes || undefined,
      recordedBy: a.recorded_by || 'System',
      recordedByRole: a.recorded_by_role || 'admin',
      checkOutTime: a.check_out_time || undefined,
      checkOutStatus: a.check_out_status || undefined,
      checkOutBy: a.check_out_by || undefined
    }));

    const nowIso = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY_LAST_SYNC, nowIso);
    localStorage.setItem('app_master_classes', JSON.stringify(classes));
    localStorage.setItem('app_master_teachers', JSON.stringify(teachers));
    localStorage.setItem('app_master_students', JSON.stringify(students));
    localStorage.setItem('app_attendance_records', JSON.stringify(attendance));

    return {
      success: true,
      data: { classes, teachers, students, attendance },
      message: `Berhasil mengambil data dari Supabase (${students.length} siswa, ${teachers.length} guru, ${classes.length} kelas, ${attendance.length} log presensi).`
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Gagal mengambil data dari Supabase.' };
  }
}

export async function deleteTeacherFromBrowserSupabase(id: string, nip?: string) {
  const supabase = getBrowserSupabaseClient();
  if (!supabase) return;
  try {
    if (id) await supabase.from('teachers').delete().eq('id', id);
    if (nip) await supabase.from('teachers').delete().eq('nip', nip);
    if (id) {
      await supabase.from('classes').update({ teacher_id: null, teacher_name: null }).eq('teacher_id', id);
    }
  } catch (e) {
    console.warn('Error deleting teacher from Supabase browser client:', e);
  }
}

export async function deleteClassFromBrowserSupabase(id: string) {
  const supabase = getBrowserSupabaseClient();
  if (!supabase) return;
  try {
    if (id) await supabase.from('classes').delete().eq('id', id);
    if (id) {
      await supabase.from('teachers').update({ assigned_class_id: null, assigned_class_name: null }).eq('assigned_class_id', id);
    }
  } catch (e) {
    console.warn('Error deleting class from Supabase browser client:', e);
  }
}

export async function deleteStudentFromBrowserSupabase(id: string, nisn?: string) {
  const supabase = getBrowserSupabaseClient();
  if (!supabase) return;
  try {
    if (id) await supabase.from('students').delete().eq('id', id);
    if (nisn) await supabase.from('students').delete().eq('nisn', nisn);
  } catch (e) {
    console.warn('Error deleting student from Supabase browser client:', e);
  }
}

export async function upsertStudentToBrowserSupabase(student: Student): Promise<{ success: boolean; error?: string }> {
  const supabase = getBrowserSupabaseClient();
  if (!supabase) return { success: false, error: 'Klien Supabase tidak aktif' };
  try {
    const formattedBirthDate = student.birthDate ? (normalizeDateToYMD(student.birthDate) || student.birthDate) : null;
    const trimmedNisn = String(student.nisn).trim();

    // Standard payload with known verified Supabase schema columns
    const standardPayload: any = {
      name: String(student.name).trim(),
      gender: student.gender || 'L',
      class_id: student.classId,
      class_name: student.className,
      parent_name: student.parentName || null,
      parent_phone: student.parentPhone || null,
      default_password: encodeStudentMetaPassword({
        ...student,
        birthDate: formattedBirthDate || undefined
      })
    };

    // Strategy 1: Try updating by NISN first (primary unique key for students in school)
    let { error, data } = await supabase
      .from('students')
      .update(standardPayload)
      .eq('nisn', trimmedNisn)
      .select('id');

    // Strategy 2: If no rows updated by NISN, try updating by ID
    if (!error && (!data || data.length === 0) && student.id) {
      const resById = await supabase
        .from('students')
        .update({ ...standardPayload, nisn: trimmedNisn })
        .eq('id', student.id)
        .select('id');
      error = resById.error;
      data = resById.data;
    }

    // Strategy 3: If still not matched, try upserting with id
    if (!error && (!data || data.length === 0)) {
      const upsertPayload = {
        id: student.id || `std-${Date.now()}`,
        nisn: trimmedNisn,
        ...standardPayload
      };
      const upsertRes = await supabase.from('students').upsert(upsertPayload, { onConflict: 'id' }).select('id');
      error = upsertRes.error;
    }

    // Strategy 4: If any schema/column mismatch error occurs, fallback to minimal columns
    if (error) {
      console.warn('Supabase students update notice, attempting minimal fallback:', error.message);
      const minPayload = {
        name: standardPayload.name,
        gender: standardPayload.gender,
        class_id: standardPayload.class_id,
        class_name: standardPayload.class_name
      };

      let minRes = await supabase.from('students').update(minPayload).eq('nisn', trimmedNisn);
      if (minRes.error && student.id) {
        minRes = await supabase.from('students').update(minPayload).eq('id', student.id);
      }
      if (minRes.error) {
        console.error('Final fallback update to Supabase failed:', minRes.error);
        return { success: false, error: minRes.error.message };
      }
    }

    // Strategy 5: Recalculate student counts for classes in Supabase
    try {
      const { data: allClasses } = await supabase.from('classes').select('id');
      if (allClasses && allClasses.length > 0) {
        for (const c of allClasses) {
          const { count } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('class_id', c.id);
          if (typeof count === 'number') {
            await supabase.from('classes').update({ student_count: count }).eq('id', c.id);
          }
        }
      }
    } catch {
      // Non-critical, ignore count sync error
    }

    return { success: true };
  } catch (e: any) {
    console.warn('Error upserting student to Supabase browser client:', e);
    return { success: false, error: e?.message };
  }
}

export async function upsertTeacherToBrowserSupabase(teacher: Teacher) {
  const supabase = getBrowserSupabaseClient();
  if (!supabase) return;
  try {
    const payload: any = {
      id: teacher.id,
      nip: teacher.nip,
      name: teacher.name,
      gender: teacher.gender || 'L',
      username: teacher.username,
      subject: teacher.subject || null,
      assigned_class_id: teacher.assignedClassId || null,
      assigned_class_name: teacher.assignedClassName || null,
      role: teacher.role || 'guru',
      password: teacher.password || null
    };

    let { error } = await supabase.from('teachers').upsert(payload, { onConflict: 'id' });
    if (error && error.message && (error.message.includes('role') || error.message.includes('password'))) {
      const { role, password, ...basicPayload } = payload;
      await supabase.from('teachers').upsert(basicPayload, { onConflict: 'id' });
    }
  } catch (e) {
    console.warn('Error upserting teacher to Supabase browser client:', e);
  }
}

export async function upsertSettingsToBrowserSupabase(settings: SchoolSettings) {
  const supabase = getBrowserSupabaseClient();
  if (!supabase) return;
  try {
    const settingsRow = {
      id: 'default',
      nama_sekolah: settings.namaSekolah,
      sub_nama_sekolah: settings.subNamaSekolah,
      npsn: settings.npsn,
      nss: settings.nss,
      akreditasi: settings.akreditasi,
      alamat: settings.alamat,
      desa_kelurahan: settings.desaKelurahan,
      kecamatan: settings.kecamatan,
      kabupaten_kota: settings.kabupatenKota,
      provinsi: settings.provinsi,
      kode_pos: settings.kodePos,
      telepon: settings.telepon,
      email: settings.email,
      website: settings.website,
      logo_url: settings.logoUrl,
      nama_kepala_sekolah: settings.namaKepalaSekolah,
      nip_kepala_sekolah: settings.nipKepalaSekolah,
      naungan_yayasan: settings.naunganYayasan,
      jam_masuk: settings.jamMasuk,
      batas_terlambat: settings.batasTerlambat,
      jam_pulang: settings.jamPulang,
      batas_pulang: settings.batasPulang
    };
    await supabase.from('school_settings').upsert([settingsRow], { onConflict: 'id' });
  } catch (e) {
    console.warn('Error upserting settings to Supabase browser client:', e);
  }
}

export async function upsertAttendanceToBrowserSupabase(
  records: AttendanceRecord | AttendanceRecord[]
): Promise<{ success: boolean; count?: number; error?: string }> {
  const supabase = getBrowserSupabaseClient();
  if (!supabase) return { success: false, error: 'Klien Supabase browser belum aktif' };

  const recList = Array.isArray(records) ? records : [records];
  if (recList.length === 0) return { success: true, count: 0 };

  try {
    const payload = recList.map(a => ({
      id: a.id,
      student_id: a.studentId || '',
      nisn: String(a.nisn).trim(),
      student_name: String(a.studentName || '').trim(),
      class_id: a.classId || '',
      class_name: a.className || '',
      date: a.date,
      time: a.time || '-',
      status: a.status,
      notes: a.notes || '',
      recorded_by: a.recordedBy || 'System',
      recorded_by_role: a.recordedByRole || 'guru',
      check_out_time: a.checkOutTime || '-',
      check_out_status: a.checkOutStatus || '-',
      check_out_by: a.checkOutBy || '-'
    }));

    let { error } = await supabase.from('attendance').upsert(payload, { onConflict: 'id' });
    if (error && error.message && (error.message.includes('check_out') || error.message.includes('recorded_by_role'))) {
      const basicPayload = payload.map(({ check_out_time, check_out_status, check_out_by, recorded_by_role, ...rest }) => rest);
      const retry = await supabase.from('attendance').upsert(basicPayload, { onConflict: 'id' });
      error = retry.error;
    }

    if (error) {
      console.warn('Error upserting attendance to Supabase browser:', error);
      return { success: false, error: error.message };
    }

    return { success: true, count: payload.length };
  } catch (err: any) {
    console.warn('Attendance upsert browser exception:', err);
    return { success: false, error: err?.message };
  }
}
