import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { Pookalam, Thoran, FestivalBackdrop } from '../components/Pookalam';
import { AlertCircle, X, ShieldAlert } from 'lucide-react';

export const Login = () => {
  const { loginWithToken, devLogin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [devModeEnabled, setDevModeEnabled] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideCode, setOverrideCode] = useState('');
  const [secretClickCount, setSecretClickCount] = useState(0);

  const [gsiReady, setGsiReady] = useState(false);
  const [gsiTimedOut, setGsiTimedOut] = useState(false);
  const googleBtnRef = useRef(null);

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

  useEffect(() => {
    checkDevMode();
    loadGoogleGSI();

    // GSI usually renders in well under a second, but on slow gate-side wifi
    // it can take longer. Rather than show the themed fallback immediately
    // (which then gets replaced by Google's button a moment later - the
    // flash), wait briefly and only fall back if GSI genuinely hasn't shown up.
    const timer = setTimeout(() => setGsiTimedOut(true), 2500);
    return () => clearTimeout(timer);
  }, []);

  const checkDevMode = async () => {
    try {
      const res = await api.get('/auth/config');
      if (res.data && res.data.dev_mode) {
        setDevModeEnabled(true);
      }
    } catch (err) {
      console.log('Dev mode check info:', err);
    }
  };

  const loadGoogleGSI = () => {
    if (!googleClientId) return;

    if (window.google?.accounts?.id) {
      initGSI();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => initGSI();
    document.body.appendChild(script);
  };

  const initGSI = () => {
    if (!window.google?.accounts?.id || !googleClientId) return;

    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: handleGoogleCredentialResponse,
      auto_select: false,
    });

    // Google's own rendered button uses a popup flow, which keeps working when
    // third-party cookies are blocked (Safari/Brave default) and after One Tap
    // enters its dismissal cooldown. prompt() alone fails silently in both cases.
    if (googleBtnRef.current) {
      googleBtnRef.current.innerHTML = '';
      const width = Math.min(400, Math.round(googleBtnRef.current.offsetWidth) || 320);
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        shape: 'pill',
        logo_alignment: 'center',
        width,
      });
      setGsiReady(true);
    }
  };

  const handleGoogleCredentialResponse = async (response) => {
    if (!response.credential) return;

    setLoading(true);
    setError('');

    try {
      const res = await api.post('/auth/google', { credential: response.credential });
      if (res.data && res.data.access_token) {
        loginWithToken(res.data.access_token, res.data.user);
      }
    } catch (err) {
      console.error('Google login error:', err);
      setError(err.response?.data?.detail || 'Google sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    setError('');
    if (!googleClientId) {
      setError('Google Sign-In is not configured yet (missing Client ID).');
      return;
    }
    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          console.warn('GSI prompt not displayed:', notification.getNotDisplayedReason());
        }
      });
    } else {
      setError('Google Services initializing. Please try again in a moment.');
    }
  };

  const handleAdminOverrideSubmit = async (e) => {
    e.preventDefault();
    if (!overrideCode.strip && !overrideCode.trim()) return;

    setLoading(true);
    setError('');

    try {
      const res = await api.post('/auth/admin-override', {
        override_code: overrideCode.trim(),
      });

      if (res.data && res.data.access_token) {
        setShowOverrideModal(false);
        loginWithToken(res.data.access_token, res.data.user);
      }
    } catch (err) {
      console.error('Admin override error:', err);
      setError(err.response?.data?.detail || 'Invalid override key.');
    } finally {
      setLoading(false);
    }
  };

  const handleSecretHeaderClick = () => {
    setSecretClickCount((prev) => {
      const next = prev + 1;
      if (next >= 5) {
        setShowOverrideModal(true);
        return 0;
      }
      return next;
    });
  };

  const handleQuickDevLogin = async (role) => {
    setLoading(true);
    setError('');
    try {
      let email = 'student@onamsadhya.org';
      let name = 'Sample Student';
      let rollNo = 'CS-2026-001';

      if (role === 'admin') {
        email = 'volunteer@onamsadhya.org';
        name = 'Gate Volunteer';
        rollNo = 'VOL-2026';
      } else if (role === 'super_admin') {
        email = 'alexjobobby770@gmail.com';
        name = 'Organiser Admin';
        rollNo = 'SUPER-001';
      }

      await devLogin({ email, name, role, roll_no: rollNo });
    } catch (err) {
      setError('Dev login failed.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'input-cream';

  return (
    <div className="surface-festival relative min-h-screen flex items-center justify-center px-4 py-10">
      <FestivalBackdrop />
      <div className="relative z-10 w-full max-w-md">

        {/* Pookalam crown sits above the card */}
        <div className="relative flex justify-center">
          <Pookalam className="h-40 w-40 drop-shadow-[0_10px_24px_rgba(120,60,0,0.28)]" />
        </div>

        <div className="card-cream relative -mt-14 overflow-hidden shadow-2xl">
          <div className="kasavu-band" />

          <div className="relative px-7 pt-16 pb-8">

            <div className="text-center">
              <span
                onClick={handleSecretHeaderClick}
                className="block font-malayalam text-[13px] text-onam-maroon mb-1.5 cursor-default select-none"
                title="Onam 2026"
              >
                ഓണം 2026
              </span>
              <h2 className="font-serif text-[32px] font-semibold leading-tight text-onam-ink tracking-tight">
                Onam Sadhya
              </h2>
              <p className="text-[13px] text-onam-ink-soft mt-1.5 font-medium">
                Gate pass registration · 21 Aug 2026
              </p>
              <Thoran className="mx-auto mt-4 h-11 w-56 opacity-90" />
            </div>

            <div className="rule-gold my-6" />

            {error && (
              <div className="mb-5 p-3.5 rounded-xl bg-onam-red/5 border border-onam-red/25 text-onam-maroon text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-onam-red" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-4">
              <p className="text-xs text-onam-ink-soft/90 text-center leading-relaxed px-2 font-sans">
                Welcome! Sign in with your student Google account to access or request your official Onam Sadhya pass.
              </p>

              {/* Google's button is an iframe it deliberately hardens against being
                  hidden or overlaid - that is the clickjacking vector - so it has to
                  be rendered visibly and styled through its own options. Our themed
                  button stays as the fallback for when GSI never renders. */}
              <div ref={googleBtnRef} className="flex justify-center min-h-[44px]" />

              {!gsiReady && !gsiTimedOut && (
                <div className="w-full h-[44px] rounded-full bg-onam-cream-line/60 animate-pulse" />
              )}

              {!gsiReady && gsiTimedOut && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleGoogleSignIn}
                  className="btn-leaf flex w-full items-center justify-center gap-3 py-3.5 pl-3 pr-5 text-[15px]"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm">
                    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.28v3.13C3.25 21.3 7.31 24 12 24z"/>
                      <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.6H1.28C.46 8.23 0 10.06 0 12s.46 3.77 1.28 5.4h4z"/>
                      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.28 6.6l4 3.13c.95-2.83 3.6-4.98 6.72-4.98z"/>
                    </svg>
                  </span>
                  <span>{loading ? 'Signing you in…' : 'Sign in with Google'}</span>
                </button>
              )}
            </div>

            {/* Dev quick login shortcuts — rendered ONLY when DEV_MODE is true */}
            {devModeEnabled && (
              <div className="mt-8 pt-4 border-t border-onam-cream-line">
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

      {/* Hidden Emergency Override Modal (Triggered strictly by 5 clicks on header title for offline dev/emergencies) */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card-cream max-w-sm w-full p-6 relative">
            <button
              onClick={() => setShowOverrideModal(false)}
              className="absolute top-4 right-4 text-onam-ink-soft hover:text-onam-ink transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-2">
              <ShieldAlert className="w-5 h-5 text-onam-gold" />
              <h3 className="font-serif text-lg font-semibold text-onam-ink">Emergency Mode</h3>
            </div>
            <p className="text-xs text-onam-ink-soft leading-relaxed mb-4">
              Enter secret override authorization code for offline emergency access.
            </p>

            <form onSubmit={handleAdminOverrideSubmit} className="space-y-4">
              <div>
                <label className="label-cream">
                  Override Code
                </label>
                <input
                  type="password"
                  required
                  value={overrideCode}
                  onChange={(e) => setOverrideCode(e.target.value)}
                  placeholder="Enter override key…"
                  className={inputClass}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-leaf w-full py-3.5 text-[13px]"
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
