import axios from 'axios';
import {
  Product, Settings, CheckoutPayload, Member,
  SubscriptionPlan, UserSubscription, Payment,
} from '../types';

const http = axios.create({
  baseURL: '/api',
  timeout: 10000,
  withCredentials: true, // send HttpOnly cookies on every request
  headers: { 'Content-Type': 'application/json' },
});

http.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const message = err.response?.data?.message || 'Request failed';
    if (err.response?.status === 401 && !window.location.pathname.includes('/login')) {
      window.location.href = '/login';
    }
    return Promise.reject(new Error(Array.isArray(message) ? message[0] : message));
  }
);

// ── Auth ──────────────────────────────────────────────────────────
export const authApi = {
  register: (email: string, password: string, name: string, fingerprint?: string): Promise<any> =>
    http.post('/auth/register', { email, password, name, ...(fingerprint ? { fingerprint } : {}) }),
  login: (email: string, password: string, fingerprint?: string): Promise<any> =>
    http.post('/auth/login', { email, password, ...(fingerprint ? { fingerprint } : {}) }),
  logout: (): Promise<any> => http.post('/auth/logout'),
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
export interface CartItemRow {
  id: string;
  userId: string;
  sessionId: string;
  productId: string;
  qty: number;
  price: number;
  subtotal: number;
  createdAt: string;
  updatedAt: string;
  product: Product | null;
}

// Session metadata row — one per cart tab, carries customer identity and discount
export interface CartSessionRow {
  id: string;          // = sessionId
  userId: string;
  customerId: string | null;
  customerName: string;
  discount: number;
  createdAt: string;
  updatedAt: string;
}

// Shape returned by GET /api/carts
export interface CartsResponse {
  items: CartItemRow[];
  sessions: CartSessionRow[];
}

export const cartsApi = {
  // Fetch all cart items (with product details) + all session metadata
  getAll: (): Promise<CartsResponse> =>
    http.get('/carts'),

  // Create or update a cart session — persist customer name/ID immediately
  saveSession: (
    sessionId: string,
    data: { customerName?: string; customerId?: string; discount?: number },
  ): Promise<CartSessionRow> =>
    http.put(`/carts/sessions/${sessionId}`, data),

  // Add or increment a cart item immediately (source of truth: MySQL)
  addItem: (data: {
    productId: string;
    qty: number;
    price: number;
    sessionId: string;
  }): Promise<CartItemRow> =>
    http.post('/carts/items', data),

  // Set exact quantity for a cart item (qty=0 removes it on backend)
  setQty: (productId: string, qty: number, sessionId: string): Promise<CartItemRow | null> =>
    http.patch(`/carts/items/${productId}`, { qty }, { params: { sessionId } }),

  // Remove a single item from a session
  removeItem: (productId: string, sessionId: string): Promise<void> =>
    http.delete(`/carts/items/${productId}`, { params: { sessionId } }),

  // Delete all items + session metadata (after checkout or cart close)
  clearSession: (sessionId: string): Promise<void> =>
    http.delete(`/carts/sessions/${sessionId}`),
};

// ── POS Checkout ─────────────────────────────────────────────────
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

// ── Subscription Plans ───────────────────────────────────────────
export const subscriptionPlansApi = {
  getAll: (): Promise<SubscriptionPlan[]> => http.get('/subscription-plans'),
};

// ── User Subscriptions ───────────────────────────────────────────
export const userSubscriptionsApi = {
  getMy: (): Promise<UserSubscription | null> => http.get('/subscriptions/my'),
};

// ── Stripe Subscription ──────────────────────────────────────────
export const stripeApi = {
  getPlans: (): Promise<SubscriptionPlan[]> => http.get('/stripe/plans'),
  createCheckout: (planId: string, billingCycle: 'monthly' | 'yearly'): Promise<{ sessionUrl: string; sessionId: string }> =>
    http.post('/stripe/checkout', { planId, billingCycle }),
  getSubscription: (): Promise<UserSubscription | null> => http.get('/stripe/subscription'),
  getPaymentStatus: (): Promise<{ exists: boolean; status: string | null; amount: number | null }> =>
    http.get('/stripe/payment-status'),
  cancelSubscription: (): Promise<{ success: boolean; message: string }> =>
    http.delete('/stripe/subscription'),
};

// ── Legacy payments (keep for existing data) ─────────────────────
export const paymentsApi = {
  getMine: (): Promise<Payment[]> => http.get('/payments/my'),
};
