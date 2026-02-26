'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import gsap from 'gsap';
import { useAuthStore } from '@/stores/authStore';
import { DashboardLayout } from '@/components/DashboardLayout';

/* ─── Types ─── */
interface MCQOption { text: string; }
interface MCQQuestion {
    id: string;
    text: string;
    options: MCQOption[];
    correctIndex: number;
    timeLimit: number; // seconds
}
interface SessionState {
    id: string;
    joining_code: string;
    title: string;
    status: 'waiting' | 'question' | 'reveal' | 'ended';
    questions: MCQQuestion[];
    currentQIndex: number; // -1 = no question active
    created_at: string;
}
interface Participant { id: string; name: string; email: string; joined_at: string; }
interface Answer { studentId: string; studentName: string; optionIndex: number; timestamp: number; }

/* ─── helpers ─── */
const SESSION_KEY = 'testguard_live_session';
const PARTS_KEY = (id: string) => `testguard_live_${id}_parts`;
const ANSWERS_KEY = (id: string, qi: number) => `testguard_live_${id}_q${qi}_answers`;

const saveSession = (s: SessionState) => localStorage.setItem(SESSION_KEY, JSON.stringify(s));
const loadSession = (): SessionState | null => {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
};

/* ─── Code display ─── */
function CodeBadge({ code }: { code: string }) {
    const [copied, setCopied] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!ref.current) return;
        gsap.fromTo(ref.current, { scale: 0.8, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(1.7)' });
        gsap.to(ref.current, { boxShadow: '0 0 40px rgba(34,211,238,0.6), 0 0 80px rgba(34,211,238,0.2)', repeat: -1, yoyo: true, duration: 2, ease: 'sine.inOut' });
    }, []);
    return (
        <div ref={ref} className="flex items-center gap-4 px-6 py-3 rounded-2xl cursor-pointer"
            style={{ background: 'rgba(34,211,238,0.08)', border: '2px solid rgba(34,211,238,0.3)' }}
            onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
            <span className="text-3xl font-black tracking-[0.3em] text-white" style={{ fontFamily: 'monospace', textShadow: '0 0 20px rgba(34,211,238,0.9)' }}>{code}</span>
            <div className="text-xs font-semibold" style={{ color: copied ? '#10b981' : '#22d3ee' }}>
                {copied ? '✓ Copied' : '⎘ Copy'}
            </div>
        </div>
    );
}

/* ─── Option color palette ─── */
const OPTION_COLORS = ['#7c3aed', '#22d3ee', '#f59e0b', '#10b981'];
const OPTION_LABELS = ['A', 'B', 'C', 'D'];

