export type Role = 'ADMIN' | 'MANAGER' | 'STAFF';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt?: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string | null;
  _count?: { products: number };
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string | null;
  material?: string | null;
  dimensions?: string | null;
  color?: string | null;
  costPrice: number;
  sellingPrice: number;
  stockQuantity: number;
  reorderLevel: number;
  imageUrl?: string | null;
  isActive: boolean;
  categoryId?: string | null;
  category?: Category | null;
}

export interface Customer {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  createdAt: string;
  _count?: { salesOrders: number };
  salesOrders?: SalesOrder[];
}

export interface Supplier {
  id: string;
  name: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  createdAt: string;
  _count?: { purchaseOrders: number };
  purchaseOrders?: PurchaseOrder[];
}

export type PurchaseOrderStatus = 'PENDING' | 'ORDERED' | 'RECEIVED' | 'CANCELLED';

export interface PurchaseOrderItem {
  id: string;
  productId: string;
  product: Product;
  quantity: number;
  unitCost: number;
}

export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  supplierId: string;
  supplier: Supplier;
  status: PurchaseOrderStatus;
  orderDate: string;
  expectedDate?: string | null;
  receivedDate?: string | null;
  notes?: string | null;
  items: PurchaseOrderItem[];
}

export type SalesOrderStatus = 'PENDING' | 'PAID' | 'PARTIALLY_PAID' | 'SHIPPED' | 'COMPLETED' | 'CANCELLED';
export type PaymentMethod = 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'FINANCING' | 'OTHER';
export type FulfillmentMethod = 'PICKUP' | 'DELIVERY';
export type DeliveryStatus = 'NOT_SCHEDULED' | 'SCHEDULED' | 'OUT_FOR_DELIVERY' | 'DELIVERED';

export interface SalesOrderItem {
  id: string;
  productId: string;
  product: Product;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Payment {
  id: string;
  salesOrderId: string;
  amount: number;
  method: PaymentMethod;
  note?: string | null;
  user?: { id: string; name: string } | null;
  createdAt: string;
}

export interface SalesOrder {
  id: string;
  orderNumber: string;
  customerId?: string | null;
  customer?: Customer | null;
  userId?: string | null;
  user?: { id: string; name: string } | null;
  status: SalesOrderStatus;
  paymentMethod: PaymentMethod;
  orderDate: string;
  subtotal: number;
  discount: number;
  taxRate: number;
  tax: number;
  total: number;
  notes?: string | null;
  fulfillmentMethod: FulfillmentMethod;
  deliveryAddress?: string | null;
  scheduledDate?: string | null;
  deliveryStatus: DeliveryStatus;
  items: SalesOrderItem[];
  payments: Payment[];
  amountPaid: number;
  balanceDue: number;
}

export type ExpenseCategory = 'RENT' | 'UTILITIES' | 'WAGES' | 'MARKETING' | 'SUPPLIES' | 'SHIPPING' | 'OTHER';

export interface Expense {
  id: string;
  category: ExpenseCategory;
  description?: string | null;
  amount: number;
  expenseDate: string;
  user?: { id: string; name: string } | null;
  createdAt: string;
}

export interface DashboardSummary {
  counts: {
    productCount: number;
    customerCount: number;
    supplierCount: number;
    pendingPurchaseOrders: number;
    lowStockCount: number;
  };
  revenue: { today: number; month: number };
  profit: { grossMonth: number; netMonth: number; expensesMonth: number; cogsMonth: number };
  lowStockProducts: Pick<Product, 'id' | 'name' | 'sku' | 'stockQuantity' | 'reorderLevel' | 'imageUrl'>[];
  recentOrders: SalesOrder[];
  revenueSeries: { date: string; total: number }[];
  topProducts: { product?: Product; revenue: number; unitsSold: number }[];
  upcomingDeliveries: SalesOrder[];
}
