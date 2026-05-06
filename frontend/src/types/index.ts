export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  sellPrice: number;
  buyPrice: number;
  stock: number;
  imageUrl: string;
  taxable: boolean;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface TransactionItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface ReturnedItem {
  productId: string;
  quantity: number;
}

export type TransactionStatus = 'completed' | 'returned' | 'partially_refunded';

export interface Transaction {
  id: string;
  date: string;
  items: TransactionItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: 'cash' | 'card' | 'wallet';
  memberId?: string;
  status: TransactionStatus;
  returnedItems: ReturnedItem[];
}

export interface DashboardStats {
  todaySales: number;
  todayTransactions: number;
  weeklySales: number;
  weeklyTransactions: number;
  monthlySales: number;
  monthlyTransactions: number;
  lowStockCount: number;
  recentTransactions: Transaction[];
  lowStockProducts: Product[];
}

export interface Settings {
  storeName: string;
  address: string;
  phone: string;
  email: string;
  taxRate: number;
  currency: string;
  currencySymbol: string;
  receiptHeader: string;
  receiptFooter: string;
  taxId: string;
  showLogo: boolean;
  showTaxId: boolean;
  theme: 'light' | 'dark';
}

export interface ReportData {
  revenueTrend: { date: string; revenue: number }[];
  paymentDistribution: { method: string; count: number; amount: number }[];
  topProducts: { name: string; sku: string; quantity: number; revenue: number }[];
  totalRevenue: number;
  totalTransactions: number;
}

export interface CheckoutPayload {
  items: { productId: string; quantity: number; unitPrice: number }[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: 'cash' | 'card' | 'wallet';
  memberId?: string;
}

export interface PurchaseRecord {
  transactionId: string;
  date: string;
  items: { productName: string; sku: string; quantity: number; total: number }[];
  total: number;
}

export interface Member {
  id: string;
  membershipId: string;
  name: string;
  phone: string;
  email: string;
  joinedAt: string;
  purchaseHistory: PurchaseRecord[];
}
