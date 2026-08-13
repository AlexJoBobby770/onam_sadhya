import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
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

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="flex-1 pb-16">
        {activeTab === 'student' && <StudentDashboard />}
        {activeTab === 'admin' && isAdmin && <AdminDashboard onOpenScanner={() => setActiveTab('scanner')} />}
        {activeTab === 'scanner' && isAdmin && <ScannerPage />}
        {activeTab === 'super_admin' && isSuperAdmin && <SuperAdminDashboard />}
      </main>

      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500 font-sans">
        <p>Onam Sadhya QR Ticketing System • College Gate Verification Portal</p>
      </footer>
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
