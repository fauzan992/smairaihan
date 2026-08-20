import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { apiService } from '../services/apiService';
import { AttendanceStatus, Student, AttendanceRecord } from '../types';
import { Camera, Barcode, CheckCircle2, AlertCircle, X, Volume2, UserCheck, RefreshCw, AlertTriangle, ShieldCheck, Maximize2, Minimize2, Search, UserX, Filter, GraduationCap, Building2 } from 'lucide-react';

interface BarcodeScannerModalProps {
  onClose?: () => void;
  onSuccessScan?: () => void;
  recordedByRole?: 'admin' | 'guru' | 'guru_piket' | 'piket';
  recordedByName?: string;
  defaultStatus?: AttendanceStatus;
  studentsList?: Student[];
  isInline?: boolean;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  onClose,
  onSuccessScan,
  recordedByRole = 'guru_piket',
  recordedByName = 'Guru Piket Gerbang',
  defaultStatus = 'Hadir',
  studentsList = [],
  isInline = false
}) => {
  const [manualNisn, setManualNisn] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<AttendanceStatus>(defaultStatus);
  const [notes, setNotes] = useState('');
  const [scannerMode, setScannerMode] = useState<'camera' | 'usb' | 'manual'>('camera');
  const [loading, setLoading] = useState(false);
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);
  
  // Manual student search & class filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');
  
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

  // Derived available classes for filtering
  const availableClasses = Array.from(
    new Set(studentsList.map((s) => s.className).filter(Boolean))
  ).sort();

  // Filtered students list for manual search
  const filteredStudents = studentsList.filter((student) => {
    const matchesClass =
      selectedClassFilter === 'all' || student.className === selectedClassFilter;
    const query = searchQuery.trim().toLowerCase();
    const matchesQuery =
      !query ||
      student.name.toLowerCase().includes(query) ||
      student.nisn.toLowerCase().includes(query) ||
      student.className.toLowerCase().includes(query);
    return matchesClass && matchesQuery;
  });

  // Fullscreen handlers
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsNativeFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsNativeFullscreen(false)).catch(() => {});
    }
  };

  const handleFinishScan = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    if (onClose) {
      onClose();
    }
  };

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

  const handleProcessNisn = async (code: string, overrideStatus?: AttendanceStatus) => {
    if (!code || isProcessingRef.current) return;
    const cleanNisn = code.trim();
    if (cleanNisn.length < 3) return;

    const statusToUse = overrideStatus || selectedStatus;

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
        statusToUse,
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
    let isCancelled = false;

    if (scannerMode === 'camera') {
      const readerElementId = uniqueReaderId;

      // Ensure target element exists in DOM before creating Html5Qrcode instance
      const timer = setTimeout(() => {
        if (isCancelled) return;
        const readerElement = document.getElementById(readerElementId);
        if (!readerElement) return;

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
              if (!isCancelled) {
                setCameraActive(true);
              } else {
                // Component unmounted while camera was starting
                try {
                  if (html5QrCode?.isScanning) {
                    html5QrCode.stop().then(() => html5QrCode?.clear()).catch(() => {});
                  }
                } catch (_) {}
              }
            })
            .catch((err) => {
              if (isCancelled) return;
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
                  .then(() => {
                    if (!isCancelled) setCameraActive(true);
                  })
                  .catch((e) => {
                    if (isCancelled) return;
                    console.error('All camera attempts failed:', e);
                    setErrorMsg('Tidak dapat mengakses kamera. Pastikan izin kamera telah diberikan di browser.');
                    setCameraActive(false);
                  });
              }
            });
        } catch (e) {
          console.error('Error starting camera scanner:', e);
        }
      }, 200);

      return () => {
        isCancelled = true;
        clearTimeout(timer);
        const scannerInstance = html5QrCodeRef.current;
        if (scannerInstance) {
          try {
            if (scannerInstance.isScanning) {
              scannerInstance
                .stop()
                .then(() => {
                  try {
                    scannerInstance.clear();
                  } catch (_) {}
                })
                .catch((err) => {
                  // Catch gracefully if scanner was already stopped or unmounted
                  console.warn('Silent notice: Camera scanner stopped gracefully:', err?.message || err);
                });
            } else {
              try {
                scannerInstance.clear();
              } catch (_) {}
            }
          } catch (e) {
            // Scanner instance already detached or cleaned up
          }
        }
        html5QrCodeRef.current = null;
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
    <div className={isInline ? "bg-slate-900 rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-800 flex flex-col w-full text-white relative overflow-hidden" : "bg-slate-900 rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-slate-800 flex flex-col text-white relative my-auto"}>
      
      {/* Header */}
      <div className="flex justify-between items-center pb-3 border-b border-slate-800 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <Barcode className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-lg leading-tight text-white">
                {isInline ? 'Scanner Barcode & QR NISN Live' : 'Scanner QR Code & Barcode NISN (Layar Penuh)'}
              </h3>
              <span className="bg-sky-500/20 text-sky-300 border border-sky-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <Building2 className="w-3 h-3 text-sky-400" /> Pos Piket Gerbang (Kehadiran Sekolah)
              </span>
              <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" /> Anti-Scan Ganda
              </span>
            </div>
            <p className="text-xs text-slate-400">SMA Islam Ra'iyatul Husnan Wringin</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isInline && (
            <button
              onClick={toggleFullscreen}
              className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg cursor-pointer transition-colors flex items-center gap-1.5 text-xs font-semibold"
              title="Toggle Fullscreen Layar"
            >
              {isNativeFullscreen ? <Minimize2 className="w-4 h-4 text-amber-400" /> : <Maximize2 className="w-4 h-4 text-emerald-400" />}
              <span className="hidden sm:inline">{isNativeFullscreen ? 'Layar Normal' : 'Layar Penuh Browser'}</span>
            </button>
          )}
          {onClose && (
            <button
              onClick={handleFinishScan}
              className="px-3 py-1.5 bg-rose-600/80 hover:bg-rose-600 text-white rounded-lg cursor-pointer transition-colors flex items-center gap-1 text-xs font-bold"
              title="Selesai & Keluar Layar Penuh"
            >
              <X className="w-4 h-4" />
              <span>Selesai</span>
            </button>
          )}
        </div>
      </div>

      {/* Active Continuous Camera Status Indicator */}
      <div className="mb-3 bg-emerald-950/80 border border-emerald-500/50 rounded-xl p-2.5 flex items-center justify-between text-xs text-emerald-300">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
          </span>
          <span className="font-extrabold text-[11px] uppercase tracking-wide">
            Kamera Mode Layar Penuh Terbuka & Memindai Otomatis (Tanpa Henti)
          </span>
        </div>
        <span className="text-[10px] font-bold bg-emerald-900/90 text-emerald-200 px-2 py-0.5 rounded-md border border-emerald-700/60">
          Ready Live
        </span>
      </div>

      {/* Mode Selector */}
      <div className="grid grid-cols-3 gap-1 p-1 rounded-xl mb-3 bg-slate-950 border border-slate-800">
        <button
          onClick={() => setScannerMode('camera')}
          className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            scannerMode === 'camera'
              ? 'bg-emerald-600 text-white shadow-xs font-bold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Camera className="w-3.5 h-3.5" /> Kamera HP / Laptop
        </button>
        <button
          onClick={() => setScannerMode('usb')}
          className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            scannerMode === 'usb'
              ? 'bg-emerald-600 text-white shadow-xs font-bold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Barcode className="w-3.5 h-3.5" /> Scanner Fisik / USB
        </button>
        <button
          onClick={() => setScannerMode('manual')}
          className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            scannerMode === 'manual'
              ? 'bg-amber-600 text-white shadow-xs font-bold'
              : 'text-amber-400 hover:text-amber-200'
          }`}
        >
          <UserCheck className="w-3.5 h-3.5" /> Absensi Manual (Lupa Kartu)
        </button>
      </div>

      {/* Status Preset Selector */}
      <div className="mb-3">
        <div className="flex justify-between items-center mb-1.5">
          <label className="text-xs font-semibold text-slate-300">
            Status Presensi yang Dicatat:
          </label>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
            Total Terrecord: <strong className="text-emerald-400">{totalScannedCount}</strong>
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {(['Hadir', 'Izin', 'Sakit', 'Alpa'] as AttendanceStatus[]).map((st) => {
            const active = selectedStatus === st;
            let bg = 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800';
            if (active) {
              if (st === 'Hadir') bg = 'bg-emerald-600 text-white border-emerald-600 shadow-xs font-bold';
              if (st === 'Izin') bg = 'bg-amber-500 text-white border-amber-500 shadow-xs font-bold';
              if (st === 'Sakit') bg = 'bg-blue-600 text-white border-blue-600 shadow-xs font-bold';
              if (st === 'Alpa') bg = 'bg-rose-600 text-white border-rose-600 shadow-xs font-bold';
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

      {/* Scanner Camera / Manual Body Area */}
      <div className="relative mb-3 min-h-[260px] bg-slate-950 rounded-2xl overflow-hidden flex flex-col items-center justify-center p-3 border border-slate-800 shadow-inner">
        {scannerMode === 'camera' && (
          <div className="w-full relative flex flex-col items-center">
            <div id={uniqueReaderId} className="w-full max-w-[360px] rounded-xl overflow-hidden text-white text-xs"></div>
            
            <div className="mt-2 text-center flex flex-col items-center gap-1.5">
              <span className="text-[11px] font-medium text-emerald-400 bg-emerald-950/90 px-3 py-1 rounded-full border border-emerald-800/80 inline-flex items-center gap-1.5 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                Kamera Belakang Aktif — Siap Pindai QR / Barcode Kartu NISN
              </span>

              <button
                type="button"
                onClick={() => setScannerMode('manual')}
                className="text-[11px] text-amber-400 hover:text-amber-300 font-bold bg-amber-950/80 hover:bg-amber-900 px-3 py-1 rounded-xl border border-amber-800/80 inline-flex items-center gap-1.5 cursor-pointer transition-all mt-1"
              >
                <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>Siswa Lupa Kartu Pelajar? Absensi Manual & Cari Nama Siswa</span>
              </button>
            </div>
          </div>
        )}

        {scannerMode === 'usb' && (
          <form onSubmit={handleManualSubmit} className="w-full max-w-sm p-4 text-center">
            <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-3 border border-emerald-500/30">
              <Barcode className="w-6 h-6" />
            </div>
            <h4 className="text-white font-semibold text-sm mb-1">
              Modus Scanner USB / Bluetooth
            </h4>
            <p className="text-xs text-slate-400 mb-4">
              Gunakan alat scanner barcode fisik. Hasil scan akan otomatis terisi dan diproses.
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

        {scannerMode === 'manual' && (
          <div className="w-full space-y-3">
            {/* Header / Info Bar */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold shrink-0">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-white font-extrabold text-xs sm:text-sm">
                    Absensi Manual Siswa (Lupa / Tidak Membawa Kartu Pelajar)
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Cari nama siswa atau pilih kelas untuk mencatat presensi secara langsung.
                  </p>
                </div>
              </div>

              {/* Search & Class Filter Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <div className="sm:col-span-8 relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Cari Nama Siswa atau NISN..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-xs font-semibold rounded-xl focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="sm:col-span-4 relative">
                  <select
                    value={selectedClassFilter}
                    onChange={(e) => setSelectedClassFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 text-amber-300 text-xs font-bold rounded-xl focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="all">Semua Kelas ({studentsList.length})</option>
                    {availableClasses.map((cls) => (
                      <option key={cls} value={cls}>
                        Kelas {cls}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Direct NISN Submit Option */}
              <form onSubmit={handleManualSubmit} className="flex gap-2 pt-2 border-t border-slate-800">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Atau ketik 10 digit NISN langsung..."
                  value={manualNisn}
                  onChange={(e) => setManualNisn(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 text-amber-300 font-mono text-xs font-bold rounded-lg focus:outline-none focus:border-amber-500"
                />
                <button
                  type="submit"
                  disabled={loading || !manualNisn}
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg disabled:opacity-50 cursor-pointer transition-colors"
                >
                  Proses NISN
                </button>
              </form>
            </div>

            {/* Filtered Students List Results */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center px-1">
                <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                  Daftar Siswa ({filteredStudents.length})
                </span>
                <span className="text-[10px] text-amber-400/90 font-medium italic">
                  Status Terpilih: <strong className="text-white font-extrabold">{selectedStatus}</strong>
                </span>
              </div>

              <div className="max-h-[200px] overflow-y-auto space-y-1.5 pr-1">
                {filteredStudents.length === 0 ? (
                  <div className="text-center py-6 bg-slate-900/60 rounded-xl border border-slate-800 text-slate-400 p-4">
                    <UserX className="w-7 h-7 text-slate-600 mx-auto mb-1.5" />
                    <p className="text-xs font-bold text-slate-300">Tidak ada siswa ditemukan</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Coba ubah nama pencarian atau pilih kelas di atas.
                    </p>
                  </div>
                ) : (
                  filteredStudents.map((st) => {
                    const existingRecord = scannedMap.get(st.nisn);
                    return (
                      <div
                        key={st.id || st.nisn}
                        className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                          existingRecord
                            ? 'bg-slate-900/80 border-emerald-900/40'
                            : 'bg-slate-900 border-slate-800 hover:border-amber-500/50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
                            existingRecord ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-700/50' : 'bg-slate-800 text-amber-400 border border-slate-700'
                          }`}>
                            {st.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h5 className="font-bold text-xs text-white truncate">{st.name}</h5>
                              <span className="text-[10px] font-extrabold bg-slate-800 text-amber-300 border border-slate-700 px-1.5 py-0.2 rounded shrink-0">
                                {st.className}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] font-mono text-slate-400">
                                NISN: {st.nisn}
                              </span>
                              {existingRecord && (
                                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950 px-1.5 py-0.2 rounded border border-emerald-800 flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  {existingRecord.status} ({existingRecord.time} WIB)
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Quick Action Button */}
                        <div className="shrink-0">
                          {existingRecord ? (
                            <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-800">
                              Sudah Presensi
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleProcessNisn(st.nisn, selectedStatus)}
                              disabled={loading}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-black shadow-xs cursor-pointer flex items-center gap-1 transition-transform active:scale-95 disabled:opacity-50"
                              title={`Catat ${st.name} sebagai ${selectedStatus}`}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Catat {selectedStatus}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center text-white gap-2 font-medium text-xs z-20">
            <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" /> Memproses & Menghubungkan ke Database...
          </div>
        )}
      </div>

      {/* Warning Alert: SCAN GANDA DICEGAH */}
      {warningMsg && (
        <div className="p-3 bg-amber-950/90 border-2 border-amber-500/80 text-amber-200 rounded-xl text-xs flex items-start gap-2.5 mb-3 shadow-sm animate-in fade-in duration-200">
          <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold uppercase tracking-wide text-amber-300 text-[11px] block">
              Peringatan - Scan Ganda Dicegah
            </span>
            <p className="text-xs mt-0.5 font-medium leading-relaxed">{warningMsg}</p>
          </div>
          <button onClick={() => setWarningMsg(null)} className="text-amber-400 hover:text-amber-200">
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
        <div className="p-3 bg-rose-950/90 border border-rose-500/80 text-rose-200 rounded-xl text-xs flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-rose-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Quick Student Suggestions Chips */}
      {studentsList.length > 0 && (
        <div className="mb-3">
          <span className="text-[11px] font-semibold block mb-1 text-slate-400">
            ⚡ Simulasi/Uji Coba Scan NISN Siswa:
          </span>
          <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-1.5 rounded-lg border bg-slate-950 border-slate-800">
            {studentsList.slice(0, 10).map((st) => {
              const isAlreadyScanned = scannedMap.has(st.nisn);
              return (
                <button
                  key={st.id}
                  onClick={() => handleProcessNisn(st.nisn)}
                  className={`text-[10px] font-medium px-2 py-1 border rounded-md transition-colors text-left flex items-center gap-1 cursor-pointer ${
                    isAlreadyScanned
                      ? 'bg-slate-900 border-slate-800 text-slate-500 line-through'
                      : 'bg-slate-900 hover:bg-emerald-950 border-slate-700 text-slate-200'
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
      <div className="flex justify-between items-center pt-3 border-t border-slate-800">
        <p className="text-[11px] text-slate-400">
          Kamera otomatis tetap terbuka & memindai tanpa henti.
        </p>
        {onClose && (
          <button
            onClick={handleFinishScan}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold transition-all cursor-pointer shadow-lg flex items-center gap-1.5"
          >
            <span>Selesai Scan (Keluar Layar Penuh)</span>
          </button>
        )}
      </div>
    </div>
  );

  if (isInline) {
    return scannerContent;
  }

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-3 sm:p-6 overflow-y-auto w-full h-full min-h-screen">
      {scannerContent}
    </div>
  );
};
