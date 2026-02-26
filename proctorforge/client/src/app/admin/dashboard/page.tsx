'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import gsap from 'gsap';
import { useAuthStore } from '@/stores/authStore';
import { DashboardLayout } from '@/components/DashboardLayout';
import { authAPI, examsAPI, adminAPI } from '@/lib/api';

/* ───────────── Types ───────────── */
interface User { id: string; name: string; email: string; role: string; status: string; created_at: string; class_name?: string; year?: string; section?: string; gender?: string; }
interface Exam { id: string; title: string; type: string; status: string; start_time: string; end_time: string; assigned_class?: string; assigned_year?: string; assigned_section?: string; }
interface ClassItem { id: string; name: string; year: string; section: string; }

/* ───────────── Animated counter card ───────────── */
function MetricCard({ icon, label, value, color, delay = 0 }: { icon: React.ReactNode; label: string; value: number; color: string; delay?: number; }) {
  const ref = useRef<HTMLDivElement>(null);
  const numRef = useRef<HTMLSpanElement>(null);
  const obj = useRef({ v: 0 });
  useEffect(() => {
    if (!ref.current) return;
    gsap.fromTo(ref.current, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, delay, ease: 'power3.out' });
    gsap.to(obj.current, { v: value, duration: 1.4, delay: delay + 0.3, ease: 'power2.out', onUpdate: () => { if (numRef.current) numRef.current.textContent = Math.round(obj.current.v).toString(); } });
  }, [value, delay]);
  const hoverIn = (e: React.MouseEvent<HTMLDivElement>) => gsap.to(e.currentTarget, { y: -4, boxShadow: `0 20px 50px ${color}22`, duration: 0.25 });
  const hoverOut = (e: React.MouseEvent<HTMLDivElement>) => gsap.to(e.currentTarget, { y: 0, boxShadow: 'none', duration: 0.3 });
  return (
    <div ref={ref} onMouseEnter={hoverIn} onMouseLeave={hoverOut}
      className="rounded-2xl p-6 cursor-default relative overflow-hidden group transition-all"
      style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}20` }}>
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: `radial-gradient(circle at 30% 30%, ${color}0c, transparent)` }} />
      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: `${color}18`, border: `1px solid ${color}25` }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <span ref={numRef} className="text-4xl font-black text-white">0</span>
      <p className="text-xs text-slate-500 mt-1.5 font-semibold uppercase tracking-widest">{label}</p>
      <div className="absolute bottom-0 left-0 right-0 h-px opacity-40" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
    </div>
  );
}

/* ───────────── Glass modal ───────────── */
function Modal({ title, wide, onClose, children }: { title: string; wide?: boolean; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) gsap.fromTo(ref.current, { scale: 0.93, opacity: 0, y: -20 }, { scale: 1, opacity: 1, y: 0, duration: 0.35, ease: 'back.out(1.4)' }); }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)' }} onClick={onClose}>
      <div ref={ref} className={`w-full ${wide ? 'max-w-3xl' : 'max-w-md'} rounded-2xl overflow-hidden`} onClick={e => e.stopPropagation()}
        style={{ background: 'linear-gradient(135deg, #0f0f20, #090914)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 40px 100px rgba(0,0,0,0.8)' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <h3 className="text-base font-bold text-white">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.08] transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-6 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

const inputSt = 'w-full px-4 py-3 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none transition-all focus:ring-1 focus:ring-purple-500/40';
const inputStyle = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' };

const SC: Record<string, string> = { active: 'text-emerald-400 bg-emerald-500/10', inactive: 'text-red-400 bg-red-500/10', banned: 'text-red-500 bg-red-500/15', pending: 'text-amber-400 bg-amber-500/10' };
const EC: Record<string, string> = { active: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', completed: 'text-blue-400 bg-blue-500/10 border-blue-500/20', draft: 'text-amber-400 bg-amber-500/10 border-amber-500/20', cancelled: 'text-red-400 bg-red-500/10 border-red-500/20' };

/* ════════════════════════════════════════════
   ADMIN DASHBOARD
════════════════════════════════════════════ */
export default function AdminDashboard() {
  const { user, loadFromStorage } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = (searchParams?.get('tab') || 'overview') as 'overview' | 'classes' | 'students' | 'tests';

  const [students, setStudents] = useState<User[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(new Date());

  /* modals */
  const [classModal, setClassModal] = useState(false);
  const [classReport, setClassReport] = useState<ClassItem | null>(null);
  const [reschedule, setReschedule] = useState(false);
  const [selExam, setSelExam] = useState<Exam | null>(null);
  const [studentModal, setStudentModal] = useState<User | null>(null);
  const [studentReport, setStudentReport] = useState<any>(null);

  /* forms */
  const [newClass, setNewClass] = useState({ name: '', year: '', section: '' });
  const [newStudent, setNewStudent] = useState({
    name: '', email: '', password: '', gender: '', class_name: '', year: '', section: '', register_number: '',
  });
  const [addStudentModal, setAddStudentModal] = useState(false);
  const [rescData, setRescData] = useState({ start: '', end: '' });
  const [stuSearch, setStuSearch] = useState('');
  const [exSearch, setExSearch] = useState('');

  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadFromStorage(); }, [loadFromStorage]);
  useEffect(() => { if (user && user.role !== 'admin') router.push(`/${user.role}/dashboard`); }, [user, router]);
  useEffect(() => { if (headerRef.current) gsap.fromTo(headerRef.current, { y: -24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: 'power3.out' }); }, []);

  /* ── load classes from API or localStorage ── */
  useEffect(() => {
    const loadClasses = async () => {
      try {
        const r = await adminAPI.getClasses();
        const cl = r.data?.classes || r.data || [];
        if (cl.length > 0) { setClasses(cl); localStorage.setItem('testguard_classes', JSON.stringify(cl)); return; }
      } catch { /* fall through to localStorage */ }
      const saved = localStorage.getItem('testguard_classes');
      if (saved) setClasses(JSON.parse(saved));
    };
    loadClasses();
  }, []);

  /* ── fetch ── */
  const fetchAll = useCallback(async () => {
    try {
      const [sR, tR, eR] = await Promise.allSettled([authAPI.listUsers('student'), authAPI.listUsers('teacher'), examsAPI.list()]);
      const sl: User[] = sR.status === 'fulfilled' ? (sR.value.data?.users || sR.value.data || []) : [];
      const tl: User[] = tR.status === 'fulfilled' ? (tR.value.data?.users || tR.value.data || []) : [];
      const el: Exam[] = eR.status === 'fulfilled' ? (eR.value.data?.exams || eR.value.data || []) : [];
      setStudents(sl); setTeachers(tl); setExams(el);
      setRefresh(new Date());
    } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    fetchAll();
    const iv = setInterval(fetchAll, 15000);
    return () => clearInterval(iv);
  }, [user, fetchAll]);

  if (!user || user.role !== 'admin') return null;

  /* ── class student helpers ── */
  const studentsInClass = (cls: ClassItem) =>
    students.filter((s: any) =>
      (s.class_name || '').toLowerCase() === cls.name.toLowerCase() &&
      (s.year || '') === cls.year &&
      (s.section || '').toLowerCase() === cls.section.toLowerCase()
    );

  const examsForClass = (cls: ClassItem) =>
    exams.filter(e => e.assigned_class?.toLowerCase() === cls.name.toLowerCase() && e.assigned_year === cls.year && e.assigned_section?.toLowerCase() === cls.section.toLowerCase());

  /* ── handlers ── */
  const saveClass = async () => {
    if (!newClass.name.trim() || !newClass.year || !newClass.section.trim()) return;
    let newItem: ClassItem = { id: Date.now().toString(), ...newClass };
    try {
      const r = await adminAPI.createClass(newClass);
      newItem = r.data?.class || r.data || newItem;
    } catch { /* backend not available — use local id */ }
    const updated = [...classes, newItem];
    setClasses(updated); localStorage.setItem('testguard_classes', JSON.stringify(updated));
    setNewClass({ name: '', year: '', section: '' }); setClassModal(false);
  };

  const delClass = (id: string) => {
    const updated = classes.filter(c => c.id !== id);
    setClasses(updated); localStorage.setItem('testguard_classes', JSON.stringify(updated));
  };

  const delExam = async (id: string) => {
    if (!confirm('Delete this test? This cannot be undone.')) return;
    try { await examsAPI.delete(id); setExams(p => p.filter(e => e.id !== id)); } catch { alert('Failed — server unavailable.'); }
  };

  const doReschedule = async () => {
    if (!selExam) return;
    try { await examsAPI.reschedule(selExam.id, rescData.start, rescData.end); setExams(p => p.map(e => e.id === selExam.id ? { ...e, start_time: rescData.start, end_time: rescData.end } : e)); setReschedule(false); }
    catch { alert('Reschedule requires backend support.'); setReschedule(false); }
  };

  const openStudentModal = async (s: User) => {
    setStudentModal(s); setStudentReport(null);
    try { const r = await adminAPI.getStudentReport(s.id); setStudentReport(r.data); }
    catch { setStudentReport({ attempts: [], avg_score: 0, message: 'No report data yet' }); }
  };

  const handleAddStudent = async () => {
    if (!newStudent.name || !newStudent.email || !newStudent.password) {
      alert('Name, Email and Password are required');
      return;
    }
    try {
      await authAPI.register({ ...newStudent, role: 'student' });
      setAddStudentModal(false);
      setNewStudent({ name: '', email: '', password: '', gender: '', class_name: '', year: '', section: '', register_number: '' });
      fetchAll();
    } catch (err) {
      alert('Failed to add student. Email might already exist.');
    }
  };

  const delStudent = async (id: string, name: string) => {
    if (!confirm(`Remove ${name}? This cannot be undone.`)) return;
    try {
      await authAPI.deleteUser(id);
      setStudents(p => p.filter(s => s.id !== id));
    } catch { alert('Failed to remove student.'); }
  };

  const filteredStudents = students.filter(s => s.name?.toLowerCase().includes(stuSearch.toLowerCase()) || s.email?.toLowerCase().includes(stuSearch.toLowerCase()));
  const filteredExams = exams.filter(e => e.title?.toLowerCase().includes(exSearch.toLowerCase()));

  const activeExams = exams.filter(e => e.status === 'active').length;
  const draftExams = exams.filter(e => e.status === 'draft').length;
  const boys = students.filter((s: any) => (s.gender || '').toLowerCase() === 'male').length;
  const girls = students.filter((s: any) => (s.gender || '').toLowerCase() === 'female').length;

  /* ─── class report modal students ─── */
  const reportStudents = classReport ? studentsInClass(classReport) : [];
  const reportExams = classReport ? examsForClass(classReport) : [];
  const reportBoys = reportStudents.filter((s: any) => (s.gender || '').toLowerCase() === 'male').length;
  const reportGirls = reportStudents.filter((s: any) => (s.gender || '').toLowerCase() === 'female').length;

  return (
    <DashboardLayout role="admin">
      <div ref={headerRef} className="max-w-7xl mx-auto space-y-8">

        {/* ── Page header ── */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-1.5">Admin Control Panel</p>
            <h1 className="text-3xl font-black text-white leading-tight">
              Welcome, <span className="bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">{user.name?.split(' ')[0]}</span>
            </h1>
            <p className="text-slate-500 text-sm mt-1.5">Full system access · Live sync every 15s</p>
          </div>
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold text-emerald-400" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live · {refresh.toLocaleTimeString()}
          </div>
        </div>

        {/* ═══ OVERVIEW TAB ═══ */}
        {tab === 'overview' && (
          <div className="space-y-8">

            {/* Metric grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
              <MetricCard delay={0.00} color="#a855f7" label="Students" value={students.length}
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>} />
              <MetricCard delay={0.06} color="#22d3ee" label="Teachers" value={teachers.length}
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>} />
              <MetricCard delay={0.12} color="#10b981" label="Active Tests" value={activeExams}
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>} />
              <MetricCard delay={0.18} color="#f59e0b" label="Classes" value={classes.length}
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>} />
            </div>

            {/* Gender + exam pills */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Male Students', value: boys, color: '#22d3ee' },
                { label: 'Female Students', value: girls, color: '#f472b6' },
                { label: 'Draft Tests', value: draftExams, color: '#f59e0b' },
                { label: 'Total Tests', value: exams.length, color: '#a855f7' },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-xl px-4 py-3 flex items-center justify-between" style={{ background: `${color}0e`, border: `1px solid ${color}22` }}>
                  <span className="text-xs font-semibold text-slate-400">{label}</span>
                  <span className="text-lg font-black" style={{ color }}>{value}</span>
                </div>
              ))}
            </div>

            {/* Quick nav cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                { tab: 'classes', label: 'Class Management', icon: '🏫', sub: `${classes.length} classes created`, color: '#a855f7' },
                { tab: 'students', label: 'Student Directory', icon: '👥', sub: `${students.length} registered`, color: '#22d3ee' },
                { tab: 'tests', label: 'Test Management', icon: '📋', sub: `${activeExams} running now`, color: '#10b981' },
              ].map(({ tab: t, label, icon, sub, color }) => (
                <Link key={t} href={`/admin/dashboard?tab=${t}`}
                  className="flex items-center gap-4 p-5 rounded-2xl transition-all group hover:-translate-y-0.5"
                  style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${color}18` }}
                  onMouseEnter={e => gsap.to(e.currentTarget, { boxShadow: `0 16px 40px ${color}18`, duration: 0.25 })}
                  onMouseLeave={e => gsap.to(e.currentTarget, { boxShadow: 'none', duration: 0.3 })}>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0" style={{ background: `${color}15`, border: `1px solid ${color}25` }}>{icon}</div>
                  <div className="flex-1">
                    <p className="font-bold text-white text-sm">{label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
                  </div>
                  <svg className="w-4 h-4 text-slate-600 group-hover:text-slate-300 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </Link>
              ))}
            </div>

            {/* Teacher list */}
            {teachers.length > 0 && (
              <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <h2 className="text-sm font-bold text-white">Instructors ({teachers.length})</h2>
                </div>
                {teachers.slice(0, 6).map((t, i) => (
                  <div key={t.id} className="flex items-center gap-4 px-6 py-3.5 hover:bg-white/[0.02] transition-colors"
                    style={{ borderBottom: i < Math.min(teachers.length, 6) - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: 'linear-gradient(135deg, #22d3ee, #7c3aed)' }}>{t.name?.charAt(0)}</div>
                    <div className="flex-1"><p className="text-sm font-semibold text-white">{t.name}</p><p className="text-xs text-slate-600">{t.email}</p></div>
                    <span className={`text-xs px-2.5 py-1 rounded-lg font-medium capitalize ${SC[t.status] || 'text-slate-400 bg-white/5'}`}>{t.status || 'active'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ CLASSES TAB ═══ */}
        {tab === 'classes' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Class Management</h2>
                <p className="text-xs text-slate-500 mt-1">Click a class card to view its student report</p>
              </div>
              <button onClick={() => setClassModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #db2777, #a855f7)' }}
                onMouseEnter={e => gsap.to(e.currentTarget, { scale: 1.04, boxShadow: '0 8px 25px rgba(219,39,119,0.4)', duration: 0.2 })}
                onMouseLeave={e => gsap.to(e.currentTarget, { scale: 1, boxShadow: 'none', duration: 0.2 })}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                New Class
              </button>
            </div>

            {classes.length === 0 ? (
              <div className="rounded-2xl p-14 text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.07)' }}>
                <span className="text-5xl mb-4 block">🏫</span>
                <p className="text-white font-semibold mb-2">No classes yet</p>
                <p className="text-slate-500 text-sm">Create a class, then teachers can assign tests to it</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {classes.map(cls => {
                  const clsStudents = studentsInClass(cls);
                  const clsExams = examsForClass(cls);
                  const clsBoys = clsStudents.filter((s: any) => (s.gender || '').toLowerCase() === 'male').length;
                  const clsGirls = clsStudents.filter((s: any) => (s.gender || '').toLowerCase() === 'female').length;
                  return (
                    <div key={cls.id} className="group rounded-2xl p-6 relative overflow-hidden cursor-pointer transition-all hover:-translate-y-1"
                      style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(168,85,247,0.2)' }}
                      onMouseEnter={e => gsap.to(e.currentTarget, { boxShadow: '0 20px 50px rgba(168,85,247,0.15)', duration: 0.25 })}
                      onMouseLeave={e => gsap.to(e.currentTarget, { boxShadow: 'none', duration: 0.3 })}
                      onClick={() => setClassReport(cls)}>
                      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(168,85,247,0.6), transparent)' }} />
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl" style={{ background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.25)' }}>🏫</div>
                        <button onClick={e => { e.stopPropagation(); delClass(cls.id); }}
                          className="opacity-0 group-hover:opacity-100 w-8 h-8 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-500/10 transition-all">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                      <h3 className="text-base font-bold text-white mb-2">{cls.name}</h3>
                      <div className="flex gap-2 flex-wrap mb-4">
                        <span className="text-xs px-2.5 py-1 rounded-lg font-medium bg-purple-700/20 text-purple-300 border border-purple-700/30">{cls.year} Year</span>
                        <span className="text-xs px-2.5 py-1 rounded-lg font-medium bg-white/5 text-slate-400 border border-white/10">Section {cls.section}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        {[
                          ['Students', clsStudents.length, '#a855f7'],
                          ['Boys', clsBoys, '#22d3ee'],
                          ['Girls', clsGirls, '#f472b6'],
                        ].map(([l, v, c]) => (
                          <div key={String(l)} className="text-center">
                            <p className="text-lg font-black" style={{ color: c as string }}>{v as number}</p>
                            <p className="text-[10px] text-slate-600 uppercase tracking-widest">{l}</p>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-[10px] text-slate-600">{clsExams.length} test{clsExams.length !== 1 ? 's' : ''} assigned</span>
                        <span className="text-[10px] text-purple-400 font-semibold group-hover:text-purple-300 transition-colors">View Report →</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══ STUDENTS TAB ═══ */}
        {tab === 'students' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-xl font-bold text-white">Students <span className="text-slate-600 text-sm font-normal">({filteredStudents.length})</span></h2>
                <p className="text-xs text-slate-500 mt-1">Students registering with class info are auto-synced</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  <input type="text" placeholder="Search students…" value={stuSearch} onChange={e => setStuSearch(e.target.value)}
                    className="pl-9 pr-4 py-2.5 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none w-64"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} />
                </div>
                <button onClick={() => setAddStudentModal(true)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-brand-500 hover:shadow-lg hover:shadow-purple-500/20 transition-all">
                  + Add Student
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-14"><div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : (
              <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="grid grid-cols-12 px-6 py-3 text-xs font-bold text-slate-600 uppercase tracking-widest" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="col-span-4">Student</div>
                  <div className="col-span-3">Class / Year / Section</div>
                  <div className="col-span-1">Gender</div>
                  <div className="col-span-2">Status</div>
                  <div className="col-span-2 text-right">Actions</div>
                </div>
                {filteredStudents.length === 0 ? (
                  <div className="px-6 py-12 text-center text-slate-600 text-sm">No students found</div>
                ) : filteredStudents.map((s, i) => (
                  <div key={s.id} className="grid grid-cols-12 items-center px-6 py-4 hover:bg-white/[0.025] transition-colors"
                    style={{ borderBottom: i < filteredStudents.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
                    <div className="col-span-4 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: 'linear-gradient(135deg, #db2777, #a855f7)' }}>{s.name?.charAt(0)?.toUpperCase()}</div>
                      <div className="min-w-0"><p className="text-sm font-semibold text-white truncate">{s.name}</p><p className="text-xs text-slate-600 truncate">{s.email}</p></div>
                    </div>
                    <div className="col-span-3 text-xs text-slate-400">
                      {(s as any).class_name ? <span className="font-semibold text-white">{(s as any).class_name}</span> : <span className="text-slate-700">—</span>}
                      {(s as any).year && <span className="text-slate-600"> · {(s as any).year}</span>}
                      {(s as any).section && <span className="text-slate-600"> · Sec {(s as any).section}</span>}
                    </div>
                    <div className="col-span-1 text-xs text-slate-500 capitalize">{(s as any).gender || '—'}</div>
                    <div className="col-span-2"><span className={`text-xs px-2.5 py-1 rounded-lg font-medium capitalize ${SC[s.status] || 'text-slate-400 bg-white/5'}`}>{s.status || 'active'}</span></div>
                    <div className="col-span-2 flex items-center justify-end gap-2">
                      <button onClick={() => openStudentModal(s)} className="text-xs text-purple-400 hover:text-purple-300 font-semibold transition-colors">View</button>
                      <button onClick={() => delStudent(s.id, s.name)} className="text-xs text-red-400 hover:text-red-300 font-semibold transition-colors">Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ TESTS TAB ═══ */}
        {tab === 'tests' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-xl font-bold text-white">Test Management <span className="text-slate-600 text-sm font-normal">({filteredExams.length})</span></h2>
                <p className="text-xs text-slate-500 mt-1">Hover a row to Reschedule, Remove, or view the Report</p>
              </div>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input type="text" placeholder="Search tests…" value={exSearch} onChange={e => setExSearch(e.target.value)}
                  className="pl-9 pr-4 py-2.5 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none w-64"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} />
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-14"><div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : filteredExams.length === 0 ? (
              <div className="rounded-2xl p-14 text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <span className="text-4xl mb-3 block">📋</span>
                <p className="text-slate-500 text-sm">No tests found</p>
              </div>
            ) : (
              <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="grid grid-cols-12 px-6 py-3 text-xs font-bold text-slate-600 uppercase tracking-widest" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="col-span-5">Test</div>
                  <div className="col-span-3">Assigned To</div>
                  <div className="col-span-2">Status</div>
                  <div className="col-span-2 text-right">Actions</div>
                </div>
                {filteredExams.map((exam, i) => (
                  <div key={exam.id} className="grid grid-cols-12 items-center px-6 py-4 hover:bg-white/[0.025] transition-colors group"
                    style={{ borderBottom: i < filteredExams.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
                    <div className="col-span-5 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: exam.type === 'coding' ? 'rgba(34,211,238,0.12)' : 'rgba(168,85,247,0.12)', border: `1px solid ${exam.type === 'coding' ? 'rgba(34,211,238,0.2)' : 'rgba(168,85,247,0.2)'}` }}>
                        <span className="text-sm">{exam.type === 'coding' ? '💻' : '📝'}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{exam.title}</p>
                        <p className="text-xs text-slate-600">{exam.start_time ? new Date(exam.start_time).toLocaleDateString('en-IN') : 'No schedule'}</p>
                      </div>
                    </div>
                    <div className="col-span-3 text-xs">
                      {exam.assigned_class ? (
                        <><span className="font-semibold text-white">{exam.assigned_class}</span><span className="text-slate-600"> · {exam.assigned_year} · Sec {exam.assigned_section}</span></>
                      ) : <span className="text-slate-700">—</span>}
                    </div>
                    <div className="col-span-2">
                      <span className={`text-[10px] px-2.5 py-1 rounded-lg font-semibold border capitalize ${EC[exam.status] || 'text-slate-400 bg-white/5 border-white/10'}`}>{exam.status || 'draft'}</span>
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link href={`/teacher/report/${exam.id}`} className="text-xs text-purple-400 hover:text-purple-300 font-semibold transition-colors">Report</Link>
                      <button onClick={() => { setSelExam(exam); setRescData({ start: exam.start_time?.slice(0, 16) || '', end: exam.end_time?.slice(0, 16) || '' }); setReschedule(true); }}
                        className="text-xs text-amber-400 hover:text-amber-300 font-semibold transition-colors">Reschedule</button>
                      <button onClick={() => delExam(exam.id)} className="text-xs text-red-400 hover:text-red-300 font-semibold transition-colors">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ Modal: Create Class ═══ */}
      {classModal && (
        <Modal title="Create New Class" onClose={() => setClassModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Class Name</label>
              <input type="text" placeholder="e.g. Computer Science, BCA, B.Tech" value={newClass.name} onChange={e => setNewClass({ ...newClass, name: e.target.value })} className={inputSt} style={inputStyle} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Year</label>
                <select value={newClass.year} onChange={e => setNewClass({ ...newClass, year: e.target.value })} className={inputSt} style={{ ...inputStyle, appearance: 'none' }}>
                  <option value="">Select year</option>
                  {['1st', '2nd', '3rd', '4th', '5th'].map(y => <option key={y} value={y}>{y} Year</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Section</label>
                <input type="text" placeholder="A / B / C" value={newClass.section} onChange={e => setNewClass({ ...newClass, section: e.target.value })} className={inputSt} style={inputStyle} />
              </div>
            </div>
            <button onClick={saveClass} className="w-full py-3 rounded-xl font-bold text-white text-sm mt-2 transition-all" style={{ background: 'linear-gradient(135deg, #db2777, #a855f7)' }}
              onMouseEnter={e => gsap.to(e.currentTarget, { scale: 1.02, duration: 0.2 })} onMouseLeave={e => gsap.to(e.currentTarget, { scale: 1, duration: 0.2 })}>
              Create Class
            </button>
          </div>
        </Modal>
      )}

      {/* ═══ Modal: Class Report ═══ */}
      {classReport && (
        <Modal title={`${classReport.name} — ${classReport.year} Year · Section ${classReport.section}`} wide onClose={() => setClassReport(null)}>
          <div className="space-y-6">
            {/* Stats row */}
            <div className="grid grid-cols-4 gap-3">
              {[
                ['Total', reportStudents.length, '#a855f7'],
                ['Boys', reportBoys, '#22d3ee'],
                ['Girls', reportGirls, '#f472b6'],
                ['Tests', reportExams.length, '#10b981'],
              ].map(([l, v, c]) => (
                <div key={String(l)} className="rounded-xl p-4 text-center" style={{ background: `${c}0e`, border: `1px solid ${c}20` }}>
                  <p className="text-2xl font-black" style={{ color: c as string }}>{v as number}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">{l}</p>
                </div>
              ))}
            </div>

            {/* Tests assigned to this class */}
            {reportExams.length > 0 && (
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Assigned Tests</p>
                <div className="space-y-2">
                  {reportExams.map(ex => (
                    <div key={ex.id} className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="flex items-center gap-3">
                        <span className="text-sm">{ex.type === 'coding' ? '💻' : '📝'}</span>
                        <div>
                          <p className="text-sm font-semibold text-white">{ex.title}</p>
                          <p className="text-xs text-slate-600">{ex.start_time ? new Date(ex.start_time).toLocaleDateString() : 'No schedule'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-semibold border capitalize ${EC[ex.status] || 'text-slate-400 bg-white/5 border-white/10'}`}>{ex.status || 'draft'}</span>
                        <Link href={`/teacher/report/${ex.id}`} className="text-xs text-purple-400 hover:text-purple-300 font-bold" onClick={() => setClassReport(null)}>Report →</Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Students in class */}
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Students in Class ({reportStudents.length})</p>
              {reportStudents.length === 0 ? (
                <div className="rounded-xl p-8 text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.06)' }}>
                  <p className="text-slate-600 text-sm">No students registered for this class yet</p>
                  <p className="text-slate-700 text-xs mt-1">Students who register and select this class will appear here automatically</p>
                </div>
              ) : (
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                  {reportStudents.map((s, i) => (
                    <div key={s.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors"
                      style={{ borderBottom: i < reportStudents.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: 'linear-gradient(135deg, #db2777, #a855f7)' }}>{s.name?.charAt(0)?.toUpperCase()}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{s.name}</p>
                        <p className="text-xs text-slate-600 truncate">{s.email}</p>
                      </div>
                      <span className="text-xs text-slate-500 capitalize">{(s as any).gender || '—'}</span>
                      <span className={`text-xs px-2 py-0.5 rounded font-medium capitalize ${SC[s.status] || 'text-slate-500 bg-white/5'}`}>{s.status || 'active'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* ═══ Modal: Reschedule ═══ */}
      {reschedule && selExam && (
        <Modal title={`Reschedule: ${selExam.title}`} onClose={() => setReschedule(false)}>
          <div className="space-y-4">
            <div><label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">New Start Time</label><input type="datetime-local" value={rescData.start} onChange={e => setRescData({ ...rescData, start: e.target.value })} className={inputSt} style={inputStyle} /></div>
            <div><label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">New End Time</label><input type="datetime-local" value={rescData.end} onChange={e => setRescData({ ...rescData, end: e.target.value })} className={inputSt} style={inputStyle} /></div>
            <button onClick={doReschedule} className="w-full py-3 rounded-xl font-bold text-white text-sm" style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)' }}>Confirm Reschedule</button>
          </div>
        </Modal>
      )}

      {/* ═══ Modal: Student Report ═══ */}
      {studentModal && (
        <Modal title={`Student: ${studentModal.name}`} onClose={() => { setStudentModal(null); setStudentReport(null); }}>
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black text-white" style={{ background: 'linear-gradient(135deg, #db2777, #a855f7)' }}>{studentModal.name?.charAt(0)}</div>
              <div>
                <p className="font-bold text-white">{studentModal.name}</p>
                <p className="text-xs text-slate-500">{studentModal.email}</p>
                <div className="flex gap-2 mt-1 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded font-medium capitalize ${SC[studentModal.status] || 'text-slate-400'}`}>{studentModal.status}</span>
                  {(studentModal as any).class_name && <span className="text-xs text-slate-400">{(studentModal as any).class_name} · {(studentModal as any).year} · Sec {(studentModal as any).section}</span>}
                  {(studentModal as any).gender && <span className="text-xs text-slate-500 capitalize">{(studentModal as any).gender}</span>}
                </div>
              </div>
            </div>
            {!studentReport ? (
              <div className="flex justify-center py-6"><div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : studentReport.message && !studentReport.attempts?.length ? (
              <p className="text-slate-500 text-sm text-center py-4">{studentReport.message}</p>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 rounded-xl text-center" style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)' }}>
                    <p className="text-2xl font-black text-purple-400">{studentReport.avg_score ?? 0}%</p>
                    <p className="text-xs text-slate-600 mt-1">Avg Score</p>
                  </div>
                  <div className="p-4 rounded-xl text-center" style={{ background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.2)' }}>
                    <p className="text-2xl font-black text-cyan-400">{studentReport.attempts?.length ?? 0}</p>
                    <p className="text-xs text-slate-600 mt-1">Attempts</p>
                  </div>
                </div>
                {studentReport.attempts?.map((a: any, j: number) => (
                  <div key={j} className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <p className="text-xs text-slate-400">{a.exam_title || `Attempt ${j + 1}`}</p>
                    <span className="text-xs font-bold text-purple-300">{a.score ?? 0}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}
      {/* ═══ Modal: Add Student ═══ */}
      {addStudentModal && (
        <Modal title="Add New Student Directly" wide onClose={() => setAddStudentModal(false)}>
          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-4">
              <div><label className="block text-xs font-bold text-slate-400 uppercase mb-2">Full Name</label><input type="text" placeholder="John Doe" value={newStudent.name} onChange={e => setNewStudent({ ...newStudent, name: e.target.value })} className={inputSt} style={inputStyle} /></div>
              <div><label className="block text-xs font-bold text-slate-400 uppercase mb-2">Email</label><input type="email" placeholder="john@student.com" value={newStudent.email} onChange={e => setNewStudent({ ...newStudent, email: e.target.value })} className={inputSt} style={inputStyle} /></div>
              <div><label className="block text-xs font-bold text-slate-400 uppercase mb-2">Password</label><input type="password" placeholder="••••••••" value={newStudent.password} onChange={e => setNewStudent({ ...newStudent, password: e.target.value })} className={inputSt} style={inputStyle} /></div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Gender</label>
                <select value={newStudent.gender} onChange={e => setNewStudent({ ...newStudent, gender: e.target.value })} className={inputSt} style={inputStyle}>
                  <option value="">Select Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Class Name</label>
                <select value={newStudent.class_name} onChange={e => setNewStudent({ ...newStudent, class_name: e.target.value })} className={inputSt} style={inputStyle}>
                  <option value="">Select Class</option>
                  {classes.map(c => <option key={c.id} value={c.name}>{c.name} (Sec {c.section})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Year</label>
                  <select value={newStudent.year} onChange={e => setNewStudent({ ...newStudent, year: e.target.value })} className={inputSt} style={inputStyle}>
                    <option value="">Year</option>
                    {['1st', '2nd', '3rd', '4th', '5th'].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Section</label>
                  <input type="text" placeholder="A" value={newStudent.section} onChange={e => setNewStudent({ ...newStudent, section: e.target.value })} className={inputSt} style={inputStyle} />
                </div>
              </div>
              <div><label className="block text-xs font-bold text-slate-400 uppercase mb-2">Register Number</label><input type="text" placeholder="21CS001" value={newStudent.register_number} onChange={e => setNewStudent({ ...newStudent, register_number: e.target.value })} className={inputSt} style={inputStyle} /></div>
              <button onClick={handleAddStudent} className="w-full py-3 rounded-xl font-bold text-white text-sm mt-4 bg-gradient-to-r from-purple-600 to-brand-400 hover:scale-[1.02] transition-all">
                Create Account
              </button>
            </div>
          </div>
        </Modal>
      )}
    </DashboardLayout>
  );
}
