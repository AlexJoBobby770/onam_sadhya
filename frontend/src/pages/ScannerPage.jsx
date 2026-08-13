import React, { useEffect, useState, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import api from '../api/client';
import { QrCode, CheckCircle2, XCircle, AlertTriangle, Camera, Keyboard } from 'lucide-react';

export const ScannerPage = () => {
  const [scanResult, setScanResult] = useState(null);
  const [manualToken, setManualToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(true);
  const scannerRef = useRef(null);

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
        (errorMessage) => {
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

  const handleProcessScan = async (qrToken) => {
    if (loading) return;
    setLoading(true);

    try {
      const res = await api.post('/admin/scan', { qr_token: qrToken });
      const data = res.data;
      setScanResult(data);
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

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualToken.trim()) return;
    handleProcessScan(manualToken.trim());
    setManualToken('');
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <QrCode className="w-6 h-6 text-emerald-400" />
            <h2 className="text-xl font-bold text-white">Gatekeeper Camera Scanner</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">Atomic Single-Use Gate Scanner. Screenshots and duplicate scans are permanently rejected.</p>
        </div>

        <button
          onClick={() => setCameraActive(!cameraActive)}
          className="px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition flex items-center gap-2"
        >
          <Camera className="w-4 h-4 text-emerald-400" />
          <span>{cameraActive ? 'Disable Camera' : 'Enable Camera'}</span>
        </button>
      </div>

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
                    <span className="text-slate-400 text-[10px] block uppercase">Phone Number</span>
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

      {/* MANUAL TOKEN INPUT FALLBACK */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-3">
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <Keyboard className="w-4 h-4 text-emerald-400" />
          <span>Manual Token Validation</span>
        </h4>

        <form onSubmit={handleManualSubmit} className="flex gap-2">
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
