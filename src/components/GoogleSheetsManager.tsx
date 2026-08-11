import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, RefreshCw, ExternalLink, CheckCircle2, AlertCircle, Database, ArrowUpRight, ArrowDownLeft, Key, Link as LinkIcon, Info } from 'lucide-react';
import { signInWithGoogle, getCachedAccessToken, setCachedAccessToken } from '../services/authService';
import { apiService } from '../services/apiService';

interface GoogleSheetsManagerProps {
  onDataRefreshed?: () => void;
}

export const GoogleSheetsManager: React.FC<GoogleSheetsManagerProps> = ({ onDataRefreshed }) => {
  const [sheetsConfig, setSheetsConfig] = useState<{
    spreadsheetId: string | null;
    spreadsheetUrl: string | null;
    lastSyncTime: string | null;
    autoSync: boolean;
  }>({
    spreadsheetId: null,
    spreadsheetUrl: null,
    lastSyncTime: null,
    autoSync: true
  });

  const [accessToken, setAccessToken] = useState<string>(getCachedAccessToken() || '');
  const [customInput, setCustomInput] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchStatus = async () => {
    const config = await apiService.getSheetsStatus();
    setSheetsConfig(config);
    if (config.spreadsheetId) {
      setCustomInput(config.spreadsheetId);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const extractSpreadsheetId = (input: string): string => {
    const trimmed = input.trim();
    if (!trimmed) return '';
    // Match Google Sheets URL pattern: /spreadsheets/d/([a-zA-Z0-9-_]+)
    const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (urlMatch && urlMatch[1]) {
      return urlMatch[1];
    }
    return trimmed;
  };

  const handleConnectGoogle = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const authResult = await signInWithGoogle();
      setAccessToken(authResult.accessToken);
      setCachedAccessToken(authResult.accessToken);
      
      const targetId = extractSpreadsheetId(customInput);
      const initRes = await apiService.initGoogleSheets(authResult.accessToken, targetId || undefined);
      
      if (initRes.success) {
        setStatusMessage({ type: 'success', text: initRes.message || 'Berhasil terhubung ke Google Spreadsheet!' });
        await fetchStatus();
        if (onDataRefreshed) onDataRefreshed();
      } else {
        setStatusMessage({ type: 'error', text: initRes.error || 'Gagal membuat/menghubungkan spreadsheet.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Proses otentikasi Google gagal.' });
    } finally {
      setLoading(false);
    }
  };

  const handleManualInitWithToken = async () => {
    if (!accessToken.trim()) {
      setStatusMessage({ type: 'error', text: 'Masukkan Google Access Token OAuth terlebih dahulu.' });
      return;
    }

    setLoading(true);
    setStatusMessage(null);
    try {
      setCachedAccessToken(accessToken.trim());
      const targetId = extractSpreadsheetId(customInput);
      const initRes = await apiService.initGoogleSheets(accessToken.trim(), targetId || undefined);

      if (initRes.success) {
        setStatusMessage({ type: 'success', text: initRes.message || 'Berhasil mengonfigurasi Google Spreadsheet database!' });
        await fetchStatus();
        if (onDataRefreshed) onDataRefreshed();
      } else {
        setStatusMessage({ type: 'error', text: initRes.error || 'Gagal terhubung ke Google Sheets.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Gagal menginisialisasi spreadsheet.' });
    } finally {
      setLoading(false);
    }
  };

  const handlePushToSheet = async () => {
    const token = accessToken.trim() || getCachedAccessToken();
    if (!token) {
      setStatusMessage({ type: 'error', text: 'Harap masukkan Google Access Token terlebih dahulu.' });
      return;
    }
    setLoading(true);
    setStatusMessage(null);
    try {
      const targetId = extractSpreadsheetId(customInput) || sheetsConfig.spreadsheetId || undefined;
      const res = await apiService.syncToGoogleSheets(token, targetId);
      if (res.success) {
        setStatusMessage({ type: 'success', text: res.message || 'Ekspor data ke Google Sheets berhasil!' });
        await fetchStatus();
      } else {
        setStatusMessage({ type: 'error', text: res.error || 'Gagal mengekspor data.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Terjadi kesalahan saat mengekspor.' });
    } finally {
      setLoading(false);
    }
  };

  const handlePullFromSheet = async () => {
    const token = accessToken.trim() || getCachedAccessToken();
    if (!token) {
      setStatusMessage({ type: 'error', text: 'Harap masukkan Google Access Token terlebih dahulu.' });
      return;
    }
    setLoading(true);
    setStatusMessage(null);
    try {
      const targetId = extractSpreadsheetId(customInput) || sheetsConfig.spreadsheetId || undefined;
      const res = await apiService.syncFromGoogleSheets(token, targetId);
      if (res.success) {
        setStatusMessage({ type: 'success', text: res.message || 'Data berhasil diimpor dari Google Sheets!' });
        await fetchStatus();
        if (onDataRefreshed) onDataRefreshed();
      } else {
        setStatusMessage({ type: 'error', text: res.error || 'Gagal mengimpor data.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Terjadi kesalahan saat mengimpor.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 shadow-xl border border-emerald-100 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-700 text-amber-300 flex items-center justify-center shadow-md">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              Google Sheets Database Engine
              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-extrabold uppercase tracking-wider border border-emerald-200">
                ACTIVE ENGINE
              </span>
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Integrasi langsung Google Spreadsheet sebagai media simpan & pengolah database utama SMA Islam Ra'iyatul Husnan
            </p>
          </div>
        </div>

        {sheetsConfig.spreadsheetUrl && (
          <a
            href={sheetsConfig.spreadsheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl font-bold text-xs transition-all border border-emerald-200 shadow-xs"
          >
            <span>Buka Google Spreadsheet</span>
            <ExternalLink className="w-4 h-4 text-emerald-600" />
          </a>
        )}
      </div>

      {/* Alert Messages */}
      {statusMessage && (
        <div className={`p-4 rounded-2xl border text-xs font-semibold flex items-center gap-3 ${
          statusMessage.type === 'success' ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'bg-rose-50 text-rose-900 border-rose-200'
        }`}>
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Connection & Auth Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Connection Status & Input Card */}
        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Database className="w-4 h-4 text-emerald-700" /> Status Database Sheets
            </span>
            {sheetsConfig.spreadsheetId ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Terhubung
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full border border-amber-200">
                Belum Terhubung
              </span>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <LinkIcon className="w-3.5 h-3.5 text-slate-500" /> ID / Link Google Spreadsheet
            </label>
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="Paste URL (e.g. https://docs.google.com/spreadsheets/d/.../edit) atau ID"
              className="w-full text-xs p-2.5 bg-white rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
            />
            <p className="text-[11px] text-slate-500">
              Kosongkan jika ingin membuat file Google Spreadsheet baru secara otomatis.
            </p>
          </div>

          {sheetsConfig.lastSyncTime && (
            <p className="text-[11px] text-slate-500 font-medium pt-1 border-t border-slate-200">
              Terakhir disinkronkan: <strong className="text-slate-700">{new Date(sheetsConfig.lastSyncTime).toLocaleString('id-ID')}</strong>
            </p>
          )}
        </div>

        {/* Access Token OAuth Input & Connect Button Card */}
        <div className="p-5 rounded-2xl bg-emerald-900/5 border border-emerald-200/60 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Key className="w-4 h-4 text-emerald-700" /> Kredensial OAuth Google
            </h4>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Access Token OAuth Google</label>
              <input
                type="password"
                value={accessToken}
                onChange={(e) => {
                  setAccessToken(e.target.value);
                  setCachedAccessToken(e.target.value);
                }}
                placeholder="Masukkan OAuth Access Token Google (ya29...)"
                className="w-full text-xs p-2.5 bg-white rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
              />
            </div>
            <div className="flex items-start gap-1.5 text-[11px] text-slate-600 bg-white/80 p-2.5 rounded-xl border border-slate-200">
              <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                Token digunakan server untuk membaca dan menulis tab <strong>Data Siswa</strong>, <strong>Guru</strong>, <strong>Kelas</strong>, &amp; <strong>Log Presensi</strong> di Google Spreadsheet.
              </span>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <button
              onClick={handleManualInitWithToken}
              disabled={loading}
              className="w-full bg-emerald-800 hover:bg-emerald-900 text-white font-bold p-3 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 shadow-md cursor-pointer hover:shadow-lg disabled:opacity-50"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4 text-amber-300" />}
              <span>Hubungkan &amp; Inisialisasi Database Google Sheets</span>
            </button>

            <button
              onClick={handleConnectGoogle}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold p-2.5 rounded-xl border border-slate-300 transition-all text-xs cursor-pointer disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              <span>Login Otomatis via Google Popup</span>
            </button>
          </div>
        </div>
      </div>

      {/* Manual Sync Operations */}
      <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3">
        <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
          <RefreshCw className="w-4 h-4 text-emerald-700" /> Kontrol Sinkronisasi Data Real-Time
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={handlePushToSheet}
            disabled={loading}
            className="flex items-center justify-center gap-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-extrabold p-3 rounded-xl shadow-md transition-all cursor-pointer hover:shadow-lg disabled:opacity-50"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowUpRight className="w-4 h-4 text-amber-300" />}
            <span>Ekspor Semua Data ke Spreadsheet (Push)</span>
          </button>

          <button
            onClick={handlePullFromSheet}
            disabled={loading}
            className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-extrabold p-3 rounded-xl shadow-md transition-all cursor-pointer hover:shadow-lg disabled:opacity-50"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowDownLeft className="w-4 h-4 text-amber-300" />}
            <span>Impor Data dari Spreadsheet (Pull)</span>
          </button>
        </div>

        <p className="text-[11px] text-slate-500 italic">
          *Catatan: Tab <strong>Data Siswa</strong>, <strong>Data Guru</strong>, <strong>Data Kelas</strong>, dan <strong>Log Presensi</strong> akan dibuat &amp; disinkronkan secara otomatis.
        </p>
      </div>
    </div>
  );
};
