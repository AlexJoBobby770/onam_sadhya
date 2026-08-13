import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Ticket, Upload, CheckCircle2, XCircle, Clock, Download, AlertCircle } from 'lucide-react';

export const StudentDashboard = () => {
  const { user } = useAuth();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [note, setNote] = useState('Paid via GPay');
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMyTicket();
  }, []);

  const fetchMyTicket = async () => {
    try {
      setLoading(true);
      const res = await api.get('/tickets/me');
      setTicket(res.data);
    } catch (err) {
      console.error('Failed to fetch ticket:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitProof = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const formData = new FormData();
      if (note) formData.append('note', note);
      if (file) formData.append('proof_file', file);

      const res = await api.post('/tickets', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setTicket(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit payment proof.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadQR = () => {
    if (!ticket?.qr_code_base64) return;
    const link = document.createElement('a');
    link.href = ticket.qr_code_base64;
    link.download = `Sadhya_Pass_${user.name.replace(/\s+/g, '_')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      
      {/* User Welcome Banner */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">
            Welcome, {user?.name}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Registered Phone: <span className="font-mono text-slate-200">{user?.phone}</span>
          </p>
        </div>
      </div>

      {/* CASE 1: NO TICKET YET OR REJECTED -> SHOW SUBMISSION FORM */}
      {(!ticket || ticket.status === 'rejected') && (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-6">
          
          {ticket?.status === 'rejected' && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-start gap-3">
              <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Previous Request Rejected</p>
                <p className="text-xs text-rose-300/80 mt-0.5">Reason: {ticket.rejection_reason || 'Invalid payment details'}</p>
                <p className="text-xs text-slate-400 mt-2">Please submit updated proof below.</p>
              </div>
            </div>
          )}

          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Upload className="w-5 h-5 text-emerald-400" />
              <span>Submit Payment Details for Sadhya Pass</span>
            </h3>
            <p className="text-xs text-slate-400">Upload payment receipt screenshot or enter payment reference note for admin verification.</p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmitProof} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Payment Reference / Note</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Paid Rs. 250 via GPay to Committee Member"
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Upload Receipt Image (Optional)</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files[0])}
                className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-600 file:text-white cursor-pointer"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Ticket className="w-4 h-4" />
              <span>{submitting ? 'Submitting Payment Proof...' : 'Request Pass'}</span>
            </button>
          </form>
        </div>
      )}

      {/* CASE 2: PENDING APPROVAL */}
      {ticket && ticket.status === 'pending' && (
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto text-amber-400">
            <Clock className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-white">Payment Proof Under Review</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Your payment submission is being verified by committee admins. Your QR pass will appear here once approved.
          </p>
          <div className="inline-block px-3 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs text-amber-400 font-mono">
            Status: Pending Approval
          </div>
        </div>
      )}

      {/* CASE 3: APPROVED -> DISPLAY QR PASS CARD */}
      {ticket && ticket.status === 'approved' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          
          {/* Header */}
          <div className="bg-slate-950 p-6 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white uppercase tracking-wide">Sadhya Gate Entry Pass</h3>
              <p className="text-xs text-slate-400">Single-Use Official Fest Pass</p>
            </div>
            <div className="px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>Approved</span>
            </div>
          </div>

          {/* Ticket Content */}
          <div className="p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-8">
            
            <div className="space-y-4 text-left w-full md:w-1/2">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase">Pass Holder</p>
                <p className="text-2xl font-bold text-white">{user.name}</p>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-xs">
                <p className="text-slate-400">Phone: <span className="text-white">{user.phone}</span></p>
                {user.roll_no && <p className="text-slate-400">Roll No: <span className="text-white">{user.roll_no}</span></p>}
              </div>

              {/* Status Indicator */}
              <div className={`p-4 rounded-xl border text-xs font-medium ${
                ticket.used
                  ? 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
              }`}>
                <p className="font-bold flex items-center gap-1.5 text-sm">
                  {ticket.used ? (
                    <>
                      <XCircle className="w-4 h-4 text-rose-400" />
                      <span>Gate Entry Completed (Used)</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Ready for Gate Entry (Single Use)</span>
                    </>
                  )}
                </p>
                <p className="text-[11px] opacity-80 mt-1">
                  {ticket.used
                    ? `Scanned at gate on ${new Date(ticket.scanned_at).toLocaleTimeString()}`
                    : 'Present this QR code at hall entry for gate verification.'}
                </p>
              </div>
            </div>

            {/* QR Image */}
            <div className="flex flex-col items-center gap-4 bg-slate-950 p-6 rounded-xl border border-slate-800">
              {ticket.qr_code_base64 ? (
                <div className="bg-white p-3 rounded-xl border border-slate-700">
                  <img
                    src={ticket.qr_code_base64}
                    alt="Sadhya QR Code"
                    className="w-48 h-48 object-contain rounded"
                  />
                </div>
              ) : (
                <div className="w-48 h-48 bg-slate-900 rounded-xl flex items-center justify-center text-slate-500 text-xs">
                  Loading QR Code...
                </div>
              )}

              <button
                onClick={handleDownloadQR}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow transition flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Download Pass</span>
              </button>
            </div>

          </div>

        </div>
      )}

    </div>
  );
};
