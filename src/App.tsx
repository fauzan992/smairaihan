import React, { useState, useEffect } from 'react';
import { User, Student, Teacher, ClassRoom, AttendanceRecord, UserRole, BKNote } from './types';
import { apiService } from './services/apiService';
import { HeaderNavbar } from './components/HeaderNavbar';
import { Sidebar } from './components/Sidebar';
import { LoginModal } from './components/LoginModal';
import { AdminDashboard } from './components/AdminDashboard';
import { GuruDashboard } from './components/GuruDashboard';
import { WaliMuridDashboard } from './components/WaliMuridDashboard';
import { BKDashboard } from './components/BKDashboard';
import { Shield, GraduationCap, Heart, QrCode, CheckCircle2, RefreshCw } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);

  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [bkNotes, setBkNotes] = useState<BKNote[]>([]);
  const [loading, setLoading] = useState(true);

  // Left Sidebar State & Tab Controls
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'master' | 'discipline' | 'bk' | 'teacherAdmin' | 'scan' | 'reports' | 'import' | 'settings'>('dashboard');
  const [masterSubTab, setMasterSubTab] = useState<'students' | 'teachers' | 'classes' | 'guardians'>('students');

  // Guard activeTab based on user role when user changes
  useEffect(() => {
    if (user?.role === 'guru' && activeTab === 'bk') {
      setActiveTab('teacherAdmin');
    }
  }, [user, activeTab]);

  // Fetch application state
  const loadAppData = async () => {
    try {
      setLoading(true);
      const master = await apiService.getMasterData();
      setStudents(master.students || []);
      setTeachers(master.teachers || []);
      setClasses(master.classes || []);

      const att = await apiService.getAttendance({});
      setAttendanceRecords(att.records || []);

      const bkRes = await apiService.getBKNotes();
      setBkNotes(bkRes.notes || []);

      // Initialize school settings & dynamic favicon on app load
      await apiService.getSettings();
    } catch (err) {
      console.error('Failed loading app data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAppData();
  }, []);

  const handleLogout = () => {
    setUser(null);
  };

  const handleQuickLogin = async (role: UserRole, usernameArg?: string) => {
    if (role === 'admin') {
      const res = await apiService.login('admin', 'admin', 'admin123');
      if (res.user) setUser(res.user);
    } else if (role === 'guru') {
      const uname = usernameArg || 'ahmad';
      const res = await apiService.login('guru', uname, 'guru123');
      if (res.user) setUser(res.user);
    } else if (role === 'bk') {
      const uname = usernameArg || 'rahma';
      const res = await apiService.login('bk', uname, 'guru123');
      if (res.user) setUser(res.user);
    } else if (role === 'wali') {
      const uname = usernameArg || '0061234501';
      const res = await apiService.login('wali', uname, '123');
      if (res.user) setUser(res.user);
    }
  };

  const handleResetData = async () => {
    if (confirm("Reset seluruh data demo SMA Islam Ra'iyatul Husnan ke kondisi awal?")) {
      await apiService.resetData();
      await loadAppData();
    }
  };

  const handleSidebarTabSelect = (
    tab: 'dashboard' | 'master' | 'discipline' | 'bk' | 'teacherAdmin' | 'scan' | 'reports' | 'import' | 'settings',
    subTab?: 'students' | 'teachers' | 'classes' | 'guardians'
  ) => {
    setActiveTab(tab);
    if (subTab) setMasterSubTab(subTab);
  };

  return (
    <div className="min-h-screen bg-slate-100/90 text-slate-800 font-sans flex flex-col antialiased selection:bg-emerald-500 selection:text-white">
      {/* Top Header */}
      <HeaderNavbar
        user={user}
        onLogout={handleLogout}
        onQuickLogin={handleQuickLogin}
        onResetData={handleResetData}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        isSidebarOpen={isSidebarOpen}
      />

      {/* Main Content Area with Left Sidebar Container */}
      <div className="flex flex-1 relative min-h-0">
        {user && user.role !== 'wali' && (
          <Sidebar
            isOpen={isSidebarOpen}
            onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
            user={user}
            activeTab={activeTab}
            onSelectTab={handleSidebarTabSelect}
            masterSubTab={masterSubTab}
          />
        )}

        <main className="flex-1 w-full p-4 md:p-6 transition-all duration-300 overflow-y-auto">
          {!user ? (
            <LoginModal onLoginSuccess={(u) => setUser(u)} />
          ) : loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
              <p className="text-xs font-semibold text-slate-600">Memuat Data SMA Islam Ra'iyatul Husnan...</p>
            </div>
          ) : (
            <div className="max-w-7xl mx-auto">
              {user.role === 'admin' && (
                <AdminDashboard
                  students={students}
                  teachers={teachers}
                  classes={classes}
                  attendanceRecords={attendanceRecords}
                  bkNotes={bkNotes}
                  onRefreshData={loadAppData}
                  externalActiveTab={activeTab}
                  externalMasterSubTab={masterSubTab}
                  onTabChange={(tab, sub) => {
                    setActiveTab(tab);
                    if (sub) setMasterSubTab(sub);
                  }}
                />
              )}

              {user.role === 'guru' && (
                <GuruDashboard
                  user={user}
                  students={students}
                  teachers={teachers}
                  classes={classes}
                  attendanceRecords={attendanceRecords}
                  bkNotes={bkNotes}
                  onRefreshData={loadAppData}
                  externalActiveTab={activeTab}
                  onUserUpdate={(updated) => setUser(updated)}
                />
              )}

              {user.role === 'bk' && (
                <BKDashboard
                  user={user}
                  students={students}
                  teachers={teachers}
                  classes={classes}
                  attendanceRecords={attendanceRecords}
                  bkNotes={bkNotes}
                  onRefreshData={loadAppData}
                  externalActiveTab={activeTab}
                  onUserUpdate={(updated) => setUser(updated)}
                />
              )}

              {user.role === 'wali' && (
                <WaliMuridDashboard
                  user={user}
                  students={students}
                  attendanceRecords={attendanceRecords}
                />
              )}
            </div>
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 text-xs py-4 border-t border-slate-800 text-center relative z-10">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-2">
          <span>© {new Date().getFullYear()} <strong>SMA Islam Ra'iyatul Husnan</strong>. Sistem Absensi Digital QR Code NISN.</span>
          <span className="text-[11px] text-slate-500">Role Active: <strong className="text-amber-400 capitalize">{user ? user.role : 'Guest'}</strong></span>
        </div>
      </footer>
    </div>
  );
}

