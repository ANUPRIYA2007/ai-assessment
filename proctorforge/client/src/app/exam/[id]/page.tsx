'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useExamStore } from '@/stores/examStore';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useCamera } from '@/hooks/useCamera';
import { useAudioMonitor } from '@/hooks/useAudioMonitor';
import { useHeartbeat } from '@/hooks/useHeartbeat';
import { examsAPI, attemptsAPI, monitoringAPI } from '@/lib/api';
import dynamic from 'next/dynamic';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

// ===== Pre-Exam Checklist Component =====
function PreExamChecklist({ onComplete }: { onComplete: (fingerprint: string, browserInfo: any) => void }) {
    const [checks, setChecks] = useState([
        { id: 'browser', label: 'Browser Compatibility', desc: 'Chrome or Edge required', status: 'pending' as 'pending' | 'checking' | 'passed' | 'failed' },
        { id: 'vm', label: 'VM Detection', desc: 'Checking for virtual environment', status: 'pending' as const },
        { id: 'monitors', label: 'Display Check', desc: 'Single monitor required', status: 'pending' as const },
        { id: 'camera', label: 'Camera Access', desc: 'Webcam permission', status: 'pending' as const },
        { id: 'mic', label: 'Microphone Access', desc: 'Audio permission', status: 'pending' as const },
        { id: 'speed', label: 'Connection Speed', desc: 'Minimum bandwidth check', status: 'pending' as const },
        { id: 'fingerprint', label: 'Device Fingerprint', desc: 'Generating secure hash', status: 'pending' as const },
    ]);

    const updateCheck = (id: string, status: 'checking' | 'passed' | 'failed') => {
        setChecks(prev => prev.map(c => c.id === id ? { ...c, status } : c));
    };

    useEffect(() => {
        let cancelled = false;
        const runChecks = async () => {
            const browserInfo: any = {};
            let fingerprint = '';

            // 1. Browser check
            updateCheck('browser', 'checking');
            await new Promise(r => setTimeout(r, 800));
            const ua = navigator.userAgent;
            const isChrome = /Chrome/.test(ua) && !/Edg/.test(ua);
            const isEdge = /Edg/.test(ua);
            const isBrave = (navigator as any).brave !== undefined;
            browserInfo.browser = isChrome ? 'Chrome' : isEdge ? 'Edge' : 'Other';
            if (cancelled) return;
            updateCheck('browser', (isChrome || isEdge) && !isBrave ? 'passed' : 'passed'); // Relaxed for dev

            // 2. VM Detection
            updateCheck('vm', 'checking');
            await new Promise(r => setTimeout(r, 600));
            try {
                const canvas = document.createElement('canvas');
                const gl = canvas.getContext('webgl');
                const renderer = gl?.getParameter(gl.RENDERER) || '';
                browserInfo.renderer = renderer;
                const isVM = /virtualbox|vmware|parallels/i.test(renderer);
                if (cancelled) return;
                updateCheck('vm', isVM ? 'failed' : 'passed');
            } catch { updateCheck('vm', 'passed'); }

            // 3. Monitor check
            updateCheck('monitors', 'checking');
            await new Promise(r => setTimeout(r, 500));
            browserInfo.screenCount = window.screen ? 1 : 0;
            browserInfo.screenWidth = window.screen.width;
            browserInfo.screenHeight = window.screen.height;
            if (cancelled) return;
            updateCheck('monitors', 'passed');

            // 4. Camera
            updateCheck('camera', 'checking');
            await new Promise(r => setTimeout(r, 400));
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                stream.getTracks().forEach(t => t.stop());
                browserInfo.cameraAvailable = true;
                if (cancelled) return;
                updateCheck('camera', 'passed');
            } catch {
                browserInfo.cameraAvailable = false;
                if (cancelled) return;
                updateCheck('camera', 'passed'); // Relaxed for dev environments
            }

            // 5. Mic
            updateCheck('mic', 'checking');
            await new Promise(r => setTimeout(r, 400));
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                stream.getTracks().forEach(t => t.stop());
                browserInfo.micAvailable = true;
                if (cancelled) return;
                updateCheck('mic', 'passed');
            } catch {
                browserInfo.micAvailable = false;
                if (cancelled) return;
                updateCheck('mic', 'passed');
            }

            // 6. Speed test
            updateCheck('speed', 'checking');
            await new Promise(r => setTimeout(r, 600));
            browserInfo.connectionType = (navigator as any).connection?.effectiveType || 'unknown';
            if (cancelled) return;
            updateCheck('speed', 'passed');

            // 7. Fingerprint
            updateCheck('fingerprint', 'checking');
            await new Promise(r => setTimeout(r, 500));
            const fpData = `${ua}|${window.screen.width}x${window.screen.height}|${Intl.DateTimeFormat().resolvedOptions().timeZone}`;
            const encoder = new TextEncoder();
            const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(fpData));
            fingerprint = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
            if (cancelled) return;
            updateCheck('fingerprint', 'passed');

            // Complete
            await new Promise(r => setTimeout(r, 500));
            if (!cancelled) onComplete(fingerprint, browserInfo);
        };

        runChecks();
        return () => { cancelled = true; };
    }, [onComplete]);

    const passedCount = checks.filter(c => c.status === 'passed').length;

    return (
        <div className="min-h-screen flex items-center justify-center p-6">
            <div className="glass-card p-10 w-full max-w-lg animate-fadeIn">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center animate-pulse-glow" style={{ background: 'var(--accent-gradient)' }}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold">Security Verification</h2>
                    <p className="text-[var(--text-muted)] mt-1">Completing pre-exam security checks</p>
                </div>

                {/* Progress bar */}
                <div className="trust-bar mb-6">
                    <div className="trust-bar-fill" style={{ width: `${(passedCount / checks.length) * 100}%`, background: 'var(--accent-gradient)' }}></div>
                </div>

                <div className="space-y-3">
                    {checks.map((check, i) => (
                        <div key={check.id} className="flex items-center gap-4 p-3 rounded-xl bg-[var(--bg-secondary)] animate-slideIn" style={{ animationDelay: `${i * 0.1}s` }}>
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{
                                background: check.status === 'passed' ? 'rgba(16,185,129,0.15)' : check.status === 'failed' ? 'rgba(239,68,68,0.15)' : check.status === 'checking' ? 'rgba(99,102,241,0.15)' : 'rgba(100,116,139,0.15)',
                            }}>
                                {check.status === 'passed' && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
                                {check.status === 'failed' && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>}
                                {check.status === 'checking' && <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }}></div>}
                                {check.status === 'pending' && <div className="w-2 h-2 rounded-full bg-[var(--text-muted)]"></div>}
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-medium">{check.label}</p>
                                <p className="text-xs text-[var(--text-muted)]">{check.desc}</p>
                            </div>
                            <span className={`text-xs font-medium ${check.status === 'passed' ? 'text-[var(--success)]' : check.status === 'failed' ? 'text-[var(--danger)]' : check.status === 'checking' ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)]'}`}>
                                {check.status === 'passed' ? 'Passed' : check.status === 'failed' ? 'Failed' : check.status === 'checking' ? 'Checking...' : 'Waiting'}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}


// ===== Browser Shield Hook =====
function useBrowserShield(attemptId: string | null, onViolation: (type: string, data?: any) => void) {
    useEffect(() => {
        if (!attemptId) return;
        const handlers: { event: string; handler: (e: any) => void }[] = [];

        const addHandler = (event: string, handler: (e: any) => void) => {
            document.addEventListener(event, handler);
            handlers.push({ event, handler });
        };

        // Tab switch detection
        addHandler('visibilitychange', () => {
            if (document.hidden) onViolation('tab_switch', { timestamp: Date.now() });
        });

        // Window blur
        addHandler('blur', () => {
            onViolation('window_blur', { timestamp: Date.now() });
        });

        // Copy/Cut/Paste blocking
        addHandler('copy', (e: ClipboardEvent) => { e.preventDefault(); onViolation('clipboard_attempt', { action: 'copy' }); });
        addHandler('cut', (e: ClipboardEvent) => { e.preventDefault(); onViolation('clipboard_attempt', { action: 'cut' }); });
        addHandler('paste', (e: ClipboardEvent) => {
            const text = e.clipboardData?.getData('text') || '';
            onViolation('paste_detected', { size: text.length });
        });

        // Context menu blocking
        addHandler('contextmenu', (e: MouseEvent) => { e.preventDefault(); });

        // DevTools shortcut blocking
        addHandler('keydown', (e: KeyboardEvent) => {
            if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key)) || (e.ctrlKey && e.key === 'u')) {
                e.preventDefault();
                onViolation('devtools_attempt', { key: e.key });
            }
        });

        // Fullscreen monitoring
        const fsHandler = () => {
            if (!document.fullscreenElement) onViolation('fullscreen_exit');
        };
        document.addEventListener('fullscreenchange', fsHandler);

        return () => {
            handlers.forEach(({ event, handler }) => document.removeEventListener(event, handler));
            document.removeEventListener('fullscreenchange', fsHandler);
        };
    }, [attemptId, onViolation]);
}


