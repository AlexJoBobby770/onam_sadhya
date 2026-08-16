import React from 'react';
import { useAuth } from '../context/AuthContext';
import { QrCode, ShieldCheck, BarChart3, Ticket, LogOut } from 'lucide-react';

export const Navbar = ({ activeTab, setActiveTab, cream = false }) => {
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

  const t = cream
    ? {
        header: 'bg-onam-cream/85 backdrop-blur border-b border-onam-cream-line',
        title: 'text-onam-ink',
        sub: 'text-onam-maroon',
        chip: 'bg-white/70 border border-onam-cream-line',
        tabIdle: 'text-onam-ink-soft hover:text-onam-ink hover:bg-onam-cream-deep',
        tabActive: 'bg-onam-leaf-deep text-onam-kasavu font-bold',
        name: 'text-onam-ink',
        role: 'text-onam-ink-soft/70',
        icon: 'text-onam-ink-soft hover:text-onam-maroon hover:bg-onam-cream-deep',
        devIdle: 'text-onam-ink-soft/70 hover:text-onam-ink',
        devActive: 'bg-onam-cream-deep text-onam-maroon',
        devLabel: 'text-onam-ink-soft/50',
      }
    : {
        header: 'bg-onam-deep border-b border-onam-line',
        title: 'text-onam-kasavu',
        sub: 'text-onam-gold-deep',
        chip: 'bg-onam-black border border-onam-line',
        tabIdle: 'text-onam-muted hover:text-onam-kasavu hover:bg-onam-raised',
        tabActive: 'bg-onam-gold text-onam-ink font-bold',
        name: 'text-onam-kasavu',
        role: 'text-onam-muted-dim',
        icon: 'text-onam-muted-dim hover:text-onam-red hover:bg-onam-raised',
        devIdle: 'text-onam-muted-dim hover:text-onam-kasavu',
        devActive: 'bg-onam-raised text-onam-gold',
        devLabel: 'text-onam-muted-faint',
      };

  return (
    <header className={`sticky top-0 z-40 ${t.header}`}>
      <div className="kasavu-band" />
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-2.5 flex items-center justify-between gap-3">

        <div className="flex items-center gap-2.5 cursor-pointer shrink-0" onClick={() => setActiveTab('student')}>
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-onam-gold to-onam-orange flex items-center justify-center text-onam-ink font-bold text-sm">
            OS
          </div>
          <div>
            <h1 className={`font-serif text-base font-semibold leading-tight ${t.title}`}>
              Onam Sadhya
            </h1>
            <p className={`font-malayalam text-[10px] leading-tight ${t.sub}`}>ഓണം 2026</p>
          </div>
        </div>

        {/* A single tab is just a label, not a choice — students never see this bar. */}
        {tabs.length > 1 && (
          <nav className={`hidden md:flex items-center gap-1 p-1 rounded-xl ${t.chip}`}>
            {tabs.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-medium transition ${
                  activeTab === id ? t.tabActive : t.tabIdle
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-2.5">
          {/* Dev role switcher — only functional while backend DEV_MODE is on */}
          <div className={`hidden lg:flex items-center gap-1 px-2 py-1 rounded-lg ${t.chip}`}>
            <span className={`text-[10px] font-mono mr-0.5 ${t.devLabel}`}>DEV</span>
            {[
              { role: 'student', label: 'Student' },
              { role: 'admin', label: 'Admin' },
              { role: 'super_admin', label: 'Super' },
            ].map((item) => (
              <button
                key={item.role}
                onClick={() => handleQuickSwitch(item.role)}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${
                  user.role === item.role ? t.devActive : t.devIdle
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className={`flex items-center gap-2.5 pl-2 pr-1.5 py-1.5 rounded-xl ${t.chip}`}>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-onam-gold to-onam-orange flex items-center justify-center text-onam-ink font-bold text-[12.5px]">
              {initials}
            </div>
            <div className="hidden sm:block text-right leading-tight">
              <p className={`text-[12.5px] font-medium ${t.name}`}>{user.name}</p>
              <p className={`text-[10px] font-mono uppercase ${t.role}`}>
                {user.role.replace('_', ' ')}
              </p>
            </div>
            <button
              onClick={logout}
              title="Logout"
              className={`p-1.5 rounded-lg transition ${t.icon}`}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>

      {/* Admins on phones get the tabs as a full-width strip under the bar. */}
      {tabs.length > 1 && (
        <nav className={`md:hidden flex items-center gap-1 px-3 pb-2.5 ${cream ? '' : ''}`}>
          {tabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex flex-1 items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-[11.5px] font-medium transition ${
                activeTab === id ? t.tabActive : `${t.tabIdle} ${t.chip}`
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      )}
    </header>
  );
};
