import { Order, ProductFaq, ProductReview, VALIDATION_LIMITS } from './types';

const ARABIC_DIGIT_MAP: Record<string, string> = {
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
  '۰': '0',
  '۱': '1',
  '۲': '2',
  '۳': '3',
  '۴': '4',
  '۵': '5',
  '۶': '6',
  '۷': '7',
  '۸': '8',
  '۹': '9',
};

const ARABIC_TRANSLIT_MAP: Record<string, string> = {
  ا: 'a',
  أ: 'a',
  إ: 'e',
  آ: 'a',
  ب: 'b',
  ت: 't',
  ث: 'th',
  ج: 'g',
  ح: 'h',
  خ: 'kh',
  د: 'd',
  ذ: 'z',
  ر: 'r',
  ز: 'z',
  س: 's',
  ش: 'sh',
  ص: 's',
  ض: 'd',
  ط: 't',
  ظ: 'z',
  ع: 'a',
  غ: 'gh',
  ف: 'f',
  ق: 'q',
  ك: 'k',
  ل: 'l',
  م: 'm',
  ن: 'n',
  ه: 'h',
  ة: 'a',
  و: 'w',
  ي: 'y',
  ى: 'a',
  ئ: 'e',
  ؤ: 'o',
};

export function normalizeArabicDigits(input: string): string {
  return input.replace(/[٠-٩۰-۹]/g, (char) => ARABIC_DIGIT_MAP[char] ?? char);
}

/**
 * Smart Egyptian mobile validation (010 / 011 / 012 / 015 + 8 digits),
 * with helpful guidance and graceful support for international numbers starting with +.
 */
export function validatePhoneInput(rawPhone: string): {
  valid: boolean;
  normalized: string;
  error?: string;
} {
  const normalized = normalizeArabicDigits(rawPhone).trim();
  const compact = normalized.replace(/[\s\-()]/g, '');

  if (!compact) {
    return { valid: false, normalized, error: 'يرجى إدخال رقم الموبايل.' };
  }

  // Convert +201... or 00201... to 01...
  let egyptNormalized = compact;
  if (compact.startsWith('+201')) {
    egyptNormalized = '0' + compact.slice(3);
  } else if (compact.startsWith('00201')) {
    egyptNormalized = '0' + compact.slice(4);
  } else if (compact.startsWith('201') && compact.length === 12) {
    egyptNormalized = '0' + compact.slice(2);
  }

  // If user is typing an Egyptian number (starts with 01 or 0)
  if (egyptNormalized.startsWith('01')) {
    if (!VALIDATION_LIMITS.EGYPT_MOBILE_REGEX.test(egyptNormalized)) {
      if (egyptNormalized.length !== 11) {
        return {
          valid: false,
          normalized: egyptNormalized,
          error: 'رقم الموبايل المصري يجب أن يتكون من 11 رقماً (مثال: 01012345678).',
        };
      }
      return {
        valid: false,
        normalized: egyptNormalized,
        error: 'يرجى إدخال رقم موبايل مصري صحيح يبدأ بـ 010 أو 011 أو 012 أو 015.',
      };
    }
    return { valid: true, normalized: egyptNormalized };
  }

  // International phone fallback (e.g., Saudi/UAE starting with + or 05)
  if (VALIDATION_LIMITS.PHONE_REGEX.test(normalized) && compact.replace(/\D/g, '').length >= 9) {
    return { valid: true, normalized };
  }

  return {
    valid: false,
    normalized,
    error: 'يرجى إدخال رقم موبايل مصري صحيح (01xxxxxxxxx) أو رقم دولي صحيح.',
  };
}

const DUPLICATE_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

export function checkDuplicateOrder(productSlug: string, normalizedPhone: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const key = `recent_order_${productSlug}_${normalizedPhone.replace(/\D/g, '')}`;
    const saved = window.localStorage.getItem(key);
    if (!saved) return false;
    const timestamp = Number(saved);
    if (Number.isFinite(timestamp) && Date.now() - timestamp < DUPLICATE_COOLDOWN_MS) {
      return true;
    }
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage quota / privacy mode restrictions
  }
  return false;
}

export function recordSubmittedOrder(productSlug: string, normalizedPhone: string): void {
  if (typeof window === 'undefined') return;
  try {
    const key = `recent_order_${productSlug}_${normalizedPhone.replace(/\D/g, '')}`;
    window.localStorage.setItem(key, String(Date.now()));
  } catch {
    // Ignore
  }
}

export function slugifyProductName(name: string): string {
  const normalized = normalizeArabicDigits(name.trim().toLowerCase());
  let out = '';
  for (const ch of normalized) {
    if (ARABIC_TRANSLIT_MAP[ch]) {
      out += ARABIC_TRANSLIT_MAP[ch];
    } else if (/[a-z0-9]/.test(ch)) {
      out += ch;
    } else if (/[\s\-_]+/.test(ch)) {
      out += '-';
    }
  }
  const cleaned = out.replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  if (cleaned.length >= 2) {
    return cleaned;
  }
  return `product-${Math.floor(1000 + Math.random() * 9000)}`;
}

