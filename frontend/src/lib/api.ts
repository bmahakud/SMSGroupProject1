export interface DepartmentData {
  capacityHours?: number[];
  loadHours?: number[];
  ordersCount?: number[];
  groupCompany?: number[];
  contractMfg?: number[];
  laborSupply?: number[];
  millingLoad?: number[];
  latheLoad?: number[];
  refurbLoad?: number[];
  platingLoad?: number[];
  serviceLoad?: number[];
  loi?: number[];
  smi?: number[];
  serviceBasic?: number[];
}

export interface PlanningVersion {
  id: number;
  version_id: string;
  month_name: string;
  horizon: string;
  upload_date: string;
  uploaded_by: string;
  status: string;
  file_name: string;
  file_size: string;
  processing_time_ms: number;
  months: string[];
  departments: Record<string, DepartmentData>;
  chart_urls?: Record<string, string>;
  validation_warnings: string[];
}

export interface BenchmarkItem {
  id: number;
  department: string;
  name: string;
  target_utilization: number;
  max_threshold: number;
  historical_baseline: number;
  description: string;
}

export interface AuthUser {
  username: string;
  name?: string;
  email: string;
  role: 'administrator' | 'user';
  is_superuser: boolean;
  is_staff: boolean;
}

export interface AuthResponse {
  access: string;
  refresh: string;
  user: AuthUser;
}

export function getApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  if (
    typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1'
  ) {
    return '/api/v1';
  }

  return 'http://127.0.0.1:8000/api/v1';
}

export function getChartUrl(url: string | undefined): string {
  if (!url) return '';

  if (url.startsWith('http://localhost:8000') || url.startsWith('http://127.0.0.1:8000')) {
    return url.replace(/^http:\/\/(localhost|127\.0\.0\.1):8000/, '');
  }

  return url;
}

export async function refreshAccessToken(): Promise<string | null> {
  try {
    const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refresh') : null;
    if (!refreshToken) return null;

    const apiBase = getApiBaseUrl();
    const res = await fetch(`${apiBase}/auth/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (!res.ok) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('access');
        localStorage.removeItem('refresh');
        localStorage.removeItem('sms_user');
      }
      return null;
    }

    const data = await res.json();
    if (data && data.access) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('access', data.access);
        if (data.refresh) {
          localStorage.setItem('refresh', data.refresh);
        }
      }
      return data.access;
    }
    return null;
  } catch (err) {
    console.warn('Error refreshing JWT token:', err);
    return null;
  }
}

export async function authenticatedFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const options: RequestInit = init ? { ...init } : {};
  const headers = new Headers(options.headers || {});

  let token = typeof window !== 'undefined' ? localStorage.getItem('access') : null;
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  options.headers = headers;

  let response = await fetch(input, options);

  // If 401 Unauthorized, attempt token refresh once
  if (response.status === 401 && token) {
    const newAccessToken = await refreshAccessToken();
    if (newAccessToken) {
      const retryHeaders = new Headers(init?.headers || {});
      retryHeaders.set('Authorization', `Bearer ${newAccessToken}`);
      options.headers = retryHeaders;
      response = await fetch(input, options);
    }
  }

  return response;
}

export async function verifyCurrentToken(): Promise<AuthUser | null> {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access') : null;
    if (!token) return null;

    const apiBase = getApiBaseUrl();
    let res = await fetch(`${apiBase}/auth/me/`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        res = await fetch(`${apiBase}/auth/me/`, {
          headers: { Authorization: `Bearer ${newToken}` },
        });
      }
    }

    if (res.ok) {
      const data = await res.json();
      if (data && data.success && data.user) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('sms_user', JSON.stringify(data.user));
        }
        return data.user;
      }
    }
    return null;
  } catch (err) {
    console.warn('Failed to verify token:', err);
    return null;
  }
}

export async function logoutUserApi(): Promise<void> {
  try {
    const apiBase = getApiBaseUrl();
    const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refresh') : null;
    if (refreshToken) {
      await authenticatedFetch(`${apiBase}/auth/logout/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: refreshToken }),
      });
    }
  } catch (e) {
    console.warn('Logout API error:', e);
  } finally {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access');
      localStorage.removeItem('refresh');
      localStorage.removeItem('sms_user');
      localStorage.clear();
    }
  }
}

