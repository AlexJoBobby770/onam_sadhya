import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Upload, XCircle, Clock, Download, AlertCircle, Ticket } from 'lucide-react';
import { Thoran } from '../components/Pookalam';

export const StudentDashboard = () => {
  const { user, updateUser } = useAuth();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [studentName, setStudentName] = useState(user?.name || '');
  const [rollNo, setRollNo] = useState(user?.roll_no || '');
  const [note, setNote] = useState('');
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

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setError('');
    if (!rollNo.trim()) {
      setError('Please enter your Class or Roll Number.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/student/profile', {
        roll_no: rollNo.trim(),
        name: studentName.trim() || user?.name
      });
      updateUser(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update profile.');
    } finally {
      setSubmitting(false);
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-onam-leaf-deep"></div>
      </div>
    );
  }

  const steps = [
    { n: '1', title: 'Pay ₹250 by UPI', body: 'Send it to any committee member and screenshot the receipt.' },
    { n: '2', title: 'Upload the receipt', body: 'One committee member checks it by eye — usually within a day.' },
    { n: '3', title: 'Show the QR at the gate', body: 'Single use. Save it to your phone before you come.' },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-8 lg:py-12">

      <div className="mb-8 text-center lg:mb-10">
        <span className="font-malayalam text-[13px] text-onam-maroon">ഓണം 2026</span>
        <h2 className="mt-1 font-serif text-3xl font-semibold tracking-tight text-onam-ink lg:text-4xl">
          Onam Sadhya
        </h2>
        <p className="mt-1.5 text-sm text-onam-ink-soft">21 August 2026 · College Hall</p>
        <Thoran className="mx-auto mt-4 h-12 w-72 opacity-90" />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,1fr)]">

        {/* Side panel — event facts. Sits under the main card on phones. */}
        <aside className="order-2 lg:order-1 card-cream p-6">
          <p className="panel-eyebrow">The feast</p>
          <h3 className="panel-title">Onam Sadhya</h3>
          <div className="panel-divider" />

          {/* Menu-card leaders: the eye tracks the dots to the value, so labels
              can stay small without the row falling apart. */}
          <dl className="space-y-3">
            {[
              ['Date', '21 August 2026'],
              ['Serving', '12:30 pm onwards'],
              ['Venue', 'College Hall'],
            ].map(([k, v]) => (
              <div key={k} className="leader-row">
                <dt className="text-[12px] text-onam-ink-soft">{k}</dt>
                <span className="leader-fill" aria-hidden="true" />
                <dd className="text-[13px] font-medium text-onam-ink tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>

          {/* The price is the one number that matters, so it gets to be a figure */}
          <div className="mt-5 flex items-end justify-between border-t border-onam-cream-line pt-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-onam-ink-soft">Contribution</p>
              <p className="text-[11px] text-onam-ink-soft/70">per plate</p>
            </div>
            <p className="font-serif text-[30px] font-semibold leading-none text-onam-leaf-deep tabular-nums">
              ₹250
            </p>
          </div>

          <p className="mt-5 border-l-2 border-onam-gold-deep/50 pl-3 text-[11.5px] leading-relaxed text-onam-ink-soft">
            Seats are limited to the hall's capacity. Passes are issued in the order payments
            are verified.
          </p>
        </aside>

        {/* Main column */}
        <div className="order-1 lg:order-2">

      {/* CASE 0: PROFILE INCOMPLETE -> MANDATORY ROLL NO FORM */}
      {(!user?.roll_no || !user.roll_no.trim()) ? (
        <div className="card-cream overflow-hidden">
          <div className="kasavu-band" />
          <div className="p-6 space-y-5">
          <div>
            <p className="panel-eyebrow">One more thing</p>
            <h3 className="panel-title !text-2xl">Complete your profile</h3>
            <p className="text-[13px] text-onam-ink-soft mt-2 leading-relaxed">
              Please enter your Class or Roll Number to activate pass requesting.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-onam-red/5 border border-onam-red/25 text-onam-maroon text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="label-cream">Full Name</label>
              <input
                type="text"
                required
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Rahul Nair"
                className="input-cream"
              />
            </div>

            <div>
              <label className="label-cream">Class / Roll Number</label>
              <input
                type="text"
                required
                value={rollNo}
                onChange={(e) => setRollNo(e.target.value)}
                placeholder="CS2026 / 12-A"
                className="input-cream font-mono uppercase"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-leaf w-full py-4 px-4 text-[15px]"
            >
              {submitting ? 'Saving profile…' : 'Save profile & continue'}
            </button>
          </form>
          </div>
        </div>
      ) : (
        <>
          {/* CASE 1: NO TICKET YET OR REJECTED -> SUBMISSION FORM */}
          {(!ticket || ticket.status === 'rejected') && (
        <div className="card-cream overflow-hidden">
          <div className="kasavu-band" />
          <div className="p-6 space-y-5">

            {ticket?.status === 'rejected' && (
              <div className="p-4 rounded-xl bg-onam-red/5 border border-onam-red/25 flex items-start gap-3">
                <XCircle className="w-5 h-5 text-onam-maroon shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-onam-maroon text-sm">Previous request rejected</p>
                  <p className="text-xs text-onam-maroon/80 mt-0.5">
                    {ticket.rejection_reason || 'Invalid payment details'}
                  </p>
                  <p className="text-xs text-onam-ink-soft mt-2">Submit updated proof below.</p>
                </div>
              </div>
            )}

            <div>
              <p className="panel-eyebrow">Step 2 of 3</p>
              <h3 className="panel-title !text-2xl">Request your pass</h3>
              <p className="text-[13px] text-onam-ink-soft mt-2 leading-relaxed">
                Pay ₹250 by UPI to a committee member, then upload the receipt here for verification.
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-onam-red/5 border border-onam-red/25 text-onam-maroon text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmitProof} className="space-y-4">
              <div className="grid grid-cols-[1.35fr_1fr] gap-2.5">
                <div>
                  <label className="label-cream">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="Rahul Nair"
                    className="input-cream"
                  />
                </div>
                <div>
                  <label className="label-cream">
                    Class / Roll No
                  </label>
                  <input
                    type="text"
                    required
                    value={rollNo}
                    onChange={(e) => setRollNo(e.target.value)}
                    placeholder="CS2026 / 12-A"
                    className="input-cream font-mono uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="label-cream">
                  Payment Reference
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. GPay to Arjun, 8pm"
                  className="input-cream"
                />
              </div>

              <div>
                <label className="label-cream">
                  Receipt screenshot
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFile(e.target.files[0])}
                  className="input-cream cursor-pointer py-2.5 text-xs text-onam-ink-soft file:mr-3 file:rounded-lg file:border-0 file:bg-onam-leaf-deep file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-onam-kasavu"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn-leaf w-full py-4 px-4 text-[15px] flex items-center justify-center gap-2"
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
        <div className="card-cream overflow-hidden text-center">
          <div className="kasavu-band" />
          <div className="p-8 space-y-4">
            <div className="w-14 h-14 rounded-full bg-onam-orange/15 border border-onam-orange/40 flex items-center justify-center mx-auto text-onam-orange">
              <Clock className="w-7 h-7" />
            </div>
            <div>
              <h3 className="font-serif text-2xl font-semibold text-onam-ink">Under review</h3>
              <p className="text-[13px] text-onam-ink-soft mt-2 leading-relaxed max-w-xs mx-auto">
                A committee member is checking your payment. Your pass appears here once approved.
              </p>
            </div>
            <div className="inline-block px-3.5 py-1.5 rounded-lg bg-onam-cream-deep border border-onam-cream-line text-[11px] text-onam-ink-soft font-mono">
              Pending approval
            </div>
          </div>
        </div>
      )}

      {/* CASE 3: APPROVED -> THE PASS */}
      {ticket && ticket.status === 'approved' && (
        <div>
          <div className="text-center mb-5">
            <h3 className="font-serif text-2xl font-semibold text-onam-ink">
              {ticket.used ? 'Pass already used' : 'Your pass is ready'}
            </h3>
            <p className="text-[13px] text-onam-ink-soft mt-1">
              {ticket.used ? 'This pass has been scanned at the gate' : 'Show this at the hall entrance'}
            </p>
          </div>

          {/* Banana-leaf panel behind the pass — cream on cream would vanish */}
          <div className="rounded-[26px] bg-gradient-to-b from-onam-leaf-deep to-[#1F4A0F] p-3 shadow-[0_26px_60px_-30px_rgba(31,74,15,0.9)]">
          <div className={`relative bg-onam-kasavu rounded-2xl overflow-hidden ${ticket.used ? 'opacity-60' : ''}`}>
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
              <div className="absolute top-1/2 -translate-y-1/2 -left-2.5 w-5 h-5 rounded-full bg-onam-leaf-deep" />
              <div className="absolute top-1/2 -translate-y-1/2 -right-2.5 w-5 h-5 rounded-full bg-onam-leaf-deep" />
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
          </div>

          <button
            onClick={handleDownloadQR}
            className="btn-leaf w-full mt-4 py-4 px-4 text-[15px] flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            Save pass
          </button>

          <div className="mt-4 rounded-xl bg-onam-cream-deep border border-onam-cream-line border-l-[3px] border-l-onam-orange px-3.5 py-3 text-[11.5px] leading-relaxed text-onam-ink-soft">
            <b className="font-bold text-onam-ink">Save it now.</b> The hall may have patchy
            signal, and a saved pass still scans.
          </div>
        </div>
      )}
      </>
      )}

        </div>

        {/* Side panel — how it works. */}
        <aside className="order-3 card-cream p-6">
          <p className="panel-eyebrow">Getting in</p>
          <h3 className="panel-title">How it works</h3>
          <div className="panel-divider" />

          {/* A rail connects the markers so the three steps read as one sequence
              rather than three unrelated bullets. */}
          <ol className="relative">
            <span
              aria-hidden="true"
              className="absolute left-[13px] top-3 bottom-3 w-px bg-onam-cream-line"
            />
            {steps.map((step, i) => (
              <li key={step.n} className={`relative flex gap-4 ${i < steps.length - 1 ? 'pb-6' : ''}`}>
                <span className="relative z-10 flex h-[27px] w-[27px] shrink-0 items-center justify-center rounded-full border border-onam-gold-deep/45 bg-onam-cream font-serif text-[13px] font-semibold text-onam-leaf-deep">
                  {step.n}
                </span>
                <div className="pt-[3px]">
                  <p className="text-[13.5px] font-semibold leading-snug text-onam-ink">{step.title}</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-onam-ink-soft">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </aside>

      </div>
    </div>
  );
};