/* ═══════════════════════════════════════════════════════════
   TEACHER LIVE ASSESSMENT PAGE
═══════════════════════════════════════════════════════════ */
export default function TeacherLivePage() {
    const { user, loadFromStorage } = useAuthStore();
    const router = useRouter();

    const [session, setSession] = useState<SessionState | null>(null);
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [answers, setAnswers] = useState<Answer[]>([]);
    const [questionTimer, setQuestionTimer] = useState(0);
    const [timerRunning, setTimerRunning] = useState(false);

    /* question builder */
    const [qText, setQText] = useState('');
    const [qOptions, setQOptions] = useState(['', '', '', '']);
    const [qCorrect, setQCorrect] = useState(0);
    const [qTime, setQTime] = useState(30);
    const [buildError, setBuildError] = useState('');

    /* title */
    const [title, setTitle] = useState('');
    const [started, setStarted] = useState(false);

    const headerRef = useRef<HTMLDivElement>(null);
    const questionRef = useRef<HTMLDivElement>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => { loadFromStorage(); }, [loadFromStorage]);
    useEffect(() => { if (user && user.role !== 'teacher') router.push(`/${user.role}/dashboard`); }, [user, router]);
    useEffect(() => {
        if (headerRef.current) gsap.fromTo(headerRef.current, { y: -30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out' });
        // restore existing session
        const s = loadSession();
        if (s && s.status !== 'ended') { setSession(s); setStarted(true); }
    }, []);

    /* poll participants + answers every 3s */
    const pollData = useCallback(() => {
        if (!session) return;
        const parts: Participant[] = JSON.parse(localStorage.getItem(PARTS_KEY(session.id)) || '[]');
        setParticipants(parts);
        if (session.currentQIndex >= 0) {
            const ans: Answer[] = JSON.parse(localStorage.getItem(ANSWERS_KEY(session.id, session.currentQIndex)) || '[]');
            setAnswers(ans);
        }
    }, [session]);

    useEffect(() => {
        const iv = setInterval(pollData, 2000);
        return () => clearInterval(iv);
    }, [pollData]);

    /* countdown timer */
    useEffect(() => {
        if (timerRunning && questionTimer > 0) {
            timerRef.current = setTimeout(() => setQuestionTimer((t) => t - 1), 1000);
        } else if (timerRunning && questionTimer === 0) {
            setTimerRunning(false);
            revealAnswer();
        }
        return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }, [timerRunning, questionTimer]);

    /* generate code */
    const generateCode = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    };

    /* start session */
    const startSession = () => {
        if (!title.trim()) { alert('Please enter a session title'); return; }
        const s: SessionState = {
            id: `live-${Date.now()}`,
            joining_code: generateCode(),
            title: title.trim(),
            status: 'waiting',
            questions: [],
            currentQIndex: -1,
            created_at: new Date().toISOString(),
        };
        saveSession(s);
        setSession(s);
        setStarted(true);
    };

    /* add question */
    const addQuestion = () => {
        if (!qText.trim()) { setBuildError('Enter question text'); return; }
        if (qOptions.some((o) => !o.trim())) { setBuildError('Fill in all 4 options'); return; }
        setBuildError('');

        const q: MCQQuestion = {
            id: `q-${Date.now()}`,
            text: qText.trim(),
            options: qOptions.map((t) => ({ text: t.trim() })),
            correctIndex: qCorrect,
            timeLimit: qTime,
        };

        setSession((prev) => {
            if (!prev) return prev;
            const updated = { ...prev, questions: [...prev.questions, q] };
            saveSession(updated);
            return updated;
        });
        setQText('');
        setQOptions(['', '', '', '']);
        setQCorrect(0);
    };

    /* push question to students */
    const pushQuestion = (idx: number) => {
        if (!session) return;
        const q = session.questions[idx];
        const updated: SessionState = { ...session, status: 'question', currentQIndex: idx };
        saveSession(updated);
        setSession(updated);
        setAnswers([]);
        setQuestionTimer(q.timeLimit);
        setTimerRunning(true);
        if (questionRef.current) gsap.fromTo(questionRef.current, { x: 60, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: 'power3.out' });
    };

    /* stop / freeze question */
    const stopQuestion = () => {
        if (!session) return;
        setTimerRunning(false);
        const updated: SessionState = { ...session, status: 'reveal' };
        saveSession(updated);
        setSession(updated);
    };

    /* reveal answer */
    const revealAnswer = () => {
        if (!session) return;
        const updated: SessionState = { ...session, status: 'reveal' };
        saveSession(updated);
        setSession(updated);
        setTimerRunning(false);
    };

    /* next question / back to lobby */
    const backToLobby = () => {
        if (!session) return;
        const updated: SessionState = { ...session, status: 'waiting', currentQIndex: -1 };
        saveSession(updated);
        setSession(updated);
        setAnswers([]);
    };

    /* end session */
    const endSession = () => {
        if (!session) return;
        const updated = { ...session, status: 'ended' as const };
        saveSession(updated);
        setSession(null);
        setStarted(false);
        localStorage.removeItem(SESSION_KEY);
    };

    if (!user || user.role !== 'teacher') return null;

    const currentQ = session && session.currentQIndex >= 0 ? session.questions[session.currentQIndex] : null;
    const answerCounts = currentQ
        ? currentQ.options.map((_, i) => answers.filter((a) => a.optionIndex === i).length)
        : [];
    const totalAnswers = answerCounts.reduce((a, b) => a + b, 0);
    const timerPct = currentQ ? (questionTimer / currentQ.timeLimit) * 100 : 0;

    return (
        <DashboardLayout role="teacher">
            <div className="max-w-6xl mx-auto space-y-8">
                {/* Header */}
                <div ref={headerRef} className="flex items-start justify-between flex-wrap gap-4">
                    <div>
                        <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest mb-2">MCQ Live Session</p>
                        <h1 className="text-3xl font-black text-white">Live <span className="text-gradient">Assessment</span></h1>
                        <p className="text-slate-500 text-sm mt-1">Push MCQ questions in real-time · students answer live</p>
                    </div>
                    {session && (
                        <button onClick={endSession} className="px-5 py-2.5 rounded-xl text-sm font-bold text-red-400 border border-red-500/30 hover:bg-red-500/10 transition-all">
                            End Session
                        </button>
                    )}
                </div>

                {/* ─── START PANEL ─── */}
                {!started && (
                    <div className="max-w-lg rounded-2xl p-8" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <h2 className="text-xl font-bold text-white mb-6">Start a New Live MCQ Session</h2>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Session Title</label>
                        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Chapter 5 — Photosynthesis Quiz"
                            className="w-full px-4 py-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-slate-600 text-sm focus:outline-none focus:border-brand-500/60 focus:ring-1 focus:ring-brand-500/30 transition-all mb-6" />
                        <button onClick={startSession} className="flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm text-white transition-all"
                            style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
                            onMouseEnter={(e) => gsap.to(e.currentTarget, { scale: 1.03, boxShadow: '0 8px 30px rgba(124,58,237,0.5)', duration: 0.2 })}
                            onMouseLeave={(e) => gsap.to(e.currentTarget, { scale: 1, boxShadow: 'none', duration: 0.2 })}>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            Create Live Session
                        </button>
                    </div>
                )}

                {/* ─── ACTIVE SESSION ─── */}
                {session && started && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                        {/* LEFT: Code + participants + question list */}
                        <div className="lg:col-span-1 space-y-5">
                            {/* Code */}
                            <div className="rounded-2xl p-5 text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(34,211,238,0.15)' }}>
                                <p className="text-xs text-slate-600 uppercase tracking-widest mb-3">{session.title}</p>
                                <CodeBadge code={session.joining_code} />
                                <p className="text-xs text-slate-600 mt-3">Students join at <span className="text-brand-400">TestGuard → Join Live</span></p>
                            </div>

                            {/* Participants */}
                            <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-xs font-bold text-white uppercase tracking-widest">Students</span>
                                    <span className="text-xs px-2.5 py-1 rounded-lg font-bold text-cyan-400" style={{ background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.2)' }}>{participants.length}</span>
                                </div>
                                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                    {participants.length === 0 ? (
                                        <div className="text-xs text-slate-600 text-center py-3 flex flex-col items-center gap-2">
                                            <div className="w-5 h-5 border-2 border-slate-700 border-t-cyan-500 rounded-full animate-spin" />
                                            Waiting for students…
                                        </div>
                                    ) : participants.map((p, i) => (
                                        <div key={p.id || i} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                                            <div className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold text-white" style={{ background: 'linear-gradient(135deg, #22d3ee, #7c3aed)' }}>{p.name?.charAt(0)}</div>
                                            <span className="text-xs text-slate-300 truncate">{p.name}</span>
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-400 ml-auto" />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Question list */}
                            <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <p className="text-xs font-bold text-white uppercase tracking-widest mb-3">Questions ({session.questions.length})</p>
                                <div className="space-y-2 max-h-52 overflow-y-auto">
                                    {session.questions.length === 0 && (
                                        <p className="text-xs text-slate-600 text-center py-3">Add your first question →</p>
                                    )}
                                    {session.questions.map((q, i) => (
                                        <button key={q.id} onClick={() => session.status !== 'question' && pushQuestion(i)} disabled={session.status === 'question' && session.currentQIndex === i}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all group"
                                            style={{
                                                background: session.currentQIndex === i ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.03)',
                                                border: `1px solid ${session.currentQIndex === i ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.06)'}`,
                                            }}>
                                            <div className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-black flex-shrink-0"
                                                style={{ background: session.currentQIndex === i ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.08)', color: session.currentQIndex === i ? '#a78bfa' : '#64748b' }}>
                                                {i + 1}
                                            </div>
                                            <span className="text-xs text-slate-300 truncate flex-1">{q.text}</span>
                                            {session.currentQIndex !== i && session.status !== 'question' && (
                                                <svg className="w-3 h-3 text-slate-600 group-hover:text-brand-400 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                                </svg>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* RIGHT: Active question control + question builder */}
                        <div className="lg:col-span-2 space-y-5">

                            {/* ── Active question display ── */}
                            {currentQ ? (
                                <div ref={questionRef} className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${session.status === 'reveal' ? 'rgba(16,185,129,0.3)' : 'rgba(124,58,237,0.3)'}` }}>
                                    {/* Top bar */}
                                    <div className="px-6 py-4 flex items-center justify-between" style={{ background: session.status === 'reveal' ? 'rgba(16,185,129,0.06)' : 'rgba(124,58,237,0.06)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs font-bold px-3 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.08)', color: '#94a3b8' }}>Q {session.currentQIndex + 1}/{session.questions.length}</span>
                                            <span className="text-xs font-semibold" style={{ color: session.status === 'reveal' ? '#10b981' : '#a78bfa' }}>
                                                {session.status === 'reveal' ? '✓ Revealed' : '● Live'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {/* Answer counter */}
                                            <span className="text-xs text-slate-500">{totalAnswers}/{participants.length} answered</span>
                                            {/* Timer */}
                                            {session.status === 'question' && (
                                                <div className="flex items-center gap-2">
                                                    <div className="w-24 h-2 rounded-full bg-white/10 overflow-hidden">
                                                        <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${timerPct}%`, background: timerPct > 50 ? '#10b981' : timerPct > 20 ? '#f59e0b' : '#ef4444' }} />
                                                    </div>
                                                    <span className="text-sm font-black" style={{ color: questionTimer <= 5 ? '#ef4444' : '#94a3b8', fontVariantNumeric: 'tabular-nums', minWidth: '2ch' }}>{questionTimer}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="p-6">
                                        <p className="text-base font-bold text-white mb-6">{currentQ.text}</p>
                                        <div className="grid grid-cols-2 gap-3 mb-6">
                                            {currentQ.options.map((opt, oi) => {
                                                const count = answerCounts[oi] || 0;
                                                const pct = totalAnswers > 0 ? Math.round((count / totalAnswers) * 100) : 0;
                                                const isCorrect = oi === currentQ.correctIndex;
                                                return (
                                                    <div key={oi} className="rounded-xl p-3 relative overflow-hidden"
                                                        style={{ background: session.status === 'reveal' ? (isCorrect ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.03)') : 'rgba(255,255,255,0.03)', border: `1px solid ${session.status === 'reveal' ? (isCorrect ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.06)') : OPTION_COLORS[oi] + '40'}` }}>
                                                        {/* progress bar */}
                                                        {totalAnswers > 0 && (
                                                            <div className="absolute bottom-0 left-0 h-1 rounded-b-xl transition-all duration-500" style={{ width: `${pct}%`, background: session.status === 'reveal' && isCorrect ? '#10b981' : OPTION_COLORS[oi] }} />
                                                        )}
                                                        <div className="flex items-center gap-2.5">
                                                            <span className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-black flex-shrink-0" style={{ background: `${OPTION_COLORS[oi]}20`, color: OPTION_COLORS[oi] }}>{OPTION_LABELS[oi]}</span>
                                                            <span className="text-xs text-slate-300 flex-1">{opt.text}</span>
                                                            <span className="text-xs font-bold" style={{ color: OPTION_COLORS[oi] }}>{count}</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Unanswered students */}
                                        {session.status === 'question' && participants.length > 0 && (() => {
                                            const unanswered = participants.filter(p => !answers.find(a => a.studentId === p.id));
                                            return unanswered.length > 0 ? (
                                                <div className="mb-4 rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)' }}>
                                                    <p className="text-xs font-bold text-red-400 uppercase tracking-widest mb-2">Not Yet Answered ({unanswered.length})</p>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {unanswered.map(p => (
                                                            <span key={p.id} className="text-[11px] px-2 py-0.5 rounded-lg text-red-300 font-medium" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)' }}>{p.name}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="mb-4 rounded-xl p-3 text-center" style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.25)' }}>
                                                    <p className="text-xs font-bold text-emerald-400">All students have answered!</p>
                                                </div>
                                            );
                                        })()}

                                        {/* Controls */}
                                        <div className="flex gap-3">
                                            {session.status === 'question' ? (
                                                <button onClick={stopQuestion} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/10 transition-all flex items-center justify-center gap-2">
                                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                                                    Stop &amp; Reveal
                                                </button>
                                            ) : (
                                                <button onClick={backToLobby} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-slate-400 border border-white/10 hover:bg-white/5 transition-all flex items-center justify-center gap-2">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" /></svg>
                                                    Back to Lobby
                                                </button>
                                            )}
                                            {/* next question shortcut */}
                                            {session.status === 'reveal' && session.currentQIndex < session.questions.length - 1 && (
                                                <button onClick={() => pushQuestion(session.currentQIndex + 1)} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all flex items-center justify-center gap-2"
                                                    style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}>
                                                    Next Question
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* Waiting lobby */
                                <div className="rounded-2xl p-6 text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}>
                                    <div className="w-12 h-12 rounded-full border-2 border-slate-700 border-t-brand-500 animate-spin mx-auto mb-4" />
                                    <p className="text-white font-bold mb-1">Lobby — Waiting for you to push a question</p>
                                    <p className="text-slate-500 text-xs">{participants.length} student{participants.length !== 1 ? 's' : ''} connected · Click any question on the left to push it</p>
                                </div>
                            )}

                            {/* ── Question Builder ── */}
                            <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <h3 className="text-sm font-bold text-white mb-5 flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-md bg-brand-700/30 text-brand-400 flex items-center justify-center text-xs font-black">+</span>
                                    Add New Question
                                </h3>

                                {buildError && (
                                    <div className="mb-4 px-4 py-2.5 rounded-xl border border-red-500/20 text-red-400 text-xs" style={{ background: 'rgba(239,68,68,0.06)' }}>{buildError}</div>
                                )}

                                {/* Question text */}
                                <div className="mb-4">
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Question Text</label>
                                    <textarea value={qText} onChange={(e) => setQText(e.target.value)} rows={2} placeholder="Type your MCQ question…"
                                        className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-slate-600 text-sm focus:outline-none focus:border-brand-500/60 focus:ring-1 focus:ring-brand-500/30 transition-all resize-none" />
                                </div>

                                {/* Options */}
                                <div className="grid grid-cols-2 gap-3 mb-4">
                                    {qOptions.map((opt, i) => (
                                        <div key={i} className="relative">
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black" style={{ background: `${OPTION_COLORS[i]}20`, color: OPTION_COLORS[i] }}>
                                                {OPTION_LABELS[i]}
                                            </div>
                                            <input type="text" value={opt} onChange={(e) => { const o = [...qOptions]; o[i] = e.target.value; setQOptions(o); }} placeholder={`Option ${OPTION_LABELS[i]}`}
                                                className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-white/[0.04] border text-white placeholder-slate-600 text-xs focus:outline-none focus:ring-1 transition-all"
                                                style={{ borderColor: qCorrect === i ? `${OPTION_COLORS[i]}50` : 'rgba(255,255,255,0.08)' }} />
                                        </div>
                                    ))}
                                </div>

                                {/* Correct answer + time limit */}
                                <div className="flex items-center gap-4 mb-5">
                                    <div className="flex-1">
                                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Correct Answer</label>
                                        <div className="flex gap-2">
                                            {OPTION_LABELS.map((l, i) => (
                                                <button key={i} type="button" onClick={() => setQCorrect(i)}
                                                    className="w-9 h-9 rounded-lg text-xs font-black transition-all"
                                                    style={{ background: qCorrect === i ? `${OPTION_COLORS[i]}25` : 'rgba(255,255,255,0.05)', color: qCorrect === i ? OPTION_COLORS[i] : '#64748b', border: `1px solid ${qCorrect === i ? OPTION_COLORS[i] + '50' : 'rgba(255,255,255,0.08)'}` }}>
                                                    {l}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Time (s)</label>
                                        <select value={qTime} onChange={(e) => setQTime(+e.target.value)} className="px-3 py-2 rounded-lg text-xs font-semibold text-white" style={{ background: '#0d0d1a', border: '1px solid rgba(255,255,255,0.08)' }}>
                                            {[10, 15, 20, 30, 45, 60].map((t) => <option key={t} value={t}>{t}s</option>)}
                                        </select>
                                    </div>
                                </div>

                                <button onClick={addQuestion} className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all flex items-center justify-center gap-2"
                                    style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
                                    onMouseEnter={(e) => gsap.to(e.currentTarget, { scale: 1.02, boxShadow: '0 8px 25px rgba(124,58,237,0.5)', duration: 0.2 })}
                                    onMouseLeave={(e) => gsap.to(e.currentTarget, { scale: 1, boxShadow: 'none', duration: 0.2 })}>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                    Add Question
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
