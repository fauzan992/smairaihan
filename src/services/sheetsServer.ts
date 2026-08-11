import { google } from 'googleapis';
import { Student, Teacher, ClassRoom, AttendanceRecord } from '../types';

export interface SheetsConfig {
  spreadsheetId: string | null;
  spreadsheetUrl: string | null;
  lastSyncTime: string | null;
  autoSync: boolean;
}

let currentSheetsConfig: SheetsConfig = {
  spreadsheetId: null,
  spreadsheetUrl: null,
  lastSyncTime: null,
  autoSync: true
};

export function getCurrentSheetsConfig(): SheetsConfig {
  return currentSheetsConfig;
}

export function setCurrentSheetsConfig(config: Partial<SheetsConfig>) {
  currentSheetsConfig = { ...currentSheetsConfig, ...config };
}

function getGoogleAuthClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return auth;
}

export async function initGoogleSpreadsheet(accessToken: string, existingSpreadsheetId?: string) {
  const auth = getGoogleAuthClient(accessToken);
  const sheets = google.sheets({ version: 'v4', auth });

  let spreadsheetId = existingSpreadsheetId;
  let spreadsheetUrl = '';

  if (!spreadsheetId) {
    // Create new Google Spreadsheet in Drive
    const response = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: "Database Absensi SMA Islam Ra'iyatul Husnan"
        },
        sheets: [
          { properties: { title: 'Data Siswa' } },
          { properties: { title: 'Data Guru' } },
          { properties: { title: 'Data Kelas' } },
          { properties: { title: 'Log Presensi' } }
        ]
      }
    });

    spreadsheetId = response.data.spreadsheetId || '';
    spreadsheetUrl = response.data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
  } else {
    spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
  }

  currentSheetsConfig = {
    spreadsheetId,
    spreadsheetUrl,
    lastSyncTime: new Date().toISOString(),
    autoSync: true
  };

  return { spreadsheetId, spreadsheetUrl };
}

export async function pushAllToSpreadsheet(
  accessToken: string,
  spreadsheetId: string,
  students: Student[],
  teachers: Teacher[],
  classes: ClassRoom[],
  attendance: AttendanceRecord[]
) {
  const auth = getGoogleAuthClient(accessToken);
  const sheets = google.sheets({ version: 'v4', auth });

  // 1. Data Siswa
  const studentRows = [
    ['ID', 'NISN', 'Nama Siswa', 'Jenis Kelamin', 'ID Kelas', 'Nama Kelas', 'Nama Wali', 'No HP Wali', 'Password Default'],
    ...students.map(s => [s.id, s.nisn, s.name, s.gender, s.classId, s.className, s.parentName, s.parentPhone, s.defaultPassword || '123'])
  ];

  // 2. Data Guru
  const teacherRows = [
    ['ID', 'NIP', 'Nama Guru', 'Jenis Kelamin', 'Username', 'Mata Pelajaran', 'ID Kelas Binaan', 'Nama Kelas Binaan'],
    ...teachers.map(t => [t.id, t.nip, t.name, t.gender, t.username, t.subject, t.assignedClassId || '', t.assignedClassName || ''])
  ];

  // 3. Data Kelas
  const classRows = [
    ['ID', 'Nama Kelas', 'Tingkat', 'Jumlah Siswa', 'ID Wali Kelas', 'Nama Wali Kelas'],
    ...classes.map(c => [c.id, c.name, String(c.gradeLevel), String(c.studentCount), c.teacherId || '', c.teacherName || ''])
  ];

  // 4. Log Presensi
  const attendanceRows = [
    ['ID', 'Student ID', 'NISN', 'Nama Siswa', 'Class ID', 'Nama Kelas', 'Tanggal (YYYY-MM-DD)', 'Jam Masuk (WIB)', 'Status Masuk', 'Jam Pulang (WIB)', 'Status Pulang', 'Guru Jam Terakhir', 'Dicatat Oleh', 'Role Pencatat', 'Catatan'],
    ...attendance.map(a => [
      a.id,
      a.studentId || '',
      a.nisn,
      a.studentName,
      a.classId || '',
      a.className,
      a.date,
      a.time,
      a.status,
      a.checkOutTime || '-',
      a.checkOutStatus || '-',
      a.checkOutBy || '-',
      a.recordedBy,
      a.recordedByRole || 'admin',
      a.notes || ''
    ])
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "'Data Siswa'!A1",
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: studentRows }
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "'Data Guru'!A1",
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: teacherRows }
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "'Data Kelas'!A1",
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: classRows }
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "'Log Presensi'!A1",
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: attendanceRows }
  });

  currentSheetsConfig.lastSyncTime = new Date().toISOString();
  return { success: true, timestamp: currentSheetsConfig.lastSyncTime };
}

