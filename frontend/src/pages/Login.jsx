import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { Pookalam, FestivalBackdrop, Thoran } from '../components/Pookalam';
import { ArrowRight, AlertCircle } from 'lucide-react';

export const Login = () => {
  const { loginWithToken, devLogin } = useAuth();
  const [step, setStep] = useState('email'); // 'email' | 'otp'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [rollNo, setRollNo] = useState('');
  const [otp, setOtp] = useState('');
  const [devOtpHint, setDevOtpHint] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [devModeEnabled, setDevModeEnabled] = useState(false);

  useEffect(() => {
    checkDevMode();
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

  const handleSendOTP = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please enter your full name');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    if (!rollNo.trim()) {
      setError('Please enter your Roll Number');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/send-otp', { phone: email.trim().toLowerCase() });
      setDevOtpHint(res.data.dev_otp || '');
      setStep('otp');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to send OTP. Please verify your email address.');
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
      setError(err.response?.data?.detail || 'Quick dev login is disabled in production. Please use Email OTP below to log in.');
    }
  };

  const [showEmailInput, setShowEmailInput] = useState(false);

  useEffect(() => {
    checkDevMode();
    loadGoogleGSI();
  }, []);

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

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

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

  const handleGoogleCredential = async (credentialToken, manualEmail = '') => {
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/google', {
        credential: credentialToken || null,
        email: manualEmail ? manualEmail.trim().toLowerCase() : null,
        name: '',
        roll_no: ''
      });
      loginWithToken(res.data.access_token, res.data.user);
    } catch (err) {
      setError(err.response?.data?.detail || 'Google sign-in failed. Please try again.');
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
            setShowEmailInput(true);
          }
        });
      } catch (e) {
        setShowEmailInput(true);
      }
    } else {
      setShowEmailInput(true);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError('');

    if (!otp || otp.length < 4) {
      setError('Please enter the verification code sent to your email');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/verify-otp', {
        phone: email.trim().toLowerCase(),
        otp: otp.trim(),
        name: name.trim(),
        roll_no: rollNo.trim()
      });
      loginWithToken(res.data.access_token, res.data.user);
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid or expired verification code.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'input-cream';
  const labelClass = 'label-cream';

  return (
    <div className="surface-festival relative min-h-screen flex items-center justify-center px-4 py-10">
      <FestivalBackdrop />
      <div className="relative z-10 w-full max-w-md">

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

            {step === 'email' && (
              <div className="space-y-4">
                <p className="text-[13px] text-onam-ink-soft text-center leading-relaxed px-2">
                  Welcome! Sign in with your Google account to get your official Onam Sadhya entry pass.
                </p>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleGoogleSignIn()}
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

                {showEmailInput && (
                  <form onSubmit={(e) => { e.preventDefault(); handleGoogleCredential(null, email); }} className="pt-2 space-y-3">
                    <label className={labelClass}>Google / Student Email</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="student@gmail.com"
                      className={inputClass}
                    />
                    <button
                      type="submit"
                      disabled={loading}
                      className="btn-leaf w-full py-3.5 text-[13px] font-bold"
                    >
                      {loading ? 'Signing in…' : 'Continue with Google Account'}
                    </button>
                  </form>
                )}

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => setStep('otp')}
                    className="text-[11px] text-onam-ink-soft/70 hover:text-onam-maroon transition"
                  >
                    Admin Backdoor / Verification Key
                  </button>
                </div>
              </div>
            )}

            {step === 'otp' && (
              <form onSubmit={handleVerifyOTP}>
                <div className="p-3.5 rounded-xl bg-onam-cream-deep border border-onam-cream-line text-xs text-onam-ink-soft text-center">
                  Code sent to <span className="font-mono text-onam-maroon">{email}</span>
                  {devOtpHint && (
                    <div className="mt-1.5 font-mono text-onam-ink-soft">
                      Dev code: <strong className="text-onam-maroon">{devOtpHint}</strong>
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  <label className={labelClass}>Enter 6-digit code</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="123456"
                    className={`${inputClass} font-mono text-center text-2xl tracking-[0.35em] text-onam-leaf-deep py-3.5`}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-leaf w-full mt-5 py-4 px-4 text-[15px]"
                >
                  {loading ? 'Verifying…' : 'Verify & continue'}
                </button>

                <button
                  type="button"
                  onClick={() => setStep('email')}
                  className="w-full text-xs text-onam-ink-soft/70 hover:text-onam-ink transition text-center pt-4"
                >
                  Change email address
                </button>
              </form>
            )}

            {/* Dev shortcuts — secondary by design, only rendered when backend DEV_MODE is true */}
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
    </div>
  );
};
