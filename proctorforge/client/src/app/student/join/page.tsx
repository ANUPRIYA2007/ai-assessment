'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import gsap from 'gsap';
import { useAuthStore } from '@/stores/authStore';
import { DashboardLayout } from '@/components/DashboardLayout';

/* ─── Types matching teacher page ─── */
interface MCQOption { text: string; }
interface MCQQuestion {
    id: string; text: string; options: MCQOption[];
    correctIndex: number; timeLimit: number;
}
interface SessionState {
    id: string; joining_code: string; title: string;
    status: 'waiting' | 'question' | 'reveal' | 'ended';
    questions: MCQQuestion[]; currentQIndex: number;
}

/* ─── localStorage keys (must match teacher page) ─── */
const SESSION_KEY = 'testguard_live_session';
const PARTS_KEY = (id: string) => `testguard_live_${id}_parts`;
const ANSWERS_KEY = (id: string, qi: number) => `testguard_live_${id}_q${qi}_answers`;

const OPTION_COLORS = ['#7c3aed', '#22d3ee', '#f59e0b', '#10b981'];
const OPTION_LABELS = ['A', 'B', 'C', 'D'];

/* ─── Option card ─── */
function OptionCard({
    index, text, selected, revealed, correctIndex, count, total,
    onClick, disabled,
}: {
    index: number; text: string; selected: boolean; revealed: boolean;
    correctIndex: number; count: number; total: number;
    onClick: () => void; disabled: boolean;
}) {
    const ref = useRef<HTMLButtonElement>(null);
    const isCorrect = index === correctIndex;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;

    useEffect(() => {
        if (!ref.current) return;
        gsap.fromTo(ref.current,
            { y: 30, opacity: 0, scale: 0.9 },
            { y: 0, opacity: 1, scale: 1, duration: 0.45, delay: index * 0.08, ease: 'back.out(1.5)' }
        );
    }, [index]);

    const borderColor = revealed
        ? isCorrect ? '#10b981' : selected ? '#ef4444' : 'rgba(255,255,255,0.08)'
        : selected ? OPTION_COLORS[index] : 'rgba(255,255,255,0.08)';
    const bg = revealed
        ? isCorrect ? 'rgba(16,185,129,0.1)' : selected ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.02)'
        : selected ? `${OPTION_COLORS[index]}12` : 'rgba(255,255,255,0.03)';

    return (
        <button
            ref={ref}
            onClick={onClick}
            disabled={disabled}
            className="relative overflow-hidden rounded-2xl p-5 text-left w-full transition-all duration-200 group"
            style={{ background: bg, border: `2px solid ${borderColor}`, cursor: disabled ? 'default' : 'pointer' }}
            onMouseEnter={(e) => { if (!disabled) gsap.to(e.currentTarget, { scale: 1.02, duration: 0.2 }); }}
            onMouseLeave={(e) => { if (!disabled) gsap.to(e.currentTarget, { scale: 1, duration: 0.2 }); }}
        >
            {/* progress bar (after reveal) */}
            {revealed && (
                <div className="absolute bottom-0 left-0 h-1 rounded-b-2xl transition-all duration-700"
                    style={{ width: `${pct}%`, background: isCorrect ? '#10b981' : OPTION_COLORS[index] }} />
            )}
            <div className="flex items-center gap-4">
                <span className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-base flex-shrink-0"
                    style={{ background: `${OPTION_COLORS[index]}20`, color: OPTION_COLORS[index], border: `1px solid ${OPTION_COLORS[index]}40` }}>
                    {OPTION_LABELS[index]}
                </span>
                <span className="font-semibold text-sm text-white flex-1 leading-snug">{text}</span>
                {revealed && (
                    <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                        {isCorrect && <span className="text-green-400 font-black text-base">✓</span>}
                        {!isCorrect && selected && <span className="text-red-400 font-black text-base">✗</span>}
                        <span className="text-xs font-bold" style={{ color: OPTION_COLORS[index] }}>{pct}%</span>
                    </div>
                )}
                {!revealed && selected && (
                    <span className="text-xs font-bold" style={{ color: OPTION_COLORS[index] }}>✓</span>
                )}
            </div>
        </button>
    );
}

