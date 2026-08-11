import React, { useState, useEffect } from 'react';
import { Database, CheckCircle2, AlertCircle, RefreshCw, Upload, Download, Copy, ExternalLink, Key, Link as LinkIcon, Server } from 'lucide-react';
import {
  getStoredSupabaseConfig,
  setStoredSupabaseConfig,
  testBrowserSupabaseConnection,
  pushAllFromBrowser,
  pullAllFromBrowser
} from '../services/clientSupabase';
import { apiService } from '../services/apiService';

interface SupabaseConfigState {
  url: string;
  anonKey: string;
  autoSync: boolean;
  lastSyncTime?: string;
  status: 'connected' | 'disconnected' | 'unconfigured' | 'error';
  errorMessage?: string;
}

interface SupabaseManagerProps {
  onRefreshMasterData?: () => void;
}

const DEFAULT_SQL_SCHEMA = `-- SQL Schema Setup for SMA Islam Ra'iyatul Husnan Attendance System

-- 1. Table: classes
CREATE TABLE IF NOT EXISTS classes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  grade_level TEXT,
  teacher_id TEXT,
  teacher_name TEXT,
  student_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Table: teachers
CREATE TABLE IF NOT EXISTS teachers (
  id TEXT PRIMARY KEY,
  nip TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  gender TEXT DEFAULT 'L',
  username TEXT NOT NULL,
  password TEXT,
  subject TEXT,
  role TEXT DEFAULT 'guru',
  assigned_class_id TEXT,
  assigned_class_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Table: students
CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  nisn TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  gender TEXT DEFAULT 'L',
  class_id TEXT NOT NULL,
  class_name TEXT NOT NULL,
  parent_name TEXT,
  parent_phone TEXT,
  photo_url TEXT,
  default_password TEXT DEFAULT '123',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure missing columns exist for existing tables
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'guru';
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS password TEXT;

ALTER TABLE students ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS default_password TEXT DEFAULT '123';
ALTER TABLE students ADD COLUMN IF NOT EXISTS parent_name TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS parent_phone TEXT;

ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_out_time TEXT;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_out_status TEXT;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_out_by TEXT;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS recorded_by_role TEXT;

-- 4. Table: attendance
CREATE TABLE IF NOT EXISTS attendance (
  id TEXT PRIMARY KEY,
  nisn TEXT NOT NULL,
  student_name TEXT NOT NULL,
  class_id TEXT NOT NULL,
  class_name TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  status TEXT NOT NULL,
  notes TEXT,
  recorded_by TEXT DEFAULT 'Scan QR Code',
  recorded_by_role TEXT DEFAULT 'admin',
  check_out_time TEXT,
  check_out_status TEXT,
  check_out_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Table: school_settings
CREATE TABLE IF NOT EXISTS school_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  nama_sekolah TEXT,
  sub_nama_sekolah TEXT,
  npsn TEXT,
  nss TEXT,
  akreditasi TEXT,
  alamat TEXT,
  desa_kelurahan TEXT,
  kecamatan TEXT,
  kabupaten_kota TEXT,
  provinsi TEXT,
  kode_pos TEXT,
  telepon TEXT,
  email TEXT,
  website TEXT,
  logo_url TEXT,
  nama_kepala_sekolah TEXT,
  nip_kepala_sekolah TEXT,
  naungan_yayasan TEXT,
  jam_masuk TEXT,
  batas_terlambat TEXT,
  jam_pulang TEXT,
  batas_pulang TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);`;

