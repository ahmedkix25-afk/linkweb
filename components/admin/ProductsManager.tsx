'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { doc, updateDoc, deleteDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import {
  Plus,
  Copy,
  Check,
  ExternalLink,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Package,
  Loader2,
  Layers,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import { Product } from '@/lib/types';
import { formatPrice, DEMO_PRODUCTS_SEED } from '@/lib/helpers';
import ProductFormModal from './ProductFormModal';

interface ProductsManagerProps {
  products: Product[];
  loading: boolean;
  ordersCountBySlug: Record<string, number>;
}

export default function ProductsManager({
  products,
  loading,
  ordersCountBySlug,
}: ProductsManagerProps) {
  const { user } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [createdBannerSlug, setCreatedBannerSlug] = useState<string | null>(null);
  const [confirmDeleteSlug, setConfirmDeleteSlug] = useState<string | null>(null);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  const getLandingUrl = (slug: string) => {
    if (typeof window === 'undefined') return `/p/${slug}`;
    return `${window.location.origin}/p/${slug}`;
  };

  const handleCopyLink = async (slug: string) => {
    const fullUrl = getLandingUrl(slug);
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopiedSlug(slug);
      setTimeout(() => {
        setCopiedSlug((curr) => (curr === slug ? null : curr));
      }, 2200);
    } catch {
      // Fallback for clipboard-restricted iframes
      const input = document.createElement('input');
      input.value = fullUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopiedSlug(slug);
      setTimeout(() => {
        setCopiedSlug((curr) => (curr === slug ? null : curr));
      }, 2200);
    }
  };

  const handleToggleActive = async (product: Product) => {
    setBusySlug(product.slug);
    try {
      await updateDoc(doc(db, 'products', product.slug), {
        isActive: !product.isActive,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `products/${product.slug}`);
    } finally {
      setBusySlug(null);
    }
  };

  const handleDelete = async (slug: string) => {
    setBusySlug(slug);
    try {
      await deleteDoc(doc(db, 'products', slug));
      setConfirmDeleteSlug(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `products/${slug}`);
    } finally {
      setBusySlug(null);
    }
  };

  const handleSeedDemoProducts = async () => {
    if (!user || seeding) return;
    setSeeding(true);
    try {
      for (const item of DEMO_PRODUCTS_SEED) {
        await setDoc(doc(db, 'products', item.slug), {
          ...item,
          createdBy: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      setCreatedBannerSlug(DEMO_PRODUCTS_SEED[0].slug);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'products/demo-seed');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-950">المنتجات وصفحات البيع</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            لكل منتج صفحة بيع مستقلة جاهزة للنسخ والنشر في الحملات الإعلانية
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingProduct(null);
            setModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          إضافة منتج جديد
        </button>
      </div>

      {/* Instant Ready-to-Copy Link Banner after creating a new product */}
      {createdBannerSlug && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-emerald-950">
              صفحة البيع جاهزة الآن للنسخ والنشر
            </p>
            <p className="text-xs font-mono text-emerald-800 break-all" dir="ltr">
              {getLandingUrl(createdBannerSlug)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleCopyLink(createdBannerSlug)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              {copiedSlug === createdBannerSlug ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  تم النسخ
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  نسخ الرابط
                </>
              )}
            </button>
            <Link
              href={`/p/${createdBannerSlug}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-emerald-300 text-emerald-900 hover:bg-emerald-100/50 text-xs font-medium transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              معاينة الصفحة
            </Link>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading ? (
        <div className="bg-white border border-zinc-200 rounded-xl divide-y divide-zinc-100">
          {[1, 2, 3].map((n) => (
            <div key={n} className="p-4 flex items-center gap-4">
              <div className="w-16 h-12 rounded-lg bg-zinc-200 animate-pulse shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-48 bg-zinc-200 rounded animate-pulse" />
                <div className="h-3 w-32 bg-zinc-100 rounded animate-pulse" />
              </div>
              <div className="h-8 w-24 bg-zinc-200 rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        /* Empty State */
        <div className="bg-white border border-zinc-200 rounded-xl p-10 text-center">
          <div className="w-12 h-12 rounded-full bg-zinc-100 text-zinc-500 flex items-center justify-center mx-auto mb-3">
            <Package className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-zinc-950 mb-1">لا توجد منتجات بعد</h3>
          <p className="text-sm text-zinc-500 max-w-md mx-auto mb-6">
            أضف أول منتج لتوليد صفحة بيع مستقلة بلينك خاص فوري، أو أنشئ منتجين تجريبيين جاهزين
            لمعاينة النظام بالكامل.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setEditingProduct(null);
                setModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              إضافة أول منتج
            </button>
            <button
              type="button"
              onClick={handleSeedDemoProducts}
              disabled={seeding}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 text-sm font-medium transition-colors cursor-pointer"
            >
              {seeding ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Layers className="w-4 h-4 text-teal-700" />
              )}
              إنشاء منتجين تجريبيين
            </button>
          </div>
        </div>
      ) : (
        /* Populated Product Table */
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50/70 text-xs font-semibold text-zinc-600">
                  <th className="py-3 px-4">المنتج</th>
                  <th className="py-3 px-4">السعر</th>
                  <th className="py-3 px-4">الحالة</th>
                  <th className="py-3 px-4">الطلبات</th>
                  <th className="py-3 px-4">رابط صفحة البيع</th>
                  <th className="py-3 px-4 text-left">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-sm">
                {products.map((product) => {
                  const isBusy = busySlug === product.slug;
                  const isCopied = copiedSlug === product.slug;
                  const orderCount = ordersCountBySlug[product.slug] || 0;

                  return (
                    <tr
                      key={product.slug}
                      className="hover:bg-zinc-50/60 transition-colors align-middle"
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3 min-w-[220px]">
                          <div className="w-14 h-11 rounded-lg overflow-hidden bg-zinc-100 border border-zinc-200 shrink-0">
                            {product.images[0] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={product.images[0]}
                                alt={product.name}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-zinc-400">
                                <Package className="w-4 h-4" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-zinc-950 truncate max-w-[260px]">
                              {product.name}
                            </div>
                            <div className="text-xs text-zinc-500 font-mono truncate" dir="ltr">
                              /p/{product.slug}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-mono font-semibold text-zinc-950 tabular-nums">
                          {formatPrice(product.price, product.currency)}
                        </div>
                        {product.compareAtPrice > product.price && (
                          <div className="text-xs text-zinc-400 line-through font-mono tabular-nums">
                            {formatPrice(product.compareAtPrice, product.currency)}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleToggleActive(product)}
                          title={product.isActive ? 'اضغط للإيقاف المؤقت' : 'اضغط للتفعيل'}
                          className={`inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer transition-colors ${
                            product.isActive
                              ? 'text-emerald-700 hover:text-emerald-900'
                              : 'text-zinc-500 hover:text-zinc-900'
                          }`}
                        >
                          {product.isActive ? (
                            <>
                              <Eye className="w-3.5 h-3.5" />
                              فعّال
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3.5 h-3.5" />
                              مخفي
                            </>
                          )}
                        </button>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-zinc-700 tabular-nums">
                        {orderCount}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleCopyLink(product.slug)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                              isCopied
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                : 'bg-white border-zinc-300 text-zinc-800 hover:bg-zinc-50'
                            }`}
                          >
                            {isCopied ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                تم النسخ
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                نسخ اللينك
                              </>
                            )}
                          </button>

                          <Link
                            href={`/p/${product.slug}`}
                            target="_blank"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-teal-700 hover:bg-teal-50 transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            فتح
                          </Link>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-left">
                        {confirmDeleteSlug === product.slug ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleDelete(product.slug)}
                              className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium cursor-pointer"
                            >
                              تأكيد الحذف
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteSlug(null)}
                              className="px-2.5 py-1 rounded border border-zinc-300 text-zinc-700 text-xs cursor-pointer"
                            >
                              إلغاء
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingProduct(product);
                                setModalOpen(true);
                              }}
                              aria-label="تعديل المنتج"
                              className="p-2 rounded-lg text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 transition-colors cursor-pointer"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteSlug(product.slug)}
                              aria-label="حذف المنتج"
                              className="p-2 rounded-lg text-zinc-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalOpen && (
        <ProductFormModal
          product={editingProduct}
          onClose={() => setModalOpen(false)}
          onSaved={(savedSlug, isNew) => {
            setModalOpen(false);
            if (isNew) {
              setCreatedBannerSlug(savedSlug);
            }
          }}
        />
      )}
    </div>
  );
}
