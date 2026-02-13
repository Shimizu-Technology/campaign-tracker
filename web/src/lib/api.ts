import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api/v1`
  : '/api/v1';

type QueryParams = Record<string, string | number | boolean | null | undefined>;
type JsonRecord = Record<string, unknown>;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.response.use(
  response => response,
  error => {
    return Promise.reject(error);
  }
);

// Dashboard
export const getDashboard = () => api.get('/dashboard').then(r => r.data);
export const getStats = () => api.get('/stats').then(r => r.data);

// Villages
export const getVillages = () => api.get('/villages').then(r => r.data);
export const getVillage = (id: number) => api.get(`/villages/${id}`).then(r => r.data);

// Supporters
export const createSupporter = (data: JsonRecord, leaderCode?: string, entryMode?: 'staff') => {
  const params = new URLSearchParams();
  if (leaderCode) params.set('leader_code', leaderCode);
  if (entryMode === 'staff') params.set('entry_mode', 'staff');
  const query = params.toString();
  return api.post(`/supporters${query ? `?${query}` : ''}`, { supporter: data }).then(r => r.data);
};
export const getSupporters = (params?: QueryParams) => api.get('/supporters', { params }).then(r => r.data);
export const getSupporter = (id: number) => api.get(`/supporters/${id}`).then(r => r.data);
export const updateSupporter = (id: number, data: JsonRecord) =>
  api.patch(`/supporters/${id}`, { supporter: data }).then(r => r.data);
export const checkDuplicate = (name: string, villageId: number) =>
  api.get('/supporters/check_duplicate', { params: { name, village_id: villageId } }).then(r => r.data);
export const exportSupportersCsv = (params?: QueryParams) =>
  api.get('/supporters/export', { params, responseType: 'blob' }).then(r => {
    const url = URL.createObjectURL(r.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `supporters-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    return { downloaded: true };
  });

// Leaderboard
export const getLeaderboard = () => api.get('/leaderboard').then(r => r.data);

// Events
export const getEvents = (params?: QueryParams) => api.get('/events', { params }).then(r => r.data);
export const getEvent = (id: number) => api.get(`/events/${id}`).then(r => r.data);
export const createEvent = (data: JsonRecord) => api.post('/events', { event: data }).then(r => r.data);
export const checkInAttendee = (eventId: number, supporterId: number) =>
  api.post(`/events/${eventId}/check_in`, { supporter_id: supporterId }).then(r => r.data);
export const getEventAttendees = (eventId: number, search?: string) =>
  api.get(`/events/${eventId}/attendees`, { params: { search } }).then(r => r.data);

// War Room
export const getWarRoom = () => api.get('/war_room').then(r => r.data);

// Poll Watcher
export const getPollWatcher = () => api.get('/poll_watcher').then(r => r.data);
export const submitPollReport = (data: JsonRecord) => api.post('/poll_watcher/report', { report: data }).then(r => r.data);
export const getPrecinctHistory = (id: number) => api.get(`/poll_watcher/precinct/${id}/history`).then(r => r.data);

// Form Scanner (OCR)
export const scanForm = (image: string) =>
  api.post('/scan', { image }).then(r => r.data);

// SMS
export const getSmsStatus = () => api.get('/sms/status').then(r => r.data);
export const sendTestSms = (phone: string, message: string) =>
  api.post('/sms/send', { phone, message }).then(r => r.data);
export const sendSmsBlast = (data: { message: string; village_id?: number; motorcade_available?: string; registered_voter?: string; yard_sign?: string; dry_run?: string }) =>
  api.post('/sms/blast', data).then(r => r.data);
export const sendEventNotify = (eventId: number, type: string) =>
  api.post('/sms/event_notify', { event_id: eventId, type }).then(r => r.data);

export default api;