export async function pullAllFromSpreadsheet(accessToken: string, spreadsheetId: string) {
  const auth = getGoogleAuthClient(accessToken);
  const sheets = google.sheets({ version: 'v4', auth });

  const batchRes = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: ["'Data Siswa'!A2:I", "'Data Guru'!A2:H", "'Data Kelas'!A2:F", "'Log Presensi'!A2:O"]
  });

  const valueRanges = batchRes.data.valueRanges || [];

  const studentValues = valueRanges[0]?.values || [];
  const teacherValues = valueRanges[1]?.values || [];
  const classValues = valueRanges[2]?.values || [];
  const attendanceValues = valueRanges[3]?.values || [];

  const students: Student[] = studentValues.map((row: any[]) => ({
    id: row[0] || `std-${Date.now()}`,
    nisn: String(row[1] || '').trim(),
    name: String(row[2] || '').trim(),
    gender: row[3] === 'P' ? 'P' : 'L',
    classId: row[4] || '',
    className: row[5] || '',
    parentName: row[6] || 'Wali Murid',
    parentPhone: row[7] || '-',
    defaultPassword: row[8] || '123'
  }));

  const teachers: Teacher[] = teacherValues.map((row: any[]) => ({
    id: row[0] || `tch-${Date.now()}`,
    nip: String(row[1] || '').trim(),
    name: String(row[2] || '').trim(),
    gender: row[3] === 'P' ? 'P' : 'L',
    username: String(row[4] || '').trim(),
    subject: row[5] || 'Mata Pelajaran',
    assignedClassId: row[6] || undefined,
    assignedClassName: row[7] || undefined
  }));

  const classes: ClassRoom[] = classValues.map((row: any[]) => {
    const rawGrade = String(row[2] || 'X').toUpperCase();
    const gradeLevel: 'X' | 'XI' | 'XII' = rawGrade === 'XII' ? 'XII' : rawGrade === 'XI' ? 'XI' : 'X';
    return {
      id: row[0] || `cls-${Date.now()}`,
      name: String(row[1] || '').trim(),
      gradeLevel,
      studentCount: Number(row[3]) || 0,
      teacherId: row[4] || undefined,
      teacherName: row[5] || undefined
    };
  });

  const attendanceRecords: AttendanceRecord[] = attendanceValues.map((row: any[]) => ({
    id: row[0] || `att-${Date.now()}`,
    studentId: row[1] || `std-${row[2]}`,
    nisn: String(row[2] || '').trim(),
    studentName: String(row[3] || '').trim(),
    classId: row[4] || 'cls-1',
    className: row[5] || '',
    date: row[6] || new Date().toISOString().split('T')[0],
    time: row[7] || '07:00:00',
    status: (['Hadir', 'Izin', 'Sakit', 'Alpa'].includes(row[8]) ? row[8] : 'Hadir') as any,
    checkOutTime: row[9] || '-',
    checkOutStatus: row[10] || '-',
    checkOutBy: row[11] || '-',
    recordedBy: row[12] || 'Sistem',
    recordedByRole: row[13] || 'admin',
    notes: row[14] || ''
  }));

  currentSheetsConfig.lastSyncTime = new Date().toISOString();

  return { students, teachers, classes, attendanceRecords };
}

export async function appendAttendanceToSpreadsheet(
  accessToken: string,
  spreadsheetId: string,
  record: AttendanceRecord
) {
  try {
    const auth = getGoogleAuthClient(accessToken);
    const sheets = google.sheets({ version: 'v4', auth });

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "'Log Presensi'!A:O",
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          record.id,
          record.studentId,
          record.nisn,
          record.studentName,
          record.classId,
          record.className,
          record.date,
          record.time,
          record.status,
          record.checkOutTime || '-',
          record.checkOutStatus || '-',
          record.checkOutBy || '-',
          record.recordedBy,
          record.recordedByRole,
          record.notes || ''
        ]]
      }
    });

    currentSheetsConfig.lastSyncTime = new Date().toISOString();
  } catch (err) {
    console.error('Failed appending attendance row to Google Sheets:', err);
  }
}
