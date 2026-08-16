import React from 'react';
import { useAuth } from '../context/AuthContext';
import { QrCode, ShieldCheck, BarChart3, Ticket, LogOut } from 'lucide-react';

export const Navbar = ({ activeTab, setActiveTab }) => {
  const { user, logout, isAdmin, isSuperAdmin, devLogin } = useAuth();

  if (!user) return null;

  const handleQuickSwitch = async (role) => {
    try {
      if (role === 'student') {
        await devLogin('rahul.nair@gmail.com', 'Rahul Nair', 'student', 'CS2026');
      } else if (role === 'admin') {
        await devLogin('admin.volunteer@gmail.com', 'Ananya V (Volunteer Admin)', 'admin');
      } else if (role === 'super_admin') {
        await devLogin('superadmin@gmail.com', 'Dr. Radhakrishnan (Super Admin)', 'super_admin');
      }
    } catch (err) {
      console.error('Failed to switch role:', err);
    }
  };

  const initials = user.name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const tabs = [
    { id: 'student', label: 'My Pass', Icon: Ticket, show: true },
    { id: 'admin', label: 'Approvals', Icon: ShieldCheck, show: isAdmin },
    { id: 'scanner', label: 'Gate Scanner', Icon: QrCode, show: isAdmin },
    { id: 'super_admin', label: 'Analytics', Icon: BarChart3, show: isSuperAdmin },
  ].filter((t) => t.show);

  return (
    <header className="sticky top-0 z-40 bg-onam-deep border-b border-onam-line">
      <div className="h-px bg-onam-gold-deep/40" />
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-3 flex flex-col md:flex-row items-center justify-between gap-3">

        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setActiveTab('student')}>
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-onam-gold to-onam-orange flex items-center justify-center text-onam-ink font-bold text-sm">
            OS
          </div>
          <div>
            <h1 className="font-serif text-base font-semibold text-onam-kasavu leading-tight">
              Onam Sadhya
            </h1>
            <p className="font-malayalam text-[10px] text-onam-gold-deep leading-tight">ഓണം 2026</p>
          </div>
        </div>

        <nav className="flex items-center gap-1 bg-onam-black p-1 rounded-xl border border-onam-line">
          {tabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-medium transition ${
                activeTab === id
                  ? 'bg-onam-gold text-onam-ink font-bold'
                  : 'text-onam-muted hover:text-onam-kasavu hover:bg-onam-raised'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2.5">
          {/* Dev role switcher — only functional while backend DEV_MODE is on */}
          <div className="hidden lg:flex items-center gap-1 bg-onam-black px-2 py-1 rounded-lg border border-onam-line">
            <span className="text-onam-muted-faint text-[10px] font-mono mr-0.5">DEV</span>
            {[
              { role: 'student', label: 'Student' },
              { role: 'admin', label: 'Admin' },
              { role: 'super_admin', label: 'Super' },
            ].map((item) => (
              <button
                key={item.role}
                onClick={() => handleQuickSwitch(item.role)}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${
                  user.role === item.role
                    ? 'bg-onam-raised text-onam-gold'
                    : 'text-onam-muted-dim hover:text-onam-kasavu'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2.5 bg-onam-black border border-onam-line pl-2 pr-1.5 py-1.5 rounded-xl">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-onam-gold to-onam-orange flex items-center justify-center text-onam-ink font-bold text-[12.5px]">
              {initials}
            </div>
            <div className="text-right leading-tight">
              <p className="text-[12.5px] font-medium text-onam-kasavu">{user.name}</p>
              <p className="text-[10px] font-mono text-onam-muted-dim uppercase">
                {user.role.replace('_', ' ')}
              </p>
            </div>
            <button
              onClick={logout}
              title="Logout"
              className="p-1.5 text-onam-muted-dim hover:text-onam-red hover:bg-onam-raised rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </header>
  );
};
