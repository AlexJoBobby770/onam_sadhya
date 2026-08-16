import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Upload, XCircle, Clock, Download, AlertCircle, Ticket } from 'lucide-react';

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

  const compressImage = (imageFile, maxDimension = 1280, quality = 0.8) => {
    return new Promise((resolve) => {
      if (!imageFile || !imageFile.type.startsWith('image/')) {
        resolve(imageFile);
        return;
      }
      const img = new Image();
      img.src = URL.createObjectURL(imageFile);
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(imageFile);
              return;
            }
            const compressedFile = new File([blob], imageFile.name.replace(/\.[^/.]+$/, "") + ".jpg", {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => resolve(imageFile);
    });
  };

  const handleSubmitProof = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const formData = new FormData();
      if (note) formData.append('note', note);
      if (file) {
        const compressed = await compressImage(file);
        formData.append('proof_file', compressed);
      }

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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-onam-gold"></div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-8">

      {/* CASE 1: NO TICKET YET OR REJECTED -> SUBMISSION FORM */}
      {(!ticket || ticket.status === 'rejected') && (
        <div className="bg-onam-deep border border-onam-line rounded-2xl overflow-hidden">
          <div className="p-6 space-y-5">

            {ticket?.status === 'rejected' && (
              <div className="p-4 rounded-xl bg-onam-red/10 border border-onam-red/30 flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-red-300 text-sm">Previous request rejected</p>
                  <p className="text-xs text-red-300/80 mt-0.5">
                    {ticket.rejection_reason || 'Invalid payment details'}
                  </p>
                  <p className="text-xs text-onam-muted mt-2">Submit updated proof below.</p>
                </div>
              </div>
            )}

            <div>
              <h3 className="font-serif text-xl font-semibold text-onam-kasavu">Request your pass</h3>
              <p className="text-xs text-onam-muted mt-1.5 leading-relaxed">
                Pay ₹250 by UPI to a committee member, then upload the receipt here for verification.
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-onam-red/10 border border-onam-red/30 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmitProof} className="space-y-4">
              <div>
                <label className="block text-[10.5px] font-bold uppercase tracking-[0.1em] text-onam-muted mb-1.5">
                  Payment reference
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. GPay to Arjun, 8pm"
                  className="w-full bg-onam-black border border-onam-line rounded-xl px-4 py-3 text-onam-kasavu text-sm placeholder-onam-muted-faint focus:outline-none focus:border-onam-gold-deep transition"
                />
              </div>

              <div>
                <label className="block text-[10.5px] font-bold uppercase tracking-[0.1em] text-onam-muted mb-1.5">
                  Receipt screenshot
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFile(e.target.files[0])}
                  className="w-full bg-onam-black border border-onam-line rounded-xl px-4 py-2.5 text-onam-muted text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-onam-gold file:text-onam-ink cursor-pointer"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn-gold w-full py-3.5 px-4 text-sm flex items-center justify-center gap-2"
              >
                <Ticket className="w-4 h-4" />
                <span>{submitting ? 'Submitting…' : 'Request pass'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CASE 2: PENDING */}
      {ticket && ticket.status === 'pending' && (
        <div className="bg-onam-deep border border-onam-line rounded-2xl overflow-hidden text-center">
          <div className="p-8 space-y-4">
            <div className="w-12 h-12 rounded-full bg-onam-orange/10 border border-onam-orange/30 flex items-center justify-center mx-auto text-onam-orange">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-serif text-xl font-semibold text-onam-kasavu">Under review</h3>
              <p className="text-xs text-onam-muted mt-2 leading-relaxed max-w-xs mx-auto">
                A committee member is checking your payment. Your pass appears here once approved.
              </p>
            </div>
            <div className="inline-block px-3 py-1 rounded-lg bg-onam-black border border-onam-line text-[11px] text-onam-orange font-mono">
              Pending approval
            </div>
          </div>
        </div>
      )}

      {/* CASE 3: APPROVED -> THE PASS */}
      {ticket && ticket.status === 'approved' && (
        <div>
          <div className="text-center mb-5">
            <h3 className="font-serif text-xl font-semibold text-onam-kasavu">
              {ticket.used ? 'Pass already used' : 'Your pass is ready'}
            </h3>
            <p className="text-xs text-onam-muted mt-1">
              {ticket.used ? 'This pass has been scanned at the gate' : 'Show this at the hall entrance'}
            </p>
          </div>

          {/* Cream kasavu pass — deliberately inverted against the dark app shell */}
          <div className={`relative bg-onam-kasavu rounded-2xl overflow-hidden shadow-2xl ${ticket.used ? 'opacity-60' : ''}`}>
            <div className="kasavu-band" />

            <div className="px-5 pt-4 text-center">
              <p className="font-mono text-[9.5px] tracking-[0.2em] uppercase text-onam-ink-soft/70 mb-2.5">
                Onam Sadhya · 21 Aug 2026
              </p>
              <p className="text-[9.5px] font-bold tracking-[0.14em] uppercase text-onam-ink-soft/70 mb-1">
                Pass holder
              </p>
              <h4 className="font-serif text-[25px] font-semibold text-onam-ink leading-tight mb-2">
                {user.name}
              </h4>
              <div className="flex justify-center gap-4 font-mono text-[11px] text-onam-ink-soft">
                {user.roll_no && <span>{user.roll_no}</span>}
                {user.roll_no && <span>·</span>}
                <span>₹250 paid</span>
              </div>
            </div>

            <div className="flex justify-center px-5 pt-4 pb-1.5">
              {ticket.qr_code_base64 ? (
                <div className="bg-white p-2.5 rounded-xl border border-onam-kasavu-dim">
                  <img src={ticket.qr_code_base64} alt="Sadhya gate pass QR code" className="w-40 h-40 block" />
                </div>
              ) : (
                <div className="w-44 h-44 bg-onam-kasavu-dim rounded-xl flex items-center justify-center text-onam-ink-soft text-xs">
                  Loading QR…
                </div>
              )}
            </div>

            {/* perforation — notches punch through to the page background */}
            <div className="relative h-6">
              <div className="absolute top-1/2 -translate-y-1/2 -left-2.5 w-5 h-5 rounded-full bg-onam-black" />
              <div className="absolute top-1/2 -translate-y-1/2 -right-2.5 w-5 h-5 rounded-full bg-onam-black" />
              <div className="absolute top-1/2 left-4 right-4 border-t-[1.5px] border-dashed border-onam-kasavu-dim" />
            </div>

            <div className="px-5 pb-4">
              {ticket.used ? (
                <div className="flex items-center justify-center gap-2 rounded-lg border border-onam-red/40 bg-onam-red/10 py-2.5 text-[12.5px] font-bold text-onam-red">
                  <XCircle className="w-4 h-4" />
                  Entered {ticket.scanned_at ? `at ${new Date(ticket.scanned_at).toLocaleTimeString()}` : ''}
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 rounded-lg border border-onam-leaf/40 bg-onam-leaf/15 py-2.5 text-[12.5px] font-bold text-[#2F6B18]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4E9E24]" />
                  Valid · single use
                </div>
              )}
              <p className="font-mono text-[9.5px] text-onam-ink-soft/60 text-center mt-2.5 tracking-wide">
                {ticket.id.slice(0, 8).toUpperCase()} · {ticket.id.slice(9, 13).toUpperCase()}
              </p>
            </div>

            <div className="kasavu-band" />
          </div>

          <button
            onClick={handleDownloadQR}
            className="btn-gold w-full mt-4 py-3.5 px-4 text-sm flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            Save pass
          </button>

          <div className="mt-4 rounded-xl bg-onam-deep border border-onam-line border-l-2 border-l-onam-orange px-3.5 py-3 text-[11.5px] leading-relaxed text-onam-muted">
            <b className="text-onam-kasavu font-medium">Save it now.</b> The hall may have patchy
            signal, and a saved pass still scans.
          </div>
        </div>
      )}

    </div>
  );
};
