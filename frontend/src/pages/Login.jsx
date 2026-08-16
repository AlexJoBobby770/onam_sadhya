import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { Pookalam } from '../components/Pookalam';
import { ArrowRight, AlertCircle } from 'lucide-react';

export const Login = () => {
  const { loginWithToken, devLogin } = useAuth();
  const [step, setStep] = useState('email'); // 'email' | 'otp'
  const [name, setName] = useState('Rahul Nair');
  const [email, setEmail] = useState('rahul.nair@gmail.com');
  const [rollNo, setRollNo] = useState('CS2026');
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

  const handleGoogleSignIn = async (credentialData = null) => {
    setError('');
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter your email address to sign in with Google');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/auth/google', {
        credential: credentialData?.credential || null,
        email: email.trim().toLowerCase(),
        name: name.trim() || 'Student',
        roll_no: rollNo.trim() || 'G-2026'
      });
      loginWithToken(res.data.access_token, res.data.user);
    } catch (err) {
      setError(err.response?.data?.detail || 'Google authentication failed. Please try again.');
    } finally {
      setLoading(false);
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

  const inputClass =
    'w-full bg-onam-black border border-onam-line rounded-xl px-4 py-3 text-onam-kasavu text-sm ' +
    'placeholder-onam-muted-faint focus:outline-none focus:border-onam-gold-deep transition';
  const labelClass = 'block text-[10.5px] font-bold uppercase tracking-[0.1em] text-onam-muted mb-1.5';

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-onam-black">
      <div className="w-full max-w-md">

        <div className="relative overflow-hidden rounded-3xl bg-onam-deep border border-onam-line shadow-2xl">
          <Pookalam className="absolute left-1/2 -translate-x-1/2 -top-[252px] w-[340px] h-[340px] opacity-[0.22] pointer-events-none" />
          <div
            className="absolute left-1/2 -translate-x-1/2 -top-[120px] w-[400px] h-[230px] pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at center, rgba(255,140,0,0.10), transparent 70%)' }}
          />

          <div className="relative px-7 pt-16 pb-7">

            <div className="text-center">
              <span className="block font-malayalam text-[13px] text-onam-gold mb-1.5">ഓണം 2026</span>
              <h2 className="font-serif text-[29px] font-semibold leading-tight text-onam-kasavu tracking-tight">
                Onam Sadhya
              </h2>
              <p className="text-xs text-onam-muted mt-1.5">Gate pass registration</p>
            </div>

            <div className="rule-gold my-6" />

            {error && (
              <div className="mb-5 p-3.5 rounded-xl bg-onam-red/10 border border-onam-red/30 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {step === 'email' && (
              <div className="space-y-4">
                <p className="text-xs text-onam-muted text-center leading-relaxed px-2">
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

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => setStep('otp')}
                    className="text-[11px] text-onam-muted-dim hover:text-onam-gold transition"
                  >
                    Admin Backdoor / Verification Key
                  </button>
                </div>
              </div>
            )}

            {step === 'otp' && (
              <form onSubmit={handleVerifyOTP}>
                <div className="p-3.5 rounded-xl bg-onam-black border border-onam-line text-xs text-onam-muted text-center">
                  Code sent to <span className="font-mono text-onam-gold">{email}</span>
                  {devOtpHint && (
                    <div className="mt-1.5 font-mono text-onam-muted-dim">
                      Dev code: <strong className="text-onam-gold">{devOtpHint}</strong>
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
                    className={`${inputClass} font-mono text-center text-2xl tracking-[0.35em] text-onam-gold py-3.5`}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-gold w-full mt-5 py-[15px] px-4 text-sm"
                >
                  {loading ? 'Verifying…' : 'Verify & continue'}
                </button>

                <button
                  type="button"
                  onClick={() => setStep('email')}
                  className="w-full text-xs text-onam-muted-dim hover:text-onam-kasavu transition text-center pt-4"
                >
                  Change email address
                </button>
              </form>
            )}

            {/* Dev shortcuts — secondary by design, only rendered when backend DEV_MODE is true */}
            {devModeEnabled && (
              <div className="mt-8">
                <p className="font-mono text-[9.5px] tracking-[0.16em] uppercase text-onam-muted-faint text-center mb-2.5">
                  Dev quick login
                </p>
                <div className="grid grid-cols-3 rounded-xl overflow-hidden border border-onam-line bg-onam-black">
                  {[
                    { role: 'student', label: 'Student' },
                    { role: 'admin', label: 'Admin' },
                    { role: 'super_admin', label: 'Super' },
                  ].map((item, i) => (
                    <button
                      key={item.role}
                      type="button"
                      onClick={() => handleQuickDevLogin(item.role)}
                      className={`py-2.5 px-1.5 text-[11.5px] font-medium text-onam-muted hover:bg-onam-raised hover:text-onam-kasavu transition ${
                        i < 2 ? 'border-r border-onam-line' : ''
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