export async function fetchPlanningVersions(): Promise<PlanningVersion[]> {
  try {
    const apiBase = getApiBaseUrl();
    const res = await authenticatedFetch(`${apiBase}/versions/`);
    if (!res.ok) throw new Error('Failed to fetch planning versions');
    return await res.json();
  } catch (error) {
    console.warn('API connection offline, using fallback state:', error);
    return [];
  }
}

export async function fetchLatestPlanningVersion(): Promise<PlanningVersion | null> {
  try {
    const apiBase = getApiBaseUrl();
    const res = await authenticatedFetch(`${apiBase}/versions/latest/`);
    if (!res.ok) throw new Error('Failed to fetch latest version');
    return await res.json();
  } catch (error) {
    console.warn('API connection offline, using fallback state:', error);
    return null;
  }
}

export async function fetchBenchmarks(): Promise<BenchmarkItem[]> {
  try {
    const apiBase = getApiBaseUrl();
    const res = await authenticatedFetch(`${apiBase}/benchmarks/`);
    if (!res.ok) throw new Error('Failed to fetch benchmarks');
    return await res.json();
  } catch (error) {
    console.warn('API connection offline, using fallback state:', error);
    return [];
  }
}

export async function uploadPlanningSpreadsheet(file: File): Promise<PlanningVersion> {
  const formData = new FormData();
  formData.append('file', file);

  const apiBase = getApiBaseUrl();
  const res = await authenticatedFetch(`${apiBase}/versions/upload_planning/`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    throw new Error('Spreadsheet upload failed');
  }

  return await res.json();
}

export async function loginUser(
  username: string,
  password: string,
  loginType: 'administrator' | 'user'
): Promise<AuthResponse> {
  if (!username.trim() || !password) {
    throw new Error('Username and password are required');
  }

  const apiBase = getApiBaseUrl();

  try {
    const res = await fetch(`${apiBase}/auth/login/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: username.trim(),
        password,
        role: loginType,
        login_type: loginType,
      }),
    });

    const data = await res.json().catch(() => null);

    if (res.ok && data && data.access && data.refresh && data.user) {
      const backendUser = data.user;
      const role: 'administrator' | 'user' =
        backendUser.role ||
        (backendUser.is_superuser || backendUser.is_staff ? 'administrator' : 'user');

      return {
        user: {
          username: backendUser.username,
          name: backendUser.name || (backendUser.username === 'admin' ? 'J. Smith (Sr. Production Planner)' : backendUser.username),
          email: backendUser.email || `${backendUser.username}@sms-group.com`,
          role,
          is_superuser: Boolean(backendUser.is_superuser),
          is_staff: Boolean(backendUser.is_staff),
        },
        access: data.access,
        refresh: data.refresh,
      };
    }

    if (data && data.error) {
      throw new Error(data.error);
    }

    throw new Error('Authentication failed. Invalid response from server.');
  } catch (err: any) {
    if (err.message && !err.message.includes('Failed to fetch') && !err.message.includes('FetchError') && !err.message.includes('NetworkError') && !err.message.includes('JSON')) {
      throw err;
    }

    throw new Error('Network error: Unable to reach authentication server. Please check backend connection.');
  }
}

export interface CalculatedTaskItem {
  id: string;
  name: string;
  category: string;
  monthly_hours: number;
  daily_hours: number;
  days_in_month: number;
  share_pct: number;
}

export interface MonthlyCalculation {
  month: string;
  month_num: number;
  days_in_month: number;
  monthly_available_hours: number;
  daily_available_hours: number;
  tasks: CalculatedTaskItem[];
}

export interface ManualCalculationResponse {
  status: string;
  inputs: {
    annual_hours: number;
    year: number;
    is_leap_year: boolean;
    total_days_in_year: number;
    daily_available_hours: number;
    total_tasks_count: number;
  };
  monthly_calculations: MonthlyCalculation[];
}

export async function calculateManualPlanning(
  annualHours: number, 
  year: number = 2026, 
  tasks: Array<{ id: string; name: string; category?: string; hours: number }>
): Promise<ManualCalculationResponse | null> {
  try {
    const apiBase = getApiBaseUrl();
    const res = await authenticatedFetch(`${apiBase}/versions/calculate_manual_planning/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ annual_hours: annualHours, year, tasks })
    });
    if (!res.ok) throw new Error('Failed to compute manual planning calculations');
    return await res.json();
  } catch (err) {
    console.warn('API error computing manual planning, fallback to local math:', err);
    return null;
  }
}

