import { Student, Teacher, ClassRoom, AttendanceRecord, AttendanceStatus, BKNote } from '../types';

export const INITIAL_CLASSES: ClassRoom[] = [
  { id: 'cls-1', name: 'X MIPA 1', gradeLevel: 'X', teacherId: 'tch-1', teacherName: 'Ust. Ahmad Fausan, S.Pd', studentCount: 5 },
  { id: 'cls-2', name: 'X MIPA 2', gradeLevel: 'X', teacherId: 'tch-4', teacherName: 'Ustadzah Nurul Hidayah, S.Si', studentCount: 4 },
  { id: 'cls-3', name: 'XI MIPA 1', gradeLevel: 'XI', teacherId: 'tch-2', teacherName: 'Ustadzah Siti Nurhaliza, M.Pd', studentCount: 4 },
  { id: 'cls-4', name: 'XI IPS 1', gradeLevel: 'XI', teacherId: 'tch-5', teacherName: 'Ust. Bambang Kurniawan, S.E', studentCount: 3 },
  { id: 'cls-5', name: 'XII MIPA 1', gradeLevel: 'XII', teacherId: 'tch-3', teacherName: 'Ust. Muhammad Ridwan, S.Ag', studentCount: 4 },
];

export const INITIAL_TEACHERS: Teacher[] = [
  { id: 'tch-1', nip: '198504122010011002', name: 'Ust. Ahmad Fausan, S.Pd', gender: 'L', username: 'ahmad', password: 'guru123', subject: 'Matematika', assignedClassId: 'cls-1', assignedClassName: 'X MIPA 1', role: 'guru' },
  { id: 'tch-2', nip: '199008232015022001', name: 'Ustadzah Siti Nurhaliza, M.Pd', gender: 'P', username: 'siti', password: 'guru123', subject: 'Fisika', assignedClassId: 'cls-3', assignedClassName: 'XI MIPA 1', role: 'guru' },
  { id: 'tch-3', nip: '198811052012011003', name: 'Ust. Muhammad Ridwan, S.Ag', gender: 'L', username: 'ridwan', password: 'guru123', subject: 'Pendidikan Agama Islam', assignedClassId: 'cls-5', assignedClassName: 'XII MIPA 1', role: 'guru' },
  { id: 'tch-4', nip: '199203152018022004', name: 'Ustadzah Nurul Hidayah, S.Si', gender: 'P', username: 'nurul', password: 'guru123', subject: 'Biologi', assignedClassId: 'cls-2', assignedClassName: 'X MIPA 2', role: 'guru' },
  { id: 'tch-5', nip: '198307202009011005', name: 'Ust. Bambang Kurniawan, S.E', gender: 'L', username: 'bambang', password: 'guru123', subject: 'Ekonomi', assignedClassId: 'cls-4', assignedClassName: 'XI IPS 1', role: 'guru' },
  { id: 'tch-bk', nip: '199105152016022005', name: 'Ibu Rahmawati, S.Psi', gender: 'P', username: 'rahma', password: 'bk123', subject: 'Bimbingan Konseling (BK)', role: 'bk' },
];

export const INITIAL_BK_NOTES: BKNote[] = [
  {
    id: 'bk-1',
    studentId: 'std-5',
    studentName: 'Bilal Ramadhan',
    nisn: '0061234505',
    className: 'X MIPA 1',
    date: '2026-08-03',
    time: '09:30',
    counselorName: 'Ibu Rahmawati, S.Psi (Guru BK)',
    category: 'Konseling Individual',
    statusResiko: 'Sedang',
    note: 'Siswa sering alpa di hari Senin. Dilakukan pemanggilan individual untuk klarifikasi alasan ketidakhadiran.',
    actionTaken: 'Siswa berjanji meningkatkan kedisiplinan dan menandatangani komitmen hadir tepat waktu.',
    spLevel: 'Tanpa SP',
    followUpDate: '2026-08-10'
  },
  {
    id: 'bk-2',
    studentId: 'std-9',
    studentName: 'Rizky Al-Fatih',
    nisn: '0061234509',
    className: 'X MIPA 2',
    date: '2026-08-04',
    time: '10:15',
    counselorName: 'Ibu Rahmawati, S.Psi (Guru BK)',
    category: 'Pemanggilan Orang Tua',
    statusResiko: 'Tinggi (Kritis)',
    note: 'Akumulasi Alpa mencapai 3 hari berturut-turut. Perlu penanganan intensif bersama orang tua.',
    actionTaken: 'Menerbitkan Surat Pemanggilan Orang Tua ke sekolah pada hari Jumat jam 09:00 WIB.',
    spLevel: 'SP-1',
    followUpDate: '2026-08-07'
  }
];

