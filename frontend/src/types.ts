export interface User {
  id: number;
  username: string;
  name: string;
  position: string;
  phone?: string;
  telegram_id?: string;
  email?: string;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
}

export interface Shift {
  id: number;
  date: string;
  start_time: string;
  end_time: string;
  shift_type: string;
  user_id: number;
  user_name: string;
  position: string;
  patient_id?: number;
  patient_name?: string;
  status: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Asset {
  id: number;
  title: string;
  description: string;
  asset_type: 'CASE' | 'CHANGE_MANAGEMENT' | 'ORANGE_CASE' | 'CLIENT_REQUESTS';
  status: 'Active' | 'Completed' | 'On Hold';
  created_at: string;
  updated_at: string;
}

export interface CreateAsset {
  title: string;
  description: string;
  asset_type: 'CASE' | 'CHANGE_MANAGEMENT' | 'ORANGE_CASE' | 'CLIENT_REQUESTS';
  status: 'Active' | 'Completed' | 'On Hold';
}

export interface UpdateAsset {
  title?: string;
  description?: string;
  asset_type?: 'CASE' | 'CHANGE_MANAGEMENT' | 'ORANGE_CASE' | 'CLIENT_REQUESTS';
  status?: 'Active' | 'Completed' | 'On Hold';
}

export interface Handover {
  id: number;
  from_shift_id?: number;
  to_shift_id?: number;
  handover_notes: string;
  assets: Asset[];
  created_at: string;
}

export interface CreateUser {
  username: string;
  password: string;
  name: string;
  position: string;
  phone?: string;
  telegram_id?: string;
  email?: string;
  is_admin?: boolean;
}

export interface UpdateProfile {
  name: string;
  position: string;
  phone?: string;
  telegram_id?: string;
  email?: string;
}

export interface LoginUser {
  username: string;
  password: string;
}

export interface AuthToken {
  access_token: string;
  token_type: string;
}

export interface CreateShift {
  date: string;
  start_time: string;
  end_time: string;
  shift_type: string;
  user_id: number;
  patient_id?: number;
  notes?: string;
}

export interface CreateHandover {
  from_shift_id?: number;
  to_shift_id?: number;
  handover_notes: string;
  asset_ids: number[];
}

export interface Patient {
  id: number;
  full_name: string;
  birth_date?: string;
  gender?: string;
  phone?: string;
  email?: string;
  address?: string;
  policy_number?: string;
  blood_type?: string;
  allergies?: string;
  chronic_conditions?: string;
  medications?: string;
  attending_physician?: string;
  last_visit?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CreatePatient {
  full_name: string;
  birth_date?: string;
  gender?: string;
  phone?: string;
  email?: string;
  address?: string;
  policy_number?: string;
  blood_type?: string;
  allergies?: string;
  chronic_conditions?: string;
  medications?: string;
  attending_physician?: string;
  last_visit?: string;
  notes?: string;
}

export interface UpdatePatient extends Partial<CreatePatient> {}

export interface DashboardSummary {
  total_patients: number;
  total_staff: number;
  active_cases: number;
  upcoming_appointments: number;
  next_appointments: Shift[];
  recent_patients: Patient[];
}
