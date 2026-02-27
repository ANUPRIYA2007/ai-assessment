'use client';

import { useEffect, useState, useRef } from 'react';
import { attemptsAPI } from '@/lib/api';

interface LeaderboardEntry {
  rank: number;
  student_name: string;
  trust_score: number;
  risk_level: string;
  status: string;
  is_you?: boolean;
}

interface LeaderboardProps {
  examId: string;
  examTitle?: string;
  role: 'student' | 'teacher' | 'admin';
}

export function Leaderboard({ examId, examTitle, role }: LeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLeaderboard = async () => {
    try {
      const res = await attemptsAPI.getLeaderboard(examId);
      setEntries(res.data.leaderboard || []);
      setError('');
    } catch {
      setError('Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
    // Poll every 10s for live updates
    pollRef.current = setInterval(fetchLeaderboard, 10000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  const riskColor = (level: string) => {
    switch (level) {
      case 'low': return '#10b981';
      case 'medium': return '#f59e0b';
      case 'high': return '#ef4444';
      case 'critical': return '#dc2626';
      default: return '#64748b';
    }
  };

  const trustColor = (score: number) =>
    score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : score >= 40 ? '#ef4444' : '#dc2626';

  const medalEmoji = (rank: number) => rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';

  if (loading) {
    return (
      <div className="p-6 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-lg">🏆</span>
          <h3 className="text-lg font-bold text-white">Leaderboard</h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-lg">🏆</span>
          <h3 className="text-lg font-bold text-white">Leaderboard</h3>
        </div>
        <p className="text-sm text-slate-500 text-center py-4">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-6 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <span className="text-lg">🏆</span>
          <div>
            <h3 className="text-lg font-bold text-white">Leaderboard</h3>
            {examTitle && <p className="text-xs text-slate-500">{examTitle}</p>}
          </div>
        </div>
        <span className="text-xs text-slate-600">{entries.length} students</span>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-8">No attempts yet</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div
              key={`${entry.rank}-${entry.student_name}`}
              className={`flex items-center gap-4 p-3 rounded-xl transition-all ${entry.is_you ? 'ring-1 ring-purple-500/40' : ''}`}
              style={{
                background: entry.is_you ? 'rgba(124,58,237,0.08)' : entry.rank <= 3 ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${entry.is_you ? 'rgba(124,58,237,0.25)' : entry.rank <= 3 ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)'}`,
              }}
            >
              {/* Rank */}
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold" style={{
                background: entry.rank === 1 ? 'rgba(245,158,11,0.15)' : entry.rank === 2 ? 'rgba(148,163,184,0.15)' : entry.rank === 3 ? 'rgba(180,83,9,0.15)' : 'rgba(255,255,255,0.05)',
                color: entry.rank === 1 ? '#f59e0b' : entry.rank === 2 ? '#94a3b8' : entry.rank === 3 ? '#b45309' : '#64748b',
              }}>
                {medalEmoji(entry.rank) || entry.rank}
              </div>

              {/* Name */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${entry.is_you ? 'text-purple-300' : 'text-white'}`}>
                  {entry.student_name}
                  {entry.is_you && <span className="ml-2 text-xs text-purple-400">(You)</span>}
                </p>
              </div>

              {/* Trust Score bar */}
              <div className="w-24 flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${entry.trust_score}%`, background: trustColor(entry.trust_score) }} />
                </div>
                <span className="text-xs font-bold w-8 text-right" style={{ color: trustColor(entry.trust_score) }}>
                  {Math.round(entry.trust_score)}
                </span>
              </div>

              {/* Risk level */}
              <span className="text-xs font-bold capitalize px-2 py-0.5 rounded-lg" style={{
                background: `${riskColor(entry.risk_level)}15`,
                color: riskColor(entry.risk_level),
                border: `1px solid ${riskColor(entry.risk_level)}30`,
              }}>
                {entry.risk_level}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