export async function fetchManualConfig(): Promise<{ year: number; tasks: any[] } | null> {
  try {
    const apiBase = getApiBaseUrl();
    const res = await authenticatedFetch(`${apiBase}/versions/get_manual_config/`);
    if (!res.ok) throw new Error('Failed to fetch manual config');
    return await res.json();
  } catch (err) {
    console.warn('API error fetching manual config:', err);
    return null;
  }
}

export async function saveManualConfig(year: number, tasks: any[]): Promise<boolean> {
  try {
    const apiBase = getApiBaseUrl();
    const res = await authenticatedFetch(`${apiBase}/versions/save_manual_config/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year, tasks })
    });
    return res.ok;
  } catch (err) {
    console.warn('API error saving manual config:', err);
    return false;
  }
}

export interface ProjectTaskMonthlyDistribution {
  id?: number;
  month_index: number;
  month_label: string;
  date?: string;
  hours: number;
  percentage: number;
}

export interface ProjectTask {
  id?: number;
  task_name: string;
  task_code: string;
  allocated_hours: number;
  duration_months: number;
  start_date?: string;
  location?: string;
  smi?: string;
  labour_supply?: string;
  job_contractor?: string;
  monthly_distributions?: ProjectTaskMonthlyDistribution[];
}

export interface BackendProject {
  id?: number;
  customer_name?: string;
  wbs_no?: string;
  project_code?: string;
  location?: string;
  project_name: string;
  project_number: string;
  equipment_name?: string;
  equipment_weight?: string;
  description?: string;
  zero_date?: string;
  cdd?: string;
  project_manager?: string;
  total_planned_hours: number;
  priority: string;
  status: string;
  tasks?: ProjectTask[];
  created_at?: string;
  updated_at?: string;
}

export interface WeldingPreviewResponse {
  status: string;
  task_name: string;
  allocated_hours: number;
  duration_months: number;
  start_date: string;
  rule_applied: string;
  monthly_breakdown: ProjectTaskMonthlyDistribution[];
}

export async function fetchBackendProjects(): Promise<BackendProject[]> {
  try {
    const apiBase = getApiBaseUrl();
    const res = await authenticatedFetch(`${apiBase}/projects/`);
    if (!res.ok) throw new Error('Failed to fetch backend projects');
    return await res.json();
  } catch (err) {
    console.warn('API error fetching backend projects:', err);
    return [];
  }
}

export async function previewWeldingCalculation(
  allocatedHours: number,
  durationMonths: number,
  startDate: string = "2026-08-01"
): Promise<WeldingPreviewResponse | null> {
  try {
    const apiBase = getApiBaseUrl();
    const res = await authenticatedFetch(`${apiBase}/projects/preview_welding_calculation/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        allocated_hours: allocatedHours,
        duration_months: durationMonths,
        start_date: startDate
      })
    });
    if (!res.ok) throw new Error('Failed previewing welding calculation');
    return await res.json();
  } catch (err) {
    console.warn('API error previewing welding calculation:', err);
    return null;
  }
}

export async function updateBackendProject(id: number | string, data: any): Promise<BackendProject | null> {

  try {
    const apiBase = getApiBaseUrl();
    const res = await authenticatedFetch(`${apiBase}/projects/${id}/`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed updating backend project');
    return await res.json();
  } catch (err) {
    console.warn('API error updating project:', err);
    return null;
  }
}
