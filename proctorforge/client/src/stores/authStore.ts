/**
 * ProctorForge AI - Zustand Auth Store
 * Manages authentication state, user data, and role-based routing.
 */

import { create } from 'zustand';
import { authAPI } from '@/lib/api';

export interface User {
    id: string;
    name: string;
    email: string;
    role: 'student' | 'teacher' | 'admin';
    status: string;
    created_at: string;
}

interface AuthState {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    error: string | null;

    login: (email: string, password: string) => Promise<void>;
    register: (name: string, email: string, password: string, role: string, extra?: Record<string, string>) => Promise<void>;
    logout: () => void;
    loadFromStorage: () => void;
    clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    token: null,
    isLoading: false,
    error: null,

    login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
            const res = await authAPI.login({ email, password });
            const { access_token, user } = res.data;
            localStorage.setItem('proctorforge_token', access_token);
            localStorage.setItem('proctorforge_user', JSON.stringify(user));
            set({ user, token: access_token, isLoading: false });
        } catch (err: any) {
            set({
                isLoading: false,
                error: err.response?.data?.detail || 'Login failed',
            });
            throw err;
        }
    },

    register: async (name, email, password, role, extra = {}) => {
        set({ isLoading: true, error: null });
        try {
            const res = await authAPI.register({ name, email, password, role, ...extra });
            const { access_token, user } = res.data;
            localStorage.setItem('proctorforge_token', access_token);
            localStorage.setItem('proctorforge_user', JSON.stringify(user));
            set({ user, token: access_token, isLoading: false });
        } catch (err: any) {
            set({
                isLoading: false,
                error: err.response?.data?.detail || 'Registration failed',
            });
            throw err;
        }
    },

    logout: () => {
        localStorage.removeItem('proctorforge_token');
        localStorage.removeItem('proctorforge_user');
        set({ user: null, token: null });
        window.location.href = '/login';
    },

    loadFromStorage: () => {
        if (typeof window === 'undefined') return;
        const token = localStorage.getItem('proctorforge_token');
        const userStr = localStorage.getItem('proctorforge_user');
        if (token && userStr) {
            try {
                const user = JSON.parse(userStr);
                set({ user, token });
            } catch {
                localStorage.removeItem('proctorforge_token');
                localStorage.removeItem('proctorforge_user');
            }
        }
    },

    clearError: () => set({ error: null }),
}));
