import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

// Dashboard
export const getDashboard = () => api.get('/dashboard').then(r => r.data);
export const getStats = () => api.get('/stats').then(r => r.data);

// Villages
export const getVillages = () => api.get('/villages').then(r => r.data);
export const getVillage = (id: number) => api.get(`/villages/${id}`).then(r => r.data);

// Supporters
export const createSupporter = (data: any, leaderCode?: string) =>
  api.post(`/supporters${leaderCode ? `?leader_code=${leaderCode}` : ''}`, { supporter: data }).then(r => r.data);
export const getSupporters = (params?: any) => api.get('/supporters', { params }).then(r => r.data);
export const checkDuplicate = (name: string, villageId: number) =>
  api.get('/supporters/check_duplicate', { params: { name, village_id: villageId } }).then(r => r.data);
export const exportSupportersCsv = (params?: any) =>
  api.get('/supporters/export', { params, responseType: 'blob' }).then(r => {
    const url = URL.createObjectURL(r.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `supporters-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

// Leaderboard
export const getLeaderboard = () => api.get('/leaderboard').then(r => r.data);

// Events
export const getEvents = (params?: any) => api.get('/events', { params }).then(r => r.data);
export const getEvent = (id: number) => api.get(`/events/${id}`).then(r => r.data);
export const createEvent = (data: any) => api.post('/events', { event: data }).then(r => r.data);
export const checkInAttendee = (eventId: number, supporterId: number) =>
  api.post(`/events/${eventId}/check_in`, { supporter_id: supporterId }).then(r => r.data);
export const getEventAttendees = (eventId: number, search?: string) =>
  api.get(`/events/${eventId}/attendees`, { params: { search } }).then(r => r.data);

// Poll Watcher
export const getPollWatcher = () => api.get('/poll_watcher').then(r => r.data);
export const submitPollReport = (data: any) => api.post('/poll_watcher/report', { report: data }).then(r => r.data);
export const getPrecinctHistory = (id: number) => api.get(`/poll_watcher/precinct/${id}/history`).then(r => r.data);

export default api;
