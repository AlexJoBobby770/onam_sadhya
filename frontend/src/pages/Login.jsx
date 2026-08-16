import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { Mail, KeyRound, ArrowRight, AlertCircle, Ticket, User, Hash } from 'lucide-react';

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

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-12 bg-slate-950">
      
      {/* Main Container Card */}
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-xl">
        
        {/* Title */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-3">
            <Ticket className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Onam Sadhya Ticketing
          </h2>
          <p className="text-xs text-slate-400 mt-1">Official Student Gate Entry Portal</p>
        </div>

        {error && (
          <div className="mb-6 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: Registration Form */}
        {step === 'email' && (
          <form onSubmit={handleSendOTP} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Full Name</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Rahul Nair"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Roll Number</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Hash className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={rollNo}
                  onChange={(e) => setRollNo(e.target.value)}
                  placeholder="CS2026"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 transition font-mono uppercase"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@gmail.com"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 transition font-mono"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Enter your email address to receive single-use verification OTP</p>
            </div>


            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
            >
              <span>{loading ? 'Sending Email OTP...' : 'Send Verification OTP'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* STEP 2: OTP Input */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 text-center">
              Verification OTP sent to <span className="font-mono text-emerald-400 font-bold">{email}</span>
              {devOtpHint && (
                <div className="mt-1 font-mono text-xs text-slate-400">
                  OTP Code: <strong className="text-emerald-400">{devOtpHint}</strong>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Enter 6-Digit OTP</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="123456"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-emerald-400 placeholder-slate-600 text-lg tracking-widest font-mono text-center focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>{loading ? 'Verifying...' : 'Verify OTP & Continue'}</span>
            </button>

            <button
              type="button"
              onClick={() => setStep('email')}
              className="w-full text-xs text-slate-400 hover:text-slate-200 transition text-center pt-2"
            >
              Change Email Address
            </button>
          </form>
        )}

        {/* Quick Dev Login - only reachable when backend DEV_MODE=true */}
        <div className="mt-8 pt-6 border-t border-slate-800">
          <p className="text-[11px] font-semibold text-slate-400 text-center mb-3">
            Quick Dev Login Switcher
          </p>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handleQuickDevLogin('student')}
              className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left transition"
            >
              <p className="text-xs font-bold text-white">Student</p>
              <p className="text-[10px] text-slate-500">View Pass</p>
            </button>

            <button
              onClick={() => handleQuickDevLogin('admin')}
              className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left transition"
            >
              <p className="text-xs font-bold text-white">Admin</p>
              <p className="text-[10px] text-slate-500">Approvals</p>
            </button>

            <button
              onClick={() => handleQuickDevLogin('super_admin')}
              className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left transition"
            >
              <p className="text-xs font-bold text-white">Super Admin</p>
              <p className="text-[10px] text-slate-500">Analytics</p>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