export function sanitizeSlugInput(input: string): string {
  return normalizeArabicDigits(input)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

export function generateOrderId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `ord_${ts}_${rand}`;
}

export function generateOrderNumber(): string {
  const digits = Math.floor(100000 + Math.random() * 900000);
  return `ORD-${digits}`;
}

export function formatPrice(amount: number, currency: string): string {
  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(amount);
  return `${formatted} ${currency}`;
}

export function formatDateTimeAr(date: Date | null): string {
  if (!date) return 'الآن';
  return new Intl.DateTimeFormat('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatDateShort(date: Date | null): string {
  if (!date) return '—';
  return new Intl.DateTimeFormat('ar-EG', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function buildWhatsAppOrderLink(order: Order): string {
  const digitsOnly = normalizeArabicDigits(order.phone).replace(/[^0-9]/g, '');
  let international = digitsOnly;
  if (digitsOnly.startsWith('01') && digitsOnly.length === 11) {
    international = `2${digitsOnly}`;
  } else if (digitsOnly.startsWith('05') && digitsOnly.length === 10) {
    international = `966${digitsOnly.slice(1)}`;
  }
  const message = [
    `مرحباً ${order.customerName}،`,
    `نؤكد استلام طلبك رقم ${order.orderNumber}:`,
    `المنتج: ${order.productName}`,
    `الكمية: ${order.quantity}`,
    `الإجمالي عند الاستلام: ${formatPrice(order.totalPrice, order.currency)}`,
    `العنوان: ${order.governorate} - ${order.address}`,
    `هل البيانات صحيحة لتجهيز الشحن؟`,
  ].join('\n');

  return `https://wa.me/${international}?text=${encodeURIComponent(message)}`;
}

export function buildMerchantWhatsAppUrl(whatsappNumber: string, productName: string): string {
  const digitsOnly = normalizeArabicDigits(whatsappNumber).replace(/[^0-9]/g, '');
  let international = digitsOnly;
  if (digitsOnly.startsWith('01') && digitsOnly.length === 11) {
    international = `2${digitsOnly}`;
  } else if (digitsOnly.startsWith('05') && digitsOnly.length === 10) {
    international = `966${digitsOnly.slice(1)}`;
  }
  const text = `مرحباً، أريد الاستفسار عن منتج: ${productName}`;
  return `https://wa.me/${international}?text=${encodeURIComponent(text)}`;
}

/**
 * Plays a pleasant crisp dual-tone chime via Web Audio API for new order alerts.
 */
export function playOrderNotificationSound(): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const notes = [
      { freq: 587.33, start: 0, duration: 0.14 },
      { freq: 880.0, start: 0.14, duration: 0.28 },
    ];

    for (const note of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(note.freq, now + note.start);

      gain.gain.setValueAtTime(0.001, now + note.start);
      gain.gain.exponentialRampToValueAtTime(0.22, now + note.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + note.start + note.duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + note.start);
      osc.stop(now + note.start + note.duration + 0.02);
    }

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 650);
  } catch {
    // Browser autoplay policy may block audio until first interaction
  }
}

export const BUILTIN_STUDIO_IMAGES = [
  {
    url: '/images/product_watch_main.jpg',
    label: 'ساعة تيتانيوم — صورة رئيسية',
  },
  {
    url: '/images/product_watch_detail.jpg',
    label: 'ساعة تيتانيوم — تفاصيل جانبية',
  },
  {
    url: '/images/product_espresso_main.jpg',
    label: 'ماكينة إسبريسو — صورة رئيسية',
  },
  {
    url: '/images/product_espresso_detail.jpg',
    label: 'ماكينة إسبريسو — الملحقات',
  },
];

export const DEFAULT_PRODUCT_FAQS: ProductFaq[] = [
  {
    id: 'faq-cod',
    question: 'هل الدفع عند الاستلام متاح ومعاينة المنتج قبل الدفع؟',
    answer:
      'نعم، يمكنك الدفع نقداً للمندوب عند استلام الطلب ومعاينة المنتج بالكامل للتأكد من مطابقته للمواصفات قبل السداد.',
  },
  {
    id: 'faq-shipping',
    question: 'كم يستغرق التوصيل داخل القاهرة والمحافظات؟',
    answer:
      'يصل الطلب خلال 24 إلى 48 ساعة داخل القاهرة والجيزة والإسكندرية، ومن 2 إلى 4 أيام عمل لباقي المحافظات.',
  },
  {
    id: 'faq-return',
    question: 'ما هي سياسة الاستبدال والاسترجاع؟',
    answer:
      'نوفر ضمان استبدال واسترجاع مجاني خلال 14 يوماً من تاريخ الاستلام في حالة وجود أي عيب صناعة أو اختلاف في المواصفات.',
  },
];

