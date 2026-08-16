import React, { useState } from 'react';
import { User, Teacher } from '../types';
import { apiService } from '../services/apiService';
import { Key, CheckCircle2, Lock, RefreshCw, X, User as UserIcon, Shield, BadgeCheck, BookOpen } from 'lucide-react';

interface TeacherProfileModalProps {
  user: User;
  teachers: Teacher[];
  onClose: () => void;
  onSuccess: (updatedUser: User) => void;
}

export const TeacherProfileModal: React.FC<TeacherProfileModalProps> = ({
  user,
  teachers,
  onClose,
  onSuccess
}) => {
  // Find matching teacher record in DB
  const currentTeacher = teachers.find(
    t => t.id === user.id || (user.nip && t.nip === user.nip) || t.username.toLowerCase() === user.username.toLowerCase()
  );

  const [name, setName] = useState(user.name || currentTeacher?.name || '');
  const [username, setUsername] = useState(user.username || currentTeacher?.username || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const trimmedName = name.trim();
    const trimmedUsername = username.trim().toLowerCase();

    if (!trimmedName) {
      setErrorMsg('Nama lengkap tidak boleh kosong.');
      return;
    }

    if (!trimmedUsername) {
      setErrorMsg('Username login tidak boleh kosong.');
      return;
    }

    if (newPassword) {
      if (newPassword.length < 3) {
        setErrorMsg('Password baru minimal 3 karakter.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setErrorMsg('Konfirmasi password baru tidak cocok.');
        return;
      }
    }

    setIsSaving(true);

    try {
      const targetTeacherId = currentTeacher?.id || user.id || `tch-${Date.now()}`;
      const payload: Partial<Teacher> = {
        name: trimmedName,
        username: trimmedUsername,
        nip: user.nip || currentTeacher?.nip || '',
        role: (user.role as any) || currentTeacher?.role || 'guru'
      };

      if (newPassword) {
        payload.password = newPassword.trim();
      }

      let res;
      if (currentTeacher) {
        res = await apiService.updateTeacher(targetTeacherId, payload);
      } else {
        res = await apiService.addTeacher(payload);
      }

      if (res.success) {
        const updatedUser: User = {
          ...user,
          name: trimmedName,
          username: trimmedUsername
        };

        setSuccessMsg('Profil dan password akun Anda berhasil diperbarui!');
        setTimeout(() => {
          onSuccess(updatedUser);
        }, 1200);
      } else {
        setErrorMsg(res.error || 'Gagal memperbarui profil akun.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Terjadi kesalahan sistem saat memperbarui profil.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header Modal */}
        <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-emerald-200 hover:text-white bg-emerald-950/40 hover:bg-emerald-950/80 rounded-full transition-colors cursor-pointer"
            title="Tutup Modal"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-950 font-black text-xl flex items-center justify-center shadow-md border-2 border-amber-300 shrink-0">
              {user.name ? user.name.charAt(0) : 'G'}
            </div>
            <div>
              <span className="text-[10px] font-extrabold text-amber-300 uppercase tracking-widest bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-700 inline-block">
                PENGATURAN AKUN GURU
              </span>
              <h3 className="text-lg font-black text-white mt-0.5 tracking-tight">Update Profil & Ubah Password</h3>
              <p className="text-xs text-emerald-200/90 font-medium">
                NIP: <span className="font-mono text-amber-300">{user.nip || currentTeacher?.nip || '-'}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl font-bold text-xs flex items-center gap-2">
              <Shield className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl font-bold text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Account Role & Identity Summary Banner */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BadgeCheck className="w-4 h-4 text-emerald-600" />
              <div>
                <p className="font-extrabold text-slate-800 text-xs">Akses Role Akun</p>
                <p className="text-[10px] text-slate-500 font-medium">
                  {user.role === 'bk' || currentTeacher?.role === 'bk' ? 'Guru Bimbingan Konseling (BK)' : user.role === 'admin' ? 'Administrator Sekolah' : 'Guru Pengajar / Wali Kelas'}
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-extrabold rounded-lg uppercase">
              {user.role}
            </span>
          </div>

          {/* Form Fields: Name & Username */}
          <div className="space-y-3 pt-1">
            <div>
              <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <UserIcon className="w-3.5 h-3.5 text-emerald-600" /> Nama Lengkap & Gelar*
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Ust. Ahmad Fausan, S.Pd"
                className="w-full p-2.5 border border-slate-300 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <BadgeCheck className="w-3.5 h-3.5 text-emerald-600" /> Username Login Akun*
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ahmad"
                className="w-full p-2.5 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
              <p className="text-[10px] text-slate-500 mt-0.5">
                Gunakan huruf kecil tanpa spasi untuk memudahkan login.
              </p>
            </div>
          </div>

          {/* Password Change Box */}
          <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-3">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-xs pb-1 border-b border-amber-200">
              <Key className="w-4 h-4 text-amber-600" />
              <span>Fitur Ubah Password Akun (Opsional)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Password Baru</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Kosongkan jika tidak diubah"
                  className="w-full p-2 border border-slate-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Konfirmasi Password Baru</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ketik ulang password baru"
                  className="w-full p-2 border border-slate-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
                />
              </div>
            </div>
            <p className="text-[10px] text-amber-800/80 leading-relaxed">
              *Isi password baru jika Anda ingin mengganti password login. Minimal 3 karakter.
            </p>
          </div>

          {/* Action Footer Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow-md cursor-pointer transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Menyimpan Perubahan...</span>
                </>
              ) : (
                <span>Simpan Perubahan Profile</span>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
