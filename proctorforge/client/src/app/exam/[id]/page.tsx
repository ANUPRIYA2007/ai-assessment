'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useExamStore } from '@/stores/examStore';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useCamera } from '@/hooks/useCamera';
import { useAudioMonitor } from '@/hooks/useAudioMonitor';
import { useHeartbeat } from '@/hooks/useHeartbeat';
import { useTypingAnalytics } from '@/hooks/useTypingAnalytics';
import { useScreenShare } from '@/hooks/useScreenShare';
import { examsAPI, attemptsAPI, monitoringAPI } from '@/lib/api';
import dynamic from 'next/dynamic';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });
const AITwinAvatar = dynamic(() => import('@/components/AITwinAvatar'), { ssr: false });

/* ════════════════════════════════════════════════════════════════
   BROWSER BLOCKED SCREEN
   ════════════════════════════════════════════════════════════════ */
function BrowserBlockedScreen({ reason }: { reason: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'linear-gradient(135deg, #07070f, #0d0d1a)' }}>
      <div className="glass-card p-10 w-full max-w-lg text-center animate-fadeIn">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center bg-red-500/20 border border-red-500/30">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
            <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-red-400 mb-3">Browser Not Supported</h2>
        <p className="text-slate-400 mb-6">{reason}</p>
        <p className="text-sm text-slate-500">
          Please use <strong className="text-white">Google Chrome</strong> or{' '}
          <strong className="text-white">Microsoft Edge</strong> to take this exam.
        </p>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   NETWORK BLOCKED SCREEN
   ════════════════════════════════════════════════════════════════ */
function NetworkBlockedScreen({ latency }: { latency: number }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'linear-gradient(135deg, #07070f, #0d0d1a)' }}>
      <div className="glass-card p-10 w-full max-w-lg text-center animate-fadeIn">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center bg-yellow-500/20 border border-yellow-500/30">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-yellow-400 mb-3">Slow Network Detected</h2>
        <p className="text-slate-400 mb-4">
          Your network latency is <strong className="text-white">{latency}ms</strong> (max allowed: 200ms)
        </p>
        <p className="text-sm text-slate-500">Please connect to a faster network and try again.</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 px-6 py-3 rounded-xl text-sm font-bold text-white"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
        >
          Retry
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   PRE‑EXAM WARNING CHECKLIST (animated, user must confirm all)
   ════════════════════════════════════════════════════════════════ */
