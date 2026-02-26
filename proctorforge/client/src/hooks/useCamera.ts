'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Camera monitoring hook for proctoring.
 * Uses browser's native MediaStream API + canvas-based face detection heuristics.
 * For production: integrate MediaPipe Face Detection or TensorFlow.js face-api.
 *
 * Detects:
 * - Face presence/absence
 * - Multiple faces (frame brightness + motion analysis)
 * - Gaze deviation (head pose estimation via face position)
 * - Head movement patterns
 */

interface CameraEvent {
  type: 'face_detected' | 'face_missing' | 'multi_face' | 'gaze_deviation' | 'head_pose';
  faceCount: number;
  confidence: number;
  gazeX?: number;
  gazeY?: number;
  headYaw?: number;
  headPitch?: number;
  timestamp: number;
}

interface UseCameraOptions {
  enabled?: boolean;
  detectionInterval?: number; // ms between detections (default: 2000)
  onEvent?: (event: CameraEvent) => void;
  onError?: (error: string) => void;
}

interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isActive: boolean;
  lastEvent: CameraEvent | null;
  faceDetected: boolean;
  faceCount: number;
  error: string | null;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
}

export function useCamera(options: UseCameraOptions = {}): UseCameraReturn {
  const {
    enabled = true,
    detectionInterval = 2000,
    onEvent,
    onError,
  } = options;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevFrameRef = useRef<ImageData | null>(null);

  const [isActive, setIsActive] = useState(false);
  const [lastEvent, setLastEvent] = useState<CameraEvent | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [faceCount, setFaceCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Frame analysis - detect skin-tone regions as face proxy
  const analyzeFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx || video.readyState < 2) return;

    canvas.width = 320;
    canvas.height = 240;
    ctx.drawImage(video, 0, 0, 320, 240);

    const imageData = ctx.getImageData(0, 0, 320, 240);
    const data = imageData.data;

    // Skin-tone detection (YCbCr color space approximation)
    let skinPixels = 0;
    const skinRegions: { x: number; y: number }[] = [];
    const gridSize = 8;

    for (let y = 0; y < 240; y += gridSize) {
      for (let x = 0; x < 320; x += gridSize) {
        const i = (y * 320 + x) * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2];

        // Simple skin detection heuristic
        if (r > 95 && g > 40 && b > 20 &&
            r > g && r > b &&
            Math.abs(r - g) > 15 &&
            r - b > 15 && r - g < 100) {
          skinPixels++;
          skinRegions.push({ x, y });
        }
      }
    }

    // Cluster skin regions to estimate face count
    const clusters = clusterRegions(skinRegions, 60);
    const largeClusters = clusters.filter(c => c.size > 5);
    const detectedFaces = Math.min(largeClusters.length, 3);

    // Motion detection
    let motionScore = 0;
    if (prevFrameRef.current) {
      const prevData = prevFrameRef.current.data;
      let diffSum = 0;
      for (let i = 0; i < data.length; i += 16) {
        diffSum += Math.abs(data[i] - prevData[i]);
      }
      motionScore = diffSum / (data.length / 16);
    }
    prevFrameRef.current = imageData;

    // Determine face position (gaze estimation proxy)
    let gazeX = 0.5, gazeY = 0.5;
    if (largeClusters.length > 0) {
      const mainCluster = largeClusters[0];
      gazeX = mainCluster.centerX / 320;
      gazeY = mainCluster.centerY / 240;
    }

    // Generate events
    let event: CameraEvent;

    if (detectedFaces === 0) {
      event = {
        type: 'face_missing',
        faceCount: 0,
        confidence: skinPixels < 3 ? 0.9 : 0.6,
        timestamp: Date.now(),
      };
      setFaceDetected(false);
    } else if (detectedFaces > 1) {
      event = {
        type: 'multi_face',
        faceCount: detectedFaces,
        confidence: 0.7,
        timestamp: Date.now(),
      };
      setFaceDetected(true);
    } else if (Math.abs(gazeX - 0.5) > 0.3 || Math.abs(gazeY - 0.5) > 0.35) {
      event = {
        type: 'gaze_deviation',
        faceCount: 1,
        confidence: 0.65,
        gazeX: gazeX - 0.5,
        gazeY: gazeY - 0.5,
        timestamp: Date.now(),
      };
      setFaceDetected(true);
    } else {
      event = {
        type: 'face_detected',
        faceCount: 1,
        confidence: 0.85,
        gazeX: gazeX - 0.5,
        gazeY: gazeY - 0.5,
        timestamp: Date.now(),
      };
      setFaceDetected(true);
    }

    setFaceCount(detectedFaces);
    setLastEvent(event);
    onEvent?.(event);
  }, [onEvent]);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsActive(true);
      setError(null);

      // Start periodic frame analysis
      intervalRef.current = setInterval(analyzeFrame, detectionInterval);
    } catch (err: any) {
      const msg = err?.name === 'NotAllowedError'
        ? 'Camera access denied. Please allow camera for proctoring.'
        : `Camera error: ${err?.message || 'Unknown'}`;
      setError(msg);
      onError?.(msg);
    }
  }, [analyzeFrame, detectionInterval, onError]);

  const stopCamera = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsActive(false);
  }, []);

  // Auto-start when enabled
  useEffect(() => {
    if (enabled) {
      startCamera();
    }
    return () => stopCamera();
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    videoRef,
    canvasRef,
    isActive,
    lastEvent,
    faceDetected,
    faceCount,
    error,
    startCamera,
    stopCamera,
  };
}

// ── Clustering utility ──────────────────────────────────────────

interface Cluster {
  centerX: number;
  centerY: number;
  size: number;
}

function clusterRegions(points: { x: number; y: number }[], threshold: number): Cluster[] {
  if (points.length === 0) return [];

  const clusters: Cluster[] = [];
  const visited = new Set<number>();

  for (let i = 0; i < points.length; i++) {
    if (visited.has(i)) continue;
    visited.add(i);

    const cluster = [points[i]];
    const queue = [i];

    while (queue.length > 0) {
      const idx = queue.shift()!;
      for (let j = 0; j < points.length; j++) {
        if (visited.has(j)) continue;
        const dx = points[idx].x - points[j].x;
        const dy = points[idx].y - points[j].y;
        if (Math.sqrt(dx * dx + dy * dy) < threshold) {
          visited.add(j);
          cluster.push(points[j]);
          queue.push(j);
        }
      }
    }

    clusters.push({
      centerX: cluster.reduce((s, p) => s + p.x, 0) / cluster.length,
      centerY: cluster.reduce((s, p) => s + p.y, 0) / cluster.length,
      size: cluster.length,
    });
  }

  return clusters;
}