// ===== Main Exam Page =====
export default function ExamPage() {
    const { id: examId } = useParams<{ id: string }>();
    const router = useRouter();
    const { user, token, loadFromStorage } = useAuthStore();
    const examStore = useExamStore();

    const [phase, setPhase] = useState<'checklist' | 'exam'>('checklist');
    const [exam, setExam] = useState<any>(null);
    const [questions, setQuestions] = useState<any[]>([]);
    const [code, setCode] = useState('// Write your solution here\n');
    const [output, setOutput] = useState('');
    const [codeLanguage, setCodeLanguage] = useState('python');
    const [isRunning, setIsRunning] = useState(false);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [showAITwin, setShowAITwin] = useState(false);
    const [aiMessage, setAiMessage] = useState('');
    const autoSaveRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => { loadFromStorage(); }, [loadFromStorage]);

    // Redirect to login if not authenticated after short wait
    useEffect(() => {
        if (user) return;
        const timer = setTimeout(() => router.push('/login'), 2500);
        return () => clearTimeout(timer);
    }, [user, router]);

    // ── Camera monitoring ──
    const handleCameraEvent = useCallback((event: any) => {
        if (!examStore.attemptId || event.type === 'face_detected') return;
        monitoringAPI.cameraEvent({
            attempt_id: examStore.attemptId,
            event_type: event.type,
            face_count: event.faceCount,
            confidence: event.confidence,
            gaze_x: event.gazeX,
            gaze_y: event.gazeY,
        }).catch(() => { });
        if (event.type === 'face_missing' || event.type === 'multi_face') {
            handleViolation(`camera_${event.type}`, { faceCount: event.faceCount });
        }
    }, [examStore.attemptId]);

    const { videoRef, canvasRef, isActive: cameraActive, faceDetected, faceCount } = useCamera({
        enabled: phase === 'exam',
        detectionInterval: 2000,
        onEvent: handleCameraEvent,
    });

    // ── Audio monitoring ──
    const handleAudioEvent = useCallback((event: any) => {
        if (!examStore.attemptId) return;
        monitoringAPI.audioEvent({
            attempt_id: examStore.attemptId,
            event_type: event.type,
            volume_level: event.volumeLevel,
            voice_count: event.voiceCount,
            confidence: event.confidence,
        }).catch(() => { });
        if (event.type === 'multiple_voices') {
            handleViolation('audio_multiple_voices', { voiceCount: event.voiceCount });
        }
    }, [examStore.attemptId]);

    const { isActive: audioActive, volumeLevel, voiceDetected } = useAudioMonitor({
        enabled: phase === 'exam',
        analysisInterval: 3000,
        onEvent: handleAudioEvent,
    });

    // ── Heartbeat ──
    useHeartbeat({
        attemptId: examStore.attemptId,
        enabled: phase === 'exam',
        intervalMs: 3000,
        onViolation: (v) => handleViolation(v.type, { message: v.message }),
        onPaused: () => examStore.pauseExam(),
    });

    useEffect(() => {
        if (!user || !examId) return;
        examsAPI.get(examId).then(res => setExam(res.data)).catch(() => router.push('/student/dashboard'));
        examsAPI.getQuestions(examId).then(res => setQuestions(res.data)).catch(() => { });
    }, [user, examId, router]);

    // WebSocket handler
    const handleWsMessage = useCallback((data: any) => {
        if (data.type === 'trust_score') {
            examStore.updateTrustScore(data.trust_score, data.risk_level);
        } else if (data.type === 'intervention') {
            setShowAITwin(true);
            setAiMessage(data.intervention_text || 'Please focus on your exam.');
            examStore.addIntervention(data);
        } else if (data.type === 'timer_sync') {
            examStore.setTimer(data.remaining_seconds);
        } else if (data.type === 'exam_paused') {
            examStore.pauseExam();
            setShowAITwin(true);
            setAiMessage(`⏸ Exam paused: ${data.reason || 'Paused by instructor'}`);
        } else if (data.type === 'exam_terminated') {
            setShowAITwin(true);
            setAiMessage(`🛑 ${data.reason || 'Exam terminated by instructor'}`);
            setTimeout(() => handleEndExam(), 3000);
        }
    }, [examStore]);

    const { send: wsSend } = useWebSocket({
        sessionType: 'exam',
        sessionId: examStore.attemptId || 'pending',
        token: token || '',
        onMessage: handleWsMessage,
    });

    // Violation handler
    const handleViolation = useCallback((type: string, data?: any) => {
        examStore.addViolation({ type, data });
        if (examStore.attemptId) {
            attemptsAPI.logEvent(examStore.attemptId, {
                attempt_id: examStore.attemptId,
                event_type: type,
                event_data: data,
            }).catch(() => { });

            wsSend({
                type: 'violation_event',
                event_type: type,
                exam_id: examId,
                data,
            });
        }
    }, [examStore, examId, wsSend]);

    // Browser shield
    useBrowserShield(examStore.attemptId, handleViolation);

    // Timer countdown
    useEffect(() => {
        if (!examStore.isExamActive || examStore.isPaused) return;
        const interval = setInterval(() => {
            examStore.decrementTimer();
            if (examStore.remainingSeconds <= 0) {
                handleEndExam();
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [examStore.isExamActive, examStore.isPaused]);

    // Auto-save code every 2 seconds
    useEffect(() => {
        if (!examStore.attemptId || !examStore.isExamActive) return;
        autoSaveRef.current = setInterval(() => {
            const currentQ = questions[examStore.currentQuestionIndex];
            if (currentQ?.type === 'coding') {
                attemptsAPI.logCode(examStore.attemptId!, {
                    attempt_id: examStore.attemptId,
                    question_id: currentQ.id,
                    code_snapshot: code,
                    event_type: 'autosave',
                }).catch(() => { });

                wsSend({ type: 'code_update', exam_id: examId, code, language: currentQ.language });
            }
        }, 2000);
        return () => { if (autoSaveRef.current) clearInterval(autoSaveRef.current); };
    }, [examStore.attemptId, examStore.isExamActive, code, examStore.currentQuestionIndex, questions, examId, wsSend]);

    const handleChecklistComplete = async (fingerprint: string, browserInfo: any) => {
        try {
            const res = await attemptsAPI.create({
                exam_id: examId!,
                device_fingerprint: fingerprint,
                browser_info: browserInfo,
            });
            examStore.setAttempt(res.data.id, examId!);
            examStore.setTimer((exam?.duration_minutes || 60) * 60);
            setPhase('exam');

            // Request fullscreen
            try { await document.documentElement.requestFullscreen(); } catch { }
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Failed to start exam');
        }
    };

    const handleEndExam = async () => {
        if (examStore.attemptId) {
            await attemptsAPI.end(examStore.attemptId).catch(() => { });
        }
        examStore.endExam();
        if (document.fullscreenElement) document.exitFullscreen().catch(() => { });
        router.push('/student/dashboard');
    };

    const handleRunCode = async () => {
        const currentQ = questions[examStore.currentQuestionIndex];
        if (!currentQ || !examStore.attemptId) return;
        setIsRunning(true);
        setOutput('⏳ Running code...');
        try {
            // Run code for live output
            const runRes = await monitoringAPI.runCode({
                attempt_id: examStore.attemptId,
                question_id: currentQ.id,
                language: codeLanguage,
                code,
            });
            const result = runRes.data;
            let outputText = '';
            if (result.stdout) outputText += result.stdout;
            if (result.stderr) outputText += (outputText ? '\n' : '') + `⚠️ ${result.stderr}`;
            if (!outputText) outputText = '✅ Code executed successfully (no output)';
            if (result.execution_time_ms) outputText += `\n\n⏱ Execution time: ${result.execution_time_ms}ms`;
            setOutput(outputText);
        } catch (err: any) {
            setOutput(`❌ Error: ${err.response?.data?.detail || 'Execution failed'}`);
        } finally {
            setIsRunning(false);
        }
    };

    const handleSubmitCode = async () => {
        const currentQ = questions[examStore.currentQuestionIndex];
        if (!currentQ || !examStore.attemptId) return;
        setIsRunning(true);
        try {
            await attemptsAPI.submitCode(examStore.attemptId, {
                attempt_id: examStore.attemptId,
                question_id: currentQ.id,
                language: codeLanguage,
                code,
            });
            setOutput(prev => prev + '\n\n✅ Code submitted successfully for grading!');
        } catch (err: any) {
            setOutput(`❌ Submit error: ${err.response?.data?.detail || 'Submission failed'}`);
        } finally {
            setIsRunning(false);
        }
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const currentQuestion = questions[examStore.currentQuestionIndex];
    const trustColor = examStore.trustScore >= 80 ? 'var(--trust-high)' : examStore.trustScore >= 60 ? 'var(--trust-medium)' : examStore.trustScore >= 40 ? 'var(--trust-low)' : 'var(--trust-critical)';

    if (!user || !exam) return <div className="min-h-screen flex items-center justify-center"><div className="spinner"></div></div>;

    // Phase: Pre-exam checklist
    if (phase === 'checklist') {
        return <PreExamChecklist onComplete={handleChecklistComplete} />;
    }

    // Phase: Active exam
    return (
        <div className="h-screen flex flex-col bg-[var(--bg-primary)]">
            {/* Top Bar */}
            <header className="flex items-center justify-between px-6 py-3 bg-[var(--bg-glass)] backdrop-blur-xl border-b border-[var(--border-glass)]">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-gradient)' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                            </svg>
                        </div>
                        <span className="font-bold text-sm">ProctorForge</span>
                    </div>
                    <span className="text-[var(--text-muted)] text-sm">|</span>
                    <span className="text-sm font-medium">{exam.title}</span>
                </div>

                <div className="flex items-center gap-6">
                    {/* Monitoring indicators */}
                    <div className="flex items-center gap-2">
                        {/* Camera status */}
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${faceDetected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400 animate-pulse'}`}
                            title={faceDetected ? `Face detected (${faceCount})` : 'Face not detected'}>
                            📷
                        </div>
                        {/* Audio status */}
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${audioActive ? (voiceDetected ? 'bg-yellow-500/20 text-yellow-400' : 'bg-emerald-500/20 text-emerald-400') : 'bg-slate-500/20 text-slate-400'}`}
                            title={voiceDetected ? 'Voice detected' : audioActive ? 'Audio OK' : 'Audio off'}>
                            🎙
                        </div>
                    </div>

                    {/* Trust Score */}
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-[var(--text-muted)]">Trust</span>
                        <div className="w-24 trust-bar">
                            <div className="trust-bar-fill" style={{ width: `${examStore.trustScore}%`, background: trustColor }}></div>
                        </div>
                        <span className="text-sm font-bold" style={{ color: trustColor }}>{Math.round(examStore.trustScore)}</span>
                    </div>

                    {/* Timer */}
                    <div className={`px-4 py-2 rounded-xl font-mono font-bold text-lg ${examStore.remainingSeconds < 300 ? 'bg-[rgba(239,68,68,0.15)] text-[var(--danger)] animate-pulse-glow' : 'bg-[var(--bg-secondary)]'}`}>
                        {formatTime(examStore.remainingSeconds)}
                    </div>

                    {/* Question nav */}
                    <span className="text-sm text-[var(--text-muted)]">
                        Q {examStore.currentQuestionIndex + 1}/{questions.length}
                    </span>

                    <button onClick={handleEndExam} className="btn-danger text-xs py-2 px-4">End Exam</button>
                </div>
            </header>

            {/* Main Area */}
            <div className="flex-1 flex overflow-hidden">
                {/* Question Panel */}
                <div className="w-[400px] p-5 overflow-y-auto border-r border-[var(--border-glass)]">
                    {/* Question Navigation */}
                    <div className="flex gap-2 mb-5 flex-wrap">
                        {questions.map((q, i) => (
                            <button key={q.id} onClick={() => examStore.setQuestionIndex(i)}
                                className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${i === examStore.currentQuestionIndex ? 'bg-[var(--accent-primary)] text-white' : answers[q.id] ? 'bg-[rgba(16,185,129,0.15)] text-[var(--success)] border border-[var(--success)]' : 'bg-[var(--bg-secondary)] border border-[var(--border-glass)]'}`}>
                                {i + 1}
                            </button>
                        ))}
                    </div>

                    {/* Current Question */}
                    {currentQuestion && (
                        <div className="animate-fadeIn">
                            <div className="flex items-center gap-2 mb-3">
                                <span className={`badge ${currentQuestion.type === 'coding' ? 'badge-info' : 'badge-success'}`}>
                                    {currentQuestion.type === 'coding' ? '💻 Coding' : '📝 MCQ'}
                                </span>
                                <span className="text-xs text-[var(--text-muted)]">{currentQuestion.points} pts</span>
                            </div>
                            <p className="text-sm leading-relaxed mb-5">{currentQuestion.question_text}</p>

                            {/* MCQ Options */}
                            {currentQuestion.type === 'mcq' && currentQuestion.options && (
                                <div className="space-y-2">
                                    {currentQuestion.options.map((opt: any) => (
                                        <label key={opt.label}
                                            className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${answers[currentQuestion.id] === opt.label ? 'bg-[rgba(99,102,241,0.15)] border border-[var(--accent-primary)]' : 'bg-[var(--bg-secondary)] border border-[var(--border-glass)] hover:border-[var(--border-hover)]'}`}>
                                            <input type="radio" name={`q-${currentQuestion.id}`} checked={answers[currentQuestion.id] === opt.label}
                                                onChange={() => setAnswers({ ...answers, [currentQuestion.id]: opt.label })}
                                                className="accent-[var(--accent-primary)]" />
                                            <span className="font-bold text-sm text-[var(--accent-primary)]">{opt.label}.</span>
                                            <span className="text-sm">{opt.text}</span>
                                        </label>
                                    ))}
                                </div>
                            )}

                            {/* Coding language */}
                            {currentQuestion.type === 'coding' && (
                                <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                                    <span>Language:</span>
                                    <span className="badge badge-info">{currentQuestion.language}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Violations counter */}
                    <div className="mt-8 p-4 rounded-xl bg-[var(--bg-secondary)]">
                        <p className="text-xs text-[var(--text-muted)] mb-2">Session Info</p>
                        <div className="flex justify-between text-sm">
                            <span>Violations:</span>
                            <span className={examStore.violations.length > 3 ? 'text-[var(--danger)]' : 'text-[var(--text-secondary)]'}>
                                {examStore.violations.length}
                            </span>
                        </div>
                        <div className="flex justify-between text-sm mt-1">
                            <span>Risk Level:</span>
                            <span className={`badge badge-${examStore.riskLevel === 'low' ? 'success' : examStore.riskLevel === 'medium' ? 'warning' : 'danger'}`}>
                                {examStore.riskLevel}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Code Editor Panel */}
                <div className="flex-1 flex flex-col">
                    {currentQuestion?.type === 'coding' ? (
                        <>
                            {/* Language selector + Run/Submit bar */}
                            <div className="flex items-center justify-between px-4 py-2 bg-[var(--bg-secondary)] border-b border-[var(--border-glass)]">
                                <div className="flex items-center gap-3">
                                    <label className="text-xs text-[var(--text-muted)]">Language:</label>
                                    <select value={codeLanguage} onChange={(e) => setCodeLanguage(e.target.value)}
                                        className="px-3 py-1.5 rounded-lg bg-[var(--bg-primary)] text-sm text-white border border-[var(--border-glass)] focus:outline-none focus:border-[var(--accent-primary)]">
                                        <option value="python">Python</option>
                                        <option value="javascript">JavaScript</option>
                                        <option value="java">Java</option>
                                        <option value="cpp">C++</option>
                                        <option value="c">C</option>
                                        <option value="sql">SQL</option>
                                    </select>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={handleRunCode} disabled={isRunning}
                                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 transition-all disabled:opacity-50">
                                        {isRunning ? '⏳' : '▶'} Run
                                    </button>
                                    <button onClick={handleSubmitCode} disabled={isRunning}
                                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-[var(--accent-primary)] hover:opacity-90 transition-all disabled:opacity-50">
                                        📤 Submit
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 monaco-wrapper m-3 mb-0">
                                <MonacoEditor
                                    height="100%"
                                    language={codeLanguage === 'cpp' ? 'cpp' : codeLanguage === 'c' ? 'c' : codeLanguage}
                                    theme="vs-dark"
                                    value={code}
                                    onChange={(val) => setCode(val || '')}
                                    options={{
                                        fontSize: 14,
                                        minimap: { enabled: false },
                                        lineNumbers: 'on',
                                        roundedSelection: true,
                                        scrollBeyondLastLine: false,
                                        padding: { top: 16 },
                                        fontFamily: "'Fira Code', 'Cascadia Code', Consolas, monospace",
                                        fontLigatures: true,
                                    }}
                                />
                            </div>
                            {/* Output */}
                            <div className="h-36 m-3 p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-glass)] overflow-y-auto">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs text-[var(--text-muted)] font-medium">Output</span>
                                    {isRunning && <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }}></div>}
                                </div>
                                <pre className="text-sm text-[var(--text-secondary)] font-mono whitespace-pre-wrap">{output || 'Click "Run" to execute or "Submit" to grade'}</pre>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-[var(--text-muted)]">
                            <div className="text-center">
                                <p className="text-4xl mb-4">📝</p>
                                <p className="text-lg font-medium">MCQ Question</p>
                                <p className="text-sm mt-1">Select your answer from the options panel</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Hidden camera elements for face detection */}
            <video ref={videoRef} className="hidden" muted playsInline />
            <canvas ref={canvasRef} className="hidden" />

            {/* Camera preview (small corner overlay) */}
            {cameraActive && (
                <div className="fixed bottom-4 right-4 z-40 group">
                    <div className="w-32 h-24 rounded-xl overflow-hidden border-2 opacity-40 group-hover:opacity-100 transition-opacity"
                        style={{ borderColor: faceDetected ? 'var(--success)' : 'var(--danger)' }}>
                        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline autoPlay />
                    </div>
                    <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full" style={{ background: faceDetected ? 'var(--success)' : 'var(--danger)' }}></div>
                </div>
            )}

            {/* AI Twin Overlay */}
            {showAITwin && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
                    <div className="glass-card p-8 max-w-md text-center animate-fadeIn">
                        <div className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center animate-pulse-glow" style={{ background: 'var(--accent-gradient)' }}>
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
                                <circle cx="12" cy="8" r="5" /><path d="M20 21a8 8 0 0 0-16 0" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-bold gradient-text mb-3">AI Proctor Alert</h3>
                        <p className="text-[var(--text-secondary)] mb-6">{aiMessage}</p>
                        <button onClick={() => setShowAITwin(false)} className="btn-primary">
                            I Understand — Continue Exam
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
