import React, { useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import JsBarcode from 'jsbarcode';
import { Student } from '../types';
import { Printer, X, QrCode, ShieldCheck, CreditCard } from 'lucide-react';
import { SchoolLogo } from './SchoolLogo';

interface StudentQRCodeCardModalProps {
  student: Student;
  onClose: () => void;
}

export const StudentQRCodeCardModal: React.FC<StudentQRCodeCardModalProps> = ({
  student,
  onClose
}) => {
  const barcodeRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (barcodeRef.current && student.nisn) {
      try {
        JsBarcode(barcodeRef.current, student.nisn, {
          format: 'CODE128',
          width: 1.8,
          height: 45,
          displayValue: true,
          font: 'monospace',
          fontSize: 12,
          margin: 6,
          lineColor: '#0f172a',
          background: '#ffffff'
        });
      } catch (err) {
        console.error('Error rendering barcode in QR card modal:', err);
      }
    }
  }, [student.nisn]);

  const handlePrint = () => {
    const printArea = document.getElementById('printable-single-qr-card');
    if (!printArea) {
      window.print();
      return;
    }

    const printWindow = window.open('', '_blank', 'width=750,height=750');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Kartu Absen QR Code - ${student.name}</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
              @page {
                size: A5 portrait;
                margin: 10mm;
              }
              body {
                background: #ffffff !important;
                color: #000000 !important;
                font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                margin: 0;
                padding: 20px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
              }
              .no-print {
                display: flex;
              }
              @media print {
                .no-print {
                  display: none !important;
                }
                body {
                  padding: 0;
                }
              }
            </style>
          </head>
          <body>
            <div class="no-print bg-slate-100 p-3 mb-6 rounded-2xl flex items-center justify-between border border-slate-300 w-full max-w-md shadow-sm">
              <span class="text-xs font-bold text-slate-800">Kartu Absensi Siap Dicetak</span>
              <button onclick="window.print()" class="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold cursor-pointer">
                🖨️ Cetak Kartu
              </button>
            </div>
            <div style="width: 100%; max-width: 420px;">
              ${printArea.innerHTML}
            </div>
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

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header Modal */}
        <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <QrCode className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base leading-tight">Kartu Absen QR Code</h3>
              <p className="text-xs text-slate-500">SMA Islam Ra'iyatul Husnan Wringin</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Card Area */}
        <div id="printable-single-qr-card">
          <div className="bg-gradient-to-br from-emerald-800 via-teal-900 to-slate-900 rounded-2xl p-5 text-white shadow-xl border border-emerald-500/30 relative overflow-hidden">
            <div className="absolute -right-12 -bottom-12 w-44 h-44 bg-emerald-400/10 rounded-full blur-2xl pointer-events-none"></div>

            {/* Identitas Sekolah Header */}
            <div className="flex items-center gap-3 border-b border-emerald-500/40 pb-3 mb-4">
              <SchoolLogo size={38} />
              <div>
                <h4 className="font-black text-xs sm:text-sm leading-tight tracking-wide text-amber-300 uppercase">
                  SMA ISLAM RA'IYATUL HUSNAN
                </h4>
                <p className="text-[10px] text-emerald-200 font-medium tracking-wider">
                  KARTU ABSENSI DIGITAL SISWA (QR CODE)
                </p>
              </div>
            </div>

            {/* Student Info: Foto, Nama, Kelas, NISN */}
            <div className="grid grid-cols-3 gap-3 mb-4 items-center">
              <div className="col-span-1 flex justify-center">
                <div className="w-20 h-24 rounded-xl bg-emerald-950/70 border-2 border-amber-300/40 overflow-hidden flex flex-col items-center justify-center text-emerald-200 text-xs font-bold p-0.5 text-center shadow-md">
                  {student.photoUrl ? (
                    <img src={student.photoUrl} alt={student.name} className="w-full h-full object-cover rounded-lg" />
                  ) : (
                    <>
                      <span className="text-2xl mb-1">🎓</span>
                      <span className="text-[9px]">3x4 PAS FOTO</span>
                    </>
                  )}
                </div>
              </div>

              <div className="col-span-2 space-y-1.5">
                <div>
                  <span className="text-[9px] font-bold text-emerald-300 uppercase tracking-wider block">Nama Siswa</span>
                  <span className="font-extrabold text-sm text-white line-clamp-2 leading-tight">{student.name}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-emerald-300 uppercase tracking-wider block">Kelas</span>
                  <span className="font-bold text-xs text-amber-200 bg-emerald-950/60 px-2 py-0.5 rounded-md inline-block">
                    {student.className || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-emerald-300 uppercase tracking-wider block">NISN</span>
                  <span className="font-mono font-black text-sm text-amber-300 tracking-wider">{student.nisn}</span>
                </div>
              </div>
            </div>

            {/* Dual Display: QR Code and Barcode Box */}
            <div className="bg-white p-3 rounded-xl flex flex-col items-center justify-center gap-2 shadow-inner border border-slate-200">
              <div className="flex items-center justify-center gap-4 py-1">
                {/* Clean Black QR Code SVG */}
                <div className="p-1.5 bg-white border border-slate-200 rounded-lg shadow-2xs">
                  <QRCodeSVG
                    value={student.nisn}
                    size={100}
                    level="M"
                    fgColor="#000000"
                    bgColor="#ffffff"
                    marginSize={1}
                  />
                </div>

                {/* NISN Barcode SVG */}
                <div className="hidden sm:flex flex-col items-center justify-center">
                  <svg ref={barcodeRef} className="max-w-[150px] h-12"></svg>
                </div>
              </div>

              <span className="text-[11px] font-mono font-bold text-slate-800 tracking-widest bg-slate-100 px-3 py-0.5 rounded-md">
                NISN: {student.nisn}
              </span>
            </div>

            {/* Card Footer */}
            <div className="mt-3 text-center">
              <span className="text-[9px] text-emerald-200/90 font-medium flex items-center justify-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-300 inline shrink-0" />
                Pindai QR Code / Barcode ini pada Kamera Absensi Sekolah
              </span>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex gap-2 justify-end mt-5 pt-3 border-t border-slate-100">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-black shadow-sm transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" /> Cetak Kartu Absen QR
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
};
