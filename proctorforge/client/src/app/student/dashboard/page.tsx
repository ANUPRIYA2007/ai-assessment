'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { examsAPI, attemptsAPI } from '@/lib/api';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Leaderboard } from '@/components/Leaderboard';
import gsap from 'gsap';

/* ── Stat card ── */
function StatCard({
  label, value, suffix = '', icon, color, delay = 0
}: {
  label: string; value: number; suffix?: string;
  icon: React.ReactNode; color: string; delay?: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const numberRef = useRef<HTMLSpanElement>(null);
  const countObj = useRef({ val: 0 });

  useEffect(() => {
    if (!cardRef.current) return;
    gsap.fromTo(cardRef.current,
      { y: 40, opacity: 0, rotateX: -15 },
      { y: 0, opacity: 1, rotateX: 0, duration: 0.8, delay, ease: 'power3.out' }
    );

    gsap.to(countObj.current, {
      val: value, duration: 1.6, delay: delay + 0.3, ease: 'power2.out',
      onUpdate: () => {
        if (numberRef.current) {
          numberRef.current.textContent = Math.round(countObj.current.val).toString();
        }
      },
    });
  }, [value, delay]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    gsap.to(e.currentTarget, {
      rotateY: x * 12,
      rotateX: -y * 12,
      transformPerspective: 800,
      duration: 0.3,
      ease: 'power2.out',
    });
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    gsap.to(e.currentTarget, {
      rotateY: 0, rotateX: 0, duration: 0.6, ease: 'elastic.out(1,0.5)',
    });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative rounded-2xl p-6 cursor-default overflow-hidden group"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        transformStyle: 'preserve-3d',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
      }}
    >
      {/* shimmer on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(circle at 50% 50%, ${color}10, transparent 70%)` }}
      />

      {/* icon */}
      <div className="mb-4 w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${color}15`, border: `1px solid ${color}25` }}>
        <div style={{ color }} className="w-6 h-6">{icon}</div>
      </div>

      <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">{label}</p>
      <div className="flex items-end gap-1">
        <span ref={numberRef} className="text-4xl font-black text-white">0</span>
        {suffix && <span className="text-xl font-bold mb-1" style={{ color }}>{suffix}</span>}
      </div>

      {/* bottom glow line */}
      <div className="absolute bottom-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
      />
    </div>
  );
}

/* ── Exam card ── */
function ExamCard({ exam, index, onStart, starting, isCompleted }: {
  exam: any; index: number; onStart: () => void; starting: boolean; isCompleted: boolean;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!cardRef.current) return;
    gsap.fromTo(cardRef.current,
      { y: 60, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.7, delay: 0.1 * index + 0.3, ease: 'power3.out' }
    );
  }, [index]);

  const isCoding  = exam.type === 'coding';
  const typeColor  = isCoding ? '#22d3ee' : '#a855f7';
  const typeBg     = isCoding ? 'rgba(34,211,238,0.12)' : 'rgba(168,85,247,0.12)';
  const typeBorder = isCoding ? 'rgba(34,211,238,0.25)' : 'rgba(168,85,247,0.25)';

  return (
    <div
      ref={cardRef}
      className="relative rounded-2xl p-6 group overflow-hidden flex flex-col justify-between min-h-[230px]"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div className="absolute top-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: 'linear-gradient(90deg,transparent,rgba(124,58,237,0.7),transparent)' }} />

      <div>
        {/* header row */}
        <div className="flex items-center justify-between mb-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest"
            style={{ background: typeBg, border: `1px solid ${typeBorder}`, color: typeColor }}>
            {isCoding ? '💻 Coding' : '📝 MCQ'}
          </span>
          <span className="text-[10px] font-semibold text-slate-600 px-2 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06]">
            ⏱ {exam.duration_minutes ?? 60} min
          </span>
        </div>
        <h4 className="text-base font-bold text-white mb-2 group-hover:text-purple-300 transition-colors leading-snug line-clamp-2">
          {exam.title}
        </h4>
        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
          {exam.description || 'No description provided for this assessment.'}
        </p>
      </div>

      <button
        onClick={onStart}
        disabled={starting || isCompleted}
        className="mt-5 w-full py-3 rounded-xl text-sm font-bold text-white transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
        style={{ background: isCompleted ? 'linear-gradient(135deg,#10b981,#059669)' : 'linear-gradient(135deg,#7c3aed,#a855f7)', boxShadow: isCompleted ? '0 4px 20px rgba(16,185,129,0.35)' : '0 4px 20px rgba(124,58,237,0.35)' }}
        onMouseEnter={e => { if (!starting && !isCompleted) gsap.to(e.currentTarget, { scale: 1.02, duration: 0.15 }); }}
        onMouseLeave={e => gsap.to(e.currentTarget, { scale: 1, duration: 0.15 })}
      >
        {isCompleted ? (
          <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>Test Completed</>
        ) : starting ? (
          <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Starting…</>
        ) : (
          <>Start Assessment <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5-5 5M6 12h12" /></svg></>
        )}
      </button>
    </div>
  );
}

