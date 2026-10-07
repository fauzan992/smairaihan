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
  classNameFilter: string = 'Semua_Kelas',
  holidaysMap?: Record<number, { isHoliday: boolean; name: string }>
) => {
  // Title row matching application layout
  const titleText = `REKAPITULASI KEHADIRAN SISWA KELAS ${classNameFilter.toUpperCase()} BULAN ${monthName.toUpperCase()} TAHUN ${year}`;
  const subtitleText = `SMA Islam Raiyatul Husnan`;

  // Construct day column headers (1..N)
  const dayHeaders: string[] = [];
  for (let d = 1; d <= totalDays; d++) {
    const hol = holidaysMap?.[d];
    if (hol?.isHoliday) {
      dayHeaders.push(`${d} (L)`);
    } else {
      dayHeaders.push(String(d));
    }
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
      const hol = holidaysMap?.[d];
      let code = '-';
      if (st === 'Hadir') code = 'H';
      else if (st === 'Sakit') code = 'S';
      else if (st === 'Izin') code = 'I';
      else if (st === 'Alpa') code = 'A';
      else if (hol?.isHoliday) code = 'L';
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

  // Add holiday legends if any
  if (holidaysMap) {
    const holidayList = Object.entries(holidaysMap)
      .filter(([_, val]) => val.isHoliday)
      .map(([day, val]) => `Tgl ${day} ${monthName}: ${val.name}`);
    if (holidayList.length > 0) {
      rows.push([]);
      rows.push(['Keterangan Hari Libur:']);
      holidayList.forEach(item => {
        rows.push([`• ${item}`]);
      });
    }
  }

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
      'No': 1,
      'NISN': '0061234599',
      'Nama Lengkap Siswa': 'Ahmad Fauzi Ridwan',
      'Kelas / Rombel': 'X MIPA 1',
      'Jenis Kelamin': 'Laki-laki (L)',
      'Tanggal Lahir': '2007-05-14',
      'Nama Orang Tua / Wali': 'H. Ridwan Mansyur',
      'No WhatsApp Wali': '081234567890',
      'Alamat Tempat Tinggal': 'Jl. Raya Besuki No. 12',
      'Tahun Ajaran': '2024/2025'
    },
    {
      'No': 2,
      'NISN': '0061234598',
      'Nama Lengkap Siswa': 'Siti Nurhaliza',
      'Kelas / Rombel': 'X MIPA 1',
      'Jenis Kelamin': 'Perempuan (P)',
      'Tanggal Lahir': '2007-09-22',
      'Nama Orang Tua / Wali': 'Hj. Fatimah Zahra',
      'No WhatsApp Wali': '081298765432',
      'Alamat Tempat Tinggal': 'Dsn. Krajan RT 02 RW 01',
      'Tahun Ajaran': '2024/2025'
    }
  ];

  const worksheet = XLSX.utils.json_to_sheet(templateData);
  worksheet['!cols'] = [
    { wch: 6 },  // No
    { wch: 18 }, // NISN
    { wch: 30 }, // Nama Lengkap Siswa
    { wch: 16 }, // Kelas / Rombel
    { wch: 18 }, // Jenis Kelamin
    { wch: 16 }, // Tanggal Lahir
    { wch: 28 }, // Nama Orang Tua / Wali
    { wch: 20 }, // No WhatsApp Wali
    { wch: 36 }, // Alamat Tempat Tinggal
    { wch: 16 }  // Tahun Ajaran
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Siswa Backup');
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
        const workbook = XLSX.read(data, { type: 'array', cellDates: false });

        const headerKeywords = [
          'nisn', 'nis', 'no induk', 'nomor induk', 'nama', 'nama siswa',
          'nama lengkap', 'peserta didik', 'nip', 'nama guru', 'username'
        ];

        const nonGuideSheets = workbook.SheetNames.filter(sName => {
          const lower = sName.toLowerCase();
          return !lower.includes('petunjuk') && !lower.includes('panduan') && !lower.includes('instruksi');
        });
        const sheetsToCheck = nonGuideSheets.length > 0 ? nonGuideSheets : workbook.SheetNames;

        // If there is a dedicated backup sheet like 'Data Siswa Backup' or 'Template Siswa', prioritize it;
        // otherwise parse all valid sheets in the workbook so multi-sheet class files work seamlessly.
        const primaryBackupSheet = sheetsToCheck.find(sName => {
          const lower = sName.toLowerCase();
          return lower === 'data siswa backup' || lower === 'template siswa' || lower === 'master siswa' || lower === 'template guru';
        });
        const targetSheets = primaryBackupSheet ? [primaryBackupSheet] : sheetsToCheck;

        const allParsedRows: any[] = [];

        for (const sName of targetSheets) {
          const worksheet = workbook.Sheets[sName];
          if (!worksheet) continue;

          const rows2D: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' });
          if (!rows2D || rows2D.length === 0) continue;

          let headerRowIdx = -1;
          let inferredClassFromTitle = '';

          // Scan first 20 rows for title class info & the actual table header row
          const scanLimit = Math.min(20, rows2D.length);
          for (let r = 0; r < scanLimit; r++) {
            const rowCells = (rows2D[r] || []).map(c => String(c ?? '').trim());
            const nonEmptyCells = rowCells.filter(Boolean);
            if (nonEmptyCells.length === 0) continue;

            // Check if a title row contains "KELAS X 1" etc.
            if (headerRowIdx === -1) {
              const joinedTitle = nonEmptyCells.join(' ');
              const clsMatch = joinedTitle.match(/kelas\s*[:\-]?\s*((?:XII|XI|X|12|11|10)[\s\-_]*[A-Z0-9\s]*)/i);
              if (clsMatch && clsMatch[1]) {
                inferredClassFromTitle = clsMatch[1].trim().replace(/\s+/g, ' ');
              }
            }

            // Check if this row is the table header row
            if (nonEmptyCells.length >= 2) {
              const hasPrimaryKeyword = rowCells.some(cell => {
                const clean = cell.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
                return headerKeywords.some(kw => clean === kw || clean.startsWith(kw + ' ') || clean.endsWith(' ' + kw));
              });
              if (hasPrimaryKeyword) {
                headerRowIdx = r;
                break;
              }
            }
          }

          // Check if sheet name itself is a class name (e.g. "X 1", "XI MIPA 1", "Kelas X 2")
          let sheetClassHint = inferredClassFromTitle;
          if (!sheetClassHint) {
            const cleanSheet = sName.replace(/^kelas\s*/i, '').trim();
            if (/^(?:XII|XI|X|12|11|10)(?:[\s\-_]+[A-Za-z0-9]+)*$/i.test(cleanSheet)) {
              sheetClassHint = cleanSheet;
            }
          }

          if (headerRowIdx !== -1) {
            const rawHeaders = (rows2D[headerRowIdx] || []).map((h, idx) => {
              const trimmed = String(h ?? '').trim();
              return trimmed || `Col_${idx}`;
            });

            for (let r = headerRowIdx + 1; r < rows2D.length; r++) {
              const rowValues = rows2D[r] || [];
              const nonEmpty = rowValues.filter(v => String(v ?? '').trim() !== '');
              if (nonEmpty.length === 0) continue;

              const obj: Record<string, any> = {};
              rawHeaders.forEach((hKey, cIdx) => {
                obj[hKey] = rowValues[cIdx] !== undefined && rowValues[cIdx] !== null ? String(rowValues[cIdx]).trim() : '';
              });

              if (sheetClassHint) {
                obj._sheetClass = sheetClassHint;
              }
              allParsedRows.push(obj);
            }
          } else if (targetSheets.length === 1) {
            const fallbackJson = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { raw: false, defval: '' });
            fallbackJson.forEach(row => {
              if (sheetClassHint) row._sheetClass = sheetClassHint;
              allParsedRows.push(row);
            });
          }
        }

        resolve(allParsedRows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
};

