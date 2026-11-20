export type OrderStatus = 'new' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';

export type ProductThemeId = 'emerald' | 'sapphire' | 'amber' | 'rose' | 'violet' | 'slate';

export interface ProductReview {
  id: string;
  author: string;
  city: string;
  rating: number;
  comment: string;
  imageUrl?: string;
}

export interface ProductFaq {
  id: string;
  question: string;
  answer: string;
}

export interface Product {
  slug: string;
  name: string;
  price: number;
  compareAtPrice: number;
  currency: string;
  description: string;
  features: string[];
  images: string[];
  isActive: boolean;
  // Phase 1 Liquid Glass & Conversion Customization (optional for full backward compatibility)
  themeId?: ProductThemeId;
  model3dUrl?: string;
  whatsappNumber?: string;
  stockRemaining?: number;
  showCountdown?: boolean;
  countdownMinutes?: number;
  reviews?: ProductReview[];
  faqs?: ProductFaq[];
  createdBy: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface Order {
  id: string;
  orderNumber: string;
  productSlug: string;
  productName: string;
  unitPrice: number;
  currency: string;
  quantity: number;
  totalPrice: number;
  customerName: string;
  phone: string;
  governorate: string;
  address: string;
  notes: string;
  paymentMethod: 'cod';
  status: OrderStatus;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: 'جديد',
  confirmed: 'تم التأكيد',
  shipped: 'تم الشحن',
  delivered: 'تم التسليم',
  cancelled: 'ملغي',
};

export const ORDER_STATUS_STYLES: Record<OrderStatus, string> = {
  new: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800/70',
  confirmed:
    'text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/50 border-sky-200 dark:border-sky-800/70',
  shipped:
    'text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800/70',
  delivered:
    'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800/70',
  cancelled:
    'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800/70',
};

export const ORDER_STATUSES: OrderStatus[] = [
  'new',
  'confirmed',
  'shipped',
  'delivered',
  'cancelled',
];

// Synchronized verbatim with firebase-blueprint.json & firestore.rules
export const VALIDATION_LIMITS = {
  SLUG_MIN: 2,
  SLUG_MAX: 80,
  SLUG_REGEX: /^[a-z0-9-]+$/,
  PRODUCT_NAME_MIN: 2,
  PRODUCT_NAME_MAX: 160,
  PRICE_MAX: 10000000,
  CURRENCY_MAX: 16,
  DESCRIPTION_MIN: 5,
  DESCRIPTION_MAX: 3000,
  FEATURES_MAX_COUNT: 15,
  FEATURE_ITEM_MAX: 200,
  IMAGES_MIN_COUNT: 1,
  IMAGES_MAX_COUNT: 10,
  IMAGE_URL_MAX: 1000,
  REVIEWS_MAX_COUNT: 10,
  FAQS_MAX_COUNT: 10,
  CUSTOMER_NAME_MIN: 2,
  CUSTOMER_NAME_MAX: 120,
  PHONE_MIN: 7,
  PHONE_MAX: 25,
  PHONE_REGEX: /^[0-9+\-\s()]{7,25}$/,
  EGYPT_MOBILE_REGEX: /^01[0125][0-9]{8}$/,
  GOVERNORATE_MIN: 2,
  GOVERNORATE_MAX: 80,
  ADDRESS_MIN: 5,
  ADDRESS_MAX: 500,
  NOTES_MAX: 500,
  QUANTITY_MIN: 1,
  QUANTITY_MAX: 50,
} as const;

export const CURRENCIES = [
  { code: 'ج.م', label: 'جنيه مصري (ج.م)' },
  { code: 'ر.س', label: 'ريال سعودي (ر.س)' },
  { code: 'د.إ', label: 'درهم إماراتي (د.إ)' },
  { code: 'د.ك', label: 'دينار كويتي (د.ك)' },
  { code: 'د.أ', label: 'دينار أردني (د.أ)' },
  { code: 'ر.ق', label: 'ريال قطري (ر.ق)' },
  { code: '$', label: 'دولار أمريكي ($)' },
];

export const GOVERNORATES = [
  'القاهرة',
  'الجيزة',
  'الإسكندرية',
  'الدقهلية',
  'الشرقية',
  'المنوفية',
  'القليوبية',
  'البحيرة',
  'الغربية',
  'بورسعيد',
  'الإسماعيلية',
  'السويس',
  'دمياط',
  'كفر الشيخ',
  'الفيوم',
  'بني سويف',
  'المنيا',
  'أسيوط',
  'سوهاج',
  'قنا',
  'الأقصر',
  'أسوان',
  'البحر الأحمر',
  'مطروح',
  'الرياض',
  'جدة',
  'الدمام',
  'دبي',
  'أبوظبي',
  'أخرى',
];
