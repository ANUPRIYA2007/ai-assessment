/**
 * TestGuard - API Client
 * Axios-based HTTP client with JWT token management.
 */

import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8001';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('proctorforge_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('proctorforge_token');
      localStorage.removeItem('proctorforge_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

// ===== Auth API =====
export const authAPI = {
  register: (data: Record<string, string>) => api.post('/api/auth/register', data),
  login: (data: { email: string; password: string }) => api.post('/api/auth/login', data),
  getMe: () => api.get('/api/auth/me'),
  listUsers: (role?: string) => api.get('/api/auth/users', { params: { role } }),
  getUser: (id: string) => api.get(`/api/auth/users/${id}`),
  updateUserStatus: (userId: string, status: string) =>
    api.patch(`/api/auth/users/${userId}/status`, null, { params: { status_val: status } }),
  deleteUser: (userId: string) => api.delete(`/api/auth/users/${userId}`),
};

// ===== Exams API =====
export const examsAPI = {
  list: () => api.get('/api/exams/'),
  get: (id: string) => api.get(`/api/exams/${id}`),
  create: (data: any) => api.post('/api/exams/', data),
  update: (id: string, data: any) => api.patch(`/api/exams/${id}`, data),
  delete: (id: string) => api.delete(`/api/exams/${id}`),
  reschedule: (id: string, start: string, end: string) =>
    api.patch(`/api/exams/${id}`, { start_time: start, end_time: end }),

  // Questions
  getQuestions: (examId: string) => api.get(`/api/exams/${examId}/questions`),
  createQuestion: (examId: string, data: any) => api.post(`/api/exams/${examId}/questions`, data),
  updateQuestion: (examId: string, qId: string, data: any) =>
    api.patch(`/api/exams/${examId}/questions/${qId}`, data),
  deleteQuestion: (examId: string, qId: string) => api.delete(`/api/exams/${examId}/questions/${qId}`),

  // Assignments
  assign: (examId: string, studentIds: string[]) =>
    api.post(`/api/exams/${examId}/assign`, { student_ids: studentIds }),
  getAssignments: (examId: string) => api.get(`/api/exams/${examId}/assignments`),
};

// ===== Attempts API =====
export const attemptsAPI = {
  create: (data: { exam_id: string; device_fingerprint?: string; browser_info?: any }) =>
    api.post('/api/attempts/', data),
  get: (id: string) => api.get(`/api/attempts/${id}`),
  end: (id: string) => api.patch(`/api/attempts/${id}/end`),
  list: () => api.get('/api/attempts/'),
  getByStudent: (studentId: string) => api.get('/api/attempts/', { params: { student_id: studentId } }),
  getByExam: (examId: string) => api.get('/api/attempts/', { params: { exam_id: examId } }),

  logEvent: (attemptId: string, data: any) => api.post(`/api/attempts/${attemptId}/events`, data),
  getEvents: (attemptId: string) => api.get(`/api/attempts/${attemptId}/events`),
  logTyping: (attemptId: string, data: any) => api.post(`/api/attempts/${attemptId}/typing`, data),
  logCode: (attemptId: string, data: any) => api.post(`/api/attempts/${attemptId}/code-logs`, data),
  getCodeLogs: (attemptId: string) => api.get(`/api/attempts/${attemptId}/code-logs`),
  submitCode: (attemptId: string, data: any) => api.post(`/api/attempts/${attemptId}/submit-code`, data),
  getLeaderboard: (examId: string) => api.get(`/api/attempts/leaderboard/${examId}`),
};

// ===== Admin APIs (classes, sections, years) =====
export const adminAPI = {
  // Classes
  getClasses: () => api.get('/api/admin/classes'),
  createClass: (data: { name: string; year: string; section: string }) =>
    api.post('/api/admin/classes', data),
  deleteClass: (id: string) => api.delete(`/api/admin/classes/${id}`),

  // Stats
  getStats: () => api.get('/api/admin/stats'),

  // Student report
  getStudentReport: (studentId: string) => api.get(`/api/admin/students/${studentId}/report`),
};

// ===== Live Assessment API =====
export const liveAPI = {
  // Teacher creates a live session → returns joining_code
  createSession: (examId: string) => api.post('/api/live/sessions', { exam_id: examId }),
  endSession: (sessionId: string) => api.patch(`/api/live/sessions/${sessionId}/end`),
  getSession: (sessionId: string) => api.get(`/api/live/sessions/${sessionId}`),
  listActive: () => api.get('/api/live/sessions?status=active'),

  // Student joins
  joinSession: (code: string) => api.post('/api/live/join', { joining_code: code }),

  // Participants list (poll)
  getParticipants: (sessionId: string) => api.get(`/api/live/sessions/${sessionId}/participants`),
};

// ===== Monitoring API =====
export const monitoringAPI = {
  // Session initialization validation
  validateSession: (data: {
    browser_name: string;
    browser_version: string;
    os_name: string;
    screen_count: number;
    gpu_renderer: string;
    device_fingerprint: string;
    vm_detected: boolean;
    webcam_available: boolean;
    mic_available: boolean;
    fullscreen_capable: boolean;
    connection_speed_mbps?: number;
  }) => api.post('/api/monitoring/session-init', data),

  // Heartbeat
  heartbeat: (data: {
    attempt_id: string;
    timestamp?: number;
    tab_visible: boolean;
    fullscreen: boolean;
    battery_charging?: boolean;
    battery_level?: number;
  }) => api.post('/api/monitoring/heartbeat', data),

  // Camera event
  cameraEvent: (data: {
    attempt_id: string;
    event_type: string;
    face_count: number;
    confidence: number;
    gaze_x?: number;
    gaze_y?: number;
    head_yaw?: number;
    head_pitch?: number;
    details?: Record<string, any>;
  }) => api.post('/api/monitoring/camera-event', data),

  // Audio event
  audioEvent: (data: {
    attempt_id: string;
    event_type: string;
    volume_level: number;
    voice_count: number;
    confidence: number;
    details?: Record<string, any>;
  }) => api.post('/api/monitoring/audio-event', data),

  // Behavior event
  behaviorEvent: (data: {
    attempt_id: string;
    event_type: string;
    details?: Record<string, any>;
    confidence?: number;
  }) => api.post('/api/monitoring/behavior-event', data),

  // Get monitoring status
  getStatus: (attemptId: string) => api.get(`/api/monitoring/status/${attemptId}`),

  // Get live sessions for an exam (teacher)
  getLiveSessions: (examId: string) => api.get(`/api/monitoring/live-sessions/${examId}`),

  // Run code (live execution)
  runCode: (data: {
    attempt_id: string;
    question_id: string;
    language: string;
    code: string;
  }) => api.post('/api/code/run', data),
};
