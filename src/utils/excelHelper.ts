import * as XLSX from 'xlsx';
import { AttendanceRecord, Student, Teacher } from '../types';

export const exportMonthlyRecapToExcel = (
  monthlyData: Array<{
    no: number;
    nisn: string;
    studentName: string;
    className: string;
    dayStatuses: Record<number, string>;
    countH: number;
    countS: number;
    countI: number;
    countA: number;
    percentage: number;
  }>,
  totalDays: number,
  monthName: string,
  year: string,
  classNameFilter: string = 'Semua_Kelas'
) => {
  // Title row matching application layout
  const titleText = `REKAPITULASI KEHADIRAN SISWA KELAS ${classNameFilter.toUpperCase()} BULAN ${monthName.toUpperCase()} TAHUN ${year}`;
  const subtitleText = `SMA Islam Raiyatul Husnan`;

  // Construct day column headers (1..N)
  const dayHeaders: string[] = [];
  for (let d = 1; d <= totalDays; d++) {
    dayHeaders.push(String(d));
  }

  // Header row
  const headerRow = [
    'No',
    'NISN',
    'Nama Siswa',
    ...dayHeaders,
    'H',
    'S',
    'I',
    'A',
    'Kehadiran (%)'
  ];

  // Data rows
  const rows: any[][] = [
    [titleText],
    [subtitleText],
    [], // Blank separator row
    headerRow
  ];

  monthlyData.forEach((row) => {
    const dayCodes: string[] = [];
    for (let d = 1; d <= totalDays; d++) {
      const st = row.dayStatuses[d];
      let code = '-';
      if (st === 'Hadir') code = 'H';
      else if (st === 'Sakit') code = 'S';
      else if (st === 'Izin') code = 'I';
      else if (st === 'Alpa') code = 'A';
      dayCodes.push(code);
    }

    rows.push([
      row.no,
      row.nisn,
      row.studentName,
      ...dayCodes,
      row.countH,
      row.countS,
      row.countI,
      row.countA,
      `${row.percentage}%`
    ]);
  });

  const worksheet = XLSX.utils.aoa_to_sheet(rows);

  // Column widths
  const cols: Array<{ wch: number }> = [
    { wch: 6 },  // No
    { wch: 15 }, // NISN
    { wch: 28 }, // Nama Siswa
  ];
  for (let d = 1; d <= totalDays; d++) {
    cols.push({ wch: 4 });
  }
  cols.push({ wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 15 });

  worksheet['!cols'] = cols;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, `Rekap ${monthName} ${year}`);

  const fullFileName = `Rekap_Bulanan_${monthName}_${year}_${classNameFilter.replace(/\s+/g, '_')}.xlsx`;

  XLSX.writeFile(workbook, fullFileName);
};

export const exportAttendanceToExcel = (
  records: AttendanceRecord[],
  filenamePrefix: string = 'Rekap_Absensi_SMA_Islam_Raiyatul_Husnan',
  classNameFilter: string = 'Semua_Kelas'
) => {
  const dataToExport = records.map((rec, idx) => ({
    'No': idx + 1,
    'Tanggal': rec.date,
    'NISN': rec.nisn,
    'Nama Siswa': rec.studentName,
    'Kelas': rec.className,
    'Jam Masuk': rec.time,
    'Status Masuk': rec.status,
    'Jam Pulang': rec.checkOutTime || '-',
    'Status Pulang': rec.checkOutStatus || '-',
    'Guru Jam Terakhir': rec.checkOutBy || '-',
    'Catatan Khusus': rec.notes || '-',
    'Dicatat Oleh': rec.recordedBy
  }));

  const worksheet = XLSX.utils.json_to_sheet(dataToExport);

  // Set custom column widths
  worksheet['!cols'] = [
    { wch: 5 },  // No
    { wch: 12 }, // Tanggal
    { wch: 15 }, // NISN
    { wch: 26 }, // Nama Siswa
    { wch: 14 }, // Kelas
    { wch: 12 }, // Jam Masuk
    { wch: 14 }, // Status Masuk
    { wch: 12 }, // Jam Pulang
    { wch: 22 }, // Status Pulang
    { wch: 22 }, // Guru Jam Terakhir
    { wch: 25 }, // Catatan Khusus
    { wch: 20 }  // Dicatat Oleh
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Rekap Absensi');

  const formattedDate = new Date().toISOString().split('T')[0];
  const fullFileName = `${filenamePrefix}_${classNameFilter.replace(/\s+/g, '_')}_${formattedDate}.xlsx`;

  XLSX.writeFile(workbook, fullFileName);
};

export const downloadStudentTemplate = () => {
  const templateData = [
    {
      'NISN': '0061234599',
      'Nama Siswa': 'Contoh Siswa Baru',
      'Jenis Kelamin (L/P)': 'L',
      'Nama Kelas': 'X MIPA 1',
      'Nama Wali Murid': 'H. Ahmad',
      'No HP Wali': '081234567899'
    },
    {
      'NISN': '0061234598',
      'Nama Siswa': 'Contoh Siswi Baru',
      'Jenis Kelamin (L/P)': 'P',
      'Nama Kelas': 'XI MIPA 1',
      'Nama Wali Murid': 'Hj. Fatimah',
      'No HP Wali': '081234567898'
    }
  ];

  const worksheet = XLSX.utils.json_to_sheet(templateData);
  worksheet['!cols'] = [
    { wch: 15 },
    { wch: 25 },
    { wch: 20 },
    { wch: 15 },
    { wch: 22 },
    { wch: 16 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Template Siswa');
  XLSX.writeFile(workbook, 'Template_Import_Siswa_SMA_Islam_Raiyatul_Husnan.xlsx');
};

export const downloadTeacherTemplate = () => {
  const templateData = [
    {
      'NIP': '199501012022011001',
      'Nama Guru': 'Ust. Hasan Basri, S.Pd',
      'Jenis Kelamin (L/P)': 'L',
      'Username Login': 'hasan',
      'Mata Pelajaran': 'Bahasa Arab'
    }
  ];

  const worksheet = XLSX.utils.json_to_sheet(templateData);
  worksheet['!cols'] = [
    { wch: 20 },
    { wch: 26 },
    { wch: 20 },
    { wch: 18 },
    { wch: 22 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Template Guru');
  XLSX.writeFile(workbook, 'Template_Import_Guru_SMA_Islam_Raiyatul_Husnan.xlsx');
};

export const parseExcelFile = (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);
        resolve(json);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
};
