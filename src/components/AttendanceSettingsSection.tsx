import React, { useState, useEffect } from 'react';
import { SchoolSettings, HolidayConfig } from '../types';
import { apiService } from '../services/apiService';
import {
  Clock, Calendar, AlertTriangle, CheckCircle2, Plus, Trash2, Save,
  Shield, Sun, Moon, Sparkles, RefreshCw, AlertCircle, ToggleLeft, ToggleRight,
  HelpCircle, CalendarCheck, DoorOpen, Building2, Image as ImageIcon,
  MapPin, Phone, Mail, Globe, Award, UserCheck, Upload, X
} from 'lucide-react';
import { SchoolLogo } from './SchoolLogo';

interface AttendanceSettingsSectionProps {
  onSettingsUpdated?: () => void;
}

export const AttendanceSettingsSection: React.FC<AttendanceSettingsSectionProps> = ({
  onSettingsUpdated
}) => {
  const [activeTab, setActiveTab] = useState<'identity' | 'attendance'>('identity');

  const [settings, setSettings] = useState<SchoolSettings>({
    namaSekolah: "SMA ISLAM RA'IYATUL HUSNAN",
    subNamaSekolah: "WRINGIN BONDOWOSO",
    npsn: "20521620",
    nss: "302052202010",
    akreditasi: "B",
    alamat: "Jl. Raya Wringin No. 45",
    desaKelurahan: "Wringin",
    kecamatan: "Wringin",
    kabupatenKota: "Bondowoso",
    provinsi: "Jawa Timur",
    kodePos: "68252",
    telepon: "(0332) 421xxx / 081234567890",
    email: "smaislam.raiyatulhusnan@gmail.sch.id",
    website: "www.smaislam-raiyatulhusnan.sch.id",
    logoUrl: "/school-logo.png",
    namaKepalaSekolah: "SAIFURRAHMAN, SH",
    nipKepalaSekolah: "",
    naunganYayasan: "Yayasan Ra'iyatul Husnan Wringin",

    jamMasuk: '07:00',
    batasTerlambat: '07:15',
    jamPulang: '14:00',
    batasPulang: '16:00',
    hariLiburRutin: [0, 6],
    hariLiburKhusus: [
      { id: 'hol-1', date: '2026-08-17', name: 'HUT Kemerdekaan RI ke-81', isNational: true },
      { id: 'hol-2', date: '2026-05-01', name: 'Hari Buruh Nasional', isNational: true },
      { id: 'hol-3', date: '2026-06-01', name: 'Hari Lahir Pancasila', isNational: true },
      { id: 'hol-4', date: '2026-12-25', name: 'Hari Raya Natal & Libur Semester', isNational: true }
    ],
    allowAbsenLibur: false
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form state for adding custom holiday
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayName, setNewHolidayName] = useState('');
  const [newHolidayIsNational, setNewHolidayIsNational] = useState(false);

  const daysList = [
    { num: 0, label: 'Minggu' },
    { num: 1, label: 'Senin' },
    { num: 2, label: 'Selasa' },
    { num: 3, label: 'Rabu' },
    { num: 4, label: 'Kamis' },
    { num: 5, label: 'Jumat' },
    { num: 6, label: 'Sabtu' },
  ];

  const fetchSettings = async () => {
    setLoading(true);
    const res = await apiService.getSettings();
    setLoading(false);
    if (res.success && res.settings) {
      setSettings(res.settings);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = await apiService.updateSettings(settings);
    setSaving(false);

    if (res.success && res.settings) {
      setSettings(res.settings);
      setSuccessMsg(res.message || 'Pengaturan identitas & presensi sekolah berhasil disimpan!');
      if (onSettingsUpdated) onSettingsUpdated();
      setTimeout(() => setSuccessMsg(null), 4000);
    } else {
      setErrorMsg(res.error || 'Gagal menyimpan pengaturan.');
    }
  };

  const logoInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Ukuran file logo terlalu besar. Maksimal 5MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setSettings(prev => ({ ...prev, logoUrl: reader.result as string }));
        }
      };
      reader.readAsDataURL(file);
    }
    // Reset file input value so selecting the same file triggers onChange again
    if (e.target) {
      e.target.value = '';
    }
  };

  const handleResetLogo = () => {
    setSettings(prev => ({ ...prev, logoUrl: '/school-logo.png' }));
  };

  const handleToggleRoutineDay = (dayNum: number) => {
    const current = [...settings.hariLiburRutin];
    if (current.includes(dayNum)) {
      setSettings({
        ...settings,
        hariLiburRutin: current.filter(d => d !== dayNum)
      });
    } else {
      setSettings({
        ...settings,
        hariLiburRutin: [...current, dayNum].sort()
      });
    }
  };

  const handleAddHoliday = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHolidayDate || !newHolidayName) return;

    // Check duplicate date
    if (settings.hariLiburKhusus.some(h => h.date === newHolidayDate)) {
      alert('Tanggal libur ini sudah terdaftar.');
      return;
    }

    const newHol: HolidayConfig = {
      id: `hol-${Date.now()}`,
      date: newHolidayDate,
      name: newHolidayName.trim(),
      isNational: newHolidayIsNational
    };

    setSettings({
      ...settings,
      hariLiburKhusus: [...settings.hariLiburKhusus, newHol].sort((a, b) => a.date.localeCompare(b.date))
    });

    setNewHolidayDate('');
    setNewHolidayName('');
    setNewHolidayIsNational(false);
  };

  const handleDeleteHoliday = (id: string) => {
    setSettings({
      ...settings,
      hariLiburKhusus: settings.hariLiburKhusus.filter(h => h.id !== id)
    });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-xs flex flex-col items-center justify-center gap-3">
        <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
        <p className="text-xs font-semibold text-slate-600">Memuat Pengaturan Identitas & Presensi Sekolah...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 text-white rounded-2xl p-5 md:p-6 shadow-md border border-emerald-700/60 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-1/4 -translate-y-1/4 w-72 h-72 bg-amber-400/10 rounded-full blur-2xl pointer-events-none"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 bg-amber-400 text-slate-950 font-black text-[10px] rounded-full uppercase tracking-wider">
                Konfigurasi Instansi Sekolah
              </span>
              <span className="text-emerald-300 text-xs font-semibold">• Profil & Jam Operasional</span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white flex items-center gap-2.5">
              <Building2 className="w-6 h-6 text-amber-300 shrink-0" />
              <span>Pengaturan Identitas & Presensi Sekolah</span>
            </h2>
            <p className="text-xs text-emerald-100/90 mt-1 max-w-2xl leading-relaxed">
              Kelola logo sekolah, nama instansi, alamat, kepala sekolah, batas jam masuk/terlambat, serta kalender hari libur sekolah.
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-xs shadow-md transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>SIMPAN PERUBAHAN</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tabs Switcher Bar */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('identity')}
          className={`px-4 py-2.5 rounded-xl font-extrabold text-xs transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'identity'
              ? 'bg-emerald-800 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Building2 className="w-4 h-4 text-amber-300" />
          <span>1. Identitas & Profil Sekolah</span>
        </button>

        <button
          onClick={() => setActiveTab('attendance')}
          className={`px-4 py-2.5 rounded-xl font-extrabold text-xs transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'attendance'
              ? 'bg-emerald-800 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Clock className="w-4 h-4 text-amber-300" />
          <span>2. Jam Presensi & Hari Libur</span>
        </button>
      </div>

      {/* Alert Notifications */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-3 shadow-2xs animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-3 shadow-2xs animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* TAB 1: IDENTITAS SEKOLAH */}
      {activeTab === 'identity' && (
        <div className="space-y-6">
          {/* Card 1: Logo & Preview Banner Identitas */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl">
                <ImageIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-800">Logo & Nama Resmi Sekolah</h3>
                <p className="text-[11px] text-slate-500">Unggah logo resmi sekolah dan atur nama instansi yang tampil pada cetak kartu pelajar, kop laporan & navbar.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              {/* Logo Upload Section */}
              <div className="md:col-span-4 bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col items-center justify-center text-center space-y-3">
                <p className="text-xs font-bold text-slate-700">Logo Resmi Sekolah</p>
                <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-center">
                  <SchoolLogo size={96} logoUrl={settings.logoUrl} schoolName={settings.namaSekolah} subName={settings.subNamaSekolah} />
                </div>
                
                <input
                  type="file"
                  ref={logoInputRef}
                  accept="image/*"
                  id="school-logo-input"
                  onChange={handleLogoFileChange}
                  className="hidden"
                />
                <div className="flex flex-col gap-2 w-full">
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="w-full px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs shadow-2xs cursor-pointer flex items-center justify-center gap-1.5 transition-all active:scale-98"
                  >
                    <Upload className="w-3.5 h-3.5" /> Unggah Logo Baru
                  </button>
                  <button
                    type="button"
                    onClick={handleResetLogo}
                    className="w-full px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-xl text-[11px] cursor-pointer transition-all active:scale-98"
                  >
                    Reset ke Logo Default
                  </button>
                </div>
                <p className="text-[10px] text-slate-400">Format: PNG, JPG, WebP (Maksimal 5MB)</p>
              </div>

              {/* Form Input Main Identity */}
              <div className="md:col-span-8 space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nama Utama Sekolah*</label>
                  <input
                    type="text"
                    required
                    value={settings.namaSekolah || ''}
                    onChange={(e) => setSettings({ ...settings, namaSekolah: e.target.value })}
                    placeholder="Contoh: SMA ISLAM RA'IYATUL HUSNAN"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-black text-sm text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/20"
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5">Nama resmi sekolah yang tercetak di kartu pelajar, kop surat, dan kuitansi.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Sub-Nama / Slogan Lokasi</label>
                    <input
                      type="text"
                      value={settings.subNamaSekolah || ''}
                      onChange={(e) => setSettings({ ...settings, subNamaSekolah: e.target.value })}
                      placeholder="Contoh: WRINGIN BONDOWOSO"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Naungan Yayasan / Instansi</label>
                    <input
                      type="text"
                      value={settings.naunganYayasan || ''}
                      onChange={(e) => setSettings({ ...settings, naunganYayasan: e.target.value })}
                      placeholder="Yayasan Ra'iyatul Husnan Wringin"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">NPSN</label>
                    <input
                      type="text"
                      value={settings.npsn || ''}
                      onChange={(e) => setSettings({ ...settings, npsn: e.target.value })}
                      placeholder="20521620"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">NSS</label>
                    <input
                      type="text"
                      value={settings.nss || ''}
                      onChange={(e) => setSettings({ ...settings, nss: e.target.value })}
                      placeholder="302052202010"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Akreditasi</label>
                    <select
                      value={settings.akreditasi || 'B'}
                      onChange={(e) => setSettings({ ...settings, akreditasi: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold bg-white text-slate-800"
                    >
                      <option value="A">A (Sangat Baik)</option>
                      <option value="B">B (Baik)</option>
                      <option value="C">C (Cukup)</option>
                      <option value="Belum">Belum Terakreditasi</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Alamat Lengkap & Kontak */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="p-2.5 bg-sky-100 text-sky-800 rounded-xl">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-800">Alamat Lengkap & Kontak Informasi</h3>
                <p className="text-[11px] text-slate-500">Gunakan data valid untuk kop laporan resmi & komunikasi wali murid.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Alamat Jalan / Gedung*</label>
                  <input
                    type="text"
                    value={settings.alamat || ''}
                    onChange={(e) => setSettings({ ...settings, alamat: e.target.value })}
                    placeholder="Jl. Raya Wringin No. 45"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Desa / Kelurahan</label>
                    <input
                      type="text"
                      value={settings.desaKelurahan || ''}
                      onChange={(e) => setSettings({ ...settings, desaKelurahan: e.target.value })}
                      placeholder="Wringin"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Kecamatan</label>
                    <input
                      type="text"
                      value={settings.kecamatan || ''}
                      onChange={(e) => setSettings({ ...settings, kecamatan: e.target.value })}
                      placeholder="Wringin"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Kabupaten / Kota</label>
                    <input
                      type="text"
                      value={settings.kabupatenKota || ''}
                      onChange={(e) => setSettings({ ...settings, kabupatenKota: e.target.value })}
                      placeholder="Bondowoso"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Provinsi</label>
                    <input
                      type="text"
                      value={settings.provinsi || ''}
                      onChange={(e) => setSettings({ ...settings, provinsi: e.target.value })}
                      placeholder="Jawa Timur"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Kode Pos</label>
                    <input
                      type="text"
                      value={settings.kodePos || ''}
                      onChange={(e) => setSettings({ ...settings, kodePos: e.target.value })}
                      placeholder="68252"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-500" /> No. Telepon / WhatsApp
                  </label>
                  <input
                    type="text"
                    value={settings.telepon || ''}
                    onChange={(e) => setSettings({ ...settings, telepon: e.target.value })}
                    placeholder="(0332) 421xxx / 081234567890"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-500" /> Email Resmi Sekolah
                  </label>
                  <input
                    type="email"
                    value={settings.email || ''}
                    onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                    placeholder="smaislam.raiyatulhusnan@gmail.sch.id"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-slate-500" /> Website Resmi / Portal
                  </label>
                  <input
                    type="text"
                    value={settings.website || ''}
                    onChange={(e) => setSettings({ ...settings, website: e.target.value })}
                    placeholder="www.smaislam-raiyatulhusnan.sch.id"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Data Kepala Sekolah */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="p-2.5 bg-amber-100 text-amber-800 rounded-xl">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-800">Identitas Kepala Sekolah</h3>
                <p className="text-[11px] text-slate-500">Tampil pada lembar penandatanganan rekap absensi & laporan resmi.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Lengkap & Gelar Kepala Sekolah</label>
                <input
                  type="text"
                  value={settings.namaKepalaSekolah || ''}
                  onChange={(e) => setSettings({ ...settings, namaKepalaSekolah: e.target.value })}
                  placeholder="SAIFURRAHMAN, SH"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">NIP / NIDN Kepala Sekolah</label>
                <input
                  type="text"
                  value={settings.nipKepalaSekolah || ''}
                  onChange={(e) => setSettings({ ...settings, nipKepalaSekolah: e.target.value })}
                  placeholder="Dikosongkan jika tidak ada NIP"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold text-slate-800"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: JAM PRESENSI & HARI LIBUR */}
      {activeTab === 'attendance' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* COLUMN 1: BATAS JAM ABSENSI & PULANG */}
          <div className="space-y-6">
            {/* Card 1: Batas Jam Masuk & Terlambat */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl">
                  <Sun className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-800">1. Batas Jam Presensi Masuk</h3>
                  <p className="text-[11px] text-slate-500">Tentukan jam mulai masuk & batas waktu tepat waktu (terlambat).</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">Jam Masuk Sekolah</label>
                  <div className="relative">
                    <Clock className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="time"
                      value={settings.jamMasuk}
                      onChange={(e) => setSettings({ ...settings, jamMasuk: e.target.value })}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500">Waktu dimulainya pembelajaran kelas.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-rose-700">Batas Jam Terlambat*</label>
                  <div className="relative">
                    <AlertTriangle className="w-4 h-4 absolute left-3 top-2.5 text-rose-500" />
                    <input
                      type="time"
                      value={settings.batasTerlambat}
                      onChange={(e) => setSettings({ ...settings, batasTerlambat: e.target.value })}
                      className="w-full pl-9 pr-3 py-2 bg-rose-50/50 border border-rose-300 rounded-xl text-xs font-bold text-rose-900 focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-600/20"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500">Scan setelah jam ini otomatis berstatus <span className="text-rose-600 font-bold">Terlambat</span>.</p>
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Simulasi Toleransi Terlambat:</span> Jika siswa scan presensi pada pukul <strong>{settings.batasTerlambat} WIB</strong> atau lebih awal, maka presensi dicatat Tepat Waktu. Jika scan jam <strong>{settings.batasTerlambat.split(':').map((v, i) => i === 1 ? String(Number(v) + 1).padStart(2, '0') : v).join(':')} WIB</strong> ke atas, sistem secara otomatis melabeli <span className="font-bold text-rose-700">[TERLAMBAT]</span>.
                </div>
              </div>
            </div>

            {/* Card 2: Waktu & Jam Pulang */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <div className="p-2.5 bg-amber-100 text-amber-800 rounded-xl">
                  <DoorOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-800">2. Pengaturan Jam Pulang Sekolah</h3>
                  <p className="text-[11px] text-slate-500">Atur jam minimal siswa diizinkan presensi kepulangan.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">Jam Mulai Pulang Sekolah</label>
                  <div className="relative">
                    <Clock className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="time"
                      value={settings.jamPulang}
                      onChange={(e) => setSettings({ ...settings, jamPulang: e.target.value })}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500">Absen pulang sebelum jam ini dicatat <span className="text-amber-700 font-bold">Pulang Awal</span>.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">Batas Akhir Jam Pulang</label>
                  <div className="relative">
                    <Moon className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="time"
                      value={settings.batasPulang}
                      onChange={(e) => setSettings({ ...settings, batasPulang: e.target.value })}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500">Batas toleransi maksimal waktu kepulangan.</p>
                </div>
              </div>
            </div>
          </div>

          {/* COLUMN 2: HARI LIBUR RUTIN & HARI LIBUR KHUSUS */}
          <div className="space-y-6">
            {/* Card 3: Hari Libur Rutin Mingguan */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <div className="p-2.5 bg-sky-100 text-sky-800 rounded-xl">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-800">3. Jadwal Hari Libur Rutin (Mingguan)</h3>
                  <p className="text-[11px] text-slate-500">Pilih hari-hari libur tetap sekolah dalam setiap pekan.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {daysList.map((day) => {
                  const isChecked = settings.hariLiburRutin.includes(day.num);
                  return (
                    <button
                      key={day.num}
                      type="button"
                      onClick={() => handleToggleRoutineDay(day.num)}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                        isChecked
                          ? 'bg-rose-50 border-rose-300 text-rose-800 shadow-2xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <span>{day.label}</span>
                      {isChecked ? (
                        <span className="text-[9px] bg-rose-600 text-white font-extrabold px-1.5 py-0.5 rounded-md">
                          LIBUR
                        </span>
                      ) : (
                        <span className="text-[9px] text-slate-400">Masuk</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Kebijakan Scan di Hari Libur */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold text-slate-800">Blokir Absensi Pada Hari Libur</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, allowAbsenLibur: !settings.allowAbsenLibur })}
                    className="cursor-pointer text-emerald-700"
                  >
                    {settings.allowAbsenLibur ? (
                      <ToggleRight className="w-7 h-7 text-amber-600" />
                    ) : (
                      <ToggleLeft className="w-7 h-7 text-emerald-600" />
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-slate-600 leading-snug">
                  {settings.allowAbsenLibur ? (
                    <span className="text-amber-700 font-semibold">⚠️ Izinkan Scan Libur: Barcode scan tetap akan memproses presensi meskipun pada tanggal/hari libur.</span>
                  ) : (
                    <span className="text-emerald-700 font-semibold">🔒 Proteksi Aktif: Barcode scan akan menolak presensi jika tanggal termasuk hari libur rutin/khusus.</span>
                  )}
                </p>
              </div>
            </div>

            {/* Card 4: Hari Libur Khusus / Nasional */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-rose-100 text-rose-800 rounded-xl">
                    <CalendarCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-800">4. Hari Libur Khusus & Nasional</h3>
                    <p className="text-[11px] text-slate-500">Daftar tanggal libur tertentu (HUT RI, Cuti Bersama, dll).</p>
                  </div>
                </div>
              </div>

              {/* Form Tambah Libur Khusus */}
              <form onSubmit={handleAddHoliday} className="bg-slate-50 border border-slate-200 p-3 rounded-xl space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">Tanggal Libur*</label>
                    <input
                      type="date"
                      required
                      value={newHolidayDate}
                      onChange={(e) => setNewHolidayDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">Nama Hari Libur / Keterangan*</label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: HUT RI ke-81 / Cuti Bersama"
                      value={newHolidayName}
                      onChange={(e) => setNewHolidayName(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-slate-700 font-medium">
                    <input
                      type="checkbox"
                      checked={newHolidayIsNational}
                      onChange={(e) => setNewHolidayIsNational(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Libur Nasional Resmi</span>
                  </label>

                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs cursor-pointer flex items-center gap-1 shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Tanggal Libur</span>
                  </button>
                </div>
              </form>

              {/* Table / List Hari Libur Khusus */}
              <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 text-xs">
                {settings.hariLiburKhusus.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 font-medium text-xs">
                    Belum ada daftar hari libur khusus yang ditambahkan.
                  </div>
                ) : (
                  settings.hariLiburKhusus.map((hol) => (
                    <div key={hol.id} className="p-3 hover:bg-slate-50/80 flex items-center justify-between gap-3 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="px-2 py-1 bg-rose-100 text-rose-800 font-mono font-bold rounded-md text-[11px]">
                          {hol.date}
                        </div>
                        <div>
                          <p className="font-extrabold text-slate-800">{hol.name}</p>
                          <p className="text-[10px] text-slate-500">
                            {hol.isNational ? 'Libur Nasional' : 'Libur Khusus Sekolah'}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteHoliday(hol.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-all"
                        title="Hapus Tanggal Libur"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
