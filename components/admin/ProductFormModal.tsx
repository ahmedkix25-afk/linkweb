'use client';

import React, { useState, useRef } from 'react';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  X,
  Plus,
  Trash2,
  Upload,
  Link2,
  ImageIcon,
  Loader2,
  AlertCircle,
  Check,
  ArrowUp,
  Palette,
  Box,
  ChevronDown,
} from 'lucide-react';
import { db, storage, handleFirestoreError, OperationType } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import {
  Product,
  ProductFaq,
  ProductReview,
  ProductThemeId,
  CURRENCIES,
  VALIDATION_LIMITS,
} from '@/lib/types';
import {
  slugifyProductName,
  sanitizeSlugInput,
  BUILTIN_STUDIO_IMAGES,
  DEFAULT_PRODUCT_FAQS,
} from '@/lib/helpers';
import { THEME_OPTIONS } from '@/lib/themes';

interface ProductFormModalProps {
  product: Product | null;
  onClose: () => void;
  onSaved: (slug: string, isNew: boolean) => void;
}

export default function ProductFormModal({ product, onClose, onSaved }: ProductFormModalProps) {
  const { user } = useAuth();
  const isEditing = Boolean(product);

  const [name, setName] = useState(product?.name ?? '');
  const [slug, setSlug] = useState(product?.slug ?? '');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(isEditing);
  const [price, setPrice] = useState(product ? String(product.price) : '');
  const [compareAtPrice, setCompareAtPrice] = useState(
    product && product.compareAtPrice > 0 ? String(product.compareAtPrice) : ''
  );
  const [currency, setCurrency] = useState(product?.currency ?? CURRENCIES[0].code);
  const [description, setDescription] = useState(product?.description ?? '');
  const [features, setFeatures] = useState<string[]>(
    product?.features.length ? product.features : ['']
  );
  const [images, setImages] = useState<string[]>(product?.images ?? []);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [isActive, setIsActive] = useState(product?.isActive ?? true);

  // Phase 1 Landing Page Customization Fields
  const [showDesignSection, setShowDesignSection] = useState(false);
  const [themeId, setThemeId] = useState<ProductThemeId>(product?.themeId ?? 'emerald');
  const [model3dUrl, setModel3dUrl] = useState(product?.model3dUrl ?? '');
  const [whatsappNumber, setWhatsappNumber] = useState(product?.whatsappNumber ?? '');
  const [stockRemaining, setStockRemaining] = useState(
    product?.stockRemaining && product.stockRemaining > 0 ? String(product.stockRemaining) : ''
  );
  const [showCountdown, setShowCountdown] = useState(Boolean(product?.showCountdown));
  const [countdownMinutes, setCountdownMinutes] = useState(
    product?.countdownMinutes && product.countdownMinutes > 0
      ? String(product.countdownMinutes)
      : '120'
  );
  const [reviews, setReviews] = useState<ProductReview[]>(product?.reviews ?? []);
  const [faqs, setFaqs] = useState<ProductFaq[]>(
    product?.faqs !== undefined ? product.faqs : DEFAULT_PRODUCT_FAQS
  );

  const [uploading, setUploading] = useState(false);
  const [uploadingGlb, setUploadingGlb] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showStudioPicker, setShowStudioPicker] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const glbInputRef = useRef<HTMLInputElement | null>(null);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!isEditing && !slugManuallyEdited) {
      setSlug(slugifyProductName(val));
    }
  };

  const handleAddFeature = () => {
    if (features.length >= VALIDATION_LIMITS.FEATURES_MAX_COUNT) return;
    setFeatures((prev) => [...prev, '']);
  };

  const handleFeatureChange = (idx: number, val: string) => {
    setFeatures((prev) => prev.map((item, i) => (i === idx ? val : item)));
  };

  const handleRemoveFeature = (idx: number) => {
    setFeatures((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAddImageUrl = () => {
    const trimmed = imageUrlInput.trim();
    if (!trimmed) return;
    if (images.length >= VALIDATION_LIMITS.IMAGES_MAX_COUNT) {
      setUploadError(`الحد الأقصى هو ${VALIDATION_LIMITS.IMAGES_MAX_COUNT} صور للمنتج.`);
      return;
    }
    if (!trimmed.startsWith('https://') && !trimmed.startsWith('http://') && !trimmed.startsWith('/')) {
      setUploadError('يرجى إدخال رابط صورة صحيح يبدأ بـ https:// أو /images/');
      return;
    }
    setImages((prev) => [...prev, trimmed.slice(0, VALIDATION_LIMITS.IMAGE_URL_MAX)]);
    setImageUrlInput('');
    setUploadError(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadError(null);

    const remainingSlots = VALIDATION_LIMITS.IMAGES_MAX_COUNT - images.length;
    if (remainingSlots <= 0) {
      setUploadError(`الحد الأقصى هو ${VALIDATION_LIMITS.IMAGES_MAX_COUNT} صور للمنتج.`);
      return;
    }

    const selectedFiles = Array.from(files).slice(0, remainingSlots);
    setUploading(true);

    try {
      const uploadedUrls: string[] = [];
      for (const file of selectedFiles) {
        if (!file.type.startsWith('image/')) {
          throw new Error('يرجى اختيار ملفات صور فقط (JPG, PNG, WebP).');
        }
        if (file.size > 5 * 1024 * 1024) {
          throw new Error('حجم الصورة يجب ألا يتجاوز 5 ميجابايت.');
        }
        const safeFileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const storageRef = ref(storage, `products/${safeFileName}`);
        await uploadBytes(storageRef, file);
        const downloadUrl = await getDownloadURL(storageRef);
        uploadedUrls.push(downloadUrl);
      }
      setImages((prev) => [...prev, ...uploadedUrls]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (
        msg.includes('storage/unauthorized') ||
        msg.includes('retry-limit-exceeded') ||
        msg.includes('403') ||
        msg.includes('404')
      ) {
        setUploadError(
          'تعذر الرفع إلى Firebase Storage (تأكد من تفعيل Storage في Firebase Console). يمكنك إضافة الصورة عبر رابط مباشر أو اختيار من صور الاستوديو الجاهزة.'
        );
      } else {
        setUploadError(msg || 'تعذر رفع الصورة. يمكنك إضافتها عبر رابط مباشر أو اختيار صورة جاهزة.');
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleGlbUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    if (!file.name.toLowerCase().endsWith('.glb') && !file.name.toLowerCase().endsWith('.gltf')) {
      setUploadError('يرجى اختيار ملف 3D بصيغة .glb أو .gltf فقط.');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setUploadError('حجم ملف الـ 3D يجب ألا يتجاوز 15 ميجابايت لسرعة التحميل.');
      return;
    }
    setUploadingGlb(true);
    try {
      const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const storageRef = ref(storage, `models/${safeName}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setModel3dUrl(url);
    } catch {
      setUploadError('تعذر رفع ملف الـ GLB (تأكد من تفعيل Firebase Storage أو الصق رابطاً مباشراً للملف).');
    } finally {
      setUploadingGlb(false);
      if (glbInputRef.current) glbInputRef.current.value = '';
    }
  };

  const handleRemoveImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleMakePrimaryImage = (idx: number) => {
    if (idx === 0) return;
    setImages((prev) => {
      const next = [...prev];
      const [picked] = next.splice(idx, 1);
      next.unshift(picked);
      return next;
    });
  };

  const handleAddReview = () => {
    if (reviews.length >= VALIDATION_LIMITS.REVIEWS_MAX_COUNT) return;
    setReviews((prev) => [
      ...prev,
      {
        id: `rev_${Date.now()}_${prev.length}`,
        author: '',
        city: 'القاهرة',
        rating: 5,
        comment: '',
      },
    ]);
  };

  const handleAddFaq = () => {
    if (faqs.length >= VALIDATION_LIMITS.FAQS_MAX_COUNT) return;
    setFaqs((prev) => [
      ...prev,
      {
        id: `faq_${Date.now()}_${prev.length}`,
        question: '',
        answer: '',
      },
    ]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || saving) return;
    setFormError(null);

    const cleanName = name.trim().slice(0, VALIDATION_LIMITS.PRODUCT_NAME_MAX);
    const cleanSlug = sanitizeSlugInput(slug).replace(/^-|-$/g, '');
    const numericPrice = Number(price);
    const numericCompareAt = compareAtPrice.trim() ? Number(compareAtPrice) : 0;
    const cleanDesc = description.trim().slice(0, VALIDATION_LIMITS.DESCRIPTION_MAX);
    const cleanFeatures = features
      .map((f) => f.trim().slice(0, VALIDATION_LIMITS.FEATURE_ITEM_MAX))
      .filter(Boolean)
      .slice(0, VALIDATION_LIMITS.FEATURES_MAX_COUNT);
    const cleanImages = images
      .map((img) => img.trim().slice(0, VALIDATION_LIMITS.IMAGE_URL_MAX))
      .filter(Boolean)
      .slice(0, VALIDATION_LIMITS.IMAGES_MAX_COUNT);
    const cleanStock = stockRemaining.trim() ? Math.max(0, Math.min(100000, Math.floor(Number(stockRemaining)))) : 0;
    const cleanCountdownMins = countdownMinutes.trim()
      ? Math.max(0, Math.min(10080, Math.floor(Number(countdownMinutes))))
      : 0;
    const cleanReviews = reviews
      .filter((r) => r.author.trim() && r.comment.trim())
      .slice(0, VALIDATION_LIMITS.REVIEWS_MAX_COUNT)
      .map((r) => ({
        id: r.id,
        author: r.author.trim().slice(0, 80),
        city: r.city.trim().slice(0, 60),
        rating: Math.max(1, Math.min(5, Number(r.rating || 5))),
        comment: r.comment.trim().slice(0, 400),
        ...(r.imageUrl?.trim() ? { imageUrl: r.imageUrl.trim().slice(0, 600) } : {}),
      }));
    const cleanFaqs = faqs
      .filter((f) => f.question.trim() && f.answer.trim())
      .slice(0, VALIDATION_LIMITS.FAQS_MAX_COUNT)
      .map((f) => ({
        id: f.id,
        question: f.question.trim().slice(0, 200),
        answer: f.answer.trim().slice(0, 600),
      }));

    if (cleanName.length < VALIDATION_LIMITS.PRODUCT_NAME_MIN) {
      setFormError('يرجى إدخال اسم المنتج (حرفين على الأقل).');
      return;
    }
    if (
      cleanSlug.length < VALIDATION_LIMITS.SLUG_MIN ||
      !VALIDATION_LIMITS.SLUG_REGEX.test(cleanSlug)
    ) {
      setFormError('رابط الصفحة (Slug) يجب أن يحتوي على حروف إنجليزية صغيرة وأرقام وشرطة (-) فقط.');
      return;
    }
    if (!Number.isFinite(numericPrice) || numericPrice <= 0 || numericPrice > VALIDATION_LIMITS.PRICE_MAX) {
      setFormError('يرجى إدخال سعر بيع صحيح أكبر من صفر.');
      return;
    }
    if (
      !Number.isFinite(numericCompareAt) ||
      numericCompareAt < 0 ||
      numericCompareAt > VALIDATION_LIMITS.PRICE_MAX
    ) {
      setFormError('سعر قبل الخصم غير صالح.');
      return;
    }
    if (cleanDesc.length < VALIDATION_LIMITS.DESCRIPTION_MIN) {
      setFormError('يرجى كتابة وصف مختصر للمنتج (5 أحرف على الأقل).');
      return;
    }
    if (cleanImages.length < VALIDATION_LIMITS.IMAGES_MIN_COUNT) {
      setFormError('يرجى إضافة صورة واحدة على الأقل للمنتج.');
      return;
    }

    setSaving(true);
    try {
      const productRef = doc(db, 'products', cleanSlug);
      const sharedFields = {
        name: cleanName,
        price: numericPrice,
        compareAtPrice: numericCompareAt,
        currency: currency.slice(0, VALIDATION_LIMITS.CURRENCY_MAX),
        description: cleanDesc,
        features: cleanFeatures,
        images: cleanImages,
        isActive,
        themeId,
        model3dUrl: model3dUrl.trim().slice(0, 1000),
        whatsappNumber: whatsappNumber.trim().slice(0, 25),
        stockRemaining: cleanStock,
        showCountdown,
        countdownMinutes: cleanCountdownMins,
        reviews: cleanReviews,
        faqs: cleanFaqs,
      };

      if (!isEditing) {
        const existingSnap = await getDoc(productRef);
        if (existingSnap.exists()) {
          setFormError(`الرابط "/p/${cleanSlug}" مستخدم لمنتج آخر. يرجى اختيار رابط مختلف.`);
          setSaving(false);
          return;
        }

        await setDoc(productRef, {
          slug: cleanSlug,
          ...sharedFields,
          createdBy: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(productRef, {
          ...sharedFields,
          updatedAt: serverTimestamp(),
        });
      }

      onSaved(cleanSlug, !isEditing);
    } catch (err) {
      try {
        handleFirestoreError(
          err,
          isEditing ? OperationType.UPDATE : OperationType.CREATE,
          `products/${cleanSlug}`
        );
      } catch {
        setFormError('تعذر حفظ المنتج. يرجى مراجعة الحقول والمحاولة مجدداً.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-zinc-950/45 backdrop-blur-[2px] flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-modal-title"
    >
      <div className="bg-white dark:bg-slate-900 border border-zinc-200 dark:border-white/15 rounded-[24px] w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden my-auto shadow-2xl">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-white/10 flex items-center justify-between gap-4 shrink-0">
          <div>
            <h2 id="product-modal-title" className="text-lg font-bold text-zinc-950 dark:text-white">
              {isEditing ? 'تعديل المنتج' : 'إضافة منتج وصفحة بيع جديدة'}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {isEditing
                ? 'سيتم تحديث صفحة البيع مباشرة فور الحفظ'
                : 'ستتولد صفحة بيع Liquid Glass + 3D جاهزة للنسخ فور الحفظ'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="w-9 h-9 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-5 flex-1">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {/* Product Name */}
          <div>
            <label htmlFor="prod-name" className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1.5">
              اسم المنتج <span className="text-rose-600">*</span>
            </label>
            <input
              id="prod-name"
              type="text"
              required
              maxLength={VALIDATION_LIMITS.PRODUCT_NAME_MAX}
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="مثال: ساعة تيتانيوم ذكية مقاومة للماء"
              className="w-full h-11 px-3.5 rounded-xl border border-zinc-300 dark:border-white/15 bg-white dark:bg-slate-800 text-sm text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            />
          </div>

          {/* Slug & Live Link Preview */}
          <div>
            <label htmlFor="prod-slug" className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1.5">
              رابط الصفحة (Slug) <span className="text-rose-600">*</span>
            </label>
            <div className="flex items-center border border-zinc-300 dark:border-white/15 rounded-xl overflow-hidden bg-white dark:bg-slate-800">
              <input
                id="prod-slug"
                type="text"
                required
                dir="ltr"
                disabled={isEditing}
                maxLength={VALIDATION_LIMITS.SLUG_MAX}
                value={slug}
                onChange={(e) => {
                  setSlugManuallyEdited(true);
                  setSlug(sanitizeSlugInput(e.target.value));
                }}
                placeholder="smart-watch-pro"
                className="flex-1 h-11 px-3.5 text-sm font-mono text-zinc-950 dark:text-white bg-transparent disabled:opacity-60 focus:outline-none text-left"
              />
              <span
                dir="ltr"
                className="px-3 h-11 flex items-center bg-zinc-50 dark:bg-slate-700/60 border-r border-zinc-200 dark:border-white/10 text-xs font-mono text-zinc-500 dark:text-zinc-300 shrink-0"
              >
                /p/
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400 shrink-0" />
              <span>رابط صفحة البيع:</span>
              <span className="font-mono text-zinc-800 dark:text-zinc-200" dir="ltr">
                /p/{slug || 'product-slug'}
              </span>
            </p>
          </div>

          {/* Price, Compare-at Price, Currency */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="prod-price" className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1.5">
                سعر البيع <span className="text-rose-600">*</span>
              </label>
              <input
                id="prod-price"
                type="number"
                required
                min="1"
                step="any"
                dir="ltr"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="1850"
                className="w-full h-11 px-3.5 rounded-xl border border-zinc-300 dark:border-white/15 bg-white dark:bg-slate-800 text-sm font-mono tabular-nums text-right text-zinc-950 dark:text-white"
              />
            </div>

            <div>
              <label htmlFor="prod-compare" className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1.5">
                سعر قبل الخصم <span className="text-zinc-400 font-normal">(اختياري)</span>
              </label>
              <input
                id="prod-compare"
                type="number"
                min="0"
                step="any"
                dir="ltr"
                value={compareAtPrice}
                onChange={(e) => setCompareAtPrice(e.target.value)}
                placeholder="2400"
                className="w-full h-11 px-3.5 rounded-xl border border-zinc-300 dark:border-white/15 bg-white dark:bg-slate-800 text-sm font-mono tabular-nums text-right text-zinc-950 dark:text-white"
              />
            </div>

            <div>
              <label htmlFor="prod-currency" className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1.5">
                العملة
              </label>
              <select
                id="prod-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-zinc-300 dark:border-white/15 bg-white dark:bg-slate-800 text-sm text-zinc-950 dark:text-white"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="prod-desc" className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1.5">
              وصف مختصر للمنتج <span className="text-rose-600">*</span>
            </label>
            <textarea
              id="prod-desc"
              required
              rows={3}
              maxLength={VALIDATION_LIMITS.DESCRIPTION_MAX}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="اكتب وصفاً واضحاً يشرح قيمة المنتج ولماذا يشتريه العميل الآن..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-white/15 bg-white dark:bg-slate-800 text-sm text-zinc-950 dark:text-white resize-y"
            />
          </div>

          {/* Features List */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">مميزات المنتج</span>
              <button
                type="button"
                onClick={handleAddFeature}
                disabled={features.length >= VALIDATION_LIMITS.FEATURES_MAX_COUNT}
                className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline disabled:opacity-40 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                إضافة ميزة
              </button>
            </div>
            <div className="space-y-2">
              {features.map((feat, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    maxLength={VALIDATION_LIMITS.FEATURE_ITEM_MAX}
                    value={feat}
                    onChange={(e) => handleFeatureChange(idx, e.target.value)}
                    placeholder={`ميزة ${idx + 1} (مثال: ضمان استبدال لمدة عام)`}
                    className="flex-1 h-10 px-3 rounded-xl border border-zinc-300 dark:border-white/15 bg-white dark:bg-slate-800 text-sm text-zinc-950 dark:text-white"
                  />
                  {features.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveFeature(idx)}
                      aria-label="حذف الميزة"
                      className="w-10 h-10 rounded-xl border border-zinc-200 dark:border-white/10 text-zinc-500 hover:text-rose-600 flex items-center justify-center cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Images Uploader & URL Manager */}
          <div className="space-y-3 pt-2 border-t border-zinc-200 dark:border-white/10">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                صور المنتج <span className="text-rose-600">*</span>{' '}
                <span className="text-xs font-normal text-zinc-500">
                  ({images.length} / {VALIDATION_LIMITS.IMAGES_MAX_COUNT})
                </span>
              </span>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || images.length >= VALIDATION_LIMITS.IMAGES_MAX_COUNT}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-white/15 bg-white dark:bg-slate-800 text-xs font-medium text-zinc-800 dark:text-zinc-200 disabled:opacity-50 cursor-pointer"
                >
                  {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  رفع صور من الجهاز
                </button>
                <button
                  type="button"
                  onClick={() => setShowStudioPicker((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-white/15 bg-white dark:bg-slate-800 text-xs font-medium text-zinc-800 dark:text-zinc-200 cursor-pointer"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  صور جاهزة
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                dir="ltr"
                value={imageUrlInput}
                onChange={(e) => setImageUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddImageUrl();
                  }
                }}
                placeholder="https://example.com/product.jpg"
                className="flex-1 h-10 px-3 rounded-xl border border-zinc-300 dark:border-white/15 bg-white dark:bg-slate-800 text-xs font-mono text-left text-zinc-900 dark:text-white"
              />
              <button
                type="button"
                onClick={handleAddImageUrl}
                className="h-10 px-4 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 text-xs font-medium shrink-0 cursor-pointer"
              >
                إضافة رابط
              </button>
            </div>

            {showStudioPicker && (
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-slate-800/70 border border-zinc-200 dark:border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {BUILTIN_STUDIO_IMAGES.map((asset) => {
                  const selected = images.includes(asset.url);
                  return (
                    <button
                      key={asset.url}
                      type="button"
                      onClick={() => {
                        if (selected) return;
                        if (images.length < VALIDATION_LIMITS.IMAGES_MAX_COUNT) {
                          setImages((prev) => [...prev, asset.url]);
                        }
                      }}
                      className={`group relative rounded-lg overflow-hidden border text-right cursor-pointer ${
                        selected ? 'border-teal-700 ring-1 ring-teal-700' : 'border-zinc-200 dark:border-white/10'
                      }`}
                    >
                      <div className="aspect-[4/3] bg-zinc-200">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={asset.url}
                          alt={asset.label}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-1.5 text-[11px] text-zinc-700 dark:text-zinc-200 truncate bg-white dark:bg-slate-900">
                        {asset.label}
                      </div>
                      {selected && (
                        <span className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-teal-700 text-white flex items-center justify-center">
                          <Check className="w-3 h-3" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {uploadError && (
              <p className="text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl p-2.5 leading-5">
                {uploadError}
              </p>
            )}

            {images.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                {images.map((url, idx) => (
                  <div
                    key={`${url}-${idx}`}
                    className="relative rounded-xl overflow-hidden border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-slate-800"
                  >
                    <div className="aspect-[4/3]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`صورة ${idx + 1}`}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex items-center justify-between px-2 py-1.5 bg-white dark:bg-slate-900 border-t border-zinc-200 dark:border-white/10 text-[11px]">
                      {idx === 0 ? (
                        <span className="font-medium text-teal-700 dark:text-teal-400">رئيسية</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleMakePrimaryImage(idx)}
                          className="inline-flex items-center gap-0.5 text-zinc-600 dark:text-zinc-300 cursor-pointer"
                        >
                          <ArrowUp className="w-3 h-3" />
                          رئيسية
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(idx)}
                        aria-label="حذف الصورة"
                        className="text-zinc-400 hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Collapsible Phase 1 Customization Section (Colors, 3D GLB, Scarcity, Reviews, FAQ, WhatsApp) */}
          <div className="border border-zinc-200 dark:border-white/15 rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowDesignSection((v) => !v)}
              className="w-full px-4 py-3.5 bg-zinc-50 dark:bg-slate-800/60 flex items-center justify-between gap-3 text-right cursor-pointer"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
                <Palette className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                تخصيص صفحة البيع (الألوان · موديل 3D · العداد · الآراء · الأسئلة · واتساب)
              </span>
              <ChevronDown
                className={`w-4 h-4 text-zinc-500 transition-transform duration-300 ${
                  showDesignSection ? 'rotate-180' : ''
                }`}
              />
            </button>

            {showDesignSection && (
              <div className="p-4 space-y-5 border-t border-zinc-200 dark:border-white/10">
                {/* Color Palette Picker */}
                <div>
                  <span className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                    لوحة ألوان الصفحة (Liquid Glass Accent)
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {THEME_OPTIONS.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setThemeId(t.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                          themeId === t.id
                            ? 'border-zinc-950 dark:border-white bg-zinc-100 dark:bg-white/10 text-zinc-950 dark:text-white'
                            : 'border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-300'
                        }`}
                      >
                        <span
                          className="w-4 h-4 rounded-full shrink-0 border border-white/40"
                          style={{ backgroundColor: t.swatch }}
                        />
                        <span>{t.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Optional 3D GLB Model */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                      <Box className="w-3.5 h-3.5" />
                      ملف مجسم 3D (.glb) — اختياري
                    </span>
                    <input
                      ref={glbInputRef}
                      type="file"
                      accept=".glb,.gltf"
                      onChange={handleGlbUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => glbInputRef.current?.click()}
                      disabled={uploadingGlb}
                      className="text-xs text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
                    >
                      {uploadingGlb ? 'جارٍ الرفع...' : 'رفع ملف GLB'}
                    </button>
                  </div>
                  <input
                    type="text"
                    dir="ltr"
                    value={model3dUrl}
                    onChange={(e) => setModel3dUrl(e.target.value)}
                    placeholder="https://.../product.glb (أو اتركه فارغاً لكارت 3D التفاعلي)"
                    className="w-full h-10 px-3 rounded-xl border border-zinc-300 dark:border-white/15 bg-white dark:bg-slate-800 text-xs font-mono text-left text-zinc-900 dark:text-white"
                  />
                </div>

                {/* WhatsApp + Scarcity + Countdown */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      رقم واتساب للتواصل العائم
                    </label>
                    <input
                      type="tel"
                      dir="ltr"
                      maxLength={25}
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                      placeholder="01012345678"
                      className="w-full h-10 px-3 rounded-xl border border-zinc-300 dark:border-white/15 bg-white dark:bg-slate-800 text-xs font-mono text-right text-zinc-950 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      الكمية المتبقية (0 = إخفاء)
                    </label>
                    <input
                      type="number"
                      min="0"
                      dir="ltr"
                      value={stockRemaining}
                      onChange={(e) => setStockRemaining(e.target.value)}
                      placeholder="9"
                      className="w-full h-10 px-3 rounded-xl border border-zinc-300 dark:border-white/15 bg-white dark:bg-slate-800 text-xs font-mono text-right text-zinc-950 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      عداد العرض (بالدقائق)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={showCountdown}
                        onChange={(e) => setShowCountdown(e.target.checked)}
                        className="w-4 h-4 accent-teal-700 cursor-pointer"
                      />
                      <input
                        type="number"
                        min="0"
                        max="10080"
                        dir="ltr"
                        disabled={!showCountdown}
                        value={countdownMinutes}
                        onChange={(e) => setCountdownMinutes(e.target.value)}
                        className="flex-1 h-10 px-3 rounded-xl border border-zinc-300 dark:border-white/15 bg-white dark:bg-slate-800 text-xs font-mono text-right text-zinc-950 dark:text-white disabled:opacity-40"
                      />
                    </div>
                  </div>
                </div>

                {/* Customer Reviews Editor */}
                <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-white/10">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      آراء العملاء ({reviews.length})
                    </span>
                    <button
                      type="button"
                      onClick={handleAddReview}
                      disabled={reviews.length >= VALIDATION_LIMITS.REVIEWS_MAX_COUNT}
                      className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 dark:text-teal-400 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      إضافة رأي عميل
                    </button>
                  </div>
                  {reviews.map((rev, idx) => (
                    <div
                      key={rev.id}
                      className="p-3 rounded-xl bg-zinc-50 dark:bg-slate-800/60 border border-zinc-200 dark:border-white/10 space-y-2"
                    >
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={rev.author}
                          onChange={(e) =>
                            setReviews((prev) =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, author: e.target.value } : item
                              )
                            )
                          }
                          placeholder="اسم العميل"
                          className="h-9 px-2.5 rounded-lg border border-zinc-300 dark:border-white/15 bg-white dark:bg-slate-900 text-xs text-zinc-900 dark:text-white"
                        />
                        <input
                          type="text"
                          value={rev.city}
                          onChange={(e) =>
                            setReviews((prev) =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, city: e.target.value } : item
                              )
                            )
                          }
                          placeholder="المدينة (مثال: القاهرة)"
                          className="h-9 px-2.5 rounded-lg border border-zinc-300 dark:border-white/15 bg-white dark:bg-slate-900 text-xs text-zinc-900 dark:text-white"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={rev.comment}
                          onChange={(e) =>
                            setReviews((prev) =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, comment: e.target.value } : item
                              )
                            )
                          }
                          placeholder="تعليق العميل عن تجربته مع المنتج..."
                          className="flex-1 h-9 px-2.5 rounded-lg border border-zinc-300 dark:border-white/15 bg-white dark:bg-slate-900 text-xs text-zinc-900 dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={() => setReviews((prev) => prev.filter((_, i) => i !== idx))}
                          className="p-2 text-zinc-400 hover:text-rose-600 cursor-pointer"
                          aria-label="حذف الرأي"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* FAQ Accordion Editor */}
                <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-white/10">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      الأسئلة الشائعة ({faqs.length})
                    </span>
                    <button
                      type="button"
                      onClick={handleAddFaq}
                      disabled={faqs.length >= VALIDATION_LIMITS.FAQS_MAX_COUNT}
                      className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 dark:text-teal-400 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      إضافة سؤال
                    </button>
                  </div>
                  {faqs.map((faq, idx) => (
                    <div
                      key={faq.id}
                      className="p-3 rounded-xl bg-zinc-50 dark:bg-slate-800/60 border border-zinc-200 dark:border-white/10 space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={faq.question}
                          onChange={(e) =>
                            setFaqs((prev) =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, question: e.target.value } : item
                              )
                            )
                          }
                          placeholder="السؤال..."
                          className="flex-1 h-9 px-2.5 rounded-lg border border-zinc-300 dark:border-white/15 bg-white dark:bg-slate-900 text-xs font-medium text-zinc-900 dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={() => setFaqs((prev) => prev.filter((_, i) => i !== idx))}
                          className="p-2 text-zinc-400 hover:text-rose-600 cursor-pointer"
                          aria-label="حذف السؤال"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <textarea
                        rows={2}
                        value={faq.answer}
                        onChange={(e) =>
                          setFaqs((prev) =>
                            prev.map((item, i) =>
                              i === idx ? { ...item, answer: e.target.value } : item
                            )
                          )
                        }
                        placeholder="الإجابة..."
                        className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 dark:border-white/15 bg-white dark:bg-slate-900 text-xs text-zinc-900 dark:text-white resize-none"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Active / Hidden Status */}
          <div className="flex items-center justify-between pt-3 border-t border-zinc-200 dark:border-white/10">
            <div>
              <span className="block text-sm font-medium text-zinc-900 dark:text-white">
                حالة صفحة البيع
              </span>
              <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                {isActive
                  ? 'فعّال — الصفحة متاحة للعملاء وتستقبل الطلبات'
                  : 'مخفي — الصفحة متوقفة ولا يمكن للعملاء الطلب منها'}
              </span>
            </div>
            <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setIsActive(true)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400'
                }`}
              >
                فعّال
              </button>
              <button
                type="button"
                onClick={() => setIsActive(false)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                  !isActive
                    ? 'bg-white dark:bg-slate-700 text-zinc-900 dark:text-white shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400'
                }`}
              >
                مخفي
              </button>
            </div>
          </div>

          {/* Submit Actions */}
          <div className="pt-4 border-t border-zinc-200 dark:border-white/10 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-white/15 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={saving || uploading || uploadingGlb}
              className="px-6 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:bg-teal-700/60 text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEditing ? 'حفظ التعديلات' : 'إنشاء صفحة البيع'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