export const SupabaseManager: React.FC<SupabaseManagerProps> = ({ onRefreshMasterData }) => {
  const [config, setConfig] = useState<SupabaseConfigState>({
    url: '',
    anonKey: '',
    autoSync: true,
    status: 'unconfigured'
  });

  const [sqlSchema, setSqlSchema] = useState<string>(DEFAULT_SQL_SCHEMA);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [showSqlModal, setShowSqlModal] = useState<boolean>(false);
  const [copiedSql, setCopiedSql] = useState<boolean>(false);

  // Load config and schema on mount
  useEffect(() => {
    fetchSupabaseConfig();
  }, []);

  const fetchSupabaseConfig = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/supabase/config');
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data) {
          setConfig({
            url: data.url || '',
            anonKey: data.anonKey || '',
            autoSync: data.autoSync ?? true,
            lastSyncTime: data.lastSyncTime,
            status: data.status || 'unconfigured',
            errorMessage: data.errorMessage
          });
          if (data.schema) setSqlSchema(data.schema);
          return;
        }
      }
    } catch (err: any) {
      console.warn('Backend /api/supabase/config unavailable, using client storage fallback:', err?.message);
    } finally {
      setIsLoading(false);
    }

    // Fallback: Read client-side stored configuration
    const stored = getStoredSupabaseConfig();
    setConfig(stored);
    setSqlSchema(DEFAULT_SQL_SCHEMA);
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsTesting(true);
    setStatusMessage({ type: 'info', text: 'Menghubungkan & menguji koneksi ke Supabase Database...' });

    const trimmedUrl = config.url.trim();
    const trimmedKey = config.anonKey.trim();

    // 1. Try server endpoint first if available
    try {
      const res = await fetch('/api/supabase/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: trimmedUrl,
          anonKey: trimmedKey,
          autoSync: config.autoSync
        })
      });

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (res.ok && data.success) {
          setConfig(prev => ({
            ...prev,
            status: data.status || 'connected',
            errorMessage: undefined
          }));
          setStoredSupabaseConfig(trimmedUrl, trimmedKey, config.autoSync);
          setStatusMessage({ type: 'success', text: data.message || 'Koneksi ke Supabase Database berhasil!' });
          setIsTesting(false);
          return;
        } else if (data.error) {
          setConfig(prev => ({
            ...prev,
            status: 'error',
            errorMessage: data.error
          }));
          setStatusMessage({ type: 'error', text: data.error });
          setIsTesting(false);
          return;
        }
      }
    } catch (err: any) {
      console.warn('Server API unreachable or non-JSON, switching to browser direct Supabase test:', err?.message);
    }

    // 2. Client Direct Connection Fallback (Ideal for Vercel Static Deployments)
    try {
      const testResult = await testBrowserSupabaseConnection(trimmedUrl, trimmedKey);
      if (testResult.success) {
        setStoredSupabaseConfig(trimmedUrl, trimmedKey, config.autoSync);
        setConfig(prev => ({
          ...prev,
          status: 'connected',
          errorMessage: undefined
        }));
        setStatusMessage({ type: 'success', text: `${testResult.message} (Client Direct Connection)` });
      } else {
        setConfig(prev => ({
          ...prev,
          status: 'error',
          errorMessage: testResult.message
        }));
        setStatusMessage({ type: 'error', text: testResult.message });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Terjadi kesalahan koneksi Supabase: ${err.message}` });
    } finally {
      setIsTesting(false);
    }
  };

  const handlePushData = async () => {
    setIsLoading(true);
    setStatusMessage({ type: 'info', text: 'Mengirim seluruh data sekolah & log presensi ke Supabase...' });

    // Try server push endpoint first
    try {
      const res = await fetch('/api/supabase/push', { method: 'POST' });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (res.ok && data.success) {
          setStatusMessage({ type: 'success', text: data.message });
          fetchSupabaseConfig();
          setIsLoading(false);
          return;
        }
      }
    } catch (err: any) {
      console.warn('Server push endpoint unavailable, using direct client push fallback:', err?.message);
    }

    // Client Direct Push Fallback
    try {
      const masterData = await apiService.getMasterData();
      const attendanceRes = await apiService.getAttendance({});
      const pushRes = await pushAllFromBrowser(config.url, config.anonKey, {
        classes: masterData.classes || [],
        teachers: masterData.teachers || [],
        students: masterData.students || [],
        attendance: attendanceRes.records || []
      });

      if (pushRes.success) {
        setStatusMessage({ type: 'success', text: pushRes.message || 'Berhasil ekspor data ke Supabase.' });
        fetchSupabaseConfig();
      } else {
        setStatusMessage({ type: 'error', text: pushRes.error || 'Gagal ekspor data ke Supabase.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Gagal mengirim data: ${err.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePullData = async () => {
    if (!window.confirm('Apakah Anda yakin ingin mengimpor data dari Supabase? Data lokal di aplikasi akan diperbarui.')) {
      return;
    }

    setIsLoading(true);
    setStatusMessage({ type: 'info', text: 'Mengambil data terbaru dari Supabase Database...' });

    // Try server pull endpoint first
    try {
      const res = await fetch('/api/supabase/pull', { method: 'POST' });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (res.ok && data.success) {
          setStatusMessage({ type: 'success', text: data.message });
          fetchSupabaseConfig();
          if (onRefreshMasterData) onRefreshMasterData();
          setIsLoading(false);
          return;
        }
      }
    } catch (err: any) {
      console.warn('Server pull endpoint unavailable, using direct client pull fallback:', err?.message);
    }

    // Client Direct Pull Fallback
    try {
      const pullRes = await pullAllFromBrowser(config.url, config.anonKey);
      if (pullRes.success && pullRes.data) {
        if (pullRes.data.students.length > 0) {
          await apiService.importStudents(pullRes.data.students);
        }
        if (pullRes.data.teachers.length > 0) {
          await apiService.importTeachers(pullRes.data.teachers);
        }
        setStatusMessage({ type: 'success', text: pullRes.message || 'Berhasil mengimpor data dari Supabase.' });
        fetchSupabaseConfig();
        if (onRefreshMasterData) onRefreshMasterData();
      } else {
        setStatusMessage({ type: 'error', text: pullRes.error || 'Gagal mengimpor data dari Supabase.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Gagal mengambil data: ${err.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlSchema);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-slate-900">Database Supabase Cloud Integration</h2>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                config.status === 'connected' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                config.status === 'error' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                'bg-slate-100 text-slate-600 border border-slate-300'
              }`}>
                {config.status === 'connected' ? 'TERHUBUNG' : config.status === 'error' ? 'ERROR KONEKSI' : 'BELUM DIATUR'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Gunakan Supabase (PostgreSQL Cloud) sebagai database persisten yang aman tanpa batasan token OAuth Google.
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowSqlModal(true)}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-amber-300 rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-2 shrink-0 cursor-pointer"
        >
          <Server className="w-4 h-4 text-emerald-400" />
          Pembuat Script Tabel SQL
        </button>
      </div>

      {/* Alert Status Message */}
      {statusMessage && (
        <div className={`p-4 rounded-2xl text-xs font-semibold flex items-start gap-3 animate-in fade-in ${
          statusMessage.type === 'success' ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' :
          statusMessage.type === 'error' ? 'bg-rose-50 text-rose-900 border border-rose-200' :
          'bg-sky-50 text-sky-900 border border-sky-200'
        }`}>
          {statusMessage.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />}
          {statusMessage.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />}
          {statusMessage.type === 'info' && <RefreshCw className="w-5 h-5 text-sky-600 shrink-0 mt-0.5 animate-spin" />}
          <div className="flex-1 leading-relaxed">{statusMessage.text}</div>
        </div>
      )}

      {/* Config Form */}
      <form onSubmit={handleSaveConfig} className="bg-slate-50/80 rounded-2xl p-5 border border-slate-200/80 space-y-4">
        <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-2">
          <Key className="w-4 h-4 text-emerald-600" />
          Pengaturan Kredensial Supabase Project
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Supabase Project URL <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="url"
                required
                placeholder="https://xyzcompany.supabase.co"
                value={config.url}
                onChange={(e) => setConfig({ ...config, url: e.target.value })}
                className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
              <LinkIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Dapatkan di Supabase Dashboard -&gt; Project Settings -&gt; API</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Supabase Anon / Public Key <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                required
                placeholder="eyJhY2Nlc3NfdG9rZW4iOi..."
                value={config.anonKey}
                onChange={(e) => setConfig({ ...config, anonKey: e.target.value })}
                className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
              <Key className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Kunci API anon/public project Supabase Anda</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="autoSync"
              checked={config.autoSync}
              onChange={(e) => setConfig({ ...config, autoSync: e.target.checked })}
              className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
            />
            <label htmlFor="autoSync" className="text-xs font-semibold text-slate-700 cursor-pointer">
              Otomatis Simpan Perubahan ke Supabase Database
            </label>
          </div>

          <button
            type="submit"
            disabled={isTesting || !config.url || !config.anonKey}
            className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isTesting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Simpan & Uji Koneksi Supabase
          </button>
        </div>
      </form>

      {/* Actions Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Push */}
        <div className="p-5 bg-emerald-50/50 border border-emerald-200/80 rounded-2xl flex flex-col justify-between space-y-3">
          <div>
            <h4 className="text-xs font-extrabold text-emerald-950 flex items-center gap-2">
              <Upload className="w-4 h-4 text-emerald-600" />
              Ekspor / Sync Data Lokal ke Supabase
            </h4>
            <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
              Kirim seluruh data Siswa, Guru, Kelas, dan Catatan Presensi ke tabel database Supabase Cloud Anda.
            </p>
          </div>

          <button
            onClick={handlePushData}
            disabled={isLoading || config.status !== 'connected'}
            className="w-full py-2.5 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Push Data Lokal ke Supabase
          </button>
        </div>

        {/* Pull */}
        <div className="p-5 bg-sky-50/50 border border-sky-200/80 rounded-2xl flex flex-col justify-between space-y-3">
          <div>
            <h4 className="text-xs font-extrabold text-sky-950 flex items-center gap-2">
              <Download className="w-4 h-4 text-sky-600" />
              Impor / Tarik Data dari Supabase
            </h4>
            <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
              Ambil data terbaru dari tabel Supabase Cloud ke dalam aplikasi ini.
            </p>
          </div>

          <button
            onClick={handlePullData}
            disabled={isLoading || config.status !== 'connected'}
            className="w-full py-2.5 bg-sky-800 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Pull Data dari Supabase
          </button>
        </div>
      </div>

      {/* Last Sync Footer */}
      {config.lastSyncTime && (
        <div className="text-[11px] text-slate-500 font-medium text-center border-t border-slate-100 pt-3">
          Waktu Sinkronisasi Supabase Terakhir: <span className="font-bold text-slate-700">{new Date(config.lastSyncTime).toLocaleString('id-ID')}</span>
        </div>
      )}

      {/* SQL Setup Modal */}
      {showSqlModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <Server className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-extrabold text-slate-900">Script SQL Setup Tabel Supabase</h3>
              </div>
              <button
                onClick={() => setShowSqlModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Jika Anda baru membuat project Supabase baru, salin script SQL di bawah ini lalu jalankan di menu <strong className="text-slate-900">SQL Editor</strong> di Dashboard Supabase Anda:
            </p>

            <div className="relative flex-1 min-h-[220px]">
              <textarea
                readOnly
                value={sqlSchema}
                className="w-full h-full p-3.5 bg-slate-900 text-emerald-300 font-mono text-[11px] rounded-2xl focus:outline-none leading-relaxed resize-none"
              />
              <button
                onClick={handleCopySql}
                className="absolute top-3 right-3 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                {copiedSql ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedSql ? 'Tersalin!' : 'Salin Script SQL'}
              </button>
            </div>

            <div className="flex justify-between items-center pt-2">
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-emerald-700 hover:underline font-bold flex items-center gap-1"
              >
                Buka Supabase Dashboard <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <button
                onClick={() => setShowSqlModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
