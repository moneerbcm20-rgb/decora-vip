
import React from 'react';

export enum ProductType {
  KITCHEN = 'kitchen',
  DRESSING = 'dressing',
  BEDROOM = 'bedroom',
  TV_UNIT = 'tv_unit',
  DECOR = 'decor',
  DOORS = 'doors'
}

export type OrderStatus = 
  | 'manufacturing' // تحت التصنيع
  | 'shipping'      // جاهز للتركيب
  | 'delivered';    // تم التسليم والتركيب

export type UserRole = 'admin' | 'user';

export interface UserAccount {
  id: string;
  username: string;
  password: string;
  role: UserRole;
  isActive: boolean;
}

export interface ProductConfig {
  id: string;
  name: string;
  productionDays: number; // أيام الإنتاج المطلوبة
  iconKey: string;
  color: string;
}

export interface Customer {
  id: string;
  serialNumber?: number;
  name: string;
  phone: string;
  address: string;
  notes?: string;
  createdAt: number;
}

export interface Order {
  id:string;
  customerId: string;
  productType: string; // Changed from enum to string to support dynamic products
  orderDate: number; 
  deliveryDate: number; 
  status: OrderStatus;
  totalProductionDays: number; // إجمالي أيام العمل للطلب
  price?: number;
  paidAmount?: number;
  notes?: string;
  isRescheduled?: boolean; // Flag to indicate if the order has been rescheduled
}

export type ExpenseCategory = 'materials' | 'salaries' | 'rent' | 'utilities' | 'marketing' | 'other';

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  date: number; // timestamp
}

export type InvoiceStatus = 'draft' | 'due' | 'paid' | 'overdue';

export interface InvoiceItem {
  description: string;
  amount: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: number;
  orderId: string;
  customerId: string;
  issueDate: number;
  dueDate: number;
  totalAmount: number;
  status: InvoiceStatus;
  items: InvoiceItem[];
}

export interface AutoBackup {
  id: string;
  timestamp: number;
  customers: Customer[];
  orders: Order[];
  expenses?: Expense[];
  invoices?: Invoice[];
}
