import { api } from './client';
import type {
  Category,
  Customer,
  DashboardSummary,
  Expense,
  Product,
  PurchaseOrder,
  SalesOrder,
  Supplier,
  User,
} from '../types';

export const AuthApi = {
  login: (email: string, password: string) => api.post<{ token: string; user: User }>('/auth/login', { email, password }),
  register: (name: string, email: string, password: string) =>
    api.post<{ token: string; user: User }>('/auth/register', { name, email, password }),
  me: () => api.get<User>('/auth/me'),
};

export const CategoriesApi = {
  list: () => api.get<Category[]>('/categories'),
  create: (data: Partial<Category>) => api.post<Category>('/categories', data),
  update: (id: string, data: Partial<Category>) => api.patch<Category>(`/categories/${id}`, data),
  remove: (id: string) => api.delete(`/categories/${id}`),
};

export const ProductsApi = {
  list: (params?: { search?: string; categoryId?: string; lowStock?: boolean }) =>
    api.get<Product[]>('/products', { params }),
  get: (id: string) => api.get<Product>(`/products/${id}`),
  create: (data: Partial<Product>) => api.post<Product>('/products', data),
  update: (id: string, data: Partial<Product>) => api.patch<Product>(`/products/${id}`, data),
  remove: (id: string) => api.delete(`/products/${id}`),
  adjustStock: (id: string, changeQty: number, note?: string) =>
    api.post<Product>(`/products/${id}/adjust-stock`, { changeQty, note }),
  inventoryLogs: (id: string) => api.get(`/products/${id}/inventory-logs`),
};

export const CustomersApi = {
  list: (params?: { search?: string }) => api.get<Customer[]>('/customers', { params }),
  get: (id: string) => api.get<Customer>(`/customers/${id}`),
  create: (data: Partial<Customer>) => api.post<Customer>('/customers', data),
  update: (id: string, data: Partial<Customer>) => api.patch<Customer>(`/customers/${id}`, data),
  remove: (id: string) => api.delete(`/customers/${id}`),
};

export const SuppliersApi = {
  list: (params?: { search?: string }) => api.get<Supplier[]>('/suppliers', { params }),
  get: (id: string) => api.get<Supplier>(`/suppliers/${id}`),
  create: (data: Partial<Supplier>) => api.post<Supplier>('/suppliers', data),
  update: (id: string, data: Partial<Supplier>) => api.patch<Supplier>(`/suppliers/${id}`, data),
  remove: (id: string) => api.delete(`/suppliers/${id}`),
};

export const PurchaseOrdersApi = {
  list: (params?: { status?: string; supplierId?: string }) => api.get<PurchaseOrder[]>('/purchase-orders', { params }),
  get: (id: string) => api.get<PurchaseOrder>(`/purchase-orders/${id}`),
  create: (data: {
    supplierId: string;
    expectedDate?: string;
    notes?: string;
    items: { productId: string; quantity: number; unitCost: number }[];
  }) => api.post<PurchaseOrder>('/purchase-orders', data),
  setStatus: (id: string, status: string) => api.patch<PurchaseOrder>(`/purchase-orders/${id}/status`, { status }),
  remove: (id: string) => api.delete(`/purchase-orders/${id}`),
};

export const SalesOrdersApi = {
  list: (params?: { status?: string; customerId?: string; search?: string; fulfillmentMethod?: string; deliveryStatus?: string }) =>
    api.get<SalesOrder[]>('/sales-orders', { params }),
  get: (id: string) => api.get<SalesOrder>(`/sales-orders/${id}`),
  create: (data: {
    customerId?: string | null;
    paymentMethod?: string;
    taxRate?: number;
    discount?: number;
    notes?: string;
    status?: string;
    amountPaid?: number;
    fulfillmentMethod?: string;
    deliveryAddress?: string;
    scheduledDate?: string;
    items: { productId: string; quantity: number }[];
  }) => api.post<SalesOrder>('/sales-orders', data),
  setStatus: (id: string, status: string) => api.patch<SalesOrder>(`/sales-orders/${id}/status`, { status }),
  recordPayment: (id: string, data: { amount: number; method: string; note?: string }) =>
    api.post<SalesOrder>(`/sales-orders/${id}/payments`, data),
  updateDelivery: (
    id: string,
    data: Partial<{ fulfillmentMethod: string; deliveryAddress: string; scheduledDate: string | null; deliveryStatus: string }>
  ) => api.patch<SalesOrder>(`/sales-orders/${id}/delivery`, data),
};

export const ExpensesApi = {
  list: (params?: { from?: string; to?: string; category?: string }) => api.get<Expense[]>('/expenses', { params }),
  create: (data: { category: string; description?: string; amount: number; expenseDate?: string }) =>
    api.post<Expense>('/expenses', data),
  remove: (id: string) => api.delete(`/expenses/${id}`),
};

export const UsersApi = {
  list: () => api.get<User[]>('/users'),
  create: (data: { name: string; email: string; password: string; role: string }) => api.post<User>('/users', data),
  update: (id: string, data: Partial<{ name: string; role: string; isActive: boolean; password: string }>) =>
    api.patch<User>(`/users/${id}`, data),
  remove: (id: string) => api.delete(`/users/${id}`),
};

export const DashboardApi = {
  summary: () => api.get<DashboardSummary>('/dashboard/summary'),
};
