import axios from 'axios';
import {
  User,
  Shift,
  Handover,
  Asset,
  CreateUser,
  CreateShift,
  CreateHandover,
  CreateAsset,
  UpdateAsset,
  UpdateProfile,
  Patient,
  CreatePatient,
  UpdatePatient,
  DashboardSummary,
} from './types.ts';

const API_BASE_URL = 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

// Users API
export const usersApi = {
  getAll: (): Promise<User[]> => api.get('/api/users/').then(res => res.data),
  getAllPublic: (): Promise<User[]> => api.get('/api/users/public').then(res => res.data),
  getById: (id: number): Promise<User> => api.get(`/api/users/${id}`).then(res => res.data),
  create: (user: CreateUser): Promise<User> => api.post('/api/users/', user).then(res => res.data),
  update: (id: number, user: CreateUser): Promise<User> => 
    api.put(`/api/users/${id}`, user).then(res => res.data),
  delete: (id: number): Promise<void> => api.delete(`/api/users/${id}`).then(() => {}),
};

// Profile API
export const profileApi = {
  updateProfile: (profile: UpdateProfile): Promise<User> => 
    api.put('/api/profile', profile).then(res => res.data),
};

// Shifts API
export const shiftsApi = {
  getAll: (date?: string): Promise<Shift[]> => {
    const params = date ? { date } : {};
    return api.get('/api/shifts/', { params }).then(res => res.data);
  },
  getById: (id: number): Promise<Shift> => api.get(`/api/shifts/${id}`).then(res => res.data),
  create: (shift: CreateShift): Promise<Shift> => api.post('/api/shifts/', shift).then(res => res.data),
  createMultiple: (shifts: CreateShift[]): Promise<Shift[]> => 
    api.post('/api/shifts/bulk', { shifts }).then(res => res.data),
  update: (id: number, shift: CreateShift): Promise<Shift> => 
    api.put(`/api/shifts/${id}`, shift).then(res => res.data),
  delete: (id: number): Promise<void> => api.delete(`/api/shifts/${id}`).then(() => {}),
};

// Assets API
export const assetsApi = {
  getAll: (params?: string): Promise<Asset[]> => {
    const url = params ? `/api/assets/?${params}` : '/api/assets/';
    return api.get(url).then(res => res.data);
  },
  getById: (id: number): Promise<Asset> => api.get(`/api/assets/${id}`).then(res => res.data),
  create: (asset: CreateAsset): Promise<Asset> => api.post('/api/assets/', asset).then(res => res.data),
  update: (id: number, asset: UpdateAsset): Promise<Asset> => 
    api.put(`/api/assets/${id}`, asset).then(res => res.data),
  delete: (id: number): Promise<void> => api.delete(`/api/assets/${id}`).then(() => {}),
};

// Handovers API
export const handoversApi = {
  getAll: (): Promise<Handover[]> => api.get('/api/handovers/').then(res => res.data),
  getById: (id: number): Promise<Handover> => api.get(`/api/handovers/${id}`).then(res => res.data),
  create: (handover: CreateHandover): Promise<Handover> => 
    api.post('/api/handovers/', handover).then(res => res.data),
  update: (id: number, handover: CreateHandover): Promise<Handover> => 
    api.put(`/api/handovers/${id}`, handover).then(res => res.data),
  delete: (id: number): Promise<void> => api.delete(`/api/handovers/${id}`).then(() => {}),
  export: (): Promise<any> => api.get('/api/handovers/export').then(res => res.data),
  clear: (): Promise<{message: string, deleted_count: number}> =>
    api.delete('/api/handovers/clear').then(res => res.data),
};

// Patients API
export const patientsApi = {
  getAll: (search?: string): Promise<Patient[]> => {
    const params = search ? { params: { search } } : undefined;
    return api.get('/api/patients/', params).then(res => res.data);
  },
  getById: (id: number): Promise<Patient> => api.get(`/api/patients/${id}`).then(res => res.data),
  create: (patient: CreatePatient): Promise<Patient> => api.post('/api/patients/', patient).then(res => res.data),
  update: (id: number, patient: UpdatePatient): Promise<Patient> =>
    api.put(`/api/patients/${id}`, patient).then(res => res.data),
  delete: (id: number): Promise<void> => api.delete(`/api/patients/${id}`).then(() => {}),
};

// Dashboard API
export const dashboardApi = {
  getSummary: (): Promise<DashboardSummary> => api.get('/api/dashboard/summary').then(res => res.data),
};

export default api;
