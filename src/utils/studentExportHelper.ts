import * as XLSX from 'xlsx';
import { Student, Teacher, ClassRoom } from '../types';

export interface ExportStudentExcelOptions {
  students: Student[];
  classes: ClassRoom[];
  teachers?: Teacher[];
  targetClass?: string; // 'all' or class name / id
}

/**
 * Export and Backup Students Data to formatted .xlsx with full metadata
 */
export const exportStudentsToStructuredExcel = ({
  students,
  classes,
  targetClass = 'all',
}: ExportStudentExcelOptions) => {
  const studentsToExport = targetClass === 'all'
    ? students
    : students.filter(s => s.className === targetClass || s.classId === targetClass);

  if (studentsToExport.length === 0) {
    alert('Tidak ada data siswa untuk diexport.');
    return;
  }

  const todayDate = new Date().toISOString().split('T')[0];
  const classNameDisplay = targetClass === 'all' ? 'SEMUA KELAS' : `KELAS ${targetClass.toUpperCase()}`;

  // 1. Prepare Main Sheet Data (Master Siswa)
  const masterStudentRows = studentsToExport.map((s, idx) => {
    return {
      'No': idx + 1,
      'NISN': String(s.nisn).padStart(10, '0'),
      'Nama Lengkap Siswa': s.name,
      'Kelas / Rombel': s.className || '-',
      'Jenis Kelamin': s.gender === 'L' ? 'Laki-laki (L)' : 'Perempuan (P)',
      'Tanggal Lahir': s.birthDate || '-',
      'Nama Orang Tua / Wali': s.parentName || '-',
      'No WhatsApp Wali': s.parentPhone || '-',
      'Alamat Tempat Tinggal': s.address || '-',
      'Tahun Ajaran': s.academicYear || '2024/2025',
      'ID Sistem': s.id
    };
  });

  const worksheetStudents = XLSX.utils.json_to_sheet(masterStudentRows);

  // Column Widths for clean layout
  worksheetStudents['!cols'] = [
    { wch: 6 },  // No
    { wch: 18 }, // NISN
    { wch: 32 }, // Nama Lengkap Siswa
    { wch: 16 }, // Kelas / Rombel
    { wch: 18 }, // Jenis Kelamin
    { wch: 16 }, // Tanggal Lahir
    { wch: 28 }, // Nama Orang Tua / Wali
    { wch: 20 }, // No WhatsApp Wali
    { wch: 38 }, // Alamat Tempat Tinggal
    { wch: 16 }, // Tahun Ajaran
    { wch: 16 }  // ID Sistem
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheetStudents, 'Data Siswa Backup');

  // 2. Summary & Verification Sheet (Info Cadangan)
  const summaryData = [
    { 'Parameter Sekolah & Cadangan': 'Nama Satuan Pendidikan', 'Keterangan / Detail': "SMA Islam Ra'iyatul Husnan" },
    { 'Parameter Sekolah & Cadangan': 'Kategori Berkas', 'Keterangan / Detail': 'Salinan Master Data Siswa Resmi (.xlsx)' },
    { 'Parameter Sekolah & Cadangan': 'Waktu & Tanggal Unduh', 'Keterangan / Detail': `${new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })} - ${new Date().toLocaleTimeString('id-ID')} WIB` },
    { 'Parameter Sekolah & Cadangan': 'Cakupan Rombel / Kelas', 'Keterangan / Detail': classNameDisplay },
    { 'Parameter Sekolah & Cadangan': 'Total Siswa Diexport', 'Keterangan / Detail': `${studentsToExport.length} Siswa` },
    { 'Parameter Sekolah & Cadangan': 'Siswa Laki-laki (L)', 'Keterangan / Detail': `${studentsToExport.filter(s => s.gender === 'L').length} Siswa` },
    { 'Parameter Sekolah & Cadangan': 'Siswa Perempuan (P)', 'Keterangan / Detail': `${studentsToExport.filter(s => s.gender === 'P').length} Siswa` },
    { 'Parameter Sekolah & Cadangan': 'Kelengkapan Tanggal Lahir', 'Keterangan / Detail': `${studentsToExport.filter(s => s.birthDate).length} dari ${studentsToExport.length} Siswa` },
    { 'Parameter Sekolah & Cadangan': 'Kontak WhatsApp Wali Terdata', 'Keterangan / Detail': `${studentsToExport.filter(s => s.parentPhone && s.parentPhone !== '-').length} Siswa` },
    { 'Parameter Sekolah & Cadangan': 'Sistem Aplikasi Sumber', 'Keterangan / Detail': 'Presensi Digital QR Code NISN' }
  ];

  const worksheetSummary = XLSX.utils.json_to_sheet(summaryData);
  worksheetSummary['!cols'] = [{ wch: 32 }, { wch: 48 }];
  XLSX.utils.book_append_sheet(workbook, worksheetSummary, 'Info Cadangan');

  // 3. Class breakdown sheet if target is all
  if (targetClass === 'all' && classes.length > 0) {
    const classStats = classes.map((c, idx) => {
      const clsStudents = students.filter(s => s.className === c.name || s.classId === c.id);
      return {
        'No': idx + 1,
        'Nama Rombel': c.name,
        'Tingkat': c.gradeLevel,
        'Total Siswa': clsStudents.length,
        'Laki-laki (L)': clsStudents.filter(s => s.gender === 'L').length,
        'Perempuan (P)': clsStudents.filter(s => s.gender === 'P').length
      };
    });

    const worksheetClasses = XLSX.utils.json_to_sheet(classStats);
    worksheetClasses['!cols'] = [
      { wch: 6 },
      { wch: 18 },
      { wch: 12 },
      { wch: 14 },
      { wch: 15 },
      { wch: 15 }
    ];
    XLSX.utils.book_append_sheet(workbook, worksheetClasses, 'Rekap per Rombel');
  }

  const cleanClassName = targetClass === 'all' ? 'SEMUA_KELAS' : targetClass.replace(/\s+/g, '_');
  const fileName = `BACKUP_DATA_SISWA_SMA_RAIYATUL_HUSNAN_${cleanClassName}_${todayDate}.xlsx`;
  XLSX.writeFile(workbook, fileName);
};
