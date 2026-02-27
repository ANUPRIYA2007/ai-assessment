'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import gsap from 'gsap';
import { useAuthStore } from '@/stores/authStore';
import { DashboardLayout } from '@/components/DashboardLayout';
import { examsAPI, authAPI } from '@/lib/api';
import { Leaderboard } from '@/components/Leaderboard';

/* ── Animated stat card ── */
function StatCard({ icon, label, value, color, delay = 0 }: {
  icon: React.ReactNode; label: string; value: number; color: string; delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const numRef = useRef<HTMLSpanElement>(null);
  const obj = useRef({ v: 0 });

  useEffect(() => {
    if (!ref.current) return;
    gsap.fromTo(ref.current,
      { y: 50, opacity: 0, rotateX: -20 },
      { y: 0, opacity: 1, rotateX: 0, duration: 0.9, delay, ease: 'power3.out', transformPerspective: 800, transformOrigin: 'center bottom' }
    );
    gsap.to(obj.current, {
      v: value, duration: 1.8, delay: delay + 0.3, ease: 'power2.out',
      onUpdate: () => { if (numRef.current) numRef.current.textContent = Math.round(obj.current.v).toString(); }
    });
  }, [value, delay]);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => { const r = e.currentTarget.getBoundingClientRect(); gsap.to(e.currentTarget, { rotateY: ((e.clientX - r.left) / r.width - 0.5) * 14, rotateX: -((e.clientY - r.top) / r.height - 0.5) * 14, duration: 0.3, transformPerspective: 900 }); };
  const onLeave = (e: React.MouseEvent<HTMLDivElement>) => gsap.to(e.currentTarget, { rotateY: 0, rotateX: 0, duration: 0.7, ease: 'elastic.out(1,0.4)' });

  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave}
      className="rounded-2xl p-6 relative overflow-hidden group cursor-default"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', transformStyle: 'preserve-3d', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{ background: `radial-gradient(circle at 50% 50%, ${color}12, transparent 70%)` }} />
      <div className="mb-4 w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: `${color}18`, border: `1px solid ${color}28` }}>
        <div style={{ color }}>{icon}</div>
      </div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">{label}</p>
      <span ref={numRef} className="text-4xl font-black text-white">0</span>
      <div className="absolute bottom-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
    </div>
  );
}

interface Exam { id: string; title: string; type: string; status: string; start_time?: string; assigned_class?: string; assigned_year?: string; assigned_section?: string; }

