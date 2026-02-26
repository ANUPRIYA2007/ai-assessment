'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import gsap from 'gsap';
import { useAuthStore } from '@/stores/authStore';
import { useWebSocket } from '@/hooks/useWebSocket';
import { DashboardLayout } from '@/components/DashboardLayout';
import { examsAPI, monitoringAPI } from '@/lib/api';

interface StudentSession {
  attempt_id: string;
  student: { id: string; name: string; email: string; register_number?: string };
  trust_score: number;
  risk_level: string;
  is_online: boolean;
  last_heartbeat: string | null;
  violation_count: number;
  start_time: string;
}

const riskColors: Record<string, { bg: string; text: string; border: string }> = {
  low: { bg: 'rgba(16,185,129,0.1)', text: '#10b981', border: 'rgba(16,185,129,0.3)' },
  medium: { bg: 'rgba(245,158,11,0.1)', text: '#f59e0b', border: 'rgba(245,158,11,0.3)' },
  high: { bg: 'rgba(239,68,68,0.1)', text: '#ef4444', border: 'rgba(239,68,68,0.3)' },
  critical: { bg: 'rgba(220,38,38,0.15)', text: '#dc2626', border: 'rgba(220,38,38,0.4)' },
};

export default function TeacherMonitorPage() {
  const { id: examId } = useParams<{ id: string }>();
  const { user, token, loadFromStorage } = useAuthStore();
  const router = useRouter();
  const headerRef = useRef<HTMLDivElement>(null);

  const [exam, setExam] = useState<any>(null);
  const [sessions, setSessions] = useState<StudentSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => { loadFromStorage(); }, [loadFromStorage]);
  useEffect(() => {
    if (user && user.role !== 'teacher' && user.role !== 'admin') router.push('/login');
  }, [user, router]);

  useEffect(() => {
    if (headerRef.current) {
      gsap.fromTo(headerRef.current, { y: -20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out' });
    }
  }, []);

  // Fetch exam info
  useEffect(() => {
    if (!examId) return;
    examsAPI.get(examId).then(res => setExam(res.data)).catch(() => {});
  }, [examId]);

  // Poll live sessions
  const fetchSessions = useCallback(async () => {
    if (!examId) return;
    try {
      const res = await monitoringAPI.getLiveSessions(examId);
      setSessions(res.data?.sessions || []);
    } catch { }
    finally { setLoading(false); }
  }, [examId]);

  useEffect(() => {
    fetchSessions();
    const iv = setInterval(fetchSessions, 5000);
    return () => clearInterval(iv);
  }, [fetchSessions]);

  // WebSocket for real-time updates
  const handleWsMessage = useCallback((data: any) => {
    if (data.type === 'student_violation' || data.type === 'violation_alert') {
      setAlerts(prev => [{
        id: Date.now(),
        student_id: data.student_id,
        event: data.event,
        timestamp: new Date().toLocaleTimeString(),
      }, ...prev].slice(0, 50));
    }
    if (data.type === 'trust_score') {
      setSessions(prev => prev.map(s =>
        s.student.id === data.student_id
          ? { ...s, trust_score: data.trust_score, risk_level: data.risk_level }
          : s
      ));
    }
    if (data.type === 'camera_alert') {
      setAlerts(prev => [{
        id: Date.now(),
        student_id: data.student_id,
        event: { type: 'camera_event', event_type: data.event_type },
        timestamp: new Date().toLocaleTimeString(),
      }, ...prev].slice(0, 50));
    }
    if (data.type === 'student_disconnect') {
      setSessions(prev => prev.map(s =>
        s.student.id === data.student_id ? { ...s, is_online: false } : s
      ));
    }
    if (data.type === 'student_snapshot') {
      setSessions(prev => prev.map(s =>
        s.student.id === data.student_id
          ? { ...s, trust_score: data.trust_score || s.trust_score, risk_level: data.risk_level || s.risk_level, is_online: true }
          : s
      ));
    }
  }, []);

  const { send: wsSend } = useWebSocket({
    sessionType: 'teacher',
    sessionId: examId || 'none',
    token: token || '',
    onMessage: handleWsMessage,
  });

  // Actions
  const pauseStudent = (attemptId: string) => {
    wsSend({ type: 'force_pause', attempt_id: attemptId, reason: 'Paused by instructor for review' });
  };

  const terminateStudent = (attemptId: string) => {
    if (!confirm('Are you sure you want to terminate this student\'s exam?')) return;
    wsSend({ type: 'force_terminate', attempt_id: attemptId, reason: 'Exam terminated by instructor' });
  };

  const sendIntervention = (attemptId: string, message: string) => {
    wsSend({ type: 'intervention', attempt_id: attemptId, intervention_text: message, risk_level: 'warning' });
  };

  if (!user || (user.role !== 'teacher' && user.role !== 'admin')) return null;

  // Stats
  const totalStudents = sessions.length;
  const onlineCount = sessions.filter(s => s.is_online).length;
  const criticalCount = sessions.filter(s => s.risk_level === 'critical' || s.risk_level === 'high').length;
  const avgTrust = totalStudents > 0 ? Math.round(sessions.reduce((s, a) => s + a.trust_score, 0) / totalStudents) : 100;

  return (
    <DashboardLayout role="teacher">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div ref={headerRef} className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest mb-1">Live Monitoring</p>
            <h1 className="text-2xl font-black text-white">{exam?.title || 'Loading...'}</h1>
            <p className="text-slate-500 text-sm mt-1">Real-time proctoring dashboard · Auto-refresh every 5s</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              LIVE
            </div>
            <button onClick={() => router.push('/teacher/dashboard')}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 border border-white/10 hover:bg-white/5 transition-all">
              ← Back
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Students', value: totalStudents, color: '#7c3aed' },
            { label: 'Online', value: onlineCount, color: '#10b981' },
            { label: 'At Risk', value: criticalCount, color: '#ef4444' },
            { label: 'Avg Trust', value: avgTrust, color: avgTrust >= 80 ? '#10b981' : avgTrust >= 60 ? '#f59e0b' : '#ef4444' },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{s.label}</p>
              <p className="text-2xl font-black mt-1" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Student Risk Grid */}
          <div className="col-span-8 space-y-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-widest">Student Sessions</h2>

            {loading ? (
              <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : sessions.length === 0 ? (
              <div className="rounded-2xl p-12 text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.06)' }}>
                <p className="text-4xl mb-3">🕐</p>
                <p className="text-white font-semibold">No active sessions</p>
                <p className="text-slate-500 text-sm mt-1">Students will appear here when they start the exam</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {sessions.map((session) => {
                  const colors = riskColors[session.risk_level] || riskColors.low;
                  const isSelected = selectedStudent === session.attempt_id;
                  return (
                    <div key={session.attempt_id}
                      onClick={() => setSelectedStudent(isSelected ? null : session.attempt_id)}
                      className={`rounded-xl p-4 cursor-pointer transition-all hover:scale-[1.01] ${isSelected ? 'ring-2 ring-brand-500' : ''}`}
                      style={{ background: colors.bg, border: `1px solid ${colors.border}` }}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${session.is_online ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                          <span className="text-sm font-bold text-white">{session.student.name}</span>
                        </div>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-lg uppercase" style={{ background: colors.bg, color: colors.text }}>
                          {session.risk_level}
                        </span>
                      </div>

                      {/* Trust bar */}
                      <div className="mb-2">
                        <div className="flex items-center justify-between text-[10px] mb-1">
                          <span className="text-slate-500">Trust Score</span>
                          <span className="font-bold" style={{ color: colors.text }}>{Math.round(session.trust_score)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/5">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${session.trust_score}%`, background: colors.text }} />
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span>Violations: {session.violation_count}</span>
                        <span>{session.student.register_number || session.student.email}</span>
                      </div>

                      {/* Actions (shown when selected) */}
                      {isSelected && (
                        <div className="mt-3 pt-3 flex gap-2" style={{ borderTop: `1px solid ${colors.border}` }}>
                          <button onClick={(e) => { e.stopPropagation(); sendIntervention(session.attempt_id, 'Please focus on your exam. Suspicious activity detected.'); }}
                            className="flex-1 py-1.5 rounded-lg text-[10px] font-bold text-yellow-400 border border-yellow-700/40 hover:bg-yellow-500/10 transition-all">
                            ⚠ Warn
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); pauseStudent(session.attempt_id); }}
                            className="flex-1 py-1.5 rounded-lg text-[10px] font-bold text-orange-400 border border-orange-700/40 hover:bg-orange-500/10 transition-all">
                            ⏸ Pause
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); terminateStudent(session.attempt_id); }}
                            className="flex-1 py-1.5 rounded-lg text-[10px] font-bold text-red-400 border border-red-700/40 hover:bg-red-500/10 transition-all">
                            🛑 End
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Real-time Alerts Panel */}
          <div className="col-span-4 space-y-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-widest">Live Alerts</h2>
            <div className="rounded-xl overflow-hidden max-h-[600px] overflow-y-auto" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              {alerts.length === 0 ? (
                <div className="p-8 text-center text-slate-600 text-sm">
                  <p className="text-2xl mb-2">🔔</p>
                  No alerts yet
                </div>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {alerts.map((alert) => {
                    const eventType = alert.event?.event_type || alert.event?.type || 'unknown';
                    const isCritical = ['devtools_attempt', 'multi_face', 'camera_face_missing', 'multiple_voices'].includes(eventType);
                    return (
                      <div key={alert.id} className={`px-4 py-3 ${isCritical ? 'bg-red-500/5' : ''}`}>
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-bold ${isCritical ? 'text-red-400' : 'text-yellow-400'}`}>
                            {eventType.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[10px] text-slate-600">{alert.timestamp}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Student: {sessions.find(s => s.student.id === alert.student_id)?.student.name || alert.student_id?.slice(0, 8)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Risk Summary */}
            <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Risk Distribution</h3>
              <div className="space-y-2">
                {['low', 'medium', 'high', 'critical'].map(level => {
                  const count = sessions.filter(s => s.risk_level === level).length;
                  const pct = totalStudents > 0 ? (count / totalStudents) * 100 : 0;
                  const colors = riskColors[level];
                  return (
                    <div key={level} className="flex items-center gap-3">
                      <span className="text-[10px] font-bold uppercase w-16" style={{ color: colors.text }}>{level}</span>
                      <div className="flex-1 h-2 rounded-full bg-white/5">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: colors.text }} />
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 w-6 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
