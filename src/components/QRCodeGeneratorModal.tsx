import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Student, ClassRoom } from '../types';
import { Printer, CheckSquare, Square, Filter, Search, X, QrCode, Grid, Layers } from 'lucide-react';

interface QRCodeGeneratorModalProps {
  students: Student[];
  classes: ClassRoom[];
  onClose: () => void;
  initialSelectedIds?: string[];
}

export const QRCodeGeneratorModal: React.FC<QRCodeGeneratorModalProps> = ({
  students,
  classes,
  onClose,
  initialSelectedIds
}) => {
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [gridCols, setGridCols] = useState<number>(3); // 2, 3, or 4 items per row
  const [showClassInLabel, setShowClassInLabel] = useState<boolean>(true);

  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>(() => {
    if (initialSelectedIds && initialSelectedIds.length > 0) {
      return initialSelectedIds;
    }
    return students.map(s => s.id);
  });

  // Filter students based on selection & search
  const filteredStudents = students.filter(s => {
    const matchClass = selectedClassId === 'all' || s.classId === selectedClassId;
    const matchSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        s.nisn.includes(searchQuery) ||
                        (s.className && s.className.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchClass && matchSearch;
  }).sort((a, b) => a.name.localeCompare(b.name, 'id', { sensitivity: 'base' }));

  // Get selected student objects
  const selectedStudents = students
    .filter(s => selectedStudentIds.includes(s.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'id', { sensitivity: 'base' }));

  // Selection handlers
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

  // Dedicated Print Window Handler for clean black & white output
  const handlePrint = () => {
    const printArea = document.getElementById('printable-qr-grid');
    if (!printArea) {
      window.print();
      return;
    }

    const printWindow = window.open('', '_blank', 'width=900,height=800');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>QR Code Siswa - Massal Hitam Putih</title>
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
              .qr-card-item {
                break-inside: avoid;
                page-break-inside: avoid;
              }
            </style>
          </head>
          <body>
            <div class="no-print bg-slate-100 p-4 mb-6 rounded-2xl flex items-center justify-between border border-slate-300 shadow-sm">
              <div>
                <h3 class="font-bold text-slate-800 text-sm">QR Code Massal Siap Dicetak (${selectedStudents.length} Siswa)</h3>
                <p class="text-xs text-slate-500">Bentuk hitam putih tanpa ornamen. Gunakan opsi "Save as PDF" jika ingin menyimpan file.</p>
              </div>
              <button onclick="window.print()" class="px-5 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold shadow cursor-pointer">
                🖨️ Cetak / Simpan PDF
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
      window.print();
    }
  };

  // Determine grid CSS column count
  const getGridColsClass = () => {
    if (gridCols === 2) return 'grid-cols-2';
    if (gridCols === 4) return 'grid-cols-2 sm:grid-cols-4';
    return 'grid-cols-2 sm:grid-cols-3'; // default 3 cols
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex flex-col overflow-hidden text-slate-800">
      {/* Fallback Direct Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-qr-grid, #printable-qr-grid * {
            visibility: visible !important;
          }
          #printable-qr-grid {
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

      {/* Top Controls Bar (NO-PRINT) */}
      <div className="no-print bg-slate-900 border-b border-slate-800 px-6 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shrink-0 shadow-lg text-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white shrink-0">
            <QrCode className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-white">QR Code Siswa Massal (Hitam Putih)</h2>
              <span className="bg-white/10 text-slate-200 border border-white/20 text-[11px] px-2.5 py-0.5 rounded-full font-bold">
                {selectedStudents.length} Siswa Terpilih
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Tampilan murni hitam putih (QR code NISN dan nama siswa dibawahnya) tanpa ornamen tambahan.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto">
          <button
            onClick={handlePrint}
            disabled={selectedStudents.length === 0}
            className="px-5 py-2.5 bg-white text-slate-900 hover:bg-slate-100 disabled:opacity-50 rounded-xl text-xs font-black shadow-lg transition-all flex items-center gap-2 cursor-pointer active:scale-95"
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
        {/* Left Filter & Options Sidebar (NO-PRINT) */}
        <div className="no-print w-full md:w-80 lg:w-96 bg-white border-r border-slate-200 flex flex-col overflow-y-auto shrink-0 space-y-5 p-5">
          {/* Layout Options */}
          <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Grid className="w-4 h-4 text-slate-700" />
              Opsi Tata Letak Cetak
            </h3>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1.5">Jumlah Kolom per Baris</label>
              <div className="grid grid-cols-3 gap-1.5">
                {[2, 3, 4].map(cols => (
                  <button
                    key={cols}
                    type="button"
                    onClick={() => setGridCols(cols)}
                    className={`py-1.5 px-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                      gridCols === cols
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {cols} Kolom
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="showClass"
                checked={showClassInLabel}
                onChange={(e) => setShowClassInLabel(e.target.checked)}
                className="w-4 h-4 text-slate-900 rounded border-slate-300 focus:ring-slate-900 cursor-pointer"
              />
              <label htmlFor="showClass" className="text-xs font-bold text-slate-700 cursor-pointer">
                Tampilkan Nama Kelas dibawah Nama Siswa
              </label>
            </div>
          </div>

          {/* Student Selection Filter */}
          <div className="space-y-3 flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-700" />
                Pilih Siswa ({selectedStudents.length}/{students.length})
              </h3>
              <button
                onClick={handleToggleSelectAll}
                className="text-[11px] font-bold text-slate-900 hover:underline flex items-center gap-1 cursor-pointer"
              >
                {filteredStudents.length > 0 && filteredStudents.every(s => selectedStudentIds.includes(s.id)) ? (
                  <>
                    <CheckSquare className="w-3.5 h-3.5 text-slate-900" /> Unselect All
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
                      key={`qr-list-st-${st.id}-${idx}`}
                      onClick={() => handleToggleStudent(st.id)}
                      className={`p-2 rounded-xl text-xs flex items-center justify-between cursor-pointer transition-all border ${
                        isSelected
                          ? 'bg-slate-900 text-white font-bold border-slate-900'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}} // handled by container onClick
                          className="w-4 h-4 text-slate-900 rounded border-slate-300 cursor-pointer"
                        />
                        <div className="truncate">
                          <p className="truncate font-bold leading-tight">{st.name}</p>
                          <p className={`text-[10px] font-mono ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                            NISN: {st.nisn} • {st.className}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Printable Preview Panel */}
        <div className="flex-1 bg-slate-200 overflow-y-auto p-4 md:p-8 flex justify-center">
          <div className="max-w-[210mm] w-full bg-white shadow-2xl rounded-2xl p-6 md:p-8 space-y-6 min-h-[297mm]">
            {/* Header info in preview (NO-PRINT) */}
            <div className="no-print border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-900"></span>
                <span className="font-extrabold text-slate-900">Pratinjau Lembar QR Code Hitam Putih (A4)</span>
              </div>
              <p>
                Menampilkan <strong className="text-slate-900">{selectedStudents.length}</strong> dari {students.length} QR Code Siswa
              </p>
            </div>

            {selectedStudents.length === 0 ? (
              <div className="py-20 text-center space-y-3">
                <QrCode className="w-12 h-12 text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-slate-600">Belum Ada Siswa Terpilih</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Silakan centang siswa di panel sebelah kiri untuk menampilkan QR Code hitam putih yang siap dicetak.
                </p>
              </div>
            ) : (
              /* Printable QR Grid Container - PURE BLACK & WHITE */
              <div id="printable-qr-grid">
                <div className={`grid ${getGridColsClass()} gap-4 text-black`}>
                  {selectedStudents.map((student, idx) => (
                    <div
                      key={`qr-card-${student.id}-${idx}`}
                      className="qr-card-item bg-white border border-black p-4 rounded-none flex flex-col items-center justify-center text-center space-y-2 text-black"
                      style={{
                        pageBreakInside: 'avoid',
                        breakInside: 'avoid'
                      }}
                    >
                      {/* Black & White QR Code Image */}
                      <div className="p-1 bg-white flex justify-center items-center">
                        <QRCodeSVG
                          value={student.nisn}
                          size={120}
                          level="M"
                          fgColor="#000000"
                          bgColor="#ffffff"
                          marginSize={1}
                        />
                      </div>

                      {/* Text info directly underneath the QR Code */}
                      <div className="space-y-0.5 text-black">
                        <p className="font-mono font-bold text-xs tracking-wider">
                          NISN: {student.nisn}
                        </p>
                        <p className="font-bold text-xs uppercase leading-tight max-w-[180px] break-words">
                          {student.name}
                        </p>
                        {showClassInLabel && student.className && (
                          <p className="text-[10px] font-semibold text-black uppercase">
                            Kelas {student.className}
                          </p>
                        )}
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
