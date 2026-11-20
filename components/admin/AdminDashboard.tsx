'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShoppingBag,
  Package,
  Bell,
  LogOut,
  Volume2,
  VolumeX,
  X,
  MessageCircle,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import { Order, Product } from '@/lib/types';
import {
  formatPrice,
  formatDateTimeAr,
  playOrderNotificationSound,
  buildWhatsAppOrderLink,
} from '@/lib/helpers';
import ProductsManager from './ProductsManager';
import OrdersManager from './OrdersManager';
import NotificationsSettings from './NotificationsSettings';

type AdminTab = 'orders' | 'products' | 'notifications';

export default function AdminDashboard() {
  const { user, isAdmin, signOutUser } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('orders');
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);

  const [soundEnabled, setSoundEnabled] = useState(true);
  const soundEnabledRef = useRef(true);
  const [liveAlerts, setLiveAlerts] = useState<Order[]>([]);
  const initialOrdersLoadedRef = useRef(false);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  // Attach Realtime Firestore listeners strictly when authenticated as Admin
  useEffect(() => {
    if (!isAdmin || !user) return;

    const productsQuery = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const unsubProducts = onSnapshot(
      productsQuery,
      (snapshot) => {
        const list: Product[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            slug: d.slug || docSnap.id,
            name: d.name || '',
            price: Number(d.price || 0),
            compareAtPrice: Number(d.compareAtPrice || 0),
            currency: d.currency || 'ج.م',
            description: d.description || '',
            features: Array.isArray(d.features) ? d.features : [],
            images: Array.isArray(d.images) ? d.images : [],
            isActive: Boolean(d.isActive),
            themeId: d.themeId,
            model3dUrl: d.model3dUrl || '',
            whatsappNumber: d.whatsappNumber || '',
            stockRemaining: typeof d.stockRemaining === 'number' ? d.stockRemaining : undefined,
            showCountdown: Boolean(d.showCountdown),
            countdownMinutes: typeof d.countdownMinutes === 'number' ? d.countdownMinutes : undefined,
            reviews: Array.isArray(d.reviews) ? d.reviews : undefined,
            faqs: Array.isArray(d.faqs) ? d.faqs : undefined,
            createdBy: d.createdBy || '',
            createdAt: d.createdAt?.toDate ? d.createdAt.toDate() : null,
            updatedAt: d.updatedAt?.toDate ? d.updatedAt.toDate() : null,
          };
        });
        setProducts(list);
        setLoadingProducts(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'products');
      }
    );

    const ordersQuery = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubOrders = onSnapshot(
      ordersQuery,
      (snapshot) => {
        const list: Order[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            orderNumber: d.orderNumber || docSnap.id,
            productSlug: d.productSlug || '',
            productName: d.productName || '',
            unitPrice: Number(d.unitPrice || 0),
            currency: d.currency || 'ج.م',
            quantity: Number(d.quantity || 1),
            totalPrice: Number(d.totalPrice || 0),
            customerName: d.customerName || '',
            phone: d.phone || '',
            governorate: d.governorate || '',
            address: d.address || '',
            notes: d.notes || '',
            paymentMethod: 'cod',
            status: d.status || 'new',
            createdAt: d.createdAt?.toDate ? d.createdAt.toDate() : null,
            updatedAt: d.updatedAt?.toDate ? d.updatedAt.toDate() : null,
          };
        });

        // Trigger instant audio + toast notification for newly arrived orders after initial hydration
        if (initialOrdersLoadedRef.current) {
          const addedOrders: Order[] = [];
          for (const change of snapshot.docChanges()) {
            if (change.type === 'added') {
              const matched = list.find((o) => o.id === change.doc.id);
              if (matched) addedOrders.push(matched);
            }
          }
          if (addedOrders.length > 0) {
            if (soundEnabledRef.current) {
              playOrderNotificationSound();
            }
            setLiveAlerts((prev) => [...addedOrders, ...prev].slice(0, 4));
          }
        } else {
          initialOrdersLoadedRef.current = true;
        }

        setOrders(list);
        setLoadingOrders(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'orders');
      }
    );

    return () => {
      unsubProducts();
      unsubOrders();
    };
  }, [isAdmin, user]);

  // Derived metrics
  const newOrdersCount = useMemo(
    () => orders.filter((o) => o.status === 'new').length,
    [orders]
  );

  const activeProductsCount = useMemo(
    () => products.filter((p) => p.isActive).length,
    [products]
  );

  const totalRevenue = useMemo(() => {
    return orders
      .filter((o) => o.status !== 'cancelled')
      .reduce((acc, o) => acc + o.totalPrice, 0);
  }, [orders]);

  const primaryCurrency = products[0]?.currency || orders[0]?.currency || 'ج.م';

  const ordersCountBySlug = useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of orders) {
      map[o.productSlug] = (map[o.productSlug] || 0) + 1;
    }
    return map;
  }, [orders]);

  // Reflect live new orders count in browser tab title
  useEffect(() => {
    document.title =
      newOrdersCount > 0 ? `(${newOrdersCount}) طلب جديد — لوحة التحكم` : 'لوحة التحكم — صفحة بيع';
  }, [newOrdersCount]);

  const dismissAlert = (orderId: string) => {
    setLiveAlerts((prev) => prev.filter((item) => item.id !== orderId));
  };

  const navItems: { id: AdminTab; label: string; icon: React.ReactNode; count?: number }[] = [
    {
      id: 'orders',
      label: 'الطلبات',
      icon: <ShoppingBag className="w-4 h-4" />,
      count: newOrdersCount,
    },
    {
      id: 'products',
      label: 'المنتجات وصفحات البيع',
      icon: <Package className="w-4 h-4" />,
      count: products.length,
    },
    {
      id: 'notifications',
      label: 'إعدادات الإشعارات',
      icon: <Bell className="w-4 h-4" />,
    },
  ];

  const currentTabTitle =
    activeTab === 'orders'
      ? 'الطلبات'
      : activeTab === 'products'
        ? 'المنتجات'
        : 'إعدادات الإشعارات';

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col lg:flex-row">
      {/* Desktop Right Sidebar (RTL) */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 bg-white border-l border-zinc-200 shrink-0">
        <div className="h-16 px-6 flex items-center border-b border-zinc-200">
          <span className="text-base font-bold text-zinc-950 whitespace-nowrap">
            صفحة بيع — الإدارة
          </span>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-teal-50 text-teal-800'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950'
                }`}
              >
                <span className="flex items-center gap-2.5 whitespace-nowrap">
                  {item.icon}
                  <span>{item.label}</span>
                </span>
                {item.id === 'orders' && newOrdersCount > 0 ? (
                  <span className="min-w-6 h-5 px-1.5 rounded bg-amber-500 text-white text-xs font-mono font-semibold tabular-nums flex items-center justify-center">
                    {newOrdersCount}
                  </span>
                ) : item.id === 'products' ? (
                  <span className="text-xs font-mono text-zinc-400 tabular-nums">
                    {products.length}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-zinc-200 space-y-3">
          <div className="text-xs text-zinc-500 truncate" dir="ltr" title={user?.email || ''}>
            {user?.email}
          </div>
          <button
            type="button"
            onClick={signOutUser}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-zinc-200 hover:bg-zinc-50 text-xs font-medium text-zinc-700 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Main Viewport */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-16 bg-white border-b border-zinc-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-2 text-sm min-w-0">
            <span className="text-zinc-400 hidden sm:inline">لوحة التحكم</span>
            <span className="text-zinc-300 hidden sm:inline">/</span>
            <h1 className="font-semibold text-zinc-950 truncate">{currentTabTitle}</h1>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setSoundEnabled((v) => !v)}
              title={soundEnabled ? 'كتم صوت إشعارات الطلبات' : 'تفعيل صوت إشعارات الطلبات'}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                soundEnabled
                  ? 'border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                  : 'border-amber-200 bg-amber-50 text-amber-800'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-teal-700" /> : <VolumeX className="w-4 h-4" />}
              <span className="hidden sm:inline">{soundEnabled ? 'الصوت مفعّل' : 'الصوت مكتوم'}</span>
            </button>

            <button
              type="button"
              onClick={signOutUser}
              className="lg:hidden p-2 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 cursor-pointer"
              aria-label="تسجيل الخروج"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Mobile Navigation Tabs */}
        <div className="lg:hidden bg-white border-b border-zinc-200 px-4 py-2 flex items-center gap-1 overflow-x-auto">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  active ? 'bg-teal-50 text-teal-800' : 'text-zinc-600'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.id === 'orders' && newOrdersCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-500 text-white text-[10px] font-mono tabular-nums">
                    {newOrdersCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* 4-Column Flat KPI Summary Strip */}
          <section
            aria-label="ملخص الأداء"
            className="grid grid-cols-2 lg:grid-cols-4 bg-white border border-zinc-200 rounded-xl divide-y lg:divide-y-0 lg:divide-x lg:divide-x-reverse divide-zinc-200 overflow-hidden"
          >
            <div className="p-4 sm:p-5">
              <div className="text-xs text-zinc-500 mb-1">طلبات جديدة بانتظار التأكيد</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-amber-700">
                {newOrdersCount}
              </div>
            </div>

            <div className="p-4 sm:p-5">
              <div className="text-xs text-zinc-500 mb-1">إجمالي الطلبات</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-zinc-950">
                {orders.length}
              </div>
            </div>

            <div className="p-4 sm:p-5">
              <div className="text-xs text-zinc-500 mb-1">قيمة الطلبات غير الملغاة</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-teal-700">
                {formatPrice(totalRevenue, primaryCurrency)}
              </div>
            </div>

            <div className="p-4 sm:p-5">
              <div className="text-xs text-zinc-500 mb-1">صفحات البيع الفعّالة</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-zinc-950">
                {activeProductsCount}{' '}
                <span className="text-xs font-normal text-zinc-400">/ {products.length}</span>
              </div>
            </div>
          </section>

          {/* Active Workspace Tab */}
          {activeTab === 'orders' && (
            <OrdersManager orders={orders} products={products} loading={loadingOrders} />
          )}

          {activeTab === 'products' && (
            <ProductsManager
              products={products}
              loading={loadingProducts}
              ordersCountBySlug={ordersCountBySlug}
            />
          )}

          {activeTab === 'notifications' && (
            <NotificationsSettings
              soundEnabled={soundEnabled}
              onToggleSound={() => setSoundEnabled((v) => !v)}
            />
          )}
        </main>
      </div>

      {/* Live Instant New Order Toast Stack (Bottom Left in RTL) */}
      <div className="fixed bottom-4 left-4 z-50 w-[calc(100%-2rem)] max-w-sm space-y-2.5 pointer-events-none">
        <AnimatePresence>
          {liveAlerts.map((order) => (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className="pointer-events-auto bg-zinc-950 text-white border border-zinc-800 rounded-xl p-4 shadow-lg space-y-2.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-amber-400">طلب جديد وارد الآن</div>
                  <div className="text-sm font-bold text-white mt-0.5">{order.customerName}</div>
                </div>
                <button
                  type="button"
                  onClick={() => dismissAlert(order.id)}
                  aria-label="إغلاق الإشعار"
                  className="text-zinc-400 hover:text-white p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="text-xs text-zinc-300 space-y-1 leading-5">
                <div>
                  الموبايل:{' '}
                  <span className="font-mono text-white tabular-nums" dir="ltr">
                    {order.phone}
                  </span>
                </div>
                <div>
                  العنوان: {order.governorate} — {order.address}
                </div>
                <div>
                  المنتج: <span className="text-white font-medium">{order.productName}</span> (الكمية:{' '}
                  <span className="font-mono tabular-nums">{order.quantity}</span>)
                </div>
                <div className="flex items-center justify-between pt-1.5 border-t border-zinc-800">
                  <span className="font-mono font-bold text-emerald-400 tabular-nums">
                    {formatPrice(order.totalPrice, order.currency)}
                  </span>
                  <span className="text-[11px] text-zinc-400">
                    {formatDateTimeAr(order.createdAt)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('orders');
                    dismissAlert(order.id);
                  }}
                  className="flex-1 py-1.5 px-3 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  عرض في جدول الطلبات
                </button>
                <a
                  href={buildWhatsAppOrderLink(order)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-1.5 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium inline-flex items-center gap-1"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  واتساب
                </a>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
