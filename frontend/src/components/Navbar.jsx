import React from 'react';
import { useAuth } from '../context/AuthContext';
import { QrCode, ShieldCheck, BarChart3, Ticket, LogOut } from 'lucide-react';

export const Navbar = ({ activeTab, setActiveTab }) => {
  const { user, logout, isAdmin, isSuperAdmin, devLogin } = useAuth();

  if (!user) return null;

  const handleQuickSwitch = async (role) => {
    try {
      if (role === 'student') {
        await devLogin('9876543210', 'Rahul Nair', 'student');
      } else if (role === 'admin') {
        await devLogin('9998887771', 'Ananya V (Volunteer Admin)', 'admin');
      } else if (role === 'super_admin') {
        await devLogin('9998887770', 'Dr. Radhakrishnan (Super Admin)', 'super_admin');
      }
    } catch (err) {
      console.error('Failed to switch role:', err);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Logo & Title */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('default')}>
          <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold">
            OS
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight text-white font-sans">
              Onam Sadhya Ticketing
            </h1>
            <p className="text-[11px] text-slate-400">Gate Entry Verification System</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
          {/* Student Tab */}
          <button
            onClick={() => setActiveTab('student')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'student'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Ticket className="w-3.5 h-3.5" />
            <span>My Pass</span>
          </button>

          {/* Admin Approvals */}
          {isAdmin && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'admin'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Approvals</span>
            </button>
          )}

          {/* Gate Scanner */}
          {isAdmin && (
            <button
              onClick={() => setActiveTab('scanner')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'scanner'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-emerald-400 hover:bg-emerald-500/10'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Gate Scanner</span>
            </button>
          )}

          {/* Super Admin Panel */}
          {isSuperAdmin && (
            <button
              onClick={() => setActiveTab('super_admin')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'super_admin'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Analytics & Roles</span>
            </button>
          )}
        </nav>

        {/* User Info & Quick Dev Switcher */}
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 text-xs">
            <span className="text-slate-500 text-[11px]">Role:</span>
            <button
              onClick={() => handleQuickSwitch('student')}
              className={`px-2 py-0.5 rounded text-[10px] font-semibold transition ${
                user.role === 'student' ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              Student
            </button>
            <button
              onClick={() => handleQuickSwitch('admin')}
              className={`px-2 py-0.5 rounded text-[10px] font-semibold transition ${
                user.role === 'admin' ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              Admin
            </button>
            <button
              onClick={() => handleQuickSwitch('super_admin')}
              className={`px-2 py-0.5 rounded text-[10px] font-semibold transition ${
                user.role === 'super_admin' ? 'bg-purple-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              Super Admin
            </button>
          </div>

          <div className="flex items-center gap-3 bg-slate-950 border border-slate-800 pl-3 pr-2 py-1.5 rounded-xl">
            <div className="text-right">
              <p className="text-xs font-semibold text-white leading-tight">{user.name}</p>
              <p className="text-[10px] uppercase font-bold text-slate-400 mt-0.5">
                {user.role.replace('_', ' ')}
              </p>
            </div>

            <button
              onClick={logout}
              title="Logout"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-900 rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </header>
  );
};
