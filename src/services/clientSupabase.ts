import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ClassRoom, Teacher, Student, AttendanceRecord, SchoolSettings, BKNote } from '../types';

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

    // 2. Teachers
    const teachersData = localData.teachers.map(t => ({
      id: t.id,
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

    // 3. Students
    const studentsData = localData.students.map(s => ({
      id: s.id,
      nisn: s.nisn,
      name: s.name,
      gender: s.gender || 'L',
      class_id: s.classId,
      class_name: s.className,
      parent_name: s.parentName || null,
      parent_phone: s.parentPhone || null,
      photo_url: s.photoUrl || null,
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
          namaKepalaSekolah: rawSettings.nama_kepala_sekolah || "Ust. Ahmad Fausan, S.Pd",
          nipKepalaSekolah: rawSettings.nip_kepala_sekolah || "198504122010011002",
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

    const students: Student[] = (rawStudents || []).map((s: any) => ({
      id: s.id,
      nisn: s.nisn,
      name: s.name,
      gender: s.gender || 'L',
      classId: s.class_id,
      className: s.class_name,
      parentName: s.parent_name || undefined,
      parentPhone: s.parent_phone || undefined,
      photoUrl: s.photo_url || undefined,
      defaultPassword: s.default_password || '123'
    }));

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
