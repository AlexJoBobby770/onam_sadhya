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
              <form onSubmit={handleSendOTP}>
                {/* name + roll share a row so the submit button stays above the fold on small phones */}
                <div className="grid grid-cols-[1.35fr_1fr] gap-2.5">
                  <div>
                    <label className={labelClass}>Full name</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Roll no</label>
                    <input
                      type="text"
                      required
                      value={rollNo}
                      onChange={(e) => setRollNo(e.target.value)}
                      placeholder="CS2026"
                      className={`${inputClass} font-mono uppercase`}
                    />
                  </div>
                </div>

                <div className="mt-3.5">
                  <label className={labelClass}>Email address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="student@gmail.com"
                    className={`${inputClass} font-mono`}
                  />
                  <p className="text-[11px] text-onam-muted-dim mt-2 leading-relaxed">
                    We'll send a 6-digit code here. Any personal email works.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-gold w-full mt-5 py-[15px] px-4 text-sm flex items-center justify-center gap-2"
                >
                  <span>{loading ? 'Sending code…' : 'Send verification code'}</span>
                  {!loading && <ArrowRight className="w-4 h-4" />}
                </button>
              </form>
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
