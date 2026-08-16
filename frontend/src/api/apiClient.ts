// File: src/api/apiClient.ts

import axios from 'axios';
import toast from 'react-hot-toast'; // Import toast for the interceptor
import type {
  DashboardData, BudgetPageData, Category, Transaction, Tag, TagExcludedPage, Account, AnalyticsData, User, Alert,
  Merchant, MerchantCluster, RescanResult, Goal, Subscription, AssistantChatMessage, AssistantHealth,
  AssistantStreamEvent,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

// Checks both storages — localStorage for "Remember Me" sessions, sessionStorage for tab sessions
const getToken = (): string | null =>
  localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');

const clearToken = () => {
  localStorage.removeItem('accessToken');
  sessionStorage.removeItem('accessToken');
};

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use(config => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, error => Promise.reject(error));

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      toast.error('Your session has expired. Please log in again.');
      clearToken();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);


// --- Authentication Functions ---
export const login = async (identifier: string, password: string, rememberMe = false): Promise<{ access_token: string }> => {
  const response = await apiClient.post('/auth/login', { identifier, password, remember_me: rememberMe });
  if (response.data.access_token) {
    if (rememberMe) {
      localStorage.setItem('accessToken', response.data.access_token);
    } else {
      sessionStorage.setItem('accessToken', response.data.access_token);
    }
  }
  return response.data;
};
export const register = (userData: any): Promise<any> => apiClient.post('/auth/register', userData).then(res => res.data);
export const logout = () => {
  clearToken();
  window.location.href = '/login';
};
export const changePassword = (data: { old_password: string; new_password: string }): Promise<{ message: string }> =>
  apiClient.post('/auth/change-password', data).then(res => {
    // Backend bumps token_version (revoking other sessions) and returns a fresh
    // token for THIS session — save it into whichever storage holds the current one.
    const t = res.data.access_token;
    if (t) {
      if (localStorage.getItem('accessToken')) localStorage.setItem('accessToken', t);
      else sessionStorage.setItem('accessToken', t);
    }
    return res.data;
  });
export const getMyProfile = (): Promise<User> => apiClient.get<User>('/users/me').then(res => res.data);

// --- Password Recovery (security question) ---
export const setSecurityQuestion = (data: { current_password: string; question: string; answer: string }): Promise<{ message: string }> =>
  apiClient.post('/auth/security-question', data).then(res => res.data);
export const getRecoveryQuestion = (identifier: string): Promise<{ question: string }> =>
  apiClient.post('/auth/recovery/question', { identifier }).then(res => res.data);
export const resetPasswordWithAnswer = (data: { identifier: string; answer: string; new_password: string }): Promise<{ message: string }> =>
  apiClient.post('/auth/recovery/reset', data).then(res => res.data);

// --- Your Existing API Functions (No changes needed below) ---

// 1. Dashboard
export const getDashboardData = (month: string): Promise<DashboardData> => {
  return apiClient.get<DashboardData>(`/dashboard?month=${month}`).then(res => res.data);
};

// 2. Budgets
export const getBudgetPlan = (month: string): Promise<BudgetPageData> => {
  return apiClient.get<BudgetPageData>(`/budgets/plan?month=${month}`).then(res => res.data);
};
export const saveBudgetPlan = (planData: { month: string; budgets: { category_id: number, limit_amount: number }[] }): Promise<any> => {
  return apiClient.post('/budgets/plan', planData).then(res => res.data);
};
export const deleteBudgetPlan = (month: string): Promise<any> => {
  return apiClient.delete(`/budgets/plan?month=${month}`).then(res => res.data);
};

// 3. Transactions
export const getTransactions = (filters: any): Promise<{ total_count: number; transactions: Transaction[] }> => {
    return apiClient.get('/transactions', { params: filters }).then(res => res.data);
};
export const createTransaction = (transactionData: Partial<Transaction>): Promise<Transaction> => {
    return apiClient.post('/transactions', transactionData).then(res => res.data);
};
export const updateTransaction = (id: number, transactionData: Partial<Transaction>): Promise<Transaction> => {
    return apiClient.put(`/transactions/${id}`, transactionData).then(res => res.data);
};
export const deleteTransaction = (id: number): Promise<void> => {
    return apiClient.delete(`/transactions/${id}`);
};