export const DEMO_PRODUCTS_SEED: Array<{
  slug: string;
  name: string;
  price: number;
  compareAtPrice: number;
  currency: string;
  description: string;
  features: string[];
  images: string[];
  isActive: boolean;
  themeId: 'emerald' | 'amber';
  stockRemaining: number;
  showCountdown: boolean;
  countdownMinutes: number;
  reviews: ProductReview[];
  faqs: ProductFaq[];
}> = [
  {
    slug: 'titanium-watch-pro',
    name: 'ساعة تيتانيوم الذكية المقاومة للماء — إصدار برو',
    price: 1850,
    compareAtPrice: 2400,
    currency: 'ج.م',
    description:
      'ساعة ذكية بإطار من التيتانيوم المصقول وشاشة AMOLED عالية السطوع، تجمع بين التصميم الكلاسيكي الأنيق ومتابعة النشاط الرياضي والمكالمات بوضوح تام مع بطارية تدوم حتى 14 يوماً بشحنة واحدة.',
    features: [
      'هيكل تيتانيوم خفيف الوزن ومقاوم للخدش والماء حتى عمق 50 متراً',
      'بطارية طويلة العمر تعمل حتى 14 يوماً مع شحن مغناطيسي سريع',
      'إجراء واستقبال المكالمات وإشعارات واتساب باللغة العربية الكاملة',
      'حساسات دقيقة لنبض القلب والأكسجين وتتبع جودة النوم يومياً',
      'سوار سيليكون رياضي مريح مع ضمان استبدال لمدة عام كامل',
    ],
    images: ['/images/product_watch_main.jpg', '/images/product_watch_detail.jpg'],
    isActive: true,
    themeId: 'emerald',
    stockRemaining: 9,
    showCountdown: true,
    countdownMinutes: 180,
    reviews: [
      {
        id: 'rev-1',
        author: 'كريم المنصوري',
        city: 'القاهرة',
        rating: 5,
        comment:
          'الخامة فخمة جداً وأخف على اليد مما توقعت، الشاشة واضحة حتى في الشمس والبطارية كملت معايا 12 يوم فعلاً.',
      },
      {
        id: 'rev-2',
        author: 'سارة عبد الرحمن',
        city: 'الإسكندرية',
        rating: 5,
        comment:
          'طلبتها هدية ووصلت تاني يوم بالتغليف الأصلي وعاينتها مع المندوب قبل الدفع. تجربة ممتازة.',
      },
      {
        id: 'rev-3',
        author: 'محمود الشاذلي',
        city: 'الجيزة',
        rating: 5,
        comment: 'الإشعارات بالعربي مظبوطة ومكالمات البلوتوث صوتها نقي جداً مقارنة بسعرها.',
      },
    ],
    faqs: DEFAULT_PRODUCT_FAQS,
  },
  {
    slug: 'portable-espresso-maker',
    name: 'ماكينة إسبريسو محمولة بضغط 18 بار — ستانلس ستيل',
    price: 2290,
    compareAtPrice: 2850,
    currency: 'ج.م',
    description:
      'استمتع بكوب إسبريسو غني بالكريما الذهبية في المنزل أو المكتب أو السفر دون الحاجة لكهرباء. تصميم معدني مدمج بضغط احترافي 18 بار مع فلتر ستانلس ستيل دقيق للبن المطحون.',
    features: [
      'ضغط استخلاص حقيقي 18 بار لاستخراج كريما كثيفة ومذاق متوازن',
      'مقياس ضغط مدمج للتحكم الكامل في جودة كل كوب قهوة',
      'سلة فلتر احترافية من الستانلس ستيل الغذائي سهل التنظيف',
      'تصميم مدمج ومتين مناسب للمكتب والمنزل والرحلات',
      'تشمل ملعقة قياس ومكبس بن خشبي فاخر داخل العبوة',
    ],
    images: ['/images/product_espresso_main.jpg', '/images/product_espresso_detail.jpg'],
    isActive: true,
    themeId: 'amber',
    stockRemaining: 6,
    showCountdown: true,
    countdownMinutes: 120,
    reviews: [
      {
        id: 'rev-e1',
        author: 'طارق حلمي',
        city: 'القاهرة',
        rating: 5,
        comment:
          'الكريما بتطلع كثيفة كأنها من ماكينة كافيه! بقيت باخدها معايا المكتب يومياً وتنظيفها بياخد ثواني.',
      },
      {
        id: 'rev-e2',
        author: 'ندى الشريف',
        city: 'المنصورة',
        rating: 5,
        comment: 'خامة الستانلس تقيلة ومحترمة جداً ووصلت سليمة تماماً مع مكبس البن الخشبي.',
      },
    ],
    faqs: DEFAULT_PRODUCT_FAQS,
  },
];
