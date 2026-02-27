'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Screen sharing hook for proctoring.
 * Uses getDisplayMedia to capture the user's screen.
 * If the student stops screen sharing, it triggers a violation.
 */

interface UseScreenShareOptions {
  enabled?: boolean;
  onViolation?: (type: string, data?: any) => void;
  onError?: (error: string) => void;
}

interface UseScreenShareReturn {
  isSharing: boolean;
  error: string | null;
  startSharing: () => Promise<void>;
  stopSharing: () => void;
}

export function useScreenShare(options: UseScreenShareOptions = {}): UseScreenShareReturn {
  const { enabled = false, onViolation, onError } = options;

  const streamRef = useRef<MediaStream | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startSharing = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'monitor' } as any,
        audio: false,
      });

      streamRef.current = stream;
      setIsSharing(true);
      setError(null);

      // Listen for the user stopping the share
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        setIsSharing(false);
        streamRef.current = null;
        onViolation?.('screen_share_stopped', { ts: Date.now() });
      });
    } catch (err: any) {
      const msg = err?.name === 'NotAllowedError'
        ? 'Screen sharing was denied. This is required for proctoring.'
        : `Screen share error: ${err?.message || 'Unknown'}`;
      setError(msg);
      onError?.(msg);
      onViolation?.('screen_share_denied', { ts: Date.now() });
    }
  }, [onViolation, onError]);

  const stopSharing = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsSharing(false);
  }, []);

  // Auto-start when enabled
  useEffect(() => {
    if (enabled && !isSharing) {
      startSharing();
    }
    return () => {
      if (!enabled) stopSharing();
    };
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return { isSharing, error, startSharing, stopSharing };
}
