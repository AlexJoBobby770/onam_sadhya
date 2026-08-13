import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { ShieldCheck, CheckCircle2, XCircle, Clock, Eye, QrCode, Search, RefreshCw } from 'lucide-react';

export const AdminDashboard = ({ onOpenScanner }) => {
  const [tickets, setTickets] = useState([]);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals state
  const [previewImage, setPreviewImage] = useState(null);
  const [rejectTicketId, setRejectTicketId] = useState(null);
  const [rejectReason, setRejectReason] = useState('Payment reference mismatch');
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    fetchTickets();
  }, [statusFilter]);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const endpoint = statusFilter === 'all' ? '/admin/tickets' : `/admin/tickets?status=${statusFilter}`;
      const res = await api.get(endpoint);
      setTickets(res.data);
    } catch (err) {
      console.error('Failed to fetch tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (ticketId) => {
    setProcessingId(ticketId);
    try {
      await api.post(`/admin/tickets/${ticketId}/approve`, { note: 'Verified by Admin' });
      fetchTickets();
    } catch (err) {
      alert('Failed to approve ticket: ' + (err.response?.data?.detail || err.message));
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectTicketId || !rejectReason) return;

    setProcessingId(rejectTicketId);
    try {
      await api.post(`/admin/tickets/${rejectTicketId}/reject`, { reason: rejectReason });
      setRejectTicketId(null);
      fetchTickets();
    } catch (err) {
      alert('Failed to reject ticket: ' + (err.response?.data?.detail || err.message));
    } finally {
      setProcessingId(null);
    }
  };

  const filteredTickets = tickets.filter(t => 
    t.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.user_phone?.includes(searchQuery) ||
    t.user_roll_no?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
            <span>Admin Approvals & Verification</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">Review student payment submissions and approve gate passes.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchTickets}
            className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:text-white transition"
            title="Refresh List"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={onOpenScanner}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow transition flex items-center gap-2"
          >
            <QrCode className="w-4 h-4" />
            <span>Open Gate Scanner</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        
        <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 w-full sm:w-auto">
          {['pending', 'approved', 'rejected', 'all'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold uppercase transition ${
                statusFilter === status
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name, phone..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Tickets Grid */}
      {loading ? (
        <div className="text-center py-12 text-slate-500 text-sm">Loading submissions...</div>
      ) : filteredTickets.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 p-12 rounded-2xl text-center text-slate-400 space-y-2">
          <Clock className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="font-bold text-white text-sm">No tickets found</p>
          <p className="text-xs text-slate-500">No submissions matching filter '{statusFilter}'.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTickets.map((t) => (
            <div
              key={t.id}
              className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-white text-sm">{t.user_name}</h3>
                    <p className="text-xs text-slate-400 font-mono">Phone: {t.user_phone}</p>
                  </div>
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                    t.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                    t.status === 'rejected' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                    'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  }`}>
                    {t.status}
                  </span>
                </div>

                <div className="bg-slate-950 p-3 rounded-lg text-xs font-mono space-y-1">
                  <p className="text-slate-300">Note: <span className="text-white font-sans">{t.payment_note || 'None'}</span></p>
                  {t.rejection_reason && (
                    <p className="text-rose-400 font-sans">Reason: {t.rejection_reason}</p>
                  )}
                  {t.used && (
                    <p className="text-emerald-400 font-bold">Status: Scanned at gate</p>
                  )}
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-800">
                {t.payment_proof_url ? (
                  <button
                    onClick={() => setPreviewImage(t.payment_proof_url)}
                    className="w-full py-2 px-3 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-emerald-400 flex items-center justify-center gap-1.5 transition"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Receipt Image</span>
                  </button>
                ) : (
                  <div className="text-[11px] text-slate-500 italic text-center py-1">No receipt image attached</div>
                )}

                {t.status === 'pending' && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => handleApprove(t.id)}
                      disabled={processingId === t.id}
                      className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow transition flex items-center justify-center gap-1 disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Approve</span>
                    </button>

                    <button
                      onClick={() => { setRejectTicketId(t.id); setRejectReason('Payment reference mismatch'); }}
                      disabled={processingId === t.id}
                      className="py-2 px-3 rounded-xl bg-slate-950 hover:bg-rose-950/40 border border-rose-500/30 text-rose-400 font-bold text-xs transition flex items-center justify-center gap-1 disabled:opacity-50"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  </div>
                )}
              </div>

            </div>
          ))}
        </div>
      )}

      {/* MODAL 1: Payment Proof Preview */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-sm">Receipt Image Preview</h3>
              <button onClick={() => setPreviewImage(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="max-h-[60vh] overflow-auto rounded-xl bg-slate-950 p-2">
              <img src={previewImage} alt="Payment Proof" className="w-full h-auto object-contain rounded" />
            </div>
            <button
              onClick={() => setPreviewImage(null)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* MODAL 2: Reject Ticket Reason */}
      {rejectTicketId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="font-bold text-rose-400 text-base">Reject Ticket Request</h3>
            <p className="text-xs text-slate-300">Enter reason for rejecting this submission.</p>
            
            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <textarea
                rows={3}
                required
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter rejection reason"
                className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-rose-500"
              />

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRejectTicketId(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow"
                >
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
