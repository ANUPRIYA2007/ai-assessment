'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8001';

/**
 * Heartbeat hook - sends periodic heartbeat pings to the server.
 * Auto-pauses exam on missing heartbeats. Includes battery + visibility status.
 */

interface UseHeartbeatOptions {
  attemptId: string | null;
  enabled?: boolean;
  intervalMs?: number;
  onViolation?: (violation: { type: string; message: string }) => void;
  onPaused?: () => void;
}

export function useHeartbeat(options: UseHeartbeatOptions) {
  const { attemptId, enabled = true, intervalMs = 3000, onViolation, onPaused } = options;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [missedBeats, setMissedBeats] = useState(0);

  const sendHeartbeat = useCallback(async () => {
    if (!attemptId) return;

    const token = typeof window !== 'undefined' ? localStorage.getItem('proctorforge_token') : null;
    if (!token) return;

    try {
      // Get battery info if available
      let batteryCharging: boolean | undefined;
      let batteryLevel: number | undefined;
      try {
        const nav = navigator as any;
        if (nav.getBattery) {
          const battery = await nav.getBattery();
          batteryCharging = battery.charging;
          batteryLevel = battery.level;
        }
      } catch { /* battery API not available */ }

      const res = await fetch(`${API_BASE}/api/monitoring/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          attempt_id: attemptId,
          timestamp: Date.now() / 1000,
          tab_visible: document.visibilityState === 'visible',
          fullscreen: !!document.fullscreenElement,
          battery_charging: batteryCharging,
          battery_level: batteryLevel,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setIsConnected(true);
        setMissedBeats(0);

        if (data.violations?.length > 0) {
          data.violations.forEach((v: any) => onViolation?.(v));
        }
        if (data.paused) {
          onPaused?.();
        }
      } else {
        setMissedBeats(prev => prev + 1);
      }
    } catch {
      setMissedBeats(prev => prev + 1);
      if (missedBeats > 3) {
        setIsConnected(false);
      }
    }
  }, [attemptId, missedBeats, onViolation, onPaused]);

  useEffect(() => {
    if (!enabled || !attemptId) return;

    // Send initial heartbeat immediately
    sendHeartbeat();

    intervalRef.current = setInterval(sendHeartbeat, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, attemptId, intervalMs]); // eslint-disable-line react-hooks/exhaustive-deps

  return { isConnected, missedBeats };
}
