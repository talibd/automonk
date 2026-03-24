import axios from 'axios';

const http = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT to every request
http.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Redirect to login on 401
http.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ── Auth ──────────────────────────────────────────────────────────────────────
export const login = (password) =>
  http.post('/auth/token', { username: 'operator', password }).then((r) => r.data);

// ── Clients ───────────────────────────────────────────────────────────────────
export const getClients = () => http.get('/clients').then((r) => r.data);
export const getClient = (id) => http.get(`/clients/${id}`).then((r) => r.data);
export const createClient = (data) => http.post('/clients', data).then((r) => r.data);
export const updateClientSettings = (id, data) =>
  http.patch(`/clients/${id}/settings`, data).then((r) => r.data);
export const archiveClient = (id) => http.delete(`/clients/${id}`).then((r) => r.data);

export const getClientStrategy = (id) =>
  http.get(`/clients/${id}/strategy`).then((r) => r.data);

// ── Platform accounts ─────────────────────────────────────────────────────────
export const getPlatformAccounts = (clientId) =>
  http.get(`/clients/${clientId}/platform-accounts`).then((r) => r.data);
export const upsertPlatformAccount = (clientId, data) =>
  http.post(`/clients/${clientId}/platform-accounts`, data).then((r) => r.data);
export const createPlatformConnectSession = (clientId, platform) =>
  http.post(`/clients/${clientId}/platform-accounts/connect-session`, { platform }).then((r) => r.data);
export const createPlatformOAuthLink = (clientId, platform) =>
  http.post(`/clients/${clientId}/platform-accounts/oauth-link`, { platform }).then((r) => r.data);
export const updatePlatformAccount = (clientId, platform, data) =>
  http.patch(`/clients/${clientId}/platform-accounts/${platform}`, data).then((r) => r.data);
export const deletePlatformAccount = (clientId, platform) =>
  http.delete(`/clients/${clientId}/platform-accounts/${platform}`).then((r) => r.data);

// ── Posts ─────────────────────────────────────────────────────────────────────
// data: { topic, slideCount, clientId? } → { slides: [{slide_number, quote}] }
export const previewCarousel = (data) =>
  http.post('/posts/preview', data).then((r) => r.data);

// data: { clientId, topic, slideCount, platforms, scheduledAt, slides?, templateName? }
export const createManualCarousel = (data) =>
  http.post('/posts/manual', data).then((r) => r.data);
export const getPosts = (params) => http.get('/posts', { params }).then((r) => r.data);
export const getPost = (id) => http.get(`/posts/${id}`).then((r) => r.data);
export const approvePost = (id) => http.post(`/posts/${id}/approve`).then((r) => r.data);
export const rejectPost = (id) => http.post(`/posts/${id}/reject`).then((r) => r.data);
export const deleteVariant = (postId, variantId) =>
  http.post(`/posts/${postId}/variants/${variantId}/delete`).then((r) => r.data);

// ── Pipeline ──────────────────────────────────────────────────────────────────
export const triggerPipeline = (clientId) =>
  http.post('/pipeline/trigger', { clientId }).then((r) => r.data);

// ── Stats ─────────────────────────────────────────────────────────────────────
export const getOverviewStats = () => http.get('/stats/overview').then((r) => r.data);
export const getClientStats = (id, days = 30) =>
  http.get(`/stats/clients/${id}`, { params: { days } }).then((r) => r.data);

// ── Schedules ─────────────────────────────────────────────────────────────────
export const getSchedules = (params) =>
  http.get('/schedules', { params }).then((r) => r.data);

export default http;
