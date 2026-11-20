'use client';

import React, { useEffect, useState, useRef } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import {
  Check,
  CheckCircle2,
  Minus,
  Plus,
  Package,
  Loader2,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { Product, GOVERNORATES, VALIDATION_LIMITS } from '@/lib/types';
import {
  formatPrice,
  generateOrderId,
  generateOrderNumber,
  validatePhoneInput,
  checkDuplicateOrder,
  recordSubmittedOrder,
  DEFAULT_PRODUCT_FAQS,
} from '@/lib/helpers';
import { resolveProductTheme } from '@/lib/themes';
import { useTheme, ThemeToggleButton } from '@/components/ThemeProvider';
import LiquidGlassCard from '@/components/landing/LiquidGlassCard';
import ProductStage3D from '@/components/landing/ProductStage3D';
import {
  OfferScarcityBar,
  TrustStrip,
  CustomerReviewsSection,
  FaqAccordionSection,
  FloatingWhatsAppButton,
} from '@/components/landing/LandingSections';

interface ProductLandingPageProps {
  slug: string;
}

interface SubmittedReceipt {
  orderNumber: string;
  customerName: string;
  phone: string;
  governorate: string;
  address: string;
  quantity: number;
  totalPrice: number;
  currency: string;
  productName: string;
}

export default function ProductLandingPage({ slug }: ProductLandingPageProps) {
  const { theme } = useTheme();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  // Order form state
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneHint, setPhoneHint] = useState<string | null>(null);
  const [governorate, setGovernorate] = useState(GOVERNORATES[0]);
  const [address, setAddress] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [honeypot, setHoneypot] = useState(''); // Anti-spam hidden honeypot
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<SubmittedReceipt | null>(null);

  const [showStickyCta, setShowStickyCta] = useState(false);
  const formSectionRef = useRef<HTMLDivElement | null>(null);
  const mountedAtRef = useRef<number>(0);

  useEffect(() => {
    mountedAtRef.current = Date.now();
  }, []);

  useEffect(() => {
    let active = true;
    const decodedSlug = decodeURIComponent(slug).trim().toLowerCase();

    async function fetchProduct() {
      if (!VALIDATION_LIMITS.SLUG_REGEX.test(decodedSlug)) {
        if (active) {
          setUnavailable(true);
          setLoading(false);
        }
        return;
      }

      try {
        const snap = await getDoc(doc(db, 'products', decodedSlug));
        if (!active) return;
        if (!snap.exists()) {
          setUnavailable(true);
          setLoading(false);
          return;
        }
        const data = snap.data();
        if (!data.isActive) {
          setUnavailable(true);
          setLoading(false);
          return;
        }

        const loaded: Product = {
          slug: data.slug,
          name: data.name,
          price: Number(data.price),
          compareAtPrice: Number(data.compareAtPrice || 0),
          currency: data.currency || 'ج.م',
          description: data.description || '',
          features: Array.isArray(data.features) ? data.features : [],
          images: Array.isArray(data.images) ? data.images : [],
          isActive: Boolean(data.isActive),
          themeId: data.themeId,
          model3dUrl: data.model3dUrl || '',
          whatsappNumber: data.whatsappNumber || '',
          stockRemaining:
            typeof data.stockRemaining === 'number' ? data.stockRemaining : undefined,
          showCountdown: Boolean(data.showCountdown),
          countdownMinutes:
            typeof data.countdownMinutes === 'number' ? data.countdownMinutes : undefined,
          reviews: Array.isArray(data.reviews) ? data.reviews : undefined,
          faqs: Array.isArray(data.faqs) ? data.faqs : undefined,
          createdBy: data.createdBy || '',
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : null,
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : null,
        };
        setProduct(loaded);
        document.title = loaded.name;
      } catch (err) {
        if (!active) return;
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('permission') || msg.includes('PERMISSION_DENIED')) {
          setUnavailable(true);
        } else {
          handleFirestoreError(err, OperationType.GET, `products/${decodedSlug}`);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchProduct();
    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    const target = formSectionRef.current;
    if (!target || receipt || !product) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setShowStickyCta(!entry.isIntersecting);
      },
      { threshold: 0.15 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [product, receipt]);

  const handlePhoneBlur = () => {
    if (!phone.trim()) {
      setPhoneHint(null);
      return;
    }
    const check = validatePhoneInput(phone);
    setPhoneHint(check.valid ? null : check.error || null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product || submitting) return;
    setFormError(null);

    // Silent anti-spam honeypot & superhuman submission guard
    if (honeypot.trim().length > 0 || Date.now() - mountedAtRef.current < 1200) {
      setFormError('يرجى التحقق من البيانات والمحاولة مرة أخرى.');
      return;
    }

    const cleanName = customerName.trim().slice(0, VALIDATION_LIMITS.CUSTOMER_NAME_MAX);
    const phoneCheck = validatePhoneInput(phone);
    const cleanPhone = phoneCheck.normalized.slice(0, VALIDATION_LIMITS.PHONE_MAX);
    const cleanGov = governorate.trim().slice(0, VALIDATION_LIMITS.GOVERNORATE_MAX);
    const cleanAddress = address.trim().slice(0, VALIDATION_LIMITS.ADDRESS_MAX);
    const cleanNotes = notes.trim().slice(0, VALIDATION_LIMITS.NOTES_MAX);
    const safeQty = Math.max(
      VALIDATION_LIMITS.QUANTITY_MIN,
      Math.min(VALIDATION_LIMITS.QUANTITY_MAX, Math.floor(quantity))
    );

    if (cleanName.length < VALIDATION_LIMITS.CUSTOMER_NAME_MIN) {
      setFormError('يرجى إدخال الاسم بالكامل.');
      return;
    }
    if (!phoneCheck.valid) {
      setPhoneHint(phoneCheck.error || null);
      setFormError(phoneCheck.error || 'يرجى إدخال رقم موبايل صحيح.');
      return;
    }
    if (cleanGov.length < VALIDATION_LIMITS.GOVERNORATE_MIN) {
      setFormError('يرجى اختيار المحافظة.');
      return;
    }
    if (cleanAddress.length < VALIDATION_LIMITS.ADDRESS_MIN) {
      setFormError('يرجى كتابة العنوان بالتفصيل لتسهيل التوصيل.');
      return;
    }

    // Duplicate order protection (same phone + same product within 5 minutes)
    if (checkDuplicateOrder(product.slug, cleanPhone)) {
      setFormError(
        'تم تسجيل طلبك لهذا المنتج بالفعل قبل دقائق. سنتواصل معك هاتفياً قريباً لتأكيد الشحن.'
      );
      return;
    }

    setSubmitting(true);
    const orderId = generateOrderId();
    const orderNumber = generateOrderNumber();
    const totalPrice = Math.round(product.price * safeQty * 100) / 100;

    try {
      await setDoc(doc(db, 'orders', orderId), {
        orderNumber,
        productSlug: product.slug,
        productName: product.name.slice(0, VALIDATION_LIMITS.PRODUCT_NAME_MAX),
        unitPrice: product.price,
        currency: product.currency.slice(0, VALIDATION_LIMITS.CURRENCY_MAX),
        quantity: safeQty,
        totalPrice,
        customerName: cleanName,
        phone: cleanPhone,
        governorate: cleanGov,
        address: cleanAddress,
        notes: cleanNotes,
        paymentMethod: 'cod',
        status: 'new',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      recordSubmittedOrder(product.slug, cleanPhone);

      fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          orderNumber,
          customerName: cleanName,
          phone: cleanPhone,
          governorate: cleanGov,
          address: cleanAddress,
          productName: product.name,
          productSlug: product.slug,
          quantity: safeQty,
          totalPrice,
          currency: product.currency,
          notes: cleanNotes,
        }),
      }).catch(() => {});

      setReceipt({
        orderNumber,
        customerName: cleanName,
        phone: cleanPhone,
        governorate: cleanGov,
        address: cleanAddress,
        quantity: safeQty,
        totalPrice,
        currency: product.currency,
        productName: product.name,
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.CREATE, `orders/${orderId}`);
      } catch {
        setFormError('تعذر تسجيل الطلب حالياً. يرجى التحقق من البيانات والمحاولة مرة أخرى.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const activeTheme = resolveProductTheme(product?.slug || slug, product?.themeId);
  const isDark = theme === 'dark';

  const themeVars = {
    '--accent-primary': activeTheme.primary,
    '--accent-primary-hover': activeTheme.primaryHover,
    '--accent-secondary': activeTheme.secondary,
    '--accent-glow': activeTheme.glow,
    '--blob-1': isDark ? activeTheme.blobOneDark : activeTheme.blobOneLight,
    '--blob-2': isDark ? activeTheme.blobTwoDark : activeTheme.blobTwoLight,
    '--blob-3': isDark ? activeTheme.blobThreeDark : activeTheme.blobThreeLight,
  } as React.CSSProperties;

  const AmbientMeshBackdrop = (
    <div aria-hidden="true" className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <div
        className="absolute -top-32 -right-24 w-[460px] h-[460px] rounded-full blur-[90px] animate-blob-a"
        style={{ background: 'var(--blob-1)' }}
      />
      <div
        className="absolute top-[34%] -left-28 w-[420px] h-[420px] rounded-full blur-[100px] animate-blob-b"
        style={{ background: 'var(--blob-2)' }}
      />
      <div
        className="absolute -bottom-32 right-[22%] w-[440px] h-[440px] rounded-full blur-[100px] animate-blob-c"
        style={{ background: 'var(--blob-3)' }}
      />
    </div>
  );

  // Loading Skeleton
  if (loading) {
    return (
      <main style={themeVars} className="relative min-h-screen py-8 px-4 sm:py-12">
        {AmbientMeshBackdrop}
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-5">
            <div className="aspect-[4/3] w-full rounded-[30px] liquid-glass animate-pulse" />
            <div className="h-32 w-full rounded-[28px] liquid-glass animate-pulse" />
            <div className="h-44 w-full rounded-[28px] liquid-glass animate-pulse" />
          </div>
          <div className="lg:col-span-5">
            <div className="h-[520px] w-full rounded-[28px] liquid-glass animate-pulse" />
          </div>
        </div>
      </main>
    );
  }

  // Unavailable Product State
  if (unavailable || !product) {
    return (
      <main
        style={themeVars}
        className="relative min-h-screen flex items-center justify-center px-4 py-12"
      >
        {AmbientMeshBackdrop}
        <div className="fixed top-4 left-4 z-30">
          <ThemeToggleButton />
        </div>
        <LiquidGlassCard strong className="max-w-md w-full p-8 text-center">
          <div className="w-14 h-14 rounded-[20px] bg-zinc-200/60 dark:bg-white/10 text-zinc-500 dark:text-zinc-300 flex items-center justify-center mx-auto mb-4">
            <Package className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-zinc-950 dark:text-white mb-2">
            هذا العرض غير متاح حالياً
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
            قد يكون الرابط غير صحيح أو تم إيقاف هذا المنتج مؤقتاً. يرجى التواصل مع البائع للحصول على
            الرابط المحدّث.
          </p>
        </LiquidGlassCard>
      </main>
    );
  }

  // Post-Order Thank You & Confirmation View
  if (receipt) {
    return (
      <main
        style={themeVars}
        className="relative min-h-screen flex items-center justify-center px-4 py-10"
      >
        {AmbientMeshBackdrop}
        <div className="fixed top-4 left-4 z-30">
          <ThemeToggleButton />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-lg"
        >
          <LiquidGlassCard strong className="p-6 sm:p-8">
            <div className="flex flex-col items-center text-center pb-6 border-b border-zinc-200/60 dark:border-white/10">
              <div className="w-16 h-16 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h1 className="text-2xl font-bold text-zinc-950 dark:text-white mb-2">
                تم استلام طلبك بنجاح
              </h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed max-w-sm">
                شكراً لك يا {receipt.customerName}. سنتواصل معك قريباً على رقم الموبايل لتأكيد موعد
                الشحن والتوصيل.
              </p>
              <div className="mt-4 text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                <span>رقم الطلب</span>
                <span aria-hidden="true">·</span>
                <span
                  className="font-mono font-semibold text-zinc-950 dark:text-white tabular-nums"
                  dir="ltr"
                >
                  {receipt.orderNumber}
                </span>
              </div>
            </div>

            <dl className="divide-y divide-zinc-200/50 dark:divide-white/10 text-sm my-4">
              <div className="py-3 flex items-start justify-between gap-4">
                <dt className="text-zinc-500 dark:text-zinc-400 shrink-0">المنتج</dt>
                <dd className="font-medium text-zinc-950 dark:text-white text-left">
                  {receipt.productName}
                </dd>
              </div>
              <div className="py-3 flex items-center justify-between gap-4">
                <dt className="text-zinc-500 dark:text-zinc-400">الكمية</dt>
                <dd className="font-mono font-semibold text-zinc-950 dark:text-white tabular-nums">
                  {receipt.quantity}
                </dd>
              </div>
              <div className="py-3 flex items-center justify-between gap-4">
                <dt className="text-zinc-500 dark:text-zinc-400">رقم الموبايل</dt>
                <dd className="font-mono text-zinc-950 dark:text-white tabular-nums" dir="ltr">
                  {receipt.phone}
                </dd>
              </div>
              <div className="py-3 flex items-start justify-between gap-4">
                <dt className="text-zinc-500 dark:text-zinc-400 shrink-0">عنوان التوصيل</dt>
                <dd className="text-zinc-950 dark:text-white text-left">
                  {receipt.governorate} — {receipt.address}
                </dd>
              </div>
              <div className="py-3 flex items-center justify-between gap-4">
                <dt className="text-zinc-500 dark:text-zinc-400">طريقة الدفع</dt>
                <dd className="font-medium text-emerald-700 dark:text-emerald-400">
                  الدفع نقداً عند الاستلام
                </dd>
              </div>
              <div className="pt-4 flex items-center justify-between gap-4">
                <dt className="font-semibold text-zinc-950 dark:text-white">
                  الإجمالي عند الاستلام
                </dt>
                <dd
                  className="text-xl font-bold font-mono tabular-nums"
                  style={{ color: 'var(--accent-primary)' }}
                >
                  {formatPrice(receipt.totalPrice, receipt.currency)}
                </dd>
              </div>
            </dl>

            <button
              type="button"
              onClick={() => {
                setReceipt(null);
                setQuantity(1);
                setNotes('');
              }}
              className="w-full mt-4 py-3 px-4 rounded-[18px] liquid-glass-subtle hover:bg-white/70 dark:hover:bg-white/10 text-zinc-800 dark:text-zinc-100 text-sm font-medium transition-colors cursor-pointer"
            >
              العودة إلى صفحة المنتج
            </button>
          </LiquidGlassCard>
        </motion.div>
      </main>
    );
  }

  const hasDiscount = product.compareAtPrice > product.price;
  const discountAmount = hasDiscount ? product.compareAtPrice - product.price : 0;
  const discountPercent = hasDiscount
    ? Math.round((discountAmount / product.compareAtPrice) * 100)
    : 0;
  const totalAmount = Math.round(product.price * quantity * 100) / 100;

  // Show custom FAQs if defined; gracefully show default COD FAQs for legacy products without custom FAQs
  const displayFaqs = product.faqs !== undefined ? product.faqs : DEFAULT_PRODUCT_FAQS;
  const displayReviews = product.reviews ?? [];

  const scrollToForm = () => {
    formSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <main style={themeVars} className="relative min-h-screen pb-24 lg:pb-16">
      {AmbientMeshBackdrop}

      {/* Minimal Floating Light/Dark Switcher Only — Zero Navbar, Zero Footer, Zero Store Links */}
      <div className="fixed top-4 left-4 z-30">
        <ThemeToggleButton />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 lg:pt-12 space-y-10">
        {/* Primary Conversion Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          {/* Column 1: 1. 3D/Gallery Stage -> 2. Title & Price -> 3. Scarcity -> 4. Description & Features */}
          <div className="lg:col-span-7 space-y-6">
            {/* 1. Interactive 3D / Parallax Product Stage */}
            <ProductStage3D
              productName={product.name}
              images={product.images}
              model3dUrl={product.model3dUrl}
              accentHex={activeTheme.primary}
            />

            {/* 2. Product Name + 3. Price & Optional Scarcity */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              <LiquidGlassCard className="p-6 sm:p-7 space-y-4">
                <h1 className="text-2xl sm:text-3xl font-bold text-zinc-950 dark:text-white leading-snug text-balance">
                  {product.name}
                </h1>

                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <span
                    className="text-3xl sm:text-4xl font-bold font-mono tabular-nums"
                    style={{ color: 'var(--accent-primary)' }}
                  >
                    {formatPrice(product.price, product.currency)}
                  </span>
                  {hasDiscount && (
                    <span className="text-lg text-zinc-400 dark:text-zinc-500 line-through font-mono tabular-nums">
                      {formatPrice(product.compareAtPrice, product.currency)}
                    </span>
                  )}
                </div>

                {hasDiscount && (
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                    وفر {formatPrice(discountAmount, product.currency)} · خصم {discountPercent}%
                    لفترة محدودة
                  </p>
                )}

                <OfferScarcityBar
                  stockRemaining={product.stockRemaining}
                  showCountdown={product.showCountdown}
                  countdownMinutes={product.countdownMinutes}
                  productSlug={product.slug}
                />
              </LiquidGlassCard>
            </motion.div>

            {/* 4. Description & Features */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <LiquidGlassCard className="p-6 sm:p-7 space-y-6">
                <div>
                  <h2 className="text-base font-bold text-zinc-950 dark:text-white mb-2.5">
                    عن المنتج
                  </h2>
                  <p className="text-zinc-700 dark:text-zinc-300 text-[15px] leading-8 whitespace-pre-line">
                    {product.description}
                  </p>
                </div>

                {product.features.length > 0 && (
                  <div className="pt-5 border-t border-zinc-200/60 dark:border-white/10">
                    <h2 className="text-base font-bold text-zinc-950 dark:text-white mb-3.5">
                      أبرز المميزات
                    </h2>
                    <ul className="space-y-3">
                      {product.features.map((feat, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-3 text-[15px] text-zinc-800 dark:text-zinc-200 leading-6"
                        >
                          <span
                            className="mt-0.5 shrink-0 w-6 h-6 rounded-full flex items-center justify-center bg-white/80 dark:bg-white/10 shadow-sm"
                            style={{ color: 'var(--accent-primary)' }}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </span>
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </LiquidGlassCard>
            </motion.div>

            {/* Trust Pillars */}
            <TrustStrip />
          </div>

          {/* Column 2: 5. Liquid Glass COD Order Form + 6. Spring "اطلب الآن" CTA */}
          <div ref={formSectionRef} className="lg:col-span-5 lg:sticky lg:top-8">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            >
              <LiquidGlassCard strong className="p-6 sm:p-7">
                <div className="pb-4 mb-5 border-b border-zinc-200/60 dark:border-white/10">
                  <h2 className="text-lg font-bold text-zinc-950 dark:text-white">
                    اطلب الآن — الدفع عند الاستلام
                  </h2>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                    سجّل بياناتك في 30 ثانية وسنتواصل معك لتأكيد الشحن
                  </p>
                </div>

                {formError && (
                  <div
                    role="alert"
                    className="mb-4 p-3.5 rounded-[18px] bg-rose-500/12 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs sm:text-sm flex items-start gap-2.5 leading-5"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{formError}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Anti-Spam Honeypot (visually hidden from humans) */}
                  <div className="hidden" aria-hidden="true">
                    <label htmlFor="companyWebsite">Website</label>
                    <input
                      id="companyWebsite"
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      value={honeypot}
                      onChange={(e) => setHoneypot(e.target.value)}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="customerName"
                      className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1.5"
                    >
                      الاسم بالكامل <span className="text-rose-600">*</span>
                    </label>
                    <input
                      id="customerName"
                      type="text"
                      required
                      maxLength={VALIDATION_LIMITS.CUSTOMER_NAME_MAX}
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="مثال: أحمد محمود علي"
                      className="w-full h-12 px-4 rounded-[18px] liquid-input text-zinc-950 dark:text-white text-sm placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="phone"
                      className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1.5"
                    >
                      رقم الموبايل <span className="text-rose-600">*</span>
                    </label>
                    <input
                      id="phone"
                      type="tel"
                      required
                      dir="ltr"
                      maxLength={VALIDATION_LIMITS.PHONE_MAX}
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        if (phoneHint) setPhoneHint(null);
                      }}
                      onBlur={handlePhoneBlur}
                      placeholder="01012345678"
                      className="w-full h-12 px-4 rounded-[18px] liquid-input text-zinc-950 dark:text-white text-sm font-mono tabular-nums text-right placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
                    />
                    {phoneHint && (
                      <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-300 leading-5">
                        {phoneHint}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="governorate"
                        className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1.5"
                      >
                        المحافظة <span className="text-rose-600">*</span>
                      </label>
                      <select
                        id="governorate"
                        required
                        value={governorate}
                        onChange={(e) => setGovernorate(e.target.value)}
                        className="w-full h-12 px-3.5 rounded-[18px] liquid-input text-zinc-950 dark:text-white text-sm"
                      >
                        {GOVERNORATES.map((gov) => (
                          <option
                            key={gov}
                            value={gov}
                            className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white"
                          >
                            {gov}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <span className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1.5">
                        الكمية
                      </span>
                      <div className="flex items-center h-12 rounded-[18px] liquid-input overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                          aria-label="تقليل الكمية"
                          className="w-12 h-full flex items-center justify-center text-zinc-700 dark:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="flex-1 text-center text-sm font-mono font-bold text-zinc-950 dark:text-white tabular-nums">
                          {quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setQuantity((q) => Math.min(VALIDATION_LIMITS.QUANTITY_MAX, q + 1))
                          }
                          aria-label="زيادة الكمية"
                          className="w-12 h-full flex items-center justify-center text-zinc-700 dark:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="address"
                      className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1.5"
                    >
                      العنوان بالتفصيل <span className="text-rose-600">*</span>
                    </label>
                    <textarea
                      id="address"
                      required
                      rows={2}
                      maxLength={VALIDATION_LIMITS.ADDRESS_MAX}
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="الحي / الشارع / رقم العمارة والدور / علامة مميزة"
                      className="w-full px-4 py-3 rounded-[18px] liquid-input text-zinc-950 dark:text-white text-sm placeholder:text-zinc-400 dark:placeholder:text-zinc-500 resize-none"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="notes"
                      className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1.5"
                    >
                      ملاحظات إضافية{' '}
                      <span className="text-zinc-400 dark:text-zinc-500 font-normal">(اختياري)</span>
                    </label>
                    <input
                      id="notes"
                      type="text"
                      maxLength={VALIDATION_LIMITS.NOTES_MAX}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="مثال: وقت التواصل المفضل أو اللون المطلوب"
                      className="w-full h-12 px-4 rounded-[18px] liquid-input text-zinc-950 dark:text-white text-sm placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
                    />
                  </div>

                  {/* Liquid Summary Strip */}
                  <div className="pt-4 border-t border-zinc-200/60 dark:border-white/10 space-y-2">
                    <div className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
                      <span>
                        سعر القطعة × <span className="font-mono tabular-nums">{quantity}</span>
                      </span>
                      <span className="font-mono tabular-nums">
                        {formatPrice(totalAmount, product.currency)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-zinc-950 dark:text-white">
                        الإجمالي عند الاستلام
                      </span>
                      <span
                        className="text-2xl font-bold font-mono tabular-nums"
                        style={{ color: 'var(--accent-primary)' }}
                      >
                        {formatPrice(totalAmount, product.currency)}
                      </span>
                    </div>
                  </div>

                  {/* 6. Liquid Spring CTA Button */}
                  <motion.button
                    type="submit"
                    disabled={submitting}
                    whileHover={submitting ? undefined : { scale: 1.015 }}
                    whileTap={submitting ? undefined : { scale: 0.97 }}
                    transition={{ type: 'spring', stiffness: 360, damping: 22 }}
                    className="w-full h-13 py-3.5 rounded-[20px] liquid-cta disabled:opacity-60 text-white font-bold text-base flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        جارٍ تسجيل الطلب...
                      </>
                    ) : (
                      'اطلب الآن'
                    )}
                  </motion.button>

                  <p className="text-[11px] text-center text-zinc-500 dark:text-zinc-400 flex items-center justify-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                    <span>بياناتك آمنة وتُستخدم لتأكيد وتوصيل طلبك فقط</span>
                  </p>
                </form>
              </LiquidGlassCard>
            </motion.div>
          </div>
        </div>

        {/* Customer Reviews Section */}
        <CustomerReviewsSection reviews={displayReviews} />

        {/* FAQ Liquid Glass Accordion */}
        <FaqAccordionSection faqs={displayFaqs} />
      </div>

      {/* Floating Direct WhatsApp Contact Button */}
      <FloatingWhatsAppButton
        whatsappNumber={product.whatsappNumber}
        productName={product.name}
        offsetForStickyBar={showStickyCta}
      />

      {/* Mobile Sticky Bottom Conversion Bar (<= 15% mobile viewport height) */}
      <AnimatePresence>
        {showStickyCta && (
          <motion.div
            initial={{ y: 90, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 90, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="lg:hidden fixed bottom-0 inset-x-0 z-30 liquid-glass-strong rounded-t-[24px] px-4 py-2.5"
          >
            <div className="max-w-lg mx-auto flex items-center justify-between gap-4">
              <div>
                <div
                  className="text-lg font-bold font-mono tabular-nums leading-tight"
                  style={{ color: 'var(--accent-primary)' }}
                >
                  {formatPrice(totalAmount, product.currency)}
                </div>
                <div className="text-[11px] text-zinc-600 dark:text-zinc-400">
                  الدفع نقداً عند الاستلام
                </div>
              </div>
              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={scrollToForm}
                className="px-6 py-2.5 rounded-[16px] liquid-cta text-white text-sm font-bold whitespace-nowrap shrink-0 cursor-pointer"
              >
                اطلب الآن
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
