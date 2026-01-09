
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Customer, Order, OrderStatus, UserAccount, UserRole, ProductConfig, ProductType, Expense, ExpenseCategory, Invoice, InvoiceStatus, PaymentReceipt } from './types';
// FIX: Imported EXPENSE_CATEGORY_MAP and INVOICE_STATUS_MAP for global access within the file.
import { DEFAULT_PRODUCTS_CONFIG, STATUS_MAP, ICON_MAP, EXPENSE_CATEGORY_MAP, INVOICE_STATUS_MAP } from './constants';
import { getSmartSchedulingAdvice, saveAppState, fetchAppState } from './services/geminiService';
import html2pdf from 'html2pdf.js';
import { 
  LayoutDashboard, Users, PlusCircle, Package, 
  Phone, Search, Clock, 
  X, AlertTriangle, Menu,
  Trash2, Sparkles, Pencil, CheckCircle2, Loader2, MapPin,
  Database, Activity, Layers, Briefcase,
  Zap, DownloadCloud, UploadCloud, LogOut, UserPlus, Key, FileJson, Hourglass, ChevronLeft, ShieldCheck, UserCog, History, UserMinus, ShieldAlert, ToggleLeft, ToggleRight,
  TrendingUp, Calendar, ArrowUpRight, ArrowLeft, ArrowRight, FileText, Printer, Building2, UserSquare, Wand2, Check, Timer, Save, Settings, Palette, PenTool, LayoutGrid, BellRing, Hash, FolderOpen, Minus, Hammer, Truck, CheckCheck,
  ChevronRight, MoreVertical, GripVertical, BrainCircuit, ChevronUp, ChevronDown, MoveLeft,
  Archive as ArchiveIcon,
  User, Lock, Rocket, MessageCircle, Send, PackageCheck, CircleDollarSign, MessageSquarePlus, Banknote, Landmark, Receipt, MinusCircle, BarChart3, Scale, FileSpreadsheet, ArrowUpDown, Plus
} from 'lucide-react';

type TabName = 'dashboard' | 'customers' | 'orders' | 'production' | 'database' | 'reports' | 'products' | 'calendar' | 'archive' | 'accounting';

type Toast = { id: number; message: string; type: 'success' | 'error' | 'info' };

// Logo Component
const Logo: React.FC<{ size?: number, rotation?: string }> = ({ size = 28, rotation = '-rotate-2' }) => (
    <div className={`bg-orange-600 p-3 rounded-2xl flex-shrink-0 shadow-lg transform ${rotation} flex items-center justify-center`}>
        <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="text-white"
            style={{ width: size, height: size }}
        >
            <path
                d="M9 4H13C16.3137 4 19 6.68629 19 10V14C19 17.3137 16.3137 20 13 20H9V4Z"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            />
            <path d="M9 4V20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    </div>
);


interface KpiCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  percentage?: string | number;
}

interface DashboardViewProps {
  orders: Order[];
  customers: Customer[];
  aiAdvice: string;
  getDaysDiff: (ts: number) => number;
  setAiAdvice: (advice: string) => void;
  loadingAdvice: boolean;
  setLoadingAdvice: (loading: boolean) => void;
  setActiveTab: (tab: TabName) => void;
  handleExportReport: () => void;
  productsConfig: Record<string, ProductConfig>;
  onOpenDelayedModal: () => void;
}

interface ReportsViewProps {
  orders: Order[];
  customers: Customer[];
  getDaysDiff: (ts: number) => number;
  handleExportReport: () => void;
  handleExportComprehensiveReport: () => void;
  productsConfig: Record<string, ProductConfig>;
}

interface ProductionViewProps {
  orders: Order[];
  customers: Customer[];
  setOrders: (orders: Order[]) => void;
  onDelete?: (id: string) => void;
  openEdit: (order: Order) => void;
  config: Record<string, ProductConfig>;
  getDaysDiff: (ts: number) => number;
  openReschedule: (order: Order) => void;
}

interface DatabaseViewProps {
  customers: Customer[];
  orders: Order[];
  expenses: Expense[];
  invoices: Invoice[];
  setCustomers: (customers: Customer[]) => void;
  setOrders: (orders: Order[]) => void;
  setExpenses: (expenses: Expense[]) => void;
  setInvoices: (invoices: Invoice[]) => void;
  userAccounts: UserAccount[];
  setUserAccounts: (users: UserAccount[]) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  currentUser: UserAccount;
  openPasswordModal: (user: UserAccount) => void;
  onAddUser: (newUser: { username: string; password: string; role: UserRole; }) => boolean;
  onToggleUserStatus: (userId: string) => void;
  onDeleteUser: (userId: string) => void;
  onChangeUserRole: (userId: string) => void;
  handleManualExport: () => void;
  backupInterval: number;
  setBackupInterval: (interval: number) => void;
  onSelectBackupPath: () => void;
  isBackupPathSet: boolean;
  autoBackupEnabled: boolean;
  setAutoBackupEnabled: (b: boolean) => void;
  setProductsConfig: (config: Record<string, ProductConfig>) => void;
  addToast: (message: string, type?: Toast['type']) => void;
  companyLogo: string | null;
  setCompanyLogo: (logo: string | null) => void;
}

interface CustomersViewProps {
  customers: Customer[];
  orders: Order[];
  onAdd: (name: string, phone: string, address: string) => void;
  onEdit: (customer: Customer) => void;
  onDelete: (customerId: string) => void;
  onWhatsApp: (customer: Customer) => void; // New prop for WhatsApp
  initialFormOpen: boolean; 
}

interface CalendarViewProps {
    orders: Order[];
    customers: Customer[];
    productsConfig: Record<string, ProductConfig>;
    onOrderClick: (order: Order) => void;
    onDateDrop: (orderId: string, newDate: Date) => void;
}

interface NewOrderViewProps {
  customers: Customer[];
  orders: Order[];
  invoices: Invoice[];
  onAdd: (customerId: string, productType: string, deliveryDate: number, totalProductionDays: number) => void;
  config: Record<string, ProductConfig>;
  getSuggestedDeliveryDate: (newOrderProducts: Record<string, number>) => {
    initialDate: number;
    finalDate: number;
    conflictingOrderId: string | null;
    totalProductionDays: number;
  } | null;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const generateUniqueId = () => Math.random().toString(36).substring(2, 15) + Date.now().toString(36);

const addWorkingDays = (startDateTs: number, daysToAdd: number) => {
  let date = new Date(startDateTs);
  let added = 0;
  while (added < daysToAdd) {
    date.setDate(date.getDate() + 1);
    if (date.getDay() !== 5) added++; 
  }
  return date.getTime();
};

const getIcon = (iconKey: string) => {
    return ICON_MAP[iconKey] || Package;
};

const formatCurrency = (amount: number | undefined) => {
    const num = Math.round(amount || 0);
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' د.ل';
};


const TopNavLink: React.FC<{ active: boolean, onClick: () => void, icon: React.ReactNode, label: string }> = ({ active, onClick, icon, label }) => (
  <button 
    onClick={onClick} 
    className={`flex items-center gap-3 px-4 py-6 text-sm font-black border-b-4 transition-all duration-300 group
      ${active 
        ? 'border-orange-600 text-slate-900' 
        : 'border-transparent text-slate-400 hover:text-slate-900 hover:border-orange-500/40'
      }`
    }
    title={label} // Added title attribute
    aria-current={active ? 'page' : undefined} // Added aria-current attribute
  >
    <span className={`transition-transform duration-300 ${active ? 'text-orange-600 scale-110' : 'text-slate-400 group-hover:text-slate-800'}`}>{icon}</span>
    <span>{label}</span>
  </button>
);

const KpiCard: React.FC<KpiCardProps> = ({ label, value, icon, color, percentage }) => (
  <div className="professional-card p-8 relative overflow-hidden group">
    <div className={`absolute top-0 right-0 w-32 h-32 bg-${color}-500/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-${color}-500/10 transition-all`}></div>
    <div className="relative z-10">
      <div className="flex justify-between items-start mb-6">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:rotate-6 ${
          color === 'orange' ? 'bg-orange-600 text-white' : 
          color === 'blue' ? 'bg-blue-600 text-white' : 
          color === 'red' ? 'bg-red-600 text-white' :
          color === 'emerald' ? 'bg-emerald-600 text-white' : 
          color === 'sky' ? 'bg-sky-600 text-white' :
          'bg-violet-600 text-white'
        }`}>
          {icon}
        </div>
        {percentage && (
          <div className="text-right">
            <span className="flex items-center gap-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <TrendingUp size={12} /> {percentage}% نمو
            </span>
          </div>
        )}
      </div>
      <p className="text-4xl font-black text-slate-900 tabular-nums tracking-tighter mb-1">{value}</p>
      <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
    </div>
  </div>
);

const ProductionChart: React.FC<{ orders: Order[], config: Record<string, ProductConfig> }> = ({ orders, config: productsConfig }) => {
    const productCounts = useMemo(() => {
        const counts: { [key: string]: { count: number; config: ProductConfig } } = {};
        Object.keys(productsConfig).forEach(key => {
            counts[key] = { count: 0, config: productsConfig[key] };
        });
        orders.filter(o => o.status !== 'delivered').forEach(order => {
            const type = order.productType.split(',')[0].trim().split(' (x')[0];
            const key = Object.keys(productsConfig).find(k => productsConfig[k].name === type || k === type);
            if (key && counts[key]) {
                counts[key].count++;
            } else if (productsConfig[order.productType]) {
                 counts[order.productType].count++;
            }
        });
        return Object.values(counts).sort((a,b) => b.count - a.count);
    }, [orders, productsConfig]);
    const maxCount = Math.max(...productCounts.map(p => p.count), 5);
    return (
        <div className="professional-card p-8">
            <h3 className="text-xl font-black flex items-center gap-3 text-slate-900 mb-6 pb-4 border-b border-slate-100">
                <Layers className="text-blue-600" />
                نظرة عامة على الإنتاج الحالي
            </h3>
            <div className="space-y-4">
                {productCounts.map(({ count, config }) => {
                    const Icon = getIcon(config.iconKey);
                    return (
                        <div key={config.id} className="grid grid-cols-12 items-center gap-4 group">
                            <div className="col-span-4 md:col-span-3 flex items-center gap-3 text-xs font-bold text-slate-600">
                            <Icon size={16} className={`text-slate-400 group-hover:text-orange-500`} />
                            <span className="truncate">{config.name}</span>
                            </div>
                            <div className="col-span-7 md:col-span-8">
                            <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden">
                                <div 
                                    className={`h-4 rounded-full bg-orange-500 transition-all duration-500 ease-out`}
                                    style={{ width: `${(count / maxCount) * 100}%` }}
                                ></div>
                            </div>
                            </div>
                            <div className="col-span-1 text-sm font-black text-slate-800 tabular-nums">
                                {count}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const RecentCustomers: React.FC<{customers: Customer[]}> = ({ customers }) => {
    const recent = customers.slice(0, 4);
    return (
        <div className="professional-card p-8">
             <h3 className="text-xl font-black flex items-center gap-3 text-slate-900 mb-6 pb-4 border-b border-slate-100">
                <Users className="text-emerald-600" />
                أحدث العملاء
            </h3>
            <div className="space-y-3">
                {recent.map(c => (
                    <div key={c.id} className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl border border-transparent hover:border-slate-200 transition-colors">
                        <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center font-black text-slate-500 flex-shrink-0 text-sm">
                            {c.serialNumber}
                        </div>
                        <div>
                            <p className="font-bold text-sm text-slate-800 truncate">{c.name}</p>
                            <p className="text-xs text-slate-400 font-bold">{new Date(c.createdAt).toLocaleDateString('ar-LY', {day: 'numeric', month:'long'})}</p>
                        </div>
                    </div>
                ))}
                {customers.length === 0 && <p className="text-center text-xs text-slate-400 py-8 italic">لا يوجد عملاء بعد.</p>}
            </div>
        </div>
    );
};

const DashboardView: React.FC<DashboardViewProps> = ({ orders, customers, aiAdvice, getDaysDiff, setAiAdvice, loadingAdvice, setLoadingAdvice, setActiveTab, handleExportReport, productsConfig, onOpenDelayedModal }) => {
  const stats = useMemo(() => {
    const activeOrders = orders.filter(o => o.status !== 'delivered');
    const deliveredOrders = orders.filter(o => o.status === 'delivered');
    
    return {
      total: orders.length,
      active: activeOrders.length,
      delayed: activeOrders.filter(o => getDaysDiff(o.deliveryDate) < 0).length,
      done: deliveredOrders.length,
      activeValue: activeOrders.reduce((sum, o) => sum + (o.price || 0), 0),
      totalRevenue: deliveredOrders.reduce((sum, o) => sum + (o.price || 0), 0)
    }
  }, [orders, getDaysDiff]);


  const activeTickerOrders = useMemo(() => 
    orders.filter(o => o.status !== 'delivered')
          .sort((a,b) => a.deliveryDate - b.deliveryDate), 
  [orders]);

  const nextUrgentOrder = activeTickerOrders[0];
  const urgentCustomer = nextUrgentOrder ? customers.find(c => c.id === nextUrgentOrder.customerId) : null;
  const prodKey = nextUrgentOrder ? nextUrgentOrder.productType.split(',')[0].trim().split(' (x')[0] : '';
  const urgentProduct = nextUrgentOrder ? (productsConfig[nextUrgentOrder.productType] || (Object.values(productsConfig) as ProductConfig[]).find((p: ProductConfig) => p.name === prodKey) || { name: nextUrgentOrder.productType, iconKey: 'Package' }) : null;
  const urgentDiff = nextUrgentOrder ? getDaysDiff(nextUrgentOrder.deliveryDate) : null;
  
  const urgentTimeTotal = nextUrgentOrder ? nextUrgentOrder.deliveryDate - nextUrgentOrder.orderDate : 0;
  const urgentTimeElapsed = nextUrgentOrder ? Date.now() - nextUrgentOrder.orderDate : 0;
  const urgentProgress = urgentTimeTotal > 0 ? Math.min(100, (urgentTimeElapsed / urgentTimeTotal) * 100) : 0;

  const notifications = useMemo(() => {
    return activeTickerOrders.filter(o => {
        const diff = getDaysDiff(o.deliveryDate);
        return diff >= 0 && diff <= 3;
    });
  }, [activeTickerOrders, getDaysDiff]);
  
  const delayedOrders = useMemo(() => {
    return orders.filter(o => o.status !== 'delivered' && getDaysDiff(o.deliveryDate) < 0);
  }, [orders, getDaysDiff]);

  return (
    <div className="space-y-8 tab-enter pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start gap-6">
        <div className="text-right">
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter">لوحة التحكم الرئيسية</h2>
          <p className="text-slate-400 font-bold mt-1">نظرة شاملة على عمليات مصنع ديكورا</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border shadow-sm flex items-center gap-4">
            <Calendar className="text-orange-500" />
            <div className="text-right leading-none">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">اليوم</p>
                <p className="text-sm font-black text-slate-800 tabular-nums mt-1">{new Date().toLocaleDateString('ar-LY', {weekday:'long', day:'numeric', month:'long'})}</p>
            </div>
        </div>
      </div>

      {notifications.length > 0 && (
        <div className="bg-red-50 border-2 border-red-200 rounded-3xl p-6 flex items-center gap-6 animate-pulse">
            <div className="bg-red-600 text-white p-4 rounded-2xl shadow-lg"><BellRing size={32} /></div>
            <div>
                <h4 className="text-red-900 font-black text-xl">تنبيهات المواعيد العاجلة!</h4>
                <p className="text-red-700 font-bold">لديك {notifications.length} مشاريع يجب تسليمها خلال الـ 72 ساعة القادمة.</p>
            </div>
        </div>
      )}
      
      {delayedOrders.length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-3xl p-6 flex items-center justify-between gap-6">
            <div className="flex items-center gap-6">
                <div className="bg-amber-500 text-white p-4 rounded-2xl shadow-lg"><Hourglass size={32} /></div>
                <div>
                    <h4 className="text-amber-900 font-black text-xl">تنبيه بوجود مشاريع متأخرة!</h4>
                    <p className="text-amber-700 font-bold">لديك {delayedOrders.length} مشاريع تجاوزت موعد تسليمها. يوصى بالتواصل مع العملاء.</p>
                </div>
            </div>
            <button 
                onClick={onOpenDelayedModal}
                className="bg-slate-800 text-white px-6 py-3 rounded-xl font-black text-sm flex items-center gap-3 hover:bg-amber-600 transition-all shadow-lg active:scale-95"
            >
                <MessageCircle size={18} />
                <span>متابعة وإرسال إشعارات</span>
            </button>
        </div>
      )}

      {nextUrgentOrder && (
        <div className="relative group shadow-2xl rounded-[40px]">
            <div className="absolute -inset-2 bg-gradient-to-r from-orange-600 to-red-500 rounded-[44px] blur-xl opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200 animate-pulse"></div>
            
            <div className="relative professional-card bg-slate-950 p-10 md:p-14 overflow-hidden border-none shadow-2xl">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre-v2.png')] opacity-5"></div>
                <div className="absolute top-0 right-0 w-96 h-96 bg-orange-600/10 rounded-full blur-[100px] -mr-32 -mt-32"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-600/5 rounded-full blur-[80px] -ml-20 -mb-20"></div>
                
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-10">
                    <div className="flex items-center gap-8 text-right w-full md:w-auto">
                        <div className="w-24 h-24 md:w-32 md:h-32 bg-gradient-to-br from-orange-500 to-red-500 rounded-[35px] flex items-center justify-center shadow-[0_20px_50px_rgba(249,115,22,0.4)] transform rotate-3 group-hover:rotate-0 transition-all duration-500 ease-out">
                            {React.createElement(getIcon(urgentProduct?.iconKey || 'Package'), { size: 56, className: "text-white" })}
                        </div>
                        <div className="space-y-2">
                            <span className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500/20 to-red-500/20 text-orange-400 text-xs font-black uppercase tracking-[0.2em] mb-2 animate-pulse-slow">
                                <AlertTriangle size={14} className="text-red-400"/> الأولوية القصوى
                            </span>
                            <h3 className="text-4xl md:text-6xl font-black text-white tracking-tighter leading-tight">{urgentCustomer?.name}</h3>
                            <p className="text-slate-400 text-xl md:text-2xl font-bold flex items-center gap-3">
                                {urgentProduct?.name} 
                                <span className="w-1.5 h-1.5 bg-slate-700 rounded-full"></span>
                                <span className="text-sm uppercase tracking-widest opacity-60">مشروع قيد العمل</span>
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col items-center md:items-end gap-2 bg-white/10 p-8 rounded-[30px] border border-white/10 backdrop-blur-md min-w-[220px]">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">الموعد النهائي متبقي له</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-7xl md:text-8xl font-black text-orange-400 tabular-nums tracking-tighter drop-shadow-[0_0_20px_rgba(249,115,22,0.8)]">
                                {Math.abs(urgentDiff || 0)}
                            </span>
                            <span className="text-2xl font-black text-white">{Math.abs(urgentDiff || 0) === 1 ? 'يوم' : 'أيام'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 mt-2">
                            <Clock size={14} className="text-orange-500"/>
                            <span>تاريخ التسليم: {new Date(nextUrgentOrder.deliveryDate).toLocaleDateString('ar-LY')}</span>
                        </div>
                    </div>
                </div>

                <div className="mt-12 space-y-4">
                    <div className="flex justify-between items-end">
                        <div className="space-y-1">
                            <p className="text-xs font-black text-slate-500 uppercase tracking-widest">حالة الإنتاج الحالية</p>
                            <p className="text-white font-bold text-lg">جارٍ التصنيع والتجهيز النهائي</p>
                        </div>
                        <span className="text-orange-500 font-black text-2xl tabular-nums">{Math.round(urgentProgress)}%</span>
                    </div>
                    <div className="w-full bg-white/5 h-5 rounded-full overflow-hidden border border-white/5 p-1">
                        <div 
                            className="h-full rounded-full bg-gradient-to-r from-orange-600 via-orange-500 to-orange-400 shadow-[0_0_20px_rgba(249,115,22,0.8)] transition-all duration-1000 ease-out"
                            style={{ width: `${urgentProgress}%` }}
                        ></div>
                    </div>
                </div>
            </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard label="قيمة المشاريع الحالية" value={formatCurrency(stats.activeValue)} icon={<Banknote size={28} />} color="sky" />
        <KpiCard label="الإيرادات المنجزة" value={formatCurrency(stats.totalRevenue)} icon={<Landmark size={28} />} color="violet" />
        <KpiCard label="قيد التصنيع" value={stats.active} icon={<Activity size={28} />} color="orange" />
        <KpiCard label="مشاريع منجزة" value={stats.done} icon={<CheckCircle2 size={28} />} color="emerald" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="professional-card p-10 bg-white border-2 border-slate-100 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent"></div>
            <div className="relative z-10 h-full flex flex-col">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-2xl"><Zap size={28} /></div>
                  <div>
                    <h3 className="text-2xl font-black tracking-tight text-slate-900">رؤى الذكاء الاصطناعي</h3>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">توصيات لجدولة أفضل</p>
                  </div>
                </div>
                <button 
                  onClick={async () => { setLoadingAdvice(true); const r = await getSmartSchedulingAdvice(orders); setAiAdvice(r || ''); setLoadingAdvice(false); }}
                  disabled={loadingAdvice}
                  className="bg-slate-800 hover:bg-slate-900 text-white px-6 py-3 rounded-xl font-black text-xs flex items-center gap-2 transition-all shadow-lg active:scale-95 disabled:opacity-50"
                >
                  {loadingAdvice ? 'جاري التحليل...' : 'تحديث'}
                </button>
              </div>
              <div className="bg-slate-50 border border-slate-200 p-6 rounded-2xl text-slate-600 leading-relaxed font-bold text-base italic shadow-inner min-h-[120px]">
                 {aiAdvice || 'نظام ديكورا الذكي مستعد لتحليل بياناتك. اضغط على "تحديث" للحصول على تقرير مفصل عن ضغط العمل واقتراحات الجدولة.'}
              </div>
            </div>
          </div>
          
          <ProductionChart orders={orders} config={productsConfig} />
        </div>

        <div className="lg:col-span-1 space-y-8">
          <div className="professional-card p-6 space-y-3">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest px-2 pb-2 mb-2 border-b">إجراءات سريعة</h3>
            <button onClick={() => setActiveTab('orders')} className="w-full text-left bg-orange-50 text-orange-700 p-4 rounded-xl font-black text-sm flex items-center gap-4 hover:bg-orange-100 transition-all">
                <PlusCircle size={24} /><span>مشروع جديد</span>
            </button>
            <button onClick={() => setActiveTab('customers')} className="w-full text-left bg-slate-100 text-slate-700 p-4 rounded-xl font-black text-sm flex items-center gap-4 hover:bg-slate-200 transition-all">
                <UserPlus size={24} /><span>عميل جديد</span>
            </button>
            <button onClick={() => setActiveTab('production')} className="w-full text-left bg-slate-100 text-slate-700 p-4 rounded-xl font-black text-sm flex items-center gap-4 hover:bg-slate-200 transition-all">
                <Layers size={24} /><span>خط الإنتاج</span>
            </button>
            <button onClick={handleExportReport} className="w-full text-left bg-slate-100 text-slate-700 p-4 rounded-xl font-black text-sm flex items-center gap-4 hover:bg-slate-200 transition-all">
                <Printer size={24} /><span>تصدير تقرير</span>
            </button>
          </div>
          
          <div className="professional-card p-8 bg-white h-full flex flex-col">
               <div className="flex justify-between items-center mb-6 pb-6 border-b-2 border-slate-100">
                  <h3 className="text-xl font-black flex items-center gap-3 text-slate-900">
                     <Clock className="text-orange-600" size={24} /> 
                     المواعيد القادمة
                  </h3>
                  <button onClick={() => setActiveTab('production')} className="text-xs font-bold text-orange-600 hover:underline">الكل</button>
               </div>
               <div className="space-y-4 flex-1">
                  {activeTickerOrders.slice(0, 5).map(o => {
                     const cust = customers.find(c => c.id === o.customerId);
                     const diff = getDaysDiff(o.deliveryDate);
                     const timeTotal = o.deliveryDate - o.orderDate;
                     const timeElapsed = Date.now() - o.orderDate;
                     const progress = timeTotal > 0 ? Math.min(100, (timeElapsed / timeTotal) * 100) : 100;

                     return (
                        <div key={o.id} className="bg-slate-50/70 p-4 rounded-xl border border-transparent hover:border-slate-200 transition-all group">
                           <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                 <p className="font-black text-slate-900 truncate tracking-tight text-sm">{cust?.name || '---'}</p>
                                 <div className="flex items-center gap-3 text-xs text-slate-400 font-bold mt-1">
                                    <Calendar size={14} />
                                    <span>تسليم:</span>
                                    <span className={`font-black tabular-nums ${diff < 0 ? 'text-red-600' : 'text-orange-600'}`}>{new Date(o.deliveryDate).toLocaleDateString('en-GB')}</span>
                                 </div>
                              </div>
                              <div className={`flex-shrink-0 text-right ${diff < 0 ? 'text-red-600' : 'text-orange-600'}`}>
                                 <span className={`text-xl font-black tabular-nums`}>{Math.abs(diff)}</span>
                                 <span className="text-[9px] font-bold block -mt-1">{diff < 0 ? 'يوم تأخير' : 'يوم متبقي'}</span>
                              </div>
                           </div>
                           <div className="mt-3">
                              <div className="w-full bg-slate-200 rounded-full h-1.5">
                                 <div className={`h-1.5 rounded-full ${diff < 0 ? 'bg-red-500' : 'bg-orange-500'}`} style={{ width: `${progress}%` }}></div>
                              </div>
                           </div>
                        </div>
                     );
                  })}
                  {activeTickerOrders.length === 0 && (
                    <div className="py-20 text-center space-y-4">
                       <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto border-4 border-slate-100">
                          <CheckCircle2 size={40} className="text-emerald-500 opacity-50" />
                       </div>
                       <p className="text-slate-400 font-bold text-sm italic">خط الإنتاج صافٍ وجاهز للإبداع.</p>
                    </div>
                  )}
               </div>
            </div>
            
          <RecentCustomers customers={customers} />
        </div>
      </div>
    </div>
  );
};

const ReportsView: React.FC<ReportsViewProps> = ({ orders, customers, getDaysDiff, handleExportReport, handleExportComprehensiveReport, productsConfig }) => {
  const activeOrders = useMemo(() => 
    orders.filter((o: Order) => o.status !== 'delivered')
          .sort((a: Order, b: Order) => a.deliveryDate - b.deliveryDate), 
  [orders]);
  
  return (
    <div className="space-y-8 tab-enter">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter">تقارير الإنتاج والمواعيد</h2>
          <p className="text-slate-400 font-bold mt-1">نظرة شاملة على جميع المشاريع وجداولها الزمنية.</p>
        </div>
        <div className="flex items-center gap-4">
            <button 
              onClick={handleExportReport} 
              className="bg-slate-800 text-white px-6 py-3 rounded-xl font-black text-sm flex items-center gap-3 shadow-lg hover:bg-slate-900 active:scale-95 transition-all"
            >
              <Printer size={18} />
              تصدير تقرير المشاريع الحالية (HTML)
            </button>
            <button 
              onClick={handleExportComprehensiveReport} 
              className="bg-orange-600 text-white px-6 py-3 rounded-xl font-black text-sm flex items-center gap-3 shadow-xl hover:bg-orange-700 active:scale-95 transition-all"
            >
              <FileText size={18} />
              تصدير تقرير الإنتاج الشامل (PDF)
            </button>
        </div>
      </div>

      <div className="professional-card p-8">
        <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-3">
            <Activity className="text-orange-500" />
            المشاريع قيد التنفيذ حالياً
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="border-b-2 border-slate-200">
              <tr>
                <th className="p-4 text-sm font-black text-slate-400 uppercase tracking-wider">رقم العميل</th>
                <th className="p-4 text-sm font-black text-slate-400 uppercase tracking-wider">اسم العميل</th>
                <th className="p-4 text-sm font-black text-slate-400 uppercase tracking-wider">الهاتف</th>
                <th className="p-4 text-sm font-black text-slate-400 uppercase tracking-wider">المنتج</th>
                <th className="p-4 text-sm font-black text-slate-400 uppercase tracking-wider">تاريخ التسليم</th>
                <th className="p-4 text-sm font-black text-slate-400 uppercase tracking-wider">الأيام المتبقية</th>
                <th className="p-4 text-sm font-black text-slate-400 uppercase tracking-wider">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {activeOrders.map((order: Order, index: number) => {
                const customer = customers.find((c: Customer) => c.id === order.customerId);
                const diff = getDaysDiff(order.deliveryDate);
                const prodKey = order.productType.split(',')[0].trim().split(' (x')[0];
                const productConfig = productsConfig[order.productType] || (Object.values(productsConfig) as ProductConfig[]).find((p: ProductConfig) => p.name === prodKey) || { name: order.productType };
                
                let diffColor = 'text-slate-700';
                if (diff < 0) diffColor = 'text-red-600 font-black';
                else if (diff <= 5) diffColor = 'text-orange-600 font-bold';

                return (
                  <tr key={order.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
                    <td className="p-4 font-black text-slate-500 tabular-nums">#{customer?.serialNumber || '---'}</td>
                    <td className="p-4 font-black text-slate-800">{customer?.name || '---'}</td>
                    <td className="p-4 font-bold text-slate-600 tabular-nums">{customer?.phone || '---'}</td>
                    <td className="p-4 font-bold text-slate-600 text-xs">{order.productType}</td>
                    <td className="p-4 font-bold text-slate-600 tabular-nums">{new Date(order.deliveryDate).toLocaleDateString('en-GB')}</td>
                    <td className={`p-4 tabular-nums ${diffColor}`}>
                      {diff < 0 ? `متأخر ${Math.abs(diff)} يوم` : `${diff} يوم`}
                    </td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-black ${STATUS_MAP[order.status].bg} ${STATUS_MAP[order.status].color}`}>
                        {STATUS_MAP[order.status].label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {activeOrders.length === 0 && <p className="text-center py-20 text-slate-400 italic">لا توجد مشاريع نشطة لعرضها في التقرير.</p>}
        </div>
      </div>
    </div>
  );
};

interface ArchiveViewProps {
  orders: Order[];
  customers: Customer[];
}

