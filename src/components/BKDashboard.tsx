import React, { useState } from 'react';
import { User, Student, ClassRoom, AttendanceRecord, BKNote, Teacher } from '../types';
import { BKCounselingSection } from './BKCounselingSection';
import { TeacherClassAdminSection } from './TeacherClassAdminSection';
import { TeacherProfileModal } from './TeacherProfileModal';
import { HeartHandshake, BookOpen, Key, UserCheck, Shield, Heart } from 'lucide-react';

interface BKDashboardProps {
  user: User;
  students: Student[];
  teachers?: Teacher[];
  classes: ClassRoom[];
  attendanceRecords: AttendanceRecord[];
  bkNotes: BKNote[];
  onRefreshData: () => void;
  externalActiveTab?: string;
  onUserUpdate?: (updatedUser: User) => void;
}

export const BKDashboard: React.FC<BKDashboardProps> = ({
  user,
  students,
  teachers = [],
  classes,
  attendanceRecords,
  bkNotes,
  onRefreshData,
  externalActiveTab,
  onUserUpdate
}) => {
  const [activeTab, setActiveTab] = useState<'bk' | 'teacherAdmin'>(
    externalActiveTab === 'teacherAdmin' ? 'teacherAdmin' : 'bk'
  );

  const [showProfileModal, setShowProfileModal] = useState(false);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* BK Welcome Header Banner */}
      <div className="bg-gradient-to-r from-teal-950 via-emerald-900 to-slate-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden border border-teal-800">
        <div className="absolute right-0 bottom-0 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="flex flex-wrap justify-between items-center gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold text-teal-200 uppercase tracking-widest bg-teal-950/90 px-3 py-1 rounded-full border border-teal-700/60 inline-flex items-center gap-1.5">
                <HeartHandshake className="w-3.5 h-3.5 text-teal-400" /> PORTAL LAYANAN GURU BK
              </span>
              <span className="text-[10px] font-extrabold text-emerald-300 uppercase bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-700">
                AKSES AKTIF
              </span>
            </div>
            <h2 className="text-2xl font-black mt-2 tracking-tight">{user.name}</h2>
            <p className="text-xs text-teal-200/90 mt-1 font-medium">
              NIP: <span className="font-mono font-bold text-amber-300">{user.nip || '199105152016022005'}</span> • Jabatan: <strong className="text-slate-950 bg-teal-300 font-black px-2.5 py-0.5 rounded-lg text-xs">Guru Bimbingan Konseling (BK)</strong>
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowProfileModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-2xl shadow-md transition-transform hover:scale-105 cursor-pointer border border-amber-300"
            >
              <Key className="w-4 h-4" /> Edit Akun & Ubah Password
            </button>
          </div>
        </div>

        {/* Navigation Tabs inside BK Dashboard */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-teal-800/80">
          <button
            onClick={() => setActiveTab('bk')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'bk'
                ? 'bg-amber-400 text-slate-950 font-black shadow-md'
                : 'bg-teal-950/60 text-teal-200 hover:text-white hover:bg-teal-900/80'
            }`}
          >
            <HeartHandshake className="w-4 h-4" /> Layanan Bimbingan Konseling (BK)
          </button>
          <button
            onClick={() => setActiveTab('teacherAdmin')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'teacherAdmin'
                ? 'bg-amber-400 text-slate-950 font-black shadow-md'
                : 'bg-teal-950/60 text-teal-200 hover:text-white hover:bg-teal-900/80'
            }`}
          >
            <BookOpen className="w-4 h-4" /> Administrasi Kelas & KBM
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      {activeTab === 'bk' && (
        <BKCounselingSection
          user={user}
          students={students}
          classes={classes}
          attendanceRecords={attendanceRecords}
          bkNotes={bkNotes}
          onRefreshData={onRefreshData}
        />
      )}

      {activeTab === 'teacherAdmin' && (
        <TeacherClassAdminSection
          user={user}
          students={students}
          teachers={teachers}
          classes={classes}
          attendanceRecords={attendanceRecords}
          onRefreshData={onRefreshData}
        />
      )}

      {/* Teacher Profile Edit Modal */}
      {showProfileModal && (
        <TeacherProfileModal
          user={user}
          teachers={teachers}
          onClose={() => setShowProfileModal(false)}
          onSuccess={(updatedUser) => {
            setShowProfileModal(false);
            if (onUserUpdate) onUserUpdate(updatedUser);
            onRefreshData();
          }}
        />
      )}
    </div>
  );
};
