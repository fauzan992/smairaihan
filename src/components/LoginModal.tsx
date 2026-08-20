import React, { useState, useEffect } from 'react';
import { User, SchoolSettings } from '../types';
import { apiService } from '../services/apiService';
import { Heart, Key, Lock, UserCheck, AlertCircle, Phone, Search, ShieldCheck, HelpCircle, CheckCircle2, ChevronRight, ArrowRight, User as UserIcon, Calendar } from 'lucide-react';
import { SchoolLogo } from './SchoolLogo';

interface LoginModalProps {
  onLoginSuccess: (user: User) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onLoginSuccess }) => {
  // 2 main form types: 'staff' (Guru/Admin) and 'wali' (Wali Murid)
  const [formType, setFormType] = useState<'staff' | 'wali'>('staff');
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [settings, setSettings] = useState<SchoolSettings | null>(null);

  // Secure Verification Panel for Wali Murid (Nama Siswa + Tanggal Lahir)
  const [showVerifyMode, setShowVerifyMode] = useState(false);
  const [verifyStudentName, setVerifyStudentName] = useState('');
  const [verifyBirthDate, setVerifyBirthDate] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifySuccessInfo, setVerifySuccessInfo] = useState<{ name: string; className: string } | null>(null);

  useEffect(() => {
    apiService.getSettings().then(res => {
      if (res.success && res.settings) {
        setSettings(res.settings);
      }
    });

    const handleSettingsEvent = (e: Event) => {
      const customEvent = e as CustomEvent<SchoolSettings>;
      if (customEvent.detail) {
        setSettings(customEvent.detail);
      }
    };

    window.addEventListener('school-settings-updated', handleSettingsEvent);
    return () => {
      window.removeEventListener('school-settings-updated', handleSettingsEvent);
    };
  }, []);

  const handleFormTypeChange = (type: 'staff' | 'wali') => {
    setFormType(type);
    setErrorMsg(null);
    setShowVerifyMode(false);
    setVerifyError(null);
    setUsername('');
    setPassword('');
  };

  const handleDirectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    setLoading(true);
    setErrorMsg(null);

    const activeRole = formType === 'wali' ? 'wali' : 'staff';
    const res = await apiService.login(activeRole, username.trim(), formType === 'wali' ? '' : password);
    setLoading(false);

    if (res.success && res.user) {
      onLoginSuccess(res.user);
    } else {
      setErrorMsg(res.error || 'Login gagal. Periksa kembali NISN / No. WhatsApp atau password Anda.');
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyStudentName.trim() || !verifyBirthDate.trim()) {
      setVerifyError('Nama Siswa dan Tanggal Lahir Siswa wajib diisi.');
      return;
    }

    setVerifyLoading(true);
    setVerifyError(null);

    const res = await apiService.verifyWaliStudent({
      studentName: verifyStudentName.trim(),
      birthDate: verifyBirthDate.trim()
    });

    setVerifyLoading(false);

    if (res.success && res.user) {
      setVerifySuccessInfo({
        name: res.studentInfo?.name || res.user.childName || verifyStudentName,
        className: res.studentInfo?.className || res.user.className || ''
      });
      setTimeout(() => {
        onLoginSuccess(res.user!);
      }, 1000);
    } else {
      setVerifyError(res.error || 'Data verifikasi tidak cocok dengan database sekolah.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 md:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
        
        {/* Modal Banner Header */}
        <div className="bg-gradient-to-br from-emerald-800 via-teal-800 to-emerald-900 p-5 md:p-6 text-white text-center relative overflow-hidden">
          <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/5 rounded-full blur-xl pointer-events-none"></div>
          <div className="flex justify-center mb-3">
            <SchoolLogo size={60} />
          </div>
          <h2 className="font-extrabold text-base md:text-lg tracking-wide uppercase text-amber-300">
            {settings?.namaSekolah || "SMA ISLAM RA'IYATUL HUSNAN"}
          </h2>
          <p className="text-xs text-emerald-100/90 mt-1">Aplikasi Presensi Barcode Digital NISN</p>
        </div>

        <div className="p-5 md:p-6">
          {/* Main 2 Forms Switcher Tabs */}
          <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-2xl mb-5 border border-slate-200/80">
            <button
              type="button"
              onClick={() => handleFormTypeChange('staff')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-extrabold rounded-xl transition-all cursor-pointer ${
                formType === 'staff'
                  ? 'bg-emerald-800 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <UserCheck className="w-4 h-4 text-amber-300" />
              <span>Guru / Admin</span>
            </button>

            <button
              type="button"
              onClick={() => handleFormTypeChange('wali')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-extrabold rounded-xl transition-all cursor-pointer ${
                formType === 'wali'
                  ? 'bg-emerald-800 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Heart className="w-4 h-4 text-rose-300" />
              <span>Wali Murid</span>
            </button>
          </div>

          {/* ======================================================== */}
          {/* FORM: GURU & ADMIN */}
          {/* ======================================================== */}
          {formType === 'staff' && (
            <form onSubmit={handleDirectSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Username / NIP
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Masukkan Username atau NIP (Cth: admin / ahmad)"
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan password..."
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-slate-900"
                  />
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold rounded-xl text-xs shadow-md transition-all active:scale-98 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {loading ? 'Memproses Authentikasi...' : (
                  <>
                    <UserCheck className="w-4 h-4 text-amber-300" />
                    <span>MASUK SEBAGAI GURU / ADMIN</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* ======================================================== */}
          {/* FORM: WALI MURID (PRIVACY-PRESERVED & SMART LOGIN) */}
          {/* ======================================================== */}
          {formType === 'wali' && (
            <div className="space-y-4">
              {!showVerifyMode ? (
                /* MODE A: DIRECT LOGIN (NISN ATAU NO HP / WHATSAPP WALI) */
                <form onSubmit={handleDirectSubmit} className="space-y-3.5">
                  <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs text-emerald-900 font-medium flex items-start gap-2.5">
                    <Heart className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-bold text-emerald-950">Akses Mandiri Wali Murid</p>
                      <p className="text-[11px] text-emerald-800 mt-0.5 leading-snug">
                        Bisa masuk menggunakan <strong>NISN Siswa</strong> atau <strong>Nomor WhatsApp Wali</strong> yang terdaftar di sekolah (tanpa password).
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      NISN Siswa / No. WhatsApp Wali Terdaftar*
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Ketik 10 digit NISN atau No. HP (Cth: 0812...)"
                        className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 text-slate-900 bg-white"
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Contoh: <code className="bg-slate-100 px-1 py-0.5 rounded text-emerald-800 font-mono">0061234501</code> atau <code className="bg-slate-100 px-1 py-0.5 rounded text-emerald-800 font-mono">081234567890</code>
                    </p>
                  </div>

                  {errorMsg && (
                    <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || !username.trim()}
                    className="w-full py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold rounded-xl text-xs shadow-md transition-all active:scale-98 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                  >
                    {loading ? 'Memeriksa Data Siswa...' : (
                      <>
                        <Heart className="w-4 h-4 text-rose-300" />
                        <span>MASUK SEBAGAI WALI MURID</span>
                      </>
                    )}
                  </button>

                  {/* PRIVACY-SAFE RECOVERY LINK */}
                  <div className="pt-2 border-t border-slate-100 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setShowVerifyMode(true);
                        setErrorMsg(null);
                        setVerifyError(null);
                      }}
                      className="text-xs font-bold text-emerald-800 hover:text-emerald-950 inline-flex items-center gap-1.5 cursor-pointer underline underline-offset-4 decoration-amber-500 hover:decoration-emerald-700"
                    >
                      <Search className="w-3.5 h-3.5 text-amber-600" />
                      <span>Lupa NISN? Masuk dengan Nama Siswa & Tanggal Lahir</span>
                    </button>
                  </div>
                </form>
              ) : (
                /* MODE B: SECURE TARGETED VERIFICATION (NAMA SISWA + TANGGAL LAHIR) */
                <form onSubmit={handleVerifySubmit} className="space-y-3.5 bg-gradient-to-b from-slate-50 to-emerald-50/30 p-4 rounded-2xl border-2 border-emerald-600/30 animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-emerald-800 text-amber-300 rounded-lg">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-black text-xs text-slate-900">
                          Verifikasi Identitas Siswa
                        </h3>
                        <p className="text-[10px] text-slate-500 font-medium">
                          Pencocokan nama lengkap & tanggal lahir terdaftar
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                      1. Nama Lengkap Anak / Siswa*
                    </label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={verifyStudentName}
                        onChange={(e) => setVerifyStudentName(e.target.value)}
                        placeholder="Masukkan nama lengkap anak Anda..."
                        className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                      2. Tanggal Lahir Siswa*
                    </label>
                    <div className="relative">
                      <Calendar className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="date"
                        required
                        value={verifyBirthDate}
                        onChange={(e) => setVerifyBirthDate(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-600 font-sans"
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Pilih tanggal lahir siswa sesuai akta lahir / rapor / database sekolah.
                    </p>
                  </div>

                  {verifySuccessInfo && (
                    <div className="p-3 bg-emerald-100 border border-emerald-300 text-emerald-950 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                      <div>
                        <p className="font-extrabold">Data Terverifikasi!</p>
                        <p className="text-[11px] text-emerald-800">
                          Membuka dashboard {verifySuccessInfo.name} ({verifySuccessInfo.className})...
                        </p>
                      </div>
                    </div>
                  )}

                  {verifyError && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span className="text-[11px] leading-snug">{verifyError}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowVerifyMode(false);
                        setVerifyError(null);
                      }}
                      className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-colors"
                    >
                      Kembali
                    </button>
                    <button
                      type="submit"
                      disabled={verifyLoading || !verifyStudentName.trim() || !verifyBirthDate.trim()}
                      className="flex-1 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold rounded-xl text-xs shadow-md transition-all active:scale-98 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      {verifyLoading ? 'Memverifikasi...' : (
                        <>
                          <ShieldCheck className="w-3.5 h-3.5 text-amber-300" />
                          <span>Verifikasi & Masuk</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
