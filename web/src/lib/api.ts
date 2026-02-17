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
export const getSession = () => api.get('/session').then(r => r.data);

// Villages
export const getVillages = () => api.get('/villages').then(r => r.data);
export const getDistricts = () => api.get('/districts').then(r => r.data);
export const createDistrict = (data: JsonRecord) => api.post('/districts', { district: data }).then(r => r.data);
export const updateDistrict = (id: number, data: JsonRecord) => api.patch(`/districts/${id}`, { district: data }).then(r => r.data);
export const deleteDistrict = (id: number) => api.delete(`/districts/${id}`).then(r => r.data);
export const assignVillagesToDistrict = (id: number, villageIds: number[]) =>
  api.patch(`/districts/${id}/assign_villages`, { village_ids: villageIds }).then(r => r.data);
export const getVillage = (id: number) => api.get(`/villages/${id}`).then(r => r.data);
export const getQuotas = () => api.get('/quotas').then(r => r.data);
export const updateVillageQuota = (villageId: number, targetCount: number, changeNote?: string) =>
  api.patch(`/quotas/${villageId}`, { quota: { target_count: targetCount, change_note: changeNote } }).then(r => r.data);
export const getPrecincts = (params?: QueryParams) => api.get('/precincts', { params }).then(r => r.data);
export const updatePrecinct = (id: number, data: JsonRecord) =>
  api.patch(`/precincts/${id}`, { precinct: data }).then(r => r.data);

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
export const verifySupporter = (id: number, status: string) =>
  api.patch(`/supporters/${id}/verify`, { verification_status: status }).then(r => r.data);
export const bulkVerifySupporters = (ids: number[], status: string) =>
  api.post('/supporters/bulk_verify', { supporter_ids: ids, verification_status: status }).then(r => r.data);
export const getDuplicates = (villageId?: number) =>
  api.get('/supporters/duplicates', { params: villageId ? { village_id: villageId } : {} }).then(r => r.data);
export const resolveDuplicate = (id: number, resolution: string, mergeIntoId?: number) =>
  api.patch(`/supporters/${id}/resolve_duplicate`, { resolution, merge_into_id: mergeIntoId }).then(r => r.data);
export const scanDuplicates = () =>
  api.post('/supporters/scan_duplicates').then(r => r.data);
// Import
export const uploadImportPreview = (file: File) => {
  const form = new FormData();
  form.append('file', file);
  return api.post('/imports/preview', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
};
export const parseImportRows = (data: { import_key: string; sheet_index: number; column_mapping: Record<string, unknown> }) =>
  api.post('/imports/parse', data).then(r => r.data);
export const confirmImport = (data: { import_key: string; village_id?: number; rows: Record<string, unknown>[] }) =>
  api.post('/imports/confirm', data).then(r => r.data);

export const checkDuplicate = (name: string, villageId: number, firstName?: string, lastName?: string) =>
  api.get('/supporters/check_duplicate', { params: { name, village_id: villageId, first_name: firstName, last_name: lastName } }).then(r => r.data);
export const exportSupporters = (params?: QueryParams) =>
  api.get('/supporters/export', { params: { ...params, format_type: 'xlsx' }, responseType: 'blob' }).then(r => {
    const ext = (params as Record<string, string>)?.format_type === 'csv' ? 'csv' : 'xlsx';
    const url = URL.createObjectURL(r.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `supporters-${new Date().toISOString().slice(0, 10)}.${ext}`;
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
export const getPollWatcherStrikeList = (params: QueryParams) =>
  api.get('/poll_watcher/strike_list', { params }).then(r => r.data);
export const updateStrikeListTurnout = (supporterId: number, data: JsonRecord) =>
  api.patch(`/poll_watcher/strike_list/${supporterId}/turnout`, { turnout: data }).then(r => r.data);
export const createStrikeListContactAttempt = (supporterId: number, data: JsonRecord) =>
  api.post(`/poll_watcher/strike_list/${supporterId}/contact_attempts`, { contact_attempt: data }).then(r => r.data);

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
export const getSmsBlasts = () => api.get('/sms/blasts').then(r => r.data);
export const getSmsBlastStatus = (id: number) => api.get(`/sms/blasts/${id}`).then(r => r.data);

// Email
export const getEmailStatus = () => api.get('/email/status').then(r => r.data);
export const sendEmailBlast = (data: { subject: string; body: string; village_id?: number; motorcade_available?: string; registered_voter?: string; yard_sign?: string; dry_run?: string }) =>
  api.post('/email/blast', data).then(r => r.data);

// Users (admin)
export const getUsers = () => api.get('/users').then(r => r.data);
export const createUser = (data: JsonRecord) => api.post('/users', { user: data }).then(r => r.data);
export const updateUser = (id: number, data: JsonRecord) =>
  api.patch(`/users/${id}`, { user: data }).then(r => r.data);
export const resendUserInvite = (id: number) => api.post(`/users/${id}/resend_invite`).then(r => r.data);
export const deleteUser = (id: number) => api.delete(`/users/${id}`).then(r => r.data);

// Settings
export const getSettings = () => api.get('/settings').then(r => r.data);
export const updateSettings = (data: JsonRecord) => api.patch('/settings', data).then(r => r.data);

export default api;
