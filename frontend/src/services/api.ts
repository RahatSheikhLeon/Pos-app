import axios from 'axios';
import { Product, Settings, CheckoutPayload, Member, SubscriptionPlan, UserSubscription, Payment } from '../types';

const TOKEN_KEY = 'shopiq_token';

const http = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT on every request
http.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const message = err.response?.data?.message || 'Request failed';
    if (err.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      window.location.href = '/login';
    }
    return Promise.reject(new Error(Array.isArray(message) ? message[0] : message));
  }
);

// ── Auth ──────────────────────────────────────────────────────────
export const authApi = {
  register: (email: string, password: string, name: string): Promise<any> =>
    http.post('/auth/register', { email, password, name }),
  login: (email: string, password: string): Promise<any> =>
    http.post('/auth/login', { email, password }),
  profile: (): Promise<any> => http.get('/auth/profile'),
};

// ── Products ─────────────────────────────────────────────────────
export const productsApi = {
  getAll: (params?: { search?: string; category?: string }): Promise<Product[]> =>
    http.get('/products', { params }),
  getById: (id: string): Promise<Product> => http.get(`/products/${id}`),
  getCategories: (): Promise<string[]> => http.get('/products/categories'),
  create: (data: Partial<Product>): Promise<Product> => http.post('/products', data),
  update: (id: string, data: Partial<Product>): Promise<Product> =>
    http.put(`/products/${id}`, data),
  remove: (id: string): Promise<void> => http.delete(`/products/${id}`),
};

// ── Members ──────────────────────────────────────────────────────
export const membersApi = {
  getAll: (): Promise<Member[]> => http.get('/members'),
  search: (q: string): Promise<Member[]> => http.get('/members/search', { params: { q } }),
  getById: (id: string): Promise<Member> => http.get(`/members/${id}`),
  create: (data: Partial<Member>): Promise<Member> => http.post('/members', data),
  update: (id: string, data: Partial<Member>): Promise<Member> =>
    http.put(`/members/${id}`, data),
};

// ── Carts ────────────────────────────────────────────────────────
export const cartsApi = {
  getAll: (): Promise<any[]> => http.get('/carts'),
  upsert: (cartId: string, cart: any): Promise<any> => http.put(`/carts/${cartId}`, cart),
  remove: (cartId: string): Promise<void> => http.delete(`/carts/${cartId}`),
};

// ── Checkout ─────────────────────────────────────────────────────
export const checkoutApi = {
  process: (data: CheckoutPayload): Promise<any> => http.post('/checkout', data),
};

// ── Transactions ─────────────────────────────────────────────────
export const transactionsApi = {
  getAll: (params?: { search?: string; dateFrom?: string; dateTo?: string }): Promise<any> =>
    http.get('/transactions', { params }),
  getById: (id: string): Promise<any> => http.get(`/transactions/${id}`),
  returnTransaction: (
    id: string,
    items?: { productId: string; quantity: number }[]
  ): Promise<any> => http.post(`/transactions/${id}/return`, { items }),
};

// ── Dashboard ────────────────────────────────────────────────────
export const dashboardApi = { get: (): Promise<any> => http.get('/dashboard') };

// ── Reports ──────────────────────────────────────────────────────
export const reportsApi = {
  get: (days: number): Promise<any> => http.get('/reports', { params: { days } }),
};

// ── Settings ─────────────────────────────────────────────────────
export const settingsApi = {
  get: (): Promise<Settings> => http.get('/settings'),
  update: (data: Partial<Settings>): Promise<Settings> => http.put('/settings', data),
};

// ── Devices ──────────────────────────────────────────────────────
export const devicesApi = {
  list: (): Promise<any[]> => http.get('/devices'),
  register: (fingerprint: string, name?: string): Promise<any> =>
    http.post('/devices/register', { fingerprint, name }),
  remove: (id: string): Promise<void> => http.delete(`/devices/${id}`),
};

// ── Licenses ─────────────────────────────────────────────────────
export const licensesApi = {
  activate: (licenseKey: string): Promise<any> =>
    http.post('/licenses/activate', { licenseKey }),
  getMine: (): Promise<any> => http.get('/licenses/mine'),
};

// ── Subscription Plans ───────────────────────────────────────────
export const subscriptionPlansApi = {
  getAll: (): Promise<SubscriptionPlan[]> => http.get('/subscription-plans'),
};

// ── User Subscriptions ───────────────────────────────────────────
export const userSubscriptionsApi = {
  getMy: (): Promise<UserSubscription | null> => http.get('/subscriptions/my'),
};

// ── Payments (single source of truth for subscription transactions) ──
export const paymentsApi = {
  initiate: (planId: string): Promise<{ payment: Payment; trxId: string; paymentUrl: string | null; successUrl: string; failUrl: string }> =>
    http.post('/payments/initiate', { planId }),
  getMine: (): Promise<Payment[]> => http.get('/payments/my'),
  getByTrxId: (trxId: string): Promise<Payment> => http.get(`/payments/trx/${trxId}`),
  confirmSuccess: (trxId: string): Promise<{ success: boolean }> =>
    http.post(`/payments/confirm-success?trx_id=${trxId}`),
  confirmFailed: (trxId: string): Promise<{ success: boolean }> =>
    http.post(`/payments/confirm-failed?trx_id=${trxId}`),
};
