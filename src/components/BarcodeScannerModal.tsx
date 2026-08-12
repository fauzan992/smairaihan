import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { apiService } from '../services/apiService';
import { AttendanceStatus, Student, AttendanceRecord } from '../types';
import { Camera, Barcode, CheckCircle2, AlertCircle, X, Volume2, UserCheck, RefreshCw, AlertTriangle, ShieldCheck } from 'lucide-react';

interface BarcodeScannerModalProps {
  onClose?: () => void;
  onSuccessScan?: () => void;
  recordedByRole?: 'admin' | 'guru';
  recordedByName?: string;
  defaultStatus?: AttendanceStatus;
  studentsList?: Student[];
  isInline?: boolean;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  onClose,
  onSuccessScan,
  recordedByRole = 'admin',
  recordedByName = 'Petugas Piket',
  defaultStatus = 'Hadir',
  studentsList = [],
  isInline = false
}) => {
  const [manualNisn, setManualNisn] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<AttendanceStatus>(defaultStatus);
  const [notes, setNotes] = useState('');
  const [scannerMode, setScannerMode] = useState<'camera' | 'usb' | 'manual'>('camera');
  const [loading, setLoading] = useState(false);
  
  // Track students who have been scanned today to prevent duplicate scans
  const [scannedMap, setScannedMap] = useState<Map<string, { studentName: string; className: string; status: string; time: string }>>(new Map());
  
  const [scanResult, setScanResult] = useState<{
    studentName: string;
    nisn: string;
    className: string;
    status: string;
    time: string;
  } | null>(null);

  const [warningMsg, setWarningMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [totalScannedCount, setTotalScannedCount] = useState<number>(0);

  const uniqueReaderId = useRef(`reader-camera-${Math.random().toString(36).substring(2, 7)}`).current;
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const lastScannedCodeRef = useRef<{ code: string; timestamp: number } | null>(null);
  const isProcessingRef = useRef<boolean>(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Play audio beep on successful scan
  const playBeepSuccess = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // High pitch 880Hz
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.25);
    } catch (e) {
      // Audio fallback
    }
  };

  // Play audio warning on duplicate scan
  const playBeepWarning = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(350, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.4);
    } catch (e) {
      // Audio fallback
    }
  };

  // Load initial today attendance to populate duplicate prevention map
  useEffect(() => {
    let isMounted = true;
    const todayStr = new Date().toISOString().split('T')[0];

    async function loadTodayAttendance() {
      try {
        const res = await apiService.getAttendance({ startDate: todayStr, endDate: todayStr });
        if (isMounted && res.records) {
          const map = new Map<string, { studentName: string; className: string; status: string; time: string }>();
          res.records.forEach((r: AttendanceRecord) => {
            map.set(r.nisn.trim(), {
              studentName: r.studentName,
              className: r.className,
              status: r.status,
              time: r.time
            });
          });
          setScannedMap(map);
          setTotalScannedCount(map.size);
        }
      } catch (err) {
        console.error('Failed to load today attendance records:', err);
      }
    }

    loadTodayAttendance();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleProcessNisn = async (code: string) => {
    if (!code || isProcessingRef.current) return;
    const cleanNisn = code.trim();
    if (cleanNisn.length < 3) return;

    const now = Date.now();

    // 1. Debounce same barcode scanned within 2.5 seconds to prevent camera rapid firing
    if (
      lastScannedCodeRef.current &&
      lastScannedCodeRef.current.code === cleanNisn &&
      now - lastScannedCodeRef.current.timestamp < 2500
    ) {
      return;
    }
    lastScannedCodeRef.current = { code: cleanNisn, timestamp: now };

    // 2. CHECK DUPLICATE SCAN: Check if student has already been recorded today
    const existing = scannedMap.get(cleanNisn);
    if (existing) {
      playBeepWarning();
      setWarningMsg(`SCAN GANDA DICEGAH: Siswa "${existing.studentName}" (${existing.className}) dengan NISN ${cleanNisn} SUDAH TERRECORD hari ini pada pukul ${existing.time} WIB.`);
      setErrorMsg(null);
      return;
    }

    // 3. Process scan via API
    isProcessingRef.current = true;
    setLoading(true);
    setErrorMsg(null);
    setWarningMsg(null);

    try {
      const res = await apiService.scanBarcode(
        cleanNisn,
        selectedStatus,
        notes,
        recordedByName,
        recordedByRole
      );

      if (res.success && res.student && res.record) {
        playBeepSuccess();

        // Update local scanned map to prevent future duplicates in current session
        const newRecord = {
          studentName: res.student.name,
          className: res.student.className,
          status: res.record.status,
          time: res.record.time
        };

        setScannedMap(prev => {
          const updated = new Map(prev);
          updated.set(cleanNisn, newRecord);
          setTotalScannedCount(updated.size);
          return updated;
        });

        setScanResult({
          studentName: res.student.name,
          nisn: res.student.nisn,
          className: res.student.className,
          status: res.record.status,
          time: res.record.time
        });

        setManualNisn('');
        if (onSuccessScan) onSuccessScan();
      } else {
        playBeepWarning();
        setErrorMsg(res.error || 'Gagal memproses barcode NISN.');
      }
    } catch (err: any) {
      playBeepWarning();
      setErrorMsg(err.message || 'Terjadi kesalahan sistem saat memproses scan.');
    } finally {
      setLoading(false);
      isProcessingRef.current = false;
    }
  };

  // Initialize rear camera QR/barcode scanner directly
  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;

    if (scannerMode === 'camera') {
      const readerElementId = uniqueReaderId;

      // Ensure target element exists in DOM before creating Html5Qrcode instance
      const timer = setTimeout(() => {
        try {
          html5QrCode = new Html5Qrcode(readerElementId);
          html5QrCodeRef.current = html5QrCode;

          const config = {
            fps: 12,
            qrbox: { width: 260, height: 260 },
            aspectRatio: 1.0
          };

          // Directly request back camera using facingMode: "environment"
          html5QrCode
            .start(
              { facingMode: 'environment' },
              config,
              (decodedText) => {
                handleProcessNisn(decodedText);
              },
              (_errorMessage) => {
                // Noise during camera frame decoding - ignore safely
              }
            )
            .then(() => {
              setCameraActive(true);
            })
            .catch((err) => {
              console.warn('Rear camera exact match failed, falling back to default video input:', err);
              // Fallback to user camera or default device if environment camera is unavailable
              if (html5QrCode) {
                html5QrCode
                  .start(
                    { facingMode: 'user' },
                    config,
                    (decodedText) => {
                      handleProcessNisn(decodedText);
                    },
                    () => {}
                  )
                  .then(() => setCameraActive(true))
                  .catch((e) => {
                    console.error('All camera attempts failed:', e);
                    setErrorMsg('Tidak dapat mengakses kamera. Pastikan izin kamera telah diberikan di browser.');
                    setCameraActive(false);
                  });
              }
            });
        } catch (e) {
          console.error('Error starting camera scanner:', e);
        }
      }, 150);

      return () => {
        clearTimeout(timer);
        if (html5QrCodeRef.current) {
          html5QrCodeRef.current
            .stop()
            .then(() => {
              html5QrCodeRef.current?.clear();
            })
            .catch((err) => console.warn('Failed to stop camera scanner:', err));
        }
        setCameraActive(false);
      };
    }
  }, [scannerMode]);

  // Focus manual input on USB or manual mode switch
  useEffect(() => {
    if (scannerMode === 'usb' || scannerMode === 'manual') {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [scannerMode]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualNisn) {
      handleProcessNisn(manualNisn);
    }
  };

  const scannerContent = (
    <div className={isInline ? "bg-slate-900 rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-800 flex flex-col w-full text-white relative overflow-hidden" : "bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-y-auto text-slate-800"}>
      
      {/* Header */}
      <div className={`flex justify-between items-center pb-3 border-b mb-3 ${isInline ? 'border-slate-800' : 'border-slate-100'}`}>
        <div className="flex items-center gap-2.5">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${isInline ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-emerald-100 text-emerald-700'}`}>
            <Barcode className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className={`font-bold text-lg leading-tight ${isInline ? 'text-white' : 'text-slate-800'}`}>
                {isInline ? 'Scanner Barcode & QR NISN Live' : 'Scanner Barcode & QR NISN'}
              </h3>
              <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" /> Anti-Scan Ganda
              </span>
            </div>
            <p className={`text-xs ${isInline ? 'text-slate-400' : 'text-slate-500'}`}>SMA Islam Ra'iyatul Husnan Wringin</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg cursor-pointer transition-colors ${isInline ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
            title="Tutup Modal"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Active Continuous Camera Status Indicator */}
      <div className="mb-3 bg-emerald-950/80 border border-emerald-500/50 rounded-xl p-2.5 flex items-center justify-between text-xs text-emerald-300">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
          </span>
          <span className="font-extrabold text-[11px] uppercase tracking-wide">
            Kamera Terbuka & Memindai Otomatis (Tanpa Henti)
          </span>
        </div>
        <span className="text-[10px] font-bold bg-emerald-900/90 text-emerald-200 px-2 py-0.5 rounded-md border border-emerald-700/60">
          Ready
        </span>
      </div>

      {/* Mode Selector */}
      <div className={`grid grid-cols-3 gap-1 p-1 rounded-xl mb-3 ${isInline ? 'bg-slate-950 border border-slate-800' : 'bg-slate-100'}`}>
        <button
          onClick={() => setScannerMode('camera')}
          className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            scannerMode === 'camera'
              ? isInline ? 'bg-emerald-600 text-white shadow-xs font-bold' : 'bg-white text-emerald-700 shadow-xs'
              : isInline ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Camera className="w-3.5 h-3.5" /> Kamera HP / Laptop
        </button>
        <button
          onClick={() => setScannerMode('usb')}
          className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            scannerMode === 'usb'
              ? isInline ? 'bg-emerald-600 text-white shadow-xs font-bold' : 'bg-white text-emerald-700 shadow-xs'
              : isInline ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Barcode className="w-3.5 h-3.5" /> Scanner Fisik / USB
        </button>
        <button
          onClick={() => setScannerMode('manual')}
          className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            scannerMode === 'manual'
              ? isInline ? 'bg-emerald-600 text-white shadow-xs font-bold' : 'bg-white text-emerald-700 shadow-xs'
              : isInline ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <UserCheck className="w-3.5 h-3.5" /> Input NISN
        </button>
      </div>

      {/* Status Preset Selector */}
      <div className="mb-3">
        <div className="flex justify-between items-center mb-1.5">
          <label className={`text-xs font-semibold ${isInline ? 'text-slate-300' : 'text-slate-700'}`}>
            Status Presensi yang Dicatat:
          </label>
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${isInline ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-500'}`}>
            Total Terrecord: <strong className="text-emerald-400">{totalScannedCount}</strong>
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {(['Hadir', 'Izin', 'Sakit', 'Alpa'] as AttendanceStatus[]).map((st) => {
            const active = selectedStatus === st;
            let bg = isInline ? 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100';
            if (active) {
              if (st === 'Hadir') bg = 'bg-emerald-600 text-white border-emerald-600 shadow-xs';
              if (st === 'Izin') bg = 'bg-amber-500 text-white border-amber-500 shadow-xs';
              if (st === 'Sakit') bg = 'bg-blue-600 text-white border-blue-600 shadow-xs';
              if (st === 'Alpa') bg = 'bg-rose-600 text-white border-rose-600 shadow-xs';
            }
            return (
              <button
                key={st}
                type="button"
                onClick={() => setSelectedStatus(st)}
                className={`py-1.5 px-2 text-xs font-bold rounded-lg border transition-all text-center cursor-pointer ${bg}`}
              >
                {st}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scanner Camera Body Area */}
      <div className="relative mb-3 min-h-[250px] bg-slate-950 rounded-2xl overflow-hidden flex flex-col items-center justify-center p-2 border border-slate-800 shadow-inner">
        {scannerMode === 'camera' && (
          <div className="w-full relative flex flex-col items-center">
            <div id={uniqueReaderId} className="w-full max-w-[320px] rounded-xl overflow-hidden text-white text-xs"></div>
            
            <div className="mt-2 text-center">
              <span className="text-[11px] font-medium text-emerald-400 bg-emerald-950/90 px-3 py-1 rounded-full border border-emerald-800/80 inline-flex items-center gap-1.5 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                Kamera Belakang Aktif — Siap Pindai QR / Barcode Kartu NISN
              </span>
            </div>
          </div>
        )}

        {(scannerMode === 'usb' || scannerMode === 'manual') && (
          <form onSubmit={handleManualSubmit} className="w-full max-w-sm p-4 text-center">
            <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-3 border border-emerald-500/30">
              <Barcode className="w-6 h-6" />
            </div>
            <h4 className="text-white font-semibold text-sm mb-1">
              {scannerMode === 'usb' ? 'Modus Scanner USB / Bluetooth' : 'Ketik NISN Siswa'}
            </h4>
            <p className="text-xs text-slate-400 mb-4">
              {scannerMode === 'usb'
                ? 'Gunakan alat scanner barcode fisik. Hasil scan akan otomatis terisi dan diproses.'
                : 'Ketik 10 digit NISN siswa dan tekan Enter.'}
            </p>

            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                placeholder="Masukkan NISN (Cth: 0061234501)"
                value={manualNisn}
                onChange={(e) => setManualNisn(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 text-amber-300 font-mono text-center text-sm font-bold rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                autoFocus
              />
              <button
                type="submit"
                disabled={loading || !manualNisn}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg disabled:opacity-50 cursor-pointer"
              >
                Proses
              </button>
            </div>
          </form>
        )}

        {loading && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center text-white gap-2 font-medium text-xs z-20">
            <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" /> Memproses & Menghubungkan ke Database...
          </div>
        )}
      </div>

      {/* Warning Alert: SCAN GANDA DICEGAH */}
      {warningMsg && (
        <div className="p-3 bg-amber-50 border-2 border-amber-300 text-amber-900 rounded-xl text-xs flex items-start gap-2.5 mb-3 shadow-sm animate-in fade-in duration-200">
          <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold uppercase tracking-wide text-amber-800 text-[11px] block">
              Peringatan - Scan Ganda Dicegah
            </span>
            <p className="text-xs mt-0.5 font-medium leading-relaxed">{warningMsg}</p>
          </div>
          <button onClick={() => setWarningMsg(null)} className="text-amber-500 hover:text-amber-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Success Alert Popup (Stays open while camera is running) */}
      {scanResult && (
        <div className="p-3.5 bg-emerald-950/90 border-2 border-emerald-500/80 rounded-xl mb-3 animate-in fade-in slide-in-from-bottom-2 duration-200 shadow-lg text-white">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5 animate-bounce" />
            <div className="flex-1">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-extrabold text-emerald-300 uppercase tracking-wider bg-emerald-900/90 px-2 py-0.5 rounded-md border border-emerald-700">
                  BERHASIL DICATAT KE DATABASE!
                </span>
                <span className="text-[10px] font-bold text-emerald-300 bg-emerald-900/60 px-2 py-0.5 rounded-full">
                  {scanResult.time} WIB
                </span>
              </div>
              <h4 className="font-black text-amber-300 text-base mt-1">{scanResult.studentName}</h4>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-200 mt-1 font-medium">
                <span>NISN: <strong className="font-mono text-emerald-300">{scanResult.nisn}</strong></span>
                <span>Kelas: <strong>{scanResult.className}</strong></span>
                <span>Status: <strong className="text-emerald-400 font-bold">{scanResult.status}</strong></span>
              </div>
              <p className="text-[10px] text-emerald-400/90 font-semibold mt-2 italic flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                Kamera tetap terbuka & siap memindai kartu siswa berikutnya...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-rose-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Quick Student Suggestions Chips (Useful for demo & manual testing) */}
      {studentsList.length > 0 && (
        <div className="mb-3">
          <span className={`text-[11px] font-semibold block mb-1 ${isInline ? 'text-slate-400' : 'text-slate-500'}`}>
            ⚡ Simulasi/Uji Coba Scan NISN Siswa:
          </span>
          <div className={`flex flex-wrap gap-1 max-h-24 overflow-y-auto p-1.5 rounded-lg border ${isInline ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
            {studentsList.slice(0, 10).map((st) => {
              const isAlreadyScanned = scannedMap.has(st.nisn);
              return (
                <button
                  key={st.id}
                  onClick={() => handleProcessNisn(st.nisn)}
                  className={`text-[10px] font-medium px-2 py-1 border rounded-md transition-colors text-left flex items-center gap-1 cursor-pointer ${
                    isAlreadyScanned
                      ? 'bg-slate-900 border-slate-800 text-slate-500 line-through'
                      : isInline ? 'bg-slate-900 hover:bg-emerald-950 border-slate-700 text-slate-200' : 'bg-white hover:bg-emerald-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <span className={`font-mono font-bold ${isAlreadyScanned ? 'text-slate-500' : 'text-emerald-400'}`}>{st.nisn}</span> - {st.name} ({st.className})
                  {isAlreadyScanned && <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className={`flex justify-between items-center pt-3 border-t ${isInline ? 'border-slate-800' : 'border-slate-100'}`}>
        <p className={`text-[11px] ${isInline ? 'text-slate-400' : 'text-slate-500'}`}>
          Kamera otomatis tetap terbuka & memindai tanpa henti.
        </p>
        {onClose && (
          <button
            onClick={onClose}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-sm"
          >
            Selesai
          </button>
        )}
      </div>
    </div>
  );

  if (isInline) {
    return scannerContent;
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      {scannerContent}
    </div>
  );
};
