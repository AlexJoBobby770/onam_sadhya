import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { Phone, KeyRound, ArrowRight, AlertCircle, ShieldCheck, Ticket, UserCheck } from 'lucide-react';

export const Login = () => {
  const { loginWithToken, devLogin } = useAuth();
  const [step, setStep] = useState('phone'); // 'phone' | 'otp'
  const [name, setName] = useState('Rahul Nair');
  const [phone, setPhone] = useState('9876543210');
  const [otp, setOtp] = useState('');
  const [devOtpHint, setDevOtpHint] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendOTP = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!phone || phone.length < 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/send-otp', { phone: phone.trim() });
      setDevOtpHint(res.data.dev_otp || '');
      setStep('otp');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to send OTP. Please check your phone number.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError('');

    if (!otp || otp.length < 4) {
      setError('Please enter the verification code sent to your phone');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/verify-otp', {
        phone: phone.trim(),
        otp: otp.trim(),
        name: name.trim()
      });
      loginWithToken(res.data.access_token, res.data.user);
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid or expired verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickRoleLogin = async (role) => {
    setError('');
    try {
      if (role === 'student') {
        await devLogin('9876543210', 'Rahul Nair', 'student');
      } else if (role === 'admin') {
        await devLogin('9998887771', 'Ananya V (Volunteer Admin)', 'admin');
      } else if (role === 'super_admin') {
        await devLogin('9998887770', 'Dr. Radhakrishnan (Super Admin)', 'super_admin');
      }
    } catch (err) {
      setError('Dev login failed');
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
          <p className="text-xs text-slate-400 mt-1">College Fest Gate Entry Verification System</p>
        </div>

        {error && (
          <div className="mb-6 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: Phone & Name Input */}
        {step === 'phone' && (
          <form onSubmit={handleSendOTP} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Phone Number</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Phone className="w-4 h-4" />
                </div>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="9876543210"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 transition font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
            >
              <span>{loading ? 'Sending OTP...' : 'Send Verification OTP'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* STEP 2: OTP Input */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 text-center">
              Verification OTP sent to <span className="font-mono text-emerald-400 font-bold">{phone}</span>
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
              onClick={() => setStep('phone')}
              className="w-full text-xs text-slate-400 hover:text-slate-200 transition text-center pt-2"
            >
              Change Phone Number
            </button>
          </form>
        )}

        {/* Quick Role Switcher for Development */}
        <div className="mt-8 pt-6 border-t border-slate-800">
          <p className="text-[11px] font-semibold text-slate-400 text-center mb-3">
            Quick Dev Login Switcher
          </p>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handleQuickRoleLogin('student')}
              className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left transition"
            >
              <p className="text-xs font-bold text-white">Student</p>
              <p className="text-[10px] text-slate-500">View Pass</p>
            </button>

            <button
              onClick={() => handleQuickRoleLogin('admin')}
              className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left transition"
            >
              <p className="text-xs font-bold text-white">Admin</p>
              <p className="text-[10px] text-slate-500">Approvals</p>
            </button>

            <button
              onClick={() => handleQuickRoleLogin('super_admin')}
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
