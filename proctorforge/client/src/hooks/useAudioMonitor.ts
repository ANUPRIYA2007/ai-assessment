'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Audio monitoring hook for proctoring.
 * Uses Web Audio API to analyze ambient sound levels and detect:
 * - Voice activity (speaking detection via frequency analysis)
 * - Multiple voices (sustained voice energy at different patterns)
 * - Background noise levels
 * - Silence detection
 */

interface AudioEvent {
  type: 'voice_detected' | 'multiple_voices' | 'background_noise' | 'silence';
  volumeLevel: number;
  voiceCount: number;
  confidence: number;
  timestamp: number;
}

interface UseAudioMonitorOptions {
  enabled?: boolean;
  analysisInterval?: number; // ms between analyses (default: 3000)
  voiceThreshold?: number; // 0-1, volume above this = voice (default: 0.15)
  onEvent?: (event: AudioEvent) => void;
  onError?: (error: string) => void;
}

interface UseAudioMonitorReturn {
  isActive: boolean;
  volumeLevel: number;
  voiceDetected: boolean;
  lastEvent: AudioEvent | null;
  error: string | null;
  startMonitoring: () => Promise<void>;
  stopMonitoring: () => void;
}

export function useAudioMonitor(options: UseAudioMonitorOptions = {}): UseAudioMonitorReturn {
  const {
    enabled = true,
    analysisInterval = 3000,
    voiceThreshold = 0.15,
    onEvent,
    onError,
  } = options;

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const voiceHistoryRef = useRef<number[]>([]);

  const [isActive, setIsActive] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [voiceDetected, setVoiceDetected] = useState(false);
  const [lastEvent, setLastEvent] = useState<AudioEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const frequencyData = new Float32Array(bufferLength);

    analyser.getByteTimeDomainData(dataArray);
    analyser.getFloatFrequencyData(frequencyData);

    // Calculate RMS volume
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      const val = (dataArray[i] - 128) / 128;
      sum += val * val;
    }
    const rms = Math.sqrt(sum / bufferLength);
    setVolumeLevel(rms);

    // Voice frequency analysis (human voice: 85-3000 Hz)
    const sampleRate = audioContextRef.current?.sampleRate || 44100;
    const binWidth = sampleRate / (bufferLength * 2);

    let voiceEnergy = 0;
    let totalEnergy = 0;
    let voiceBins = 0;

    for (let i = 0; i < bufferLength; i++) {
      const freq = i * binWidth;
      const power = Math.pow(10, frequencyData[i] / 10); // Convert dB to linear

      if (freq >= 85 && freq <= 3000) {
        voiceEnergy += power;
        voiceBins++;
      }
      totalEnergy += power;
    }

    const voiceRatio = totalEnergy > 0 ? voiceEnergy / totalEnergy : 0;
    const avgVoicePower = voiceBins > 0 ? voiceEnergy / voiceBins : 0;

    // Track voice history for multi-voice detection
    voiceHistoryRef.current.push(voiceRatio);
    if (voiceHistoryRef.current.length > 10) {
      voiceHistoryRef.current.shift();
    }

    // Determine event type
    let event: AudioEvent;
    const isVoice = rms > voiceThreshold && voiceRatio > 0.3;

    if (isVoice) {
      // Check for multiple voices via variance in voice energy
      const history = voiceHistoryRef.current;
      const variance = calculateVariance(history);
      const hasMultipleVoices = variance > 0.05 && history.filter(v => v > 0.35).length > 5;

      if (hasMultipleVoices) {
        event = {
          type: 'multiple_voices',
          volumeLevel: rms,
          voiceCount: 2, // heuristic
          confidence: 0.6,
          timestamp: Date.now(),
        };
      } else {
        event = {
          type: 'voice_detected',
          volumeLevel: rms,
          voiceCount: 1,
          confidence: 0.75,
          timestamp: Date.now(),
        };
      }
      setVoiceDetected(true);
    } else if (rms > 0.02) {
      event = {
        type: 'background_noise',
        volumeLevel: rms,
        voiceCount: 0,
        confidence: 0.8,
        timestamp: Date.now(),
      };
      setVoiceDetected(false);
    } else {
      event = {
        type: 'silence',
        volumeLevel: rms,
        voiceCount: 0,
        confidence: 0.9,
        timestamp: Date.now(),
      };
      setVoiceDetected(false);
    }

    setLastEvent(event);
    // Only report non-silence events to reduce noise
    if (event.type !== 'silence') {
      onEvent?.(event);
    }
  }, [voiceThreshold, onEvent]);

  const startMonitoring = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;

      setIsActive(true);
      setError(null);

      intervalRef.current = setInterval(analyzeAudio, analysisInterval);
    } catch (err: any) {
      const msg = err?.name === 'NotAllowedError'
        ? 'Microphone access denied. Please allow mic for proctoring.'
        : `Audio error: ${err?.message || 'Unknown'}`;
      setError(msg);
      onError?.(msg);
    }
  }, [analyzeAudio, analysisInterval, onError]);

  const stopMonitoring = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    analyserRef.current = null;
    setIsActive(false);
  }, []);

  useEffect(() => {
    if (enabled) {
      startMonitoring();
    }
    return () => stopMonitoring();
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    isActive,
    volumeLevel,
    voiceDetected,
    lastEvent,
    error,
    startMonitoring,
    stopMonitoring,
  };
}

function calculateVariance(arr: number[]): number {
  if (arr.length === 0) return 0;
  const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
  return arr.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / arr.length;
}
