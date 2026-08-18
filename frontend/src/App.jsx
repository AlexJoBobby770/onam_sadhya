import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { FestivalBackdrop } from './components/Pookalam';
import { Login } from './pages/Login';
import { StudentDashboard } from './pages/StudentDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { ScannerPage } from './pages/ScannerPage';
import { SuperAdminDashboard } from './pages/SuperAdminDashboard';

const MainApp = () => {
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('student');

  useEffect(() => {
    if (user) {
      if (user.role === 'super_admin') {
        setActiveTab('super_admin');
      } else if (user.role === 'admin') {
        setActiveTab('admin');
      } else {
        setActiveTab('student');
      }
    }
  }, [user?.role]);

  if (!user) {
    return <Login />;
  }

  // Student view is the one students see, so it gets the cream festival treatment;
  // the admin/scanner tools stay on the dark shell they were built for.
  const isStudentView = activeTab === 'student';

  return (
    <div
      className={`relative min-h-screen flex flex-col ${
        isStudentView ? 'surface-festival text-onam-ink' : 'bg-onam-black text-onam-kasavu'
      }`}
    >
      {isStudentView && <FestivalBackdrop />}

      <div className="relative z-10 flex flex-1 flex-col">
        <Navbar activeTab={activeTab} setActiveTab={setActiveTab} cream={isStudentView} />

        <main className="flex-1 pb-16">
          {activeTab === 'student' && <StudentDashboard />}
          {activeTab === 'admin' && isAdmin && <AdminDashboard onOpenScanner={() => setActiveTab('scanner')} />}
          {activeTab === 'scanner' && isAdmin && <ScannerPage />}
          {activeTab === 'super_admin' && isSuperAdmin && <SuperAdminDashboard />}
        </main>

        <footer
          className={`py-6 text-center text-[11px] ${
            isStudentView
              ? 'border-t border-onam-cream-line text-onam-ink-soft/70'
              : 'border-t border-onam-line text-onam-muted-faint'
          }`}
        >
          <p>Onam Sadhya · College Gate Verification</p>
        </footer>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
