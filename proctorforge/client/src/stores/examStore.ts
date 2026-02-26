/**
 * ProctorForge AI - Zustand Exam Store
 * Manages real-time exam session state including trust score, violations, and timer.
 */

import { create } from 'zustand';

export interface ExamSessionState {
    attemptId: string | null;
    examId: string | null;
    trustScore: number;
    riskLevel: string;
    remainingSeconds: number;
    violations: any[];
    interventions: any[];
    isExamActive: boolean;
    isPaused: boolean;
    currentQuestionIndex: number;

    // Trust score dimensions
    behaviorStability: number;
    typingConsistency: number;
    codingAuthenticity: number;
    identityStability: number;
    environmentIntegrity: number;
    interventionPerformance: number;

    // Actions
    setAttempt: (attemptId: string, examId: string) => void;
    updateTrustScore: (score: number, riskLevel: string) => void;
    updateDimensions: (dims: Partial<ExamSessionState>) => void;
    addViolation: (violation: any) => void;
    addIntervention: (intervention: any) => void;
    setTimer: (seconds: number) => void;
    decrementTimer: () => void;
    pauseExam: () => void;
    resumeExam: () => void;
    endExam: () => void;
    setQuestionIndex: (idx: number) => void;
    reset: () => void;
}

const initialState = {
    attemptId: null,
    examId: null,
    trustScore: 100,
    riskLevel: 'low',
    remainingSeconds: 0,
    violations: [],
    interventions: [],
    isExamActive: false,
    isPaused: false,
    currentQuestionIndex: 0,
    behaviorStability: 100,
    typingConsistency: 100,
    codingAuthenticity: 100,
    identityStability: 100,
    environmentIntegrity: 100,
    interventionPerformance: 100,
};

export const useExamStore = create<ExamSessionState>((set) => ({
    ...initialState,

    setAttempt: (attemptId, examId) => set({ attemptId, examId, isExamActive: true }),

    updateTrustScore: (trustScore, riskLevel) => set({ trustScore, riskLevel }),

    updateDimensions: (dims) => set((state) => ({ ...state, ...dims })),

    addViolation: (violation) => set((state) => ({
        violations: [...state.violations, { ...violation, timestamp: new Date().toISOString() }],
    })),

    addIntervention: (intervention) => set((state) => ({
        interventions: [...state.interventions, intervention],
    })),

    setTimer: (seconds) => set({ remainingSeconds: seconds }),

    decrementTimer: () => set((state) => ({
        remainingSeconds: Math.max(0, state.remainingSeconds - 1),
    })),

    pauseExam: () => set({ isPaused: true }),
    resumeExam: () => set({ isPaused: false }),
    endExam: () => set({ isExamActive: false }),
    setQuestionIndex: (idx) => set({ currentQuestionIndex: idx }),
    reset: () => set(initialState),
}));