const statusColor: Record<string, { bg: string; color: string }> = {
  active: { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
  completed: { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6' },
  draft: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
  cancelled: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444' },
};

export default function TeacherDashboard() {
  const { user, loadFromStorage } = useAuthStore();
  const router = useRouter();
  const headerRef = useRef<HTMLDivElement>(null);

  const [exams, setExams] = useState<Exam[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Question management state
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [examQuestions, setExamQuestions] = useState<any[]>([]);
  const [showQuestionPanel, setShowQuestionPanel] = useState(false);
  const [questionForm, setQuestionForm] = useState({
    type: 'mcq' as 'mcq' | 'coding',
    question_text: '',
    language: 'python',
    options: [
      { label: 'A', text: '', is_correct: true },
      { label: 'B', text: '', is_correct: false },
      { label: 'C', text: '', is_correct: false },
      { label: 'D', text: '', is_correct: false },
    ],
    correct_answer: 'A',
    test_cases: [{ input: '', expected_output: '', is_hidden: false }],
    points: 10,
  });
  const [savingQuestion, setSavingQuestion] = useState(false);

  useEffect(() => { loadFromStorage(); }, [loadFromStorage]);
  useEffect(() => { if (user && user.role !== 'teacher') router.push(`/${user.role}/dashboard`); }, [user, router]);
  useEffect(() => {
    if (headerRef.current) gsap.fromTo(headerRef.current, { y: -30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out' });
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [examRes, studRes] = await Promise.allSettled([
        examsAPI.list(),
        authAPI.listUsers('student'),
      ]);
      if (examRes.status === 'fulfilled') setExams(examRes.value.data?.exams || examRes.value.data || []);
      if (studRes.status === 'fulfilled') setStudents(studRes.value.data?.users || studRes.value.data || []);
      setLastUpdate(new Date());
    } catch { }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!user || user.role !== 'teacher') return;
    fetchData();
    const iv = setInterval(fetchData, 5000); // 5s real-time polling
    return () => clearInterval(iv);
  }, [user, fetchData]);

  if (!user || user.role !== 'teacher') return null;

  const totalExams = exams.length;
  const activeExams = exams.filter((e) => e.status === 'active').length;
  const draftExams = exams.filter((e) => e.status === 'draft').length;
  const totalStudents = students.length;

  const recentExams = [...exams].sort((a, b) => new Date(b.start_time || 0).getTime() - new Date(a.start_time || 0).getTime()).slice(0, 8);

  const changeExamStatus = async (examId: string, newStatus: string) => {
    try {
      await examsAPI.update(examId, { status: newStatus });
      setExams(prev => prev.map(e => e.id === examId ? { ...e, status: newStatus } : e));
    } catch { alert('Failed to update exam status.'); }
  };

  const openQuestionPanel = async (examId: string) => {
    setSelectedExamId(examId);
    setShowQuestionPanel(true);
    try {
      const res = await examsAPI.getQuestions(examId);
      setExamQuestions(res.data || []);
    } catch { setExamQuestions([]); }
  };

  const resetQuestionForm = () => {
    setQuestionForm({
      type: 'mcq',
      question_text: '',
      language: 'python',
      options: [
        { label: 'A', text: '', is_correct: true },
        { label: 'B', text: '', is_correct: false },
        { label: 'C', text: '', is_correct: false },
        { label: 'D', text: '', is_correct: false },
      ],
      correct_answer: 'A',
      test_cases: [{ input: '', expected_output: '', is_hidden: false }],
      points: 10,
    });
  };

  const addQuestion = async () => {
    if (!selectedExamId || !questionForm.question_text.trim()) return;
    setSavingQuestion(true);
    try {
      const payload: any = {
        type: questionForm.type,
        question_text: questionForm.question_text,
        points: questionForm.points,
        order_index: examQuestions.length,
      };
      if (questionForm.type === 'mcq') {
        payload.options = questionForm.options;
        payload.correct_answer = questionForm.correct_answer;
      } else {
        payload.language = questionForm.language;
        payload.test_cases = questionForm.test_cases;
      }
      const res = await examsAPI.createQuestion(selectedExamId, payload);
      setExamQuestions(prev => [...prev, res.data]);
      resetQuestionForm();
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Failed to add question');
    } finally { setSavingQuestion(false); }
  };

  const deleteQuestion = async (qId: string) => {
    if (!selectedExamId || !confirm('Delete this question?')) return;
    try {
      await examsAPI.deleteQuestion(selectedExamId, qId);
      setExamQuestions(prev => prev.filter(q => q.id !== qId));
    } catch { alert('Failed to delete question'); }
  };

  return (
    <DashboardLayout role="teacher">
      <div className="max-w-7xl mx-auto space-y-10">
        {/* Header */}
        <div ref={headerRef} className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest mb-2">Instructor Portal</p>
            <h1 className="text-3xl font-black text-white leading-tight">
              Welcome back, <span className="text-gradient">{user.name?.split(' ')[0]}</span>!
            </h1>
            <p className="text-slate-500 text-sm mt-2">Manage assessments · All data refreshes every 15s</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl glass text-xs text-green-400 border border-green-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              {lastUpdate.toLocaleTimeString()}
            </div>
            <Link href="/teacher/create-mcq"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
              onMouseEnter={(e) => gsap.to(e.currentTarget, { scale: 1.04, boxShadow: '0 8px 25px rgba(124,58,237,0.5)', duration: 0.2 })}
              onMouseLeave={(e) => gsap.to(e.currentTarget, { scale: 1, boxShadow: 'none', duration: 0.2 })}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              New MCQ Test
            </Link>
            <Link href="/teacher/create-coding"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
              style={{ background: 'linear-gradient(135deg, #22d3ee, #0891b2)' }}
              onMouseEnter={(e) => gsap.to(e.currentTarget, { scale: 1.04, boxShadow: '0 8px 25px rgba(34,211,238,0.4)', duration: 0.2 })}
              onMouseLeave={(e) => gsap.to(e.currentTarget, { scale: 1, boxShadow: 'none', duration: 0.2 })}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
              New Coding Test
            </Link>
          </div>
        </div>

        {/* Real stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5" style={{ perspective: '1200px' }}>
          <StatCard delay={0.00} color="#7c3aed" label="Total Tests" value={totalExams}
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>} />
          <StatCard delay={0.08} color="#22d3ee" label="Students" value={totalStudents}
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>} />
          <StatCard delay={0.16} color="#10b981" label="Active Tests" value={activeExams}
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>} />
          <StatCard delay={0.24} color="#f59e0b" label="Draft Tests" value={draftExams}
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>} />
        </div>

        {/* Exams list */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-xl font-bold text-white">Your Tests</h2>
              <p className="text-xs text-slate-600 mt-1">Click &quot;Report&quot; to see the real-time student breakdown</p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : recentExams.length === 0 ? (
            <div className="rounded-2xl p-12 text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.06)' }}>
              <span className="text-4xl mb-4 block">📝</span>
              <p className="text-white font-semibold mb-2">No tests yet</p>
              <p className="text-slate-500 text-sm mb-5">Create your first MCQ or Coding assessment</p>
              <Link href="/teacher/create-mcq" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}>
                Create First Test
              </Link>
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              {/* Table header */}
              <div className="grid grid-cols-12 px-6 py-3 text-xs font-bold text-slate-600 uppercase tracking-widest" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div className="col-span-5">Test</div>
                <div className="col-span-3">Assigned To</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-2 text-right">Actions</div>
              </div>

              {recentExams.map((exam, idx) => (
                <div key={exam.id}
                  className="grid grid-cols-12 items-center px-6 py-4 group hover:bg-white/[0.02] transition-colors"
                  style={{ borderBottom: idx < recentExams.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                  <div className="col-span-5 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: exam.type === 'coding' ? 'rgba(34,211,238,0.12)' : 'rgba(124,58,237,0.12)', border: `1px solid ${exam.type === 'coding' ? 'rgba(34,211,238,0.2)' : 'rgba(124,58,237,0.2)'}` }}>
                      <span className="text-sm">{exam.type === 'coding' ? '💻' : '📝'}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate group-hover:text-brand-300 transition-colors">{exam.title}</p>
                      <p className="text-xs text-slate-600">{exam.type === 'coding' ? 'Coding Challenge' : 'MCQ Test'}{exam.start_time ? ` · ${new Date(exam.start_time).toLocaleDateString('en-IN')}` : ''}</p>
                    </div>
                  </div>
                  <div className="col-span-3">
                    {exam.assigned_class ? (
                      <div className="text-xs text-slate-400">
                        <span className="font-semibold text-white">{exam.assigned_class}</span>
                        <span className="text-slate-600"> · {exam.assigned_year} · Sec {exam.assigned_section}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-600">—</span>
                    )}
                  </div>
                  <div className="col-span-2">
                    <span className="text-xs font-semibold px-2.5 py-1.5 rounded-lg capitalize"
                      style={{ background: statusColor[exam.status]?.bg || 'rgba(255,255,255,0.06)', color: statusColor[exam.status]?.color || '#64748b' }}>
                      {exam.status || 'draft'}
                    </span>
                  </div>
                  <div className="col-span-2 flex items-center justify-end gap-1.5 flex-wrap">
                    {exam.status === 'draft' && (
                      <button onClick={() => changeExamStatus(exam.id, 'active')}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-emerald-400 border border-emerald-700/40 hover:bg-emerald-500/10 transition-all">
                        Activate
                      </button>
                    )}
                    {exam.status === 'active' && (
                      <button onClick={() => changeExamStatus(exam.id, 'completed')}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-yellow-400 border border-yellow-700/40 hover:bg-yellow-500/10 transition-all">
                        Complete
                      </button>
                    )}
                    <button onClick={() => openQuestionPanel(exam.id)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-cyan-400 border border-cyan-700/40 hover:bg-cyan-500/10 transition-all">
                      Questions
                    </button>
                    {exam.status === 'active' && (
                      <Link href={`/teacher/monitor/${exam.id}`}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-orange-400 border border-orange-700/40 hover:bg-orange-500/10 transition-all">
                        Live 🔴
                      </Link>
                    )}
                    <Link href={`/teacher/report/${exam.id}`}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-brand-400 hover:bg-brand-700/20 border border-brand-700/30 transition-all">
                      Report
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ══ Leaderboard for active exams ══ */}
        {exams.filter(e => e.status === 'active' || e.status === 'completed').length > 0 && (
          <div>
            <h2 className="text-xl font-bold text-white mb-4">Leaderboards</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {exams.filter(e => e.status === 'active' || e.status === 'completed').slice(0, 4).map(exam => (
                <Leaderboard key={exam.id} examId={exam.id} examTitle={exam.title} role="teacher" />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ══ Question Management Panel ══ */}
      {showQuestionPanel && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowQuestionPanel(false)} />

          {/* Panel */}
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-2xl overflow-y-auto"
            style={{ background: 'linear-gradient(180deg, #0d0d1a, #111122)', borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="p-6 space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-white">Manage Questions</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    {exams.find(e => e.id === selectedExamId)?.title} · {examQuestions.length} questions
                  </p>
                </div>
                <button onClick={() => setShowQuestionPanel(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 transition-all">
                  ✕
                </button>
              </div>

              {/* Existing Questions */}
              <div className="space-y-3">
                {examQuestions.map((q: any, i: number) => (
                  <div key={q.id} className="rounded-xl p-4 flex items-start gap-3"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ background: q.type === 'coding' ? 'rgba(34,211,238,0.15)' : 'rgba(124,58,237,0.15)', color: q.type === 'coding' ? '#22d3ee' : '#a78bfa' }}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{q.question_text}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase"
                          style={{ background: q.type === 'coding' ? 'rgba(34,211,238,0.12)' : 'rgba(124,58,237,0.12)', color: q.type === 'coding' ? '#22d3ee' : '#a78bfa' }}>
                          {q.type}
                        </span>
                        {q.language && <span className="text-[10px] text-slate-500">{q.language}</span>}
                        <span className="text-[10px] text-slate-500">{q.points} pts</span>
                      </div>
                    </div>
                    <button onClick={() => deleteQuestion(q.id)}
                      className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10 transition-all">
                      Delete
                    </button>
                  </div>
                ))}
                {examQuestions.length === 0 && (
                  <p className="text-center text-sm text-slate-600 py-8">No questions yet. Add your first question below.</p>
                )}
              </div>

              {/* Add Question Form */}
              <div className="rounded-2xl p-6" style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.15)' }}>
                <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                  <span className="text-brand-400">+</span> Add New Question
                </h3>

                <div className="space-y-4">
                  {/* Type selector */}
                  <div className="flex gap-2">
                    <button onClick={() => setQuestionForm(f => ({ ...f, type: 'mcq' }))}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${questionForm.type === 'mcq' ? 'bg-brand-600/30 text-brand-300 border border-brand-500/40' : 'bg-white/5 text-slate-500 border border-white/10'}`}>
                      📝 MCQ
                    </button>
                    <button onClick={() => setQuestionForm(f => ({ ...f, type: 'coding' }))}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${questionForm.type === 'coding' ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-500/40' : 'bg-white/5 text-slate-500 border border-white/10'}`}>
                      💻 Coding
                    </button>
                  </div>

                  {/* Question text */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Question *</label>
                    <textarea rows={3} value={questionForm.question_text}
                      onChange={(e) => setQuestionForm(f => ({ ...f, question_text: e.target.value }))}
                      placeholder="Enter question text..."
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder-slate-600 focus:outline-none focus:border-brand-500/60 transition-all resize-none" />
                  </div>

                  {/* Language selector (for coding) */}
                  {questionForm.type === 'coding' && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Language *</label>
                      <select value={questionForm.language}
                        onChange={(e) => setQuestionForm(f => ({ ...f, language: e.target.value }))}
                        className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-brand-500/60 transition-all"
                        style={{ background: '#0d0d1a' }}>
                        <option value="python">Python</option>
                        <option value="javascript">JavaScript</option>
                        <option value="java">Java</option>
                        <option value="cpp">C++</option>
                        <option value="c">C</option>
                        <option value="sql">SQL</option>
                        <option value="typescript">TypeScript</option>
                        <option value="ruby">Ruby</option>
                        <option value="go">Go</option>
                        <option value="rust">Rust</option>
                      </select>
                    </div>
                  )}

                  {/* MCQ Options */}
                  {questionForm.type === 'mcq' && (
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Options (click to mark correct)</label>
                      {questionForm.options.map((opt, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <button type="button"
                            onClick={() => {
                              const newOpts = questionForm.options.map((o, j) => ({ ...o, is_correct: j === i }));
                              setQuestionForm(f => ({ ...f, options: newOpts, correct_answer: opt.label }));
                            }}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0 transition-all"
                            style={{
                              background: opt.is_correct ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.06)',
                              color: opt.is_correct ? '#10b981' : '#475569',
                              border: `2px solid ${opt.is_correct ? '#10b981' : 'transparent'}`,
                            }}>
                            {opt.is_correct ? '✓' : opt.label}
                          </button>
                          <input type="text" value={opt.text}
                            onChange={(e) => {
                              const newOpts = [...questionForm.options];
                              newOpts[i] = { ...newOpts[i], text: e.target.value };
                              setQuestionForm(f => ({ ...f, options: newOpts }));
                            }}
                            placeholder={`Option ${opt.label}`}
                            className="flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder-slate-600 focus:outline-none focus:border-brand-500/50 transition-all" />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Coding Test Cases */}
                  {questionForm.type === 'coding' && (
                    <div className="space-y-3">
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Test Cases</label>
                      {questionForm.test_cases.map((tc, i) => (
                        <div key={i} className="grid grid-cols-2 gap-2 p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
                          <div>
                            <label className="text-[10px] text-slate-500 mb-1 block">Input</label>
                            <textarea rows={2} value={tc.input}
                              onChange={(e) => {
                                const tcs = [...questionForm.test_cases];
                                tcs[i] = { ...tcs[i], input: e.target.value };
                                setQuestionForm(f => ({ ...f, test_cases: tcs }));
                              }}
                              className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-xs font-mono placeholder-slate-600 focus:outline-none resize-none"
                              placeholder="input..." />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500 mb-1 block">Expected Output</label>
                            <textarea rows={2} value={tc.expected_output}
                              onChange={(e) => {
                                const tcs = [...questionForm.test_cases];
                                tcs[i] = { ...tcs[i], expected_output: e.target.value };
                                setQuestionForm(f => ({ ...f, test_cases: tcs }));
                              }}
                              className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-xs font-mono placeholder-slate-600 focus:outline-none resize-none"
                              placeholder="output..." />
                          </div>
                        </div>
                      ))}
                      <button type="button"
                        onClick={() => setQuestionForm(f => ({
                          ...f, test_cases: [...f.test_cases, { input: '', expected_output: '', is_hidden: false }]
                        }))}
                        className="text-xs text-cyan-400 hover:text-cyan-300 transition-all">
                        + Add Test Case
                      </button>
                    </div>
                  )}

                  {/* Points */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Points</label>
                    <input type="number" min={1} value={questionForm.points}
                      onChange={(e) => setQuestionForm(f => ({ ...f, points: +e.target.value }))}
                      className="w-24 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-brand-500/60 transition-all" />
                  </div>

                  {/* Save button */}
                  <button onClick={addQuestion} disabled={savingQuestion || !questionForm.question_text.trim()}
                    className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}>
                    {savingQuestion ? 'Adding...' : `Add ${questionForm.type === 'mcq' ? 'MCQ' : 'Coding'} Question`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