// 4. Settings
export const getCategories = (): Promise<Category[]> => apiClient.get<Category[]>('/categories').then(res => res.data);
export const createCategory = (data: { name: string; is_income: boolean; icon_name?: string | null }): Promise<Category> => apiClient.post<Category>('/categories', data).then(res => res.data);
export const updateCategory = (id: number, data: Partial<Category>): Promise<Category> => apiClient.put<Category>(`/categories/${id}`, data).then(res => res.data);
export const deleteCategory = (id: number): Promise<void> => apiClient.delete(`/categories/${id}`).then(res => res.data);
export const getTags = (): Promise<Tag[]> => apiClient.get<Tag[]>('/tags').then(res => res.data);
export const createTag = (data: { name: string; excluded_pages: TagExcludedPage[] }): Promise<Tag> => apiClient.post<Tag>('/tags', data).then(res => res.data);
export const updateTag = (id: number, data: { name: string; excluded_pages: TagExcludedPage[] }): Promise<Tag> => apiClient.put<Tag>(`/tags/${id}`, data).then(res => res.data);
export const deleteTag = (id: number): Promise<void> => apiClient.delete(`/tags/${id}`).then(res => res.data);
export const getAccounts = (): Promise<Account[]> => apiClient.get<Account[]>('/accounts').then(res => res.data);
export const createAccount = (accountData: { name: string; type: string; provider: string; }): Promise<Account> => {
    return apiClient.post<Account>('/accounts', accountData).then(res => res.data);
};
export const updateAccount = (id: number, data: Partial<Account>): Promise<Account> => apiClient.put<Account>(`/accounts/${id}`, data).then(res => res.data);
export const deleteAccount = (id: number): Promise<void> => apiClient.delete(`/accounts/${id}`).then(res => res.data);
export const deleteMyAccount = (data: { password: string }): Promise<any> => {
    return apiClient.delete('/users/me', { data }).then(res => res.data);
};

