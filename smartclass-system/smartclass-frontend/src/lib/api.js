const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';

const TOKEN_KEY = 'smartclass.token';
const USER_KEY  = 'smartclass.user';

export const auth = {
  get token() { return localStorage.getItem(TOKEN_KEY); },
  get user() {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); }
    catch { return null; }
  },
  set(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
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

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, opts);
  } catch (networkErr) {
    const e = new Error('Cannot reach the server. Is the backend running on port 4000?');
    e.status = 0;
    throw e;
  }

  if (res.status === 401) {
    auth.clear();
    window.dispatchEvent(new CustomEvent('auth:expired'));
  }

  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json() : await res.blob();

  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.details = data?.details;
    throw err;
  }
  return data;
}

export const api = {
  // Auth
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: { email, password } })
      .then(d => { auth.set(d.token, d.user); return d; }),
  logout: () => auth.clear(),
  me: () => request('/auth/me'),
  changePassword: (currentPassword, newPassword) =>
    request('/auth/change-password', {
      method: 'POST', body: { currentPassword, newPassword },
    }),

  // Users
  listUsers: (q = {}) => request(`/users?${new URLSearchParams(q)}`),
  createUser: (data) => request('/users', { method: 'POST', body: data }),
  setUserStatus: (id, status) =>
    request(`/users/${id}/status`, { method: 'PATCH', body: { status } }),

  // Sections
  listSections: (q = {}) => request(`/sections?${new URLSearchParams(q)}`),
  getSection: (id) => request(`/sections/${id}`),
  createSection: (data) => request('/sections', { method: 'POST', body: data }),
  enrollStudent: (sectionId, studentId) =>
    request(`/sections/${sectionId}/enrollments`, {
      method: 'POST', body: { studentId },
    }),
  listTeachers: () => request('/sections/teachers'),
  listStudents: () => request('/sections/students'),
  listSemesters: () => request('/sections/semesters'),
  createSemester: (data) =>
    request('/sections/semesters', { method: 'POST', body: data }),
  archiveSemester: (id) =>
    request(`/sections/semesters/${id}/archive`, { method: 'PATCH' }),
  unarchiveSemester: (id) =>
    request(`/sections/semesters/${id}/unarchive`, { method: 'PATCH' }),

  // QR
  myQr: () => request('/qr/me'),
  issueQr: (studentId, semesterId) =>
    request('/qr/issue', { method: 'POST', body: { studentId, semesterId } }),
  issueQrBatch: (sectionId, semesterId) =>
    request('/qr/issue-batch', {
      method: 'POST', body: { sectionId, semesterId },
    }),
  resolveQr: (token) =>
    request('/qr/resolve', { method: 'POST', body: { token } }),
  listAllQrs: (q = {}) => {
    const params = new URLSearchParams();
    Object.entries(q).forEach(([k, v]) => { if (v) params.set(k, v); });
    return request(`/qr?${params}`);
  },
  revokeQr: (id) =>
    request(`/qr/${id}/revoke`, { method: 'PATCH' }),
  restoreQr: (id) =>
    request(`/qr/${id}/restore`, { method: 'PATCH' }),
  bulkRevokeQrs: (data) =>
    request('/qr/bulk-revoke', { method: 'POST', body: data }),

  // Attendance
  openSession: (sectionId) =>
    request('/attendance/sessions', { method: 'POST', body: { sectionId } }),
  closeSession: (id) =>
    request(`/attendance/sessions/${id}/close`, { method: 'PATCH' }),
  recordScan: (data) =>
    request('/attendance/scan', { method: 'POST', body: data }),
  sessionAttendance: (id) => request(`/attendance/sessions/${id}`),
  myAttendance: () => request('/attendance/me'),

  // Grades
  listGradeItems: (sectionId) =>
    request(`/grades/items?sectionId=${sectionId}`),
  createGradeItem: (data) =>
    request('/grades/items', { method: 'POST', body: data }),
  deleteGradeItem: (id) =>
    request(`/grades/items/${id}`, { method: 'DELETE' }),
  recordGrade: (data) => request('/grades', { method: 'POST', body: data }),
  myGrades: () => request('/grades/me'),
    myTasks: () => request('/grades/me/tasks'),
  taskDetail: (itemId) => request(`/grades/me/tasks/${itemId}`),
  submitTask: (itemId, formData) =>
    request(`/grades/items/${itemId}/submit`,
      { method: 'POST', body: formData, isForm: true }),
  mySubmission: (itemId) =>
    request(`/grades/items/${itemId}/submission/me`),
  listSubmissions: (itemId) =>
    request(`/grades/items/${itemId}/submissions`),
  submissionDownloadUrl: (subId) =>
    `${BASE_URL}/grades/submissions/${subId}/file`,
  classRoster: (sectionId) =>
    request(`/grades/sections/${sectionId}/roster`),
  gradeGrid: (sectionId) =>
    request(`/grades/sections/${sectionId}/grid`),
  recitationCall: (sectionId, mode = 'fair') =>
    request(`/grades/sections/${sectionId}/recitation?mode=${mode}`,
      { method: 'POST' }),
  recitationHistory: (sectionId) =>
    request(`/grades/sections/${sectionId}/recitation/history`),
  generateGroups: (sectionId, count = 4, mode = 'random') =>
    request(`/grades/sections/${sectionId}/groups?count=${count}&mode=${mode}`),
  attendanceTrend: (sectionId, period = 'daily') =>
    request(`/grades/sections/${sectionId}/trend?period=${period}`),

  // Attendance grid
  attendanceGrid: (sectionId, from, to) => {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    return request(`/attendance/sections/${sectionId}/grid?${q}`);
  },

  // Quiz API
  listQuizQuestions: (itemId) =>
    request(`/grades/items/${itemId}/questions`),
  upsertQuizQuestion: (itemId, data) =>
    request(`/grades/items/${itemId}/questions`, { method: 'POST', body: data }),
  deleteQuizQuestion: (itemId, qId) =>
    request(`/grades/items/${itemId}/questions/${qId}`, { method: 'DELETE' }),
  takeQuiz: (itemId) =>
    request(`/grades/items/${itemId}/quiz`),
  submitQuiz: (itemId, answers) =>
    request(`/grades/items/${itemId}/quiz/submit`,
      { method: 'POST', body: { answers } }),
  myQuizResults: (itemId) =>
    request(`/grades/items/${itemId}/quiz/results`),
  listQuizSubmissions: (itemId) =>
    request(`/grades/items/${itemId}/quiz/submissions`),
  getQuizSubmission: (itemId, studentId) =>
    request(`/grades/items/${itemId}/quiz/submissions/${studentId}`),
  gradeEssay: (itemId, answerId, awardedPoints) =>
    request(`/grades/items/${itemId}/quiz/answers/${answerId}/grade`,
      { method: 'PATCH', body: { awardedPoints } }),

  // Excuse letters
  listExcuses: (q = {}) => request(`/excuse-letters?${new URLSearchParams(q)}`),
  submitExcuse: (formData) =>
    request('/excuse-letters', { method: 'POST', body: formData, isForm: true }),
  reviewExcuse: (id, status, reviewNotes) =>
    request(`/excuse-letters/${id}/review`, {
      method: 'PATCH', body: { status, reviewNotes },
    }),

  // Notifications
  notifications: () => request('/notifications'),
  markRead: (id) =>
    request(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead: () =>
    request('/notifications/read-all', { method: 'PATCH' }),

  // Analytics
  institutionStats: () => request('/analytics/institution'),
  sectionStats: (sectionId) => request(`/analytics/sections/${sectionId}`),
  atRiskStudents: (sectionId) => {
    const q = sectionId ? `?sectionId=${sectionId}` : '';
    return request(`/analytics/at-risk${q}`);
  },
  classRanking: (sectionId) =>
    request(`/analytics/sections/${sectionId}/ranking`),
  engagementMetrics: (sectionId) =>
    request(`/analytics/sections/${sectionId}/engagement`),

  // Reports
  attendancePdfUrl: (sectionId) =>
    `${BASE_URL}/reports/attendance/sections/${sectionId}.pdf`,
  myPerformancePdfUrl: () => `${BASE_URL}/reports/performance/me.pdf`,
  institutionPdfUrl: () => `${BASE_URL}/reports/institution.pdf`,

  async downloadPdf(url, filename = 'report.pdf') {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${auth.token}` },
    });
    if (!res.ok) throw new Error('Download failed');
    const blob = await res.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  },
};

export default api;
