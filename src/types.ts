export type UserRole = 'admin' | 'guru' | 'bk' | 'wali';

export type AttendanceStatus = 'Hadir' | 'Izin' | 'Sakit' | 'Alpa';

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  nip?: string;
  nisn?: string;
  classId?: string;
  className?: string;
  childNisn?: string;
  childName?: string;
}

export interface Student {
  id: string;
  nisn: string;
  name: string;
  gender: 'L' | 'P';
  classId: string;
  className: string;
  parentName: string;
  parentPhone: string;
  photoUrl?: string;
  defaultPassword?: string;
  birthDate?: string;
  address?: string;
  academicYear?: string;
}

export interface Teacher {
  id: string;
  nip: string;
  name: string;
  gender: 'L' | 'P';
  username: string;
  password?: string;
  subject: string;
  assignedClassId?: string;
  assignedClassName?: string;
  role?: 'admin' | 'guru' | 'bk';
}

export interface ClassRoom {
  id: string;
  name: string;
  gradeLevel: 'X' | 'XI' | 'XII';
  teacherId?: string;
  teacherName?: string;
  studentCount: number;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  nisn: string;
  studentName: string;
  classId: string;
  className: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm:ss (Waktu Masuk)
  status: AttendanceStatus;
  notes?: string;
  recordedBy: string;
  recordedByRole: string;
  checkOutTime?: string; // HH:mm:ss (Waktu Pulang)
  checkOutStatus?: 'Pulang' | 'Bolos / Pulang Awal' | 'Belum Pulang';
  checkOutBy?: string; // Nama Guru Jam Terakhir
}

export interface AttendanceFilter {
  classId?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  search?: string;
}

export interface AttendanceStatSummary {
  totalStudents: number;
  hadir: number;
  izin: number;
  sakit: number;
  alpa: number;
  percentage: number;
}

export interface HolidayConfig {
  id: string;
  date: string; // YYYY-MM-DD
  name: string; // Deskripsi Hari Libur, misal: "HUT Kemerdekaan RI", "Cuti Bersama"
  isNational?: boolean;
}

export interface SchoolSettings {
  // Identitas & Profil Sekolah
  namaSekolah?: string;        // default: "SMA ISLAM RA'IYATUL HUSNAN"
  subNamaSekolah?: string;     // default: "WRINGIN BONDOWOSO"
  npsn?: string;               // default: "20521620"
  nss?: string;                // default: "302052202010"
  akreditasi?: string;         // default: "B"
  alamat?: string;             // default: "Jl. Raya Wringin No. 45"
  desaKelurahan?: string;      // default: "Wringin"
  kecamatan?: string;          // default: "Wringin"
  kabupatenKota?: string;      // default: "Bondowoso"
  provinsi?: string;           // default: "Jawa Timur"
  kodePos?: string;            // default: "68252"
  telepon?: string;            // default: "(0332) 421xxx / 081234567890"
  email?: string;              // default: "smaislam.raiyatulhusnan@gmail.sch.id"
  website?: string;            // default: "www.smaislam-raiyatulhusnan.sch.id"
  logoUrl?: string;            // default: "/school-logo.png"
  namaKepalaSekolah?: string;  // default: "SAIFURRAHMAN, SH"
  nipKepalaSekolah?: string;   // default: ""
  naunganYayasan?: string;     // default: "Yayasan Ra'iyatul Husnan"

  // Jam Absensi & Hari Libur
  jamMasuk: string;       // default: "07:00"
  batasTerlambat: string; // default: "07:15"
  jamPulang: string;      // default: "14:00"
  batasPulang: string;    // default: "16:00"
  hariLiburRutin: number[]; // 0 = Minggu, 6 = Sabtu
  hariLiburKhusus: HolidayConfig[];
  allowAbsenLibur: boolean;
}

export interface BKNote {
  id: string;
  studentId: string;
  studentName: string;
  nisn: string;
  className: string;
  date: string; // YYYY-MM-DD
  time?: string;
  counselorName: string; // Nama Guru BK
  category: 'Konseling Individual' | 'Pemanggilan Orang Tua' | 'Surat Peringatan (SP)' | 'Home Visit' | 'Konseling Akademik/Sikap';
  statusResiko: 'Rendah' | 'Sedang' | 'Tinggi (Kritis)';
  note: string; // Catatan hasil bimbingan
  actionTaken: string; // Tindakan / Hasil Kesepakatan
  spLevel?: 'Tanpa SP' | 'SP-1' | 'SP-2' | 'SP-3';
  followUpDate?: string;
}

export interface KBMAssignment {
  id: string;
  classId: string;
  className: string;
  subjectName: string;
  teacherName: string;
  givenDate: string; // YYYY-MM-DD
  dueDate?: string;  // YYYY-MM-DD
  title: string;
  description?: string;
  status: 'PENDING' | 'COMPLETED' | 'CHECKED_TODAY';
  checkedDate?: string;
  notes?: string;
}

export type KBMAttendanceStatus = 'Hadir' | 'Izin' | 'Sakit' | 'Pulang Awal' | 'Bolos' | 'Alpa';

export interface KBMStudentAttendance {
  nisn: string;
  studentName: string;
  gender?: 'L' | 'P';
  status: KBMAttendanceStatus;
  notes?: string;
  timePulangAwal?: string;
}

export interface KBMJournalEntry {
  id: string;
  date: string; // YYYY-MM-DD
  sessionHour: string; // e.g. "Jam ke 1 - 2 (07:00 - 08:30)"
  classId: string;
  className: string;
  subjectName: string;
  teacherId?: string;
  teacherName: string;
  topic: string; // Materi / Pokok Bahasan
  notes?: string; // Catatan Kendala / Catatan Kelas
  studentAttendance: KBMStudentAttendance[];
  assignmentGiven?: {
    title: string;
    description?: string;
    dueDate?: string;
  };
  createdAt?: string;
}
