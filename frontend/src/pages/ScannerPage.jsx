import React, { useEffect, useState, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import api from '../api/client';
import { QrCode, CheckCircle2, XCircle, AlertTriangle, Camera, Keyboard, Search, UserCheck, Wifi, WifiOff, RefreshCw } from 'lucide-react';

export const ScannerPage = () => {
  const [scanResult, setScanResult] = useState(null);
  const [manualToken, setManualToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(true);
  const scannerRef = useRef(null);

  // Offline support and manual search state
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [approvedList, setApprovedList] = useState([]);
  const [manualSearch, setManualSearch] = useState('');
  const [queuedScansCount, setQueuedScansCount] = useState(0);

  useEffect(() => {
    fetchApprovedTicketsCache();
    checkQueuedScans();

    const handleOnline = () => {
      setIsOnline(true);
      syncQueuedScans();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    let html5QrcodeScanner;
    
    if (cameraActive) {
      html5QrcodeScanner = new Html5QrcodeScanner(
        "qr-reader",
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          showTorchButtonIfSupported: true
        },
        /* verbose= */ false
      );

      html5QrcodeScanner.render(
        (decodedText) => {
          handleProcessScan(decodedText);
        },
        () => {
          // ignore scan errors per frame
        }
      );
      scannerRef.current = html5QrcodeScanner;
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(err => console.error("Scanner clear error", err));
      }
    };
  }, [cameraActive]);

  const fetchApprovedTicketsCache = async () => {
    try {
      const res = await api.get('/admin/approved-tickets');
      setApprovedList(res.data);
      localStorage.setItem('onam_approved_tickets', JSON.stringify(res.data));
    } catch (err) {
      console.warn('Could not fetch latest approved tickets online, reading local cache.');
      const cached = localStorage.getItem('onam_approved_tickets');
      if (cached) {
        setApprovedList(JSON.parse(cached));
      }
    }
  };

  const checkQueuedScans = () => {
    const queued = JSON.parse(localStorage.getItem('onam_queued_scans') || '[]');
    setQueuedScansCount(queued.length);
  };

  const syncQueuedScans = async () => {
    const queued = JSON.parse(localStorage.getItem('onam_queued_scans') || '[]');
    if (queued.length === 0) return;

    const remaining = [];
    for (const item of queued) {
      try {
        if (item.type === 'token') {
          await api.post('/admin/scan', { qr_token: item.payload });
        } else if (item.type === 'manual') {
          await api.post('/admin/scan-manual', { ticket_id: item.payload });
        }
      } catch (err) {
        remaining.push(item);
      }
    }
    localStorage.setItem('onam_queued_scans', JSON.stringify(remaining));
    setQueuedScansCount(remaining.length);
    fetchApprovedTicketsCache();
  };

  const handleProcessScan = async (qrToken) => {
    if (loading) return;
    setLoading(true);

    if (!navigator.onLine) {
      // OFFLINE VALIDATION FALLBACK
      handleOfflineScanValidation(qrToken);
      setLoading(false);
      return;
    }

    try {
      const res = await api.post('/admin/scan', { qr_token: qrToken });
      setScanResult(res.data);
      fetchApprovedTicketsCache();
    } catch (err) {
      setScanResult({
        success: false,
        message: err.response?.data?.detail || 'Failed to process QR code scan.',
        status: 'INVALID_TOKEN'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOfflineScanValidation = (qrToken) => {
    const cached = JSON.parse(localStorage.getItem('onam_approved_tickets') || '[]');
    const match = cached.find(t => t.qr_token === qrToken);

    if (!match) {
      setScanResult({
        success: false,
        message: 'OFFLINE REJECTION — Token not found in local approved tickets cache.',
        status: 'INVALID_TOKEN'
      });
      return;
    }

    if (match.used) {
      setScanResult({
        success: false,
        message: `OFFLINE ALREADY SCANNED — Pass for ${match.user_name} was already marked as used.`,
        status: 'ALREADY_USED',
        student_name: match.user_name,
        roll_no: match.user_roll_no,
        phone: match.user_phone
      });
      return;
    }

    // Mark as used in local cache & queue write
    match.used = true;
    localStorage.setItem('onam_approved_tickets', JSON.stringify(cached));
    setApprovedList(cached);

    const queued = JSON.parse(localStorage.getItem('onam_queued_scans') || '[]');
    queued.push({ type: 'token', payload: qrToken, timestamp: new Date().toISOString() });
    localStorage.setItem('onam_queued_scans', JSON.stringify(queued));
    setQueuedScansCount(queued.length);

    setScanResult({
      success: true,
      message: `ENTRY GRANTED (OFFLINE) — Welcome to Onam Sadhya, ${match.user_name}!`,
      status: 'GRANTED',
      student_name: match.user_name,
      roll_no: match.user_roll_no,
      phone: match.user_phone
    });
  };

  const handleManualScanSubmit = async (ticketId, studentName) => {
    setLoading(true);

    if (!navigator.onLine) {
      // Offline manual mark as used
      const cached = JSON.parse(localStorage.getItem('onam_approved_tickets') || '[]');
      const match = cached.find(t => t.ticket_id === ticketId);
      if (match) {
        match.used = true;
        localStorage.setItem('onam_approved_tickets', JSON.stringify(cached));
        setApprovedList(cached);

        const queued = JSON.parse(localStorage.getItem('onam_queued_scans') || '[]');
        queued.push({ type: 'manual', payload: ticketId, timestamp: new Date().toISOString() });
        localStorage.setItem('onam_queued_scans', JSON.stringify(queued));
        setQueuedScansCount(queued.length);
      }
      setScanResult({
        success: true,
        message: `ENTRY GRANTED (OFFLINE MANUAL) — Welcome ${studentName}!`,
        status: 'GRANTED',
        student_name: studentName
      });
      setLoading(false);
      return;
    }

    try {
      const res = await api.post('/admin/scan-manual', { ticket_id: ticketId });
      setScanResult(res.data);
      fetchApprovedTicketsCache();
    } catch (err) {
      setScanResult({
        success: false,
        message: err.response?.data?.detail || 'Manual entry failed.',
        status: 'INVALID_TOKEN'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleManualTokenSubmit = (e) => {
    e.preventDefault();
    if (!manualToken.trim()) return;
    handleProcessScan(manualToken.trim());
    setManualToken('');
  };

  const filteredApproved = approvedList.filter(t => 
    !t.used && (
      t.user_name?.toLowerCase().includes(manualSearch.toLowerCase()) ||
      t.user_phone?.includes(manualSearch) ||
      t.user_roll_no?.toLowerCase().includes(manualSearch.toLowerCase())
    )
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <QrCode className="w-6 h-6 text-emerald-400" />
            <h2 className="text-xl font-bold text-white">Gatekeeper Gate Pass Scanner</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Atomic Single-Use Gate Scanner. Reused passes and duplicate scans are permanently rejected after the first entry.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Connection Status Indicator */}
          <div className={`px-3 py-1.5 rounded-xl border text-xs font-mono flex items-center gap-1.5 ${
            isOnline ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
          }`}>
            {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span>{isOnline ? 'Online' : 'Offline'}</span>
          </div>

          <button
            onClick={() => setCameraActive(!cameraActive)}
            className="px-3.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition flex items-center gap-2"
          >
            <Camera className="w-4 h-4 text-emerald-400" />
            <span>{cameraActive ? 'Disable Camera' : 'Enable Camera'}</span>
          </button>
        </div>
      </div>

      {/* Queued Sync Banner if any pending offline scans */}
      {queuedScansCount > 0 && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center justify-between">
          <span>{queuedScansCount} offline scan log(s) queued for sync.</span>
          {isOnline && (
            <button
              onClick={syncQueuedScans}
              className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Sync Now</span>
            </button>
          )}
        </div>
      )}

      {/* RESULT ALERT BANNER */}
      {scanResult && (
        <div className={`p-6 rounded-2xl border transition-all ${
          scanResult.status === 'GRANTED'
            ? 'bg-emerald-950/80 border-emerald-500 text-emerald-100'
            : scanResult.status === 'ALREADY_USED'
            ? 'bg-rose-950/80 border-rose-500 text-rose-100'
            : 'bg-slate-900 border-amber-500 text-amber-100'
        }`}>
          
          <div className="flex items-start gap-4">
            {scanResult.status === 'GRANTED' ? (
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0 text-emerald-400">
                <CheckCircle2 className="w-7 h-7" />
              </div>
            ) : scanResult.status === 'ALREADY_USED' ? (
              <div className="w-12 h-12 rounded-xl bg-rose-500/20 border border-rose-400/40 flex items-center justify-center shrink-0 text-rose-400">
                <XCircle className="w-7 h-7" />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0 text-amber-400">
                <AlertTriangle className="w-7 h-7" />
              </div>
            )}

            <div className="space-y-2 flex-1">
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded border ${
                  scanResult.status === 'GRANTED' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400' :
                  scanResult.status === 'ALREADY_USED' ? 'bg-rose-500/20 text-rose-300 border-rose-400' :
                  'bg-amber-500/20 text-amber-300 border-amber-400'
                }`}>
                  {scanResult.status.replace(/_/g, ' ')}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {new Date().toLocaleTimeString()}
                </span>
              </div>

              <h3 className="text-xl font-bold text-white">{scanResult.message}</h3>

              {scanResult.student_name && (
                <div className="pt-2 grid grid-cols-2 gap-3 text-xs border-t border-white/10 font-mono">
                  <div>
                    <span className="text-slate-400 text-[10px] block uppercase">Student Name</span>
                    <span className="text-white font-bold text-sm">{scanResult.student_name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block uppercase">Email / Phone</span>
                    <span className="text-emerald-400 font-bold">{scanResult.phone || 'N/A'}</span>
                  </div>
                </div>
              )}

              {scanResult.previously_scanned_at && (
                <div className="p-3 rounded-xl bg-rose-950 border border-rose-500/30 text-rose-200 text-xs font-mono">
                  Attention: This ticket was scanned previously at{' '}
                  <span className="text-white font-bold">
                    {new Date(scanResult.previously_scanned_at).toLocaleTimeString()}
                  </span> by <span className="text-white">{scanResult.scanned_by_name || 'Gatekeeper'}</span>.
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => setScanResult(null)}
            className="mt-4 w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 transition"
          >
            Ready for Next Scan
          </button>
        </div>
      )}

      {/* CAMERA SCANNER BOX */}
      {cameraActive && (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl text-center space-y-4">
          <div className="text-xs font-semibold text-emerald-400">
            Point camera at student QR code pass
          </div>

          <div id="qr-reader" className="w-full max-w-md mx-auto rounded-xl overflow-hidden border border-slate-800 bg-slate-950" />
        </div>
      )}

      {/* MANUAL SEARCH & "MARK AS ENTERED" FOR DEAD PHONES */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-emerald-400" />
          <span>Manual Entry Search (For Dead Phones)</span>
        </h4>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={manualSearch}
            onChange={(e) => setManualSearch(e.target.value)}
            placeholder="Search approved student by name, email, roll number..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
          />
        </div>

        {manualSearch.trim() && (
          <div className="max-h-48 overflow-y-auto space-y-2 border-t border-slate-800 pt-3">
            {filteredApproved.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-2">No matching unentered approved passes found.</p>
            ) : (
              filteredApproved.map((t) => (
                <div key={t.ticket_id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div className="text-xs">
                    <p className="font-bold text-white">{t.user_name}</p>
                    <p className="text-[11px] text-slate-400 font-mono">{t.user_phone} {t.user_roll_no ? `| Roll: ${t.user_roll_no}` : ''}</p>
                  </div>
                  <button
                    onClick={() => handleManualScanSubmit(t.ticket_id, t.user_name)}
                    disabled={loading}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow transition disabled:opacity-50"
                  >
                    Mark as Entered
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* MANUAL TOKEN INPUT FALLBACK */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-3">
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <Keyboard className="w-4 h-4 text-emerald-400" />
          <span>Manual Token String Validation</span>
        </h4>

        <form onSubmit={handleManualTokenSubmit} className="flex gap-2">
          <input
            type="text"
            value={manualToken}
            onChange={(e) => setManualToken(e.target.value)}
            placeholder="Paste signed QR token string..."
            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            disabled={loading || !manualToken.trim()}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow transition disabled:opacity-50"
          >
            Validate Token
          </button>
        </form>
      </div>

    </div>
  );
};
