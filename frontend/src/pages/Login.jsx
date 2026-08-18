import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { Pookalam } from '../components/Pookalam';
import { KeyRound, AlertCircle, X } from 'lucide-react';

export const Login = () => {
  const { loginWithToken, devLogin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [devModeEnabled, setDevModeEnabled] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideCode, setOverrideCode] = useState('');

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

  useEffect(() => {
    checkDevMode();
    loadGoogleGSI();
  }, []);

  const checkDevMode = async () => {
    try {
      const res = await api.get('/auth/config');
      if (res.data && res.data.dev_mode) {
        setDevModeEnabled(true);
      }
    } catch (e) {
      // Ignore if dev_mode check fails
    }
  };

  const loadGoogleGSI = () => {
    if (window.google?.accounts?.id) {
      initGoogleGSI();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => initGoogleGSI();
    document.body.appendChild(script);
  };

  const initGoogleGSI = () => {
    try {
      if (window.google?.accounts?.id && googleClientId) {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: (response) => {
            if (response?.credential) {
              handleGoogleCredential(response.credential);
            }
          }
        });
      }
    } catch (e) {
      console.warn('Google GSI Init:', e);
    }
  };

  const handleGoogleCredential = async (credentialToken) => {
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/google', {
        credential: credentialToken
      });
      loginWithToken(res.data.access_token, res.data.user);
    } catch (err) {
      setError(err.response?.data?.detail || 'Google authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    setError('');
    if (googleClientId && window.google?.accounts?.id) {
      try {
        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            setError('Google sign-in popup was blocked or closed. Please allow popups or try again.');
          }
        });
      } catch (e) {
        setError('Could not open Google sign-in. Please ensure Google Client ID is configured.');
      }
    } else {
      setError('Google Sign-In is initializing. Please tap again in a moment or refresh.');
    }
  };

  const handleAdminOverrideSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!overrideCode.trim()) {
      setError('Please enter the secret Admin Override Code');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/admin-override', {
        override_code: overrideCode.trim()
      });
      setShowOverrideModal(false);
      loginWithToken(res.data.access_token, res.data.user);
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid or rate-limited Admin Override Code.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDevLogin = async (role) => {
    setError('');
    try {
      if (role === 'student') {
        await devLogin('rahul.nair@gmail.com', 'Rahul Nair', 'student', 'CS2026');
      } else if (role === 'admin') {
        await devLogin('admin.volunteer@gmail.com', 'Ananya V (Volunteer Admin)', 'admin');
      } else if (role === 'super_admin') {
        await devLogin('superadmin@gmail.com', 'Dr. Radhakrishnan (Super Admin)', 'super_admin');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Dev login is disabled in production.');
    }
  };

  const inputClass =
    'w-full bg-onam-black border border-onam-line rounded-xl px-4 py-3 text-onam-kasavu text-sm ' +
    'placeholder-onam-muted-faint focus:outline-none focus:border-onam-gold-deep transition';

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-onam-black relative">
      <div className="w-full max-w-md">

        {/* Pookalam crown sits above the card, not hidden behind it */}
        <div className="relative flex justify-center">
          <Pookalam className="h-40 w-40 drop-shadow-[0_10px_24px_rgba(120,60,0,0.28)]" />
        </div>

        <div className="card-cream relative -mt-14 overflow-hidden">
          <div className="kasavu-band" />

          <div className="relative px-7 pt-16 pb-7">

            <div className="text-center">
              <span className="block font-malayalam text-[13px] text-onam-maroon mb-1.5">ഓണം 2026</span>
              <h2 className="font-serif text-[32px] font-semibold leading-tight text-onam-ink tracking-tight">
                Onam Sadhya
              </h2>
              <p className="text-[13px] text-onam-ink-soft mt-1.5">Gate pass registration · 21 Aug 2026</p>
              <Thoran className="mx-auto mt-4 h-11 w-56 opacity-90" />
            </div>

            <div className="rule-gold my-6" />

            {error && (
              <div className="mb-5 p-3.5 rounded-xl bg-onam-red/5 border border-onam-red/25 text-onam-maroon text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-4">
              <p className="text-xs text-onam-muted text-center leading-relaxed px-2">
                Welcome! Sign in with your Google account to access your official Onam Sadhya gate pass.
              </p>

              <button
                type="button"
                disabled={loading}
                onClick={handleGoogleSignIn}
                className="w-full py-4 px-5 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm shadow-xl transition flex items-center justify-center gap-3 active:scale-[0.98]"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.28v3.13C3.25 21.3 7.31 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.6H1.28C.46 8.23 0 10.06 0 12s.46 3.77 1.28 5.4h4z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.28 6.6l4 3.13c.95-2.83 3.6-4.98 6.72-4.98z"/>
                </svg>
                <span>{loading ? 'Connecting Google…' : 'Sign in with Google'}</span>
              </button>

              <div className="pt-3 text-center">
                <button
                  type="button"
                  onClick={() => { setError(''); setShowOverrideModal(true); }}
                  className="inline-flex items-center gap-1.5 text-[11px] text-onam-muted-dim hover:text-onam-gold transition"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Organiser Security Override Key</span>
                </button>
              </div>
            </div>

            {/* Dev shortcuts — rendered only when DEV_MODE is true */}
            {devModeEnabled && (
              <div className="mt-8">
                <p className="font-mono text-[9.5px] tracking-[0.16em] uppercase text-onam-ink-soft/60 text-center mb-2.5">
                  Dev quick login
                </p>
                <div className="grid grid-cols-3 rounded-xl overflow-hidden border border-onam-cream-line bg-onam-cream-deep">
                  {[
                    { role: 'student', label: 'Student' },
                    { role: 'admin', label: 'Admin' },
                    { role: 'super_admin', label: 'Super' },
                  ].map((item, i) => (
                    <button
                      key={item.role}
                      type="button"
                      onClick={() => handleQuickDevLogin(item.role)}
                      className={`py-2.5 px-1.5 text-[11.5px] font-medium text-onam-ink-soft hover:bg-onam-cream hover:text-onam-ink transition ${
                        i < 2 ? 'border-r border-onam-cream-line' : ''
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>

      </div>

      {/* Admin Security Override Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-onam-deep border border-onam-line rounded-2xl max-w-sm w-full p-6 relative shadow-2xl">
            <button
              onClick={() => setShowOverrideModal(false)}
              className="absolute top-4 right-4 text-onam-muted hover:text-onam-kasavu transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-2">
              <KeyRound className="w-5 h-5 text-onam-gold" />
              <h3 className="font-serif text-lg font-semibold text-onam-kasavu">Admin Security Override</h3>
            </div>
            <p className="text-xs text-onam-muted leading-relaxed mb-4">
              Enter the secret Organiser Security Key from backend environment configuration for emergency analytics access.
            </p>

            <form onSubmit={handleAdminOverrideSubmit} className="space-y-4">
              <div>
                <label className="block text-[10.5px] font-bold uppercase tracking-[0.1em] text-onam-muted mb-1.5">
                  Override Code
                </label>
                <input
                  type="password"
                  required
                  value={overrideCode}
                  onChange={(e) => setOverrideCode(e.target.value)}
                  placeholder="Enter secret key…"
                  className={inputClass}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-gold w-full py-3 text-xs font-bold"
              >
                {loading ? 'Verifying Key…' : 'Authenticate Override'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
