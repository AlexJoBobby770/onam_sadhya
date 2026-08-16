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

    try {
      const res = await api.post('/admin/scan', { qr_token: qrToken });
      setScanResult(res.data);
      fetchApprovedTicketsCache();
    } catch (err) {
      if (!err.response) {
        // Request never reached the server (offline, or connected to a network
        // with no real internet) - fall back to the local cache instead of erroring out.
        handleOfflineScanValidation(qrToken);
      } else {
        setScanResult({
          success: false,
          message: err.response?.data?.detail || 'Failed to process QR code scan.',
          status: 'INVALID_TOKEN'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOfflineScanValidation = (lookupValue, lookupField = 'qr_token', queueType = 'token') => {
    const cached = JSON.parse(localStorage.getItem('onam_approved_tickets') || '[]');
    const match = cached.find(t => t[lookupField] === lookupValue);

    if (!match) {
      setScanResult({
        success: false,
        message: 'OFFLINE REJECTION — Not found in local approved tickets cache.',
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
    queued.push({ type: queueType, payload: lookupValue, timestamp: new Date().toISOString() });
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

  const handleManualScanSubmit = async (ticketId) => {
    setLoading(true);

    try {
      const res = await api.post('/admin/scan-manual', { ticket_id: ticketId });
      setScanResult(res.data);
      fetchApprovedTicketsCache();
    } catch (err) {
      if (!err.response) {
        handleOfflineScanValidation(ticketId, 'ticket_id', 'manual');
      } else {
        setScanResult({
          success: false,
          message: err.response?.data?.detail || 'Manual entry failed.',
          status: 'INVALID_TOKEN'
        });
      }
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
      <div className="bg-onam-deep border border-onam-line p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <QrCode className="w-6 h-6 text-onam-gold" />
            <h2 className="text-xl font-bold text-onam-kasavu">Gatekeeper Gate Pass Scanner</h2>
          </div>
          <p className="text-xs text-onam-muted mt-1">
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
            className="px-3.5 py-1.5 rounded-xl bg-onam-black border border-onam-line text-xs font-semibold text-onam-muted hover:bg-onam-raised transition flex items-center gap-2"
          >
            <Camera className="w-4 h-4 text-onam-gold" />
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
              className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-onam-kasavu font-bold text-[11px] flex items-center gap-1"
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
            : 'bg-onam-deep border-amber-500 text-amber-100'
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
                <span className="text-[10px] text-onam-muted font-mono">
                  {new Date().toLocaleTimeString()}
                </span>
              </div>

              <h3 className="text-xl font-bold text-onam-kasavu">{scanResult.message}</h3>

              {scanResult.student_name && (
                <div className="pt-2 grid grid-cols-2 gap-3 text-xs border-t border-white/10 font-mono">
                  <div>
                    <span className="text-onam-muted text-[10px] block uppercase">Student Name</span>
                    <span className="text-onam-kasavu font-bold text-sm">{scanResult.student_name}</span>
                  </div>
                  <div>
                    <span className="text-onam-muted text-[10px] block uppercase">Email / Phone</span>
                    <span className="text-onam-kasavu font-bold">{scanResult.phone || 'N/A'}</span>
                  </div>
                </div>
              )}

              {scanResult.previously_scanned_at && (
                <div className="p-3 rounded-xl bg-rose-950 border border-rose-500/30 text-rose-200 text-xs font-mono">
                  Attention: This ticket was scanned previously at{' '}
                  <span className="text-onam-kasavu font-bold">
                    {new Date(scanResult.previously_scanned_at).toLocaleTimeString()}
                  </span> by <span className="text-onam-kasavu">{scanResult.scanned_by_name || 'Gatekeeper'}</span>.
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => setScanResult(null)}
            className="mt-4 w-full py-2.5 rounded-xl bg-onam-deep hover:bg-onam-raised border border-onam-line text-xs font-bold text-onam-kasavu transition"
          >
            Ready for Next Scan
          </button>
        </div>
      )}

      {/* CAMERA SCANNER BOX */}
      {cameraActive && (
        <div className="bg-onam-deep border border-onam-line p-6 rounded-2xl text-center space-y-4">
          <div className="text-xs font-semibold text-onam-gold">
            Point camera at student QR code pass
          </div>

          <div id="qr-reader" className="w-full max-w-md mx-auto rounded-xl overflow-hidden border border-onam-line bg-onam-black" />
        </div>
      )}

      {/* MANUAL SEARCH & "MARK AS ENTERED" FOR DEAD PHONES */}
      <div className="bg-onam-deep border border-onam-line p-6 rounded-2xl space-y-4">
        <h4 className="text-xs font-bold text-onam-muted uppercase tracking-wider flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-onam-gold" />
          <span>Manual Entry Search (For Dead Phones)</span>
        </h4>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-onam-muted-dim" />
          <input
            type="text"
            value={manualSearch}
            onChange={(e) => setManualSearch(e.target.value)}
            placeholder="Search approved student by name, email, roll number..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-onam-black border border-onam-line text-onam-kasavu text-xs placeholder-onam-muted-faint focus:outline-none focus:border-onam-gold-deep font-mono"
          />
        </div>

        {manualSearch.trim() && (
          <div className="max-h-48 overflow-y-auto space-y-2 border-t border-onam-line pt-3">
            {filteredApproved.length === 0 ? (
              <p className="text-xs text-onam-muted-dim text-center py-2">No matching unentered approved passes found.</p>
            ) : (
              filteredApproved.map((t) => (
                <div key={t.ticket_id} className="p-3 rounded-xl bg-onam-black border border-onam-line flex items-center justify-between">
                  <div className="text-xs">
                    <p className="font-bold text-onam-kasavu">{t.user_name}</p>
                    <p className="text-[11px] text-onam-muted font-mono">{t.user_phone} {t.user_roll_no ? `| Roll: ${t.user_roll_no}` : ''}</p>
                  </div>
                  <button
                    onClick={() => handleManualScanSubmit(t.ticket_id)}
                    disabled={loading}
                    className="btn-gold px-3 py-1.5 text-xs disabled:opacity-50"
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
      <div className="bg-onam-deep border border-onam-line p-6 rounded-2xl space-y-3">
        <h4 className="text-xs font-bold text-onam-muted uppercase tracking-wider flex items-center gap-2">
          <Keyboard className="w-4 h-4 text-onam-gold" />
          <span>Manual Token String Validation</span>
        </h4>

        <form onSubmit={handleManualTokenSubmit} className="flex gap-2">
          <input
            type="text"
            value={manualToken}
            onChange={(e) => setManualToken(e.target.value)}
            placeholder="Paste signed QR token string..."
            className="flex-1 px-4 py-2.5 rounded-xl bg-onam-black border border-onam-line text-onam-kasavu text-xs font-mono focus:outline-none focus:border-onam-gold-deep"
          />
          <button
            type="submit"
            disabled={loading || !manualToken.trim()}
            className="btn-gold px-4 py-2.5 text-xs disabled:opacity-50"
          >
            Validate Token
          </button>
        </form>
      </div>

    </div>
  );
};