export const exportKBMRecapToExcel = (params: {
  subjectName: string;
  className: string;
  teacherName: string;
  monthName: string;
  year: string;
  kbmDates: string[]; // List of YYYY-MM-DD when KBM took place
  studentRows: Array<{
    no: number;
    nisn: string;
    studentName: string;
    gender: string;
    sessionStatuses: Record<string, string>; // date -> 'Hadir' | 'Izin' | 'Sakit' | 'Pulang Awal' | 'Bolos' | 'Alpa' | '-'
    countH: number;
    countI: number;
    countS: number;
    countP: number;
    countB: number;
    countA: number;
    percentage: number;
  }>;
  journalEntries?: Array<{
    date: string;
    sessionHour: string;
    topic: string;
    notes?: string;
    assignmentTitle?: string;
  }>;
}) => {
  const { subjectName, className, teacherName, monthName, year, kbmDates, studentRows, journalEntries = [] } = params;

  const workbook = XLSX.utils.book_new();

  // === SHEET 1: REKAP PRESENSI KBM PER MAPEL ===
  const title1 = `REKAPITULASI KEGIATAN BELAJAR MENGAJAR (KBM) & PRESENSI MATA PELAJARAN`;
  const schoolName = `SMA ISLAM RA'IYATUL HUSNAN WRINGIN BONDOWOSO`;
  const metaRow1 = `Mata Pelajaran: ${subjectName} | Kelas: ${className}`;
  const metaRow2 = `Guru Pengampu: ${teacherName} | Periode: ${monthName} ${year} | Total Pertemuan: ${kbmDates.length} Kali`;

  const dateHeaders = kbmDates.map((d, idx) => `P${idx + 1} (${d.slice(8, 10)}/${d.slice(5, 7)})`);

  const headerRow = [
    'No',
    'NISN',
    'Nama Siswa',
    'L/P',
    ...dateHeaders,
    'H (Hadir)',
    'I (Izin)',
    'S (Sakit)',
    'P (Pulang Awal)',
    'B (Bolos)',
    'A (Alpa)',
    '% Keaktifan KBM'
  ];

  const sheet1Rows: any[][] = [
    [schoolName],
    [title1],
    [metaRow1],
    [metaRow2],
    [], // Blank separator
    headerRow
  ];

  studentRows.forEach((row) => {
    const dateCodes = kbmDates.map((dateStr) => {
      const st = row.sessionStatuses[dateStr];
      if (!st || st === '-') return '-';
      if (st === 'Hadir') return 'H';
      if (st === 'Izin') return 'I';
      if (st === 'Sakit') return 'S';
      if (st === 'Pulang Awal') return 'P';
      if (st === 'Bolos') return 'B';
      if (st === 'Alpa') return 'A';
      return st;
    });

    sheet1Rows.push([
      row.no,
      row.nisn,
      row.studentName,
      row.gender,
      ...dateCodes,
      row.countH,
      row.countI,
      row.countS,
      row.countP,
      row.countB,
      row.countA,
      `${row.percentage}%`
    ]);
  });

  // Footer note
  sheet1Rows.push([]);
  sheet1Rows.push(['Keterangan Kode: H = Hadir, I = Izin, S = Sakit, P = Pulang Sebelum Waktunya, B = Bolos Jam KBM, A = Alpa']);
  sheet1Rows.push([`Dicetak pada: ${new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}`]);

  const worksheet1 = XLSX.utils.aoa_to_sheet(sheet1Rows);

  const colWidths1: Array<{ wch: number }> = [
    { wch: 6 },  // No
    { wch: 16 }, // NISN
    { wch: 28 }, // Nama
    { wch: 6 },  // L/P
  ];
  kbmDates.forEach(() => colWidths1.push({ wch: 12 }));
  colWidths1.push({ wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 16 });

  worksheet1['!cols'] = colWidths1;
  XLSX.utils.book_append_sheet(workbook, worksheet1, 'Presensi KBM Mapel');

  // === SHEET 2: AGENDA JURNAL MATERI & TUGAS KBM ===
  if (journalEntries.length > 0) {
    const sheet2Rows: any[][] = [
      [schoolName],
      [`AGENDA JURNAL MENGAJAR & POKOK BAHASAN KBM - ${subjectName.toUpperCase()}`],
      [`Kelas: ${className} | Guru: ${teacherName} | Periode: ${monthName} ${year}`],
      [],
      ['No', 'Tanggal KBM', 'Jam / Sesi', 'Materi / Pokok Bahasan', 'Catatan Kendala / Guru', 'Tugas Diberikan']
    ];

    journalEntries.forEach((jrn, idx) => {
      sheet2Rows.push([
        idx + 1,
        jrn.date,
        jrn.sessionHour || '-',
        jrn.topic || '-',
        jrn.notes || '-',
        jrn.assignmentTitle || '-'
      ]);
    });

    const worksheet2 = XLSX.utils.aoa_to_sheet(sheet2Rows);
    worksheet2['!cols'] = [
      { wch: 6 },  // No
      { wch: 14 }, // Tanggal
      { wch: 22 }, // Sesi
      { wch: 38 }, // Materi
      { wch: 32 }, // Catatan
      { wch: 30 }  // Tugas
    ];
    XLSX.utils.book_append_sheet(workbook, worksheet2, 'Jurnal Mengajar');
  }

  const cleanSubject = subjectName.replace(/\s+/g, '_');
  const cleanClass = className.replace(/\s+/g, '_');
  const fileName = `Rekap_KBM_${cleanSubject}_${cleanClass}_${monthName}_${year}.xlsx`;

  XLSX.writeFile(workbook, fileName);
};