const ArchiveView: React.FC<ArchiveViewProps> = ({ orders, customers }) => {
  const archivedOrders = useMemo(() =>
    orders.filter((o: Order) => o.status === 'delivered')
          .sort((a: Order, b: Order) => b.deliveryDate - a.deliveryDate),
  [orders]);

  return (
    <div className="space-y-8 tab-enter">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter">أرشيف المشاريع المنجزة</h2>
          <p className="text-slate-400 font-bold mt-1">سجل كامل بجميع المشاريع التي تم تسليمها بنجاح.</p>
        </div>
      </div>

      <div className="professional-card p-8">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="border-b-2 border-slate-200">
              <tr>
                <th className="p-4 text-sm font-black text-slate-400 uppercase tracking-wider">رقم العميل</th>
                <th className="p-4 text-sm font-black text-slate-400 uppercase tracking-wider">اسم العميل</th>
                <th className="p-4 text-sm font-black text-slate-400 uppercase tracking-wider">المنتج</th>
                <th className="p-4 text-sm font-black text-slate-400 uppercase tracking-wider">تاريخ الطلب</th>
                <th className="p-4 text-sm font-black text-slate-400 uppercase tracking-wider">تاريخ التسليم</th>
              </tr>
            </thead>
            <tbody>
              {archivedOrders.map((order: Order) => {
                const customer = customers.find((c: Customer) => c.id === order.customerId);
                return (
                  <tr key={order.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
                    <td className="p-4 font-black text-slate-500 tabular-nums">#{customer?.serialNumber || '---'}</td>
                    <td className="p-4 font-black text-slate-800">{customer?.name || '---'}</td>
                    <td className="p-4 font-bold text-slate-600 text-xs">{order.productType}</td>
                    <td className="p-4 font-bold text-slate-600 tabular-nums">{new Date(order.orderDate).toLocaleDateString('en-GB')}</td>
                    <td className="p-4 font-bold text-slate-600 tabular-nums">{new Date(order.deliveryDate).toLocaleDateString('en-GB')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {archivedOrders.length === 0 && <p className="text-center py-20 text-slate-400 italic">لا توجد مشاريع مؤرشفة بعد.</p>}
        </div>
      </div>
    </div>
  );
};


const ProductsView: React.FC<{ config: Record<string, ProductConfig>, onEdit: (id: string) => void, onAdd: () => void }> = ({ config, onEdit, onAdd }) => {
  return (
    <div className="space-y-8 tab-enter">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter">إعدادات أيام الإنتاج للمنتجات</h2>
          <p className="text-slate-400 font-bold mt-1">تحديد أيام العمل المطلوبة والألوان لكل نوع منتج، وإضافة تصنيفات جديدة.</p>
        </div>
        <button onClick={onAdd} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-black text-xs flex items-center gap-3 shadow-xl hover:bg-orange-600 transition-all active:scale-95">
            <PlusCircle size={20} /> إضافة منتج جديد
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {(Object.values(config) as ProductConfig[]).map((product: ProductConfig) => {
            const Icon = getIcon(product.iconKey);
            return (
            <div key={product.id} className="professional-card p-8 group relative overflow-hidden hover:border-orange-200">
                <div className={`absolute top-0 left-0 w-2 h-full bg-${product.color}-500`}></div>
                <div className="flex justify-between items-start mb-6">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center bg-${product.color}-50 text-${product.color}-600`}>
                    <Icon size={32} />
                    </div>
                    <button onClick={() => onEdit(product.id)} className="p-3 text-slate-300 hover:text-orange-500 hover:bg-orange-50 rounded-xl transition-all">
                    <Settings size={20} />
                    </button>
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-2 truncate" title={product.name}>{product.name}</h3>
                <div className="space-y-3 mt-6">
                    <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400 font-bold flex items-center gap-2"><Clock size={16}/> أيام الإنتاج:</span>
                    <span className="font-black text-slate-800 tabular-nums">{product.productionDays} يوم عمل</span>
                    </div>
                    <div className="flex items-center justify-between text-sm pt-3 border-t">
                    <span className="text-slate-400 font-bold flex items-center gap-2"><Palette size={16}/> لون التميز:</span>
                    <span className={`text-${product.color}-600 font-black uppercase text-xs`}>{product.color}</span>
                    </div>
                </div>
            </div>
            );
        })}
      </div>
    </div>
  );
};

const DatabaseView: React.FC<DatabaseViewProps> = ({ customers, orders, expenses, invoices, setCustomers, setOrders, setExpenses, setInvoices, userAccounts, setUserAccounts, fileInputRef, currentUser, openPasswordModal, onAddUser, onToggleUserStatus, onDeleteUser, onChangeUserRole, handleManualExport, backupInterval, setBackupInterval, onSelectBackupPath, isBackupPathSet, autoBackupEnabled, setAutoBackupEnabled, setProductsConfig, addToast, companyLogo, setCompanyLogo }) => {
  const [showDangerZone, setShowDangerZone] = useState(false);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'user' as UserRole });

  const stats = {
    totalCust: customers.length,
    totalOrders: orders.length,
    dbSize: (JSON.stringify({customers, orders, userAccounts, expenses, invoices}).length / 1024).toFixed(2)
  };

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    const success = onAddUser(newUser);
    if (success) {
      setNewUser({ username: '', password: '', role: 'user' });
      setIsAddingUser(false);
    }
  };

  return (
    <div className="space-y-10 tab-enter pb-20">
      <div className="flex justify-between items-end border-b-4 border-slate-900 pb-8">
         <div>
            <h2 className="text-4xl font-black text-slate-900 tracking-tighter">مركز التحكم بالبيانات</h2>
            <p className="text-slate-400 font-bold mt-2">إدارة البنية التحتية والمستخدمين والنسخ الاحتياطي لـ "ديكورا"</p>
         </div>
         <div className="flex gap-4">
            <div className="bg-white p-4 rounded-2xl border text-center shadow-sm">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">حجم البيانات</p>
               <p className="text-xl font-black tabular-nums">{stats.dbSize} KB</p>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         <div className="lg:col-span-2 space-y-8">
            {/* Company Logo Upload Section */}
            <div className="professional-card p-8 bg-white border-2 border-purple-50">
               <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center"><Palette size={24}/></div>
                  <h4 className="text-xl font-black text-slate-900">شعار الشركة</h4>
               </div>
               <div className="space-y-4">
                  <p className="text-sm font-bold text-slate-600">قم برفع شعار الشركة ليظهر في الفواتير والإيصالات</p>
                  <div className="flex items-center gap-6">
                     <div className="flex-shrink-0">
                        {companyLogo ? (
                           <div className="relative group">
                              <img 
                                 src={companyLogo} 
                                 alt="شعار الشركة" 
                                 className="w-32 h-32 object-contain rounded-2xl border-4 border-purple-200 shadow-lg"
                              />
                              <button
                                 onClick={() => {
                                    setCompanyLogo(null);
                                    addToast("تم إزالة الشعار بنجاح", 'success');
                                 }}
                                 className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-red-600"
                                 title="إزالة الشعار"
                              >
                                 <X size={16} />
                              </button>
                           </div>
                        ) : (
                           <div className="w-32 h-32 bg-gradient-to-br from-purple-100 to-purple-200 rounded-2xl border-4 border-purple-300 flex items-center justify-center shadow-lg">
                              <Palette className="text-purple-400" size={48} />
                           </div>
                        )}
                     </div>
                     <div className="flex-1">
                        <label className="bg-purple-600 text-white px-6 py-4 rounded-xl font-black text-sm flex items-center gap-3 cursor-pointer hover:bg-purple-700 transition-all shadow-lg inline-flex">
                           <UploadCloud size={20}/> {companyLogo ? 'تغيير الشعار' : 'رفع شعار'}
                           <input 
                              type="file" 
                              accept="image/*" 
                              className="hidden"
                              onChange={(e) => {
                                 const file = e.target.files?.[0];
                                 if (file) {
                                    // Check file size (max 2MB)
                                    if (file.size > 2 * 1024 * 1024) {
                                       addToast("حجم الصورة كبير جداً. الحد الأقصى 2 ميجابايت", 'error');
                                       return;
                                    }
                                    const reader = new FileReader();
                                    reader.onload = (event) => {
                                       setCompanyLogo(event.target?.result as string);
                                       addToast("تم رفع الشعار بنجاح", 'success');
                                    };
                                    reader.onerror = () => {
                                       addToast("حدث خطأ أثناء قراءة الصورة", 'error');
                                    };
                                    reader.readAsDataURL(file);
                                 }
                              }}
                           />
                        </label>
                        {companyLogo && (
                           <p className="text-xs text-slate-500 font-bold mt-3 flex items-center gap-2">
                              <CheckCircle2 className="text-emerald-500" size={14} />
                              الشعار سيظهر في جميع الفواتير والإيصالات
                           </p>
                        )}
                        {!companyLogo && (
                           <p className="text-xs text-slate-400 font-bold mt-3">
                              الصيغ المدعومة: JPG, PNG, GIF (الحد الأقصى: 2 ميجابايت)
                           </p>
                        )}
                     </div>
                  </div>
               </div>
            </div>

            <div className="professional-card p-8 bg-white border-2 border-blue-50">
               <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center"><Timer size={24}/></div>
                  <h4 className="text-xl font-black text-slate-900">أتمتة النسخ الاحتياطي</h4>
               </div>
               <div className="space-y-4">
                  <div className="space-y-2">
                     <label className="text-xs font-black text-slate-500">مدة الحفظ التلقائي (بالدقائق)</label>
                     <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-200 w-full md:w-1/2">
                        <input 
                           type="number" 
                           min="1" 
                           value={backupInterval} 
                           onChange={(e) => setBackupInterval(parseInt(e.target.value) || 5)} 
                           className="bg-transparent text-center font-black text-lg w-full outline-none text-slate-900"
                        />
                        <span className="text-sm font-bold text-slate-400 whitespace-nowrap pl-4 border-l">دقيقة</span>
                     </div>
                  </div>
                  
                  <div className="pt-4 border-t border-slate-100">
                     <label className="text-xs font-black text-slate-500 mb-2 block">مسار الحفظ التلقائي</label>
                     <div className="flex items-center gap-3">
                        <div className={`flex-1 p-3 rounded-xl border flex items-center gap-2 ${isBackupPathSet ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                            <FolderOpen size={18} />
                            <span className="text-xs font-bold truncate">
                                {isBackupPathSet ? 'تم تحديد مجلد مخصص' : 'مجلد التنزيلات الافتراضي (Downloads)'}
                            </span>
                        </div>
                        <button onClick={onSelectBackupPath} className="bg-slate-900 text-white p-3 rounded-xl hover:bg-orange-600 transition-colors shadow-lg flex-shrink-0" title="تغيير المسار">
                            <Settings size={18} />
                        </button>
                     </div>
                  </div>
               </div>
               
               <div className="mt-6 p-4 bg-blue-50/50 rounded-2xl border border-blue-100 flex items-start gap-3">
                  <AlertTriangle className="text-blue-500 flex-shrink-0 mt-0.5" size={18} />
                  <p className="text-xs font-bold text-blue-800 leading-relaxed">
                     <span className="underline font-black">ملاحظة:</span> {isBackupPathSet ? 'سيتم الحفظ في المجلد الذي حددته طالما هذه الصفحة مفتوحة. عند إغلاق المتصفح، قد تحتاج لتحديده مرة أخرى.' : 'يتم الحفظ في التنزيلات افتراضياً بسبب أمان المتصفح. لتغيير المسار إلى سطح المكتب أو فلاشة، استخدم الزر أعلاه.'}
                  </p>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="professional-card p-8 bg-gradient-to-br from-slate-900 to-slate-800 text-white border-none relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-orange-600/10 rounded-full blur-3xl group-hover:bg-orange-600/20 transition-all"></div>
                  <div className="flex items-center gap-6 mb-8">
                     <div className="w-16 h-16 bg-orange-600 rounded-2xl flex items-center justify-center shadow-xl"><FolderOpen size={32} /></div>
                     <h4 className="text-2xl font-black">تصدير يدوي</h4>
                  </div>
                  <p className="text-slate-400 text-sm font-bold mb-8 leading-relaxed">قم بحفظ نسخة كاملة من قاعدة البيانات الآن. يتيح لك هذا الخيار تحديد مكان الحفظ (مثل سطح المكتب أو USB).</p>
                  <button onClick={handleManualExport} className="w-full bg-white text-slate-900 py-4 rounded-xl font-black flex items-center justify-center gap-3 hover:bg-orange-500 hover:text-white transition-all shadow-xl">
                     <Save size={20} /> حفظ الآن
                  </button>
               </div>

               <div className="professional-card p-8 bg-white border-2 border-slate-100 relative overflow-hidden group">
                  <div className="flex items-center gap-6 mb-8">
                     <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center shadow-sm"><UploadCloud size={32} /></div>
                     <h4 className="text-2xl font-black text-slate-900">استعادة البيانات</h4>
                  </div>
                  <p className="text-slate-400 text-sm font-bold mb-8 leading-relaxed">قم برفع ملف نسخة احتياطية سابقة لاستعادة كافة السجلات. تنبيه: سيتم استبدال البيانات الحالية بالكامل.</p>
                  <button onClick={() => fileInputRef.current?.click()} className="w-full bg-slate-950 text-white py-4 rounded-xl font-black flex items-center justify-center gap-3 hover:bg-slate-800 transition-all shadow-xl">
                     <Database size={20} /> اختيار ملف النسخة
                     <input type="file" ref={fileInputRef} hidden accept=".json" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if(file) {
                           const reader = new FileReader();
                           reader.onload = (ev) => {
                              try {
                                 const data = JSON.parse(ev.target?.result as string);
                                 if(data.customers && data.orders) {
                                    setCustomers(data.customers as Customer[]);
                                    setOrders(data.orders as Order[]);
                                    if(data.userAccounts) setUserAccounts(data.userAccounts as UserAccount[]);
                                    if(data.productsConfig) setProductsConfig(data.productsConfig as Record<string, ProductConfig>);
                                    if(data.expenses) setExpenses(data.expenses as Expense[]);
                                    if(data.invoices) setInvoices(data.invoices as Invoice[]);
                                    if (data.backupInterval != null) {
                                        const val = Number(data.backupInterval);
                                        setBackupInterval(isNaN(val) ? 10 : val);
                                    }
                                    addToast("تم استيراد قاعدة البيانات والإعدادات بنجاح", 'success');
                                 } else {
                                  addToast("الملف غير متوافق مع نظام ديكورا.", 'error');
                                 }
                              } catch(err) { addToast("حدث خطأ أثناء قراءة الملف.", 'error'); }
                           };
                           reader.readAsText(file);
                        }
                     }} />
                  </button>
               </div>
            </div>

            <div className="professional-card p-10 bg-white shadow-xl relative">
               <div className="flex items-center justify-between mb-10 border-b pb-6">
                  <h4 className="text-2xl font-black flex items-center gap-4 text-slate-900"><UserCog className="text-orange-600" size={32} /> إدارة حسابات الموظفين</h4>
                  <button onClick={() => setIsAddingUser(!isAddingUser)} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-black text-xs flex items-center gap-3 hover:bg-orange-600 transition-all shadow-lg active:scale-95">
                     {isAddingUser ? <X size={18} /> : <UserPlus size={18} />}
                     {isAddingUser ? 'إلغاء' : 'إضافة حساب جديد'}
                  </button>
               </div>

               {isAddingUser && (
                 <form onSubmit={handleAddUser} className="mb-10 p-8 bg-slate-50 rounded-[32px] border-2 border-slate-100 space-y-6 tab-enter">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <div className="space-y-2">
                          <label className="text-xs font-black text-slate-400 mr-4">اسم المستخدم (المعرف)</label>
                          <input type="text" required value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} className="input-professional" placeholder="مثلاً: ahmed_decora" />
                       </div>
                       <div className="space-y-2">
                          <label className="text-xs font-black text-slate-400 mr-4">كلمة السر المؤقتة</label>
                          <input type="password" required value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} className="input-professional" placeholder="••••••••" />
                       </div>
                    </div>
                      <div className="mt-4 flex items-center justify-between">
                        <div>
                          <label className="text-xs font-black text-slate-500 mb-1 block">الحفظ التلقائي على التغيير</label>
                          <p className="text-[11px] text-slate-400">عند التفعيل سيتم حفظ نسخة JSON إلى المجلد المحدد تلقائياً عند تغيّر البيانات.</p>
                        </div>
                        <div>
                          <label className="inline-flex relative items-center cursor-pointer">
                            <input type="checkbox" checked={autoBackupEnabled} onChange={async (e) => {
                               const enabled = e.target.checked;
                               if (enabled && !isBackupPathSet) {
                                  await onSelectBackupPath();
                               }
                               setAutoBackupEnabled(enabled);
                               addToast(enabled ? 'تم تفعيل الحفظ التلقائي' : 'تم إيقاف الحفظ التلقائي', 'info');
                            }} className="sr-only" />
                            <div className={`w-11 h-6 bg-${autoBackupEnabled ? 'emerald' : 'slate'}-300 rounded-full relative transition-colors`}></div>
                          </label>
                        </div>
                      </div>
                    <div className="flex items-center justify-between gap-6">
                       <div className="flex items-center gap-4 bg-white p-3 rounded-2xl border flex-1">
                          <p className="text-xs font-black text-slate-500 px-4 whitespace-nowrap">نوع الحساب:</p>
                          <div className="flex gap-2 w-full">
                             <button type="button" onClick={() => setNewUser({...newUser, role: 'user'})} className={`flex-1 py-3 rounded-xl font-black text-xs transition-all ${newUser.role === 'user' ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-400'}`}>موظف تشغيل</button>
                             <button type="button" onClick={() => setNewUser({...newUser, role: 'admin'})} className={`flex-1 py-3 rounded-xl font-black text-xs transition-all ${newUser.role === 'admin' ? 'bg-orange-600 text-white' : 'bg-slate-50 text-slate-400'}`}>مدير عام</button>
                          </div>
                       </div>
                       <button type="submit" className="bg-emerald-600 text-white px-12 py-5 rounded-2xl font-black shadow-xl hover:bg-emerald-700 active:scale-95 transition-all">إنشاء الحساب</button>
                    </div>
                 </form>
               )}

               <div className="space-y-4">
                  {userAccounts.map((u: UserAccount) => (
                     <div key={u.id} className={`flex items-center justify-between p-6 rounded-[28px] border transition-all group ${u.isActive ? 'bg-white border-slate-100' : 'bg-slate-50 border-transparent opacity-60 grayscale'}`}>
                        <div className="flex items-center gap-6">
                           <div className={`w-16 h-16 rounded-[22px] flex items-center justify-center font-black text-2xl shadow-xl transition-all ${u.role === 'admin' ? 'bg-slate-950 text-orange-500 group-hover:rotate-6' : 'bg-slate-100 text-slate-400'}`}>
                              {u.username[0].toUpperCase()}
                           </div>
                           <div>
                              <div className="flex items-center gap-3">
                                 <p className="text-xl font-black text-slate-900">{u.username}</p>
                                 {!u.isActive && <span className="bg-red-100 text-red-600 text-[8px] px-2 py-0.5 rounded-full font-black uppercase">معطل</span>}
                              </div>
                              <div className="flex items-center gap-4 mt-1.5">
                                 <button disabled={u.username === 'admin'} onClick={() => onChangeUserRole(u.id)} className={`flex items-center gap-2 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${u.role === 'admin' ? 'bg-orange-50 text-orange-600 hover:bg-orange-100' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>
                                    {u.role === 'admin' ? <ShieldCheck size={12}/> : <Users size={12}/>}
                                    {u.role === 'admin' ? 'مدير عام' : 'موظف تشغيل'}
                                 </button>
                                 <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                                 <p className="text-[10px] font-bold text-slate-400 tabular-nums">ID: {u.id.substring(0,8)}</p>
                              </div>
                           </div>
                        </div>
                        <div className="flex items-center gap-2">
                           <button 
                              title="إعادة تعيين كلمة السر"
                              disabled={u.username === 'admin'}
                              onClick={() => openPasswordModal(u)}
                              className={`p-3 rounded-xl transition-all ${u.username === 'admin' ? 'opacity-0 cursor-not-allowed' : 'text-slate-300 hover:text-blue-500 hover:bg-blue-50'}`}
                           >
                              <Key size={22} />
                           </button>
                           <button 
                              title={u.isActive ? "تعطيل الح حساب" : "تفعيل الحساب"}
                              disabled={u.username === 'admin'}
                              onClick={() => onToggleUserStatus(u.id)}
                              className={`p-3 rounded-xl transition-all ${u.isActive ? 'text-slate-300 hover:text-orange-500 hover:bg-orange-50' : 'text-emerald-500 hover:bg-emerald-50'}`}
                           >
                              {u.isActive ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                           </button>
                           <button 
                              title="حذف الحساب"
                              disabled={u.username === 'admin'}
                              onClick={() => onDeleteUser(u.id)}
                              className={`p-3 rounded-xl transition-all ${u.username === 'admin' ? 'opacity-0' : 'text-slate-300 hover:text-red-600 hover:bg-red-50'}`}
                           >
                              <UserMinus size={22} />
                           </button>
                        </div>
                     </div>
                  ))}
               </div>
            </div>
         </div>

         <div className="space-y-8">
            <div className="professional-card p-8 bg-slate-950 text-white relative overflow-hidden border-none shadow-2xl">
               <div className="absolute bottom-0 right-0 w-24 h-24 bg-orange-600/20 rounded-full -mb-12 -mr-12 blur-2xl"></div>
               <h4 className="text-lg font-black mb-6 flex items-center gap-3 text-orange-500 border-b border-white/10 pb-4"><History size={20} /> سجل النشاط العام</h4>
               <div className="space-y-6">
                  <div className="flex gap-4">
                     <div className="w-1 bg-orange-600 rounded-full"></div>
                     <div>
                        <p className="text-xs font-bold text-slate-300">تم تسجيل الدخول بنجاح</p>
                        <p className="text-[9px] text-slate-500 font-black mt-1 uppercase">قبل قليل</p>
                     </div>
                  </div>
                  <div className="flex gap-4">
                     <div className="w-1 bg-slate-700 rounded-full"></div>
                     <div>
                        <p className="text-xs font-bold text-slate-300">بدء جلسة عمل جديدة</p>
                        <p className="text-[9px] text-slate-500 font-black mt-1 uppercase">12:45 PM</p>
                     </div>
                  </div>
               </div>
            </div>

            <div className={`professional-card p-8 transition-all duration-500 ${showDangerZone ? 'bg-red-50 border-red-200' : 'bg-white border-slate-100'}`}>
               <button onClick={() => setShowDangerZone(!showDangerZone)} className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-4">
                     <ShieldAlert className={showDangerZone ? 'text-red-600' : 'text-slate-300'} />
                     <h4 className={`text-lg font-black ${showDangerZone ? 'text-red-900' : 'text-slate-400'}`}>منطقة الأمان القصوى</h4>
                  </div>
                  <ChevronLeft className={`transition-transform duration-300 ${showDangerZone ? 'rotate-90 text-red-600' : 'text-slate-300'}`} />
               </button>
               {showDangerZone && (
                  <div className="mt-8 pt-8 border-t border-red-100 space-y-6 tab-enter">
                     <p className="text-sm font-bold text-red-700 leading-relaxed">تحذير: الإجراءات هنا نهائية. تصفير النظام سيؤدي لحذف كافة سجلات العملاء والطلبات من سيرفر ديكورا المحلي.</p>
                     <button onClick={() => {
                        if(confirm("هل أنت متأكد تماماً من رغبتك في مسح كافة بيانات مصنع ديكورا؟ لا يمكن التراجع عن هذا الإجراء.")) {
                           setCustomers([]);
                           setOrders([]);
                           setExpenses([]);
                           setInvoices([]);
                           addToast("تمت تصفية قاعدة البيانات بالكامل.", 'success');
                        }
                     }} className="w-full bg-red-600 text-white py-4 rounded-xl font-black hover:bg-red-700 shadow-xl transition-all">تصفير النظام بالكامل</button>
                  </div>
               )}
            </div>
         </div>
      </div>
    </div>
  );
};

const ProductionView: React.FC<ProductionViewProps> = ({ orders, customers, setOrders, onDelete, openEdit, config, getDaysDiff, openReschedule }) => {
  const [draggedOrderId, setDraggedOrderId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<OrderStatus | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const stages: {id: OrderStatus, name: string, icon: React.ElementType, color: string, textColor: string, bg: string}[] = [
    { id: 'manufacturing', name: 'قيد التصنيع', icon: Hammer, color: 'orange', textColor: 'text-orange-600', bg: 'bg-orange-50' },
    { id: 'shipping', name: 'جاهز للتركيب', icon: Truck, color: 'blue', textColor: 'text-blue-600', bg: 'bg-blue-50' },
    { id: 'delivered', name: 'تم التسليم', icon: CheckCheck, color: 'emerald', textColor: 'text-emerald-600', bg: 'bg-emerald-50' }
  ];

  const moveOrder = (orderId: string, newStatus: OrderStatus) => {
    const order = orders.find(o => o.id === orderId);
    if (!order || order.status === newStatus) return;
    setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, orderId: string) => {
    setDraggedOrderId(orderId);
    e.dataTransfer.effectAllowed = 'move';
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, status: OrderStatus) => {
    e.preventDefault();
    const draggedOrder = orders.find(o => o.id === draggedOrderId);
    if (draggedOrder && draggedOrder.status !== status) {
      setDragOverStatus(status);
      e.dataTransfer.dropEffect = 'move';
    } else {
      e.dataTransfer.dropEffect = 'none';
    }
  };

  const handleDrop = (newStatus: OrderStatus) => {
    if (draggedOrderId) {
      moveOrder(draggedOrderId, newStatus);
    }
    setDraggedOrderId(null);
    setDragOverStatus(null);
  };
  
  const filteredOrders = useMemo(() => {
    const lowerCaseQuery = searchQuery.toLowerCase().trim();
    if (!lowerCaseQuery) return orders;
    return orders.filter(order => {
        const customer = customers.find(c => c.id === order.customerId);
        return (
            customer?.name.toLowerCase().includes(lowerCaseQuery) ||
            order.productType.toLowerCase().includes(lowerCaseQuery)
        );
    });
  }, [orders, customers, searchQuery]);
  
  return (
    <div className="flex flex-col h-full tab-enter printable-production-view">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 pb-8 border-b border-slate-200 no-print mb-8">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter">خط الإنتاج</h2>
          <p className="text-slate-400 font-bold mt-1 text-sm">مراقبة حية وتفاعلية لسير العمليات الإنتاجية</p>
        </div>
        <div className="flex items-center gap-4">
            <div className="relative w-full max-w-sm group">
                <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-orange-500 transition-colors" size={20} />
                <input 
                  type="text" 
                  placeholder="البحث برقم العميل، الاسم أو المنتج..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-2xl py-4 pr-14 pl-6 outline-none focus:border-orange-500 focus:shadow-[0_0_0_4px_rgba(249,115,22,0.1)] transition-all font-bold text-slate-700"
                />
            </div>
            <button onClick={() => window.print()} className="bg-slate-800 text-white p-4 rounded-2xl font-black text-sm flex items-center gap-3 flex-shrink-0 shadow-lg hover:bg-slate-900 active:scale-95 transition-all">
                <Printer size={20}/>
            </button>
         </div>
      </div>

      <div className="flex-1 overflow-x-auto custom-scrollbar -mx-10 px-10 pb-4">
        <div className="flex gap-8 h-full min-w-max pb-2">
          {stages.map(stage => {
            const list = filteredOrders.filter(o => o.status === stage.id).sort((a:Order, b:Order) => a.deliveryDate - b.deliveryDate);
            const totalWorkDays = list.reduce((sum, order) => sum + (order.totalProductionDays || 0), 0);
            const isDropZone = dragOverStatus === stage.id;
            
            return (
              <div 
                key={stage.id} 
                className="w-[420px] flex-shrink-0 flex flex-col h-full relative group/col production-column"
                onDragOver={(e) => handleDragOver(e, stage.id)}
                onDragLeave={() => setDragOverStatus(null)}
                onDrop={() => handleDrop(stage.id)}
              >
                 <div className={`flex flex-col p-5 rounded-3xl bg-white border-b-8 shadow-md mb-6 sticky top-0 z-20`} style={{borderColor: `var(--color-${stage.color}-500)`}}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg bg-${stage.color}-500 text-white`}>
                                {React.createElement(stage.icon, { size: 24, className: "text-white" })}
                            </div>
                            <div>
                                <h3 className={`font-black text-slate-800 text-2xl tracking-tight`}>{stage.name}</h3>
                            </div>
                        </div>
                        <span className={`text-4xl font-black tabular-nums text-${stage.color}-500/30`}>{list.length}</span>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-xs font-bold text-slate-400">
                      <span>إجمالي المشاريع: {list.length}</span>
                      <span>إجمالي أيام العمل: <span className="font-black text-slate-600">{totalWorkDays} يوم</span></span>
                    </div>
                 </div>

                 <div className={`flex-1 rounded-3xl p-3 transition-all duration-300 border-2 border-dashed ${isDropZone ? `border-orange-400 bg-orange-50/80` : 'border-slate-200 bg-slate-100/70'}`}>
                    <div className="space-y-4 h-full overflow-y-auto custom-scrollbar pr-2 pb-20">
                    {list.length > 0 ? list.map((order:Order) => {
                      const cust = customers.find(c => c.id === order.customerId);
                      const diff = getDaysDiff(order.deliveryDate);
                      
                      let urgency = {
                        badge: 'bg-slate-100 text-slate-500',
                        border: 'border-slate-200',
                        text: 'في الموعد',
                        textColor: 'text-slate-500'
                      };
                      if (diff < 0) {
                        urgency = { badge: 'bg-red-100 text-red-600', border: 'border-red-400', text: `متأخر ${Math.abs(diff)} يوم`, textColor: 'text-red-600' };
                      } else if (diff <= 3) {
                        urgency = { badge: 'bg-amber-100 text-amber-600', border: 'border-amber-400', text: `عاجل: ${diff} أيام`, textColor: 'text-amber-600' };
                      }
                      
                      return (
                        <div 
                          key={order.id} 
                          draggable
                          onDragStart={(e) => handleDragStart(e, order.id)}
                          onDragEnd={() => setDraggedOrderId(null)}
                          className={`production-card group relative bg-white rounded-2xl p-5 border-l-8 shadow-md transition-all duration-300 cursor-grab active:cursor-grabbing hover:shadow-xl hover:-translate-y-1 ${urgency.border}
                            ${draggedOrderId === order.id ? 'opacity-40 scale-95 rotate-2 shadow-none ring-2 ring-orange-400 ring-offset-2' : ''}
                          `}
                          style={{borderLeftColor: `var(--color-${config[order.productType.split('(')[0].trim()]?.color || 'slate'}-500)`}}
                        >
                           <div className="flex justify-between items-start mb-3">
                                <div className="flex flex-col">
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black self-start mb-1.5 ${urgency.badge}`}>{urgency.text}</span>
                                    <h4 className="font-black text-slate-900 text-2xl leading-tight truncate max-w-[240px]">{cust?.name || '---'}</h4>
                                    <p className="text-sm font-bold text-slate-400">#{cust?.serialNumber}</p>
                                </div>
                                <div className="relative group/menu">
                                    <button className="p-2 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                                        <MoreVertical size={18} />
                                    </button>
                                    <div className="absolute top-8 left-0 w-40 bg-white rounded-xl shadow-2xl border border-slate-100 p-1.5 hidden group-hover/menu:block z-30 transform origin-top-right transition-all">
                                        <button onClick={() => openEdit(order)} className="w-full text-right px-3 py-2 rounded-lg hover:bg-slate-50 text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-2"><Pencil size={14} /> تعديل المشروع</button>
                                        <button onClick={() => openReschedule(order)} className="w-full text-right px-3 py-2 rounded-lg hover:bg-slate-50 text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-2"><History size={14} /> تغيير الموعد</button>
                                        {onDelete && <div className="h-px bg-slate-100 my-1"></div>}
                                        {onDelete && <button onClick={() => onDelete(order.id)} className="w-full text-right px-3 py-2 rounded-lg hover:bg-red-50 text-xs font-bold text-red-500 hover:text-red-700 flex items-center gap-2"><Trash2 size={14} /> حذف المشروع</button>}
                                    </div>
                                </div>
                           </div>

                           <div className="mb-4">
                                <p className="text-base font-bold text-slate-600 line-clamp-2">{order.productType}</p>
                           </div>

                           <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                                <div className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                                    <Calendar size={12} />
                                    <span>تسليم:</span>
                                    <span className={`font-black tabular-nums ${urgency.textColor}`}>{new Date(order.deliveryDate).toLocaleDateString('en-GB')}</span>
                                </div>
                                {order.isRescheduled ? (
                                    <div className="flex items-center gap-1.5 text-blue-600 bg-blue-100 px-2 py-1 rounded-full text-[10px] font-black animate-pulse">
                                        <History size={14} />
                                        <span>مُجدول</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                      <Clock size={14} className="text-slate-300"/>
                                      <span className="text-xs font-black text-slate-400">{order.totalProductionDays} أيام عمل</span>
                                    </div>
                                )}
                           </div>
                            <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-100">
                                <div className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                                    <CircleDollarSign size={12} />
                                    <span>المالية:</span>
                                    <span className="font-black tabular-nums">
                                        <span className={ (order.paidAmount || 0) >= (order.price || 0) ? 'text-emerald-600' : 'text-orange-600'}>{formatCurrency(order.paidAmount)}</span>
                                        <span className="text-slate-400"> / {formatCurrency(order.price)}</span>
                                    </span>
                                </div>
                            </div>
                        </div>
                      );
                    }) : (
                        <div className="h-64 flex flex-col items-center justify-center text-center opacity-70 p-4">
                           <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-4 bg-${stage.color}-100 text-${stage.color}-300`}>
                              {React.createElement(stage.icon, { size: 48 })}
                           </div>
                           <p className="text-slate-400 font-bold text-sm">لا توجد مشاريع في مرحلة {stage.name}</p>
                        </div>
                    )}
                    </div>
                 </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const CustomersView: React.FC<CustomersViewProps> = ({ customers, orders, onAdd, onEdit, onDelete, onWhatsApp, initialFormOpen }) => {
  const [q, setQ] = useState('');
  const [form, setForm] = useState({ name: '', phone: '', address: '' });
  const [isFormOpen, setIsFormOpen] = useState(initialFormOpen);
  const filtered = customers.filter(c => c.name.toLowerCase().includes(q.toLowerCase()) || c.phone.includes(q));

  return (
    <div className="space-y-8 tab-enter">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-white p-6 rounded-3xl border shadow-sm">
         <div className="relative w-full max-w-xl">
            <Search className="absolute right-4 top-4 text-slate-300" size={20} />
            <input type="text" placeholder="البحث في قاعدة بيانات العملاء..." value={q} onChange={e => setQ(e.target.value)} className="input-professional pr-12 text-sm" />
         </div>
         <button onClick={() => setIsFormOpen(!isFormOpen)} className="bg-orange-600 text-white px-10 py-4 rounded-2xl font-black text-sm flex items-center gap-3 flex-shrink-0 shadow-xl hover:bg-orange-700 active:scale-95 transition-all">
            {isFormOpen ? <X size={20} /> : <UserPlus size={20} />} {isFormOpen ? 'إلغاء' : 'تسجيل عميل جديد'}
         </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
         <div className={`lg:col-span-4 ${isFormOpen ? 'block' : 'hidden lg:block'}`}>
            <div className="professional-card p-8 border-t-8 border-slate-950 sticky top-8">
               <h4 className="text-xl font-black text-slate-900 mb-8 border-b pb-4">بيانات العميل الجديد</h4>
               <form className="space-y-5" onSubmit={e => { e.preventDefault(); onAdd(form.name, form.phone, form.address); setForm({name:'', phone:'', address:''}); if(window.innerWidth < 1024) setIsFormOpen(false); }}>
                  <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="الاسم الكامل" required className="input-professional text-center" />
                  <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="رقم الهاتف" required className="input-professional text-center tabular-nums" />
                  <textarea value={form.address} onChange={e => setForm({...form, address: e.target.value})} placeholder="العنوان والوصف الفني..." required className="input-professional h-32 resize-none text-center text-sm" />
                  <div className="p-4 bg-orange-50 rounded-xl text-center">
                    <p className="text-xs font-bold text-orange-800">سيتم إنشاء رقم تسلسلي (ID) للعميل تلقائياً</p>
                  </div>
                  <button type="submit" className="w-full bg-slate-950 text-white py-5 rounded-2xl font-black text-xl shadow-2xl hover:bg-slate-800 transition-all border-b-4 border-black">حفظ وإضافة للقاعدة</button>
               </form>
            </div>
         </div>

         <div className="lg:col-span-8 space-y-4">
            {filtered.map(c => {
                const customerOrders = orders.filter(o => o.id === c.id);
                const totalOrders = customerOrders.length;
                const totalSpending = customerOrders.reduce((sum, o) => sum + (o.price || 0), 0);
                return (
                  <div key={c.id} className="professional-card p-6 grid grid-cols-12 gap-6 items-center group transition-all duration-300 hover:border-emerald-300 hover:shadow-xl">
                      {/* Info Section */}
                      <div className="col-span-12 md:col-span-8 flex items-center gap-6">
                          <div className="w-20 h-20 bg-slate-100 group-hover:bg-emerald-100 rounded-2xl flex items-center justify-center text-slate-400 group-hover:text-emerald-500 font-black text-4xl transition-all flex-shrink-0 shadow-inner">
                              {c.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                              <div className="flex items-baseline gap-3">
                                  <h5 className="text-2xl font-black text-slate-900 truncate">{c.name}</h5>
                                  <span className="text-xs font-bold text-slate-400">#{c.serialNumber}</span>
                              </div>
                              <div className="flex flex-col gap-2 mt-2 text-sm font-bold text-slate-500">
                                  <span className="flex items-center gap-2"><MapPin size={14} className="text-slate-300"/> {c.address}</span>
                                   <div className="flex items-center gap-4">
                                      <span className="flex items-center gap-2"><Package size={14} className="text-slate-300"/> {totalOrders} مشاريع</span>
                                      <span className="flex items-center gap-2"><Banknote size={14} className="text-slate-300"/> {formatCurrency(totalSpending)}</span>
                                  </div>
                              </div>
                          </div>
                      </div>
                      {/* Actions Section */}
                      <div className="col-span-12 md:col-span-4 flex flex-col md:items-end gap-4 border-t md:border-t-0 md:border-r border-slate-100 pt-4 md:pt-0 md:pr-6">
                           <div className="text-right w-full">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">رقم الاتصال</p>
                              <p className="text-2xl font-black text-emerald-600 tabular-nums tracking-tighter">{c.phone}</p>
                          </div>
                          <div className="flex items-center gap-2 w-full">
                              <button onClick={() => onWhatsApp(c)} className="flex-1 text-center bg-emerald-500 text-white px-4 py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 active:scale-95">
                                  <MessageCircle size={16} />
                                  <span>واتساب</span>
                              </button>
                              <button onClick={() => onEdit(c)} className="bg-slate-100 text-slate-600 px-4 py-3 rounded-xl hover:bg-slate-200 transition-all active:scale-95" title="تعديل العميل">
                                  <Pencil size={16} />
                              </button>
                              <button onClick={() => onDelete(c.id)} className="bg-slate-100 text-slate-600 px-4 py-3 rounded-xl hover:bg-red-50 hover:text-red-600 transition-all active:scale-95" title="حذف العميل">
                                  <Trash2 size={16} />
                              </button>
                          </div>
                      </div>
                  </div>
                )
            })}
            {filtered.length === 0 && <p className="text-center py-20 text-slate-400 italic">لا يوجد نتائج بحث</p>}
         </div>
      </div>
    </div>
  );
};

const NewOrderView: React.FC<NewOrderViewProps> = ({ customers, orders, invoices, onAdd, config, getSuggestedDeliveryDate, addToast }) => {
  const [selectedCust, setSelectedCust] = useState<string | null>(null);
  const [selectedProds, setSelectedProds] = useState<Record<string, number>>({});
  const [deliveryDate, setDeliveryDate] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [scheduleAnalysis, setScheduleAnalysis] = useState<{
    initialDate: number;
    finalDate: number;
    conflictingOrderId: string | null;
    totalProductionDays: number;
  } | null>(null);
  const [manualConflict, setManualConflict] = useState<Order | null>(null);

  const resetForm = () => {
    setIsResetting(true);
    setSelectedCust(null);
    setSelectedProds({});
    setDeliveryDate('');
    setCustomerSearch('');
    setScheduleAnalysis(null);
    setManualConflict(null);
    setTimeout(() => setIsResetting(false), 300);
  };

  const handleAddWrapper = () => {
    const hasProducts = Object.values(selectedProds).some((qty: number) => qty > 0);

    if (selectedCust && hasProducts && deliveryDate && scheduleAnalysis) {
      const parts = deliveryDate.split('-');
      const localDate = new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
      
      const selectedIds = Object.keys(selectedProds).filter(id => (selectedProds[id] ?? 0) > 0);
      let finalProductType = "";
      
      if (selectedIds.length === 1 && selectedProds[selectedIds[0]] === 1) {
          finalProductType = config[selectedIds[0]].name;
      } else {
          finalProductType = selectedIds.map(id => {
              const name = config[id].name;
              const qty = selectedProds[id];
              return `${name} (x${qty})`;
          }).join(', ');
      }
      
      onAdd(selectedCust, finalProductType, localDate.getTime(), scheduleAnalysis.totalProductionDays);
      resetForm();
    }
  };

  const incrementProduct = (id: string) => {
    setSelectedProds(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  };

  const decrementProduct = (id: string) => {
    setSelectedProds(prev => ({ ...prev, [id]: Math.max((prev[id] || 0) - 1, 0) }));
  };

  const checkDateConflict = (dateStr: string) => {
    if (!dateStr) {
      setManualConflict(null);
      return;
    }
    const parts = dateStr.split('-');
    const targetDate = new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
  
    const conflict = orders.find(o => {
      if (o.status === 'delivered') return false;
      const orderDate = new Date(o.deliveryDate);
      return orderDate.getUTCFullYear() === targetDate.getUTCFullYear() &&
             orderDate.getUTCMonth() === targetDate.getUTCMonth() &&
             orderDate.getUTCDate() === targetDate.getUTCDate();
    });
  
    setManualConflict(conflict || null);
  };

  useEffect(() => {
    const hasSelection = Object.values(selectedProds).some((q: number) => q > 0);
    if (hasSelection) {
      const analysis = getSuggestedDeliveryDate(selectedProds);
      setScheduleAnalysis(analysis);
      if (analysis) {
        const finalDate = new Date(analysis.finalDate);
        const timezoneOffset = finalDate.getTimezoneOffset() * 60000;
        const localDateStr = new Date(finalDate.getTime() - timezoneOffset).toISOString().split('T')[0];
        setDeliveryDate(localDateStr);
        checkDateConflict(localDateStr);
      }
    } else {
      setDeliveryDate('');
      setScheduleAnalysis(null);
      setManualConflict(null);
    }
  }, [selectedProds, getSuggestedDeliveryDate]);

  const filteredCustomers = useMemo(() => {
    if (!customers) return [];
    const term = customerSearch.trim().toLowerCase();
    return customers.filter(c => c.name.toLowerCase().includes(term) || c.phone.includes(term));
  }, [customers, customerSearch]);

  const currentCustomer = customers.find(c => c.id === selectedCust);
  // FIX: The result of Object.values is explicitly cast to number[] to resolve a type inference issue.
  const totalItems: number = (Object.values(selectedProds) as number[]).reduce((a, b) => a + b, 0);
  
  // التحقق من الشروط المطلوبة لإضافة طلب جديد
  const customerOrders = selectedCust ? orders.filter(o => o.customerId === selectedCust) : [];
  const customerInvoices = selectedCust ? invoices.filter(inv => customerOrders.some(o => o.id === inv.orderId)) : [];
  const hasInvoice = customerInvoices.length > 0;
  const hasPaidDeposit = customerOrders.some(o => (o.paidAmount || 0) > 0);
  const canAddOrder = hasInvoice && hasPaidDeposit;
  
  const isComplete = selectedCust && totalItems > 0 && deliveryDate && canAddOrder;

  const conflictingOrder = manualConflict || (scheduleAnalysis?.conflictingOrderId ? orders.find((o: Order) => o.id === scheduleAnalysis.conflictingOrderId) : null);
  const conflictingCustomer = conflictingOrder ? customers.find((c: Customer) => c.id === conflictingOrder.customerId) : null;
  
  return (
    <div className={`tab-enter w-full flex flex-col ${isResetting ? 'opacity-0 scale-95' : 'opacity-100 scale-100'} transition-all duration-500`}>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 items-start">
        
        <div className="lg:col-span-3 flex flex-col gap-10">
            {/* Step 1: Customer */}
            <div className="space-y-6 animate-slide-in" style={{animationDelay: '100ms'}}>
                <div className="flex items-center gap-4 border-b-2 border-slate-200 pb-4">
                    <span className="flex items-center justify-center w-12 h-12 bg-slate-900 text-white font-black text-2xl rounded-2xl flex-shrink-0">1</span>
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight">اختيار العميل</h2>
                </div>
                
                {selectedCust ? (
                    <div className="professional-card bg-emerald-50 border-emerald-200 p-6 flex items-center gap-6 animate-in fade-in zoom-in-95 duration-500">
                        <div className="w-16 h-16 bg-emerald-600 text-white rounded-2xl flex items-center justify-center font-black text-3xl shadow-lg flex-shrink-0">
                            {currentCustomer?.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-black text-slate-900 text-2xl truncate tracking-tight">{currentCustomer?.name}</p>
                            <p className="text-xs font-bold text-slate-400 tabular-nums mt-1">ID: #{currentCustomer?.serialNumber}</p>
                             <div className="flex items-center gap-4 text-slate-600 font-bold text-sm mt-2">
                               <span className="flex items-center gap-2"><Phone size={14}/> {currentCustomer?.phone}</span>
                               <span className="flex items-center gap-2"><MapPin size={14}/> {currentCustomer?.address}</span>
                            </div>
                        </div>
                        <button onClick={() => setSelectedCust(null)} className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><X size={24}/></button>
                    </div>
                ) : (
                    <div className="professional-card p-6 space-y-4">
                        <div className="relative group">
                            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-orange-500 transition-colors" size={18} />
                            <input 
                                type="text" 
                                placeholder="ابحث بالاسم أو الهاتف..." 
                                value={customerSearch}
                                onChange={e => setCustomerSearch(e.target.value)}
                                className="input-professional pr-12 text-sm !py-4 !rounded-xl"
                            />
                        </div>
                        <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                            {filteredCustomers.map(c => (
                                <button key={c.id} onClick={() => setSelectedCust(c.id)} className="w-full text-right p-4 rounded-xl border border-slate-100 bg-white hover:border-orange-300 hover:bg-orange-50 hover:shadow-lg transition-all flex items-center gap-4 group">
                                    <div className="w-12 h-12 bg-slate-100 group-hover:bg-orange-100 text-slate-400 group-hover:text-orange-500 rounded-lg flex items-center justify-center font-black text-xl transition-colors flex-shrink-0">{c.name.charAt(0)}</div>
                                    <div>
                                        <span className="font-black text-slate-800 text-lg group-hover:text-orange-600 transition-colors">{c.name}</span>
                                        <div className="flex items-center gap-4 text-xs font-bold text-slate-400 tabular-nums">
                                            <span>#{c.serialNumber}</span>
                                            <span className="flex items-center gap-1"><Phone size={12}/> {c.phone}</span>
                                        </div>
                                    </div>
                                </button>
                            ))}
                            {filteredCustomers.length === 0 && <div className="text-center py-10 text-slate-400 italic text-sm font-bold">لا يوجد عملاء مطابقون للبحث</div>}
                        </div>
                    </div>
                )}
            </div>

            {/* Step 2: Products */}
            <div className={`space-y-6 transition-all duration-500 ${!selectedCust ? 'opacity-30 grayscale pointer-events-none' : 'animate-slide-in'}`} style={{animationDelay: '200ms'}}>
                <div className="flex items-center gap-4 border-b-2 border-slate-200 pb-4">
                    <span className="flex items-center justify-center w-12 h-12 bg-slate-900 text-white font-black text-2xl rounded-2xl flex-shrink-0">2</span>
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight">تحديد المنتجات المطلوبة</h2>
                </div>
                <div className="professional-card p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                      {(Object.values(config) as ProductConfig[]).map((p: ProductConfig) => {
                          const qty = selectedProds[p.id] || 0;
                          const isSelected = qty > 0;
                          const Icon = getIcon(p.iconKey);
                          
                          return (
                              <div 
                                  key={p.id} 
                                  className={`group relative p-4 rounded-3xl border-2 transition-all duration-300 flex flex-col items-center text-center overflow-hidden
                                      ${isSelected 
                                          ? 'border-orange-500 bg-orange-50/50 shadow-xl' 
                                          : 'border-slate-100 bg-white hover:border-orange-200 hover:shadow-lg'}`}
                              >
                                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 transition-all duration-500 
                                      ${isSelected 
                                          ? `bg-orange-600 text-white shadow-lg shadow-orange-900/20 transform rotate-6`
                                          : `bg-slate-100 text-slate-400 group-hover:bg-orange-100 group-hover:text-orange-500`}`}>
                                      <Icon size={28} />
                                  </div>

                                  <div className="mb-4 w-full">
                                      <h4 className={`text-sm font-black transition-colors leading-tight ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>
                                          {p.name}
                                      </h4>
                                      <div className="flex items-center justify-center gap-1.5 mt-1.5">
                                          <Clock size={10} className={isSelected ? 'text-orange-600' : 'text-slate-400'} />
                                          <p className={`text-[10px] font-bold ${isSelected ? 'text-orange-800' : 'text-slate-400'}`}>
                                              {p.productionDays} أيام عمل
                                          </p>
                                      </div>
                                  </div>

                                  <div className={`mt-auto w-full flex items-center justify-between gap-1 p-1 rounded-2xl border transition-all duration-300
                                      ${isSelected ? 'bg-white border-orange-200 shadow-inner' : 'bg-slate-50 border-slate-200'}`}>
                                      <button onClick={() => decrementProduct(p.id)} className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all ${qty > 0 ? 'text-slate-400 hover:bg-red-50 hover:text-red-500 active:scale-90' : 'opacity-0 cursor-default'}`}><Minus size={16} strokeWidth={4}/></button>
                                      <span className={`text-2xl font-black tabular-nums transition-all duration-300 ${isSelected ? 'text-slate-900' : 'text-slate-300'}`}>{qty}</span>
                                      <button onClick={() => incrementProduct(p.id)} className={`w-10 h-10 flex items-center justify-center rounded-lg shadow-sm transition-all active:scale-90 ${isSelected ? 'bg-orange-600 text-white hover:bg-orange-500 shadow-orange-300/50' : 'bg-slate-900 text-white hover:bg-slate-800'}`}><PlusCircle size={16} strokeWidth={4}/></button>
                                  </div>
                              </div>
                          );
                      })}
                  </div>
                </div>
            </div>
        </div>

        <div className="lg:col-span-2 lg:sticky lg:top-10 animate-slide-in" style={{animationDelay: '300ms'}}>
          <div className={`p-8 flex flex-col gap-6 relative bg-slate-950 border-slate-800 shadow-2xl rounded-[40px] transition-all duration-500`}>
             <div className="flex items-center gap-4 border-b border-slate-800 pb-4">
                  <span className="flex items-center justify-center w-12 h-12 bg-slate-800 text-white font-black text-2xl rounded-2xl flex-shrink-0">3</span>
                  <h2 className="text-2xl font-black text-white tracking-tight">جدولة أمر العمل</h2>
              </div>
              
              <div className="flex items-center gap-4 bg-slate-800/50 p-4 rounded-2xl border border-slate-700">
                  <div className="w-12 h-12 bg-orange-900/50 rounded-lg flex items-center justify-center text-orange-500 border border-orange-500/20 shadow-inner"><Clock size={24} /></div>
                  <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">إجمالي أيام الإنتاج</p>
                      <p className="text-2xl font-black text-white tabular-nums">{scheduleAnalysis?.totalProductionDays || 0} <span className="text-sm text-slate-400 font-bold tracking-normal">يوم عمل</span></p>
                  </div>
              </div>

              <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2 flex items-center gap-2"><Calendar size={12} /> موعد التسليم المقترح</label>
                  <input type="date" value={deliveryDate} onChange={e => { setDeliveryDate(e.target.value); checkDateConflict(e.target.value); }} className="w-full bg-slate-900 border-2 border-slate-700 rounded-2xl p-4 text-orange-500 font-black text-2xl outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all text-center tabular-nums shadow-inner" />
              </div>
              
              <div className="flex-1 space-y-4 min-h-[150px]">
                  {scheduleAnalysis && (
                      conflictingOrder ? (
                          <div className="bg-gradient-to-br from-red-500/10 to-orange-500/10 border-2 border-red-500/30 p-5 rounded-3xl flex flex-col gap-4 animate-in fade-in duration-500">
                              <div className="flex items-start gap-4">
                                  <div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-red-900/40"><ShieldAlert className="text-white" size={24} /></div>
                                  <div>
                                      <p className="text-sm font-black text-red-400 uppercase tracking-widest mb-0.5">تنبيه: تعارض بالجدول</p>
                                      <p className="font-bold text-white leading-tight">هذا الموعد محجوز لمشروع العميل: <span className="text-red-300 underline">{conflictingCustomer?.name}</span></p>
                                  </div>
                              </div>
                              <div className="pt-4 border-t border-white/10 text-center space-y-3">
                                <p className="text-xs font-bold text-slate-300">يقترح النظام تأجيل التسليم إلى:</p>
                                <p className="text-2xl font-black text-emerald-400 tabular-nums">{new Date(scheduleAnalysis.finalDate).toLocaleDateString('ar-LY', {dateStyle: 'long'})}</p>
                                <button onClick={() => { const finalDate = new Date(scheduleAnalysis.finalDate); const timezoneOffset = finalDate.getTimezoneOffset() * 60000; const localDateStr = new Date(finalDate.getTime() - timezoneOffset).toISOString().split('T')[0]; setDeliveryDate(localDateStr); setManualConflict(null); }} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-lg text-sm font-black shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"><Check size={18}/> اعتماد التاريخ المقترح</button>
                              </div>
                          </div>
                      ) : (
                          <div className="bg-gradient-to-br from-emerald-500/10 to-blue-500/10 border-2 border-emerald-500/30 p-5 rounded-3xl flex items-center gap-4 animate-in fade-in duration-500">
                              <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-900/40"><CheckCircle2 className="text-white" size={24} /></div>
                              <div>
                                  <p className="text-sm font-black text-emerald-400 uppercase tracking-widest mb-0.5">جدولة متاحة</p>
                                  <p className="font-bold text-white leading-tight">الموعد المحدد متاح ولا يتعارض مع أي مشروع آخر.</p>
                              </div>
                          </div>
                      )
                  )}
              </div>

              <div className="mt-auto space-y-4">
                  {selectedCust && (!hasInvoice || !hasPaidDeposit) && (
                      <div className="bg-red-500/10 border-2 border-red-500/30 p-4 rounded-2xl">
                          <div className="flex items-start gap-3">
                              <AlertTriangle className="text-red-400 flex-shrink-0 mt-0.5" size={20} />
                              <div className="text-right">
                                  <p className="font-black text-red-400 text-sm mb-2">يجب استيفاء الشروط التالية أولاً:</p>
                                  <ul className="space-y-1 text-xs font-bold text-red-300">
                                      {!hasInvoice && <li>• تحرير فاتورة للعميل من قسم المحاسبة</li>}
                                      {!hasPaidDeposit && <li>• دفع العربون من قسم المحاسبة - استلام دفعة</li>}
                                  </ul>
                              </div>
                          </div>
                      </div>
                  )}
                  <button onClick={handleAddWrapper} disabled={!isComplete} className={`w-full py-6 rounded-3xl font-black text-2xl transition-all duration-300 flex items-center justify-center gap-4 shadow-2xl border-b-8 active:translate-y-1 active:border-b-4 ${isComplete ? 'bg-orange-600 text-white border-orange-800 hover:bg-orange-500 shadow-orange-950/60' : 'bg-slate-800 text-slate-600 border-slate-900 cursor-not-allowed'}`}>
                      <Rocket size={32} className={`${isComplete ? 'animate-bounce' : ''}`}/>
                      <span>إطلاق أمر التشغيل</span>
                  </button>
              </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const CalendarView: React.FC<CalendarViewProps> = ({ orders, customers, productsConfig, onOrderClick, onDateDrop }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [draggedOrderId, setDraggedOrderId] = useState<string | null>(null);
    const [dropTargetDate, setDropTargetDate] = useState<Date | null>(null);

    const changeMonth = (delta: number) => {
        setCurrentDate(prev => {
            const newDate = new Date(prev);
            newDate.setMonth(newDate.getMonth() + delta);
            return newDate;
        });
    };

    const ordersByDate = useMemo(() => {
        const map = new Map<string, Order[]>();
        orders.filter(o => o.status !== 'delivered').forEach(order => {
            const date = new Date(order.deliveryDate).toDateString();
            if (!map.has(date)) {
                map.set(date, []);
            }
            map.get(date)?.push(order);
        });
        return map;
    }, [orders]);

    const calendarGrid = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);

        let days: (Date | null)[] = [];
        for (let i = 0; i < firstDayOfMonth.getDay(); i++) {
            days.push(null);
        }
        for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
            days.push(new Date(year, month, i));
        }
        return days;
    }, [currentDate]);
    
    const today = new Date();

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, orderId: string) => {
        e.dataTransfer.effectAllowed = 'move';
        setDraggedOrderId(orderId);
    };
    
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>, day: Date | null) => {
        e.preventDefault();
        if(day) setDropTargetDate(day);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>, day: Date | null) => {
        e.preventDefault();
        if (day && draggedOrderId) {
            onDateDrop(draggedOrderId, day);
        }
        setDraggedOrderId(null);
        setDropTargetDate(null);
    };

    return (
        <div className="professional-card p-8 tab-enter">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-200">
                <div className="flex items-center gap-2">
                    <button onClick={() => changeMonth(-1)} className="p-3 rounded-xl hover:bg-slate-100"><ChevronRight size={24}/></button>
                    <button onClick={() => setCurrentDate(new Date())} className="text-sm font-black bg-slate-100 px-4 py-2 rounded-lg hover:bg-slate-200">اليوم</button>
                    <button onClick={() => changeMonth(1)} className="p-3 rounded-xl hover:bg-slate-100"><ChevronLeft size={24}/></button>
                </div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                    {currentDate.toLocaleString('ar-LY', { month: 'long', year: 'numeric' })}
                </h2>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
                {['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'].map(day => (
                    <div key={day} className="text-sm font-black text-slate-400 uppercase py-2">{day}</div>
                ))}
                {calendarGrid.map((day, index) => {
                    const dayOrders = day ? ordersByDate.get(day.toDateString()) || [] : [];
                    const isToday = day ? day.toDateString() === today.toDateString() : false;
                    const isDropTarget = dropTargetDate && day && dropTargetDate.toDateString() === day.toDateString();

                    return (
                        <div 
                            key={index} 
                            onDragOver={(e) => handleDragOver(e, day)}
                            onDrop={(e) => handleDrop(e, day)}
                            onDragLeave={() => setDropTargetDate(null)}
                            className={`h-56 border border-slate-100 rounded-lg p-2 flex flex-col overflow-hidden relative transition-all duration-200 ${day ? 'bg-white' : 'bg-slate-50'} ${isDropTarget ? 'border-orange-500 bg-orange-50 scale-105 shadow-2xl z-10' : ''}`}>
                            {day && (
                                <>
                                    <span className={`text-lg font-black mb-1 ${isToday ? 'text-white bg-orange-600 rounded-full w-9 h-9 flex items-center justify-center' : 'text-slate-800'}`}>{day.getDate()}</span>
                                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1 pr-1">
                                        {dayOrders.map(order => {
                                            const customer = customers.find(c => c.id === order.customerId);
                                            const prodKey = order.productType.split(',')[0].trim().split(' (x')[0];
                                            const productConfig = ((Object.values(productsConfig) as ProductConfig[]).find((p: ProductConfig) => p.name === prodKey) || { color: 'slate', id: 'default', name: order.productType, productionDays: 0, iconKey: 'Package' }) as ProductConfig;
                                            return (
                                                <div
                                                    key={order.id}
                                                    draggable
                                                    onDragStart={(e) => handleDragStart(e, order.id)}
                                                    onClick={() => onOrderClick(order)}
                                                    className={`p-2 rounded-lg cursor-grab active:cursor-grabbing transition-all w-full text-right ${draggedOrderId === order.id ? 'opacity-30' : ''}`}
                                                    style={{ borderRight: `4px solid var(--color-${productConfig.color}-500, ${productConfig.color})`, backgroundColor: `rgba(var(--tw-color-${productConfig.color}-50), 1)`}}
                                                >
                                                    <p className="font-black text-slate-800 text-sm truncate">{customer?.name}</p>
                                                    <div className="mt-1 space-y-0.5 text-[10px] font-bold text-slate-500">
                                                        <p className="flex items-center gap-1">
                                                            <Hash size={12} className="text-slate-400" />
                                                            <span className="truncate">#{customer?.serialNumber}</span>
                                                        </p>
                                                        <p className="flex items-center gap-1">
                                                            <Package size={12} className="text-slate-400" />
                                                            <span className="truncate">{order.productType}</span>
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// Cash Receipt View Component
interface CashReceiptViewProps {
    invoices: Invoice[];
    customers: Customer[];
    orders: Order[];
    paymentReceipts: PaymentReceipt[];
    setPaymentReceipts: (receipts: PaymentReceipt[]) => void;
    setInvoices: (invoices: Invoice[]) => void;
    setOrders: (orders: Order[]) => void;
    addToast: (message: string, type?: Toast['type']) => void;
    productsConfig: Record<string, ProductConfig>;
    companyLogo: string | null;
}

const CashReceiptView: React.FC<CashReceiptViewProps> = ({ invoices, customers, orders, paymentReceipts, setPaymentReceipts, setInvoices, setOrders, addToast, productsConfig, companyLogo }) => {
    const [customerSearch, setCustomerSearch] = useState('');
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
    const [receiptForm, setReceiptForm] = useState<{
        invoiceId: string;
        amount: number;
        paymentDate: number;
        notes?: string;
    }>({
        invoiceId: '',
        amount: 0,
        paymentDate: Date.now(),
        notes: ''
    });

    // Filter customers by search query
    const filteredCustomers = useMemo(() => {
        if (!customerSearch.trim()) return [];
        const query = customerSearch.toLowerCase().trim();
        return customers.filter(c => 
            c.name.toLowerCase().includes(query) ||
            c.phone.includes(query) ||
            (c.address && c.address.toLowerCase().includes(query))
        ).slice(0, 8); // Limit to 8 results
    }, [customers, customerSearch]);

    // Get customer invoices with remaining balance
    const customerInvoices = useMemo(() => {
        if (!selectedCustomerId) return [];
        return invoices
            .filter(inv => {
                if (inv.customerId !== selectedCustomerId) return false;
                const order = orders.find(o => o.id === inv.orderId);
                if (!order) return false;
                const paid = order.paidAmount || 0;
                return inv.totalAmount > paid;
            })
            .map(inv => {
                const order = orders.find(o => o.id === inv.orderId);
                const paid = order?.paidAmount || 0;
                const remaining = inv.totalAmount - paid;
                return { ...inv, remaining, order };
            })
            .sort((a, b) => b.remaining - a.remaining);
    }, [invoices, orders, selectedCustomerId]);

    const selectedCustomer = useMemo(() => {
        return customers.find(c => c.id === selectedCustomerId);
    }, [customers, selectedCustomerId]);

    const selectedInvoice = useMemo(() => invoices.find(inv => inv.id === receiptForm.invoiceId), [invoices, receiptForm.invoiceId]);
    const selectedOrder = useMemo(() => {
        if (!selectedInvoice) return null;
        return orders.find(o => o.id === selectedInvoice.orderId);
    }, [orders, selectedInvoice]);

    const invoiceRemaining = useMemo(() => {
        if (!selectedInvoice || !selectedOrder) return 0;
        const paid = selectedOrder.paidAmount || 0;
        return Math.max(selectedInvoice.totalAmount - paid, 0);
    }, [selectedInvoice, selectedOrder]);

    const isFormValid = useMemo(() => {
        return !!receiptForm.invoiceId && receiptForm.amount > 0 && receiptForm.amount <= invoiceRemaining;
    }, [receiptForm, invoiceRemaining]);

    const generateReceiptNumber = () => {
        if (paymentReceipts.length === 0) return 1;
        const maxNumber = Math.max(...paymentReceipts.map(r => r.receiptNumber));
        return maxNumber + 1;
    };

    const handleCreateReceipt = (print: boolean) => {
        if (!isFormValid || !selectedInvoice || !selectedCustomer || !selectedOrder) {
            addToast("يرجى ملء جميع البيانات بشكل صحيح.", 'error');
            return;
        }

        const receiptNumber = generateReceiptNumber();
        const newReceipt: PaymentReceipt = {
            id: `receipt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            receiptNumber,
            invoiceId: receiptForm.invoiceId,
            customerId: selectedInvoice.customerId,
            amount: receiptForm.amount,
            paymentDate: receiptForm.paymentDate,
            createdAt: Date.now(),
            notes: receiptForm.notes || undefined
        };

        // Update order paid amount
        const newPaidAmount = (selectedOrder.paidAmount || 0) + receiptForm.amount;
        setOrders(orders.map(o => 
            o.id === selectedOrder.id 
                ? { ...o, paidAmount: Math.min(newPaidAmount, selectedInvoice.totalAmount) }
                : o
        ));

        // Update invoice status if fully paid
        if (newPaidAmount >= selectedInvoice.totalAmount) {
            setInvoices(invoices.map(inv => 
                inv.id === selectedInvoice.id 
                    ? { ...inv, status: 'paid' }
                    : inv
            ));
        }

        // Add receipt
        setPaymentReceipts([newReceipt, ...paymentReceipts].sort((a, b) => b.createdAt - a.createdAt));

        if (print) {
            printReceipt(newReceipt, selectedCustomer, selectedInvoice, selectedOrder);
        }

        addToast(print ? "تم إنشاء الإيصال وطباعته بنجاح." : "تم إنشاء الإيصال بنجاح.", 'success');
        setReceiptForm({ invoiceId: '', amount: 0, paymentDate: Date.now(), notes: '' });
        setCustomerSearch('');
        setSelectedCustomerId('');
    };

    const printReceipt = (receipt: PaymentReceipt, customer: Customer, invoice: Invoice, order: Order) => {
        const receiptWindow = window.open('', '_blank');
        if (!receiptWindow) {
            addToast('يرجى السماح بالنوافذ المنبثقة لطباعة الإيصال', 'error');
            return;
        }

        const prodName = productsConfig[order.productType]?.name || order.productType;
        const prevPaid = order.paidAmount || 0;
        const remainingAfter = Math.max(invoice.totalAmount - (prevPaid + receipt.amount), 0);

        receiptWindow.document.write(`
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>إيصال استلام نقدي #${receipt.receiptNumber}</title>
                <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;900&display=swap" rel="stylesheet">
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Tajawal', sans-serif; }
                    body { padding: 32px; background: #fff; color: #0f172a; }
                    .receipt { max-width: 820px; margin: 0 auto; }
                    .header { border-bottom: 4px solid #2563eb; padding-bottom: 20px; margin-bottom: 20px; }
                    .header-content { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
                    .logo { width: 72px; height: 72px; background: #2563eb; border-radius: 16px; display: flex; align-items: center; justify-content: center; color: white; font-size: 36px; font-weight: 900; }
                    h1 { font-size: 28px; font-weight: 900; }
                    .muted { color: #64748b; font-weight: 700; margin-top: 6px; }
                    .titleBox { border-right: 4px solid #2563eb; padding-right: 16px; text-align: left; }
                    .titleBox h2 { font-size: 40px; font-weight: 900; }
                    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 16px 0; }
                    .box { background: #f1f5f9; border: 2px solid #cbd5e1; border-radius: 14px; padding: 16px; }
                    .box h3 { font-size: 14px; font-weight: 900; color: #334155; margin-bottom: 10px; border-bottom: 2px solid #cbd5e1; padding-bottom: 8px; }
                    .box p { font-size: 16px; font-weight: 900; margin: 6px 0; overflow-wrap: break-word; word-break: break-word; }
                    .amount { background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); border: 4px solid #2563eb; border-radius: 16px; padding: 24px; margin: 16px 0; text-align: center; }
                    .amount .label { font-size: 18px; font-weight: 900; color: #1e40af; }
                    .amount .value { font-size: 56px; font-weight: 900; color: #1e3a8a; margin-top: 8px; }
                    .rows { margin-top: 12px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
                    .mini { background: rgba(255,255,255,0.7); border: 2px solid rgba(37,99,235,0.3); border-radius: 14px; padding: 12px; }
                    .mini .k { color: #0f172a; font-size: 12px; font-weight: 900; }
                    .mini .v { color: #1e40af; font-size: 18px; font-weight: 900; margin-top: 6px; }
                    .footer { border-top: 4px solid #0f172a; padding-top: 18px; margin-top: 18px; text-align: center; }
                    .footer p { font-weight: 900; margin: 6px 0; }
                    @media print { body { padding: 18px; } }
                </style>
            </head>
            <body>
                <div class="receipt">
                    <header class="header">
                        <div class="header-content">
                            <div style="display:flex; align-items:center; gap: 14px;">
                                ${companyLogo ? `<img src="${companyLogo}" alt="شعار الشركة" style="width: 72px; height: 72px; object-fit: contain; border-radius: 16px;" />` : `<div class="logo">D</div>`}
                                <div>
                                    <h1>مصنع ديكورا</h1>
                                    <div class="muted">للأثاث والمطابخ والديكور</div>
                                </div>
                            </div>
                            <div class="titleBox">
                                <h2>إيصال استلام نقدي</h2>
                                <div class="muted">رقم الإيصال: #${receipt.receiptNumber}</div>
                                <div class="muted">التاريخ: ${new Date(receipt.paymentDate).toLocaleDateString('ar-LY')}</div>
                            </div>
                        </div>
                    </header>

                    <section class="grid">
                        <div class="box">
                            <h3>استلمنا من</h3>
                            <p>${customer.name}</p>
                            <p class="muted" style="font-size: 13px;">${customer.address}</p>
                            <p class="muted" style="font-size: 13px;">${customer.phone}</p>
                        </div>
                        <div class="box">
                            <h3>معلومات الفاتورة</h3>
                            <p>فاتورة رقم: #${invoice.invoiceNumber}</p>
                            <p class="muted" style="font-size: 13px;">${prodName}</p>
                            <p class="muted" style="font-size: 13px;">إجمالي الفاتورة: ${formatCurrency(invoice.totalAmount)}</p>
                        </div>
                    </section>

                    <section class="amount">
                        <div class="label">مبلغ الدفعة</div>
                        <div class="value">${formatCurrency(receipt.amount)}</div>
                        <div class="rows">
                            <div class="mini"><div class="k">المدفوع سابقاً</div><div class="v">${formatCurrency(prevPaid)}</div></div>
                            <div class="mini"><div class="k">المدفوع الآن</div><div class="v">${formatCurrency(receipt.amount)}</div></div>
                            <div class="mini"><div class="k">المتبقي بعد الدفعة</div><div class="v">${formatCurrency(remainingAfter)}</div></div>
                        </div>
                    </section>

                    ${receipt.notes ? `<section class="box" style="margin-top: 16px;"><h3>ملاحظات</h3><p style="font-size: 14px;">${receipt.notes}</p></section>` : ''}

                    <footer class="footer">
                        <p>شكراً لتعاونكم</p>
                        <p class="muted" style="font-size: 13px;">مصنع ديكورا - بنغازي</p>
                    </footer>
                </div>
            </body>
            </html>
        `);
        receiptWindow.document.close();
        setTimeout(() => receiptWindow.print(), 700);
    };

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="professional-card p-6">
                <h3 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3">
                    <Receipt className="text-blue-600" size={28} />
                    إصدار إيصال استلام نقدي
                </h3>
                <div className="space-y-5">
                    {/* Customer Search */}
                    <div className="relative">
                        <label className="block text-sm font-black text-slate-700 mb-2">ابحث عن العميل</label>
                        <div className="relative">
                            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                            <input
                                type="text"
                                value={customerSearch}
                                onChange={e => {
                                    setCustomerSearch(e.target.value);
                                    if (!e.target.value.trim()) {
                                        setSelectedCustomerId('');
                                        setReceiptForm({ ...receiptForm, invoiceId: '', amount: 0 });
                                    }
                                }}
                                placeholder="اكتب اسم العميل، رقم الهاتف، أو العنوان..."
                                className="input-professional !py-4 !pr-12 !text-base w-full"
                            />
                        </div>
                        
                        {/* Customer Search Results */}
                        {customerSearch.trim() && !selectedCustomerId && filteredCustomers.length > 0 && (
                            <div className="absolute z-50 w-full mt-2 bg-white rounded-2xl shadow-2xl border-2 border-slate-200 max-h-96 overflow-y-auto custom-scrollbar">
                                {filteredCustomers.map(customer => {
                                    const customerInvs = invoices.filter(inv => {
                                        if (inv.customerId !== customer.id) return false;
                                        const order = orders.find(o => o.id === inv.orderId);
                                        if (!order) return false;
                                        const paid = order.paidAmount || 0;
                                        return inv.totalAmount > paid;
                                    });
                                    return (
                                        <button
                                            key={customer.id}
                                            onClick={() => {
                                                setSelectedCustomerId(customer.id);
                                                setCustomerSearch(customer.name);
                                                setReceiptForm({ ...receiptForm, invoiceId: '', amount: 0 });
                                            }}
                                            className="w-full p-4 hover:bg-blue-50 transition-all text-right border-b border-slate-100 last:border-b-0 group"
                                        >
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3 mb-1">
                                                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center text-white font-black text-lg">
                                                            {customer.name.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <p className="font-black text-lg text-slate-900 group-hover:text-blue-600 transition-colors">
                                                                {customer.name}
                                                            </p>
                                                            <p className="text-xs text-slate-500 font-bold mt-0.5">
                                                                {customer.phone}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    {customer.address && (
                                                        <p className="text-xs text-slate-400 pr-13 mt-1">{customer.address}</p>
                                                    )}
                                                </div>
                                                <div className="flex flex-col items-end gap-1">
                                                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-black">
                                                        {customerInvs.length} فاتورة
                                                    </span>
                                                    {customerInvs.length > 0 && (
                                                        <span className="text-xs text-emerald-600 font-black">
                                                            متبقي
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                        
                        {customerSearch.trim() && !selectedCustomerId && filteredCustomers.length === 0 && (
                            <div className="absolute z-50 w-full mt-2 bg-white rounded-2xl shadow-xl border-2 border-slate-200 p-6 text-center">
                                <User className="mx-auto text-slate-300 mb-3" size={48} />
                                <p className="text-slate-400 font-bold">لا توجد نتائج للبحث</p>
                            </div>
                        )}
                    </div>

                    {/* Selected Customer Info */}
                    {selectedCustomer && (
                        <div className="p-5 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border-2 border-blue-200">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-lg">
                                    {selectedCustomer.name.charAt(0)}
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-black text-xl text-slate-900">{selectedCustomer.name}</h4>
                                    <p className="text-sm text-slate-600 font-bold mt-1">{selectedCustomer.phone}</p>
                                </div>
                                <button
                                    onClick={() => {
                                        setSelectedCustomerId('');
                                        setCustomerSearch('');
                                        setReceiptForm({ ...receiptForm, invoiceId: '', amount: 0 });
                                    }}
                                    className="p-2 hover:bg-white/50 rounded-lg transition-all"
                                >
                                    <X size={20} className="text-slate-500" />
                                </button>
                            </div>
                            {customerInvoices.length === 0 ? (
                                <div className="text-center py-4">
                                    <CheckCircle2 className="mx-auto text-emerald-500 mb-2" size={32} />
                                    <p className="text-sm font-bold text-slate-600">جميع فواتير هذا العميل مدفوعة بالكامل</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <p className="text-xs font-black text-slate-600 mb-3">اختر الفاتورة:</p>
                                    {customerInvoices.map(({ remaining, order, ...inv }) => {
                                        const prodName = order ? (productsConfig[order.productType]?.name || order.productType) : 'غير معروف';
                                        return (
                                            <button
                                                key={inv.id}
                                                onClick={() => setReceiptForm({ ...receiptForm, invoiceId: inv.id, amount: 0 })}
                                                className={`w-full p-4 rounded-xl border-2 transition-all text-right ${
                                                    receiptForm.invoiceId === inv.id
                                                        ? 'bg-blue-600 border-blue-600 text-white shadow-xl'
                                                        : 'bg-white border-slate-200 hover:border-blue-400 hover:shadow-lg'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between gap-4">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-3 mb-2">
                                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-black text-lg ${
                                                                receiptForm.invoiceId === inv.id
                                                                    ? 'bg-white/20 text-white'
                                                                    : 'bg-blue-100 text-blue-600'
                                                            }`}>
                                                                #{inv.invoiceNumber}
                                                            </div>
                                                            <div>
                                                                <p className={`font-black text-base ${
                                                                    receiptForm.invoiceId === inv.id ? 'text-white' : 'text-slate-900'
                                                                }`}>
                                                                    {prodName}
                                                                </p>
                                                                <p className={`text-xs mt-0.5 ${
                                                                    receiptForm.invoiceId === inv.id ? 'text-blue-100' : 'text-slate-500'
                                                                }`}>
                                                                    {new Date(inv.issueDate).toLocaleDateString('ar-LY')}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-left">
                                                        <p className={`text-xs font-bold mb-1 ${
                                                            receiptForm.invoiceId === inv.id ? 'text-blue-100' : 'text-slate-600'
                                                        }`}>
                                                            المتبقي
                                                        </p>
                                                        <p className={`text-xl font-black tabular-nums ${
                                                            receiptForm.invoiceId === inv.id ? 'text-white' : 'text-amber-600'
                                                        }`}>
                                                            {formatCurrency(remaining)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {selectedInvoice && selectedCustomer && (
                        <>
                            <div className="p-4 bg-slate-50 rounded-lg">
                                <p className="text-sm font-bold text-slate-600">العميل: {selectedCustomer.name}</p>
                                <p className="text-sm font-bold text-slate-600 mt-1">إجمالي الفاتورة: {formatCurrency(selectedInvoice.totalAmount)}</p>
                                <p className="text-sm font-bold text-slate-600 mt-1">المدفوع: {formatCurrency(selectedOrder?.paidAmount || 0)}</p>
                                <p className="text-lg font-black text-amber-600 mt-2">المتبقي: {formatCurrency(invoiceRemaining)}</p>
                            </div>

                            <div>
                                <label className="block text-sm font-black text-slate-700 mb-2">مبلغ الدفعة</label>
                                <input 
                                    type="number"
                                    value={receiptForm.amount || ''}
                                    onChange={e => setReceiptForm({...receiptForm, amount: parseFloat(e.target.value) || 0})}
                                    placeholder="أدخل المبلغ"
                                    min={0}
                                    max={invoiceRemaining || undefined}
                                    step="0.01"
                                    className="input-professional tabular-nums text-center"
                                />
                                <div className="flex gap-2 mt-2">
                                    <button
                                        type="button"
                                        onClick={() => setReceiptForm({...receiptForm, amount: invoiceRemaining})}
                                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl py-2 font-black text-xs transition-all"
                                    >
                                        المتبقي بالكامل
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setReceiptForm({...receiptForm, amount: 0})}
                                        className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl py-2 font-black text-xs transition-all"
                                    >
                                        تصفير
                                    </button>
                                </div>
                                {receiptForm.amount > invoiceRemaining && (
                                    <p className="text-xs font-black text-red-600 mt-2">المبلغ يتجاوز المتبقي على الفاتورة</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-black text-slate-700 mb-2">تاريخ الاستلام</label>
                                <input 
                                    type="date"
                                    value={new Date(receiptForm.paymentDate).toISOString().split('T')[0]}
                                    onChange={e => setReceiptForm({...receiptForm, paymentDate: new Date(e.target.value).getTime()})}
                                    className="input-professional"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-black text-slate-700 mb-2">ملاحظات (اختياري)</label>
                                <textarea
                                    value={receiptForm.notes || ''}
                                    onChange={e => setReceiptForm({...receiptForm, notes: e.target.value})}
                                    placeholder="أضف ملاحظات..."
                                    className="input-professional"
                                    rows={3}
                                />
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => handleCreateReceipt(false)}
                                    disabled={!isFormValid}
                                    className={`flex-1 py-4 rounded-xl font-black text-lg shadow-xl transition-all ${
                                        isFormValid
                                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                                            : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                                    }`}
                                >
                                    حفظ الإيصال
                                </button>
                                <button
                                    onClick={() => handleCreateReceipt(true)}
                                    disabled={!isFormValid}
                                    className={`px-6 py-4 rounded-xl font-black text-sm shadow-xl transition-all flex items-center gap-2 ${
                                        isFormValid
                                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                            : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                                    }`}
                                >
                                    <Printer size={18} />
                                    حفظ وطباعة
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {selectedInvoice && selectedCustomer && (
                <div className="professional-card p-6">
                    <h3 className="text-xl font-black text-slate-900 mb-4">ملخص الفاتورة</h3>
                    <div className="space-y-4">
                        <div className="p-4 bg-slate-50 rounded-lg">
                            <p className="text-sm font-bold text-slate-600">العميل</p>
                            <p className="font-black text-lg">{selectedCustomer.name}</p>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-lg">
                            <p className="text-sm font-bold text-slate-600">رقم الفاتورة</p>
                            <p className="font-black text-lg">#${selectedInvoice.invoiceNumber}</p>
                        </div>
                        <div className="p-4 bg-red-50 rounded-lg border-2 border-red-200">
                            <p className="text-sm font-bold text-slate-600">إجمالي الفاتورة</p>
                            <p className="font-black text-2xl text-red-600">{formatCurrency(selectedInvoice.totalAmount)}</p>
                        </div>
                        <div className="p-4 bg-emerald-50 rounded-lg border-2 border-emerald-200">
                            <p className="text-sm font-bold text-slate-600">المدفوع</p>
                            <p className="font-black text-2xl text-emerald-600">{formatCurrency(selectedOrder?.paidAmount || 0)}</p>
                        </div>
                        <div className="p-4 bg-amber-50 rounded-lg border-2 border-amber-200">
                            <p className="text-sm font-bold text-slate-600">المتبقي</p>
                            <p className="font-black text-2xl text-amber-600">{formatCurrency(invoiceRemaining)}</p>
                        </div>
                        {receiptForm.amount > 0 && (
                            <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                                <p className="text-sm font-bold text-slate-600">الدفعة الجديدة</p>
                                <p className="font-black text-2xl text-blue-600">{formatCurrency(receiptForm.amount)}</p>
                                <p className="text-xs text-slate-500 mt-2">المتبقي بعد الدفعة: {formatCurrency(invoiceRemaining - receiptForm.amount)}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
            </div>

            {/* Recent Receipts Table */}
            <div className="professional-card p-6">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                    <FileText className="text-blue-600" size={24} />
                    الإيصالات الصادرة مؤخراً
                </h3>
                <span className="px-4 py-2 bg-blue-100 text-blue-700 rounded-xl font-black text-sm">
                    {paymentReceipts.length} إيصال
                </span>
            </div>
            
            {paymentReceipts.length === 0 ? (
                <div className="text-center py-12">
                    <Receipt className="mx-auto text-slate-300 mb-4" size={64} />
                    <p className="text-slate-400 font-bold text-lg">لا توجد إيصالات صادرة بعد</p>
                    <p className="text-slate-300 text-sm mt-2">سيتم عرض الإيصالات هنا بعد إصدارها</p>
                </div>
            ) : (
                <div className="overflow-x-auto rounded-2xl border-2 border-slate-200">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-gradient-to-r from-slate-100 to-slate-50 border-b-2 border-slate-300">
                                <th className="p-4 text-right font-black text-slate-700">رقم الإيصال</th>
                                <th className="p-4 text-right font-black text-slate-700">العميل</th>
                                <th className="p-4 text-right font-black text-slate-700">رقم الفاتورة</th>
                                <th className="p-4 text-right font-black text-slate-700">المبلغ</th>
                                <th className="p-4 text-right font-black text-slate-700">تاريخ الاستلام</th>
                                <th className="p-4 text-center font-black text-slate-700">الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paymentReceipts.slice(0, 10).map((receipt) => {
                                const customer = customers.find(c => c.id === receipt.customerId);
                                const invoice = invoices.find(inv => inv.id === receipt.invoiceId);
                                const order = orders.find(o => o.id === invoice?.orderId);
                                const prodName = order ? (productsConfig[order.productType]?.name || order.productType) : 'غير معروف';
                                
                                return (
                                    <tr key={receipt.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-black">
                                                    #{receipt.receiptNumber}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 font-black text-sm">
                                                    {customer?.name.charAt(0) || '?'}
                                                </div>
                                                <div>
                                                    <p className="font-black text-slate-900">{customer?.name || 'غير معروف'}</p>
                                                    <p className="text-xs text-slate-500 font-bold">{customer?.phone || ''}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div>
                                                <p className="font-black text-slate-900">#{invoice?.invoiceNumber || 'غير معروف'}</p>
                                                <p className="text-xs text-slate-500 font-bold">{prodName}</p>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <p className="font-black text-emerald-600 text-lg tabular-nums">{formatCurrency(receipt.amount)}</p>
                                        </td>
                                        <td className="p-4">
                                            <p className="font-bold text-slate-700 tabular-nums">{new Date(receipt.paymentDate).toLocaleDateString('ar-LY')}</p>
                                            <p className="text-xs text-slate-400 font-bold">{new Date(receipt.paymentDate).toLocaleTimeString('ar-LY', { hour: '2-digit', minute: '2-digit' })}</p>
                                        </td>
                                        <td className="p-4">
                                            <button
                                                onClick={() => {
                                                    if (customer && invoice && order) {
                                                        printReceipt(receipt, customer, invoice, order);
                                                    } else {
                                                        addToast("لا يمكن طباعة الإيصال: بيانات غير مكتملة", 'error');
                                                    }
                                                }}
                                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-sm transition-all flex items-center gap-2 shadow-lg hover:shadow-xl"
                                            >
                                                <Printer size={16} />
                                                طباعة
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {paymentReceipts.length > 10 && (
                        <div className="p-4 bg-slate-50 border-t-2 border-slate-200 text-center">
                            <p className="text-sm font-bold text-slate-600">
                                عرض {Math.min(10, paymentReceipts.length)} من {paymentReceipts.length} إيصال
                            </p>
                        </div>
                    )}
                </div>
            )}
            </div>
        </div>
    );
};

// Receipts Archive View Component
interface ReceiptsArchiveViewProps {
    paymentReceipts: PaymentReceipt[];
    customers: Customer[];
    invoices: Invoice[];
    orders: Order[];
    productsConfig: Record<string, ProductConfig>;
    companyLogo: string | null;
}

const ReceiptsArchiveView: React.FC<ReceiptsArchiveViewProps> = ({ paymentReceipts, customers, invoices, orders, productsConfig, companyLogo }) => {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredReceipts = useMemo(() => {
        const lowerQuery = searchQuery.toLowerCase().trim();
        if (!lowerQuery) return paymentReceipts;
        return paymentReceipts.filter(receipt => {
            const customer = customers.find(c => c.id === receipt.customerId);
            const invoice = invoices.find(inv => inv.id === receipt.invoiceId);
            return (
                customer?.name.toLowerCase().includes(lowerQuery) ||
                receipt.receiptNumber.toString().includes(lowerQuery) ||
                invoice?.invoiceNumber.toString().includes(lowerQuery)
            );
        });
    }, [paymentReceipts, customers, invoices, searchQuery]);

    const printReceiptFromArchive = (receipt: PaymentReceipt) => {
        const customer = customers.find(c => c.id === receipt.customerId);
        const invoice = invoices.find(inv => inv.id === receipt.invoiceId);
        const order = orders.find(o => o.id === invoice?.orderId);
        if (!customer || !invoice || !order) return;

        const receiptWindow = window.open('', '_blank');
        if (!receiptWindow) return;

        const prodName = productsConfig[order.productType]?.name || order.productType;
        const prevPaid = (order.paidAmount || 0) - receipt.amount;
        const remainingAfter = Math.max(invoice.totalAmount - (order.paidAmount || 0), 0);

        receiptWindow.document.write(`
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>إيصال استلام نقدي #${receipt.receiptNumber}</title>
                <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;900&display=swap" rel="stylesheet">
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Tajawal', sans-serif; }
                    body { padding: 32px; background: #fff; color: #0f172a; }
                    .receipt { max-width: 820px; margin: 0 auto; }
                    .header { border-bottom: 4px solid #2563eb; padding-bottom: 20px; margin-bottom: 20px; }
                    .header-content { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
                    .logo { width: 72px; height: 72px; background: #2563eb; border-radius: 16px; display: flex; align-items: center; justify-content: center; color: white; font-size: 36px; font-weight: 900; }
                    h1 { font-size: 28px; font-weight: 900; }
                    .muted { color: #64748b; font-weight: 700; margin-top: 6px; }
                    .titleBox { border-right: 4px solid #2563eb; padding-right: 16px; text-align: left; }
                    .titleBox h2 { font-size: 40px; font-weight: 900; }
                    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 16px 0; }
                    .box { background: #f1f5f9; border: 2px solid #cbd5e1; border-radius: 14px; padding: 16px; }
                    .box h3 { font-size: 14px; font-weight: 900; color: #334155; margin-bottom: 10px; border-bottom: 2px solid #cbd5e1; padding-bottom: 8px; }
                    .box p { font-size: 16px; font-weight: 900; margin: 6px 0; overflow-wrap: break-word; word-break: break-word; }
                    .amount { background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); border: 4px solid #2563eb; border-radius: 16px; padding: 24px; margin: 16px 0; text-align: center; }
                    .amount .label { font-size: 18px; font-weight: 900; color: #1e40af; }
                    .amount .value { font-size: 56px; font-weight: 900; color: #1e3a8a; margin-top: 8px; }
                    .rows { margin-top: 12px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
                    .mini { background: rgba(255,255,255,0.7); border: 2px solid rgba(37,99,235,0.3); border-radius: 14px; padding: 12px; }
                    .mini .k { color: #0f172a; font-size: 12px; font-weight: 900; }
                    .mini .v { color: #1e40af; font-size: 18px; font-weight: 900; margin-top: 6px; }
                    .footer { border-top: 4px solid #0f172a; padding-top: 18px; margin-top: 18px; text-align: center; }
                    .footer p { font-weight: 900; margin: 6px 0; }
                    @media print { body { padding: 18px; } }
                </style>
            </head>
            <body>
                <div class="receipt">
                    <header class="header">
                        <div class="header-content">
                            <div style="display:flex; align-items:center; gap: 14px;">
                                ${companyLogo ? `<img src="${companyLogo}" alt="شعار الشركة" style="width: 72px; height: 72px; object-fit: contain; border-radius: 16px;" />` : `<div class="logo">D</div>`}
                                <div>
                                    <h1>مصنع ديكورا</h1>
                                    <div class="muted">للأثاث والمطابخ والديكور</div>
                                </div>
                            </div>
                            <div class="titleBox">
                                <h2>إيصال استلام نقدي</h2>
                                <div class="muted">رقم الإيصال: #${receipt.receiptNumber}</div>
                                <div class="muted">التاريخ: ${new Date(receipt.paymentDate).toLocaleDateString('ar-LY')}</div>
                            </div>
                        </div>
                    </header>

                    <section class="grid">
                        <div class="box">
                            <h3>استلمنا من</h3>
                            <p>${customer.name}</p>
                            <p class="muted" style="font-size: 13px;">${customer.address}</p>
                            <p class="muted" style="font-size: 13px;">${customer.phone}</p>
                        </div>
                        <div class="box">
                            <h3>معلومات الفاتورة</h3>
                            <p>فاتورة رقم: #${invoice.invoiceNumber}</p>
                            <p class="muted" style="font-size: 13px;">${prodName}</p>
                            <p class="muted" style="font-size: 13px;">إجمالي الفاتورة: ${formatCurrency(invoice.totalAmount)}</p>
                        </div>
                    </section>

                    <section class="amount">
                        <div class="label">مبلغ الدفعة</div>
                        <div class="value">${formatCurrency(receipt.amount)}</div>
                        <div class="rows">
                            <div class="mini"><div class="k">المدفوع سابقاً</div><div class="v">${formatCurrency(prevPaid)}</div></div>
                            <div class="mini"><div class="k">المدفوع الآن</div><div class="v">${formatCurrency(receipt.amount)}</div></div>
                            <div class="mini"><div class="k">المتبقي بعد الدفعة</div><div class="v">${formatCurrency(remainingAfter)}</div></div>
                        </div>
                    </section>

                    ${receipt.notes ? `<section class="box" style="margin-top: 16px;"><h3>ملاحظات</h3><p style="font-size: 14px;">${receipt.notes}</p></section>` : ''}

                    <footer class="footer">
                        <p>شكراً لتعاونكم</p>
                        <p class="muted" style="font-size: 13px;">مصنع ديكورا - بنغازي</p>
                    </footer>
                </div>
            </body>
            </html>
        `);
        receiptWindow.document.close();
        setTimeout(() => receiptWindow.print(), 700);
    };

    return (
        <div className="space-y-6">
            <div className="professional-card p-6">
                <h3 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3">
                    <ArchiveIcon className="text-indigo-600" size={28} />
                    أرشيف إيصالات الاستلام النقدي
                </h3>
                <div className="relative mb-6">
                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="ابحث برقم الإيصال، اسم العميل، أو رقم الفاتورة..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="input-professional !py-3 !pr-11 !text-sm w-full"
                    />
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                    <p className="text-sm font-bold text-slate-600">إجمالي الإيصالات: <span className="font-black text-lg text-slate-900">{paymentReceipts.length}</span></p>
                    <p className="text-sm font-bold text-slate-600 mt-1">إجمالي المبالغ: <span className="font-black text-lg text-emerald-600">{formatCurrency(paymentReceipts.reduce((sum, r) => sum + r.amount, 0))}</span></p>
                </div>
            </div>

            <div className="space-y-4">
                {filteredReceipts.length === 0 ? (
                    <div className="professional-card p-12 text-center">
                        <ArchiveIcon className="mx-auto text-slate-300 mb-4" size={64} />
                        <p className="text-slate-400 font-bold text-lg">لا توجد إيصالات {searchQuery ? 'مطابقة للبحث' : 'مسجلة'}</p>
                    </div>
                ) : (
                    filteredReceipts.map(receipt => {
                        const customer = customers.find(c => c.id === receipt.customerId);
                        const invoice = invoices.find(inv => inv.id === receipt.invoiceId);
                        const order = orders.find(o => o.id === invoice?.orderId);
                        const prodName = order ? (productsConfig[order.productType]?.name || order.productType) : 'غير معروف';

                        return (
                            <div key={receipt.id} className="professional-card p-6 hover:shadow-xl transition-all">
                                <div className="flex justify-between items-start gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center font-black text-lg">
                                                #{receipt.receiptNumber}
                                            </div>
                                            <div>
                                                <h4 className="font-black text-lg text-slate-900">{customer?.name || 'غير معروف'}</h4>
                                                <p className="text-sm text-slate-600 font-bold">فاتورة #${invoice?.invoiceNumber || '---'}</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 mt-4">
                                            <div>
                                                <p className="text-xs font-bold text-slate-600">المبلغ</p>
                                                <p className="font-black text-xl text-emerald-600 tabular-nums">{formatCurrency(receipt.amount)}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-slate-600">تاريخ الاستلام</p>
                                                <p className="font-black text-sm text-slate-900">{new Date(receipt.paymentDate).toLocaleDateString('ar-LY')}</p>
                                            </div>
                                        </div>
                                        {receipt.notes && (
                                            <div className="mt-3 p-3 bg-slate-50 rounded-lg">
                                                <p className="text-xs font-bold text-slate-600 mb-1">ملاحظات</p>
                                                <p className="text-sm text-slate-700">{receipt.notes}</p>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <button
                                            onClick={() => printReceiptFromArchive(receipt)}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-black text-xs hover:bg-blue-700 transition-all flex items-center gap-2"
                                        >
                                            <Printer size={16} />
                                            طباعة
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

interface AccountingViewProps {
    orders: Order[];
    customers: Customer[];
    invoices: Invoice[];
    setInvoices: (invoices: Invoice[]) => void;
    expenses: Expense[];
    setExpenses: (expenses: Expense[]) => void;
    setOrders: (orders: Order[]) => void;
    paymentReceipts: PaymentReceipt[];
    setPaymentReceipts: (receipts: PaymentReceipt[]) => void;
    addToast: (message: string, type?: Toast['type']) => void;
    openInvoice: (invoice: Invoice) => void;
    handlePrintFinancialReport: () => void;
    productsConfig: Record<string, ProductConfig>;
    companyLogo: string | null;
}

const AccountingView: React.FC<AccountingViewProps> = ({ orders, customers, invoices, setInvoices, expenses, setExpenses, setOrders, paymentReceipts, setPaymentReceipts, addToast, openInvoice, handlePrintFinancialReport, productsConfig, companyLogo }) => {
    
    const [activeAccountingTab, setActiveAccountingTab] = useState<'transactions' | 'edit-invoice' | 'cash-receipt' | 'receipts-archive' | 'statements'>('transactions');
    const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
    const [editInvoiceForm, setEditInvoiceForm] = useState<{items: {description: string, amount: number}[]}>({items: []});
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    
    // New simplified invoice form with multiple products support
    const [newInvoiceForm, setNewInvoiceForm] = useState<{
        customerId: string;
        customerSearch: string;
        selectedItems: Array<{
            id: string; // unique ID for each item
            productId: string;
            quantity: number;
            price: number;
        }>;
    }>({
        customerId: '',
        customerSearch: '',
        selectedItems: []
    });
    
    const [expenseForm, setExpenseForm] = useState<Partial<Expense>>({ description: '', amount: undefined, category: 'materials', date: Date.now() });

    const [paymentForm, setPaymentForm] = useState<{invoiceId: string, amount: number}>({invoiceId: '', amount: 0});
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCustomerForStatement, setSelectedCustomerForStatement] = useState<string>('');
    const [customerSearchForStatement, setCustomerSearchForStatement] = useState('');
    const [sortField, setSortField] = useState<'invoiceNumber' | 'issueDate' | 'totalAmount' | 'status' | 'customer'>('issueDate');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');
    const [activeTransactionsSubTab, setActiveTransactionsSubTab] = useState<'invoices' | 'expenses'>('invoices');

    const financials = useMemo(() => {
        const totalRevenue = orders.filter(o => o.status === 'delivered').reduce((sum, o) => sum + (o.price || 0), 0);
        const accountsReceivable = invoices.filter(inv => inv.status !== 'paid').reduce((sum, inv) => {
            const order = orders.find(o => o.id === inv.orderId);
            return sum + ((order?.price || 0) - (order?.paidAmount || 0));
        }, 0);
        const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
        const netProfit = totalRevenue - totalExpenses;
        return { totalRevenue, accountsReceivable, totalExpenses, netProfit };
    }, [orders, expenses, invoices]);



    const handleAddExpense = () => {
        if (!expenseForm.description || !expenseForm.amount || expenseForm.amount <= 0) {
            addToast("يرجى ملء جميع حقول المصروفات بشكل صحيح.", 'error');
            return;
        }
        const newExpense: Expense = {
            id: generateUniqueId(),
            description: expenseForm.description,
            amount: expenseForm.amount,
            category: expenseForm.category || 'other',
            date: expenseForm.date || Date.now()
        };
        setExpenses([newExpense, ...expenses].sort((a,b) => b.date - a.date));
        setExpenseForm({ description: '', amount: undefined, category: 'materials', date: Date.now() });
        addToast("تم تسجيل المصروف بنجاح.", 'success');
    };

    const handleDeleteExpense = (id: string) => {
      setExpenses(expenses.filter(e => e.id !== id));
      addToast("تم حذف المصروف.", 'success');
    };

    const handleRecordPayment = () => {
        if (paymentForm.amount <= 0 || !paymentForm.invoiceId) {
            addToast("حدث خطأ، يرجى تحديد قيمة الدفعة.", 'error');
            return;
        }
        
        const invoice = invoices.find(inv => inv.id === paymentForm.invoiceId);
        if (!invoice) return;

        let newStatus: InvoiceStatus = invoice.status;
        setOrders(orders.map(o => {
            if (o.id === invoice.orderId) {
                const newPaidAmount = (o.paidAmount || 0) + paymentForm.amount;
                if (newPaidAmount >= (o.price || 0)) {
                  newStatus = 'paid';
                }
                return { ...o, paidAmount: Math.min(newPaidAmount, o.price || newPaidAmount) };
            }
            return o;
        }));

        setInvoices(invoices.map(inv => inv.id === invoice.id ? {...inv, status: newStatus} : inv));
        setIsPaymentModalOpen(false);
        addToast("تم تسجيل الدفعة بنجاح.", 'success');
    };
    
    const invoiceForPayment = invoices.find(inv => inv.id === paymentForm.invoiceId);
    
    const filteredInvoices = useMemo(() => {
      let result = invoices;
      
      // Filter by search query
      const lowerCaseQuery = searchQuery.toLowerCase().trim();
      if (lowerCaseQuery) {
          result = result.filter(inv => {
              const customer = customers.find(c => c.id === inv.customerId);
              return (
                  customer?.name.toLowerCase().includes(lowerCaseQuery) ||
                  inv.invoiceNumber.toString().includes(lowerCaseQuery)
              );
          });
      }
      
      // Filter by status
      if (statusFilter !== 'all') {
          result = result.filter(inv => inv.status === statusFilter);
      }
      
      // Sort
      result = [...result].sort((a, b) => {
          let aValue: any;
          let bValue: any;
          
          switch (sortField) {
              case 'invoiceNumber':
                  aValue = a.invoiceNumber;
                  bValue = b.invoiceNumber;
                  break;
              case 'issueDate':
                  aValue = a.issueDate;
                  bValue = b.issueDate;
                  break;
              case 'totalAmount':
                  aValue = a.totalAmount;
                  bValue = b.totalAmount;
                  break;
              case 'status':
                  aValue = a.status;
                  bValue = b.status;
                  break;
              case 'customer':
                  const aCustomer = customers.find(c => c.id === a.customerId);
                  const bCustomer = customers.find(c => c.id === b.customerId);
                  aValue = aCustomer?.name || '';
                  bValue = bCustomer?.name || '';
                  break;
              default:
                  return 0;
          }
          
          if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
          if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
          return 0;
      });
      
      return result;
    }, [invoices, customers, searchQuery, statusFilter, sortField, sortDirection]);

    // Filter customers for statement search
    const filteredCustomersForStatement = useMemo(() => {
        if (!customerSearchForStatement.trim()) return [];
        const query = customerSearchForStatement.toLowerCase().trim();
        return customers.filter(c => 
            c.name.toLowerCase().includes(query) ||
            c.phone.includes(query) ||
            (c.address && c.address.toLowerCase().includes(query))
        ).slice(0, 8);
    }, [customers, customerSearchForStatement]);

    // Customer statements
    const customerStatements = useMemo(() => {
        if (!selectedCustomerForStatement) return null;
        const customerOrders = orders.filter(o => o.customerId === selectedCustomerForStatement);
        const customerInvoices = invoices.filter(inv => inv.customerId === selectedCustomerForStatement);
        // المستحقات: إجمالي الفواتير/الطلبات
        const totalDue = customerOrders.reduce((sum, o) => sum + (o.price || 0), 0);
        // المدفوع: إجمالي المبالغ المدفوعة
        const totalPaid = customerOrders.reduce((sum, o) => sum + (o.paidAmount || 0), 0);
        // المتبقي: المستحقات - المدفوع
        const remaining = totalDue - totalPaid;
        return { customerOrders, customerInvoices, totalDue, totalPaid, remaining };
    }, [orders, invoices, selectedCustomerForStatement]);


    return (
        <div className="space-y-8 tab-enter">
            <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                <div className="text-right">
                    <h2 className="text-4xl font-black text-slate-900 tracking-tighter">نظام المحاسبة الشامل</h2>
                    <p className="text-slate-400 font-bold mt-1">إدارة الفواتير، المدفوعات، المصروفات، والتقارير المالية</p>
                </div>
                <div className='flex items-center gap-3'>
                  <button 
                    onClick={handlePrintFinancialReport}
                    className="bg-slate-800 text-white px-6 py-3 rounded-xl font-black text-xs flex items-center gap-3 shadow-xl hover:bg-slate-900 transition-all active:scale-95">
                      <Printer size={20} /> تقرير مالي
                  </button>
                </div>
            </div>

            {/* Accounting Tabs */}
            <div className="professional-card p-2">
                <div className="flex gap-2 overflow-x-auto custom-scrollbar">
                    <button 
                        onClick={() => setActiveAccountingTab('transactions')}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm whitespace-nowrap transition-all ${
                            activeAccountingTab === 'transactions' 
                                ? 'bg-orange-600 text-white shadow-lg' 
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}>
                        <Receipt size={18} />
                        الفواتير والمصروفات
                    </button>
                    <button 
                        onClick={() => setActiveAccountingTab('edit-invoice')}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm whitespace-nowrap transition-all ${
                            activeAccountingTab === 'edit-invoice' 
                                ? 'bg-purple-600 text-white shadow-lg' 
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}>
                        <Pencil size={18} />
                        تحرير فاتورة
                    </button>
                    <button 
                        onClick={() => setActiveAccountingTab('cash-receipt')}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm whitespace-nowrap transition-all ${
                            activeAccountingTab === 'cash-receipt' 
                                ? 'bg-blue-600 text-white shadow-lg' 
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}>
                        <Receipt size={18} />
                        إيصال استلام نقدي
                    </button>
                    <button 
                        onClick={() => setActiveAccountingTab('receipts-archive')}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm whitespace-nowrap transition-all ${
                            activeAccountingTab === 'receipts-archive' 
                                ? 'bg-indigo-600 text-white shadow-lg' 
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}>
                        <ArchiveIcon size={18} />
                        أرشيف الإيصالات
                    </button>
                    <button 
                        onClick={() => setActiveAccountingTab('statements')}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm whitespace-nowrap transition-all ${
                            activeAccountingTab === 'statements' 
                                ? 'bg-violet-600 text-white shadow-lg' 
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}>
                        <FileSpreadsheet size={18} />
                        كشف الحساب
                    </button>
                </div>
            </div>

            {/* Transactions Tab */}
            {activeAccountingTab === 'transactions' && (
                <div className="space-y-8">
                    {/* Financial Overview - Top Section */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="professional-card p-6 bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-200">
                            <div className="flex items-center justify-between mb-3">
                                <TrendingUp className="text-emerald-600" size={24} />
                                <span className="text-xs font-black text-emerald-700 uppercase">إجمالي الإيرادات</span>
                            </div>
                            <p className="text-3xl font-black text-emerald-700 tabular-nums">{formatCurrency(financials.totalRevenue)}</p>
                        </div>
                        <div className="professional-card p-6 bg-gradient-to-br from-amber-50 to-amber-100 border-2 border-amber-200">
                            <div className="flex items-center justify-between mb-3">
                                <CircleDollarSign className="text-amber-600" size={24} />
                                <span className="text-xs font-black text-amber-700 uppercase">ديون مستحقة</span>
                            </div>
                            <p className="text-3xl font-black text-amber-700 tabular-nums">{formatCurrency(financials.accountsReceivable)}</p>
                        </div>
                        <div className="professional-card p-6 bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-200">
                            <div className="flex items-center justify-between mb-3">
                                <MinusCircle className="text-red-600" size={24} />
                                <span className="text-xs font-black text-red-700 uppercase">إجمالي المصروفات</span>
                            </div>
                            <p className="text-3xl font-black text-red-700 tabular-nums">{formatCurrency(financials.totalExpenses)}</p>
                        </div>
                        <div className="professional-card p-6 bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200">
                            <div className="flex items-center justify-between mb-3">
                                <BarChart3 className="text-blue-600" size={24} />
                                <span className="text-xs font-black text-blue-700 uppercase">صافي الربح</span>
                            </div>
                            <p className="text-3xl font-black text-blue-700 tabular-nums">{formatCurrency(financials.netProfit)}</p>
                        </div>
                    </div>

                    {/* Sub Tabs */}
                    <div className="professional-card p-2">
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setActiveTransactionsSubTab('invoices')}
                                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm transition-all ${
                                    activeTransactionsSubTab === 'invoices' 
                                        ? 'bg-orange-600 text-white shadow-lg' 
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}>
                                <FileText size={18} />
                                الفواتير
                            </button>
                            <button 
                                onClick={() => setActiveTransactionsSubTab('expenses')}
                                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm transition-all ${
                                    activeTransactionsSubTab === 'expenses' 
                                        ? 'bg-red-600 text-white shadow-lg' 
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}>
                                <MinusCircle size={18} />
                                المصروفات
                            </button>
                        </div>
                    </div>

                    {/* Invoices Sub Tab */}
                    {activeTransactionsSubTab === 'invoices' && (
                        <div className="space-y-8">
                            {/* NEW INVOICE ISSUANCE SECTION */}
                            <div className="professional-card p-8 border-2 border-blue-200 bg-gradient-to-br from-blue-50/30 to-white">
                                <div className="flex items-center justify-between mb-6 pb-4 border-b-2 border-blue-200">
                                    <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                                        <FileText className="text-blue-600" size={28} />
                                        إصدار فاتورة جديدة
                                    </h2>
                                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                                </div>
                                <div className="space-y-6">
                            {/* Step 1: Select Customer */}
                            <div>
                                <label className="block text-sm font-black text-slate-700 mb-3">1. اختر العميل</label>
                                <div className="relative">
                                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input 
                                        type="text" 
                                        placeholder="ابحث عن العميل..." 
                                        value={newInvoiceForm.customerSearch} 
                                        onChange={e => setNewInvoiceForm({...newInvoiceForm, customerSearch: e.target.value, customerId: ''})}
                                        className="input-professional !py-3 !pr-11 !text-base w-full"
                                    />
                                </div>
                                {newInvoiceForm.customerSearch && (
                                    <div className="mt-3 space-y-2 max-h-48 overflow-y-auto custom-scrollbar border-2 border-slate-200 rounded-xl p-3">
                                        {customers.filter(c => 
                                            c.name.toLowerCase().includes(newInvoiceForm.customerSearch.toLowerCase()) ||
                                            c.phone.includes(newInvoiceForm.customerSearch)
                                        ).map(customer => (
                                            <button
                                                key={customer.id}
                                                onClick={() => setNewInvoiceForm({...newInvoiceForm, customerId: customer.id, customerSearch: customer.name})}
                                                className={`w-full text-right p-4 rounded-lg border-2 transition-all ${
                                                    newInvoiceForm.customerId === customer.id 
                                                        ? 'border-blue-500 bg-blue-50' 
                                                        : 'border-slate-200 bg-white hover:border-blue-300'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="font-black text-lg text-slate-900">{customer.name}</p>
                                                        <p className="text-sm text-slate-600 font-bold">{customer.phone}</p>
                                                    </div>
                                                    {newInvoiceForm.customerId === customer.id && (
                                                        <CheckCircle2 className="text-blue-600" size={24} />
                                                    )}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Step 2: Add Products */}
                            {newInvoiceForm.customerId && (
                                <div>
                                    <label className="block text-sm font-black text-slate-700 mb-3">2. أضف المنتجات</label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                                        {Object.values(productsConfig).map(product => {
                                            const Icon = getIcon(product.iconKey);
                                            // Color mapping for Tailwind CSS classes
                                            const colorClasses: Record<string, { border: string; bg: string; bgLight: string; text: string; iconBg: string }> = {
                                                orange: { border: 'border-orange-500', bg: 'bg-orange-50', bgLight: 'bg-orange-100', text: 'text-orange-600', iconBg: 'bg-orange-100' },
                                                amber: { border: 'border-amber-500', bg: 'bg-amber-50', bgLight: 'bg-amber-100', text: 'text-amber-600', iconBg: 'bg-amber-100' },
                                                rose: { border: 'border-rose-500', bg: 'bg-rose-50', bgLight: 'bg-rose-100', text: 'text-rose-600', iconBg: 'bg-rose-100' },
                                                stone: { border: 'border-stone-500', bg: 'bg-stone-50', bgLight: 'bg-stone-100', text: 'text-stone-600', iconBg: 'bg-stone-100' },
                                                yellow: { border: 'border-yellow-500', bg: 'bg-yellow-50', bgLight: 'bg-yellow-100', text: 'text-yellow-600', iconBg: 'bg-yellow-100' },
                                                emerald: { border: 'border-emerald-500', bg: 'bg-emerald-50', bgLight: 'bg-emerald-100', text: 'text-emerald-600', iconBg: 'bg-emerald-100' },
                                            };
                                            const colors = colorClasses[product.color] || colorClasses.orange;
                                            
                                            return (
                                                <button
                                                    key={product.id}
                                                    onClick={() => {
                                                        // إضافة منتج جديد للقائمة
                                                        const newItem = {
                                                            id: generateUniqueId(),
                                                            productId: product.id,
                                                            quantity: 1,
                                                            price: 0
                                                        };
                                                        setNewInvoiceForm({
                                                            ...newInvoiceForm,
                                                            selectedItems: [...newInvoiceForm.selectedItems, newItem]
                                                        });
                                                    }}
                                                    className="p-4 rounded-xl border-2 border-slate-200 bg-white hover:border-slate-300 transition-all text-right"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colors.iconBg} ${colors.text}`}>
                                                                <Icon size={24} />
                                                            </div>
                                                            <div>
                                                                <p className="font-black text-lg text-slate-900">{product.name}</p>
                                                                <p className="text-xs text-slate-500 font-bold">أيام الإنتاج: {product.productionDays}</p>
                                                            </div>
                                                        </div>
                                                        <Plus className="text-slate-400" size={24} />
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Selected Items List */}
                                    {newInvoiceForm.selectedItems.length > 0 && (
                                        <div className="space-y-3 mt-4">
                                            <label className="block text-sm font-black text-slate-700">المنتجات المضافة:</label>
                                            {newInvoiceForm.selectedItems.map((item, index) => {
                                                const product = productsConfig[item.productId];
                                                if (!product) return null;
                                                const Icon = getIcon(product.iconKey);
                                                const colorClasses: Record<string, { border: string; bg: string; bgLight: string; text: string; iconBg: string }> = {
                                                    orange: { border: 'border-orange-500', bg: 'bg-orange-50', bgLight: 'bg-orange-100', text: 'text-orange-600', iconBg: 'bg-orange-100' },
                                                    amber: { border: 'border-amber-500', bg: 'bg-amber-50', bgLight: 'bg-amber-100', text: 'text-amber-600', iconBg: 'bg-amber-100' },
                                                    rose: { border: 'border-rose-500', bg: 'bg-rose-50', bgLight: 'bg-rose-100', text: 'text-rose-600', iconBg: 'bg-rose-100' },
                                                    stone: { border: 'border-stone-500', bg: 'bg-stone-50', bgLight: 'bg-stone-100', text: 'text-stone-600', iconBg: 'bg-stone-100' },
                                                    yellow: { border: 'border-yellow-500', bg: 'bg-yellow-50', bgLight: 'bg-yellow-100', text: 'text-yellow-600', iconBg: 'bg-yellow-100' },
                                                    emerald: { border: 'border-emerald-500', bg: 'bg-emerald-50', bgLight: 'bg-emerald-100', text: 'text-emerald-600', iconBg: 'bg-emerald-100' },
                                                };
                                                const colors = colorClasses[product.color] || colorClasses.orange;
                                                const itemTotal = item.quantity * item.price;
                                                
                                                return (
                                                    <div key={item.id} className="bg-slate-50 p-4 rounded-xl border-2 border-slate-200">
                                                        <div className="flex items-center justify-between mb-3">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors.iconBg} ${colors.text}`}>
                                                                    <Icon size={20} />
                                                                </div>
                                                                <div>
                                                                    <p className="font-black text-lg text-slate-900">{product.name}</p>
                                                                    {item.quantity > 1 && (
                                                                        <p className="text-xs text-slate-500 font-bold">الكمية: {item.quantity}</p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={() => {
                                                                    setNewInvoiceForm({
                                                                        ...newInvoiceForm,
                                                                        selectedItems: newInvoiceForm.selectedItems.filter(i => i.id !== item.id)
                                                                    });
                                                                }}
                                                                className="text-red-500 hover:text-red-700 transition-colors"
                                                            >
                                                                <X size={20} />
                                                            </button>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div>
                                                                <label className="block text-xs font-bold text-slate-600 mb-1">الكمية</label>
                                                                <div className="flex items-center gap-2">
                                                                    <button
                                                                        onClick={() => {
                                                                            if (item.quantity > 1) {
                                                                                const updated = newInvoiceForm.selectedItems.map(i => 
                                                                                    i.id === item.id ? {...i, quantity: i.quantity - 1} : i
                                                                                );
                                                                                setNewInvoiceForm({...newInvoiceForm, selectedItems: updated});
                                                                            }
                                                                        }}
                                                                        className="w-8 h-8 rounded-lg bg-slate-200 hover:bg-slate-300 flex items-center justify-center font-black text-slate-700"
                                                                    >
                                                                        -
                                                                    </button>
                                                                    <input
                                                                        type="number"
                                                                        min="1"
                                                                        value={item.quantity}
                                                                        onChange={e => {
                                                                            const qty = Math.max(1, parseInt(e.target.value) || 1);
                                                                            const updated = newInvoiceForm.selectedItems.map(i => 
                                                                                i.id === item.id ? {...i, quantity: qty} : i
                                                                            );
                                                                            setNewInvoiceForm({...newInvoiceForm, selectedItems: updated});
                                                                        }}
                                                                        className="input-professional !py-2 text-center !w-20"
                                                                    />
                                                                    <button
                                                                        onClick={() => {
                                                                            const updated = newInvoiceForm.selectedItems.map(i => 
                                                                                i.id === item.id ? {...i, quantity: i.quantity + 1} : i
                                                                            );
                                                                            setNewInvoiceForm({...newInvoiceForm, selectedItems: updated});
                                                                        }}
                                                                        className="w-8 h-8 rounded-lg bg-slate-200 hover:bg-slate-300 flex items-center justify-center font-black text-slate-700"
                                                                    >
                                                                        +
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs font-bold text-slate-600 mb-1">السعر</label>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    value={item.price || ''}
                                                                    onChange={e => {
                                                                        const price = parseFloat(e.target.value) || 0;
                                                                        const updated = newInvoiceForm.selectedItems.map(i => 
                                                                            i.id === item.id ? {...i, price: price} : i
                                                                        );
                                                                        setNewInvoiceForm({...newInvoiceForm, selectedItems: updated});
                                                                    }}
                                                                    placeholder="السعر"
                                                                    className="input-professional !py-2 text-center"
                                                                />
                                                            </div>
                                                        </div>
                                                        {item.price > 0 && (
                                                            <div className="mt-3 pt-3 border-t border-slate-200 flex justify-between items-center">
                                                                <span className="text-sm font-bold text-slate-600">إجمالي هذا المنتج:</span>
                                                                <span className="font-black text-lg text-blue-600 tabular-nums">{formatCurrency(itemTotal)}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Summary */}
                            {newInvoiceForm.customerId && newInvoiceForm.selectedItems.length > 0 && (
                                (() => {
                                    const totalAmount = newInvoiceForm.selectedItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
                                    const allPricesSet = newInvoiceForm.selectedItems.every(item => item.price > 0);
                                    
                                    if (allPricesSet) {
                                        return (
                                            <div className="bg-gradient-to-r from-blue-50 to-emerald-50 p-6 rounded-xl border-2 border-blue-200">
                                                <div className="flex justify-between items-center mb-4">
                                                    <span className="font-black text-xl text-slate-900">الإجمالي:</span>
                                                    <span className="font-black text-4xl text-blue-600 tabular-nums">{formatCurrency(totalAmount)}</span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4 text-sm">
                                                    <div>
                                                        <p className="text-slate-600 font-bold mb-1">العميل:</p>
                                                        <p className="font-black text-slate-900">{customers.find(c => c.id === newInvoiceForm.customerId)?.name}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-slate-600 font-bold mb-1">عدد المنتجات:</p>
                                                        <p className="font-black text-slate-900">{newInvoiceForm.selectedItems.length}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                })()
                            )}

                            {/* Action Buttons */}
                            {newInvoiceForm.customerId && newInvoiceForm.selectedItems.length > 0 && (() => {
                                const totalAmount = newInvoiceForm.selectedItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
                                const allPricesSet = newInvoiceForm.selectedItems.every(item => item.price > 0);
                                
                                if (allPricesSet) {
                                    return (
                                        <div className="flex gap-4">
                                            <button
                                                onClick={() => {
                                                    setNewInvoiceForm({customerId: '', customerSearch: '', selectedItems: []});
                                                }}
                                                className="flex-1 bg-slate-200 text-slate-800 py-4 rounded-xl font-black text-lg hover:bg-slate-300 transition-all"
                                            >
                                                إلغاء
                                            </button>
                                            <button
                                                onClick={() => {
                                                    const customer = customers.find(c => c.id === newInvoiceForm.customerId);
                                                    if (!customer) return;

                                                    // إنشاء بنود الفاتورة
                                                    const invoiceItems = newInvoiceForm.selectedItems.map(item => {
                                                        const product = productsConfig[item.productId];
                                                        const description = item.quantity > 1 
                                                            ? `${product.name} (x${item.quantity})`
                                                            : product.name;
                                                        return {
                                                            description,
                                                            amount: item.quantity * item.price
                                                        };
                                                    });

                                                    // إنشاء سلسلة المنتجات للطلب
                                                    const productTypes = newInvoiceForm.selectedItems.map(item => {
                                                        const product = productsConfig[item.productId];
                                                        return item.quantity > 1 
                                                            ? `${product.name} (x${item.quantity})`
                                                            : product.name;
                                                    }).join(', ');

                                                    // حساب أطول مدة إنتاج
                                                    const maxProductionDays = Math.max(...newInvoiceForm.selectedItems.map(item => 
                                                        productsConfig[item.productId]?.productionDays || 0
                                                    ));

                                                    // إنشاء طلب جديد تلقائياً
                                                    const newOrder: Order = {
                                                        id: generateUniqueId(),
                                                        customerId: newInvoiceForm.customerId,
                                                        productType: productTypes,
                                                        orderDate: Date.now(),
                                                        deliveryDate: Date.now() + (maxProductionDays * 24 * 60 * 60 * 1000),
                                                        status: 'manufacturing',
                                                        totalProductionDays: maxProductionDays,
                                                        price: totalAmount,
                                                        paidAmount: 0
                                                    };

                                                    // إنشاء الفاتورة
                                                    const lastInvoiceNum = invoices.reduce((max, inv) => Math.max(max, inv.invoiceNumber), 0);
                                                    const newInvoice: Invoice = {
                                                        id: generateUniqueId(),
                                                        invoiceNumber: lastInvoiceNum + 1,
                                                        orderId: newOrder.id,
                                                        customerId: newInvoiceForm.customerId,
                                                        issueDate: Date.now(),
                                                        dueDate: Date.now() + 14 * 24 * 60 * 60 * 1000,
                                                        totalAmount: totalAmount,
                                                        status: 'due',
                                                        items: invoiceItems
                                                    };

                                                    // حفظ الطلب والفاتورة
                                                    setOrders([newOrder, ...orders]);
                                                    setInvoices([newInvoice, ...invoices].sort((a,b) => b.issueDate - a.issueDate));
                                                    
                                                    addToast(`تم إصدار الفاتورة رقم ${newInvoice.invoiceNumber}`, 'success');
                                                    
                                                    // فتح الفاتورة للطباعة
                                                    setTimeout(() => {
                                                        openInvoice(newInvoice);
                                                    }, 500);
                                                    
                                                    // إعادة تعيين النموذج
                                                    setNewInvoiceForm({customerId: '', customerSearch: '', selectedItems: []});
                                                }}
                                                className="flex-1 bg-blue-600 text-white py-4 rounded-xl font-black text-lg shadow-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                                            >
                                                <Printer size={20} />
                                                إصدار وطباعة الفاتورة
                                            </button>
                                        </div>
                                    );
                                }
                                return null;
                            })()}
                                </div>
                            </div>
                            {/* END NEW INVOICE ISSUANCE SECTION */}

                            {/* الفواتير الصادرة */}
                            <div className="space-y-4">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                              <div className="flex items-center gap-4">
                                <h3 className="text-2xl font-black flex items-center gap-3 text-slate-900">
                                    <Receipt className="text-orange-600" size={24} />
                                    الفواتير الصادرة
                                </h3>
                                <span className="px-4 py-2 bg-orange-100 text-orange-700 rounded-xl font-black text-sm">
                                    {filteredInvoices.length} فاتورة
                                </span>
                              </div>
                          <div className="flex items-center gap-3 w-full md:w-auto">
                            <select 
                                value={statusFilter} 
                                onChange={e => setStatusFilter(e.target.value as InvoiceStatus | 'all')}
                                className="input-professional !py-3 !text-sm flex-shrink-0"
                            >
                                <option value="all">جميع الحالات</option>
                                <option value="due">مستحقة</option>
                                <option value="paid">مدفوعة</option>
                                <option value="overdue">متأخرة</option>
                            </select>
                            <div className="relative flex-1 md:max-w-sm group">
                                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input type="text" placeholder="بحث بالعميل أو رقم الفاتورة..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="input-professional !py-3 !pr-11 !text-sm" />
                            </div>
                          </div>
                        </div>
                        
                        {filteredInvoices.length === 0 ? (
                            <div className="text-center py-20 professional-card">
                                <FileText className="mx-auto text-slate-300 mb-4" size={64} />
                                <p className="text-slate-400 font-bold text-lg">لا توجد فواتير مطابقة للبحث</p>
                            </div>
                        ) : (
                            <div className="professional-card p-0 overflow-hidden">
                                <div className="overflow-x-auto rounded-2xl">
                                    <table className="w-full border-collapse">
                                        <thead className="sticky top-0 z-10 bg-gradient-to-r from-slate-100 to-slate-50">
                                            <tr className="border-b-2 border-slate-300">
                                                <th className="p-4 text-right font-black text-slate-700">
                                                    <button 
                                                        onClick={() => {
                                                            if (sortField === 'invoiceNumber') {
                                                                setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                                                            } else {
                                                                setSortField('invoiceNumber');
                                                                setSortDirection('desc');
                                                            }
                                                        }}
                                                        className="flex items-center gap-2 hover:text-blue-600 transition-colors"
                                                    >
                                                        رقم الفاتورة
                                                        {sortField === 'invoiceNumber' && (
                                                            sortDirection === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />
                                                        )}
                                                    </button>
                                                </th>
                                                <th className="p-4 text-right font-black text-slate-700">
                                                    <button 
                                                        onClick={() => {
                                                            if (sortField === 'customer') {
                                                                setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                                                            } else {
                                                                setSortField('customer');
                                                                setSortDirection('asc');
                                                            }
                                                        }}
                                                        className="flex items-center gap-2 hover:text-blue-600 transition-colors"
                                                    >
                                                        العميل
                                                        {sortField === 'customer' && (
                                                            sortDirection === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />
                                                        )}
                                                    </button>
                                                </th>
                                                <th className="p-4 text-right font-black text-slate-700">المنتج</th>
                                                <th className="p-4 text-right font-black text-slate-700">
                                                    <button 
                                                        onClick={() => {
                                                            if (sortField === 'issueDate') {
                                                                setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                                                            } else {
                                                                setSortField('issueDate');
                                                                setSortDirection('desc');
                                                            }
                                                        }}
                                                        className="flex items-center gap-2 hover:text-blue-600 transition-colors"
                                                    >
                                                        تاريخ الإصدار
                                                        {sortField === 'issueDate' && (
                                                            sortDirection === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />
                                                        )}
                                                    </button>
                                                </th>
                                                <th className="p-4 text-left font-black text-slate-700">
                                                    <button 
                                                        onClick={() => {
                                                            if (sortField === 'status') {
                                                                setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                                                            } else {
                                                                setSortField('status');
                                                                setSortDirection('asc');
                                                            }
                                                        }}
                                                        className="flex items-center gap-2 hover:text-blue-600 transition-colors"
                                                    >
                                                        الحالة
                                                        {sortField === 'status' && (
                                                            sortDirection === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />
                                                        )}
                                                    </button>
                                                </th>
                                                <th className="p-4 text-left font-black text-slate-700">
                                                    <button 
                                                        onClick={() => {
                                                            if (sortField === 'totalAmount') {
                                                                setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                                                            } else {
                                                                setSortField('totalAmount');
                                                                setSortDirection('desc');
                                                            }
                                                        }}
                                                        className="flex items-center gap-2 hover:text-blue-600 transition-colors"
                                                    >
                                                        الإجمالي
                                                        {sortField === 'totalAmount' && (
                                                            sortDirection === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />
                                                        )}
                                                    </button>
                                                </th>
                                                <th className="p-4 text-left font-black text-slate-700">المدفوع</th>
                                                <th className="p-4 text-left font-black text-slate-700">المتبقي</th>
                                                <th className="p-4 text-center font-black text-slate-700">الإجراءات</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredInvoices.map(inv => {
                                                const customer = customers.find(c => c.id === inv.customerId);
                                                const order = orders.find(o => o.id === inv.orderId);
                                                if (!customer || !order) return null;

                                                const statusInfo = INVOICE_STATUS_MAP[inv.status];
                                                const remainingBalance = (order.price || 0) - (order.paidAmount || 0);
                                                const progress = order.price ? ((order.paidAmount || 0) / order.price) * 100 : 0;

                                                return (
                                                    <tr key={inv.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                                                        <td className="p-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg flex-shrink-0 ${
                                                                    statusInfo.bg + ' ' + statusInfo.color
                                                                }`}>
                                                                    #{inv.invoiceNumber}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="p-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 font-black text-sm">
                                                                    {customer.name.charAt(0)}
                                                                </div>
                                                                <div>
                                                                    <p className="font-black text-slate-900">{customer.name}</p>
                                                                    <p className="text-xs text-slate-500 font-bold">{customer.phone}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="p-4">
                                                            <p className="font-bold text-slate-800 text-sm">{order.productType}</p>
                                                        </td>
                                                        <td className="p-4">
                                                            <div className="flex items-center gap-2">
                                                                <Calendar className="text-slate-400" size={14} />
                                                                <p className="font-bold text-slate-700 text-sm tabular-nums">{new Date(inv.issueDate).toLocaleDateString('ar-LY')}</p>
                                                            </div>
                                                        </td>
                                                        <td className="p-4">
                                                            <span className={`px-3 py-1.5 rounded-lg text-xs font-black inline-block ${statusInfo.bg} ${statusInfo.color}`}>
                                                                {statusInfo.label}
                                                            </span>
                                                        </td>
                                                        <td className="p-4">
                                                            <p className="font-black text-orange-600 text-lg tabular-nums">{formatCurrency(inv.totalAmount)}</p>
                                                        </td>
                                                        <td className="p-4">
                                                            <p className="font-black text-emerald-600 text-lg tabular-nums">{formatCurrency(order.paidAmount || 0)}</p>
                                                        </td>
                                                        <td className="p-4">
                                                            <div>
                                                                <p className="font-black text-red-600 text-lg tabular-nums mb-1">{formatCurrency(remainingBalance)}</p>
                                                                <div className="w-full bg-slate-100 rounded-full h-1.5">
                                                                    <div className={`h-1.5 rounded-full ${statusInfo.bg.replace('bg-', 'bg-')}`} style={{ width: `${progress}%`}}></div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="p-4">
                                                            <div className="flex items-center gap-2 justify-center">
                                                                <button 
                                                                    onClick={() => openInvoice(inv)} 
                                                                    className="px-4 py-2 bg-slate-800 text-white rounded-lg font-black text-xs flex items-center gap-2 hover:bg-slate-900 transition-all shadow-lg active:scale-95"
                                                                    title="عرض الفاتورة"
                                                                >
                                                                    <FileText size={14} />
                                                                    عرض
                                                                </button>
                                                                {inv.status !== 'paid' && (
                                                                    <button 
                                                                        onClick={() => {setPaymentForm({invoiceId: inv.id, amount: 0}); setIsPaymentModalOpen(true);}} 
                                                                        className="px-4 py-2 bg-emerald-500 text-white rounded-lg font-black text-xs flex items-center gap-2 hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                                                                        title="تسجيل دفعة"
                                                                    >
                                                                        <CircleDollarSign size={14} />
                                                                        دفعة
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                        </div>
                        </div>
                    )}

                    {/* Expenses Sub Tab */}
                    {activeTransactionsSubTab === 'expenses' && (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                            {/* Left Column: Add Expense Form */}
                            <div className="lg:col-span-5">
                                <div className="professional-card p-8 border-2 border-red-200 bg-gradient-to-br from-red-50/30 to-white">
                                    <div className="flex items-center justify-between mb-6 pb-4 border-b-2 border-red-200">
                                        <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                                            <MinusCircle className="text-red-600" size={28} />
                                            إضافة مصروف جديد
                                        </h2>
                                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                                    </div>
                                    <div className="space-y-5">
                                        <div>
                                            <label className="block text-sm font-black text-slate-700 mb-2">وصف المصروف</label>
                                            <input 
                                                value={expenseForm.description} 
                                                onChange={e => setExpenseForm({...expenseForm, description: e.target.value})} 
                                                placeholder="مثال: شراء مواد خام" 
                                                required 
                                                className="input-professional" 
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-black text-slate-700 mb-2">المبلغ</label>
                                                <input 
                                                    type="number" 
                                                    value={expenseForm.amount || ''} 
                                                    onChange={e => setExpenseForm({...expenseForm, amount: parseFloat(e.target.value) || undefined})} 
                                                    placeholder="0.00" 
                                                    required 
                                                    className="input-professional tabular-nums" 
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-black text-slate-700 mb-2">التاريخ</label>
                                                <input 
                                                    type="date" 
                                                    value={new Date(expenseForm.date || Date.now()).toISOString().split('T')[0]} 
                                                    onChange={e => setExpenseForm({...expenseForm, date: new Date(e.target.value).getTime()})} 
                                                    className="input-professional" 
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-black text-slate-700 mb-2">الفئة</label>
                                            <select 
                                                value={expenseForm.category} 
                                                onChange={e => setExpenseForm({...expenseForm, category: e.target.value as ExpenseCategory})} 
                                                className="input-professional"
                                            >
                                                {Object.entries(EXPENSE_CATEGORY_MAP).map(([key, value]) => (
                                                    <option key={key} value={key}>{value.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <button 
                                            onClick={handleAddExpense} 
                                            className="w-full bg-red-600 text-white py-4 rounded-xl font-black text-lg shadow-xl hover:bg-red-700 transition-all flex items-center justify-center gap-2"
                                        >
                                            <MinusCircle size={20} />
                                            حفظ المصروف
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Expense Log List */}
                            <div className="lg:col-span-7">
                                <div className="professional-card p-6">
                                    <div className="flex items-center justify-between mb-6 pb-4 border-b-2 border-slate-200">
                                        <h3 className="text-xl font-black flex items-center gap-3 text-slate-900">
                                            <Receipt className="text-red-600" size={24} />
                                            سجل المصروفات
                                        </h3>
                                        <span className="px-4 py-2 bg-red-100 text-red-700 rounded-xl font-black text-sm">
                                            {expenses.length} مصروف
                                        </span>
                                    </div>
                                    <div className="space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
                                        {expenses.length === 0 ? (
                                            <div className="text-center py-16">
                                                <MinusCircle className="mx-auto text-slate-300 mb-4" size={64} />
                                                <p className="text-slate-400 font-bold text-lg">لا توجد مصروفات مسجلة</p>
                                                <p className="text-slate-300 text-sm mt-2">قم بإضافة مصروف جديد من النموذج</p>
                                            </div>
                                        ) : (
                                            expenses.map(exp => {
                                                const categoryInfo = EXPENSE_CATEGORY_MAP[exp.category];
                                                const Icon = categoryInfo.icon;
                                                const colorMap: Record<string, { bg: string; text: string }> = {
                                                    stone: { bg: 'bg-stone-100', text: 'text-stone-600' },
                                                    orange: { bg: 'bg-orange-100', text: 'text-orange-600' },
                                                    blue: { bg: 'bg-blue-100', text: 'text-blue-600' },
                                                    red: { bg: 'bg-red-100', text: 'text-red-600' },
                                                    emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600' },
                                                    amber: { bg: 'bg-amber-100', text: 'text-amber-600' },
                                                    sky: { bg: 'bg-sky-100', text: 'text-sky-600' },
                                                    violet: { bg: 'bg-violet-100', text: 'text-violet-600' },
                                                    rose: { bg: 'bg-rose-100', text: 'text-rose-600' },
                                                    slate: { bg: 'bg-slate-100', text: 'text-slate-600' }
                                                };
                                                const colors = colorMap[categoryInfo.color] || colorMap.stone;
                                                return (
                                                    <div key={exp.id} className="flex items-center gap-4 group p-4 rounded-xl border-2 border-slate-100 hover:border-red-200 hover:bg-red-50/50 transition-all">
                                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${colors.bg} ${colors.text}`}>
                                                            <Icon size={20} />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-black text-base text-slate-900 truncate">{exp.description}</p>
                                                            <div className="flex items-center gap-2 mt-1.5">
                                                                <span className={`px-2 py-1 rounded-lg text-xs font-black ${colors.bg} ${colors.text}`}>
                                                                    {categoryInfo.label}
                                                                </span>
                                                                <span className="text-slate-300">•</span>
                                                                <p className="text-xs text-slate-500 font-bold tabular-nums">{new Date(exp.date).toLocaleDateString('ar-LY')}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <span className="font-black text-lg text-red-600 tabular-nums">{formatCurrency(exp.amount)}</span>
                                                            <button 
                                                                onClick={() => handleDeleteExpense(exp.id)} 
                                                                className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                                                title="حذف المصروف"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Edit Invoice Tab */}
            {activeAccountingTab === 'edit-invoice' && (
                <div className="space-y-6">
                    <div className="professional-card p-8">
                        <h3 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3">
                            <Pencil className="text-purple-600" size={28} />
                            تحرير الفواتير
                        </h3>
                        {!editingInvoice ? (
                            <div className="space-y-4">
                                <div className="relative">
                                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input 
                                        type="text" 
                                        placeholder="بحث بالفواتير..." 
                                        value={searchQuery} 
                                        onChange={e => setSearchQuery(e.target.value)} 
                                        className="input-professional !py-3 !pr-11 !text-sm w-full" 
                                    />
                                </div>
                                <div className="space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar">
                                    {filteredInvoices.length === 0 ? (
                                        <div className="text-center py-12">
                                            <FileText className="mx-auto text-slate-300 mb-4" size={48} />
                                            <p className="text-slate-400 font-bold">لا توجد فواتير مطابقة للبحث</p>
                                        </div>
                                    ) : (
                                        filteredInvoices.map(inv => {
                                            const customer = customers.find(c => c.id === inv.customerId);
                                            const order = orders.find(o => o.id === inv.orderId);
                                            if (!customer || !order) return null;
                                            return (
                                                <div key={inv.id} className="p-5 border-2 border-slate-200 rounded-xl hover:border-purple-400 hover:shadow-lg transition-all cursor-pointer group" onClick={() => {
                                                    setEditingInvoice(inv);
                                                    setEditInvoiceForm({items: inv.items});
                                                }}>
                                                    <div className="flex justify-between items-center">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-3 mb-2">
                                                                <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center font-black text-lg">
                                                                    #{inv.invoiceNumber}
                                                                </div>
                                                                <div>
                                                                    <h4 className="font-black text-lg text-slate-900">{customer.name}</h4>
                                                                    <p className="text-sm text-slate-600 font-bold">{order.productType}</p>
                                                                </div>
                                                            </div>
                                                            <p className="text-xs text-slate-500">{new Date(inv.issueDate).toLocaleDateString('ar-LY')}</p>
                                                        </div>
                                                        <div className="text-left ml-4">
                                                            <p className="font-black text-2xl text-purple-600 tabular-nums">{formatCurrency(inv.totalAmount)}</p>
                                                            <p className="text-xs text-slate-500 mt-1">المدفوع: {formatCurrency(order.paidAmount || 0)}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="flex justify-between items-center pb-4 border-b-2 border-slate-200">
                                    <div>
                                        <h4 className="font-black text-2xl text-slate-900">تعديل فاتورة #{editingInvoice.invoiceNumber}</h4>
                                        <p className="text-sm text-slate-600 font-bold mt-1">
                                            {customers.find(c => c.id === editingInvoice.customerId)?.name}
                                        </p>
                                    </div>
                                    <button 
                                        onClick={() => {setEditingInvoice(null); setEditInvoiceForm({items: []});}} 
                                        className="px-4 py-2 bg-red-50 text-red-600 rounded-lg font-black text-sm hover:bg-red-100 transition-all"
                                    >
                                        إلغاء
                                    </button>
                                </div>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center mb-4">
                                        <h5 className="font-black text-lg text-slate-800">بنود الفاتورة</h5>
                                        <button 
                                            onClick={() => {
                                                setEditInvoiceForm({
                                                    items: [...editInvoiceForm.items, {description: '', amount: 0}]
                                                });
                                            }}
                                            className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-lg font-black text-sm hover:bg-emerald-100 transition-all flex items-center gap-2"
                                        >
                                            <PlusCircle size={18} />
                                            إضافة بند
                                        </button>
                                    </div>
                                    {editInvoiceForm.items.map((item, index) => (
                                        <div key={index} className="grid grid-cols-12 gap-4 items-center p-4 bg-slate-50 rounded-lg border-2 border-slate-200 hover:border-purple-300 transition-all">
                                            <div className="col-span-1 text-center">
                                                <span className="text-sm font-black text-slate-500">#{index + 1}</span>
                                            </div>
                                            <div className="col-span-7">
                                                <input 
                                                    type="text" 
                                                    value={item.description} 
                                                    onChange={e => {
                                                        const newItems = [...editInvoiceForm.items];
                                                        newItems[index].description = e.target.value;
                                                        setEditInvoiceForm({items: newItems});
                                                    }}
                                                    placeholder="وصف البند"
                                                    className="input-professional"
                                                />
                                            </div>
                                            <div className="col-span-3">
                                                <input 
                                                    type="number" 
                                                    value={item.amount || ''} 
                                                    onChange={e => {
                                                        const newItems = [...editInvoiceForm.items];
                                                        newItems[index].amount = parseFloat(e.target.value) || 0;
                                                        setEditInvoiceForm({items: newItems});
                                                    }}
                                                    placeholder="المبلغ"
                                                    className="input-professional tabular-nums text-center"
                                                />
                                            </div>
                                            <div className="col-span-1">
                                                <button 
                                                    onClick={() => {
                                                        const newItems = editInvoiceForm.items.filter((_, i) => i !== index);
                                                        setEditInvoiceForm({items: newItems});
                                                    }}
                                                    className="w-full p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-all"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {editInvoiceForm.items.length === 0 && (
                                        <div className="text-center py-8 bg-slate-50 rounded-lg border-2 border-dashed border-slate-300">
                                            <p className="text-slate-400 font-bold">لا توجد بنود. اضغط على "إضافة بند" لإضافة بنود جديدة</p>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center p-6 bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl border-2 border-purple-300">
                                        <span className="font-black text-xl text-slate-900">الإجمالي:</span>
                                        <span className="font-black text-3xl text-purple-600 tabular-nums">
                                            {formatCurrency(editInvoiceForm.items.reduce((sum, item) => sum + item.amount, 0))}
                                        </span>
                                    </div>
                                    <div className="flex gap-4">
                                        <button 
                                            onClick={() => {setEditingInvoice(null); setEditInvoiceForm({items: []});}} 
                                            className="flex-1 bg-slate-200 text-slate-800 py-4 rounded-xl font-black text-lg hover:bg-slate-300 transition-all"
                                        >
                                            إلغاء
                                        </button>
                                        <button 
                                            onClick={() => {
                                                if (editInvoiceForm.items.length === 0) {
                                                    addToast("يجب إضافة بند واحد على الأقل.", 'error');
                                                    return;
                                                }
                                                if (editInvoiceForm.items.some(item => !item.description || item.amount <= 0)) {
                                                    addToast("يرجى التأكد من ملء جميع البنود بشكل صحيح.", 'error');
                                                    return;
                                                }
                                                setInvoices(invoices.map(inv => 
                                                    inv.id === editingInvoice.id 
                                                        ? {...inv, items: editInvoiceForm.items, totalAmount: editInvoiceForm.items.reduce((sum, item) => sum + item.amount, 0)}
                                                        : inv
                                                ));
                                                setOrders(orders.map(o => 
                                                    o.id === editingInvoice.orderId
                                                        ? {...o, price: editInvoiceForm.items.reduce((sum, item) => sum + item.amount, 0)}
                                                        : o
                                                ));
                                                addToast("تم تحديث الفاتورة بنجاح.", 'success');
                                                setEditingInvoice(null);
                                            }}
                                            className="flex-1 bg-purple-600 text-white py-4 rounded-xl font-black text-lg shadow-xl hover:bg-purple-700 transition-all"
                                        >
                                            حفظ التعديلات
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Cash Receipt Tab */}
            {activeAccountingTab === 'cash-receipt' && (
                <CashReceiptView 
                    invoices={invoices}
                    customers={customers}
                    orders={orders}
                    paymentReceipts={paymentReceipts}
                    setPaymentReceipts={setPaymentReceipts}
                    setInvoices={setInvoices}
                    setOrders={setOrders}
                    addToast={addToast}
                    productsConfig={productsConfig}
                    companyLogo={companyLogo}
                />
            )}

            {/* Receipts Archive Tab */}
            {activeAccountingTab === 'receipts-archive' && (
                <ReceiptsArchiveView 
                    paymentReceipts={paymentReceipts}
                    customers={customers}
                    invoices={invoices}
                    orders={orders}
                    productsConfig={productsConfig}
                    companyLogo={companyLogo}
                />
            )}

            {/* Customer Statements Tab */}
            {activeAccountingTab === 'statements' && (
                <div className="space-y-6">
                    <div className="professional-card p-6">
                        <h3 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3">
                            <FileSpreadsheet className="text-violet-600" size={28} />
                            كشف حساب العميل
                        </h3>
                        
                        {/* Customer Search */}
                        <div className="relative">
                            <label className="block text-sm font-black text-slate-700 mb-2">ابحث عن العميل</label>
                            <div className="relative">
                                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                <input
                                    type="text"
                                    value={customerSearchForStatement}
                                    onChange={e => {
                                        setCustomerSearchForStatement(e.target.value);
                                        if (!e.target.value.trim()) {
                                            setSelectedCustomerForStatement('');
                                        }
                                    }}
                                    placeholder="اكتب اسم العميل، رقم الهاتف، أو العنوان..."
                                    className="input-professional !py-4 !pr-12 !text-base w-full"
                                />
                            </div>
                            
                            {/* Customer Search Results */}
                            {customerSearchForStatement.trim() && !selectedCustomerForStatement && filteredCustomersForStatement.length > 0 && (
                                <div className="absolute z-50 w-full mt-2 bg-white rounded-2xl shadow-2xl border-2 border-slate-200 max-h-96 overflow-y-auto custom-scrollbar">
                                    {filteredCustomersForStatement.map(customer => {
                                        const customerOrders = orders.filter(o => o.customerId === customer.id);
                                        const totalDue = customerOrders.reduce((sum, o) => sum + (o.price || 0), 0);
                                        const totalPaid = customerOrders.reduce((sum, o) => sum + (o.paidAmount || 0), 0);
                                        const remaining = totalDue - totalPaid;
                                        return (
                                            <button
                                                key={customer.id}
                                                onClick={() => {
                                                    setSelectedCustomerForStatement(customer.id);
                                                    setCustomerSearchForStatement(customer.name);
                                                }}
                                                className="w-full p-4 hover:bg-violet-50 transition-all text-right border-b border-slate-100 last:border-b-0 group"
                                            >
                                                <div className="flex items-center justify-between gap-4">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-3 mb-1">
                                                            <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl flex items-center justify-center text-white font-black text-lg">
                                                                {customer.name.charAt(0)}
                                                            </div>
                                                            <div>
                                                                <p className="font-black text-lg text-slate-900 group-hover:text-violet-600 transition-colors">
                                                                    {customer.name}
                                                                </p>
                                                                <p className="text-xs text-slate-500 font-bold mt-0.5">
                                                                    {customer.phone}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        {customer.address && (
                                                            <p className="text-xs text-slate-400 pr-13 mt-1">{customer.address}</p>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col items-end gap-1">
                                                        <span className={`px-3 py-1 rounded-lg text-xs font-black ${
                                                            remaining > 0 
                                                                ? 'bg-amber-100 text-amber-700' 
                                                                : remaining < 0
                                                                ? 'bg-emerald-100 text-emerald-700'
                                                                : 'bg-slate-100 text-slate-700'
                                                        }`}>
                                                            {remaining > 0 ? 'مستحق عليه' : remaining < 0 ? 'رصيد له' : 'مكتمل'}
                                                        </span>
                                                        <span className="text-xs text-slate-600 font-black tabular-nums">
                                                            {formatCurrency(Math.abs(remaining))}
                                                        </span>
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                            
                            {customerSearchForStatement.trim() && !selectedCustomerForStatement && filteredCustomersForStatement.length === 0 && (
                                <div className="absolute z-50 w-full mt-2 bg-white rounded-2xl shadow-xl border-2 border-slate-200 p-6 text-center">
                                    <User className="mx-auto text-slate-300 mb-3" size={48} />
                                    <p className="text-slate-400 font-bold">لا توجد نتائج للبحث</p>
                                </div>
                            )}
                        </div>

                        {/* Selected Customer Info */}
                        {selectedCustomerForStatement && customerStatements && (
                            <div className="mt-4 p-5 bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl border-2 border-violet-200">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-violet-600 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-lg">
                                        {customers.find(c => c.id === selectedCustomerForStatement)?.name.charAt(0)}
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-black text-xl text-slate-900">
                                            {customers.find(c => c.id === selectedCustomerForStatement)?.name}
                                        </h4>
                                        <p className="text-sm text-slate-600 font-bold mt-1">
                                            {customers.find(c => c.id === selectedCustomerForStatement)?.phone}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setSelectedCustomerForStatement('');
                                            setCustomerSearchForStatement('');
                                        }}
                                        className="p-2 hover:bg-white/50 rounded-lg transition-all"
                                    >
                                        <X size={20} className="text-slate-500" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {customerStatements && (
                        <div className="professional-card p-8">
                            <div className="mb-6 pb-6 border-b-2 border-slate-200">
                                <div className="flex items-center justify-between flex-wrap gap-4">
                                    <div>
                                        <h4 className="text-3xl font-black text-slate-900 mb-2">
                                            كشف حساب: {customers.find(c => c.id === selectedCustomerForStatement)?.name}
                                        </h4>
                                        <div className="flex items-center gap-4 text-slate-600 font-bold">
                                            <div className="flex items-center gap-2">
                                                <Phone size={16} />
                                                <span>{customers.find(c => c.id === selectedCustomerForStatement)?.phone}</span>
                                            </div>
                                            {customers.find(c => c.id === selectedCustomerForStatement)?.address && (
                                                <div className="flex items-center gap-2">
                                                    <MapPin size={16} />
                                                    <span>{customers.find(c => c.id === selectedCustomerForStatement)?.address}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className={`px-6 py-3 rounded-xl font-black text-lg ${
                                            customerStatements.remaining > 0 
                                                ? 'bg-amber-100 text-amber-700' 
                                                : customerStatements.remaining < 0
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : 'bg-slate-100 text-slate-700'
                                        }`}>
                                            {customerStatements.remaining > 0 ? 'مستحق عليه' : customerStatements.remaining < 0 ? 'رصيد له' : 'مكتمل'}
                                        </div>
                                        <button
                                            onClick={() => {
                                                if (!customerStatements || !selectedCustomerForStatement) return;
                                                const customer = customers.find(c => c.id === selectedCustomerForStatement);
                                                if (!customer) return;

                                                const statementHtml = `
                                                    <!DOCTYPE html>
                                                    <html lang="ar" dir="rtl">
                                                    <head>
                                                        <meta charset="UTF-8">
                                                        <title>كشف حساب - ${customer.name}</title>
                                                        <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;900&display=swap" rel="stylesheet">
                                                        <style>
                                                            * { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; margin: 0; padding: 0; box-sizing: border-box; }
                                                            body { font-family: 'Tajawal', sans-serif; direction: rtl; text-align: right; padding: 2rem; color: #111827; background: #fff; }
                                                            .container { max-width: 1000px; margin: 0 auto; }
                                                            .header { border-bottom: 4px solid #7c3aed; padding-bottom: 1.5rem; margin-bottom: 2rem; }
                                                            .header-content { display: flex; justify-content: space-between; align-items: start; gap: 2rem; }
                                                            .logo-section { display: flex; align-items: center; gap: 1rem; }
                                                            .logo-box { width: 64px; height: 64px; background: #7c3aed; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; font-size: 32px; font-weight: 900; }
                                                            .company-info h1 { font-size: 28px; font-weight: 900; color: #0f172a; margin-bottom: 0.5rem; }
                                                            .company-info p { color: #475569; font-weight: 700; font-size: 14px; }
                                                            .statement-title { text-align: left; border-right: 4px solid #7c3aed; padding-right: 1.5rem; }
                                                            .statement-title h2 { font-size: 36px; font-weight: 900; color: #0f172a; margin-bottom: 0.5rem; }
                                                            .statement-title p { color: #475569; font-weight: 700; font-size: 14px; }
                                                            .customer-info { background: #f8fafc; padding: 1.5rem; border-radius: 12px; margin: 1.5rem 0; border: 2px solid #e2e8f0; }
                                                            .customer-info h3 { font-size: 20px; font-weight: 900; color: #1e293b; margin-bottom: 1rem; }
                                                            .customer-info p { font-size: 16px; font-weight: 700; color: #475569; margin: 0.5rem 0; }
                                                            .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin: 2rem 0; }
                                                            .summary-card { padding: 1.5rem; border-radius: 12px; border: 2px solid; text-align: center; }
                                                            .summary-card.debit { background: #eff6ff; border-color: #3b82f6; }
                                                            .summary-card.credit { background: #ecfdf5; border-color: #10b981; }
                                                            .summary-card.remaining { background: ${customerStatements.remaining > 0 ? '#fef3c7' : customerStatements.remaining < 0 ? '#f1f5f9' : '#ecfdf5'}; border-color: ${customerStatements.remaining > 0 ? '#f59e0b' : customerStatements.remaining < 0 ? '#64748b' : '#10b981'}; }
                                                            .summary-card h4 { font-size: 12px; font-weight: 900; color: #475569; margin-bottom: 0.75rem; text-transform: uppercase; }
                                                            .summary-card .value { font-size: 28px; font-weight: 900; }
                                                            .summary-card.due .value { color: #2563eb; }
                                                            .summary-card.paid .value { color: #059669; }
                                                            .summary-card.remaining .value { color: ${customerStatements.remaining > 0 ? '#d97706' : customerStatements.remaining < 0 ? '#475569' : '#059669'}; }
                                                            table { width: 100%; border-collapse: collapse; font-size: 0.9rem; margin: 2rem 0; table-layout: fixed; }
                                                            th, td { padding: 1rem; border-bottom: 2px solid #e5e7eb; word-wrap: break-word; overflow-wrap: break-word; word-break: break-word; white-space: normal; line-height: 1.6; }
                                                            th { font-weight: 800; background-color: #f3f4f6; color: #374151; text-align: right; }
                                                            td { font-weight: 700; }
                                                            .due-col { text-align: left; color: #dc2626; font-weight: 900; }
                                                            .paid-col { text-align: left; color: #059669; font-weight: 900; }
                                                            .remaining-col { text-align: left; color: #1e293b; font-weight: 900; }
                                                            tfoot tr { background: #f3f4f6; font-weight: 900; border-top: 3px solid #374151; }
                                                            tfoot td { padding: 1rem; }
                                                            .footer { border-top: 4px solid #1e293b; padding-top: 1.5rem; margin-top: 2rem; text-align: center; }
                                                            .footer p { font-weight: 900; color: #1e293b; margin: 0.5rem 0; }
                                                            @media print { body { padding: 1rem; } }
                                                        </style>
                                                    </head>
                                                    <body>
                                                        <div class="container">
                                                            <header class="header">
                                                                <div class="header-content">
                                                                    <div class="logo-section">
                                                                        <div class="logo-box">D</div>
                                                                        <div class="company-info">
                                                                            <h1>مصنع ديكورا</h1>
                                                                            <p>للأثاث والمطابخ والديكور</p>
                                                                        </div>
                                                                    </div>
                                                                    <div class="statement-title">
                                                                        <h2>كشف حساب</h2>
                                                                        <p>تاريخ الإصدار: ${new Date().toLocaleDateString('ar-LY', { dateStyle: 'full' })}</p>
                                                                    </div>
                                                                </div>
                                                            </header>

                                                            <div class="customer-info">
                                                                <h3>معلومات العميل</h3>
                                                                <p><strong>الاسم:</strong> ${customer.name}</p>
                                                                <p><strong>رقم الهاتف:</strong> ${customer.phone}</p>
                                                                ${customer.address ? `<p><strong>العنوان:</strong> ${customer.address}</p>` : ''}
                                                            </div>

                                                            <div class="summary-grid">
                                                                <div class="summary-card due">
                                                                    <h4>إجمالي المستحقات</h4>
                                                                    <div class="value">${formatCurrency(customerStatements.totalDue)}</div>
                                                                </div>
                                                                <div class="summary-card paid">
                                                                    <h4>إجمالي المدفوع</h4>
                                                                    <div class="value">${formatCurrency(customerStatements.totalPaid)}</div>
                                                                </div>
                                                                <div class="summary-card remaining">
                                                                    <h4>المتبقي</h4>
                                                                    <div class="value">${formatCurrency(Math.abs(customerStatements.remaining))}</div>
                                                                    <p style="font-size: 12px; margin-top: 0.5rem; color: #64748b;">${customerStatements.remaining > 0 ? '(مستحق عليه)' : customerStatements.remaining < 0 ? '(رصيد له)' : '(مكتمل)'}</p>
                                                                </div>
                                                            </div>

                                                            <table>
                                                                <thead>
                                                                    <tr>
                                                                        <th style="width: 15%;">التاريخ</th>
                                                                        <th style="width: 35%;">الوصف</th>
                                                                        <th style="width: 15%;">المستحقات</th>
                                                                        <th style="width: 15%;">المدفوع</th>
                                                                        <th style="width: 20%;">المتبقي</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    ${customerStatements.customerOrders.flatMap((order, orderIndex) => {
                                                                        const prodName = productsConfig[order.productType]?.name || order.productType;
                                                                        const transactions: Array<{date: number, desc: string, debit: number, credit: number}> = [];
                                                                        if (order.price && order.price > 0) {
                                                                            transactions.push({
                                                                                date: order.orderDate,
                                                                                desc: `فاتورة - ${prodName}`,
                                                                                debit: order.price,
                                                                                credit: 0
                                                                            });
                                                                        }
                                                                        if (order.paidAmount && order.paidAmount > 0) {
                                                                            transactions.push({
                                                                                date: order.orderDate,
                                                                                desc: `دفعة - ${prodName}`,
                                                                                debit: 0,
                                                                                credit: order.paidAmount
                                                                            });
                                                                        }
                                                                        return transactions.map((trans, idx) => {
                                                                            const runningBalance = customerStatements.customerOrders.slice(0, orderIndex).reduce((sum, o) => sum + (o.price || 0) - (o.paidAmount || 0), 0) + 
                                                                                (idx === 0 ? trans.debit - trans.credit : 0);
                                                                            return `
                                                                                <tr>
                                                                                    <td>${new Date(trans.date).toLocaleDateString('ar-LY')}</td>
                                                                                    <td>${trans.desc}</td>
                                                                                    <td class="due-col">${trans.debit > 0 ? formatCurrency(trans.debit) : '-'}</td>
                                                                                    <td class="paid-col">${trans.credit > 0 ? formatCurrency(trans.credit) : '-'}</td>
                                                                                    <td class="remaining-col">${formatCurrency(runningBalance + (idx === 1 ? -trans.credit : 0))}</td>
                                                                                </tr>
                                                                            `;
                                                                        }).join('');
                                                                    }).join('')}
                                                                </tbody>
                                                                <tfoot>
                                                                    <tr>
                                                                        <td colspan="2" style="text-align: right; font-weight: 900;">المجموع</td>
                                                                        <td class="due-col">${formatCurrency(customerStatements.totalDue)}</td>
                                                                        <td class="paid-col">${formatCurrency(customerStatements.totalPaid)}</td>
                                                                        <td class="remaining-col">${formatCurrency(customerStatements.remaining)}</td>
                                                                    </tr>
                                                                </tfoot>
                                                            </table>

                                                            <footer class="footer">
                                                                <p>شكراً لتعاونكم</p>
                                                                <p style="font-size: 12px; color: #64748b;">مصنع ديكورا - بنغازي</p>
                                                            </footer>
                                                        </div>
                                                    </body>
                                                    </html>
                                                `;

                                                const element = document.createElement('div');
                                                element.innerHTML = statementHtml;
                                                document.body.appendChild(element);

                                                const opt = {
                                                    margin: 0.5,
                                                    filename: `كشف_حساب_${customer.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`,
                                                    image: { type: 'png' as const, quality: 1 },
                                                    html2canvas: { 
                                                        scale: 3, 
                                                        useCORS: true,
                                                        letterRendering: true,
                                                        logging: false,
                                                        allowTaint: false,
                                                        backgroundColor: '#ffffff'
                                                    },
                                                    jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' as const }
                                                };

                                                html2pdf().from(element).set(opt).save().then(() => {
                                                    document.body.removeChild(element);
                                                    addToast("تم تصدير كشف الحساب بنجاح.", 'success');
                                                }).catch((err: any) => {
                                                    document.body.removeChild(element);
                                                    console.error('PDF export error:', err);
                                                    addToast("حدث خطأ أثناء تصدير PDF.", 'error');
                                                });
                                            }}
                                            className="bg-violet-600 text-white px-6 py-3 rounded-xl font-black text-sm flex items-center gap-2 shadow-xl hover:bg-violet-700 transition-all active:scale-95"
                                        >
                                            <Printer size={18} />
                                            تصدير PDF
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                                    {/* إجمالي المستحقات */}
                                    <div className="group relative bg-white p-4 rounded-2xl border border-blue-200/50 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
                                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-500/10 to-transparent rounded-full blur-2xl"></div>
                                        <div className="absolute bottom-0 left-0 w-16 h-16 bg-gradient-to-tr from-blue-400/5 to-transparent rounded-full blur-xl"></div>
                                        <div className="relative">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-500/30 group-hover:scale-110 transition-transform duration-300">
                                                        <TrendingUp className="text-white" size={20} />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-black text-slate-500 uppercase tracking-wider">إجمالي المستحقات</p>
                                                        <div className="h-0.5 w-10 bg-gradient-to-r from-blue-500 to-blue-400 rounded-full mt-1"></div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="mt-4">
                                                <p className="text-2xl font-black text-slate-900 tabular-nums mb-1 group-hover:text-blue-600 transition-colors duration-300">
                                                    {formatCurrency(customerStatements.totalDue)}
                                                </p>
                                                <div className="flex items-center gap-2 mt-1.5">
                                                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
                                                    <p className="text-xs font-bold text-slate-400">جميع الفواتير</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* إجمالي المدفوع */}
                                    <div className="group relative bg-white p-4 rounded-2xl border border-emerald-200/50 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
                                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-500/10 to-transparent rounded-full blur-2xl"></div>
                                        <div className="absolute bottom-0 left-0 w-16 h-16 bg-gradient-to-tr from-emerald-400/5 to-transparent rounded-full blur-xl"></div>
                                        <div className="relative">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-md shadow-emerald-500/30 group-hover:scale-110 transition-transform duration-300">
                                                        <CircleDollarSign className="text-white" size={20} />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-black text-slate-500 uppercase tracking-wider">إجمالي المدفوع</p>
                                                        <div className="h-0.5 w-10 bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full mt-1"></div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="mt-4">
                                                <p className="text-2xl font-black text-slate-900 tabular-nums mb-1 group-hover:text-emerald-600 transition-colors duration-300">
                                                    {formatCurrency(customerStatements.totalPaid)}
                                                </p>
                                                <div className="flex items-center gap-2 mt-1.5">
                                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                                                    <p className="text-xs font-bold text-slate-400">المبالغ المستلمة</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* المتبقي */}
                                    <div className={`group relative bg-white p-4 rounded-2xl border shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden ${
                                        customerStatements.remaining > 0 
                                            ? 'border-amber-200/50' 
                                            : customerStatements.remaining < 0
                                            ? 'border-slate-200/50'
                                            : 'border-emerald-200/50'
                                    }`}>
                                        <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl ${
                                            customerStatements.remaining > 0 
                                                ? 'bg-gradient-to-br from-amber-500/10 to-transparent' 
                                                : customerStatements.remaining < 0
                                                ? 'bg-gradient-to-br from-slate-500/10 to-transparent'
                                                : 'bg-gradient-to-br from-emerald-500/10 to-transparent'
                                        }`}></div>
                                        <div className={`absolute bottom-0 left-0 w-16 h-16 rounded-full blur-xl ${
                                            customerStatements.remaining > 0 
                                                ? 'bg-gradient-to-tr from-amber-400/5 to-transparent' 
                                                : customerStatements.remaining < 0
                                                ? 'bg-gradient-to-tr from-slate-400/5 to-transparent'
                                                : 'bg-gradient-to-tr from-emerald-400/5 to-transparent'
                                        }`}></div>
                                        <div className="relative">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-300 ${
                                                        customerStatements.remaining > 0 
                                                            ? 'bg-gradient-to-br from-amber-500 to-amber-600 shadow-amber-500/30' 
                                                            : customerStatements.remaining < 0
                                                            ? 'bg-gradient-to-br from-slate-500 to-slate-600 shadow-slate-500/30'
                                                            : 'bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-emerald-500/30'
                                                    }`}>
                                                        <Scale className="text-white" size={20} />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-black text-slate-500 uppercase tracking-wider">المتبقي</p>
                                                        <div className={`h-0.5 w-10 rounded-full mt-1 ${
                                                            customerStatements.remaining > 0 
                                                                ? 'bg-gradient-to-r from-amber-500 to-amber-400' 
                                                                : customerStatements.remaining < 0
                                                                ? 'bg-gradient-to-r from-slate-500 to-slate-400'
                                                                : 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                                                        }`}></div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="mt-4">
                                                <p className={`text-2xl font-black tabular-nums mb-1 transition-colors duration-300 ${
                                                    customerStatements.remaining > 0 
                                                        ? 'text-slate-900 group-hover:text-amber-600' 
                                                        : customerStatements.remaining < 0
                                                        ? 'text-slate-900 group-hover:text-slate-600'
                                                        : 'text-slate-900 group-hover:text-emerald-600'
                                                }`}>
                                                    {formatCurrency(Math.abs(customerStatements.remaining))}
                                                </p>
                                                <div className="flex items-center gap-2 mt-1.5">
                                                    <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                                                        customerStatements.remaining > 0 
                                                            ? 'bg-amber-500' 
                                                            : customerStatements.remaining < 0
                                                            ? 'bg-slate-500'
                                                            : 'bg-emerald-500'
                                                    }`}></div>
                                                    <p className={`text-xs font-black ${
                                                        customerStatements.remaining > 0 
                                                            ? 'text-amber-600' 
                                                            : customerStatements.remaining < 0
                                                            ? 'text-slate-600'
                                                            : 'text-emerald-600'
                                                    }`}>
                                                        {customerStatements.remaining > 0 ? 'مستحق عليه' : customerStatements.remaining < 0 ? 'رصيد له' : 'مكتمل'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
                                            <FileSpreadsheet className="text-violet-600" size={20} />
                                        </div>
                                        <h5 className="text-xl font-black text-slate-900">تفاصيل المعاملات</h5>
                                    </div>
                                    <div className="overflow-x-auto rounded-2xl border-2 border-slate-200">
                                        <table className="w-full border-collapse">
                                            <thead>
                                                <tr className="bg-gradient-to-r from-slate-100 to-slate-50 border-b-2 border-slate-300">
                                                    <th className="p-4 text-right font-black text-slate-700">التاريخ</th>
                                                    <th className="p-4 text-right font-black text-slate-700">الوصف</th>
                                                    <th className="p-4 text-left font-black text-slate-700">المستحقات</th>
                                                    <th className="p-4 text-left font-black text-slate-700">المدفوع</th>
                                                    <th className="p-4 text-left font-black text-slate-700">المتبقي</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {customerStatements.customerOrders.flatMap((order, orderIndex) => {
                                                    const prodName = productsConfig[order.productType]?.name || order.productType;
                                                    const transactions: Array<{date: number, desc: string, debit: number, credit: number, type: 'invoice' | 'payment'}> = [];
                                                    if (order.price && order.price > 0) {
                                                        transactions.push({
                                                            date: order.orderDate,
                                                            desc: `فاتورة - ${prodName}`,
                                                            debit: order.price,
                                                            credit: 0,
                                                            type: 'invoice'
                                                        });
                                                    }
                                                    if (order.paidAmount && order.paidAmount > 0) {
                                                        transactions.push({
                                                            date: order.orderDate,
                                                            desc: `دفعة - ${prodName}`,
                                                            debit: 0,
                                                            credit: order.paidAmount,
                                                            type: 'payment'
                                                        });
                                                    }
                                                    return transactions.map((trans, idx) => {
                                                        const runningBalance = customerStatements.customerOrders.slice(0, orderIndex).reduce((sum, o) => sum + (o.price || 0) - (o.paidAmount || 0), 0) + 
                                                            (idx === 0 ? trans.debit - trans.credit : 0);
                                                        return (
                                                            <tr key={`${order.id}-${idx}`} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                                                                <td className="p-4 text-sm font-bold text-slate-700 tabular-nums">{new Date(trans.date).toLocaleDateString('ar-LY')}</td>
                                                                <td className="p-4">
                                                                    <div className="flex items-center gap-2">
                                                                        {trans.type === 'invoice' ? (
                                                                            <FileText className="text-blue-500" size={16} />
                                                                        ) : (
                                                                            <CircleDollarSign className="text-emerald-500" size={16} />
                                                                        )}
                                                                        <span className="font-bold text-slate-800">{trans.desc}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="p-4 text-left font-black text-red-600 tabular-nums">{trans.debit > 0 ? formatCurrency(trans.debit) : '-'}</td>
                                                                <td className="p-4 text-left font-black text-emerald-600 tabular-nums">{trans.credit > 0 ? formatCurrency(trans.credit) : '-'}</td>
                                                                <td className="p-4 text-left font-black text-slate-900 tabular-nums">{formatCurrency(runningBalance + (idx === 1 ? -trans.credit : 0))}</td>
                                                            </tr>
                                                        );
                                                    });
                                                })}
                                                <tr className="bg-gradient-to-r from-slate-100 to-slate-50 font-black border-t-2 border-slate-400">
                                                    <td colSpan={2} className="p-4 text-right">المجموع</td>
                                                    <td className="p-4 text-left text-red-600 tabular-nums">{formatCurrency(customerStatements.totalDue)}</td>
                                                    <td className="p-4 text-left text-emerald-600 tabular-nums">{formatCurrency(customerStatements.totalPaid)}</td>
                                                    <td className={`p-4 text-left tabular-nums ${
                                                        customerStatements.remaining > 0 ? 'text-amber-600' : customerStatements.remaining < 0 ? 'text-slate-600' : 'text-emerald-600'
                                                    }`}>{formatCurrency(customerStatements.remaining)}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {!selectedCustomerForStatement && (
                        <div className="professional-card p-12 text-center">
                            <FileSpreadsheet className="mx-auto text-slate-300 mb-4" size={64} />
                            <p className="text-slate-400 font-bold text-lg">ابحث عن عميل لعرض كشف حسابه</p>
                        </div>
                    )}
                </div>
            )}

            
            {isPaymentModalOpen && invoiceForPayment && (
                 <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm animate-in no-print">
                    <div className="bg-white rounded-[32px] shadow-2xl max-w-md w-full overflow-hidden">
                        <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                            <h3 className="font-black text-lg">تسجيل دفعة للفاتورة #{invoiceForPayment.invoiceNumber}</h3>
                            <button onClick={() => setIsPaymentModalOpen(false)}><X size={20}/></button>
                        </div>
                        <div className="p-8 space-y-5">
                            <div>
                                <label className="block text-sm font-black text-slate-700 mb-2">مبلغ الدفعة</label>
                                <input 
                                    type="number" 
                                    value={paymentForm.amount || ''} 
                                    onChange={e => setPaymentForm({...paymentForm, amount: parseFloat(e.target.value) || 0})} 
                                    placeholder="أدخل المبلغ" 
                                    required 
                                    className="input-professional tabular-nums text-center" 
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-black text-slate-700 mb-2">تاريخ الاستلام</label>
                                <input 
                                    type="date" 
                                    value={new Date().toISOString().split('T')[0]} 
                                    className="input-professional" 
                                />
                            </div>
                            <button 
                                onClick={() => {
                                    handleRecordPayment();
                                    const customer = customers.find(c => c.id === invoiceForPayment.customerId);
                                    const order = orders.find(o => o.id === invoiceForPayment.orderId);
                                    if (customer && order) {
                                        // عرض إيصال الاستلام
                                        const receiptRef = document.createElement('div');
                                        receiptRef.className = 'fixed inset-0 z-[300] flex items-center justify-center p-6 bg-white print:bg-white';
                                        receiptRef.innerHTML = `
                                            <div class="bg-white p-12 max-w-2xl w-full print:p-8">
                                                <header class="border-b-4 border-emerald-900 pb-6 mb-8">
                                                    <div class="flex justify-between items-start">
                                                        <div class="flex items-center gap-6">
                                                            ${companyLogo ? `<img src="${companyLogo}" alt="شعار الشركة" style="width: 80px; height: 80px; object-fit: contain; border-radius: 16px;" />` : `<div class="w-20 h-20 bg-emerald-600 rounded-2xl flex items-center justify-center">
                                                                <svg viewBox="0 0 24 24" fill="none" class="text-white" style="width: 40px; height: 40px;">
                                                                    <path d="M9 4H13C16.3137 4 19 6.68629 19 10V14C19 17.3137 16.3137 20 13 20H9V4Z" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                                                                    <path d="M9 4V20" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
                                                                </svg>
                                                            </div>`}
                                                            <div>
                                                                <h1 class="text-4xl font-black text-slate-900 mb-1">مصنع ديكورا</h1>
                                                                <p class="text-slate-600 font-bold text-base">للأثاث والمطابخ والديكور</p>
                                                            </div>
                                                        </div>
                                                        <div class="text-left border-r-4 border-emerald-600 pr-6">
                                                            <h2 class="text-5xl font-black text-slate-900 mb-2">إيصال استلام</h2>
                                                            <p class="text-slate-600 font-bold">التاريخ: ${new Date().toLocaleDateString('ar-LY')}</p>
                                                        </div>
                                                    </div>
                                                </header>
                                                <section class="grid grid-cols-2 gap-8 my-8">
                                                    <div class="bg-slate-50 p-6 rounded-xl border-2 border-slate-200">
                                                        <h3 class="font-black text-slate-700 text-base uppercase mb-4 border-b-2 border-slate-300 pb-2">استلمنا من:</h3>
                                                        <p class="font-black text-xl text-slate-900 mb-2">${customer.name}</p>
                                                        <p class="text-sm text-slate-700 font-bold">${customer.address}</p>
                                                    </div>
                                                    <div class="bg-slate-50 p-6 rounded-xl border-2 border-slate-200">
                                                        <h3 class="font-black text-slate-700 text-base uppercase mb-4 border-b-2 border-slate-300 pb-2">معلومات الدفعة:</h3>
                                                        <p class="text-sm font-bold text-slate-600 mb-2">رقم الفاتورة: <span class="font-black">#${invoiceForPayment.invoiceNumber}</span></p>
                                                        <p class="text-sm font-bold text-slate-600">المشروع: ${order.productType}</p>
                                                    </div>
                                                </section>
                                                <section class="bg-emerald-50 p-8 rounded-xl border-4 border-emerald-300 mb-8">
                                                    <div class="text-center">
                                                        <p class="text-2xl font-black text-emerald-900 mb-4">مبلغ الدفعة</p>
                                                        <p class="text-6xl font-black text-emerald-700 tabular-nums">${formatCurrency(paymentForm.amount)}</p>
                                                    </div>
                                                </section>
                                                <footer class="border-t-4 border-slate-900 pt-8 text-center">
                                                    <p class="font-black text-slate-900 text-sm mb-2">شكراً لدفعكم</p>
                                                    <p class="text-xs text-slate-600">مصنع ديكورا - بنغازي</p>
                                                </footer>
                                            </div>
                                        `;
                                        document.body.appendChild(receiptRef);
                                        setTimeout(() => {
                                            window.print();
                                            setTimeout(() => {
                                                document.body.removeChild(receiptRef);
                                            }, 1000);
                                        }, 500);
                                    }
                                }}
                                className="w-full bg-emerald-600 text-white py-4 rounded-xl font-black text-lg shadow-xl hover:bg-emerald-700 transition-all"
                            >
                                تسجيل الدفعة وطباعة الإيصال
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [userAccounts, setUserAccounts] = useState<UserAccount[]>([]);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [authError, setAuthError] = useState('');
  
  const [aiAdvice, setAiAdvice] = useState('');
  const [loadingAdvice, setLoadingAdvice] = useState(false);

  const [activeTab, setActiveTab] = useState<TabName>('dashboard');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [paymentReceipts, setPaymentReceipts] = useState<PaymentReceipt[]>([]);
  
  const [backupInterval, setBackupInterval] = useState(10);
  const [productsConfig, setProductsConfig] = useState<Record<string, ProductConfig>>(DEFAULT_PRODUCTS_CONFIG);
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);

  const [backupHandle, setBackupHandle] = useState<any>(null);
  const backupHandleRef = useRef<any>(null);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const autoFallbackDownloadedRef = useRef(false);
  
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [confirmationModal, setConfirmationModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });
  
  const [delayedOrdersData, setDelayedOrdersData] = useState<{ order: Order; customer: Customer; newDate: number }[]>([]);
  const [isDelayedModalOpen, setIsDelayedModalOpen] = useState(false);
  const [delayedOrdersConflicts, setDelayedOrdersConflicts] = useState<Record<string, string | null>>({});

  const [editedOrder, setEditedOrder] = useState<Order | null>(null);

  const addToast = (message: string, type: Toast['type'] = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  const dataRef = useRef({ customers, orders, expenses, invoices, paymentReceipts, userAccounts, productsConfig, backupInterval, companyLogo });

  // Auto-save (debounced) when critical app data changes
  useEffect(() => {
    dataRef.current = { customers, orders, expenses, invoices, paymentReceipts, userAccounts, productsConfig, backupInterval, companyLogo };
    const payload = dataRef.current;
    const handle = setTimeout(() => {
      // fire-and-forget
      saveAppState(payload).then(r => {
        if (!r.ok) console.debug('autosave failed');
      }).catch(() => {});
    }, 800);
    return () => clearTimeout(handle);
  }, [customers, orders, expenses, invoices, paymentReceipts, userAccounts, productsConfig, backupInterval, companyLogo]);

  // Load saved state on startup (if any)
  useEffect(() => {
    (async () => {
      try {
        const r = await fetchAppState();
        if (r.ok && r.data) {
          const s = r.data;
          if (s.customers) setCustomers(s.customers);
          if (s.orders) setOrders(s.orders);
          if (s.expenses) setExpenses(s.expenses);
          if (s.invoices) setInvoices(s.invoices);
          if (s.paymentReceipts) setPaymentReceipts(s.paymentReceipts);
          if (s.userAccounts) setUserAccounts(s.userAccounts);
          if (s.productsConfig) setProductsConfig(s.productsConfig);
          if (s.backupInterval) setBackupInterval(s.backupInterval);
          if (s.companyLogo) setCompanyLogo(s.companyLogo);
        }
      } catch (e) {
        console.debug('no saved state');
      }
    })();
  }, []);

  const [modals, setModals] = useState<{
    editOrder: { isOpen: boolean, order: Order | null },
    editCustomer: { isOpen: boolean, customer: Customer | null },
    changePassword: { isOpen: boolean, user: UserAccount | null },
    editProduct: { isOpen: boolean, productId: string | null, isNew?: boolean },
    rescheduleOrder: { isOpen: boolean, order: Order | null, suggestedDate?: number },
    invoice: { isOpen: boolean, invoice: Invoice | null },
    whatsappTemplates: { isOpen: boolean, customer: Customer | null },
    financialReport: { isOpen: boolean, range: 'month' | 'all' | 'custom' },
  }>({
    editOrder: { isOpen: false, order: null },
    editCustomer: { isOpen: false, customer: null },
    changePassword: { isOpen: false, user: null },
    editProduct: { isOpen: false, productId: null, isNew: false },
    rescheduleOrder: { isOpen: false, order: null },
    invoice: {isOpen: false, invoice: null},
    whatsappTemplates: { isOpen: false, customer: null },
    financialReport: { isOpen: false, range: 'month' },
  });
  
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [passwordError, setPasswordError] = useState('');
  const [productForm, setProductForm] = useState<Partial<ProductConfig>>({ 
      name: '', productionDays: 7, color: 'orange', iconKey: 'Package' 
  });
  const [rescheduleDate, setRescheduleDate] = useState<string>('');
  const [rescheduleConflict, setRescheduleConflict] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isInitialMount = useRef(true);
  const writeLocal = (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
      try { console.log(`[decora] localStorage saved ${key} (${value.length} chars)`); } catch(e) { /* ignore */ }
    } catch (e) {
      console.error(`[decora] failed saving ${key} to localStorage`, e);
    }
  };

  const getDaysDiff = (ts: number) => {
    const target = new Date(ts);
    target.setHours(0,0,0,0);
    const now = new Date();
    now.setHours(0,0,0,0);
    return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getSuggestedDeliveryDate = (newOrderProducts: Record<string, number>, orderIdToExclude?: string) => {
    const totalProductionDays = Object.keys(newOrderProducts).reduce((total, prodId) => {
        const qty = newOrderProducts[prodId] || 0;
        const days = productsConfig[prodId]?.productionDays || 0;
        return total + (qty * days);
    }, 0);

    if (totalProductionDays === 0) return null;

    const occupiedDates = new Map<number, string>(
        orders
            .filter(o => o.status !== 'delivered' && o.id !== orderIdToExclude)
            .map(o => [new Date(o.deliveryDate).setHours(0, 0, 0, 0), o.id])
    );

    const initialProposedDate = addWorkingDays(Date.now(), totalProductionDays);
    let finalDateTs = initialProposedDate;
    let finalDateObj = new Date(finalDateTs);
    finalDateObj.setHours(0, 0, 0, 0);

    let conflictingOrderId = occupiedDates.get(finalDateObj.getTime());

    while (occupiedDates.has(finalDateObj.getTime())) {
      finalDateTs = addWorkingDays(finalDateTs, 1); 
      finalDateTs = addWorkingDays(finalDateTs, 1);
      
      finalDateObj = new Date(finalDateTs);
      finalDateObj.setHours(0, 0, 0, 0);
    }

    return {
        initialDate: initialProposedDate,
        finalDate: finalDateTs,
        conflictingOrderId: conflictingOrderId || null,
        totalProductionDays,
    };
  };

  const upcomingAlerts = useMemo(() => orders.filter(o => {
    if (o.status === 'delivered') return false;
    const diff = getDaysDiff(o.deliveryDate);
    return diff >= 0 && diff <= 3;
  }), [orders]);

  const saveBackupFile = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const selectBackupFolder = async () => {
    try {
      if ('showDirectoryPicker' in window) {
        const handle = await (window as any).showDirectoryPicker({
           mode: 'readwrite',
           startIn: 'documents'
        });
        if (handle) {
            const opts = { mode: 'readwrite' };
            if ((await handle.queryPermission(opts)) === 'granted') {
                 setBackupHandle(handle);
                 backupHandleRef.current = handle;
                 addToast("تم تحديد مجلد النسخ الاحتياطي بنجاح.", 'success');
            } else {
                 if ((await handle.requestPermission(opts)) === 'granted') {
                     setBackupHandle(handle);
                     backupHandleRef.current = handle;
                     addToast("تم تحديد مجلد النسخ الاحتياطي بنجاح.", 'success');
                 }
            }
        }
      } else {
        addToast("المتصفح لا يدعم هذه الميزة. سيتم الحفظ في التنزيلات.", 'info');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const triggerAutoBackup = (
    customersData: Customer[],
    ordersData: Order[],
    expensesData: Expense[],
    invoicesData: Invoice[],
    usersData: UserAccount[],
    productsConfigData: Record<string, ProductConfig>,
    backupIntervalData: number
  ) => {
    const backupData = {
      customers: customersData,
      orders: ordersData,
      expenses: expensesData,
      invoices: invoicesData,
      userAccounts: usersData,
      productsConfig: productsConfigData,
      backupInterval: backupIntervalData,
      timestamp: Date.now(),
    };
    const jsonString = JSON.stringify(backupData, null, 2);
    const fileName = `Decora_AutoBackup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

    if (backupHandleRef.current) {
        try {
            const dirHandle = backupHandleRef.current;
            dirHandle.getFileHandle(fileName, { create: true }).then((fileHandle: any) => {
                fileHandle.createWritable().then((writable: any) => {
                    writable.write(jsonString).then(() => {
                        writable.close();
                    });
                });
            }).catch((e: any) => {
                console.error("Custom folder backup failed, falling back to download", e);
                const blob = new Blob([jsonString], { type: 'application/json' });
                saveBackupFile(blob, fileName);
            });
            return; 
        } catch(e) {
            console.error("Custom folder backup failed, falling back to download", e);
        }
    }

    const blob = new Blob([jsonString], { type: 'application/json' });
    saveBackupFile(blob, fileName);
  };

  const writeAutoBackupLatest = async (
    customersData: Customer[],
    ordersData: Order[],
    expensesData: Expense[],
    invoicesData: Invoice[],
    usersData: UserAccount[],
    productsConfigData: Record<string, ProductConfig>,
    backupIntervalData: number
  ) => {
    const backupData = {
      customers: customersData,
      orders: ordersData,
      expenses: expensesData,
      invoices: invoicesData,
      userAccounts: usersData,
      productsConfig: productsConfigData,
      backupInterval: backupIntervalData,
      timestamp: Date.now(),
    };
    const jsonString = JSON.stringify(backupData, null, 2);
    const fileName = `Decora_AutoBackup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

    if (backupHandleRef.current) {
        try {
            const dirHandle = backupHandleRef.current;
            const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(jsonString);
            await writable.close();
            return;
        } catch (e) {
            console.error('Auto write to folder failed, falling back to download', e);
        }
    }

    // fallback: avoid repeated auto-downloads in the same session
    try {
      if (!autoFallbackDownloadedRef.current) {
        const blob = new Blob([jsonString], { type: 'application/json' });
        saveBackupFile(blob, fileName);
        autoFallbackDownloadedRef.current = true;
        try { addToast('تم تنزيل نسخة احتياطية تلقائية (fallback).', 'info'); } catch(e) { /* ignore */ }
      } else {
        console.debug('Auto backup fallback skipped (already downloaded this session).');
      }
    } catch (e) {
      console.error('Auto backup fallback download failed', e);
    }
  };
  
  const handleManualExport = async () => {
    const backupData = { 
        customers, 
        orders, 
        expenses,
        invoices,
        userAccounts, 
        timestamp: Date.now(), 
        productsConfig,
        backupInterval
    };
    const fileName = `Decora_ManualBackup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const jsonString = JSON.stringify(backupData, null, 2);

    try {
      if ('showSaveFilePicker' in window) {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: fileName,
          types: [{
            description: 'JSON Database',
            accept: { 'application/json': ['.json'] },
          }],
        });
        const writable = await handle.createWritable();
        await writable.write(jsonString);
        await writable.close();
        addToast("تم حفظ قاعدة البيانات بنجاح في المسار المحدد.", 'success');
        return;
      }
    } catch (err) {
      console.log("File picker cancelled or failed, falling back to download", err);
    }

    const blob = new Blob([jsonString], { type: 'application/json' });
    saveBackupFile(blob, fileName);
  };

  const createReportHtml = (title: string, ordersToReport: Order[]) => {
    const tableRows = ordersToReport.map((order: Order) => {
      const customer = customers.find((c: Customer) => c.id === order.customerId);
      const prodName = productsConfig[order.productType]?.name || order.productType;
      
      return `
        <tr>
          <td>#${customer?.serialNumber || '---'}</td>
          <td>${customer?.name || '---'}</td>
          <td>${prodName}</td>
          <td>${new Date(order.orderDate).toLocaleDateString('en-GB')}</td>
          <td>${new Date(order.deliveryDate).toLocaleDateString('en-GB')}</td>
          <td>${STATUS_MAP[order.status].label}</td>
        </tr>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800;900&display=swap" rel="stylesheet">
        <style>
          * { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
          body { font-family: 'Tajawal', sans-serif; direction: rtl; text-align: right; margin: 2rem; color: #111827; }
          .container { max-width: 1200px; margin: auto; background: white; padding: 2rem; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); }
          .header { text-align: center; border-bottom: 4px solid #f97316; padding-bottom: 1rem; margin-bottom: 2rem; }
          .header h1 { font-size: 2.5rem; font-weight: 900; color: #0f172a; margin: 0; word-break: keep-all; white-space: normal; }
          .header p { font-size: 1rem; color: #6b7280; margin-top: 0.5rem; word-break: keep-all; }
          table { width: 100%; border-collapse: collapse; font-size: 0.95rem; table-layout: fixed; }
          /* Use thicker borders to avoid "dashed" raster artifacts in PDF */
          th, td { padding: 1rem; border-bottom: 2px solid #e5e7eb; word-wrap: break-word; overflow-wrap: break-word; word-break: break-word; white-space: normal; line-height: 1.6; }
          th { font-weight: 800; text-transform: uppercase; color: #4b5563; background-color: #f3f4f6; }
          td { hyphens: auto; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${title}</h1>
            <p>تاريخ الإصدار: ${new Date().toLocaleDateString('ar-LY', { dateStyle: 'full' })}</p>
          </div>
          <table>
            <thead>
              <tr><th>رقم العميل</th><th>اسم العميل</th><th>المنتج</th><th>تاريخ الطلب</th><th>تاريخ التسليم</th><th>الحالة</th></tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
          ${ordersToReport.length === 0 ? '<p style="text-align:center; padding: 2rem; color: #6b7280;">لا توجد بيانات لعرضها.</p>' : ''}
        </div>
      </body>
      </html>
    `;
  };

  const handleExportReport = () => {
    const activeOrders = orders.filter((o: Order) => o.status !== 'delivered').sort((a: Order, b: Order) => a.deliveryDate - b.deliveryDate);
    const reportHtml = createReportHtml('تقرير ديكورا للمشاريع الحالية', activeOrders);
    const blob = new Blob([reportHtml], { type: 'text/html;charset=utf-8' });
    saveBackupFile(blob, `Decora_ActiveProjects_Report_${new Date().toISOString().split('T')[0]}.html`);
  };

    const handleExportComprehensiveReport = () => {
        const sortedOrders = [...orders].sort((a,b) => b.orderDate - a.orderDate);
        const reportHtml = createReportHtml('تقرير الإنتاج الشامل - ديكورا', sortedOrders);

        const element = document.createElement('div');
        element.innerHTML = reportHtml;
        document.body.appendChild(element);

        const opt = {
            margin: 0.5,
            filename: `Decora_Comprehensive_Production_Report_${new Date().toISOString().split('T')[0]}.pdf`,
            // PNG + higher scale reduces "dashed" / dotted artifacts in text & 1px borders
            image: { type: 'png' as const, quality: 1 },
            html2canvas: { 
                scale: 3, 
                useCORS: true,
                letterRendering: true,
                logging: false,
                allowTaint: false,
                backgroundColor: '#ffffff'
            },
            jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' as const }
        };

        html2pdf().from(element).set(opt).save().then(() => {
            document.body.removeChild(element);
        });
    };
    
    const handlePrintFinancialReport = (range: 'month' | 'all') => {
        setModals(m => ({...m, financialReport: {isOpen: false, range}}));
        // Logic to generate and print the report
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        
        const filteredInvoices = range === 'month' 
            ? invoices.filter(i => new Date(i.issueDate) >= firstDayOfMonth) 
            : invoices;
            
        const filteredExpenses = range === 'month'
            ? expenses.filter(e => new Date(e.date) >= firstDayOfMonth)
            : expenses;

        const reportTitle = range === 'month' 
            ? `التقرير المالي لشهر ${now.toLocaleString('ar-LY', {month: 'long'})} ${now.getFullYear()}` 
            : 'التقرير المالي الشامل';

        // Use a new creation function
        const reportHtml = createFinancialReportHtml(reportTitle, filteredInvoices, filteredExpenses);
        
        const element = document.createElement('div');
        element.innerHTML = reportHtml;
        document.body.appendChild(element);

        const opt = {
            margin: 0.5,
            filename: `Decora_Financial_Report_${new Date().toISOString().split('T')[0]}.pdf`,
            image: { type: 'png' as const, quality: 1 },
            html2canvas: { 
                scale: 3, 
                useCORS: true,
                letterRendering: true,
                logging: false,
                allowTaint: false,
                backgroundColor: '#ffffff'
            },
            jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' as const }
        };
        html2pdf().from(element).set(opt).save().then(() => {
          document.body.removeChild(element);
        });
    };
    
    const createFinancialReportHtml = (title: string, reportInvoices: Invoice[], reportExpenses: Expense[]) => {
      const totalRevenue = reportInvoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.totalAmount, 0);
      const totalExpenses = reportExpenses.reduce((sum, e) => sum + e.amount, 0);
      const netProfit = totalRevenue - totalExpenses;

      const invoicesRows = reportInvoices.map(inv => {
        const customer = customers.find(c => c.id === inv.customerId);
        return `<tr>
          <td>#${inv.invoiceNumber}</td>
          <td>${customer?.name || '---'}</td>
          <td>${new Date(inv.issueDate).toLocaleDateString('en-GB')}</td>
          <td>${formatCurrency(inv.totalAmount)}</td>
          <td><span class="status-${inv.status}">${INVOICE_STATUS_MAP[inv.status].label}</span></td>
        </tr>`;
      }).join('');
      
       const expensesRows = reportExpenses.map(exp => {
        return `<tr>
          <td>${exp.description}</td>
          <td>${EXPENSE_CATEGORY_MAP[exp.category].label}</td>
          <td>${new Date(exp.date).toLocaleDateString('en-GB')}</td>
          <td>${formatCurrency(exp.amount)}</td>
        </tr>`;
      }).join('');

      return `
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
          <meta charset="UTF-8"><title>${title}</title>
          <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;900&display=swap" rel="stylesheet">
          <style>
            * { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
            body { font-family: 'Tajawal', sans-serif; direction: rtl; text-align: right; color: #111827; }
            .page { padding: 2.5cm 2cm; }
            .header { text-align: center; border-bottom: 4px solid #f97316; padding-bottom: 1rem; margin-bottom: 2rem; }
            .header h1 { font-size: 2.2rem; font-weight: 900; color: #0f172a; margin: 0; word-break: keep-all; white-space: normal; }
            .header p { color: #6b7280; margin-top: 0.5rem; word-break: keep-all; }
            h2 { font-size: 1.5rem; font-weight: 900; color: #0f172a; margin-top: 2rem; margin-bottom: 1rem; border-right: 4px solid #f97316; padding-right: 0.75rem; word-break: keep-all; }
            table { width: 100%; border-collapse: collapse; font-size: 0.9rem; table-layout: fixed; }
            th, td { padding: 0.75rem; border: 2px solid #e5e7eb; word-wrap: break-word; overflow-wrap: break-word; word-break: break-word; white-space: normal; line-height: 1.6; }
            th { font-weight: 700; background-color: #f3f4f6; }
            td { hyphens: auto; }
            .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2rem; }
            .summary-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 1rem; text-align: center; }
            .summary-card p { margin: 0; font-size: 0.8rem; font-weight: 700; color: #6b7280; word-break: keep-all; }
            .summary-card span { font-size: 1.75rem; font-weight: 900; color: #111827; word-break: keep-all; }
            .status-paid { color: #059669; font-weight: 700; }
            .status-due { color: #2563eb; font-weight: 700; }
            .status-overdue { color: #dc2626; font-weight: 700; }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="header"><h1>${title}</h1><p>تاريخ الإصدار: ${new Date().toLocaleDateString('ar-LY', { dateStyle: 'full' })}</p></div>
            <div class="summary">
              <div class="summary-card"><p>إجمالي الإيرادات</p><span style="color:#059669;">${formatCurrency(totalRevenue)}</span></div>
              <div class="summary-card"><p>إجمالي المصروفات</p><span style="color:#dc2626;">${formatCurrency(totalExpenses)}</span></div>
              <div class="summary-card"><p>صافي الربح</p><span style="color:#2563eb;">${formatCurrency(netProfit)}</span></div>
            </div>
            <h2>الفواتير</h2>
            <table><thead><tr><th>رقم الفاتورة</th><th>العميل</th><th>تاريخ الإصدار</th><th>المبلغ</th><th>الحالة</th></tr></thead><tbody>${invoicesRows || '<tr><td colspan="5" style="text-align:center;">لا توجد فواتير</td></tr>'}</tbody></table>
            <h2>المصروفات</h2>
            <table><thead><tr><th>الوصف</th><th>الفئة</th><th>التاريخ</th><th>المبلغ</th></tr></thead><tbody>${expensesRows || '<tr><td colspan="4" style="text-align:center;">لا توجد مصروفات</td></tr>'}</tbody></table>
          </div>
        </body>
        </html>`;
    };


  const handleCloseConfirm = () => {
    setConfirmationModal({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  };

  const handleOpenOrderDeleteConfirm = (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    const customer = customers.find(c => c.id === order.customerId);
    setConfirmationModal({
      isOpen: true,
      title: 'تأكيد حذف المشروع',
      message: `هل أنت متأكد من رغبتك في حذف مشروع العميل "${customer?.name || 'غير معروف'}" بشكل نهائي؟ لا يمكن التراجع عن هذا الإجراء.`,
      onConfirm: () => {
        setOrders(prev => prev.filter(o => o.id !== orderId));
        setInvoices(prev => prev.filter(inv => inv.orderId !== orderId));
        handleCloseConfirm();
        addToast('تم حذف المشروع بنجاح.', 'success');
      },
    });
  };

  const handleOpenCustomerDeleteConfirm = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    const hasOrders = orders.some(o => o.customerId === customerId);
    if (hasOrders) {
        addToast(`لا يمكن حذف العميل "${customer.name}" لوجود مشاريع مرتبطة به.`, 'error');
        return;
    }

    setConfirmationModal({
        isOpen: true,
        title: 'تأكيد حذف العميل',
        message: `هل أنت متأكد من رغبتك في حذف ملف العميل "${customer.name}" بشكل نهائي؟ سيتم حذف جميع بياناته.`,
        onConfirm: () => {
            setCustomers(prev => prev.filter(c => c.id !== customerId));
            handleCloseConfirm();
            addToast('تم حذف العميل بنجاح.', 'success');
        },
    });
  };


  useEffect(() => {
    const saved = {
      cust: localStorage.getItem('decora_customers'),
      ord: localStorage.getItem('decora_orders'),
      exp: localStorage.getItem('decora_expenses'),
      inv: localStorage.getItem('decora_invoices'),
      receipts: localStorage.getItem('decora_payment_receipts'),
      users: localStorage.getItem('decora_users'),
      logged: localStorage.getItem('decora_logged_user'),
      prodConfig: localStorage.getItem('decora_products_config')
    };
    try {
      console.log('[decora] loaded localStorage summary:', {
        url: location.href,
        cust: saved.cust ? saved.cust.length : 0,
        ord: saved.ord ? saved.ord.length : 0,
        exp: saved.exp ? saved.exp.length : 0,
        inv: saved.inv ? saved.inv.length : 0,
        users: saved.users ? saved.users.length : 0,
        prodConfig: saved.prodConfig ? saved.prodConfig.length : 0,
        logged: saved.logged ? true : false,
      });
      if (saved.ord) console.log('[decora] orders sample:', (saved.ord || '').slice(0, 300));
    } catch (e) { console.warn('[decora] failed to log loaded storage', e); }
    if (saved.cust) setCustomers(JSON.parse(saved.cust) as Customer[]);
    
    if (saved.ord) {
      let loadedOrders: Order[] = JSON.parse(saved.ord) as Order[];
      loadedOrders.forEach((order: Order) => {
        const totalPoints = (order as any).totalPoints;
        if (totalPoints !== undefined) {
          order.totalProductionDays = Math.ceil(Number(totalPoints as any) / 1.5) || 1;
          delete (order as any).totalPoints;
        }
        // Migration: remove old deposit fields if they exist
        if ('depositPaid' in order) delete (order as any).depositPaid;
        if ('depositAmount' in order) delete (order as any).depositAmount;

      });
      setOrders(loadedOrders);
    }
    
    if (saved.exp) setExpenses(JSON.parse(saved.exp) as Expense[]);
    if (saved.inv) setInvoices(JSON.parse(saved.inv) as Invoice[]);
    if (saved.receipts) setPaymentReceipts(JSON.parse(saved.receipts) as PaymentReceipt[]);

    let loadedConfig: Record<string, ProductConfig> = saved.prodConfig ? JSON.parse(saved.prodConfig) as Record<string, ProductConfig> : DEFAULT_PRODUCTS_CONFIG;
    Object.keys(loadedConfig).forEach(key => {
        const points = (loadedConfig[key] as any).points;
        if (points !== undefined) {
            loadedConfig[key].productionDays = Math.ceil(Number(points as any) / 1.5) || 1;
            delete (loadedConfig[key] as any).points;
        }
    });
    setProductsConfig(loadedConfig);

    if (saved.users) {
      const parsedUsers = JSON.parse(saved.users) as UserAccount[];
      const hasAdmin = parsedUsers.some(u => u.username === 'admin');
      if (!hasAdmin) {
        const adminDefault: UserAccount = { id: 'admin-1', username: 'admin', password: '123', role: 'admin', isActive: true };
        parsedUsers.push(adminDefault);
        try { localStorage.setItem('decora_users', JSON.stringify(parsedUsers)); } catch (e) { /* ignore */ }
      }
      setUserAccounts(parsedUsers);
    } else setUserAccounts([
        { id: 'admin-1', username: 'admin', password: '123', role: 'admin', isActive: true },
        { id: 'user-1', username: 'user', password: '123', role: 'user', isActive: true }
    ]);
    if (saved.logged) setCurrentUser(JSON.parse(saved.logged) as UserAccount);
    isInitialMount.current = false;
  }, []);

  // Temporary developer auto-login. Set AUTO_LOGIN to false to disable.
  useEffect(() => {
    const AUTO_LOGIN = false;
    if (!currentUser && AUTO_LOGIN) {
      const admin = userAccounts.find(u => u.username === 'admin');
      if (admin && admin.isActive) {
        setCurrentUser(admin);
        localStorage.setItem('decora_logged_user', JSON.stringify(admin));
        addToast('تم تسجيل الدخول تلقائياً كمطور (admin)', 'info');
      }
    }
  }, [userAccounts, currentUser]);

  useEffect(() => {
    dataRef.current = { customers, orders, expenses, invoices, paymentReceipts, userAccounts, productsConfig, backupInterval, companyLogo };
    if (!isInitialMount.current) {
      writeLocal('decora_customers', JSON.stringify(customers));
      writeLocal('decora_orders', JSON.stringify(orders));
      writeLocal('decora_expenses', JSON.stringify(expenses));
      writeLocal('decora_invoices', JSON.stringify(invoices));
      writeLocal('decora_payment_receipts', JSON.stringify(paymentReceipts));
      writeLocal('decora_users', JSON.stringify(userAccounts));
      writeLocal('decora_products_config', JSON.stringify(productsConfig));
      if (companyLogo) writeLocal('decora_logo', companyLogo);
      if (currentUser) writeLocal('decora_logged_user', JSON.stringify(currentUser));
      else localStorage.removeItem('decora_logged_user');
    }
  }, [customers, orders, expenses, invoices, paymentReceipts, userAccounts, currentUser, productsConfig, backupInterval]);

  // Auto-save latest JSON to selected folder (debounced) — trigger only on important data changes
  useEffect(() => {
    if (!autoBackupEnabled) return;
    const timer = setTimeout(() => {
      const { customers: c, orders: o, expenses: ex, invoices: iv, userAccounts: u, productsConfig: p, backupInterval: bi } = dataRef.current;
      writeAutoBackupLatest(c, o, ex, iv, u, p, bi);
    }, 1200);
    return () => clearTimeout(timer);
  }, [customers, orders, autoBackupEnabled]);

  useEffect(() => {
    if (backupInterval <= 0) return;
    const intervalId = setInterval(() => {
        const { customers, orders, expenses, invoices, userAccounts, productsConfig, backupInterval } = dataRef.current;
        triggerAutoBackup(customers, orders, expenses, invoices, userAccounts, productsConfig, backupInterval);
    }, backupInterval * 60 * 1000);
    return () => clearInterval(intervalId);
  }, [backupInterval]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const user = userAccounts.find(u => u.username === loginForm.username && u.password === loginForm.password);
    if (user) {
      if (!user.isActive) {
        setAuthError('عذراً، هذا الحساب معطل حالياً من قبل الإدارة.');
        return;
      }
      setCurrentUser(user);
      setAuthError('');
      setLoginForm({ username: '', password: '' });
    } else {
      setAuthError('بيانات الدخول غير صحيحة.');
    }
  };
  
  const handleChangePassword = (userId: string, newPassword: string, currentPassword?: string) => {
    const targetUser = userAccounts.find(u => u.id === userId);
    if (!targetUser) return;
    if (currentPassword !== undefined && targetUser.password !== currentPassword) {
        setPasswordError('كلمة السر الحالية غير صحيحة.');
        return;
    }
    const updatedAccounts = userAccounts.map(u => u.id === userId ? { ...u, password: newPassword } : u);
    setUserAccounts(updatedAccounts);
    if (currentUser?.id === userId) setCurrentUser({ ...currentUser, password: newPassword });
    setModals(m => ({ ...m, changePassword: { isOpen: false, user: null }}));
    addToast('تم تغيير كلمة السر بنجاح.', 'success');
  };

  const openPasswordModal = (user: UserAccount) => {
    setPasswordForm({ current: '', new: '', confirm: '' });
    setPasswordError('');
    setModals(m => ({ ...m, changePassword: { isOpen: true, user } }));
  };
  
  const handleOpenWhatsAppModal = (customer: Customer) => {
    setModals(m => ({ ...m, whatsappTemplates: { isOpen: true, customer }}));
  };

  const openInvoiceModal = (invoice: Invoice) => {
    setModals(m => ({ ...m, invoice: { isOpen: true, invoice } }));
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const user = modals.changePassword.user as UserAccount;
      if (!user) return;
      if (passwordForm.new.length < 3) {
          setPasswordError('يجب أن تكون كلمة السر الجديدة 3 أحرف على الأقل.');
          return;
      }
      if (user.id === currentUser?.id) {
          if (passwordForm.new !== passwordForm.confirm) {
              setPasswordError('كلمتا السر الجديدتان غير متطابقتين.');
              return;
          }
          handleChangePassword(user.id, passwordForm.new, passwordForm.current);
      } else handleChangePassword(user.id, passwordForm.new);
  };
  
    const handleDelayedDateChange = (orderId: string, newDateStr: string) => {
        if (!newDateStr) return;

        const parts = newDateStr.split('-');
        const newDate = new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));

        setDelayedOrdersData(prev => prev.map(item => 
            item.order.id === orderId ? { ...item, newDate: newDate.getTime() } : item
        ));

        const conflictingOrder = orders.find(o => {
          if (o.id === orderId || o.status === 'delivered') return false;
          const orderDate = new Date(o.deliveryDate);
          orderDate.setUTCHours(0,0,0,0);
          return orderDate.getTime() === newDate.getTime();
        });

        setDelayedOrdersConflicts(prev => ({
            ...prev,
            [orderId]: conflictingOrder 
                ? `متعارض مع مشروع: ${customers.find(c => c.id === conflictingOrder.customerId)?.name}`
                : null
        }));
    };

    const handleOpenDelayedModal = () => {
        const delayed = orders.filter(o => o.status !== 'delivered' && getDaysDiff(o.deliveryDate) < 0);
        const conflicts: Record<string, string | null> = {};
        const data = delayed.map(order => {
            const customer = customers.find(c => c.id === order.customerId)!;
            const productsInOrder = order.productType.split(',').reduce((acc, part) => {
                const match = part.match(/(.+) \(x(\d+)\)/);
                if (match) {
                    const prodName = match[1].trim();
                    const qty = parseInt(match[2]);
                    const configEntry = (Object.values(productsConfig) as ProductConfig[]).find((p: ProductConfig) => p.name === prodName);
                    if (configEntry) acc[configEntry.id] = qty;
                } else {
                    const prodName = part.trim();
                    const configEntry = (Object.values(productsConfig) as ProductConfig[]).find((p: ProductConfig) => p.name === prodName);
                    if (configEntry) acc[configEntry.id] = 1;
                }
                return acc;
            }, {} as Record<string, number>);

            const suggestion = getSuggestedDeliveryDate(productsInOrder, order.id);
            const newDateTs = suggestion ? suggestion.finalDate : addWorkingDays(Date.now(), 4);

            const newDateObj = new Date(newDateTs);
            newDateObj.setUTCHours(0, 0, 0, 0);

            const conflictingOrder = orders.find(o => {
                if (o.id === order.id || o.status === 'delivered') return false;
                const orderDate = new Date(o.deliveryDate);
                orderDate.setUTCHours(0,0,0,0);
                return orderDate.getTime() === newDateObj.getTime();
            });

            if (conflictingOrder) {
                conflicts[order.id] = `متعارض مع مشروع: ${customers.find(c => c.id === conflictingOrder.customerId)?.name}`;
            } else {
                conflicts[order.id] = null;
            }

            return {
                order,
                customer,
                newDate: newDateTs
            };
        });
        setDelayedOrdersData(data);
        setDelayedOrdersConflicts(conflicts);
        setIsDelayedModalOpen(true);
    };

  
  const handleNotifyAndReschedule = (order: Order, customer: Customer, newDate: number) => {
      setOrders(prev => prev.map(o => o.id === order.id ? {...o, deliveryDate: newDate, isRescheduled: true } : o));
      
      const newDateString = new Date(newDate).toLocaleDateString('ar-LY', { dateStyle: 'long' });
      const message = `مرحباً ${customer.name}، معكم مصنع ديكورا. نود الاعتذار عن تأخير غير متوقع في تسليم مشروعكم. نعمل بكل جهد لإكماله بأعلى جودة. الموعد الجديد المقترح للتسليم هو ${newDateString}. نقدر تفهمكم وصبركم.`;
      
      let phone = customer.phone.replace(/\D/g, '');
      if (phone.startsWith('09')) {
          phone = '218' + phone.substring(1);
      } else if (phone.startsWith('9') && phone.length === 9) {
          phone = '218' + phone;
      }
      const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
      
      setDelayedOrdersData(prev => prev.filter(item => item.order.id !== order.id));
       if (delayedOrdersData.length <= 1) {
        setIsDelayedModalOpen(false);
      }
  };


  const handleAddUserAccount = (newUser: { username: string; password: string; role: UserRole; }) => {
    if (userAccounts.some((u) => u.username === newUser.username)) {
      addToast("اسم المستخدم موجود مسبقاً", 'error');
      return false;
    }
    const createdUser: UserAccount = { id: generateUniqueId(), ...newUser, isActive: true };
    setUserAccounts([...userAccounts, createdUser]);
    addToast("تم إنشاء حساب الموظف بنجاح.", 'success');
    return true;
  };
  
  const handleToggleUserStatus = (userId: string) => {
    const updated = userAccounts.map((u: UserAccount) => 
      (u.id === userId && u.username !== 'admin') ? { ...u, isActive: !u.isActive } : u
    );
    setUserAccounts(updated);
  };

  const handleDeleteUser = (userId: string) => {
    const user = userAccounts.find((u: UserAccount) => u.id === userId);
    if (user?.username === 'admin') return;
    if (confirm(`هل أنت متأكد من حذف حساب ${user?.username}؟`)) {
      setUserAccounts(userAccounts.filter((u: UserAccount) => u.id !== userId));
    }
  };

  const handleChangeUserRole = (userId: string) => {
    const updated = userAccounts.map((u: UserAccount) => 
      (u.id === userId && u.username !== 'admin') ? { ...u, role: u.role === 'admin' ? 'user' : 'admin' as UserRole } : u
    );
    setUserAccounts(updated);
  };

  const handleAddCustomer = (name: string, phone: string, address: string) => {
    const lastSerial = customers.reduce((max, c) => Math.max(max, c.serialNumber || 0), 0);
    const newCust: Customer = { id: generateUniqueId(), serialNumber: lastSerial + 1, name, phone, address, createdAt: Date.now() };
    setCustomers([newCust, ...customers].sort((a,b) => b.createdAt - a.createdAt));
    return newCust;
  };

  const handleAddOrder = (customerId: string, productType: string, deliveryDate: number, totalProductionDays: number) => {
    const newOrder: Order = { 
        id: generateUniqueId(), customerId, productType, orderDate: Date.now(), deliveryDate, status: 'manufacturing', totalProductionDays, price: 0, paidAmount: 0
    };
    setOrders(prevOrders => [newOrder, ...prevOrders]);
    addToast("تم تسجيل أمر العمل. يمكنك الآن إصدار فاتورة من قسم المحاسبة.", "success");
    setActiveTab('accounting');
  };

  const handleEditProduct = (id: string) => {
    setProductForm({ ...productsConfig[id] });
    setModals(m => ({ ...m, editProduct: { isOpen: true, productId: id, isNew: false } }));
  };

  const handleAddProduct = () => {
      setProductForm({ name: '', productionDays: 7, color: 'orange', iconKey: 'Package' });
      setModals(m => ({ ...m, editProduct: { isOpen: true, productId: null, isNew: true } }));
  };

  const saveProductChanges = () => {
    const { productId, isNew } = modals.editProduct;
    const form = productForm as ProductConfig;
    if (isNew) {
        const newId = 'prod_' + generateUniqueId();
        setProductsConfig(prev => ({ ...prev, [newId]: { id: newId, name: form.name || 'منتج جديد', productionDays: form.productionDays || 0, color: form.color || 'orange', iconKey: form.iconKey || 'Package' } }));
    } else if (productId) {
        setProductsConfig(prev => ({ ...prev, [productId]: { ...prev[productId], name: form.name, productionDays: form.productionDays, color: form.color, iconKey: form.iconKey } }));
    }
    // FIX: Corrected setModals call to properly update the nested editProduct property
    setModals(m => ({ ...m, editProduct: { isOpen: false, productId: null } }));
  };

  const openRescheduleModal = (order: Order) => {
    const date = new Date(order.deliveryDate);
    const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
    setRescheduleDate(localDate.toISOString().split('T')[0]); 
    setRescheduleConflict(null);
    
    const productsInOrder = order.productType.split(',').reduce((acc, part) => {
        const match = part.match(/(.+) \(x(\d+)\)/);
        if (match) {
            const prodName = match[1].trim();
            const qty = parseInt(match[2]);
            const configEntry = (Object.values(productsConfig) as ProductConfig[]).find((p: ProductConfig) => p.name === prodName);
            if (configEntry) acc[configEntry.id] = qty;
        } else {
            const prodName = part.trim();
            const configEntry = (Object.values(productsConfig) as ProductConfig[]).find((p: ProductConfig) => p.name === prodName);
            if (configEntry) acc[configEntry.id] = 1;
        }
        return acc;
    }, {} as Record<string, number>);

    const suggestion = getSuggestedDeliveryDate(productsInOrder, order.id);
    setModals(m => ({ ...m, rescheduleOrder: { isOpen: true, order, suggestedDate: suggestion?.finalDate } }));
  };

  const handleRescheduleOrder = () => {
    const { order } = modals.rescheduleOrder;
    if (!order || !rescheduleDate || rescheduleConflict) return;

    const parts = rescheduleDate.split('-');
    const newDeliveryDate = new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));

    setOrders(orders.map(o => o.id === order.id ? { ...o, deliveryDate: newDeliveryDate.getTime(), isRescheduled: true } : o));
    
    // FIX: Corrected setModals call to properly update the nested rescheduleOrder property
    setModals(m => ({ ...m, rescheduleOrder: { isOpen: false, order: null }}));
  };

  const checkRescheduleConflict = (dateStr: string, orderIdToExclude: string) => {
    const parts = dateStr.split('-');
    const targetDate = new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
    
    const conflictingOrder = orders.find(o => {
      if (o.id === orderIdToExclude || o.status === 'delivered') return false;
      const orderDate = new Date(o.deliveryDate);
      return orderDate.getUTCFullYear() === targetDate.getUTCFullYear() &&
             orderDate.getUTCMonth() === targetDate.getUTCMonth() &&
             orderDate.getUTCDate() === targetDate.getUTCDate();
    });

    if (conflictingOrder) {
        const customer = customers.find(c => c.id === conflictingOrder.customerId);
        setRescheduleConflict(`تاريخ متعارض مع مشروع العميل: ${customer?.name || 'غير معروف'}`);
    } else {
        setRescheduleConflict(null);
    }
  };

  const handleDropOnCalendar = (orderId: string, newDate: Date) => {
    const year = newDate.getFullYear();
    const month = newDate.getMonth();
    const day = newDate.getDate();

    const newDeliveryDateTs = Date.UTC(year, month, day);

    const conflictingOrder = orders.find(o => {
        if (o.id === orderId || o.status === 'delivered') return false;
        const orderDate = new Date(o.deliveryDate);
        return orderDate.getUTCFullYear() === year &&
               orderDate.getUTCMonth() === month &&
               orderDate.getUTCDate() === day;
    });

    if (conflictingOrder) {
        const customer = customers.find(c => c.id === conflictingOrder.customerId);
        addToast(`لا يمكن نقل المشروع. هذا اليوم محجوز لمشروع العميل: ${customer?.name}`, 'error');
        return;
    }
    
    setOrders(orders.map(o => o.id === orderId ? { ...o, deliveryDate: newDeliveryDateTs, isRescheduled: true } : o));
  };
  
  const handleSaveEditedOrder = () => {
    if (editedOrder) {
      setOrders(orders.map(o => o.id === editedOrder.id ? editedOrder : o));
      setModals(m => ({...m, editOrder: {isOpen: false, order: null}}));
      setEditedOrder(null);
      addToast("تم تحديث المشروع بنجاح", "success");
    }
  }

  if (!currentUser) {
    return (
      <div className="h-screen w-full flex bg-slate-900">
        <div className="hidden lg:flex w-1/2 h-full bg-cover bg-center relative" style={{backgroundImage: "url('https://images.unsplash.com/photo-1556911220-bff31c812dba?q=80&w=1920&auto=format&fit=crop')"}}>
            <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"></div>
            <div className="relative z-10 p-16 flex flex-col justify-between h-full">
                <div>
                    <div className="flex items-center gap-4">
                        <Logo size={28} rotation="-rotate-6" />
                        <h1 className="text-4xl font-black tracking-tighter text-white">ديكورا</h1>
                    </div>
                    <p className="text-white/70 font-bold mt-4 max-w-md leading-relaxed">
                        نظام الإدارة الصناعي الفاخر.
                        <br/>
                        حيث الدقة تلتقي بالإبداع.
                    </p>
                </div>
                <p className="text-white/30 text-xs font-bold">© {new Date().getFullYear()} Decora Factory. All rights reserved.</p>
            </div>
        </div>

        <div className="w-full lg:w-1/2 h-full flex items-center justify-center p-8 lg:p-16 bg-slate-950 lg:bg-transparent">
            <div className="max-w-md w-full space-y-8 animate-slide-in">
                <div className="text-center lg:text-right">
                    <h2 className="text-4xl lg:text-5xl font-black text-white tracking-tighter">أهلاً بعودتك</h2>
                    <p className="text-slate-400 font-bold mt-2">يرجى تسجيل الدخول للمتابعة إلى لوحة التحكم</p>
                </div>
                <form onSubmit={handleLogin} className="space-y-6">
                    <div className="relative group">
                        <User className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-orange-500 transition-colors z-10" size={24}/>
                        <input 
                            type="text" 
                            value={loginForm.username} 
                            onChange={e => setLoginForm({...loginForm, username: e.target.value})} 
                            placeholder="اسم المستخدم" 
                            className="w-full bg-slate-800/50 border-2 border-slate-700 rounded-2xl h-20 pr-16 pl-6 text-white text-xl font-bold outline-none focus:border-orange-600 focus:bg-slate-800 transition-all" required 
                        />
                    </div>
                    <div className="relative group">
                        <Lock className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-orange-500 transition-colors z-10" size={24}/>
                        <input 
                            type="password" 
                            value={loginForm.password} 
                            onChange={e => setLoginForm({...loginForm, password: e.target.value})} 
                            placeholder="كلمة المرور" 
                            className="w-full bg-slate-800/50 border-2 border-slate-700 rounded-2xl h-20 pr-16 pl-6 text-white text-xl font-bold outline-none focus:border-orange-600 focus:bg-slate-800 transition-all" required 
                        />
                    </div>
                    
                    {authError && 
                        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-bold p-4 rounded-xl flex items-center gap-3">
                            <AlertTriangle size={18}/>
                            <span>{authError}</span>
                        </div>
                    }

                    <button type="submit" className="w-full bg-orange-600 text-white h-20 rounded-2xl font-black text-2xl shadow-2xl shadow-orange-900/50 flex items-center justify-center gap-4
                        hover:bg-orange-500 transition-all transform hover:-translate-y-1 active:translate-y-0.5">
                        <span>تسجيل الدخول</span>
                        <ArrowLeft size={28} />
                    </button>
                </form>
            </div>
        </div>
      </div>
    );
  }

  const ConfirmationModal: React.FC<{
      isOpen: boolean;
      title: string;
      message: string;
      onConfirm: () => void;
      onClose: () => void;
    }> = ({ isOpen, title, message, onConfirm, onClose }) => {
      if (!isOpen) return null;

      return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm animate-in no-print">
          <div className="bg-white rounded-[32px] shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-8 text-center">
                <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-red-100">
                    <AlertTriangle size={40} className="text-red-500" />
                </div>
                <h3 className="font-black text-2xl text-slate-900 mb-2">{title}</h3>
                <p className="text-slate-500 font-bold leading-relaxed">{message}</p>
            </div>
            <div className="p-6 bg-slate-50 grid grid-cols-2 gap-4">
                <button onClick={onClose} className="w-full bg-slate-200 text-slate-800 py-4 rounded-2xl font-black transition-all hover:bg-slate-300">
                    إلغاء
                </button>
                <button onClick={onConfirm} className="w-full bg-red-600 text-white py-4 rounded-2xl font-black shadow-lg shadow-red-500/30 transition-all hover:bg-red-700">
                    تأكيد الحذف
                </button>
            </div>
          </div>
        </div>
      );
    };

  const InvoiceViewModal: React.FC<{
    isOpen: boolean;
    invoice: Invoice | null;
    order: Order | null;
    customer: Customer | null;
    onClose: () => void;
    companyLogo: string | null;
    onLogoChange: (logo: string | null) => void;
    addToast: (message: string, type: 'success' | 'error' | 'info') => void;
  }> = ({ isOpen, invoice, order, customer, onClose, companyLogo, onLogoChange, addToast }) => {
      const invoiceRef = useRef<HTMLDivElement>(null);
      if (!isOpen || !invoice || !order || !customer) return null;

      const remainingBalance = (order.price || 0) - (order.paidAmount || 0);

    const buildPrintableHtml = () => {
        const element = invoiceRef.current;
        if (!element) return '';
        return `
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
            <head>
                <meta charset="UTF-8">
                <title>فاتورة #${invoice.invoiceNumber}</title>
                <link rel="preconnect" href="https://fonts.googleapis.com">
                <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                <link rel="preconnect" href="https://fonts.googleapis.com">
                <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
                <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
                <style>
                    @font-face {
                        font-family: 'Tajawal';
                        font-style: normal;
                        font-weight: 300 900;
                        font-display: swap;
                        src: url('https://fonts.gstatic.com/s/tajawal/v13/Iurf6YBj_oCad4k1l_6gLrZjiLlJ-G0.woff2') format('woff2');
                        unicode-range: U+0600-06FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE80-FEFC;
                    }
                    * { 
                        margin: 0; 
                        padding: 0; 
                        box-sizing: border-box; 
                        -webkit-font-smoothing: antialiased;
                        -moz-osx-font-smoothing: grayscale;
                        text-rendering: optimizeLegibility;
                    }
                    html, body { 
                        font-family: 'Tajawal', 'Arial Unicode MS', 'DejaVu Sans', Arial, sans-serif !important; 
                        direction: rtl;
                        width: 100%;
                        height: 100%;
                    }
                    body {
                        background: #fff;
                        font-smooth: always;
                        text-rendering: optimizeLegibility;
                        font-kerning: normal;
                        font-variant-ligatures: common-ligatures;
                    }
                    #invoice-content, #invoice-content * {
                        text-rendering: geometricPrecision !important;
                        -webkit-font-smoothing: antialiased !important;
                        -moz-osx-font-smoothing: grayscale !important;
                        font-feature-settings: "liga" 1, "kern" 1, "calt" 1 !important;
                        font-kerning: normal !important;
                        font-variant-ligatures: common-ligatures !important;
                        shape-rendering: geometricPrecision !important;
                    }
                    #invoice-content span, #invoice-content div, #invoice-content p, #invoice-content td, #invoice-content th {
                        text-rendering: geometricPrecision !important;
                        font-smooth: always !important;
                        word-wrap: break-word !important;
                        overflow-wrap: break-word !important;
                        word-break: break-word !important;
                        white-space: normal !important;
                        line-height: 1.6 !important;
                    }
                    #invoice-content table {
                        table-layout: fixed !important;
                    }
                    #invoice-content td, #invoice-content th {
                        hyphens: auto !important;
                    }
                    #invoice-content {
                        width: 100%;
                        max-width: 190mm;
                        margin: 0 auto;
                        padding: 8mm !important;
                        background: #fff;
                        display: flex;
                        flex-direction: column;
                        justify-content: space-between;
                        min-height: 277mm;
                        max-height: 277mm;
                        overflow: hidden;
                    }
                    table {
                        width: 100% !important;
                    }
                    @page {
                        size: A4 portrait;
                        margin: 10mm;
                    }
                    @media print {
                        html, body { 
                            -webkit-print-color-adjust: exact !important; 
                            print-color-adjust: exact !important;
                            color-adjust: exact !important;
                            margin: 0 !important;
                            padding: 0 !important;
                            width: 210mm !important;
                            height: 297mm !important;
                        }
                        #invoice-content {
                            max-width: 190mm !important;
                            min-height: 277mm !important;
                            max-height: 277mm !important;
                            padding: 8mm !important;
                            page-break-inside: avoid !important;
                            display: flex !important;
                            flex-direction: column !important;
                            justify-content: space-between !important;
                            overflow: hidden !important;
                            font-family: 'Tajawal', 'Arial Unicode MS', 'DejaVu Sans', Arial, sans-serif !important;
                        }
                        #invoice-content * {
                            font-family: 'Tajawal', 'Arial Unicode MS', 'DejaVu Sans', Arial, sans-serif !important;
                            text-rendering: optimizeLegibility !important;
                            -webkit-font-smoothing: antialiased !important;
                            -moz-osx-font-smoothing: grayscale !important;
                        }
                        #invoice-content span, #invoice-content div, #invoice-content p, #invoice-content td, #invoice-content th {
                            word-wrap: break-word !important;
                            overflow-wrap: break-word !important;
                            word-break: break-word !important;
                            white-space: normal !important;
                            line-height: 1.6 !important;
                        }
                        #invoice-content table {
                            table-layout: fixed !important;
                        }
                        #invoice-content td, #invoice-content th {
                            hyphens: auto !important;
                        }
                        /* Hide everything except invoice content */
                        body > *:not(#invoice-content) {
                            display: none !important;
                        }
                    }
                </style>
            </head>
            <body>
                ${element.outerHTML}
            </body>
            </html>
        `;
    };

    const handleExportPdf = () => {
        const html = buildPrintableHtml();
        if (!html) return;
        
        // Create a new window for printing
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            addToast('يرجى السماح بالنوافذ المنبثقة لتصدير PDF', 'error');
            return;
        }

        printWindow.document.write(html);
        printWindow.document.close();

        // Wait for fonts and content to load completely
        const printDocument = async () => {
            try {
                // Wait for document to be ready
                if (printWindow.document.readyState !== 'complete') {
                    await new Promise((resolve) => {
                        printWindow.onload = resolve;
                        setTimeout(resolve, 1000);
                    });
                }

                // Wait for fonts to load
                if (printWindow.document.fonts && printWindow.document.fonts.ready) {
                    await printWindow.document.fonts.ready;
                    await new Promise(res => setTimeout(res, 500));
                } else {
                    await new Promise(res => setTimeout(res, 1000));
                }

                // Trigger print dialog - user can save as PDF
                printWindow.print();
            } catch (error) {
                console.error('Print error:', error);
                addToast('حدث خطأ أثناء فتح نافذة الطباعة', 'error');
            }
        };

        // Start printing after a short delay to ensure content is rendered
        setTimeout(printDocument, 500);
    };

      return (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-in no-print">
              <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[90vh]">
                  <div className="p-4 sm:p-6 border-b flex justify-between items-center bg-slate-50/70 rounded-t-3xl">
                      <h3 className="font-black text-lg text-slate-800">فاتورة #{invoice.invoiceNumber}</h3>
                      <div className='flex items-center gap-4'>
                        <label className="bg-blue-600 text-white px-4 py-2 rounded-lg font-black text-xs flex items-center gap-2 cursor-pointer hover:bg-blue-700 transition-colors">
                            <UploadCloud size={16}/> رفع شعار
                            <input 
                                type="file" 
                                accept="image/*" 
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        const reader = new FileReader();
                                        reader.onload = (event) => {
                                            onLogoChange(event.target?.result as string);
                                        };
                                        reader.readAsDataURL(file);
                                    }
                                }}
                            />
                        </label>
                        {companyLogo && (
                            <button 
                                onClick={() => onLogoChange(null)} 
                                className="bg-red-500 text-white px-3 py-2 rounded-lg font-black text-xs flex items-center gap-2 hover:bg-red-600 transition-colors"
                            >
                                <X size={14}/> إزالة الشعار
                            </button>
                        )}
                        <button onClick={handleExportPdf} className="bg-slate-800 text-white px-4 py-2 rounded-lg font-black text-xs flex items-center gap-2 hover:bg-slate-900 transition-colors"><Printer size={16}/> تصدير PDF</button>
                        <button onClick={onClose}><X size={24} className="text-slate-500 hover:text-red-600"/></button>
                      </div>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-8">
                      <div
                        ref={invoiceRef}
                        id="invoice-content"
                        dir="rtl"
                        style={{
                          fontFamily: "'Tajawal', 'Arial', sans-serif",
                          background: '#fff',
                          padding: '8mm',
                          color: '#1a1a1a',
                          direction: 'rtl',
                          minHeight: '277mm',
                          maxHeight: '277mm',
                          overflow: 'hidden',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          maxWidth: '190mm',
                          margin: '0 auto'
                        }}
                      >
                        <div>
                          {/* Header - Brand Name & Logo */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 15, marginBottom: 18 }}>
                              {companyLogo ? (
                                  <img src={companyLogo} alt="شعار الشركة" style={{ width: 65, height: 65, objectFit: 'contain' }} />
                              ) : (
                                  <div style={{ width: 65, height: 65, borderRadius: '50%', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                      <span style={{ color: '#fff', fontSize: 26, fontWeight: 900 }}>D</span>
                                  </div>
                              )}
                              <div>
                                  <div style={{ fontSize: 22, fontWeight: 900, color: '#1a1a1a', letterSpacing: 1 }}>مصنع ديكورا</div>
                                  <div style={{ fontSize: 11, color: '#666', fontWeight: 600 }}>للأثاث والمطابخ والديكور</div>
                                  <div style={{ fontSize: 10, color: '#444', fontWeight: 600, marginTop: 2 }}>بنغازي - السيدة عائشة</div>
                                  <div style={{ fontSize: 10, color: '#444', fontWeight: 700, marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>هاتف: 0917404790</div>
                              </div>
                          </div>

                          {/* Invoice Title */}
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 18 }}>
                              <span style={{ fontWeight: 900, color: '#1a1a1a', letterSpacing: 2, fontSize: 22 }}>INVOICE</span>
                              <span style={{ fontWeight: 900, color: '#d97706', letterSpacing: 1, fontSize: 32 }}>فاتورة</span>
                          </div>

                          {/* Invoice To & Invoice Details */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
                              <div>
                                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>Invoice To :</div>
                                  <div style={{ fontSize: 16, color: '#1a1a1a', fontWeight: 700, marginBottom: 8 }}>فاتورة إلى:</div>
                                  <div style={{ fontSize: 14, color: '#444', lineHeight: 1.8, maxWidth: 300 }}>
                                      <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 5 }}>{customer.name}</div>
                                      <div>{customer.address}</div>
                                      <div style={{ fontVariantNumeric: 'tabular-nums' }}>{customer.phone}</div>
                                  </div>
                              </div>
                              <div style={{ textAlign: 'left' }}>
                                  <div style={{ marginBottom: 15 }}>
                                      <div style={{ fontWeight: 700, fontSize: 13 }}>Invoice No :</div>
                                      <div style={{ fontSize: 16, color: '#1a1a1a', fontWeight: 700 }}>رقم الفاتورة :</div>
                                      <div style={{ fontWeight: 800, fontSize: 22, fontVariantNumeric: 'tabular-nums' }}>{invoice.invoiceNumber.toString().padStart(6, '0')}</div>
                                  </div>
                                  <div>
                                      <div style={{ fontWeight: 700, fontSize: 13 }}>Date</div>
                                      <div style={{ fontSize: 16, color: '#1a1a1a', fontWeight: 700 }}>تاريخ</div>
                                      <div style={{ fontWeight: 600, fontSize: 18, fontVariantNumeric: 'tabular-nums' }}>{new Date(invoice.issueDate).toLocaleDateString('ar-LY')}</div>
                                  </div>
                              </div>
                          </div>

                          {/* Items Table */}
                          <div style={{ marginBottom: 15 }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                  <thead>
                                      <tr style={{ borderBottom: '2px solid #1a1a1a' }}>
                                          <th style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 700, width: '8%' }}>
                                              <div style={{ fontSize: 12 }}>No</div>
                                              <div style={{ fontSize: 14, color: '#1a1a1a', fontWeight: 700 }}>رقم</div>
                                          </th>
                                          <th style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 700, width: '42%' }}>
                                              <div style={{ fontSize: 12 }}>Item Description</div>
                                              <div style={{ fontSize: 14, color: '#1a1a1a', fontWeight: 700 }}>وصف السلعة</div>
                                          </th>
                                          <th style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 700, width: '15%' }}>
                                              <div style={{ fontSize: 12 }}>Price</div>
                                              <div style={{ fontSize: 14, color: '#1a1a1a', fontWeight: 700 }}>السعر</div>
                                          </th>
                                          <th style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 700, width: '10%' }}>
                                              <div style={{ fontSize: 12 }}>Qty</div>
                                              <div style={{ fontSize: 14, color: '#1a1a1a', fontWeight: 700 }}>كمية</div>
                                          </th>
                                          <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 700, width: '20%' }}>
                                              <div style={{ color: '#d97706', fontSize: 12 }}>Total</div>
                                              <div style={{ fontSize: 14, color: '#d97706', fontWeight: 700 }}>المجموع</div>
                                          </th>
                                      </tr>
                                  </thead>
                                  <tbody>
                                      {invoice.items.map((item, i) => (
                                          <tr key={i} style={{ borderBottom: '1px solid #e5e5e5' }}>
                                              <td style={{ padding: '14px 8px', textAlign: 'center', fontWeight: 600, fontVariantNumeric: 'tabular-nums', fontSize: 14 }}>
                                                  {(i + 1).toString().padStart(2, '0')}
                                              </td>
                                              <td style={{ padding: '14px 8px', textAlign: 'right', fontWeight: 600, fontSize: 16 }}>
                                                  {item.description}
                                              </td>
                                              <td style={{ padding: '14px 8px', textAlign: 'center', fontVariantNumeric: 'tabular-nums', fontSize: 14 }}>
                                                  {formatCurrency(item.amount)}
                                              </td>
                                              <td style={{ padding: '14px 8px', textAlign: 'center', fontVariantNumeric: 'tabular-nums', fontSize: 14 }}>
                                                  01
                                              </td>
                                              <td style={{ padding: '14px 8px', textAlign: 'left', fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: 15 }}>
                                                  {formatCurrency(item.amount)}
                                              </td>
                                          </tr>
                                      ))}
                                  </tbody>
                              </table>
                          </div>

                          {/* Summary Box - Below Table */}
                          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 15 }}>
                              <div style={{ minWidth: 300 }}>
                                  <div style={{ border: '2px solid #1a1a1a' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #e5e5e5' }}>
                                          <div>
                                              <div style={{ fontSize: 11, color: '#666' }}>Sub Total</div>
                                              <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>المجموع الفرعي</div>
                                          </div>
                                          <div style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: 16, alignSelf: 'center' }}>{formatCurrency(invoice.totalAmount)}</div>
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #e5e5e5' }}>
                                          <div>
                                              <div style={{ fontSize: 11, color: '#666' }}>Paid</div>
                                              <div style={{ fontSize: 14, fontWeight: 700, color: '#059669' }}>المدفوع</div>
                                          </div>
                                          <div style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#059669', fontSize: 16, alignSelf: 'center' }}>{formatCurrency(order.paidAmount || 0)}</div>
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#fef3c7' }}>
                                          <div>
                                              <div style={{ fontSize: 11, color: '#92400e' }}>Net Total</div>
                                              <div style={{ fontSize: 16, fontWeight: 900, color: '#d97706' }}>صافي الإجمالي</div>
                                          </div>
                                          <div style={{ fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: '#d97706', fontSize: 18, alignSelf: 'center' }}>{formatCurrency(remainingBalance)}</div>
                                      </div>
                                  </div>
                              </div>
                          </div>

                          {/* Gray Bars */}
                          <div style={{ marginBottom: 15 }}>
                              <div style={{ height: 18, background: '#d1d5db', marginBottom: 5 }}></div>
                              <div style={{ height: 18, background: '#d1d5db' }}></div>
                          </div>
                        </div>

                        {/* Bottom Section - Payment Info & Footer */}
                        <div>
                          {/* Payment Info */}
                          <div style={{ marginBottom: 12 }}>
                              <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 1 }}>Payment Info :</div>
                              <div style={{ fontSize: 14, color: '#1a1a1a', fontWeight: 700, marginBottom: 6 }}>معلومات الدفع</div>
                              <div style={{ fontSize: 12, color: '#555', lineHeight: 1.6 }}>
                                  <div><span style={{ fontSize: 10 }}>Account |</span> <span style={{ fontWeight: 700, fontSize: 13 }}>رقم الحساب :</span> <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>081014518280017</span></div>
                                  <div><span style={{ fontSize: 10 }}>A/C Name |</span> <span style={{ fontWeight: 700, fontSize: 13 }}>إسم الحساب :</span> <span style={{ fontWeight: 700 }}>منير علي مانع</span></div>
                                  <div><span style={{ fontSize: 10 }}>Bank |</span> <span style={{ fontWeight: 700, fontSize: 13 }}>المصرف :</span> <span style={{ fontWeight: 700 }}>مصرف الوحدة</span></div>
                              </div>
                          </div>

                          {/* Footer */}
                          <div style={{ background: '#1a1a1a', padding: '10px 16px', textAlign: 'center' }}>
                              <div style={{ color: '#fff', fontWeight: 700, fontSize: 12, letterSpacing: 1 }}>بنغازي - السيدة عائشة</div>
                              <div style={{ color: '#d97706', fontWeight: 700, fontSize: 14, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>0917404790</div>
                          </div>
                        </div>
                      </div>
                  </div>
              </div>
          </div>
      );
  };
  
  const WhatsAppTemplatesModal: React.FC<{
      isOpen: boolean;
      customer: Customer | null;
      onClose: () => void;
    }> = ({ isOpen, customer, onClose }) => {
      if (!isOpen || !customer) return null;

      const templates = [
        {
          icon: PackageCheck,
          title: 'إشعار بجاهزية التسليم',
          message: (name: string) => `مرحباً ${name}، معكم مصنع ديكورا. نود إبلاغكم بأن مشروعكم جاهز للتسليم والتركيب. يرجى التواصل معنا لتنسيق الموعد المناسب. شكراً لثقتكم!`
        },
        {
          icon: Hourglass,
          title: 'إشعار بتأجيل الموعد',
          message: (name: string) => `مرحباً ${name}، معكم مصنع ديكورا. نود الاعتذار عن تأخير بسيط في تسليم مشروعكم لضمان أعلى مستويات الجودة. سيتم التواصل معكم قريباً لتحديد الموعد الجديد. نقدر تفهمكم.`
        },
        {
          icon: CircleDollarSign,
          title: 'تذكير بالدفعة المالية',
          message: (name: string) => `مرحباً ${name}، معكم مصنع ديكورا. نود تذكيركم بالدفعة المتبقية على مشروعكم. شكراً لتعاونكم.`
        },
        {
          icon: MessageSquarePlus,
          title: 'استفسار عام',
          message: (name: string) => `مرحباً ${name}، معكم مصنع ديكورا. كيف يمكننا خدمتكم اليوم بخصوص مشروعكم؟`
        }
      ];

      const handleSend = (templateFn: (name: string) => string) => {
          const message = templateFn(customer.name);
          let phone = customer.phone.replace(/\D/g, ''); 
          
          if (phone.startsWith('09')) {
              phone = '218' + phone.substring(1);
          } else if (phone.startsWith('9') && phone.length === 9) {
              phone = '218' + phone;
          }

          const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
          window.open(url, '_blank');
          onClose();
      };
      
      return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm animate-in no-print">
          <div className="bg-white rounded-[32px] shadow-2xl max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
                      <MessageCircle size={28}/>
                  </div>
                  <div>
                    <h3 className="font-black text-xl text-slate-900">
                        إرسال واتساب إلى <span className="text-orange-600">{customer.name}</span>
                    </h3>
                    <p className="text-xs font-bold text-slate-400 mt-1">اختر القالب المناسب للتواصل السريع</p>
                  </div>
              </div>
              <button onClick={onClose} className="p-2 rounded-full hover:bg-red-50"><X size={24} className="text-slate-400 hover:text-red-500"/></button>
            </div>
            <div className="p-8 space-y-3 bg-slate-50/50">
              {templates.map((template, index) => {
                const Icon = template.icon;
                return (
                  <button 
                    key={index} 
                    onClick={() => handleSend(template.message)}
                    className="w-full text-right p-5 rounded-2xl border-2 border-slate-200/50 bg-white hover:border-orange-400 hover:bg-orange-50/50 hover:shadow-xl transition-all flex items-center gap-5 group transform hover:-translate-y-1"
                  >
                    <div className="w-12 h-12 bg-slate-100 text-orange-600 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-orange-100 transition-colors">
                        <Icon size={24}/>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-black text-slate-800 text-base group-hover:text-orange-800 transition-colors">{template.title}</p>
                      {/* FIX: Wrapped template.message(customer.name) in curly braces for JSX rendering */}
                      <p className="text-xs text-slate-500 font-bold mt-1 truncate">{template.message(customer.name)}</p>
                    </div>

                    <Send size={20} className="text-slate-300 group-hover:text-emerald-500 transition-all duration-300 transform group-hover:translate-x-1" />
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      );
  };
  
  const DelayedOrdersModal: React.FC<{
      isOpen: boolean;
      delayedOrders: { order: Order; customer: Customer; newDate: number }[];
      onClose: () => void;
      onNotifyAndReschedule: (order: Order, customer: Customer, newDate: number) => void;
      onDateChange: (orderId: string, newDateStr: string) => void;
      conflicts: Record<string, string | null>;
      getDaysDiff: (ts: number) => number; // FIX: Added getDaysDiff to props
    }> = ({ isOpen, delayedOrders, onClose, onNotifyAndReschedule, onDateChange, conflicts, getDaysDiff }) => { // FIX: Destructured getDaysDiff
        if (!isOpen) return null;

        return (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm animate-in no-print">
                <div className="bg-white rounded-[32px] shadow-2xl max-w-4xl w-full overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[90vh]">
                    <div className="p-6 border-b flex justify-between items-center bg-slate-50 flex-shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-amber-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/30">
                                <Hourglass size={28}/>
                            </div>
                            <div>
                                <h3 className="font-black text-xl text-slate-900">متابعة المشاريع المتأخرة</h3>
                                <p className="text-xs font-bold text-slate-400 mt-1">إعادة جدولة وإخطار العملاء بضغطة زر</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-red-50"><X size={24} className="text-slate-400 hover:text-red-500"/></button>
                    </div>
                    <div className="p-8 space-y-4 bg-slate-50/50 overflow-y-auto custom-scrollbar">
                        {delayedOrders.length > 0 ? delayedOrders.map((delayedItem) => {
                            const { order, customer, newDate } = delayedItem;
                            const conflict = conflicts[order.id];
                            const localDate = new Date(newDate);
                            const dateStr = new Date(localDate.getTime() - (localDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

                            return (
                                <div key={order.id} className="p-5 rounded-2xl border-2 border-slate-200/50 bg-white group space-y-4">
                                    <div className="flex items-center justify-between gap-5">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-black text-slate-800 text-lg truncate">{customer.name}</p>
                                            <p className="text-xs text-slate-500 font-bold mt-1 truncate">{order.productType}</p>
                                        </div>
                                        <span className="flex items-center gap-2 text-red-600 bg-red-50 px-2 py-1 rounded font-bold text-xs">
                                            <AlertTriangle size={14}/>
                                            متأخر {Math.abs(getDaysDiff(order.deliveryDate))} يوم
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-100">
                                        <div className="flex-1 space-y-2">
                                             <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-slate-500 whitespace-nowrap">حدد الموعد الجديد:</span>
                                                <input 
                                                    type="date"
                                                    value={dateStr}
                                                    onChange={(e) => onDateChange(order.id, e.target.value)}
                                                    className={`bg-slate-100 border-2 rounded-lg p-2 font-bold text-center text-sm w-40 ${conflict ? 'border-red-300 text-red-600' : 'border-emerald-300 text-emerald-600'}`}
                                                />
                                            </div>
                                             {conflict ? (
                                                <p className="text-red-500 text-xs font-bold">{conflict}</p>
                                            ) : (
                                                <p className="text-emerald-500 text-xs font-bold">الموعد متاح</p>
                                            )}
                                        </div>
                                        <button 
                                            onClick={() => onNotifyAndReschedule(order, customer, newDate)}
                                            disabled={!!conflict}
                                            className="bg-amber-500 text-white px-6 py-3 rounded-xl font-black text-sm flex items-center gap-2 hover:bg-amber-600 transition-all shadow-lg shadow-amber-500/30 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <Send size={16}/>
                                            إخطار وإعادة جدولة
                                        </button>
                                    </div>
                                </div>
                            );
                        }) : (
                           <div className="text-center py-20">
                               <CheckCircle2 size={48} className="mx-auto text-emerald-300 mb-4"/>
                               <p className="text-slate-500 font-bold">لا توجد مشاريع متأخرة حالياً. عمل رائع!</p>
                           </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const FinancialReportModal: React.FC<{
      isOpen: boolean,
      onClose: () => void,
      onGenerate: (range: 'month' | 'all') => void
    }> = ({isOpen, onClose, onGenerate}) => {
      const [range, setRange] = useState<'month' | 'all'>('month');
      if (!isOpen) return null;
      return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm animate-in no-print">
            <div className="bg-white rounded-[32px] shadow-2xl max-w-md w-full overflow-hidden">
                <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                    <h3 className="font-black text-lg">إعداد تقرير مالي</h3>
                    <button onClick={onClose}><X size={20}/></button>
                </div>
                <div className="p-8 space-y-6">
                    <p className='font-bold text-slate-600 text-center'>اختر النطاق الزمني للتقرير:</p>
                    <div className="flex gap-4">
                      <button onClick={()=>setRange('month')} className={`flex-1 text-center py-4 rounded-xl font-black transition-all ${range === 'month' ? 'bg-orange-600 text-white' : 'bg-slate-100'}`}>
                        الشهر الحالي
                      </button>
                      <button onClick={()=>setRange('all')} className={`flex-1 text-center py-4 rounded-xl font-black transition-all ${range === 'all' ? 'bg-orange-600 text-white' : 'bg-slate-100'}`}>
                        كامل السجل
                      </button>
                    </div>
                    <button onClick={() => onGenerate(range)} className="w-full bg-slate-900 text-white py-4 rounded-xl font-black text-lg shadow-xl hover:bg-slate-700 transition-all flex items-center justify-center gap-3">
                      <Printer size={20} />
                      إنشاء وطباعة
                    </button>
                </div>
            </div>
        </div>
      );
    }

  return (
    <>
      <ConfirmationModal 
        isOpen={confirmationModal.isOpen}
        title={confirmationModal.title}
        message={confirmationModal.message}
        onConfirm={confirmationModal.onConfirm}
        onClose={handleCloseConfirm}
      />
      <InvoiceViewModal 
        isOpen={modals.invoice.isOpen}
        invoice={modals.invoice.invoice}
        order={orders.find(o => o.id === modals.invoice.invoice?.orderId) || null}
        customer={customers.find(c => c.id === modals.invoice.invoice?.customerId) || null}
        onClose={() => setModals(m => ({ ...m, invoice: {isOpen: false, invoice: null}}))}
        companyLogo={companyLogo}
        onLogoChange={setCompanyLogo}
        addToast={addToast}
      />
      <WhatsAppTemplatesModal
        isOpen={modals.whatsappTemplates.isOpen}
        customer={modals.whatsappTemplates.customer}
        onClose={() => setModals(m => ({ ...m, whatsappTemplates: {isOpen: false, customer: null}}))}
      />
      <DelayedOrdersModal
        isOpen={isDelayedModalOpen}
        delayedOrders={delayedOrdersData}
        onClose={() => setIsDelayedModalOpen(false)}
        onNotifyAndReschedule={handleNotifyAndReschedule}
        onDateChange={handleDelayedDateChange}
        conflicts={delayedOrdersConflicts}
        getDaysDiff={getDaysDiff} // FIX: Passed getDaysDiff as a prop
      />
       <FinancialReportModal 
        isOpen={modals.financialReport.isOpen}
        onClose={() => setModals(m=>({...m, financialReport: {...m.financialReport, isOpen: false}}))}
        onGenerate={handlePrintFinancialReport}
      />
      <div aria-live="assertive" className="fixed top-0 right-0 p-6 sm:p-8 space-y-4 pointer-events-none z-[999]">
          {toasts.map(toast => {
              const colors = {
                  success: 'bg-emerald-600',
                  error: 'bg-red-600',
                  info: 'bg-slate-800'
              };
              return (
                  <div key={toast.id} className={`max-w-md w-full ${colors[toast.type]} shadow-2xl rounded-2xl p-5 pointer-events-auto text-white animate-toast-in`}>
                      <p className="font-bold text-base">{toast.message}</p>
                  </div>
              )
          })}
      </div>

      <div className="h-screen flex flex-col bg-slate-50 text-slate-900 overflow-hidden font-['Tajawal']">
        <header className="bg-white border-b border-slate-200 px-8 flex items-center justify-between no-print z-40 shadow-sm flex-shrink-0">
            <div className="flex items-center gap-8">
                <div className="flex items-center gap-4">
                    {companyLogo ? (
                        <img 
                            src={companyLogo} 
                            alt="شعار ديكورا" 
                            className="w-10 h-10 object-contain rounded-xl"
                        />
                    ) : (
                        <Logo size={28} />
                    )}
                    <h1 className="text-2xl font-black tracking-tighter">ديكورا</h1>
                </div>
                <div className="h-8 w-px bg-slate-200 hidden lg:block"></div>
                <nav className="hidden lg:flex items-center gap-2">
                    <TopNavLink active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard size={20} />} label="الرئيسية" />
                    <TopNavLink active={activeTab === 'production'} onClick={() => setActiveTab('production')} icon={<Layers size={20} />} label="خط الإنتاج" />
                    <TopNavLink active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} icon={<PlusCircle size={20} />} label="حجز مشروع" />
                    <TopNavLink active={activeTab === 'customers'} onClick={() => setActiveTab('customers')} icon={<Users size={20} />} label="العملاء" />
                    <TopNavLink active={activeTab === 'calendar'} onClick={() => setActiveTab('calendar')} icon={<Calendar size={20} />} label="الجدول الشهري" />
                    <TopNavLink active={activeTab === 'accounting'} onClick={() => setActiveTab('accounting')} icon={<Banknote size={20} />} label="المحاسبة والفواتير" />
                    <TopNavLink active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} icon={<LayoutGrid size={20} />} label="التقارير" />
                    <TopNavLink active={activeTab === 'archive'} onClick={() => setActiveTab('archive')} icon={<ArchiveIcon size={20} />} label="الأرشيف" />
                    {currentUser.role === 'admin' && <div className="h-6 w-px bg-slate-200 mx-2"></div>} {/* Admin separator */}
                    {currentUser.role === 'admin' && <TopNavLink active={activeTab === 'database'} onClick={() => setActiveTab('database')} icon={<Database size={20} />} label="إدارة البيانات" />}
                    {currentUser.role === 'admin' && <TopNavLink active={activeTab === 'products'} onClick={() => setActiveTab('products')} icon={<Settings size={20} />} label="إعدادات المنتجات" />}
                </nav>
            </div>
            
            <div className="flex items-center gap-6">
                 <button 
                   onClick={() => setActiveTab('dashboard')} 
                   className="relative p-3 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-xl transition-all"
                   title="التنبيهات"
                 >
                     <BellRing size={24} className={upcomingAlerts.length > 0 ? "animate-pulse text-orange-600" : ""} />
                     {upcomingAlerts.length > 0 && (
                         <span className="absolute top-2 right-2 w-5 h-5 bg-red-600 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-white shadow-sm">
                             {upcomingAlerts.length}
                         </span>
                     )}
                 </button>

                 <div className="flex items-center gap-4">
                     <div className="text-right leading-none hidden md:block">
                         <p className="text-base font-black text-slate-800">{currentUser.username}</p>
                         <p className="text-[10px] text-slate-400 uppercase font-black mt-1 tracking-widest">{currentUser.role === 'admin' ? 'مدير عام' : 'موظف تشغيل'}</p>
                     </div>
                     <div className="w-12 h-12 bg-slate-950 rounded-2xl flex items-center justify-center text-orange-500 font-black border-b-4 border-orange-600 shadow-xl">{currentUser.username[0].toUpperCase()}</div>
                 </div>
                 <div className="h-8 w-px bg-slate-200 hidden lg:block"></div>
                 <button onClick={() => openPasswordModal(currentUser!)} title="تغيير كلمة السر" className="p-3 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded-xl transition-colors"><Key size={20}/></button>
                 <button onClick={() => setCurrentUser(null)} className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors" title="تسجيل الخروج">
                   <LogOut size={20} />
                 </button>
            </div>
        </header>

        <main className="flex-1 overflow-y-auto custom-scrollbar bg-[#f8fafc] p-10">
          <div className="max-w-screen-2xl mx-auto w-full h-full">
            {activeTab === 'dashboard' && <DashboardView orders={orders} customers={customers} aiAdvice={aiAdvice} getDaysDiff={getDaysDiff} setAiAdvice={setAiAdvice} loadingAdvice={loadingAdvice} setLoadingAdvice={setLoadingAdvice} setActiveTab={setActiveTab} handleExportReport={handleExportReport} productsConfig={productsConfig} onOpenDelayedModal={handleOpenDelayedModal} />}
            {/* FIX: Removed redundant productsConfig prop */}
            {activeTab === 'production' && <ProductionView orders={orders} customers={customers} setOrders={setOrders} onDelete={currentUser.role === 'admin' ? handleOpenOrderDeleteConfirm : undefined} openEdit={o => { setModals({...modals, editOrder:{isOpen:true, order:o}}); setEditedOrder(o); }} config={productsConfig} getDaysDiff={getDaysDiff} openReschedule={openRescheduleModal} />}
            {activeTab === 'customers' && <CustomersView customers={customers} orders={orders} onAdd={handleAddCustomer} onEdit={c => setModals(m => ({ ...m, editCustomer: { isOpen: true, customer: c } }))} onDelete={handleOpenCustomerDeleteConfirm} onWhatsApp={handleOpenWhatsAppModal} initialFormOpen={false} />}
            {activeTab === 'orders' && <NewOrderView customers={customers} orders={orders} invoices={invoices} onAdd={handleAddOrder} config={productsConfig} getSuggestedDeliveryDate={getSuggestedDeliveryDate} addToast={addToast} />}
            {activeTab === 'accounting' && <AccountingView orders={orders} customers={customers} invoices={invoices} setInvoices={setInvoices} expenses={expenses} setExpenses={setExpenses} setOrders={setOrders} paymentReceipts={paymentReceipts} setPaymentReceipts={setPaymentReceipts} addToast={addToast} openInvoice={openInvoiceModal} handlePrintFinancialReport={() => setModals(m=>({...m, financialReport: {...m.financialReport, isOpen:true}}))} productsConfig={productsConfig} companyLogo={companyLogo} />}
            {activeTab === 'reports' && <ReportsView orders={orders} customers={customers} getDaysDiff={getDaysDiff} handleExportReport={handleExportReport} handleExportComprehensiveReport={handleExportComprehensiveReport} productsConfig={productsConfig} />}
            {activeTab === 'archive' && <ArchiveView orders={orders} customers={customers} />}
            {activeTab === 'calendar' && <CalendarView orders={orders} customers={customers} productsConfig={productsConfig} onOrderClick={openRescheduleModal} onDateDrop={handleDropOnCalendar} />}
            {currentUser.role === 'admin' && activeTab === 'database' && (
              <DatabaseView customers={customers} orders={orders} expenses={expenses} invoices={invoices} setCustomers={setCustomers} setOrders={setOrders} setExpenses={setExpenses} setInvoices={setInvoices} userAccounts={userAccounts} setUserAccounts={setUserAccounts} fileInputRef={fileInputRef} currentUser={currentUser} openPasswordModal={openPasswordModal} onAddUser={handleAddUserAccount} onToggleUserStatus={handleToggleUserStatus} onDeleteUser={handleDeleteUser} onChangeUserRole={handleChangeUserRole} handleManualExport={handleManualExport} backupInterval={backupInterval} setBackupInterval={setBackupInterval} onSelectBackupPath={selectBackupFolder} isBackupPathSet={!!backupHandle} autoBackupEnabled={autoBackupEnabled} setAutoBackupEnabled={setAutoBackupEnabled} setProductsConfig={setProductsConfig} addToast={addToast} companyLogo={companyLogo} setCompanyLogo={setCompanyLogo} />
            )}
            {currentUser.role === 'admin' && activeTab === 'products' && (
               <ProductsView config={productsConfig} onEdit={handleEditProduct} onAdd={handleAddProduct} />
            )}
          </div>
        </main>

        {modals.editOrder.isOpen && editedOrder && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm animate-in no-print">
            <div className="bg-white rounded-[32px] shadow-2xl max-w-lg w-full overflow-hidden">
              <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                <h3 className="font-black text-lg">تحديث بيانات المشروع</h3>
                <button onClick={()=>{setModals({...modals, editOrder:{isOpen:false, order:null}}); setEditedOrder(null);}}><X size={20}/></button>
              </div>
              <div className="p-8 space-y-6">
                 <div className='space-y-2'>
                    <label className="text-xs font-bold text-slate-500">حالة المشروع</label>
                    <select value={editedOrder.status} onChange={e=>setEditedOrder({...editedOrder, status: e.target.value as OrderStatus})} className="input-professional text-sm text-center">
                      {Object.keys(STATUS_MAP).map(k=><option key={k} value={k}>{STATUS_MAP[k as OrderStatus].label}</option>)}
                    </select>
                 </div>
                 <div className='grid grid-cols-2 gap-4'>
                    <div className='space-y-2'>
                       <label className="text-xs font-bold text-slate-500">السعر الإجمالي</label>
                       <input type="number" value={editedOrder.price || ''} onChange={e => setEditedOrder({...editedOrder, price: parseFloat(e.target.value) || 0})} className="input-professional text-center" />
                    </div>
                    <div className='space-y-2'>
                       <label className="text-xs font-bold text-slate-500">المبلغ المدفوع</label>
                       <input type="number" value={editedOrder.paidAmount || ''} onChange={e => setEditedOrder({...editedOrder, paidAmount: parseFloat(e.target.value) || 0})} className="input-professional text-center" />
                    </div>
                 </div>
                <button onClick={handleSaveEditedOrder} className="w-full bg-slate-950 text-white py-5 rounded-2xl font-black uppercase shadow-2xl border-b-4 border-black">حفظ التغييرات</button>
              </div>
            </div>
          </div>
        )}

        {modals.editCustomer.isOpen && modals.editCustomer.customer && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm animate-in no-print">
            <div className="bg-white rounded-[32px] shadow-2xl max-w-md w-full overflow-hidden">
              <div className="p-6 border-b flex justify-between items-center bg-slate-50"><h3 className="font-black">تعديل ملف العميل</h3><button onClick={()=>setModals({...modals, editCustomer:{isOpen:false, customer:null}})}><X/></button></div>
              <div className="p-8 space-y-4">
                 <input value={modals.editCustomer.customer.name} onChange={e=>setModals({...modals, editCustomer:{...modals.editCustomer, customer:{...modals.editCustomer.customer!, name:e.target.value}}})} className="input-professional text-center" />
                 <input value={modals.editCustomer.customer.phone} onChange={e=>setModals({...modals, editCustomer:{...modals.editCustomer, customer:{...modals.editCustomer.customer!, phone:e.target.value}}})} className="input-professional text-center tabular-nums" />
                 <textarea value={modals.editCustomer.customer.address} onChange={e=>setModals({...modals, editCustomer:{...modals.editCustomer, customer:{...modals.editCustomer.customer!, address:e.target.value}}})} className="input-professional h-24 text-center text-xs" />
                 <button onClick={()=>{
                   setCustomers(customers.map((c: Customer) =>c.id===modals.editCustomer.customer?.id ? modals.editCustomer.customer! : c));
                   setModals({...modals, editCustomer:{isOpen:false, customer:null}});
                 }} className="w-full bg-slate-950 text-white py-5 rounded-2xl font-black uppercase border-b-4 border-black shadow-xl">تحديث</button>
              </div>
            </div>
          </div>
        )}
        
        {modals.changePassword.isOpen && modals.changePassword.user && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm animate-in no-print">
                <div className="bg-white rounded-[32px] shadow-2xl max-w-sm w-full overflow-hidden">
                    <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                        <h3 className="font-black text-lg">{modals.changePassword.user.id === currentUser?.id ? 'تغيير كلمة السر' : `إعادة تعيين كلمة سر لـ ${modals.changePassword.user.username}`}</h3>
                        <button onClick={()=>setModals(m => ({ ...m, changePassword: { isOpen: false, user: null }}))}><X size={20}/></button>
                    </div>
                    <form onSubmit={handlePasswordSubmit} className="p-8 space-y-6">
                        {modals.changePassword.user.id === currentUser?.id && <div className='space-y-2'>
                            <label className='text-xs font-bold text-slate-500'>كلمة السر الحالية</label>
                            <input type="password" value={passwordForm.current} onChange={e => setPasswordForm(p => ({...p, current: e.target.value}))} className="input-professional" required />
                        </div>}
                         <div className='space-y-2'>
                            <label className='text-xs font-bold text-slate-500'>كلمة السر الجديدة</label>
                            <input type="password" value={passwordForm.new} onChange={e => setPasswordForm(p => ({...p, new: e.target.value}))} className="input-professional" required />
                         </div>
                        {modals.changePassword.user.id === currentUser?.id && <div className='space-y-2'>
                            <label className='text-xs font-bold text-slate-500'>تأكيد كلمة السر الجديدة</label>
                            <input type="password" value={passwordForm.confirm} onChange={e => setPasswordForm(p => ({...p, confirm: e.target.value}))} className="input-professional" required />
                        </div>}
                        {passwordError && <p className="text-red-600 text-xs font-bold">{passwordError}</p>}
                        <button type="submit" className="w-full bg-slate-950 text-white py-5 rounded-2xl font-black uppercase shadow-2xl border-b-4 border-black">تحديث</button>
                    </form>
                </div>
            </div>
        )}
        
        {modals.editProduct.isOpen && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm animate-in no-print">
                <div className="bg-white rounded-[32px] shadow-2xl max-w-lg w-full overflow-hidden">
                    <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                        <h3 className="font-black text-lg">{modals.editProduct.isNew ? 'إضافة منتج جديد' : 'تعديل إعدادات المنتج'}</h3>
                        <button onClick={()=>setModals(m => ({...m, editProduct: {isOpen:false, productId: null}}))}><X size={20}/></button>
                    </div>
                    <div className="p-8 space-y-6">
                         <div className='space-y-2'>
                            <label className='text-xs font-bold text-slate-500'>اسم المنتج/التصنيف</label>
                            <input value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} className="input-professional" />
                         </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className='space-y-2'>
                                <label className='text-xs font-bold text-slate-500'>أيام الإنتاج المطلوبة</label>
                                <input type="number" value={productForm.productionDays} onChange={e => setProductForm({...productForm, productionDays: parseInt(e.target.value)})} className="input-professional text-center" />
                            </div>
                            <div className='space-y-2'>
                                <label className='text-xs font-bold text-slate-500'>الأيقونة</label>
                                <select value={productForm.iconKey} onChange={e => setProductForm({...productForm, iconKey: e.target.value})} className="input-professional text-center">
                                    {Object.keys(ICON_MAP).map(key => <option key={key} value={key}>{key}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className='space-y-2'>
                            <label className='text-xs font-bold text-slate-500'>لون التميز</label>
                            <input value={productForm.color} onChange={e => setProductForm({...productForm, color: e.target.value})} className="input-professional text-center" />
                        </div>
                        <button onClick={saveProductChanges} className="w-full bg-slate-950 text-white py-5 rounded-2xl font-black uppercase shadow-2xl border-b-4 border-black">حفظ الإعدادات</button>
                    </div>
                </div>
            </div>
        )}
        
        {modals.rescheduleOrder.isOpen && modals.rescheduleOrder.order && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm animate-in no-print">
                <div className="bg-white rounded-[32px] shadow-2xl max-w-lg w-full overflow-hidden">
                    <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                        <h3 className="font-black text-lg">إعادة جدولة المشروع</h3>
                        <button onClick={()=>setModals(m => ({...m, rescheduleOrder: {isOpen:false, order: null}}))}><X size={20}/></button>
                    </div>
                    <div className="p-8 space-y-6">
                        <div className='space-y-2'>
                           <label className='text-xs font-bold text-slate-500'>تحديد موعد تسليم جديد</label>
                           <input type="date" value={rescheduleDate} onChange={e => {setRescheduleDate(e.target.value); checkRescheduleConflict(e.target.value, modals.rescheduleOrder.order!.id);}} className="input-professional text-center" />
                        </div>
                        {rescheduleConflict && <p className="text-red-500 text-xs font-bold">{rescheduleConflict}</p>}
                        {modals.rescheduleOrder.suggestedDate && !rescheduleConflict && (
                          <div className='p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center'>
                             <p className='text-xs font-bold text-emerald-800'>يقترح النظام تاريخ {new Date(modals.rescheduleOrder.suggestedDate).toLocaleDateString('ar-LY')}</p>
                          </div>
                        )}
                        <button onClick={handleRescheduleOrder} disabled={!!rescheduleConflict} className="w-full bg-slate-950 text-white py-5 rounded-2xl font-black uppercase shadow-2xl border-b-4 border-black disabled:opacity-50">تحديث الموعد</button>
                    </div>
                </div>
            </div>
        )}
        
      </div>
    </>
  );
};

// FIX: Add default export for the App component to be used in index.tsx
export default App;