/* ══════════════════════════════════════════════════════════
   STUDENT LIVE PAGE
══════════════════════════════════════════════════════════ */
export default function StudentJoinPage() {
    const { user, loadFromStorage } = useAuthStore();
    const router = useRouter();

    const [stage, setStage] = useState<'enter' | 'lobby' | 'playing'>('enter');
    const [code, setCode] = useState('');
    const [codeError, setCodeError] = useState('');
    const [session, setSession] = useState<SessionState | null>(null);
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [submitted, setSubmitted] = useState(false);
    const [answers, setAnswers] = useState<any[]>([]);   // other students' answers (for reveal)
    const [timer, setTimer] = useState(0);
    const [lastQIndex, setLastQIndex] = useState(-1);
    const [score, setScore] = useState(0);
    const [correctCount, setCorrectCount] = useState(0);
    const [totalAnswered, setTotalAnswered] = useState(0);

    const headerRef = useRef<HTMLDivElement>(null);
    const formRef = useRef<HTMLDivElement>(null);
    const questionRef = useRef<HTMLDivElement>(null);

    useEffect(() => { loadFromStorage(); }, [loadFromStorage]);
    useEffect(() => { if (user && user.role !== 'student') router.push(`/${user.role}/dashboard`); }, [user, router]);
    useEffect(() => {
        if (headerRef.current) gsap.fromTo(headerRef.current, { y: -30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out' });
        if (formRef.current) gsap.fromTo(formRef.current, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, delay: 0.2, ease: 'power3.out' });
    }, []);

    /* ── join session ── */
    const joinSession = () => {
        if (!code.trim() || code.length < 4) { setCodeError('Enter a valid code'); return; }
        setCodeError('');
        const s: SessionState | null = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
        if (!s || s.joining_code !== code.trim().toUpperCase() || s.status === 'ended') {
            setCodeError('Code not found or session ended. Ask your instructor.');
            if (formRef.current) gsap.fromTo(formRef.current, { x: -10 }, { x: 0, duration: 0.5, ease: 'elastic.out(1,0.3)' });
            return;
        }
        setSession(s);
        // Register as participant
        const key = PARTS_KEY(s.id);
        const parts = JSON.parse(localStorage.getItem(key) || '[]');
        const alreadyIn = parts.find((p: any) => p.email === user?.email);
        if (!alreadyIn && user) {
            parts.push({ id: user.id, name: user.name, email: user.email, joined_at: new Date().toISOString() });
            localStorage.setItem(key, JSON.stringify(parts));
        }
        setStage('lobby');
    };

    /* ── poll session state ── */
    const pollSession = useCallback(() => {
        const s: SessionState | null = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
        if (!s) return;

        // New question pushed
        if (s.status === 'question' && s.currentQIndex !== lastQIndex) {
            setLastQIndex(s.currentQIndex);
            setSelectedOption(null);
            setSubmitted(false);
            setAnswers([]);
            setTimer(s.questions[s.currentQIndex]?.timeLimit || 30);
            if (questionRef.current) gsap.fromTo(questionRef.current, { x: 80, opacity: 0, scale: 0.97 }, { x: 0, opacity: 1, scale: 1, duration: 0.5, ease: 'power3.out' });
        }

        // Reveal
        if (s.status === 'reveal' && s.currentQIndex >= 0) {
            const ans = JSON.parse(localStorage.getItem(ANSWERS_KEY(s.id, s.currentQIndex)) || '[]');
            setAnswers(ans);
        }

        setSession(s);
        if (stage === 'lobby' && (s.status === 'question' || s.status === 'reveal')) setStage('playing');
    }, [lastQIndex, stage]);

    useEffect(() => {
        if (stage === 'lobby' || stage === 'playing') {
            const iv = setInterval(pollSession, 2000);
            return () => clearInterval(iv);
        }
    }, [stage, pollSession]);

    /* countdown timer (local) */
    useEffect(() => {
        if (session?.status === 'question' && timer > 0 && !submitted) {
            const t = setTimeout(() => setTimer((v) => v - 1), 1000);
            return () => clearTimeout(t);
        }
    }, [timer, session?.status, submitted]);

    /* ── submit answer ── */
    const submitAnswer = (optionIndex: number) => {
        if (!session || !user || submitted) return;
        setSelectedOption(optionIndex);
        setSubmitted(true);
        const key = ANSWERS_KEY(session.id, session.currentQIndex);
        const ans = JSON.parse(localStorage.getItem(key) || '[]');
        ans.push({ studentId: user.id, studentName: user.name, optionIndex, timestamp: Date.now() });
        localStorage.setItem(key, JSON.stringify(ans));
        if (questionRef.current) {
            gsap.fromTo(questionRef.current, { scale: 1.01 }, { scale: 1, duration: 0.4, ease: 'elastic.out(1,0.5)' });
        }
        // Update score tracking
        setTotalAnswered((v) => v + 1);
        const currentQ = session.questions[session.currentQIndex];
        if (currentQ && optionIndex === currentQ.correctIndex) {
            setCorrectCount((v) => v + 1);
            setScore((v) => v + Math.max(100, timer * 10)); // bonus for speed
        }
    };

    if (!user) return null;

    const currentQ = session && session.currentQIndex >= 0 ? session.questions[session.currentQIndex] : null;
    const isRevealed = session?.status === 'reveal';
    const timerPct = currentQ ? (timer / currentQ.timeLimit) * 100 : 0;

    return (
        <DashboardLayout role="student">
            <div className="max-w-2xl mx-auto space-y-8">
                {/* Header */}
                <div ref={headerRef}>
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest mb-2">Live MCQ</p>
                    <h1 className="text-3xl font-black text-white">Join <span className="text-gradient">Live Session</span></h1>
                    <p className="text-slate-500 text-sm mt-1">Enter your instructor&apos;s code, then answer MCQ questions in real-time</p>
                </div>

                {/* ─── ENTER CODE ─── */}
                {stage === 'enter' && (
                    <div ref={formRef} className="rounded-2xl p-8" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.2)' }}>
                                <svg className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                            </div>
                            <h2 className="text-lg font-bold text-white">Enter Session Code</h2>
                            <p className="text-xs text-slate-600 mt-1">Ask your instructor for the 6-character code</p>
                        </div>

                        {codeError && (
                            <div className="mb-5 p-3.5 rounded-xl border border-red-500/20 text-red-400 text-sm flex items-center gap-2.5" style={{ background: 'rgba(239,68,68,0.06)' }}>
                                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                {codeError}
                            </div>
                        )}

                        <input type="text" value={code} onChange={(e) => { setCode(e.target.value.toUpperCase().slice(0, 6)); setCodeError(''); }}
                            placeholder="ABC123" maxLength={6}
                            className="w-full py-5 rounded-2xl text-4xl font-black text-center tracking-[0.4em] uppercase focus:outline-none transition-all mb-4"
                            style={{ background: 'rgba(255,255,255,0.04)', border: `2px solid ${codeError ? 'rgba(239,68,68,0.4)' : code.length === 6 ? 'rgba(34,211,238,0.4)' : 'rgba(255,255,255,0.08)'}`, color: code.length === 6 ? '#22d3ee' : 'white', fontFamily: 'monospace' }}
                            onKeyDown={(e) => e.key === 'Enter' && joinSession()} />

                        <div className="flex justify-center gap-3 mb-6">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className="w-6 h-1 rounded-full transition-all" style={{ background: i < code.length ? '#22d3ee' : 'rgba(255,255,255,0.1)' }} />
                            ))}
                        </div>

                        <button onClick={joinSession} disabled={code.length < 4}
                            className="w-full py-3.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                            style={{ background: 'linear-gradient(135deg, #22d3ee, #7c3aed)' }}
                            onMouseEnter={(e) => gsap.to(e.currentTarget, { scale: 1.02, boxShadow: '0 8px 25px rgba(34,211,238,0.4)', duration: 0.2 })}
                            onMouseLeave={(e) => gsap.to(e.currentTarget, { scale: 1, boxShadow: 'none', duration: 0.2 })}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14" /></svg>
                            Join Session
                        </button>
                    </div>
                )}

                {/* ─── LOBBY ─── */}
                {stage === 'lobby' && session && (
                    <div className="rounded-2xl p-10 text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(34,211,238,0.2)' }}>
                        <div className="w-16 h-16 rounded-full border-4 border-slate-800 border-t-cyan-400 animate-spin mx-auto mb-6" />
                        <h2 className="text-2xl font-black text-white mb-2">You&apos;re In!</h2>
                        <p className="text-slate-400 text-sm mb-1">Joined: <span className="text-white font-semibold">{session.title}</span></p>
                        <p className="text-xs text-slate-600 mt-4">Waiting for your instructor to push the first question…</p>
                        {/* Score preview */}
                        <div className="flex items-center justify-center gap-4 mt-8 p-4 rounded-xl glass">
                            <div className="text-center"><span className="block text-2xl font-black text-brand-400">{score}</span><span className="text-xs text-slate-600">Points</span></div>
                            <div className="w-px h-10 bg-white/10" />
                            <div className="text-center"><span className="block text-2xl font-black text-green-400">{correctCount}</span><span className="text-xs text-slate-600">Correct</span></div>
                            <div className="w-px h-10 bg-white/10" />
                            <div className="text-center"><span className="block text-2xl font-black text-slate-400">{totalAnswered}</span><span className="text-xs text-slate-600">Answered</span></div>
                        </div>
                    </div>
                )}

                {/* ─── PLAYING: active question ─── */}
                {stage === 'playing' && session && currentQ && (
                    <div ref={questionRef} className="space-y-5">
                        {/* Question header */}
                        <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${isRevealed ? 'rgba(16,185,129,0.3)' : 'rgba(124,58,237,0.3)'}` }}>
                            <div className="px-6 py-4 flex items-center justify-between" style={{ background: isRevealed ? 'rgba(16,185,129,0.06)' : 'rgba(124,58,237,0.08)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <span className="text-xs font-bold px-3 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.08)', color: '#94a3b8' }}>
                                    Q {session.currentQIndex + 1} / {session.questions.length}
                                </span>
                                {!isRevealed && !submitted && (
                                    <div className="flex items-center gap-2">
                                        <div className="w-28 h-2 rounded-full bg-white/10 overflow-hidden">
                                            <div className="h-full rounded-full transition-all duration-1000"
                                                style={{ width: `${timerPct}%`, background: timerPct > 50 ? '#10b981' : timerPct > 20 ? '#f59e0b' : '#ef4444' }} />
                                        </div>
                                        <span className="text-sm font-black tabular-nums" style={{ color: timer <= 5 ? '#ef4444' : '#94a3b8', minWidth: '2ch' }}>{timer}</span>
                                    </div>
                                )}
                                {isRevealed && (
                                    <span className="text-xs font-bold text-green-400">Answer Revealed</span>
                                )}
                                {submitted && !isRevealed && (
                                    <span className="text-xs font-bold text-yellow-400 flex items-center gap-1">
                                        <div className="w-3 h-3 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                                        Waiting for reveal…
                                    </span>
                                )}
                            </div>

                            <div className="p-6">
                                <p className="text-lg font-black text-white mb-6 leading-snug">{currentQ.text}</p>
                                <div className="space-y-3">
                                    {currentQ.options.map((opt, i) => {
                                        const count = isRevealed
                                            ? answers.filter((a) => a.optionIndex === i).length
                                            : 0;
                                        return (
                                            <OptionCard
                                                key={i}
                                                index={i}
                                                text={opt.text}
                                                selected={selectedOption === i}
                                                revealed={isRevealed}
                                                correctIndex={currentQ.correctIndex}
                                                count={count}
                                                total={answers.length}
                                                disabled={submitted || isRevealed || timer === 0}
                                                onClick={() => submitAnswer(i)}
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Score strip */}
                        <div className="flex items-center justify-center gap-6 p-4 rounded-2xl glass">
                            <div className="text-center"><span className="block text-xl font-black text-brand-400">{score}</span><span className="text-xs text-slate-600">Points</span></div>
                            <div className="w-px h-8 bg-white/10" />
                            <div className="text-center"><span className="block text-xl font-black text-green-400">{correctCount}</span><span className="text-xs text-slate-600">Correct</span></div>
                            <div className="w-px h-8 bg-white/10" />
                            <div className="text-center"><span className="block text-xl font-black text-slate-400">{totalAnswered}</span><span className="text-xs text-slate-600">Answered</span></div>
                        </div>

                        {/* Reveal result feedback */}
                        {isRevealed && selectedOption !== null && (
                            <div className="rounded-2xl p-5 text-center"
                                style={{
                                    background: selectedOption === currentQ.correctIndex ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                                    border: `1px solid ${selectedOption === currentQ.correctIndex ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                                }}>
                                <span className="text-3xl">{selectedOption === currentQ.correctIndex ? '🎉' : '😔'}</span>
                                <p className="font-bold text-white mt-2">
                                    {selectedOption === currentQ.correctIndex ? 'Correct! Well done!' : `Wrong — Correct: Option ${OPTION_LABELS[currentQ.correctIndex]}`}
                                </p>
                                <p className="text-xs text-slate-500 mt-1">Waiting for next question…</p>
                            </div>
                        )}
                        {isRevealed && selectedOption === null && (
                            <div className="rounded-2xl p-5 text-center" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
                                <span className="text-3xl">⏱</span>
                                <p className="font-bold text-white mt-2">Time&apos;s up — you didn&apos;t answer</p>
                                <p className="text-xs text-slate-500 mt-1">Correct answer: Option {OPTION_LABELS[currentQ.correctIndex]}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* ─── SESSION ENDED ─── */}
                {session?.status === 'ended' && (
                    <div className="rounded-2xl p-10 text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <span className="text-5xl mb-4 block">🏆</span>
                        <h2 className="text-2xl font-black text-white mb-2">Session Ended</h2>
                        <p className="text-slate-400 text-sm mb-6">Your instructor ended the session</p>
                        <div className="grid grid-cols-3 gap-4 mb-8">
                            <div className="p-4 rounded-xl glass text-center"><span className="block text-3xl font-black text-brand-400">{score}</span><span className="text-xs text-slate-600">Total Points</span></div>
                            <div className="p-4 rounded-xl glass text-center"><span className="block text-3xl font-black text-green-400">{correctCount}</span><span className="text-xs text-slate-600">Correct</span></div>
                            <div className="p-4 rounded-xl glass text-center"><span className="block text-3xl font-black text-cyan-400">{totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0}%</span><span className="text-xs text-slate-600">Accuracy</span></div>
                        </div>
                        <button onClick={() => { setStage('enter'); setCode(''); setSession(null); }}
                            className="px-8 py-3 rounded-xl font-bold text-sm text-white transition-all"
                            style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}>
                            Join Another Session
                        </button>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