export const INITIAL_STUDENTS: Student[] = [
  { id: 'std-1', nisn: '0061234501', name: 'Muhammad Farhan', gender: 'L', classId: 'cls-1', className: 'X MIPA 1', parentName: 'H. Abdullah', parentPhone: '081234567890', defaultPassword: '123' },
  { id: 'std-2', nisn: '0061234502', name: 'Aisyah Az-Zahra', gender: 'P', classId: 'cls-1', className: 'X MIPA 1', parentName: 'Hj. Mariam', parentPhone: '081234567891', defaultPassword: '123' },
  { id: 'std-3', nisn: '0061234503', name: 'Ahmad Zaki Mubarak', gender: 'L', classId: 'cls-1', className: 'X MIPA 1', parentName: 'Drs. Sulaiman', parentPhone: '081234567892', defaultPassword: '123' },
  { id: 'std-4', nisn: '0061234504', name: 'Nur Fatimah Syahira', gender: 'P', classId: 'cls-1', className: 'X MIPA 1', parentName: 'Ustadz Usman', parentPhone: '081234567893', defaultPassword: '123' },
  { id: 'std-5', nisn: '0061234505', name: 'Bilal Ramadhan', gender: 'L', classId: 'cls-1', className: 'X MIPA 1', parentName: 'H. Mubarok', parentPhone: '081234567894', defaultPassword: '123' },
  
  { id: 'std-6', nisn: '0061234506', name: 'Dewi Rahmawati', gender: 'P', classId: 'cls-2', className: 'X MIPA 2', parentName: 'Syamsul Bahri', parentPhone: '081234567895', defaultPassword: '123' },
  { id: 'std-7', nisn: '0061234507', name: 'Fikri Haikal', gender: 'L', classId: 'cls-2', className: 'X MIPA 2', parentName: 'H. Hasanudin', parentPhone: '081234567896', defaultPassword: '123' },
  { id: 'std-8', nisn: '0061234508', name: 'Khadijah Nabilah', gender: 'P', classId: 'cls-2', className: 'X MIPA 2', parentName: 'Ir. Iskandar', parentPhone: '081234567897', defaultPassword: '123' },
  { id: 'std-9', nisn: '0061234509', name: 'Rizky Al-Fatih', gender: 'L', classId: 'cls-2', className: 'X MIPA 2', parentName: 'H. Subhan', parentPhone: '081234567898', defaultPassword: '123' },

  { id: 'std-10', nisn: '0061234510', name: 'Zahra Humaira', gender: 'P', classId: 'cls-3', className: 'XI MIPA 1', parentName: 'H. Faisal', parentPhone: '081234567899', defaultPassword: '123' },
  { id: 'std-11', nisn: '0061234511', name: 'Omar Al-Mukhtar', gender: 'L', classId: 'cls-3', className: 'XI MIPA 1', parentName: 'Dr. Mukhtar', parentPhone: '081234567800', defaultPassword: '123' },
  { id: 'std-12', nisn: '0061234512', name: 'Salma Salsabila', gender: 'P', classId: 'cls-3', className: 'XI MIPA 1', parentName: 'H. Thohir', parentPhone: '081234567801', defaultPassword: '123' },
  { id: 'std-13', nisn: '0061234513', name: 'Rayhan Putra', gender: 'L', classId: 'cls-3', className: 'XI MIPA 1', parentName: 'H. Mulyadi', parentPhone: '081234567802', defaultPassword: '123' },

  { id: 'std-14', nisn: '0061234514', name: 'Yusuf Habibi', gender: 'L', classId: 'cls-5', className: 'XII MIPA 1', parentName: 'H. Syarifuddin', parentPhone: '081234567803', defaultPassword: '123' },
  { id: 'std-15', nisn: '0061234515', name: 'Maryam Qonita', gender: 'P', classId: 'cls-5', className: 'XII MIPA 1', parentName: 'H. Zainal', parentPhone: '081234567804', defaultPassword: '123' },
];

// Generate past 30 days of historical attendance for realistic graph visualization
export function generateInitialAttendance(): AttendanceRecord[] {
  const records: AttendanceRecord[] = [];
  const today = new Date();
  
  // Historical data for past 30 working days
  for (let i = 30; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    // skip weekends
    if (d.getDay() === 0 || d.getDay() === 6) continue;

    const dateStr = d.toISOString().split('T')[0];

    INITIAL_STUDENTS.forEach((student, idx) => {
      // Determine status pseudo-randomly for consistency
      let status: AttendanceStatus = 'Hadir';
      let time = '07:05:12';
      let notes = '';

      const seed = (idx + 1) * 37 + i * 13;
      if (i === 0) {
        // Today's attendance
        if (idx === 0) { status = 'Hadir'; time = '07:04:15'; }
        else if (idx === 1) { status = 'Hadir'; time = '07:11:30'; }
        else if (idx === 2) { status = 'Izin'; time = '-'; notes = 'Acara Keluarga'; }
        else if (idx === 3) { status = 'Sakit'; time = '-'; notes = 'Demam dan flu'; }
        else if (idx === 4) { status = 'Hadir'; time = '06:58:45'; }
        else if (seed % 9 === 0) { status = 'Alpa'; time = '-'; notes = 'Tanpa keterangan'; }
        else if (seed % 7 === 0) { status = 'Sakit'; time = '-'; notes = 'Surat Dokter'; }
        else { status = 'Hadir'; time = `07:0${(idx % 8) + 1}:22`; }
      } else {
        if (seed % 17 === 0) { status = 'Sakit'; time = '-'; notes = 'Demam'; }
        else if (seed % 23 === 0) { status = 'Izin'; time = '-'; notes = 'Keperluan Keluarga'; }
        else if (seed % 29 === 0) { status = 'Alpa'; time = '-'; notes = 'Tanpa Keterangan'; }
        else {
          status = 'Hadir';
          const minute = 5 + (idx % 12);
          const second = 10 + (idx % 45);
          time = `07:${minute < 10 ? '0' + minute : minute}:${second < 10 ? '0' + second : second}`;
        }
      }

      records.push({
        id: `att-${dateStr}-${student.nisn}`,
        studentId: student.id,
        nisn: student.nisn,
        studentName: student.name,
        classId: student.classId,
        className: student.className,
        date: dateStr,
        time: status === 'Hadir' ? time : '-',
        status,
        notes,
        recordedBy: 'Sistem QR Code (Piket)',
        recordedByRole: 'admin'
      });
    });
  }

  return records;
}
