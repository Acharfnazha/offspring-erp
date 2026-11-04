export const LOCALES = ["en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];

const en = {
  nav: {
    overview: "Overview", inventory: "Inventory", coldStorage: "Cold Storage", customers: "Customers", suppliers: "Suppliers",
    orders: "Sales & Orders", shipments: "Shipments", quotations: "Quotations", invoices: "Invoices", payments: "Payments",
    expenses: "Expenses", profit: "Profit Calculator", analytics: "Analytics", assistant: "AI Assistant", documents: "Documents",
    employees: "Employees", settings: "Settings",
  },
  groups: { operations: "Operations", commercial: "Commercial", finance: "Finance", intelligence: "Intelligence", admin: "Administration" },
  common: {
    search: "Search…", searchEverything: "Search customers, batches, orders, invoices…", notifications: "Notifications", noNotifications: "You're all caught up",
    markAllRead: "Mark all read", create: "Create", new: "New", save: "Save", cancel: "Cancel", edit: "Edit", delete: "Delete", archive: "Archive",
    export: "Export", filter: "Filter", all: "All", actions: "Actions", status: "Status", profile: "Profile", signOut: "Sign out", language: "Language",
    theme: "Theme", light: "Light", dark: "Dark", system: "System", collapse: "Collapse", noResults: "No results found", loading: "Loading…",
    rows: "rows", page: "Page", of: "of", previous: "Previous", next: "Next",
  },
  quick: { title: "Quick create", batch: "Inventory batch", customer: "Customer", quotation: "Quotation", order: "Sales order", shipment: "Shipment", invoice: "Invoice", payment: "Payment", expense: "Expense" },
  dashboard: { title: "Executive overview", subtitle: "Live figures from your operational database" },
  auth: { signIn: "Sign in", email: "Email", password: "Password", forgot: "Forgot password?", welcome: "Welcome back", tagline: "Fresh fruit export, cold storage & logistics — in one place." },
};

type Dict = typeof en;

const ar: Dict = {
  nav: {
    overview: "نظرة عامة", inventory: "المخزون", coldStorage: "التخزين المبرد", customers: "العملاء", suppliers: "الموردون",
    orders: "المبيعات والطلبات", shipments: "الشحنات", quotations: "عروض الأسعار", invoices: "الفواتير", payments: "المدفوعات",
    expenses: "المصاريف", profit: "حاسبة الأرباح", analytics: "التحليلات", assistant: "المساعد الذكي", documents: "المستندات",
    employees: "الموظفون", settings: "الإعدادات",
  },
  groups: { operations: "العمليات", commercial: "التجارة", finance: "المالية", intelligence: "الذكاء التجاري", admin: "الإدارة" },
  common: {
    search: "بحث…", searchEverything: "ابحث عن العملاء، الدفعات، الطلبات، الفواتير…", notifications: "الإشعارات", noNotifications: "لا توجد إشعارات جديدة",
    markAllRead: "تحديد الكل كمقروء", create: "إنشاء", new: "جديد", save: "حفظ", cancel: "إلغاء", edit: "تعديل", delete: "حذف", archive: "أرشفة",
    export: "تصدير", filter: "تصفية", all: "الكل", actions: "إجراءات", status: "الحالة", profile: "الملف الشخصي", signOut: "تسجيل الخروج", language: "اللغة",
    theme: "المظهر", light: "فاتح", dark: "داكن", system: "النظام", collapse: "طي", noResults: "لا توجد نتائج", loading: "جار التحميل…",
    rows: "صفوف", page: "صفحة", of: "من", previous: "السابق", next: "التالي",
  },
  quick: { title: "إنشاء سريع", batch: "دفعة مخزون", customer: "عميل", quotation: "عرض سعر", order: "طلب بيع", shipment: "شحنة", invoice: "فاتورة", payment: "دفعة مالية", expense: "مصروف" },
  dashboard: { title: "النظرة التنفيذية", subtitle: "أرقام مباشرة من قاعدة البيانات التشغيلية" },
  auth: { signIn: "تسجيل الدخول", email: "البريد الإلكتروني", password: "كلمة المرور", forgot: "نسيت كلمة المرور؟", welcome: "مرحباً بعودتك", tagline: "تصدير الفاكهة الطازجة والتخزين المبرد والخدمات اللوجستية — في مكان واحد." },
};

export const dictionaries: Record<Locale, Dict> = { en, ar };
export type Dictionary = Dict;

export function isLocale(v: string | undefined): v is Locale {
  return !!v && (LOCALES as readonly string[]).includes(v);
}
