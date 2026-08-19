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

              {/* A themed button here would still depend on window.google existing,
                  so it cannot recover a genuinely blocked/failed GSI load - it would
                  just be a button that lies. An honest message plus a retry is more
                  useful than a second button pretending to be an alternate path. */}
              {!gsiReady && gsiTimedOut && (
                <div className="text-center space-y-2">
                  <p className="text-xs text-onam-red">
                    Couldn't load Google Sign-In. Check your connection or try a different browser.
                  </p>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="text-xs font-semibold text-onam-gold-deep underline underline-offset-2"
                  >
                    Retry
                  </button>
                </div>
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