export default function StudentDashboard() {
  const { user, loadFromStorage } = useAuthStore();
  const [exams, setExams]     = useState<any[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [completed, setCompleted] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [filter, setFilter]   = useState<'all' | 'mcq' | 'coding'>('all');
  const [search, setSearch]   = useState('');
  const [startingId, setStartingId] = useState<string | null>(null);
  const router    = useRouter();
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadFromStorage(); }, [loadFromStorage]);

  useEffect(() => {
    if (!user) return;
    if (user.role !== 'student') { router.replace(`/${user.role}/dashboard`); return; }
  }, [user, router]);

  // Redirect to login if no token after 2s
  useEffect(() => {
    const t = setTimeout(() => {
      if (!useAuthStore.getState().token) router.replace('/login');
    }, 2000);
    return () => clearTimeout(t);
  }, [router]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([
      examsAPI.list().catch(() => ({ data: [] })),
      attemptsAPI.list().catch(() => ({ data: [] })),
    ]).then(([examRes, attemptRes]) => {
      setExams((examRes as any).data || []);
      const attemptsData = (attemptRes as any).data || [];
      setAttempts(attemptsData);
      setCompleted(attemptsData.filter((a: any) => a.status === 'completed').length);
    }).catch(() => setError('Failed to load exams. Please refresh.'))
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    if (!headerRef.current) return;
    gsap.fromTo(headerRef.current, { y: -24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: 'power3.out' });
  }, []);

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const firstName = user.name?.split(' ')[0] ?? 'Student';
  const filtered  = exams.filter(e => {
    const matchType   = filter === 'all' || e.type === filter || (filter === 'mcq' && e.type !== 'coding');
    const matchSearch = !search || e.title.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  const handleStart = (exam: any) => {
    setStartingId(exam.id);
    router.push(`/exam/${exam.id}`);
  };

  const stats = [
    {
      label: 'Pending', value: exams.length, color: '#7c3aed',
      icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    },
    {
      label: 'Completed', value: completed, color: '#10b981',
      icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    },
    {
      label: 'MCQ Tests', value: exams.filter(e => e.type !== 'coding').length, color: '#a855f7',
      icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
    },
    {
      label: 'Coding Tests', value: exams.filter(e => e.type === 'coding').length, color: '#22d3ee',
      icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5"><polyline points="16 18 22 12 16 6" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}/><polyline points="8 6 2 12 8 18" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}/></svg>,
    },
  ];

  return (
    <DashboardLayout role="student">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* ── Header ── */}
        <div ref={headerRef} className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-1">Student Portal</p>
            <h1 className="text-3xl font-black text-white leading-tight">
              Welcome back, <span className="bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">{firstName}</span>!
            </h1>
            <p className="text-slate-500 text-sm mt-1">Your assessments are ready</p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/[0.07] bg-white/[0.03]">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold text-slate-400">AI Proctor Active</span>
          </div>
        </div>

        {/* ── Stats Grid ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s, i) => <StatCard key={i} delay={i * 0.07} {...s} />)}
        </div>

        {/* ── Exams Section ── */}
        <div>
          {/* Toolbar */}
          <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
            <div>
              <h2 className="text-lg font-bold text-white">Assigned Assessments</h2>
              <p className="text-[11px] text-slate-600 mt-0.5">{filtered.length} exam{filtered.length !== 1 ? 's' : ''} available</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {(['all', 'mcq', 'coding'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${
                    filter === f
                      ? 'bg-purple-600 text-white shadow-lg'
                      : 'text-slate-500 bg-white/[0.04] border border-white/[0.07] hover:border-white/20'
                  }`}>
                  {f === 'all' ? 'All' : f === 'mcq' ? '📝 MCQ' : '💻 Coding'}
                </button>
              ))}
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
                  className="pl-8 pr-3 py-1.5 rounded-lg text-xs bg-white/[0.04] border border-white/[0.07] text-white placeholder-slate-600 focus:outline-none focus:border-purple-500/40 w-40 transition-all" />
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl p-4 mb-4 text-sm text-red-400 border border-red-900/40 bg-red-500/10 flex items-center gap-3">
              ⚠ {error}
              <button onClick={() => window.location.reload()} className="ml-auto text-xs underline">Refresh</button>
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="rounded-2xl h-56 animate-pulse"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl py-20 text-center"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}>
              <div className="text-5xl mb-3">{search || filter !== 'all' ? '🔍' : '📋'}</div>
              <p className="text-slate-500 font-medium">
                {search || filter !== 'all' ? 'No exams match your filter' : 'No exams assigned yet'}
              </p>
              <p className="text-slate-700 text-xs mt-1">
                {search || filter !== 'all' ? 'Try clearing filters' : 'Check back later or contact your teacher'}
              </p>
              {(search || filter !== 'all') && (
                <button onClick={() => { setSearch(''); setFilter('all'); }}
                  className="mt-4 px-4 py-2 rounded-lg text-xs font-bold text-purple-400 border border-purple-700/40 hover:bg-purple-500/10 transition-all">
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((exam, i) => {
                const examCompleted = attempts.some((a: any) => a.exam_id === exam.id && a.status === 'completed');
                return (
                  <ExamCard
                    key={exam.id}
                    exam={exam}
                    index={i}
                    starting={startingId === exam.id}
                    isCompleted={examCompleted}
                    onStart={() => handleStart(exam)}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* ══ Leaderboard for completed/active exams ══ */}
        {exams.filter((e: any) => e.status === 'active' || e.status === 'completed').length > 0 && (
          <div>
            <h2 className="text-xl font-bold text-white mb-4">Leaderboards</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {exams.filter((e: any) => e.status === 'active' || e.status === 'completed').slice(0, 4).map((exam: any) => (
                <Leaderboard key={exam.id} examId={exam.id} examTitle={exam.title} role="student" />
              ))}
            </div>
          </div>
        )}

        {/* Proctoring info banner */}
        <div className="rounded-2xl p-5 flex items-start gap-4"
          style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.15)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(124,58,237,0.15)' }}>
            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-white">AI Proctoring Active</p>
            <p className="text-xs text-slate-500 mt-0.5">
              During the exam, your camera, microphone, and browser activity are monitored. Ensure you&apos;re in a quiet, well-lit environment with your face visible.
            </p>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
