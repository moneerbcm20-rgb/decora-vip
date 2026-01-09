

import React from 'react';
// FIX: Added InvoiceStatus and ExpenseCategory types for the new maps.
import { ProductType, ProductConfig, OrderStatus, InvoiceStatus, ExpenseCategory } from './types';
import { 
  ChefHat, 
  Shirt, 
  Bed, 
  Monitor, 
  Sparkles, 
  DoorClosed,
  Armchair,
  Sofa,
  Table,
  Lamp,
  Box,
  Hammer,
  Grid,
  LayoutTemplate,
  // FIX: Added icons required for EXPENSE_CATEGORY_MAP.
  Package,
  Users,
  Building2,
  Zap,
  Briefcase
} from 'lucide-react';

// خريطة الأيقونات المتاحة للاختيار
export const ICON_MAP: Record<string, React.ElementType> = {
  'ChefHat': ChefHat,
  'Shirt': Shirt,
  'Bed': Bed,
  'Monitor': Monitor,
  'Sparkles': Sparkles,
  'DoorClosed': DoorClosed,
  'Armchair': Armchair,
  'Sofa': Sofa,
  'Table': Table,
  'Lamp': Lamp,
  'Box': Box,
  'Hammer': Hammer,
  'Grid': Grid,
  'LayoutTemplate': LayoutTemplate
};

export const DEFAULT_PRODUCTS_CONFIG: Record<string, ProductConfig> = {
  [ProductType.KITCHEN]: {
    id: ProductType.KITCHEN,
    name: 'مطبخ كامل',
    productionDays: 21,
    iconKey: 'ChefHat',
    color: 'orange'
  },
  [ProductType.DRESSING]: {
    id: ProductType.DRESSING,
    name: 'غرفة ملابس (Dressing)',
    productionDays: 14,
    iconKey: 'Shirt',
    color: 'amber'
  },
  [ProductType.BEDROOM]: {
    id: ProductType.BEDROOM,
    name: 'غرفة نوم رئيسية',
    productionDays: 18,
    iconKey: 'Bed',
    color: 'rose'
  },
  [ProductType.TV_UNIT]: {
    id: ProductType.TV_UNIT,
    name: 'مكتبة شاشة وديكور',
    productionDays: 10,
    iconKey: 'Monitor',
    color: 'stone'
  },
  [ProductType.DECOR]: {
    id: ProductType.DECOR,
    name: 'أعمال ديكور متفرقة',
    productionDays: 7,
    iconKey: 'Sparkles',
    color: 'yellow'
  },
  [ProductType.DOORS]: {
    id: ProductType.DOORS,
    name: 'أبواب خشبية',
    productionDays: 5,
    iconKey: 'DoorClosed',
    color: 'emerald'
  }
};

export const STATUS_MAP: Record<OrderStatus, { label: string, color: string, bg: string, icon: string }> = {
  manufacturing: { label: 'تحت الإنتاج', color: 'text-orange-600', bg: 'bg-orange-50', icon: '🛠️' },
  shipping: { label: 'جاهز للتركيب', color: 'text-amber-600', bg: 'bg-amber-50', icon: '🚛' },
  delivered: { label: 'تم التسليم', color: 'text-emerald-600', bg: 'bg-emerald-50', icon: '✅' },
};

// FIX: Moved from AccountingView to constants for global access in report generation.
export const EXPENSE_CATEGORY_MAP: Record<ExpenseCategory, { label: string, color: string, icon: React.ElementType }> = {
  materials: { label: 'مواد خام', color: 'stone', icon: Package },
  salaries: { label: 'رواتب', color: 'sky', icon: Users },
  rent: { label: 'إيجار', color: 'violet', icon: Building2 },
  utilities: { label: 'فواتير وخدمات', color: 'amber', icon: Zap },
  marketing: { label: 'تسويق وإعلان', color: 'rose', icon: Sparkles },
  other: { label: 'مصروفات أخرى', color: 'slate', icon: Briefcase }
};

// FIX: Moved from AccountingView to constants for global access in report generation.
export const INVOICE_STATUS_MAP: Record<InvoiceStatus, { label: string, color: string, bg: string, border: string }> = {
  draft: { label: 'مسودة', color: 'text-slate-600', bg: 'bg-slate-100', border: 'border-slate-300' },
  due: { label: 'مستحقة', color: 'text-blue-600', bg: 'bg-blue-100', border: 'border-blue-300' },
  paid: { label: 'مدفوعة', color: 'text-emerald-600', bg: 'bg-emerald-100', border: 'border-emerald-300' },
  overdue: { label: 'متأخرة', color: 'text-red-600', bg: 'bg-red-100', border: 'border-red-300' },
};


export const MAX_DAILY_DELIVERIES = 1;