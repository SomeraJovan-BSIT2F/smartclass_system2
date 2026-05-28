// api.js — drop this into your React app's src/ directory
// Usage:  import { api, auth } from './api';

const BASE_URL = import.meta?.env?.VITE_API_URL || 'http://localhost:4000/api/v1';

const tokenKey = 'smartclass.token';
const userKey  = 'smartclass.user';

const auth = {
  get token()  { return localStorage.getItem(tokenKey); },
  get user()   { try { return JSON.parse(localStorage.getItem(userKey) || 'null'); } catch { return null; } },
  set(token, user) {
    localStorage.setItem(tokenKey, token);
    localStorage.setItem(userKey, JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem(tokenKey);
    localStorage.removeItem(userKey);
  },
};

async function request(path, { method = 'GET', body, isForm = false, headers = {} } = {}) {
  const opts = {
    method,
    headers: {
      ...(auth.token && { Authorization: `Bearer ${auth.token}` }),
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
  };
  if (body !== undefined) opts.body = isForm ? body : JSON.stringify(body);

  const res = await fetch(`${BASE_URL}${path}`, opts);

  // 401 → clear session
  if (res.status === 401) {
    auth.clear();
    window.dispatchEvent(new CustomEvent('auth:expired'));
  }

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : await res.blob();
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.details = data?.details;
    throw err;
  }
  return data;
}

// ─── API surface ─────────────────────────────────────────────────────────
export const api = {
  // Auth
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: { email, password } })
      .then(d => { auth.set(d.token, d.user); return d; }),
  logout: () => auth.clear(),
  me: () => request('/auth/me'),
  changePassword: (currentPassword, newPassword) =>
    request('/auth/change-password', { method: 'POST',
      body: { currentPassword, newPassword } }),

  // Users (admin)
  listUsers: (q = {}) =>
    request(`/users?${new URLSearchParams(q)}`),
  createUser: (data) =>
    request('/users', { method: 'POST', body: data }),
  setUserStatus: (id, status) =>
    request(`/users/${id}/status`, { method: 'PATCH', body: { status } }),

  // Sections
  listSections: (q = {}) =>
    request(`/sections?${new URLSearchParams(q)}`),
  getSection: (id) => request(`/sections/${id}`),
  createSection: (data) =>
    request('/sections', { method: 'POST', body: data }),
  enrollStudent: (sectionId, studentId) =>
    request(`/sections/${sectionId}/enrollments`,
      { method: 'POST', body: { studentId } }),

  // QR
  myQr: () => request('/qr/me'),
  issueQr: (studentId, semesterId) =>
    request('/qr/issue', { method: 'POST', body: { studentId, semesterId } }),
  issueQrBatch: (sectionId, semesterId) =>
    request('/qr/issue-batch',
      { method: 'POST', body: { sectionId, semesterId } }),
  resolveQr: (token) =>
    request('/qr/resolve', { method: 'POST', body: { token } }),

  // Attendance
  openSession: (sectionId) =>
    request('/attendance/sessions', { method: 'POST', body: { sectionId } }),
  closeSession: (id) =>
    request(`/attendance/sessions/${id}/close`, { method: 'PATCH' }),
  recordScan: ({ sessionId, qrToken, studentId, status }) =>
    request('/attendance/scan',
      { method: 'POST', body: { sessionId, qrToken, studentId, status } }),
  sessionAttendance: (id) => request(`/attendance/sessions/${id}`),
  myAttendance: () => request('/attendance/me'),

  // Grades
  listGradeItems: (sectionId) =>
    request(`/grades/items?sectionId=${sectionId}`),
  createGradeItem: (data) =>
    request('/grades/items', { method: 'POST', body: data }),
  recordGrade: (data) =>
    request('/grades', { method: 'POST', body: data }),
  myGrades: () => request('/grades/me'),
  classRoster: (sectionId) =>
    request(`/grades/sections/${sectionId}/roster`),

  // Excuse letters
  listExcuses: (q = {}) =>
    request(`/excuse-letters?${new URLSearchParams(q)}`),
  submitExcuse: (formData) =>
    request('/excuse-letters', { method: 'POST', body: formData, isForm: true }),
  reviewExcuse: (id, status, reviewNotes) =>
    request(`/excuse-letters/${id}/review`,
      { method: 'PATCH', body: { status, reviewNotes } }),

  // Notifications
  notifications: () => request('/notifications'),
  markRead: (id) =>
    request(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead: () =>
    request('/notifications/read-all', { method: 'PATCH' }),

  // Analytics
  institutionStats: () => request('/analytics/institution'),
  sectionStats: (sectionId) => request(`/analytics/sections/${sectionId}`),

  // Reports — return a download URL with token in query (or fetch as blob)
  attendancePdfUrl: (sectionId) =>
    `${BASE_URL}/reports/attendance/sections/${sectionId}.pdf`,
  myPerformancePdfUrl: () =>
    `${BASE_URL}/reports/performance/me.pdf`,

  // Helper: download a PDF using auth header (since <a href> can't add headers)
  async downloadPdf(url, filename = 'report.pdf') {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${auth.token}` } });
    if (!res.ok) throw new Error('Download failed');
    const blob = await res.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  },
};

export { auth };
export default api;
