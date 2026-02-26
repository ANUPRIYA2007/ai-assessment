'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import gsap from 'gsap';
import { useAuthStore } from '@/stores/authStore';
import { DashboardLayout } from '@/components/DashboardLayout';
import { examsAPI, authAPI } from '@/lib/api';

const inputClass = 'w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-slate-600 text-sm focus:outline-none focus:border-brand-500/60 focus:ring-1 focus:ring-brand-500/30 transition-all';
const labelClass = 'block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2';
const selectClass = `${inputClass} appearance-none cursor-pointer`;

const OPTION_COLORS = ['#7c3aed', '#22d3ee', '#f59e0b', '#10b981'];
const OPTION_LABELS = ['A', 'B', 'C', 'D'];

interface Question {
  id: number; text: string; options: string[];
  correctOption: number; marks: number;
}

export default function CreateMCQTest() {
  const { user, loadFromStorage } = useAuthStore();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  /* ─ basic form ─ */
  const [title, setTitle] = useState('');
  const [description, setDesc] = useState('');
  const [duration, setDuration] = useState(60);
  const [startTime, setStart] = useState('');
  const [endTime, setEnd] = useState('');
  const [passing, setPassing] = useState(60);

  /* ─ assignment ─ */
  const [className, setClassName] = useState('');
  const [year, setYear] = useState('');
  const [section, setSection] = useState('');
  const [classes, setClasses] = useState<any[]>([]);

  /* ─ questions ─ */
  const [questions, setQuestions] = useState<Question[]>([{ id: 1, text: '', options: ['', '', '', ''], correctOption: 0, marks: 1 }]);
  const [currentQIdx, setCurrentQIdx] = useState(0);

  /* ─ submit state ─ */
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { loadFromStorage(); }, [loadFromStorage]);
  useEffect(() => { if (user && user.role !== 'teacher') router.push(`/${user.role}/dashboard`); }, [user, router]);
  useEffect(() => {
    if (containerRef.current) gsap.fromTo(containerRef.current, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' });
    const saved = localStorage.getItem('testguard_classes');
    if (saved) setClasses(JSON.parse(saved));
  }, []);

  const currentQ = questions[currentQIdx];

  const updateQ = (field: string, value: any) => {
    setQuestions((prev) => prev.map((q, i) => i === currentQIdx ? { ...q, [field]: value } : q));
  };

  const updateOption = (oi: number, val: string) => {
    const opts = [...currentQ.options]; opts[oi] = val;
    updateQ('options', opts);
  };

  const addQuestion = () => {
    const newQ: Question = { id: questions.length + 1, text: '', options: ['', '', '', ''], correctOption: 0, marks: 1 };
    setQuestions((prev) => [...prev, newQ]);
    setCurrentQIdx(questions.length);
    setTimeout(() => gsap.fromTo('.q-editor', { x: 20, opacity: 0 }, { x: 0, opacity: 1, duration: 0.3 }), 50);
  };

  const deleteQ = (idx: number) => {
    if (questions.length <= 1) return;
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
    setCurrentQIdx(Math.min(currentQIdx, questions.length - 2));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!title.trim() || !startTime || !endTime) { setError('Fill in title, start and end time'); return; }
    if (!className || !year || !section) { setError('Select class, year and section to assign'); return; }
    if (questions.some((q) => !q.text.trim() || q.options.some((o) => !o.trim()))) {
      setError('All questions and options must be filled'); return;
    }

    setSubmitting(true);
    try {
      /* build payload */
      const payload = {
        title: title.trim(),
        description: description.trim(),
        type: 'mcq',
        status: 'active',
        duration_minutes: duration,
        start_time: startTime,
        end_time: endTime,
        passing_score: passing,
        assigned_class: className,
        assigned_year: year,
        assigned_section: section,
        questions: questions.map((q) => ({
          question_text: q.text,
          question_type: 'mcq',
          options: q.options.map((o, i) => ({ text: o, is_correct: i === q.correctOption })),
          marks: q.marks,
          correct_option: q.correctOption,
        })),
      };

      const res = await examsAPI.create(payload);
      const examId = res.data?.id || res.data?.exam?.id;

      /* assign to all students matching class+year+section */
      if (examId) {
        try {
          const studRes = await authAPI.listUsers('student');
          const students: any[] = studRes.data?.users || studRes.data || [];
          const matching = students.filter((s: any) =>
            (!s.class_name || s.class_name === className) &&
            (!s.year || s.year === year) &&
            (!s.section || s.section === section)
          );
          if (matching.length > 0) {
            await examsAPI.assign(examId, matching.map((s: any) => s.id));
          }
        } catch { /* assignment optional if backend doesn't support filtering */ }
      }

      router.push('/teacher/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to create exam. Check server connection.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user || user.role !== 'teacher') return null;

  return (
    <DashboardLayout role="teacher">
      <div ref={containerRef} className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest mb-2">Create Assessment</p>
          <h1 className="text-3xl font-black text-white">New <span className="text-gradient">MCQ Test</span></h1>
          <p className="text-slate-500 text-sm mt-1">Build questions, assign to a class, and schedule</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl border border-red-500/20 text-red-400 text-sm flex items-center gap-3" style={{ background: 'rgba(239,68,68,0.06)' }}>
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-12 gap-6">

          {/* ── LEFT: Test config ── */}
          <div className="col-span-12 lg:col-span-5 space-y-5">

            {/* Basic Info */}
            <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <h2 className="text-sm font-bold text-white uppercase tracking-widest mb-5 flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-brand-700/30 text-brand-400 flex items-center justify-center text-xs">ℹ</span>
                Test Info
              </h2>
              <div className="space-y-4">
                <div><label className={labelClass}>Title *</label><input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Chapter 5 — Organic Chemistry" className={inputClass} required /></div>
                <div><label className={labelClass}>Description</label><textarea rows={2} value={description} onChange={(e) => setDesc(e.target.value)} placeholder="What does this test cover?" className={`${inputClass} resize-none`} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={labelClass}>Duration (min)</label><input type="number" min={5} max={480} value={duration} onChange={(e) => setDuration(+e.target.value)} className={inputClass} /></div>
                  <div><label className={labelClass}>Passing (%)</label><input type="number" min={0} max={100} value={passing} onChange={(e) => setPassing(+e.target.value)} className={inputClass} /></div>
                </div>
              </div>
            </div>

            {/* Schedule */}
            <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <h2 className="text-sm font-bold text-white uppercase tracking-widest mb-5 flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-cyan-700/30 text-cyan-400 flex items-center justify-center text-xs">📅</span>
                Schedule
              </h2>
              <div className="space-y-4">
                <div><label className={labelClass}>Start Time *</label><input type="datetime-local" value={startTime} onChange={(e) => setStart(e.target.value)} className={inputClass} required /></div>
                <div><label className={labelClass}>End Time *</label><input type="datetime-local" value={endTime} onChange={(e) => setEnd(e.target.value)} className={inputClass} required /></div>
              </div>
            </div>

            {/* Class Assignment */}
            <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(124,58,237,0.2)' }}>
              <h2 className="text-sm font-bold text-white uppercase tracking-widest mb-2 flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-brand-700/30 text-brand-400 flex items-center justify-center text-xs">🏫</span>
                Assign To Class *
              </h2>
              <p className="text-xs text-slate-600 mb-5">All students in this class will be assigned this test</p>
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>Class Name *</label>
                  {classes.length > 0 ? (
                    <select value={className} onChange={(e) => setClassName(e.target.value)} className={selectClass} style={{ background: '#0d0d1a' }}>
                      <option value="">Select class…</option>
                      {[...new Set(classes.map((c) => c.name))].map((n) => <option key={n as string} value={n as string}>{n as string}</option>)}
                    </select>
                  ) : (
                    <input type="text" value={className} onChange={(e) => setClassName(e.target.value)} placeholder="e.g. Computer Science" className={inputClass} />
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Year *</label>
                    <select value={year} onChange={(e) => setYear(e.target.value)} className={selectClass} style={{ background: '#0d0d1a' }}>
                      <option value="">Select…</option>
                      {['1st', '2nd', '3rd', '4th', '5th'].map((y) => <option key={y} value={y}>{y} Year</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Section *</label>
                    <input type="text" value={section} onChange={(e) => setSection(e.target.value)} placeholder="A, B, C…" className={inputClass} />
                  </div>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="rounded-2xl p-5" style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.15)' }}>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Summary</p>
              <div className="space-y-2 text-xs">
                {[
                  ['Questions', questions.length],
                  ['Total Marks', questions.reduce((s, q) => s + q.marks, 0)],
                  ['Duration', `${duration} min`],
                  ['Passing Score', `${passing}%`],
                  ['Assigned To', className ? `${className} · ${year} · Section ${section}` : '—'],
                ].map(([k, v]) => (
                  <div key={String(k)} className="flex items-center justify-between">
                    <span className="text-slate-600">{k}</span>
                    <span className="font-bold text-white">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── RIGHT: Questions ── */}
          <div className="col-span-12 lg:col-span-7 space-y-5">
            <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-sm font-bold text-white uppercase tracking-widest">Questions ({questions.length})</h2>
                <button type="button" onClick={addQuestion}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
                  onMouseEnter={(e) => gsap.to(e.currentTarget, { scale: 1.04, duration: 0.2 })}
                  onMouseLeave={(e) => gsap.to(e.currentTarget, { scale: 1, duration: 0.2 })}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Add Question
                </button>
              </div>

              {/* Question tabs */}
              <div className="flex flex-wrap gap-2 mb-5 pb-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                {questions.map((q, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <button type="button" onClick={() => setCurrentQIdx(i)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                      style={{
                        background: currentQIdx === i ? 'rgba(124,58,237,0.25)' : 'rgba(255,255,255,0.05)',
                        color: currentQIdx === i ? '#a78bfa' : '#64748b',
                        border: `1px solid ${currentQIdx === i ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.08)'}`,
                      }}>
                      Q{i + 1}
                    </button>
                    {questions.length > 1 && (
                      <button type="button" onClick={() => deleteQ(i)} className="w-4 h-4 flex items-center justify-center rounded text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all text-xs">×</button>
                    )}
                  </div>
                ))}
              </div>

              {/* Question editor */}
              <div className="q-editor space-y-5">
                <div>
                  <label className={labelClass}>Question {currentQIdx + 1} *</label>
                  <textarea rows={3} value={currentQ.text} onChange={(e) => updateQ('text', e.target.value)}
                    placeholder="Type the question…" className={`${inputClass} resize-none`} />
                </div>

                <div>
                  <label className={labelClass}>Options — click radio to mark correct answer</label>
                  <div className="space-y-2.5">
                    {currentQ.options.map((opt, oi) => (
                      <div key={oi} className="flex items-center gap-3">
                        <button type="button" onClick={() => updateQ('correctOption', oi)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0 transition-all"
                          style={{
                            background: currentQ.correctOption === oi ? `${OPTION_COLORS[oi]}25` : 'rgba(255,255,255,0.06)',
                            color: currentQ.correctOption === oi ? OPTION_COLORS[oi] : '#475569',
                            border: `2px solid ${currentQ.correctOption === oi ? OPTION_COLORS[oi] : 'transparent'}`,
                          }}>
                          {currentQ.correctOption === oi ? '✓' : OPTION_LABELS[oi]}
                        </button>
                        <input type="text" value={opt} onChange={(e) => updateOption(oi, e.target.value)}
                          placeholder={`Option ${OPTION_LABELS[oi]}`}
                          className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder-slate-600 focus:outline-none focus:border-brand-500/50 transition-all"
                          style={{ borderColor: currentQ.correctOption === oi ? `${OPTION_COLORS[oi]}40` : undefined }} />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1"><label className={labelClass}>Marks</label><input type="number" min={1} value={currentQ.marks} onChange={(e) => updateQ('marks', +e.target.value)} className={inputClass} /></div>
                  <div className="pt-5 text-xs text-slate-600">
                    Correct: <span className="font-bold" style={{ color: OPTION_COLORS[currentQ.correctOption] }}>{OPTION_LABELS[currentQ.correctOption]}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Action buttons ── */}
          <div className="col-span-12 flex items-center justify-between gap-4 pt-2">
            <button type="button" onClick={() => router.back()}
              className="px-6 py-3 rounded-xl text-sm font-bold text-slate-400 border border-white/10 hover:bg-white/5 transition-all">
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              className="flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
              onMouseEnter={(e) => !submitting && gsap.to(e.currentTarget, { scale: 1.03, boxShadow: '0 8px 25px rgba(124,58,237,0.5)', duration: 0.2 })}
              onMouseLeave={(e) => gsap.to(e.currentTarget, { scale: 1, boxShadow: 'none', duration: 0.2 })}>
              {submitting ? (
                <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Creating…</>
              ) : (
                <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Create &amp; Assign Test</>
              )}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