// 5. File Upload
export const uploadStatements = (files: File[]): Promise<any> => {
  const formData = new FormData();
  files.forEach(file => formData.append('files', file));
  return apiClient.post('/settings/upload-statements', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(res => res.data);
};

// 6. Analytics
//! THIS IS THE FIX: The function now accepts the second argument and passes it as a parameter.
export const getAnalyticsData = (timePeriod: string, includeCapitalTransfers: boolean): Promise<AnalyticsData> => {
  return apiClient.get<AnalyticsData>('/analytics', { 
    params: {
      time_period: timePeriod,
      include_capital_transfers: includeCapitalTransfers
    }
  }).then(res => res.data);
  
};

// 7. Alerts (New Section)
export const getUnreadAlerts = (): Promise<Alert[]> => {
  return apiClient.get<Alert[]>('/alerts/unread').then(res => res.data);
};

export const acknowledgeAlert = (alertId: number): Promise<Alert> => {
  return apiClient.put<Alert>(`/alerts/${alertId}/acknowledge`).then(res => res.data);
};

export const acknowledgeAllAlerts = (): Promise<{ acknowledged: number }> => {
  return apiClient.put<{ acknowledged: number }>('/alerts/read-all').then(res => res.data);
};

// 8. Merchants
export const getMerchants = (q?: string): Promise<Merchant[]> => {
  return apiClient.get<Merchant[]>('/merchants/', { params: q ? { q } : undefined }).then(res => res.data);
};
export const createMerchant = (data: { name: string; category_id: number | null }): Promise<Merchant> => {
  return apiClient.post<Merchant>('/merchants/', data).then(res => res.data);
};
export const updateMerchant = (id: number, data: { name: string; category_id: number | null }): Promise<Merchant> => {
  return apiClient.put<Merchant>(`/merchants/${id}`, data).then(res => res.data);
};
export const deleteMerchant = (id: number): Promise<Merchant> => {
  return apiClient.delete<Merchant>(`/merchants/${id}`).then(res => res.data);
};
export const getUnmappedMerchantCount = (): Promise<number> => {
  return apiClient.get<{ count: number }>('/merchants/unmapped-count').then(res => res.data.count);
};
export const getMerchantClusters = (): Promise<MerchantCluster[]> => {
  return apiClient.get<MerchantCluster[]>('/merchants/clusters').then(res => res.data);
};
export const rescanMerchants = (): Promise<RescanResult> => {
  return apiClient.post<RescanResult>('/merchants/rescan').then(res => res.data);
};

// 9. Goals (per-category monthly limits -- Budgets page "Category limits" section)
export const getGoals = (month: string): Promise<Goal[]> => {
  return apiClient.get<Goal[]>('/goals/', { params: { month } }).then(res => res.data);
};
export const createGoal = (data: { category_id: number; month: string; limit_amount: number }): Promise<Goal> => {
  return apiClient.post<Goal>('/goals/', data).then(res => res.data);
};
export const updateGoal = (id: number, data: { limit_amount: number }): Promise<Goal> => {
  return apiClient.put<Goal>(`/goals/${id}`, data).then(res => res.data);
};
export const deleteGoal = (id: number): Promise<Goal> => {
  return apiClient.delete<Goal>(`/goals/${id}`).then(res => res.data);
};

// 10. Subscriptions (Bill Radar)
export const getSubscriptions = (includeInactive = false): Promise<Subscription[]> => {
  return apiClient.get<Subscription[]>('/subscriptions/', { params: { include_inactive: includeInactive } }).then(res => res.data);
};
export const createSubscription = (data: {
  name: string; description?: string | null; amount: number; interval: Subscription['interval'];
  first_due_date: string; last_paid_date?: string | null;
}): Promise<Subscription> => {
  return apiClient.post<Subscription>('/subscriptions/', data).then(res => res.data);
};
export const updateSubscription = (id: number, data: Partial<{
  name: string; description: string | null; amount: number; interval: Subscription['interval'];
  is_active: boolean; first_due_date: string; last_paid_date: string | null;
}>): Promise<Subscription> => {
  return apiClient.put<Subscription>(`/subscriptions/${id}`, data).then(res => res.data);
};
export const deleteSubscription = (id: number): Promise<Subscription> => {
  return apiClient.delete<Subscription>(`/subscriptions/${id}`).then(res => res.data);
};
export const paySubscription = (id: number, paidForDate?: string): Promise<Subscription> => {
  return apiClient.put<Subscription>(`/subscriptions/${id}/pay`, paidForDate ? { paid_for_date: paidForDate } : {}).then(res => res.data);
};
export const unpaySubscription = (id: number): Promise<Subscription> => {
  return apiClient.put<Subscription>(`/subscriptions/${id}/unpay`).then(res => res.data);
};

// 11. Assistant (read-only chat + voice)
export const getAssistantHealth = (): Promise<AssistantHealth> => {
  return apiClient.get<AssistantHealth>('/assistant/health').then(res => res.data);
};

export const transcribeAudio = (blob: Blob): Promise<string> => {
  const formData = new FormData();
  formData.append('file', blob, 'recording.webm');
  return apiClient.post<{ text: string }>('/assistant/transcribe', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(res => res.data.text);
};

/**
 * Streams one assistant turn as parsed SSE events. Uses raw fetch() rather
 * than the axios instance above -- axios doesn't expose a readable byte
 * stream for POST responses in the browser, and the native EventSource API
 * only supports GET (this endpoint needs a JSON body + auth header), so
 * there's no way to reuse either. Auth/base-URL/401-handling are duplicated
 * here deliberately, matching apiClient's own logic, rather than threading a
 * streaming response back through the axios interceptor chain.
 */
export async function* streamAssistantChat(
  messages: AssistantChatMessage[],
  month?: string,
  signal?: AbortSignal,
): AsyncGenerator<AssistantStreamEvent> {
  const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
  const response = await fetch(`${API_BASE_URL}/assistant/chat`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ messages, month }),
  });

  if (response.status === 401) {
    clearToken();
    window.location.href = '/login';
    throw new Error('Session expired.');
  }
  if (!response.ok || !response.body) {
    let message = `Assistant request failed (${response.status}).`;
    try {
      const body = await response.json();
      message = body?.detail?.message || body?.detail || message;
    } catch { /* body wasn't JSON -- keep the generic message */ }
    throw new Error(message);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE frames are separated by a blank line; each frame's payload is
    // whatever follows every "data: " line in it (there's only ever one here).
    let sepIndex: number;
    while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, sepIndex);
      buffer = buffer.slice(sepIndex + 2);
      const line = frame.split('\n').find(l => l.startsWith('data: '));
      if (!line) continue;
      try {
        yield JSON.parse(line.slice(6)) as AssistantStreamEvent;
      } catch {
        // Malformed frame -- skip rather than crash the whole stream.
      }
    }
  }
}


export default apiClient;

