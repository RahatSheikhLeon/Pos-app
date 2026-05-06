import axios from 'axios';
import { Product, Settings, CheckoutPayload, Member } from '../types';

const http = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

http.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const message = err.response?.data?.message || 'Request failed';
    return Promise.reject(new Error(message));
  }
);

export const dashboardApi = {
  get: (): Promise<any> => http.get('/dashboard'),
};

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

export const membersApi = {
  getAll: (): Promise<Member[]> => http.get('/members'),
  search: (q: string): Promise<Member[]> => http.get('/members/search', { params: { q } }),
  getById: (id: string): Promise<Member> => http.get(`/members/${id}`),
  create: (data: Partial<Member>): Promise<Member> => http.post('/members', data),
  update: (id: string, data: Partial<Member>): Promise<Member> =>
    http.put(`/members/${id}`, data),
};

export const checkoutApi = {
  process: (data: CheckoutPayload): Promise<any> => http.post('/checkout', data),
};

export const transactionsApi = {
  getAll: (params?: { search?: string; dateFrom?: string; dateTo?: string }): Promise<any> =>
    http.get('/transactions', { params }),
  getById: (id: string): Promise<any> => http.get(`/transactions/${id}`),
  returnTransaction: (id: string): Promise<any> => http.post(`/transactions/${id}/return`),
};

export const reportsApi = {
  get: (days: number): Promise<any> => http.get('/reports', { params: { days } }),
};

export const settingsApi = {
  get: (): Promise<Settings> => http.get('/settings'),
  update: (data: Partial<Settings>): Promise<Settings> => http.put('/settings', data),
};
