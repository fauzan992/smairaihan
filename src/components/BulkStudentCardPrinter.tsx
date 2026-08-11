import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Student, ClassRoom, SchoolSettings } from '../types';
import { Printer, CheckSquare, Square, Filter, Search, Settings, CreditCard, X, QrCode } from 'lucide-react';
import { SchoolLogo } from './SchoolLogo';
import { apiService } from '../services/apiService';

interface BulkStudentCardPrinterProps {
  students: Student[];
  classes: ClassRoom[];
  onClose: () => void;
  initialSelectedIds?: string[];
}

export const BulkStudentCardPrinter: React.FC<BulkStudentCardPrinterProps> = ({
  students,
  classes,
  onClose,
  initialSelectedIds
}) => {
  // Filter states
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>(() => {
    if (initialSelectedIds && initialSelectedIds.length > 0) {
      return initialSelectedIds;
    }
    return students.map(s => s.id);
  });

  // Card Design Config
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings | null>(null);
  const [schoolName, setSchoolName] = useState('SMA ISLAM RA\'IYATUL HUSNAN');
  const [academicYear, setAcademicYear] = useState('2025/2026');
  const [showCutLines, setShowCutLines] = useState<boolean>(true);

  useEffect(() => {
    apiService.getSettings().then(res => {
      if (res.success && res.settings) {
        setSchoolSettings(res.settings);
        if (res.settings.namaSekolah) {
          setSchoolName(res.settings.namaSekolah);
        }
      }
    });

    const handleSettingsEvent = (e: Event) => {
      const customEvent = e as CustomEvent<SchoolSettings>;
      if (customEvent.detail) {
        setSchoolSettings(customEvent.detail);
        if (customEvent.detail.namaSekolah) {
          setSchoolName(customEvent.detail.namaSekolah);
        }
      }
    };

    window.addEventListener('school-settings-updated', handleSettingsEvent);
    return () => {
      window.removeEventListener('school-settings-updated', handleSettingsEvent);
    };
  }, []);

  // Filter students list based on criteria
  const filteredStudents = students.filter(s => {
    const matchClass = selectedClassId === 'all' || s.classId === selectedClassId;
    const matchSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        s.nisn.includes(searchQuery) ||
                        s.className.toLowerCase().includes(searchQuery.toLowerCase());
    return matchClass && matchSearch;
  }).sort((a, b) => a.name.localeCompare(b.name, 'id', { sensitivity: 'base' }));

  // Get array of selected Student objects
  const selectedStudents = students.filter(s => selectedStudentIds.includes(s.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'id', { sensitivity: 'base' }));

  // Toggle selection
  const handleToggleSelectAll = () => {
    const filteredIds = filteredStudents.map(s => s.id);
    const allFilteredSelected = filteredIds.every(id => selectedStudentIds.includes(id));

    if (allFilteredSelected) {
      setSelectedStudentIds(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      const newIds = Array.from(new Set([...selectedStudentIds, ...filteredIds]));
      setSelectedStudentIds(newIds);
    }
  };

  const handleToggleStudent = (id: string) => {
    setSelectedStudentIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Robust Print / Save PDF Handler
  const handlePrint = () => {
    const printArea = document.getElementById('printable-card-area');
    if (!printArea) {
      window.print();
      return;
    }

    // Attempt opening dedicated print window
    const printWindow = window.open('', '_blank', 'width=900,height=800');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Kartu Pelajar - ${schoolName}</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
              @page {
                size: A4 portrait;
                margin: 10mm;
              }
              body {
                background: #ffffff !important;
                color: #000000 !important;
                font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                margin: 0;
                padding: 10px;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .no-print {
                display: flex;
              }
              @media print {
                .no-print {
                  display: none !important;
                }
              }
            </style>
          </head>
          <body>
            <div class="no-print bg-slate-100 p-4 mb-6 rounded-2xl flex items-center justify-between border border-slate-300 shadow-sm">
              <div>
                <h3 class="font-bold text-slate-800 text-sm">Dokumen Kartu Pelajar siap dicetak (${selectedStudents.length} Kartu)</h3>
                <p class="text-xs text-slate-500">Gunakan opsi "Save as PDF" di menu cetak untuk menyimpan file PDF.</p>
              </div>
              <button onclick="window.print()" class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow cursor-pointer">
                🖨️ Cetak / Simpan PDF Now
              </button>
            </div>
            ${printArea.innerHTML}
            <script>
              setTimeout(() => {
                window.print();
              }, 400);
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } else {
      // Fallback direct window print
      window.print();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex flex-col overflow-hidden text-slate-800">
      {/* Global Print Styles for fallback direct print */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-card-area, #printable-card-area * {
            visibility: visible !important;
          }
          #printable-card-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 5mm !important;
            background: white !important;
          }
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
        }
      `}</style>

      {/* Top Header Controls Bar (NO-PRINT) */}
      <div className="no-print bg-slate-900 border-b border-slate-800 px-6 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shrink-0 shadow-lg text-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-600/30 border border-emerald-500/50 flex items-center justify-center text-emerald-400 shrink-0">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-white">Cetak Kartu Tanda Pelajar Masal (QR Code)</h2>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] px-2.5 py-0.5 rounded-full font-bold">
                {selectedStudents.length} Kartu Terpilih
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Kartu memuat Nama Siswa, Kelas, NISN, dan QR Code untuk Absensi Digital.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto">
          <button
            onClick={handlePrint}
            disabled={selectedStudents.length === 0}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold shadow-lg transition-all flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <Printer className="w-4 h-4" />
            Cetak / Simpan PDF ({selectedStudents.length})
          </button>

          <button
            onClick={onClose}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
            title="Tutup Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Control Panel (NO-PRINT) */}
        <div className="no-print w-full md:w-80 lg:w-96 bg-white border-r border-slate-200 flex flex-col overflow-y-auto shrink-0 space-y-6 p-5">
          {/* Card Customization Config */}
          <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Settings className="w-4 h-4 text-emerald-600" />
              Pengaturan Tampilan Kartu
            </h3>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Nama Sekolah</label>
              <input
                type="text"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Tahun Ajaran</label>
              <input
                type="text"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="cutlines"
                checked={showCutLines}
                onChange={(e) => setShowCutLines(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
              />
              <label htmlFor="cutlines" className="text-xs font-bold text-slate-700 cursor-pointer">
                Tampilkan Garis Potong Kartu
              </label>
            </div>
          </div>

          {/* Student Selection Filter */}
          <div className="space-y-3 flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Filter className="w-4 h-4 text-emerald-600" />
                Pilih Siswa ({selectedStudents.length}/{students.length})
              </h3>
              <button
                onClick={handleToggleSelectAll}
                className="text-[11px] font-bold text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer"
              >
                {filteredStudents.length > 0 && filteredStudents.every(s => selectedStudentIds.includes(s.id)) ? (
                  <>
                    <CheckSquare className="w-3.5 h-3.5 text-emerald-600" /> Unselect All
                  </>
                ) : (
                  <>
                    <Square className="w-3.5 h-3.5" /> Select All
                  </>
                )}
              </button>
            </div>

            {/* Filter controls */}
            <div className="space-y-2">
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
              >
                <option value="all">Semua Kelas ({students.length} Siswa)</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>
                    Kelas {c.name} ({students.filter(s => s.classId === c.id).length} Siswa)
                  </option>
                ))}
              </select>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Cari nama atau NISN..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                />
              </div>
            </div>

            {/* Scrollable Student List */}
            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-2xl p-2 bg-slate-50/50 space-y-1 min-h-[160px]">
              {filteredStudents.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">Tidak ada siswa ditemukan</div>
              ) : (
                filteredStudents.map((st, idx) => {
                  const isSelected = selectedStudentIds.includes(st.id);
                  return (
                    <div
                      key={`list-st-${st.id}-${idx}`}
                      onClick={() => handleToggleStudent(st.id)}
                      className={`p-2 rounded-xl text-xs flex items-center justify-between cursor-pointer transition-all border ${
                        isSelected
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}} // handled by parent onClick
                          className="w-4 h-4 text-emerald-600 rounded border-slate-300 cursor-pointer"
                        />
                        <div className="truncate">
                          <p className="truncate font-bold leading-tight">{st.name}</p>
                          <p className="text-[10px] text-slate-500 font-mono">NISN: {st.nisn} • {st.className}</p>
                        </div>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-extrabold uppercase shrink-0">
                        {st.gender}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Live Print Preview Panel */}
        <div className="flex-1 bg-slate-200 overflow-y-auto p-4 md:p-8 flex justify-center">
          <div className="max-w-[210mm] w-full bg-white shadow-2xl rounded-2xl p-6 md:p-8 space-y-6 min-h-[297mm]">
            {/* Header info in preview (NO-PRINT) */}
            <div className="no-print border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="font-extrabold text-slate-800">Pratinjau Halaman Cetak (Format A4)</span>
              </div>
              <p>
                Menampilkan <strong className="text-emerald-700">{selectedStudents.length}</strong> dari {students.length} kartu pelajar
              </p>
            </div>

            {selectedStudents.length === 0 ? (
              <div className="py-20 text-center space-y-3">
                <CreditCard className="w-12 h-12 text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-slate-600">Belum Ada Siswa Terpilih</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Silakan centang siswa di panel sebelah kiri untuk menampilkan kartu pelajar yang siap dicetak.
                </p>
              </div>
            ) : (
              /* Printable Cards Container */
              <div id="printable-card-area">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {selectedStudents.map((student, idx) => (
                    <div
                      key={`card-${student.id}-${idx}`}
                      className={`relative bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-950 text-white rounded-2xl p-4 shadow-md overflow-hidden border ${
                        showCutLines ? 'border-dashed border-slate-400' : 'border-emerald-700/50'
                      } flex flex-col justify-between`}
                      style={{ width: '100%', minHeight: '195px', aspectRatio: '85.6/53.98' }}
                    >
                      {/* Background Accents */}
                      <div className="absolute -right-12 -bottom-12 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>
                      <div className="absolute -left-12 -top-12 w-32 h-32 bg-amber-400/10 rounded-full blur-xl pointer-events-none"></div>

                      {/* Header Section */}
                      <div className="flex items-center justify-between border-b border-emerald-500/40 pb-2 relative z-10">
                        <div className="flex items-center gap-2 min-w-0">
                          <SchoolLogo size={32} logoUrl={schoolSettings?.logoUrl} />
                          <div className="min-w-0 flex-1">
                            <h4 className="font-black text-[11px] leading-tight tracking-wide text-amber-300 uppercase truncate">
                              {schoolName}
                            </h4>
                            <p className="text-[8.5px] text-emerald-200/90 font-medium tracking-wide">
                              KARTU TANDA PELAJAR
                            </p>
                          </div>
                        </div>
                        <span className="text-[8px] bg-amber-400/20 text-amber-300 font-mono font-bold px-2 py-0.5 rounded border border-amber-300/30 shrink-0">
                          TA {academicYear}
                        </span>
                      </div>

                      {/* Main Card Content: Photo 3x4, Nama, Kelas, NISN, and QR Code */}
                      <div className="flex items-center gap-3 my-2 relative z-10">
                        {/* 3x4 Photo Container */}
                        <div className="w-12 h-16 bg-emerald-950 border border-amber-300/50 rounded-lg overflow-hidden shrink-0 flex items-center justify-center shadow-xs">
                          {student.photoUrl ? (
                            <img
                              src={student.photoUrl}
                              alt={student.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="text-center text-emerald-300/60 p-1 flex flex-col items-center">
                              <QrCode className="w-5 h-5 mb-0.5" />
                              <span className="text-[7px] font-bold">3x4</span>
                            </div>
                          )}
                        </div>

                        <div className="flex-1 space-y-1 text-[10px] min-w-0">
                          <div>
                            <span className="text-[7.5px] text-emerald-300/80 uppercase font-bold tracking-wider block">
                              NAMA SISWA
                            </span>
                            <span className="font-black text-white text-[11px] leading-tight block truncate">
                              {student.name}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-emerald-500/20">
                            <div>
                              <span className="text-[7.5px] text-emerald-300/80 uppercase font-bold tracking-wider block">
                                KELAS
                              </span>
                              <span className="font-bold text-amber-200 text-[10px]">
                                {student.className}
                              </span>
                            </div>

                            <div>
                              <span className="text-[7.5px] text-emerald-300/80 uppercase font-bold tracking-wider block">
                                NISN
                              </span>
                              <span className="font-mono font-black text-white text-[10px]">
                                {student.nisn}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* QR Code Container */}
                        <div className="bg-white p-1.5 rounded-xl shadow-md border border-amber-300/40 shrink-0 flex flex-col items-center justify-center">
                          <QRCodeSVG
                            value={student.nisn}
                            size={58}
                            level="M"
                            marginSize={1}
                          />
                          <span className="text-[7px] font-mono font-bold text-slate-700 mt-0.5">
                            {student.nisn}
                          </span>
                        </div>
                      </div>

                      {/* Card Footer */}
                      <div className="text-center border-t border-emerald-500/30 pt-1 relative z-10">
                        <p className="text-[7.5px] text-emerald-200/80 italic font-medium">
                          Gunakan QR Code di atas untuk Absensi Digital Siswa
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