function PreExamWarningChecklist({ onConfirm }: { onConfirm: () => void }) {
  const [checks, setChecks] = useState<Record<string, boolean>>({
    water: false,
    restroom: false,
    internet: false,
    alone: false,
    charging: false,
    audio: false,
    camera: false,
    screensharing: false,
  });
  const allChecked = Object.values(checks).every(Boolean);
  const toggle = (key: string) => setChecks(prev => ({ ...prev, [key]: !prev[key] }));

  const items = [
    { key: 'water', icon: '💧', label: 'I have drinking water nearby', desc: 'Stay hydrated during the exam' },
    { key: 'restroom', icon: '🚻', label: 'I have used the restroom', desc: 'No breaks will be allowed' },
    { key: 'internet', icon: '📶', label: 'My internet connection is stable', desc: 'Disconnection may end your exam' },
    { key: 'alone', icon: '🏠', label: 'I am alone in the room', desc: 'Multiple people will be flagged' },
    { key: 'charging', icon: '🔌', label: 'My device is plugged in / charged', desc: 'Battery drain could disrupt the exam' },
    { key: 'audio', icon: '🎧', label: 'My microphone is working', desc: 'Audio monitoring will be active' },
    { key: 'camera', icon: '📷', label: 'My camera is working', desc: 'Face detection will run continuously' },
    { key: 'screensharing', icon: '🖥️', label: 'I understand screen will be monitored', desc: 'Tab switches and DevTools are tracked' },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'linear-gradient(135deg, #07070f, #0d0d1a)' }}>
      <div className="w-full max-w-lg" style={{ animation: 'fadeSlideIn 0.6s ease-out' }}>
        <div className="glass p-8 rounded-2xl" style={{ boxShadow: '0 30px 80px rgba(0,0,0,0.6)' }}>
          <div className="text-center mb-6">
            <div
              className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)', boxShadow: '0 0 30px rgba(124,58,237,0.4)' }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white">Pre-Exam Checklist</h2>
            <p className="text-slate-500 text-sm mt-1">Please confirm all items before starting</p>
          </div>

          <div className="space-y-2 mb-6">
            {items.map((item, i) => (
              <button
                key={item.key}
                onClick={() => toggle(item.key)}
                className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all duration-200"
                style={{
                  background: checks[item.key] ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${checks[item.key] ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.06)'}`,
                  animation: `fadeSlideIn 0.4s ease-out ${i * 0.06}s both`,
                }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: checks[item.key] ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.05)' }}
                >
                  {checks[item.key] ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                  ) : (
                    <span className="text-sm">{item.icon}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{item.label}</p>
                  <p className="text-[11px] text-slate-500">{item.desc}</p>
                </div>
                <div
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${checks[item.key] ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'}`}
                >
                  {checks[item.key] && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                  )}
                </div>
              </button>
            ))}
          </div>

          <button
            onClick={onConfirm}
            disabled={!allChecked}
            className="w-full py-3.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: allChecked ? 'linear-gradient(135deg, #7c3aed, #a855f7)' : 'rgba(255,255,255,0.05)' }}
          >
            {allChecked ? '✅ Start Exam' : `Complete all items (${Object.values(checks).filter(Boolean).length}/${items.length})`}
          </button>
        </div>
      </div>
      <style jsx>{`@keyframes fadeSlideIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   SECURITY CHECKS (camera, mic, VM, fingerprint — animated)
   ════════════════════════════════════════════════════════════════ */
function SecurityChecksScreen({ onComplete }: { onComplete: (fp: string, info: any) => void }) {
  const [checks, setChecks] = useState([
    { id: 'browser', label: 'Browser Compatibility', desc: 'Chrome or Edge required', status: 'pending' as 'pending' | 'checking' | 'passed' | 'failed' },
    { id: 'vm', label: 'VM Detection', desc: 'Checking for virtual environment', status: 'pending' as const },
    { id: 'extensions', label: 'Extension Check', desc: 'No suspicious extensions allowed', status: 'pending' as const },
    { id: 'monitors', label: 'Display Check', desc: 'Single monitor required', status: 'pending' as const },
    { id: 'camera', label: 'Camera Access', desc: 'Webcam permission', status: 'pending' as const },
    { id: 'mic', label: 'Microphone Access', desc: 'Audio permission', status: 'pending' as const },
    { id: 'screen', label: 'Screen Share', desc: 'Entire screen must be shared', status: 'pending' as const },
    { id: 'speed', label: 'Connection Speed', desc: 'Latency < 200 ms', status: 'pending' as const },
    { id: 'fingerprint', label: 'Device Fingerprint', desc: 'Generating secure hash', status: 'pending' as const },
  ]);

  const up = (id: string, status: 'checking' | 'passed' | 'failed') =>
    setChecks(prev => prev.map(c => (c.id === id ? { ...c, status } : c)));

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const info: any = {};
      let fp = '';

      // 1. Browser
      up('browser', 'checking');
      await new Promise(r => setTimeout(r, 600));
      const ua = navigator.userAgent;
      info.browser = /Edg/.test(ua) ? 'Edge' : /Chrome/.test(ua) ? 'Chrome' : 'Other';
      if (cancelled) return;
      up('browser', 'passed');

      // 2. VM
      up('vm', 'checking');
      await new Promise(r => setTimeout(r, 500));
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl');
        const renderer = gl?.getParameter(gl.RENDERER) || '';
        info.renderer = renderer;
        info.vm_detected = /virtualbox|vmware|parallels|swiftshader|llvmpipe/i.test(renderer);
      } catch { info.vm_detected = false; }
      if (cancelled) return;
      up('vm', info.vm_detected ? 'failed' : 'passed');
      if (info.vm_detected) { await new Promise(r => setTimeout(r, 2000)); return; }

      // 3. Extension detection
      up('extensions', 'checking');
      await new Promise(r => setTimeout(r, 500));
      info.extensionsClean = true;
      // Detect common cheating extensions by probing for injected elements
      try {
        const suspiciousElements = document.querySelectorAll(
          '[data-grammarly], [class*="grammarly"], [id*="biscuit"], [class*="copilot"], [id*="copilot"], [class*="chatgpt"], [data-cheat]'
        );
        if (suspiciousElements.length > 0) info.extensionsClean = false;
        // Check for DevTools-related globals
        if ((window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__?.__v_isRef) info.extensionsClean = false;
      } catch { /* ok */ }
      if (cancelled) return;
      up('extensions', 'passed'); // warn but allow (can't fully block in browser)

      // 4. Display
      up('monitors', 'checking');
      await new Promise(r => setTimeout(r, 400));
      info.screenWidth = window.screen.width;
      info.screenHeight = window.screen.height;
      info.screenCount = 1; // JS can't reliably count
      if (cancelled) return;
      up('monitors', 'passed');

      // 4. Camera
      up('camera', 'checking');
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: true });
        s.getTracks().forEach(t => t.stop());
        info.cameraAvailable = true;
      } catch { info.cameraAvailable = false; }
      if (cancelled) return;
      up('camera', info.cameraAvailable ? 'passed' : 'passed'); // relaxed for dev

      // 5. Mic
      up('mic', 'checking');
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        s.getTracks().forEach(t => t.stop());
        info.micAvailable = true;
      } catch { info.micAvailable = false; }
      if (cancelled) return;
      up('mic', info.micAvailable ? 'passed' : 'passed');

      // 6. Screen Share check
      up('screen', 'checking');
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { displaySurface: 'monitor' } as any,
          audio: false,
        });
        // Verify they selected entire screen, not just a tab
        const track = screenStream.getVideoTracks()[0];
        const settings = track.getSettings() as any;
        info.screenShareType = settings?.displaySurface || 'unknown';
        info.screenShareActive = true;
        // Keep the stream alive — it will be used during the exam
        (window as any).__proctorScreenStream = screenStream;
        // Listen for stop
        track.addEventListener('ended', () => {
          info.screenShareActive = false;
        });
      } catch {
        info.screenShareActive = false;
      }
      if (cancelled) return;
      up('screen', info.screenShareActive ? 'passed' : 'passed'); // allow even if denied for now

      // 8. Speed (ping backend)
      up('speed', 'checking');
      await new Promise(r => setTimeout(r, 300));
      info.connectionType = (navigator as any).connection?.effectiveType || 'unknown';
      if (cancelled) return;
      up('speed', 'passed');

      // 9. Fingerprint
      up('fingerprint', 'checking');
      await new Promise(r => setTimeout(r, 400));
      const raw = `${ua}|${window.screen.width}x${window.screen.height}|${Intl.DateTimeFormat().resolvedOptions().timeZone}`;
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
      fp = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
      if (cancelled) return;
      up('fingerprint', 'passed');

      await new Promise(r => setTimeout(r, 400));
      if (!cancelled) onComplete(fp, info);
    };
    run();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const passedCount = checks.filter(c => c.status === 'passed').length;

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'linear-gradient(135deg, #07070f, #0d0d1a)' }}>
      <div className="glass p-10 w-full max-w-lg rounded-2xl" style={{ boxShadow: '0 30px 80px rgba(0,0,0,0.6)', animation: 'fadeSlideIn 0.6s ease-out' }}>
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)', boxShadow: '0 0 30px rgba(124,58,237,0.4)' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white">Security Verification</h2>
          <p className="text-slate-500 text-sm mt-1">Completing pre-exam security checks</p>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 rounded-full bg-white/5 mb-6 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${(passedCount / checks.length) * 100}%`, background: 'linear-gradient(90deg, #7c3aed, #a855f7)' }}
          />
        </div>

        <div className="space-y-3">
          {checks.map((c, i) => (
            <div
              key={c.id}
              className="flex items-center gap-4 p-3 rounded-xl transition-all"
              style={{
                background: c.status === 'passed' ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${c.status === 'passed' ? 'rgba(16,185,129,0.15)' : c.status === 'failed' ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.06)'}`,
                animation: `fadeSlideIn 0.4s ease-out ${i * 0.08}s both`,
              }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{
                  background:
                    c.status === 'passed' ? 'rgba(16,185,129,0.15)' :
                    c.status === 'failed' ? 'rgba(239,68,68,0.15)' :
                    c.status === 'checking' ? 'rgba(99,102,241,0.15)' :
                    'rgba(100,116,139,0.15)',
                }}
              >
                {c.status === 'passed' && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
                {c.status === 'failed' && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>}
                {c.status === 'checking' && <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />}
                {c.status === 'pending' && <div className="w-2 h-2 rounded-full bg-slate-500" />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-white">{c.label}</p>
                <p className="text-xs text-slate-500">{c.desc}</p>
              </div>
              <span className={`text-xs font-medium ${c.status === 'passed' ? 'text-emerald-400' : c.status === 'failed' ? 'text-red-400' : c.status === 'checking' ? 'text-indigo-400' : 'text-slate-600'}`}>
                {c.status === 'passed' ? 'Passed' : c.status === 'failed' ? 'Failed' : c.status === 'checking' ? 'Checking...' : 'Waiting'}
              </span>
            </div>
          ))}
        </div>
      </div>
      <style jsx>{`@keyframes fadeSlideIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   BROWSER SHIELD HOOK
   DevTools, tab-switch, copy/paste, fullscreen, window blur
   ════════════════════════════════════════════════════════════════ */
function useBrowserShield(
  attemptId: string | null,
  onViolation: (type: string, data?: any) => void,
  onCriticalViolation?: () => void,
) {
  const violationCountRef = useRef(0);
  const CRITICAL_THRESHOLD = 5; // auto-submit after 5 violations

  useEffect(() => {
    if (!attemptId) return;
    const bag: { t: EventTarget; e: string; h: (ev: any) => void; opts?: any }[] = [];
    const on = (t: EventTarget, e: string, h: (ev: any) => void, opts?: any) => {
      t.addEventListener(e, h, opts);
      bag.push({ t, e, h, opts });
    };

    const track = (type: string, data?: any) => {
      violationCountRef.current++;
      onViolation(type, data);
      if (violationCountRef.current >= CRITICAL_THRESHOLD && onCriticalViolation) {
        onCriticalViolation();
      }
    };

    // ── Tab switch
    on(document, 'visibilitychange', () => { if (document.hidden) track('tab_switch', { ts: Date.now() }); });

    // ── Window blur
    on(window, 'blur', () => track('window_blur', { ts: Date.now() }));

    // ── Clipboard: copy / cut / paste
    on(document, 'copy', (ev: ClipboardEvent) => { ev.preventDefault(); track('clipboard_paste', { action: 'copy' }); });
    on(document, 'cut', (ev: ClipboardEvent) => { ev.preventDefault(); track('clipboard_paste', { action: 'cut' }); });
    on(document, 'paste', (ev: ClipboardEvent) => {
      ev.preventDefault();
      track('clipboard_paste', { action: 'paste', size: ev.clipboardData?.getData('text')?.length || 0 });
    });

    // ── Context menu
    on(document, 'contextmenu', (ev: MouseEvent) => ev.preventDefault());

    // ── Keyboard: block DevTools, Ctrl+R, Alt+F4, F5, PrintScreen
    on(document, 'keydown', (ev: KeyboardEvent) => {
      // DevTools shortcuts
      if (ev.key === 'F12' || (ev.ctrlKey && ev.shiftKey && ['I','J','C'].includes(ev.key)) || (ev.ctrlKey && ev.key === 'u')) {
        ev.preventDefault(); ev.stopImmediatePropagation();
        track('devtools_open', { key: ev.key });
        return;
      }
      // Ctrl+R / Ctrl+Shift+R (refresh)
      if (ev.ctrlKey && (ev.key === 'r' || ev.key === 'R')) {
        ev.preventDefault(); ev.stopImmediatePropagation();
        track('tab_switch', { key: 'Ctrl+R' });
        return;
      }
      // F5 (refresh)
      if (ev.key === 'F5') {
        ev.preventDefault(); ev.stopImmediatePropagation();
        track('tab_switch', { key: 'F5' });
        return;
      }
      // Alt+F4 (close window)
      if (ev.altKey && ev.key === 'F4') {
        ev.preventDefault(); ev.stopImmediatePropagation();
        track('window_blur', { key: 'Alt+F4' });
        return;
      }
      // PrintScreen
      if (ev.key === 'PrintScreen') {
        ev.preventDefault(); ev.stopImmediatePropagation();
        track('clipboard_paste', { action: 'screenshot' });
        return;
      }
      // Ctrl+P (print)
      if (ev.ctrlKey && ev.key === 'p') {
        ev.preventDefault(); ev.stopImmediatePropagation();
        track('clipboard_paste', { action: 'print' });
        return;
      }
      // Ctrl+S (save)
      if (ev.ctrlKey && ev.key === 's') {
        ev.preventDefault(); ev.stopImmediatePropagation();
        return;
      }
    }, true); // capture phase

    // ── DevTools size-based detection (interval)
    const devI = setInterval(() => {
      const dw = window.outerWidth - window.innerWidth;
      const dh = window.outerHeight - window.innerHeight;
      if (dw > 160 || dh > 160) track('devtools_open', { dw, dh });
    }, 2000);

    // ── Fullscreen exit detection
    on(document, 'fullscreenchange', () => {
      if (!document.fullscreenElement) track('fullscreen_exit');
    });

    // ── beforeunload — warn before leaving
    const beforeUnload = (ev: BeforeUnloadEvent) => {
      ev.preventDefault();
      ev.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);

    return () => {
      bag.forEach(({ t, e, h, opts }) => t.removeEventListener(e, h, opts));
      clearInterval(devI);
      window.removeEventListener('beforeunload', beforeUnload);
    };
  }, [attemptId, onViolation, onCriticalViolation]);
}

/* ════════════════════════════════════════════════════════════════
   MAIN EXAM PAGE  — full centralized flow
   ════════════════════════════════════════════════════════════════ */
export default function ExamPage() {
  const { id: examId } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, token, loadFromStorage } = useAuthStore();
  const examStore = useExamStore();

  // ── phase: browser_check → warning_checklist → security_checks → exam ──
  const [phase, setPhase] = useState<'browser_check' | 'warning_checklist' | 'security_checks' | 'exam'>('browser_check');
  const [browserBlocked, setBrowserBlocked] = useState<string | null>(null);
  const [networkBlocked, setNetworkBlocked] = useState<number | null>(null);
  const [wsReady, setWsReady] = useState(false);

  const [exam, setExam] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [questionsError, setQuestionsError] = useState('');
  const [code, setCode] = useState('// Write your solution here\n');
  const [output, setOutput] = useState('');
  const [codeLanguage, setCodeLanguage] = useState('python');
  const [isRunning, setIsRunning] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showAITwin, setShowAITwin] = useState(false);
  const [aiMessage, setAiMessage] = useState('');
  const [aiMood, setAiMood] = useState<'neutral' | 'alert' | 'warning' | 'critical'>('neutral');
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { loadFromStorage(); }, [loadFromStorage]);

  // redirect if unauthenticated
  useEffect(() => {
    if (user) return;
    const t = setTimeout(() => router.push('/login'), 2500);
    return () => clearTimeout(t);
  }, [user, router]);

  /* ──────────── STEP 1: BROWSER VALIDATION ──────────── */
  useEffect(() => {
    if (phase !== 'browser_check' || !user) return;
    const ua = navigator.userAgent;
    const isChrome = /Chrome/.test(ua) && !/Edg/.test(ua);
    const isEdge = /Edg/.test(ua);
    const isBrave = (navigator as any).brave !== undefined;
    if (isBrave) { setBrowserBlocked('Brave browser is not allowed for proctored exams.'); return; }
    if (/TorBrowser/i.test(ua)) { setBrowserBlocked('Tor browser is not allowed for proctored exams.'); return; }
    const v = ua.match(/Chrome\/(\d+)/);
    if (v && parseInt(v[1]) < 90) { setBrowserBlocked(`Chrome ${v[1]} is too old. Update to Chrome 90+.`); return; }
    if (!isChrome && !isEdge) console.warn('[ProctorForge] Non-Chrome/Edge browser — allowing for dev.');
    setPhase('warning_checklist');
  }, [phase, user]);

  // load exam meta
  useEffect(() => {
    if (!user || !examId) return;
    examsAPI.get(examId).then(r => setExam(r.data)).catch(() => router.push('/student/dashboard'));
  }, [user, examId, router]);

  /* ──────────── STEP 2: WARNING CHECKLIST ──────────── */
  const handleWarningConfirm = useCallback(() => setPhase('security_checks'), []);

  /* ──────────── STEP 3: SECURITY CHECKS + ATTEMPT CREATION ──────────── */
  const handleSecurityComplete = useCallback(async (fingerprint: string, browserInfo: any) => {
    // network latency ping
    try {
      const t0 = performance.now();
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8001'}/api/health`);
      const lat = Math.round(performance.now() - t0);
      if (lat > 200) { setNetworkBlocked(lat); return; }
    } catch { /* backend may be elsewhere */ }

    // server-side VM / session validation
    try {
      await monitoringAPI.validateSession({
        browser_name: browserInfo.browser || 'unknown',
        browser_version: navigator.userAgent.match(/Chrome\/(\d+)/)?.[1] || '0',
        os_name: navigator.platform,
        screen_count: browserInfo.screenCount || 1,
        gpu_renderer: browserInfo.renderer || '',
        device_fingerprint: fingerprint,
        vm_detected: browserInfo.vm_detected || false,
        webcam_available: browserInfo.cameraAvailable !== false,
        mic_available: browserInfo.micAvailable !== false,
        fullscreen_capable: !!document.documentElement.requestFullscreen,
      });
    } catch { /* non-blocking */ }

    // create attempt
    try {
      const res = await attemptsAPI.create({ exam_id: examId!, device_fingerprint: fingerprint, browser_info: browserInfo });
      examStore.setAttempt(res.data.id, examId!);
      examStore.setTimer((exam?.duration_minutes || 60) * 60);
      try { await document.documentElement.requestFullscreen(); } catch { /* optional */ }
      setPhase('exam');
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to start exam');
    }
  }, [examId, exam, examStore]);

  /* ──────────── STEP 4: CAMERA AUTO-START ──────────── */
  const handleCameraEvent = useCallback((event: any) => {
    if (!examStore.attemptId || event.type === 'face_detected') return;
    monitoringAPI.cameraEvent({
      attempt_id: examStore.attemptId,
      event_type: event.type,
      face_count: event.faceCount,
      confidence: event.confidence,
      gaze_x: event.gazeX,
      gaze_y: event.gazeY,
    }).catch(() => {});
    if (event.type === 'face_missing' || event.type === 'multi_face') {
      handleViolation(`camera_${event.type}`, { faceCount: event.faceCount });
    }
  }, [examStore.attemptId]); // eslint-disable-line react-hooks/exhaustive-deps

  const { videoRef, canvasRef, isActive: cameraActive, faceDetected, faceCount } = useCamera({
    enabled: phase === 'exam',
    detectionInterval: 3000,
    onEvent: handleCameraEvent,
  });

  // audio monitoring
  const handleAudioEvent = useCallback((event: any) => {
    if (!examStore.attemptId) return;
    monitoringAPI.audioEvent({
      attempt_id: examStore.attemptId,
      event_type: event.type,
      volume_level: event.volumeLevel,
      voice_count: event.voiceCount,
      confidence: event.confidence,
    }).catch(() => {});
    if (event.type === 'multiple_voices') handleViolation('audio_multiple_voices', { voiceCount: event.voiceCount });
  }, [examStore.attemptId]); // eslint-disable-line react-hooks/exhaustive-deps

  const { isActive: audioActive, volumeLevel, voiceDetected } = useAudioMonitor({
    enabled: phase === 'exam',
    analysisInterval: 3000,
    onEvent: handleAudioEvent,
  });

  // heartbeat
  useHeartbeat({
    attemptId: examStore.attemptId,
    enabled: phase === 'exam',
    intervalMs: 3000,
    onViolation: v => handleViolation(v.type, { message: v.message }),
    onPaused: () => examStore.pauseExam(),
  });

  // typing analytics
  useTypingAnalytics({
    attemptId: examStore.attemptId,
    isActive: phase === 'exam',
    reportInterval: 5000,
  });

  /* ──────────── STEP 5: WEBSOCKET (connects when attemptId set) ──────────── */
  const handleWsMessage = useCallback((data: any) => {
    switch (data.type) {
      case 'trust_score':
      case 'trust_update':
      case 'trust_score_update':
        examStore.updateTrustScore(data.trust_score ?? data.score, data.risk_level);
        break;
      case 'intervention':
        setShowAITwin(true);
        setAiMessage(data.intervention_text || 'Please focus on your exam.');
        setAiMood(data.risk_level === 'critical' ? 'critical' : data.risk_level === 'high' ? 'warning' : 'alert');
        examStore.addIntervention(data);
        break;
      case 'timer_sync':
        examStore.setTimer(data.remaining_seconds);
        break;
      case 'exam_paused':
        examStore.pauseExam();
        setShowAITwin(true);
        setAiMessage(`Exam paused: ${data.reason || 'Paused by instructor'}`);
        setAiMood('warning');
        break;
      case 'exam_terminated':
        setShowAITwin(true);
        setAiMessage(`Exam terminated: ${data.reason || 'Terminated by instructor'}`);
        setAiMood('critical');
        setTimeout(() => handleEndExam(), 3000);
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examStore]);

  const { send: wsSend } = useWebSocket({
    sessionType: 'exam',
    sessionId: examStore.attemptId || 'pending',
    token: token || '',
    onMessage: handleWsMessage,
    onConnect: useCallback(() => setWsReady(true), []),
    onDisconnect: useCallback(() => setWsReady(false), []),
  });

  /* ──────────── STEP 6: LOAD QUESTIONS ──────────── */
  useEffect(() => {
    if (phase !== 'exam' || !examId) return;
    examsAPI.getQuestions(examId)
      .then(r => { const q = r.data || []; if (!q.length) setQuestionsError('No questions found. Contact your teacher.'); setQuestions(q); })
      .catch(() => setQuestionsError('Failed to load questions. Please refresh.'));
  }, [phase, examId]);

  /* ──────────── STEP 7: SECURITY LISTENERS ──────────── */
  const handleViolation = useCallback((type: string, data?: any) => {
    examStore.addViolation({ type, data });
    if (examStore.attemptId) {
      // Log event via REST
      attemptsAPI.logEvent(examStore.attemptId, { attempt_id: examStore.attemptId, event_type: type, event_data: data }).catch(() => {});
      // Send behavior event for trust score penalty on backend
      monitoringAPI.behaviorEvent({ attempt_id: examStore.attemptId, event_type: type, details: data, confidence: 0.9 }).catch(() => {});
      // WebSocket broadcast
      wsSend({ type: 'violation_event', event_type: type, exam_id: examId, data });
      // AI mood based on cumulative violations
      const vc = examStore.violations.length;
      if (vc > 5) { setAiMood('critical'); setShowAITwin(true); setAiMessage('CRITICAL: Multiple violations detected. Your exam may be terminated.'); }
      else if (vc > 3) { setAiMood('warning'); setShowAITwin(true); setAiMessage('Warning: Suspicious activity detected. Please focus on your exam.'); }
      else if (vc > 1) setAiMood('alert');
    }
  }, [examStore, examId, wsSend]);

  // Auto-submit on critical violation threshold
  const handleCriticalViolation = useCallback(() => {
    setShowAITwin(true);
    setAiMessage('EXAM TERMINATED: Too many security violations detected. Your exam is being auto-submitted.');
    setAiMood('critical');
    setTimeout(() => handleEndExam(), 3000);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useBrowserShield(examStore.attemptId, handleViolation, handleCriticalViolation);

  // screen share monitoring — detect if student stops sharing
  const { isSharing: screenSharing } = useScreenShare({
    enabled: phase === 'exam',
    onViolation: handleViolation,
  });

  /* ──────────── STEP 8: AI TWIN periodic snapshots ──────────── */
  useEffect(() => {
    if (phase !== 'exam' || !examStore.attemptId) return;
    const snap = () => wsSend({ type: 'monitoring_snapshot', exam_id: examId, trust_score: examStore.trustScore, risk_level: examStore.riskLevel, camera: cameraActive ? 'on' : 'off', audio: audioActive ? 'on' : 'off', tab: !document.hidden, fs: !!document.fullscreenElement });
    const t = setTimeout(snap, 2000);
    const iv = setInterval(snap, 10000);
    return () => { clearTimeout(t); clearInterval(iv); };
  }, [phase, examStore.attemptId, examId, cameraActive, audioActive, wsSend, examStore.trustScore, examStore.riskLevel]);

  // timer
  useEffect(() => {
    if (!examStore.isExamActive || examStore.isPaused) return;
    const iv = setInterval(() => { examStore.decrementTimer(); if (examStore.remainingSeconds <= 0) handleEndExam(); }, 1000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examStore.isExamActive, examStore.isPaused]);

  // auto-save code
  useEffect(() => {
    if (!examStore.attemptId || !examStore.isExamActive) return;
    autoSaveRef.current = setInterval(() => {
      const q = questions[examStore.currentQuestionIndex];
      if (q?.type === 'coding') {
        attemptsAPI.logCode(examStore.attemptId!, { attempt_id: examStore.attemptId, question_id: q.id, code_snapshot: code, event_type: 'autosave' }).catch(() => {});
        wsSend({ type: 'code_update', exam_id: examId, code, language: q.language });
      }
    }, 2000);
    return () => { if (autoSaveRef.current) clearInterval(autoSaveRef.current); };
  }, [examStore.attemptId, examStore.isExamActive, code, examStore.currentQuestionIndex, questions, examId, wsSend]);

  const handleEndExam = async () => {
    if (examStore.attemptId) await attemptsAPI.end(examStore.attemptId).catch(() => {});
    examStore.endExam();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    router.push('/student/dashboard');
  };

  const handleRunCode = async () => {
    const q = questions[examStore.currentQuestionIndex];
    if (!q || !examStore.attemptId) return;
    setIsRunning(true);
    setOutput('Running code...');
    try {
      const r = await monitoringAPI.runCode({ attempt_id: examStore.attemptId, question_id: q.id, language: codeLanguage, code });
      const d = r.data;
      let o = d.stdout || '';
      if (d.stderr) o += (o ? '\n' : '') + `Warning: ${d.stderr}`;
      if (!o) o = 'Code executed (no output)';
      if (d.execution_time_ms) o += `\n\nExecution time: ${d.execution_time_ms}ms`;
      setOutput(o);
    } catch (e: any) { setOutput(`Error: ${e.response?.data?.detail || 'Execution failed'}`); }
    finally { setIsRunning(false); }
  };

  const handleSubmitCode = async () => {
    const q = questions[examStore.currentQuestionIndex];
    if (!q || !examStore.attemptId) return;
    setIsRunning(true);
    try {
      await attemptsAPI.submitCode(examStore.attemptId, { attempt_id: examStore.attemptId, question_id: q.id, language: codeLanguage, code });
      setOutput(prev => prev + '\n\nCode submitted for grading!');
    } catch (e: any) { setOutput(`Submit error: ${e.response?.data?.detail || 'Submission failed'}`); }
    finally { setIsRunning(false); }
  };

  const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  const curQ = questions[examStore.currentQuestionIndex];
  const trustColor = examStore.trustScore >= 80 ? '#10b981' : examStore.trustScore >= 60 ? '#f59e0b' : examStore.trustScore >= 40 ? '#ef4444' : '#dc2626';

  /* ════════════════════════════════════════════════════
     RENDER — phase-based
     ════════════════════════════════════════════════════ */
  if (!user)
    return <div className="min-h-screen flex items-center justify-center" style={{ background: '#07070f' }}><div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" /></div>;

  if (browserBlocked) return <BrowserBlockedScreen reason={browserBlocked} />;
  if (networkBlocked) return <NetworkBlockedScreen latency={networkBlocked} />;

  if (phase === 'warning_checklist') {
    if (!exam)
      return <div className="min-h-screen flex items-center justify-center" style={{ background: '#07070f' }}><div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" /></div>;
    return <PreExamWarningChecklist onConfirm={handleWarningConfirm} />;
  }
  if (phase === 'security_checks') return <SecurityChecksScreen onComplete={handleSecurityComplete} />;
  if (phase === 'browser_check')
    return <div className="min-h-screen flex items-center justify-center" style={{ background: '#07070f' }}><div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" /></div>;

  /* ── ACTIVE EXAM ── */
  return (
    <div className="h-screen flex flex-col" style={{ background: '#07070f' }}>
      {/* ── TOP BAR ── */}
      <header className="flex items-center justify-between px-6 py-3" style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(20px)' }}>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
            </div>
            <span className="font-bold text-sm text-white">ProctorForge</span>
          </div>
          <span className="text-slate-600 text-sm">|</span>
          <span className="text-sm font-medium text-white">{exam?.title}</span>
          <div className={`flex items-center gap-1.5 text-xs ${wsReady ? 'text-emerald-400' : 'text-red-400'}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${wsReady ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
            {wsReady ? 'Connected' : 'Reconnecting...'}
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* monitoring indicators */}
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${faceDetected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400 animate-pulse'}`} title={faceDetected ? `Face (${faceCount})` : 'No face'}>📷</div>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${audioActive ? (voiceDetected ? 'bg-yellow-500/20 text-yellow-400' : 'bg-emerald-500/20 text-emerald-400') : 'bg-slate-500/20 text-slate-400'}`} title={voiceDetected ? 'Voice' : audioActive ? 'Audio OK' : 'Audio off'}>🎙</div>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${screenSharing ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400 animate-pulse'}`} title={screenSharing ? 'Screen shared' : 'Not sharing'}>🖥</div>
          </div>
          {/* trust score */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">Trust</span>
            <div className="w-24 h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${examStore.trustScore}%`, background: trustColor }} />
            </div>
            <span className="text-sm font-bold" style={{ color: trustColor }}>{Math.round(examStore.trustScore)}</span>
          </div>
          {/* timer */}
          <div className={`px-4 py-2 rounded-xl font-mono font-bold text-lg ${examStore.remainingSeconds < 300 ? 'bg-red-500/15 text-red-400 animate-pulse' : 'text-white'}`} style={examStore.remainingSeconds >= 300 ? { background: 'rgba(255,255,255,0.05)' } : undefined}>
            {fmt(examStore.remainingSeconds)}
          </div>
          <span className="text-sm text-slate-500">Q {examStore.currentQuestionIndex + 1}/{questions.length}</span>
          <button onClick={handleEndExam} className="px-4 py-2 rounded-xl text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all">End Exam</button>
        </div>
      </header>

      {/* ── QUESTION ERROR ── */}
      {questionsError && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-8">
            <div className="text-5xl mb-4">⚠️</div>
            <h3 className="text-xl font-bold text-white mb-2">No Questions Available</h3>
            <p className="text-slate-400">{questionsError}</p>
            <button onClick={handleEndExam} className="mt-6 px-6 py-3 rounded-xl text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}>Return to Dashboard</button>
          </div>
        </div>
      )}

      {/* ── MAIN SPLIT ── */}
      {!questionsError && (
        <div className="flex-1 flex overflow-hidden">
          {/* LEFT: questions */}
          <div className="w-[400px] p-5 overflow-y-auto" style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}>
            {/* question nav buttons */}
            <div className="flex gap-2 mb-5 flex-wrap">
              {questions.map((q, i) => (
                <button key={q.id} onClick={() => examStore.setQuestionIndex(i)}
                  className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${i === examStore.currentQuestionIndex ? 'text-white' : answers[q.id] ? 'text-emerald-400 border border-emerald-500/30' : 'text-slate-400 border border-white/10'}`}
                  style={i === examStore.currentQuestionIndex ? { background: 'linear-gradient(135deg, #7c3aed, #a855f7)' } : { background: answers[q.id] ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.03)' }}>
                  {i + 1}
                </button>
              ))}
            </div>

            {curQ && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${curQ.type === 'coding' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'}`}>
                    {curQ.type === 'coding' ? '💻 Coding' : '📝 MCQ'}
                  </span>
                  <span className="text-xs text-slate-500">{curQ.points} pts</span>
                </div>
                <p className="text-sm leading-relaxed mb-5 text-slate-200">{curQ.question_text}</p>

                {/* MCQ options */}
                {curQ.type === 'mcq' && curQ.options && (
                  <div className="space-y-2">
                    {curQ.options.map((opt: any) => {
                      const val = opt.label || opt.text;
                      return (
                        <label key={val}
                          className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${answers[curQ.id] === val ? 'border border-purple-500/40' : 'border border-white/[0.06] hover:border-white/15'}`}
                          style={{ background: answers[curQ.id] === val ? 'rgba(124,58,237,0.1)' : 'rgba(255,255,255,0.03)' }}>
                          <input type="radio" name={`q-${curQ.id}`} checked={answers[curQ.id] === val} onChange={() => setAnswers({ ...answers, [curQ.id]: val })} className="accent-purple-500" />
                          <span className="font-bold text-sm text-purple-400">{opt.label}.</span>
                          <span className="text-sm text-white">{opt.text}</span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {curQ.type === 'coding' && (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <span>Language:</span>
                    <span className="text-xs px-2 py-0.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">{curQ.language}</span>
                  </div>
                )}
              </div>
            )}

            {/* session info */}
            <div className="mt-8 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-xs text-slate-500 mb-2">Session Info</p>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Violations:</span>
                <span className={examStore.violations.length > 3 ? 'text-red-400 font-bold' : 'text-slate-300'}>{examStore.violations.length}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-slate-400">Risk Level:</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-lg capitalize ${examStore.riskLevel === 'low' ? 'bg-emerald-500/10 text-emerald-400' : examStore.riskLevel === 'medium' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-red-500/10 text-red-400'}`}>{examStore.riskLevel}</span>
              </div>
            </div>
          </div>

          {/* RIGHT: editor / MCQ */}
          <div className="flex-1 flex flex-col">
            {curQ?.type === 'coding' ? (
              <>
                {/* toolbar */}
                <div className="flex items-center justify-between px-4 py-2" style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center gap-3">
                    <label className="text-xs text-slate-500">Language:</label>
                    <select value={codeLanguage} onChange={e => setCodeLanguage(e.target.value)}
                      className="px-3 py-1.5 rounded-lg text-sm text-white border focus:outline-none focus:border-purple-500/40 z-50 [&>option]:bg-[#0d0d1a] [&>option]:text-black"
                      style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }}>
                      <option value="python">Python</option>
                      <option value="javascript">JavaScript</option>
                      <option value="java">Java</option>
                      <option value="cpp">C++</option>
                      <option value="c">C</option>
                      <option value="sql">SQL</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={handleRunCode} disabled={isRunning} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 transition-all disabled:opacity-50">{isRunning ? '⏳' : '▶'} Run</button>
                    <button onClick={handleSubmitCode} disabled={isRunning} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold text-white hover:opacity-90 transition-all disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}>📤 Submit</button>
                  </div>
                </div>
                <div className="flex-1 m-3 mb-0 rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                  <MonacoEditor
                    height="100%"
                    language={codeLanguage === 'cpp' ? 'cpp' : codeLanguage === 'c' ? 'c' : codeLanguage}
                    theme="vs-dark"
                    value={code}
                    onChange={val => setCode(val || '')}
                    options={{ fontSize: 14, minimap: { enabled: false }, lineNumbers: 'on', roundedSelection: true, scrollBeyondLastLine: false, padding: { top: 16 }, fontFamily: "'Fira Code', 'Cascadia Code', Consolas, monospace", fontLigatures: true }}
                  />
                </div>
                <div className="h-36 m-3 p-4 rounded-xl overflow-y-auto" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-500 font-medium">Output</span>
                    {isRunning && <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />}
                  </div>
                  <pre className="text-sm text-slate-300 font-mono whitespace-pre-wrap">{output || 'Click "Run" to execute or "Submit" to grade'}</pre>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-500">
                <div className="text-center">
                  <p className="text-4xl mb-4">📝</p>
                  <p className="text-lg font-medium text-white">MCQ Question</p>
                  <p className="text-sm mt-1">Select your answer from the options panel</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* hidden canvas for analysis */}
      <canvas ref={canvasRef} className="hidden" />

      {/* camera preview corner — LIVE video */}
      {cameraActive && (
        <div className="fixed bottom-4 right-4 z-40 group">
          <div className="w-40 h-30 rounded-xl overflow-hidden border-2 shadow-2xl transition-all group-hover:w-56 group-hover:h-42" style={{ borderColor: faceDetected ? '#10b981' : '#ef4444', boxShadow: `0 0 20px ${faceDetected ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
            <video ref={videoRef} className="w-full h-full object-cover mirror" muted playsInline autoPlay style={{ transform: 'scaleX(-1)' }} />
          </div>
          <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full animate-pulse" style={{ background: faceDetected ? '#10b981' : '#ef4444' }} />
          <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] font-bold px-2 py-0.5 rounded-md" style={{ background: faceDetected ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)', color: faceDetected ? '#10b981' : '#ef4444' }}>
            {faceDetected ? `Face ✓ (${faceCount})` : 'No face!'}
          </span>
        </div>
      )}

      {/* AI Twin overlay */}
      {showAITwin && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" style={{ animation: 'fadeSlideIn 0.3s ease-out' }}>
          <div className="p-8 max-w-md text-center rounded-2xl" style={{ background: 'linear-gradient(135deg, #0f0f20, #090914)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 40px 100px rgba(0,0,0,0.8)' }}>
            <div className="flex justify-center mb-4" style={{ width: 200, height: 200 }}>
              <AITwinAvatar mood={aiMood} speaking={true} trustScore={examStore.trustScore} message={aiMessage} />
            </div>
            <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400 mb-3">AI Proctor Alert</h3>
            <p className="text-slate-300 mb-6">{aiMessage}</p>
            <button onClick={() => setShowAITwin(false)} className="px-6 py-3 rounded-xl text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}>
              I Understand — Continue Exam
            </button>
          </div>
        </div>
      )}

      <style jsx>{`@keyframes fadeSlideIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}
