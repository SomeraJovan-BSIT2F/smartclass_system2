import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { CheckCircle2, XCircle, Camera, Zap } from 'lucide-react';
import { api } from '../lib/api';
import {
  Card, Pill, SectionHeader, Button, Spinner, ErrorBanner, SuccessBanner,
} from '../components/UI';

export default function Scanner() {
  const [params] = useSearchParams();
  const sectionId = Number(params.get('section'));

  const [sections, setSections] = useState([]);
  const [activeSection, setActiveSection] = useState(null);
  const [session, setSession] = useState(null);
  const [scans, setScans] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);

  const qrRef = useRef(null);
  const lastScanRef = useRef({ token: null, at: 0 });

  // Load sections
  useEffect(() => {
    (async () => {
      try {
        const { sections } = await api.listSections();
        setSections(sections);
        const initial = sections.find(s => s.id === sectionId) || sections[0];
        setActiveSection(initial);
      } catch (e) { setError(e.message); }
    })();
  }, [sectionId]);

  // When section changes, open today's session and load existing scans
  useEffect(() => {
    if (!activeSection) return;
    (async () => {
      try {
        const { session } = await api.openSession(activeSection.id);
        setSession(session);
        const { attendance } = await api.sessionAttendance(session.id);
        setScans(
          attendance.map(a => ({
            name: a.student_name,
            id: a.student_number,
            time: a.scanned_at ? new Date(a.scanned_at).toLocaleTimeString() : '—',
            status: a.status,
          }))
        );
      } catch (e) { setError(e.message); }
    })();
  }, [activeSection]);

  // Start / stop the camera
  const startCamera = async () => {
    setError(null);
    try {
      const html5 = new Html5Qrcode('qr-reader');
      qrRef.current = html5;
      await html5.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        onScan,
        () => {} // ignore decode errors
      );
      setScanning(true);
    } catch (e) {
      setError(
        'Could not access camera. ' +
        'Make sure you allow camera permission and that the page is served over HTTPS or localhost.'
      );
    }
  };

  const stopCamera = async () => {
    try {
      if (qrRef.current) {
        await qrRef.current.stop();
        await qrRef.current.clear();
        qrRef.current = null;
      }
    } catch {}
    setScanning(false);
  };

  // Cleanup on unmount
  useEffect(() => () => { stopCamera(); }, []);

  const onScan = async (decoded) => {
    // Debounce: ignore the same code within 3 seconds
    const now = Date.now();
    if (lastScanRef.current.token === decoded && now - lastScanRef.current.at < 3000) return;
    lastScanRef.current = { token: decoded, at: now };

    if (busy || !session) return;
    setBusy(true);
    setInfo(null);
    setError(null);

    let token;
    try {
      // Backend QR encodes JSON: { t: token, sn: studentNumber }
      const parsed = JSON.parse(decoded);
      token = parsed.t || parsed.token || decoded;
    } catch {
      token = decoded; // accept raw token too
    }

    try {
      const r = await api.recordScan({ sessionId: session.id, qrToken: token });
      if (r.duplicate) {
        setInfo('Already recorded for this session.');
      } else {
        // Refresh roster
        const { attendance } = await api.sessionAttendance(session.id);
        setScans(
          attendance.map(a => ({
            name: a.student_name,
            id: a.student_number,
            time: a.scanned_at ? new Date(a.scanned_at).toLocaleTimeString() : '—',
            status: a.status,
            isNew: true,
          }))
        );
        setInfo('Attendance recorded');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      setTimeout(() => setInfo(null), 2500);
    }
  };

  const endSession = async () => {
    if (!session) return;
    if (!confirm('End the session? Students who haven\'t scanned will be marked absent.')) return;
    await api.closeSession(session.id);
    await stopCamera();
    setInfo('Session ended. Absentees auto-recorded.');
    setSession(null);
  };

  if (!sections.length) return <div className="grid place-items-center h-96"><Spinner /></div>;

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={`QR Attendance · ${activeSection?.code} · ${activeSection?.subject}`}
        title="Live attendance scanner"
        sub="Scan student QR codes to mark attendance."
        action={
          sections.length > 1 && (
            <select
              value={activeSection?.id || ''}
              onChange={(e) => setActiveSection(sections.find(s => s.id == e.target.value))}
              className="px-3 py-2 rounded-full border bg-white text-sm"
              style={{ borderColor: 'var(--rule)' }}
            >
              {sections.map(s => (
                <option key={s.id} value={s.id}>{s.code}</option>
              ))}
            </select>
          )
        }
      />

      {error && <ErrorBanner onClose={() => setError(null)}>{error}</ErrorBanner>}
      {info && <SuccessBanner>{info}</SuccessBanner>}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card className="lg:col-span-3 p-6">
          <div className="flex items-center justify-between mb-4">
            <Pill tone={scanning ? 'ok' : 'muted'}>
              <span
                className={`w-1.5 h-1.5 rounded-full ${scanning ? 'animate-pulse' : ''}`}
                style={{ background: scanning ? 'var(--ok)' : 'var(--muted)' }}
              />
              {scanning ? 'Camera live' : 'Camera off'}
            </Pill>
            {!scanning ? (
              <Button variant="accent" onClick={startCamera} disabled={!session}>
                <Camera size={14} /> Start camera
              </Button>
            ) : (
              <Button variant="ghost" onClick={stopCamera}>Stop</Button>
            )}
          </div>

          <div
            className="aspect-video rounded-xl relative overflow-hidden grid place-items-center"
            style={{ background: 'var(--ink)' }}
          >
            {/* The library injects video into this div */}
            <div id="qr-reader" className="w-full h-full" />

            {!scanning && (
              <div className="absolute inset-0 grid place-items-center text-center pointer-events-none">
                <div style={{ color: 'rgba(255,255,255,0.6)' }}>
                  <Camera size={32} className="mx-auto mb-2 opacity-60" />
                  <div className="text-sm">Press <strong>Start camera</strong> to begin scanning</div>
                  <div className="text-xs mt-1 opacity-70">Camera access is required</div>
                </div>
              </div>
            )}

            {scanning && (
              <>
                <div
                  className="absolute left-[50%] top-[50%] -translate-x-1/2 -translate-y-1/2 w-56 h-56 rounded-2xl pointer-events-none"
                  aria-hidden
                >
                  <div
                    className="absolute inset-0 border-2 rounded-2xl"
                    style={{ borderColor: 'var(--accent)' }}
                  />
                  <div
                    className="absolute left-2 right-2 h-0.5 animate-scanline"
                    style={{
                      background:
                        'linear-gradient(90deg, transparent, var(--accent), transparent)',
                    }}
                  />
                </div>
                <div
                  className="absolute bottom-2 left-2 right-2 flex justify-between text-[10px] font-mono uppercase tracking-wider pointer-events-none"
                  style={{ color: 'rgba(255,255,255,0.7)' }}
                >
                  <span>● REC · {new Date().toLocaleDateString()}</span>
                  <span>SES-{session?.id || '—'}</span>
                </div>
              </>
            )}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div className="p-3 rounded-xl border" style={{ borderColor: 'var(--rule)' }}>
              <div className="font-serif text-2xl" style={{ color: 'var(--ok)' }}>
                {scans.filter(s => s.status === 'present' || s.status === 'late').length}
              </div>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Checked in</div>
            </div>
            <div className="p-3 rounded-xl border" style={{ borderColor: 'var(--rule)' }}>
              <div className="font-serif text-2xl">
                {scans.filter(s => s.status !== 'present' && s.status !== 'late').length}
              </div>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Pending</div>
            </div>
            <div className="p-3 rounded-xl border" style={{ borderColor: 'var(--rule)' }}>
              <div className="font-serif text-2xl">{scans.length}</div>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Total roster</div>
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-2 p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif text-xl">Live log</h3>
            <Pill tone="accent"><Zap size={10} /> Realtime</Pill>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 max-h-[420px] pr-1">
            {scans.length === 0 && (
              <div className="text-center py-12 text-sm" style={{ color: 'var(--muted)' }}>
                Waiting for first scan…
              </div>
            )}
            {scans.map((s, i) => (
              <div
                key={`${s.id}-${i}`}
                className="flex items-center gap-3 p-3 rounded-xl border animate-slideIn"
                style={{
                  borderColor: 'var(--rule)',
                  background:
                    s.status === 'present' || s.status === 'late' ? '#E8F1EB' : '#fff',
                }}
              >
                {s.status === 'present' || s.status === 'late' ? (
                  <CheckCircle2 size={16} style={{ color: 'var(--ok)' }} />
                ) : (
                  <XCircle size={16} style={{ color: 'var(--muted)' }} />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{s.name}</div>
                  <div
                    className="text-[11px] font-mono"
                    style={{ color: 'var(--muted)' }}
                  >
                    {s.id} · {s.time}
                  </div>
                </div>
                <Pill
                  tone={
                    s.status === 'present' ? 'ok'
                    : s.status === 'late' ? 'warn'
                    : s.status === 'excused' ? 'accent'
                    : 'bad'
                  }
                >
                  {s.status}
                </Pill>
              </div>
            ))}
          </div>
          {session && (
            <Button variant="primary" className="mt-4 w-full" onClick={endSession}>
              <CheckCircle2 size={14} /> End session & save
            </Button>
          )}
        </Card>
      </div>
    </div>
  );
}
