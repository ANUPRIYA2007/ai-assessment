/**
 * ProctorForge AI - Typing Analytics Hook
 * Tracks WPM, backspace ratio, paste size, idle time, burst detection, and keystroke entropy.
 */

import { useEffect, useRef, useCallback } from 'react';
import { attemptsAPI } from '@/lib/api';

interface TypingAnalyticsOptions {
    attemptId: string | null;
    isActive: boolean;
    reportInterval?: number; // ms, default 5000
}

export function useTypingAnalytics({ attemptId, isActive, reportInterval = 5000 }: TypingAnalyticsOptions) {
    const keystrokesRef = useRef<number[]>([]);
    const backspacesRef = useRef<number>(0);
    const totalKeysRef = useRef<number>(0);
    const lastKeyTimeRef = useRef<number>(Date.now());
    const pasteSizeRef = useRef<number>(0);
    const idleStartRef = useRef<number>(Date.now());
    const burstCountRef = useRef<number>(0);

    const calculateEntropy = (keystrokes: number[]): number => {
        if (keystrokes.length < 10) return 0;
        const intervals = keystrokes.slice(1).map((t, i) => t - keystrokes[i]);
        const bins: Record<number, number> = {};
        intervals.forEach(interval => {
            const bin = Math.floor(interval / 20) * 20; // 20ms bins
            bins[bin] = (bins[bin] || 0) + 1;
        });
        const total = intervals.length;
        let entropy = 0;
        Object.values(bins).forEach(count => {
            const p = count / total;
            if (p > 0) entropy -= p * Math.log2(p);
        });
        return Math.min(1, entropy / 4); // normalized 0-1
    };

    const calculateWPM = (keystrokes: number[]): number => {
        if (keystrokes.length < 5) return 0;
        const duration = (keystrokes[keystrokes.length - 1] - keystrokes[0]) / 1000 / 60; // minutes
        if (duration <= 0) return 0;
        return Math.round((keystrokes.length / 5) / duration); // ~5 chars per word
    };

    const reportMetrics = useCallback(async () => {
        if (!attemptId || !isActive) return;

        const keystrokes = keystrokesRef.current;
        const wpm = calculateWPM(keystrokes);
        const backspaceRatio = totalKeysRef.current > 0 ? backspacesRef.current / totalKeysRef.current : 0;
        const entropy = calculateEntropy(keystrokes);
        const idleTime = (Date.now() - lastKeyTimeRef.current) / 1000;
        const burstDetected = burstCountRef.current > 3 ? 'true' : 'false';

        try {
            await attemptsAPI.logTyping(attemptId, {
                attempt_id: attemptId,
                wpm,
                backspace_ratio: Math.round(backspaceRatio * 1000) / 1000,
                paste_size: pasteSizeRef.current,
                idle_time: Math.round(idleTime * 10) / 10,
                entropy_score: Math.round(entropy * 1000) / 1000,
                burst_detected: burstDetected,
            });
        } catch { }

        // Reset some counters
        pasteSizeRef.current = 0;
        burstCountRef.current = 0;
        keystrokesRef.current = keystrokesRef.current.slice(-50); // keep last 50 for rolling calc
    }, [attemptId, isActive]);

    useEffect(() => {
        if (!isActive) return;

        const handleKeydown = (e: KeyboardEvent) => {
            const now = Date.now();
            keystrokesRef.current.push(now);
            totalKeysRef.current++;

            if (e.key === 'Backspace' || e.key === 'Delete') {
                backspacesRef.current++;
            }

            // Burst detection: > 10 keys in < 500ms
            const recentKeys = keystrokesRef.current.filter(t => now - t < 500);
            if (recentKeys.length > 10) {
                burstCountRef.current++;
            }

            lastKeyTimeRef.current = now;
        };

        const handlePaste = (e: ClipboardEvent) => {
            const text = e.clipboardData?.getData('text') || '';
            pasteSizeRef.current += text.length;
        };

        document.addEventListener('keydown', handleKeydown);
        document.addEventListener('paste', handlePaste);

        const interval = setInterval(reportMetrics, reportInterval);

        return () => {
            document.removeEventListener('keydown', handleKeydown);
            document.removeEventListener('paste', handlePaste);
            clearInterval(interval);
        };
    }, [isActive, reportInterval, reportMetrics]);

    return { reportMetrics };
}
