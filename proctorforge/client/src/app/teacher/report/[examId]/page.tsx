'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import gsap from 'gsap';
import { useAuthStore } from '@/stores/authStore';
import { DashboardLayout } from '@/components/DashboardLayout';
import { examsAPI, attemptsAPI, authAPI } from '@/lib/api';

/* ─── Types ─── */
interface Student {
    id: string; name: string; email: string;
    gender?: string; register_number?: string;
}
interface Attempt {
    id: string; student_id: string; exam_id: string;
    status: 'not_started' | 'in_progress' | 'submitted' | 'flagged';
    score?: number; started_at?: string; submitted_at?: string;
    malpractice_flags?: number;
}
interface Exam {
    id: string; title: string; type: string;
    assigned_class?: string; assigned_year?: string; assigned_section?: string;
    duration_minutes?: number; passing_score?: number;
    start_time?: string; end_time?: string;
}

/* ─── Stat pill ─── */
function StatPill({ label, value, color, icon, delay = 0 }: {
    label: string; value: number; color: string; icon: React.ReactNode; delay?: number;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const numRef = useRef<HTMLSpanElement>(null);
    const obj = useRef({ v: 0 });

    useEffect(() => {
        if (!ref.current) return;
        gsap.fromTo(ref.current, { y: 30, opacity: 0, scale: 0.9 }, { y: 0, opacity: 1, scale: 1, duration: 0.6, delay, ease: 'back.out(1.4)' });
        gsap.to(obj.current, { v: value, duration: 1.2, delay: delay + 0.2, ease: 'power2.out', onUpdate: () => { if (numRef.current) numRef.current.textContent = Math.round(obj.current.v).toString(); } });
    }, [value, delay]);

    return (
        <div ref={ref} className="rounded-2xl p-5 relative overflow-hidden group"
            style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}25` }}>
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: `radial-gradient(circle at 50% 50%, ${color}10, transparent)` }} />
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: `${color}18`, border: `1px solid ${color}28` }}>
                <div style={{ color }}>{icon}</div>
            </div>
            <span ref={numRef} className="text-3xl font-black text-white">0</span>
            <p className="text-xs text-slate-500 mt-1 font-semibold uppercase tracking-widest">{label}</p>
        </div>
    );
}

const statusConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
    submitted: { label: 'Submitted', color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.25)' },
    in_progress: { label: 'In Progress', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)' },
    not_started: { label: 'Not Started', color: '#64748b', bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.25)' },
    flagged: { label: 'Malpractice', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.25)' },
};

/* ═══════════════════════════════════════════════
   EXAM REPORT PAGE
═══════════════════════════════════════════════ */
export default function ExamReportPage() {
    const { user, loadFromStorage } = useAuthStore();
    const params = useParams();
    const router = useRouter();
    const examId = params?.examId as string;

    const [exam, setExam] = useState<Exam | null>(null);
    const [students, setStudents] = useState<Student[]>([]);
    const [attempts, setAttempts] = useState<Attempt[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdate, setLastUpdate] = useState(new Date());
    const [search, setSearch] = useState('');
    const [filterStatus, setFilter] = useState<string>('all');

    const headerRef = useRef<HTMLDivElement>(null);
    const role = user?.role || 'teacher';

    useEffect(() => { loadFromStorage(); }, [loadFromStorage]);
    useEffect(() => {
        if (user && user.role !== 'teacher' && user.role !== 'admin') router.push('/login');
    }, [user, router]);

    useEffect(() => {
        if (headerRef.current) gsap.fromTo(headerRef.current, { y: -30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: 'power3.out' });
    }, []);

    /* ── fetch data ── */
    const fetchData = useCallback(async () => {
        if (!examId || !user) return;
        try {
            const [examRes, studRes] = await Promise.allSettled([
                examsAPI.get(examId),
                authAPI.listUsers('student'),
            ]);

            const examData: Exam = examRes.status === 'fulfilled' ? (examRes.value.data?.exam || examRes.value.data) : {};
            const studentList: Student[] = studRes.status === 'fulfilled' ? (studRes.value.data?.users || studRes.value.data || []) : [];

            /* try to get assignments to filter to assigned students */
            let assignedIds: string[] = [];
            try {
                const aRes = await examsAPI.getAssignments(examId);
                const aData = aRes.data?.assignments || aRes.data || [];
                assignedIds = aData.map((a: any) => a.student_id || a.id);
            } catch { /* fallback: use class filter from exam */ }

            /* filter students: assigned → or by class/year/section */
            let relevant = studentList;
            if (assignedIds.length > 0) {
                relevant = studentList.filter((s) => assignedIds.includes(s.id));
            } else if (examData.assigned_class) {
                relevant = studentList.filter((s: any) =>
                    (!examData.assigned_class || (s.class_name || '').toLowerCase().includes((examData.assigned_class || '').toLowerCase())) &&
                    (!examData.assigned_year || s.year === examData.assigned_year) &&
                    (!examData.assigned_section || s.section === examData.assigned_section)
                );
            }

            /* get attempts */
            let attemptList: Attempt[] = [];
            try {
                const attRes = await attemptsAPI.list();
                attemptList = (attRes.data?.attempts || attRes.data || []).filter((a: Attempt) => a.exam_id === examId);
            } catch { }

            /* build attempt map: student → attempt status */
            const attemptMap = new Map<string, Attempt>();
            for (const a of attemptList) attemptMap.set(a.student_id, a);

            /* ensure every relevant student has an entry */
            const fullAttempts: Attempt[] = relevant.map((s) =>
                attemptMap.get(s.id) || { id: '', student_id: s.id, exam_id: examId, status: 'not_started', malpractice_flags: 0 }
            );

            setExam(examData);
            setStudents(relevant);
            setAttempts(fullAttempts);
            setLastUpdate(new Date());
        } catch (err) {
            console.error('Report fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, [examId, user]);

    useEffect(() => {
        if (!user) return;
        fetchData();
        const iv = setInterval(fetchData, 10000); // real-time every 10s
        return () => clearInterval(iv);
    }, [user, fetchData]);

    /* ── computed stats ── */
    const total = students.length;
    const submitted = attempts.filter((a) => a.status === 'submitted').length;
    const inProgress = attempts.filter((a) => a.status === 'in_progress').length;
    const notStarted = attempts.filter((a) => a.status === 'not_started').length;
    const flagged = attempts.filter((a) => a.status === 'flagged' || (a.malpractice_flags ?? 0) > 0).length;
    const boys = students.filter((s: any) => (s.gender || '').toLowerCase() === 'male').length;
    const girls = students.filter((s: any) => (s.gender || '').toLowerCase() === 'female').length;
    const avgScore = submitted > 0
        ? Math.round(attempts.filter((a) => a.status === 'submitted' && a.score != null).reduce((s, a) => s + (a.score || 0), 0) / submitted)
        : 0;

    /* ── merged table rows ── */
    const rows = students.map((s) => {
        const att = attempts.find((a) => a.student_id === s.id);
        return { student: s, attempt: att };
    });

    const filtered = rows.filter(({ student, attempt }) => {
        const matchSearch = !search || student.name?.toLowerCase().includes(search.toLowerCase()) || student.email?.toLowerCase().includes(search.toLowerCase()) || (student.register_number || '').includes(search);
        const matchFilter = filterStatus === 'all' || (attempt?.status || 'not_started') === filterStatus;
        return matchSearch && matchFilter;
    });

    if (!user) return null;

    return (
        <DashboardLayout role={role as any}>
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div ref={headerRef} className="flex items-start justify-between flex-wrap gap-4">
                    <div>
                        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-white transition-colors mb-3">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                            Back
                        </button>
                        <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest mb-1">Exam Report</p>
                        <h1 className="text-2xl font-black text-white">{exam?.title || 'Loading…'}</h1>
                        {exam && (
                            <p className="text-xs text-slate-500 mt-1">
                                {exam.type === 'coding' ? '💻 Coding' : '📝 MCQ'}
                                {exam.assigned_class && ` · ${exam.assigned_class} · ${exam.assigned_year} · Section ${exam.assigned_section}`}
                                {exam.duration_minutes && ` · ${exam.duration_minutes} min`}
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-green-500/20 text-xs font-semibold text-green-400" style={{ background: 'rgba(16,185,129,0.06)' }}>
                        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                        Live · {lastUpdate.toLocaleTimeString()}
                    </div>
                </div>

                {/* Stats grid */}
                {loading ? (
                    <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
                ) : (
                    <>
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
                            <div className="col-span-2 sm:col-span-4 lg:col-span-2 grid grid-cols-2 gap-4">
                                <StatPill delay={0.00} label="Total" value={total} color="#7c3aed" icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197" /></svg>} />
                                <StatPill delay={0.06} label="Boys" value={boys} color="#22d3ee" icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>} />
                            </div>
                            <div className="col-span-2 sm:col-span-4 lg:col-span-2 grid grid-cols-2 gap-4">
                                <StatPill delay={0.12} label="Girls" value={girls} color="#f472b6" icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>} />
                                <StatPill delay={0.18} label="Submitted" value={submitted} color="#10b981" icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
                            </div>
                            <div className="col-span-2 sm:col-span-4 lg:col-span-2 grid grid-cols-2 gap-4">
                                <StatPill delay={0.24} label="In Progress" value={inProgress} color="#f59e0b" icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
                                <StatPill delay={0.30} label="Not Started" value={notStarted} color="#64748b" icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>} />
                            </div>
                            <div className="col-span-2 sm:col-span-4 lg:col-span-2 grid grid-cols-2 gap-4">
                                <StatPill delay={0.36} label="Malpractice" value={flagged} color="#ef4444" icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>} />
                                <StatPill delay={0.42} label="Avg Score" value={avgScore} color="#a855f7" icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>} />
                            </div>
                        </div>

                        {/* Progress bar */}
                        {total > 0 && (
                            <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Completion Progress</span>
                                    <span className="text-xs font-bold text-white">{Math.round((submitted / total) * 100)}%</span>
                                </div>
                                <div className="h-3 rounded-full bg-white/[0.06] overflow-hidden flex">
                                    <div className="h-full transition-all duration-700 rounded-l-full" style={{ width: `${(submitted / total) * 100}%`, background: '#10b981' }} />
                                    <div className="h-full transition-all duration-700" style={{ width: `${(inProgress / total) * 100}%`, background: '#f59e0b' }} />
                                    <div className="h-full transition-all duration-700" style={{ width: `${(flagged / total) * 100}%`, background: '#ef4444' }} />
                                </div>
                                <div className="flex gap-4 mt-2.5">
                                    {[['#10b981', 'Submitted'], ['#f59e0b', 'In Progress'], ['#64748b', 'Not Started'], ['#ef4444', 'Malpractice']].map(([c, l]) => (
                                        <div key={l} className="flex items-center gap-1.5 text-xs text-slate-500"><div className="w-2 h-2 rounded-full" style={{ background: c }} />{l}</div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Table filters */}
                        <div className="flex items-center justify-between flex-wrap gap-3">
                            <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                {['all', 'submitted', 'in_progress', 'not_started', 'flagged'].map((f) => (
                                    <button key={f} onClick={() => setFilter(f)}
                                        className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
                                        style={{
                                            background: filterStatus === f ? 'rgba(124,58,237,0.2)' : 'transparent',
                                            color: filterStatus === f ? '#a78bfa' : '#475569',
                                            border: filterStatus === f ? '1px solid rgba(124,58,237,0.3)' : '1px solid transparent',
                                        }}>
                                        {f === 'all' ? 'All' : f === 'not_started' ? 'Not Started' : f === 'in_progress' ? 'In Progress' : f === 'flagged' ? 'Malpractice' : 'Submitted'}
                                    </button>
                                ))}
                            </div>
                            <div className="relative">
                                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                <input type="text" placeholder="Search name / email / reg no." value={search} onChange={(e) => setSearch(e.target.value)}
                                    className="pl-9 pr-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-xs placeholder-slate-600 focus:outline-none focus:border-brand-500/50 w-64 transition-all" />
                            </div>
                        </div>

                        {/* Student table */}
                        <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div className="grid grid-cols-12 px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-widest" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                <div className="col-span-4">Student</div>
                                <div className="col-span-2">Register No.</div>
                                <div className="col-span-1">Gender</div>
                                <div className="col-span-2">Status</div>
                                <div className="col-span-1 text-center">Score</div>
                                <div className="col-span-2 text-right">Submitted At</div>
                            </div>

                            {filtered.length === 0 ? (
                                <div className="px-6 py-10 text-center text-slate-600 text-sm">
                                    {search || filterStatus !== 'all' ? 'No matching students' : 'No students assigned to this exam yet'}
                                </div>
                            ) : (
                                filtered.map(({ student, attempt }, i) => {
                                    const st = attempt?.status || 'not_started';
                                    const cfg = statusConfig[st] || statusConfig.not_started;
                                    const isMalpractice = st === 'flagged' || (attempt?.malpractice_flags ?? 0) > 0;
                                    return (
                                        <div key={student.id} className="grid grid-cols-12 items-center px-5 py-4 hover:bg-white/[0.02] transition-colors"
                                            style={{ borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
                                            <div className="col-span-4 flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black text-white flex-shrink-0" style={{ background: isMalpractice ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #7c3aed, #a855f7)' }}>
                                                    {student.name?.charAt(0)?.toUpperCase() || '?'}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-semibold text-white truncate">{student.name}</p>
                                                    <p className="text-[10px] text-slate-600 truncate">{student.email}</p>
                                                </div>
                                            </div>
                                            <div className="col-span-2 text-xs text-slate-500 font-mono">{(student as any).register_number || '—'}</div>
                                            <div className="col-span-1 text-xs text-slate-500 capitalize">{(student as any).gender || '—'}</div>
                                            <div className="col-span-2">
                                                <span className="text-[10px] px-2.5 py-1 rounded-lg font-bold border" style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}>
                                                    {isMalpractice ? `⚠ ${attempt?.malpractice_flags} flag(s)` : cfg.label}
                                                </span>
                                            </div>
                                            <div className="col-span-1 text-center">
                                                <span className="text-xs font-bold" style={{ color: attempt?.score != null ? '#10b981' : '#475569' }}>
                                                    {attempt?.score != null ? `${attempt.score}%` : '—'}
                                                </span>
                                            </div>
                                            <div className="col-span-2 text-right text-[10px] text-slate-600">
                                                {attempt?.submitted_at ? new Date(attempt.submitted_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </>
                )}
            </div>
        </DashboardLayout>
    );
}
