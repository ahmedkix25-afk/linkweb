'use client';

import React, { useMemo, useState } from 'react';
import { doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  Search,
  MessageCircle,
  Trash2,
  Eye,
  X,
  ShoppingBag,
  Calendar,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import {
  Order,
  OrderStatus,
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_STYLES,
  Product,
} from '@/lib/types';
import {
  formatPrice,
  formatDateTimeAr,
  formatDateShort,
  buildWhatsAppOrderLink,
} from '@/lib/helpers';

interface OrdersManagerProps {
  orders: Order[];
  products: Product[];
  loading: boolean;
}

type DatePreset = 'all' | 'today' | '7d' | '30d' | 'custom';

export default function OrdersManager({ orders, products, loading }: OrdersManagerProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [productFilter, setProductFilter] = useState<string>('all');
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Unique products list combining existing products + any product slugs present in historical orders
  const productOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products) {
      map.set(p.slug, p.name);
    }
    for (const o of orders) {
      if (!map.has(o.productSlug)) {
        map.set(o.productSlug, o.productName);
      }
    }
    return Array.from(map.entries()).map(([slug, name]) => ({ slug, name }));
  }, [products, orders]);

  // Status counts for segmented filter bar
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: orders.length };
    for (const s of ORDER_STATUSES) counts[s] = 0;
    for (const o of orders) {
      counts[o.status] = (counts[o.status] || 0) + 1;
    }
    return counts;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const q = searchQuery.trim().toLowerCase();

    return orders.filter((order) => {
      if (statusFilter !== 'all' && order.status !== statusFilter) return false;
      if (productFilter !== 'all' && order.productSlug !== productFilter) return false;

      if (datePreset !== 'all' && order.createdAt) {
        const ts = order.createdAt.getTime();
        if (datePreset === 'today' && ts < startOfToday) return false;
        if (datePreset === '7d' && ts < now.getTime() - 7 * 86400000) return false;
        if (datePreset === '30d' && ts < now.getTime() - 30 * 86400000) return false;
        if (datePreset === 'custom') {
          if (dateFrom) {
            const fromTs = new Date(`${dateFrom}T00:00:00`).getTime();
            if (ts < fromTs) return false;
          }
          if (dateTo) {
            const toTs = new Date(`${dateTo}T23:59:59`).getTime();
            if (ts > toTs) return false;
          }
        }
      }

      if (q) {
        const haystack = [
          order.orderNumber,
          order.customerName,
          order.phone,
          order.governorate,
          order.address,
          order.productName,
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [orders, statusFilter, productFilter, datePreset, dateFrom, dateTo, searchQuery]);

  const handleStatusChange = async (order: Order, nextStatus: OrderStatus) => {
    if (order.status === nextStatus) return;
    setUpdatingId(order.id);
    try {
      await updateDoc(doc(db, 'orders', order.id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
      if (selectedOrder?.id === order.id) {
        setSelectedOrder({ ...selectedOrder, status: nextStatus });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `orders/${order.id}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    setUpdatingId(orderId);
    try {
      await deleteDoc(doc(db, 'orders', orderId));
      setConfirmDeleteId(null);
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `orders/${orderId}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleExportExcel = () => {
    const rows = filteredOrders.map((o) => ({
      'رقم الطلب': o.orderNumber,
      'تاريخ ووقت الطلب': formatDateTimeAr(o.createdAt),
      'حالة الطلب': ORDER_STATUS_LABELS[o.status],
      'اسم العميل': o.customerName,
      'رقم الموبايل': o.phone,
      المحافظة: o.governorate,
      'العنوان بالتفصيل': o.address,
      المنتج: o.productName,
      'رابط المنتج': `/p/${o.productSlug}`,
      'سعر القطعة': o.unitPrice,
      الكمية: o.quantity,
      'السعر الإجمالي': o.totalPrice,
      العملة: o.currency,
      'طريقة الدفع': 'الدفع عند الاستلام',
      ملاحظات: o.notes || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [
      { wch: 14 },
      { wch: 22 },
      { wch: 14 },
      { wch: 22 },
      { wch: 16 },
      { wch: 14 },
      { wch: 36 },
      { wch: 28 },
      { wch: 20 },
      { wch: 12 },
      { wch: 8 },
      { wch: 14 },
      { wch: 8 },
      { wch: 18 },
      { wch: 26 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'الطلبات');

    const dateTag = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `orders-${dateTag}.xlsx`);
  };

  return (
    <div className="space-y-5">
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-950">إدارة الطلبات</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            عرض وتحديث حالات الطلبات لحظياً مع الفلترة والتصدير إلى Excel
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportExcel}
          disabled={filteredOrders.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-white text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <FileSpreadsheet className="w-4 h-4" />
          تصدير Excel ({filteredOrders.length})
        </button>
      </div>

      {/* Status Segmented Filter */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <div className="inline-flex items-center gap-1 p-1 bg-zinc-100 rounded-lg">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-white text-zinc-950 shadow-sm'
                : 'text-zinc-600 hover:text-zinc-950'
            }`}
          >
            الكل <span className="font-mono tabular-nums opacity-70">({statusCounts.all})</span>
          </button>
          {ORDER_STATUSES.map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                statusFilter === st
                  ? 'bg-white text-zinc-950 shadow-sm'
                  : 'text-zinc-600 hover:text-zinc-950'
              }`}
            >
              {ORDER_STATUS_LABELS[st]}{' '}
              <span className="font-mono tabular-nums opacity-70">({statusCounts[st] || 0})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Filters Toolbar (Search + Product + Date) */}
      <div className="bg-white border border-zinc-200 rounded-xl p-3.5 grid grid-cols-1 md:grid-cols-12 gap-3">
        <div className="md:col-span-5 relative">
          <Search className="w-4 h-4 text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث باسم العميل، رقم الموبايل، أو رقم الطلب..."
            className="w-full h-10 pr-9 pl-3 rounded-lg border border-zinc-300 text-sm text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
          />
        </div>

        <div className="md:col-span-4">
          <select
            aria-label="تصفية حسب المنتج"
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border border-zinc-300 bg-white text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
          >
            <option value="all">جميع المنتجات</option>
            {productOptions.map((opt) => (
              <option key={opt.slug} value={opt.slug}>
                {opt.name}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3">
          <div className="relative">
            <Calendar className="w-4 h-4 text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              aria-label="تصفية حسب التاريخ"
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value as DatePreset)}
              className="w-full h-10 pr-9 pl-3 rounded-lg border border-zinc-300 bg-white text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            >
              <option value="all">كل الأوقات</option>
              <option value="today">اليوم فقط</option>
              <option value="7d">آخر 7 أيام</option>
              <option value="30d">آخر 30 يوماً</option>
              <option value="custom">فترة مخصصة</option>
            </select>
          </div>
        </div>

        {datePreset === 'custom' && (
          <div className="md:col-span-12 flex flex-wrap items-center gap-3 pt-2 border-t border-zinc-100">
            <label className="flex items-center gap-2 text-xs text-zinc-600">
              <span>من تاريخ:</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-9 px-2.5 rounded-lg border border-zinc-300 text-xs font-mono text-zinc-900"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-zinc-600">
              <span>إلى تاريخ:</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-9 px-2.5 rounded-lg border border-zinc-300 text-xs font-mono text-zinc-900"
              />
            </label>
          </div>
        )}
      </div>

      {/* Orders Table */}
      {loading ? (
        <div className="bg-white border border-zinc-200 rounded-xl divide-y divide-zinc-100">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="p-4 flex items-center justify-between gap-4">
              <div className="h-4 w-28 bg-zinc-200 rounded animate-pulse" />
              <div className="h-4 w-40 bg-zinc-100 rounded animate-pulse" />
              <div className="h-4 w-32 bg-zinc-200 rounded animate-pulse" />
              <div className="h-8 w-24 bg-zinc-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-xl p-10 text-center">
          <div className="w-12 h-12 rounded-full bg-zinc-100 text-zinc-500 flex items-center justify-center mx-auto mb-3">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-zinc-950 mb-1">
            {orders.length === 0 ? 'لا توجد طلبات مسجلة بعد' : 'لا توجد طلبات تطابق خيارات الفلترة'}
          </h3>
          <p className="text-sm text-zinc-500">
            {orders.length === 0
              ? 'فور قيام أي عميل بالطلب من صفحة أي منتج سيظهر الطلب هنا لحظياً مع إشعار صوتي.'
              : 'جرّب تغيير حالة الطلب أو المنتج أو نطاق التاريخ لعرض طلبات أخرى.'}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50/70 text-xs font-semibold text-zinc-600">
                  <th className="py-3 px-4">الطلب والوقت</th>
                  <th className="py-3 px-4">العميل</th>
                  <th className="py-3 px-4">العنوان</th>
                  <th className="py-3 px-4">المنتج والكمية</th>
                  <th className="py-3 px-4">الإجمالي</th>
                  <th className="py-3 px-4">الحالة</th>
                  <th className="py-3 px-4 text-left">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-sm">
                {filteredOrders.map((order) => (
                  <tr
                    key={order.id}
                    className={`hover:bg-zinc-50/70 transition-colors align-middle ${
                      order.status === 'new' ? 'bg-amber-50/25' : ''
                    }`}
                  >
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-mono text-xs font-semibold text-zinc-950 tabular-nums" dir="ltr">
                        {order.orderNumber}
                      </div>
                      <div className="text-xs text-zinc-500 mt-0.5">
                        {formatDateShort(order.createdAt)}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-medium text-zinc-950">{order.customerName}</div>
                      <a
                        href={`tel:${order.phone}`}
                        dir="ltr"
                        className="text-xs font-mono text-teal-700 hover:underline tabular-nums inline-block mt-0.5"
                      >
                        {order.phone}
                      </a>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="text-xs font-medium text-zinc-900">{order.governorate}</div>
                      <div className="text-xs text-zinc-500 truncate max-w-[190px]" title={order.address}>
                        {order.address}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="text-xs font-medium text-zinc-950 truncate max-w-[190px]" title={order.productName}>
                        {order.productName}
                      </div>
                      <div className="text-xs text-zinc-500 mt-0.5">
                        الكمية:{' '}
                        <span className="font-mono font-semibold text-zinc-800 tabular-nums">
                          {order.quantity}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-mono font-semibold text-zinc-950 tabular-nums">
                        {formatPrice(order.totalPrice, order.currency)}
                      </div>
                      <div className="text-[11px] text-zinc-500">عند الاستلام</div>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <select
                        aria-label={`تغيير حالة الطلب ${order.orderNumber}`}
                        disabled={updatingId === order.id}
                        value={order.status}
                        onChange={(e) => handleStatusChange(order, e.target.value as OrderStatus)}
                        className={`h-8 px-2.5 rounded-md border text-xs font-semibold cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-700/20 ${
                          ORDER_STATUS_STYLES[order.status]
                        }`}
                      >
                        {ORDER_STATUSES.map((st) => (
                          <option key={st} value={st} className="bg-white text-zinc-900">
                            {ORDER_STATUS_LABELS[st]}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap text-left">
                      {confirmDeleteId === order.id ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleDeleteOrder(order.id)}
                            className="px-2.5 py-1 rounded bg-rose-600 text-white text-xs font-medium cursor-pointer"
                          >
                            حذف
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1 rounded border border-zinc-300 text-zinc-700 text-xs cursor-pointer"
                          >
                            إلغاء
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1">
                          <a
                            href={buildWhatsAppOrderLink(order)}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="تواصل مع العميل عبر واتساب"
                            className="p-2 rounded-lg text-emerald-700 hover:bg-emerald-50 transition-colors"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </a>
                          <button
                            type="button"
                            onClick={() => setSelectedOrder(order)}
                            title="عرض تفاصيل الطلب"
                            className="p-2 rounded-lg text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 transition-colors cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(order.id)}
                            title="حذف الطلب"
                            className="p-2 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Order Details Modal */}
      {selectedOrder && (
        <div
          className="fixed inset-0 z-50 bg-zinc-950/45 backdrop-blur-[1px] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-zinc-200 rounded-xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-zinc-950">
                  تفاصيل الطلب{' '}
                  <span className="font-mono text-teal-700" dir="ltr">
                    {selectedOrder.orderNumber}
                  </span>
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {formatDateTimeAr(selectedOrder.createdAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                aria-label="إغلاق"
                className="w-8 h-8 rounded-lg text-zinc-500 hover:bg-zinc-100 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm">
              <dl className="divide-y divide-zinc-100">
                <div className="py-2.5 flex justify-between gap-4">
                  <dt className="text-zinc-500">اسم العميل</dt>
                  <dd className="font-medium text-zinc-950">{selectedOrder.customerName}</dd>
                </div>
                <div className="py-2.5 flex justify-between gap-4">
                  <dt className="text-zinc-500">رقم الموبايل</dt>
                  <dd className="font-mono text-zinc-950 tabular-nums" dir="ltr">
                    {selectedOrder.phone}
                  </dd>
                </div>
                <div className="py-2.5 flex justify-between gap-4">
                  <dt className="text-zinc-500">المحافظة</dt>
                  <dd className="text-zinc-950">{selectedOrder.governorate}</dd>
                </div>
                <div className="py-2.5 flex justify-between gap-4">
                  <dt className="text-zinc-500 shrink-0">العنوان بالتفصيل</dt>
                  <dd className="text-zinc-950 text-left">{selectedOrder.address}</dd>
                </div>
                <div className="py-2.5 flex justify-between gap-4">
                  <dt className="text-zinc-500 shrink-0">المنتج</dt>
                  <dd className="font-medium text-zinc-950 text-left">{selectedOrder.productName}</dd>
                </div>
                <div className="py-2.5 flex justify-between gap-4">
                  <dt className="text-zinc-500">الكمية × السعر</dt>
                  <dd className="font-mono text-zinc-950 tabular-nums">
                    {selectedOrder.quantity} × {formatPrice(selectedOrder.unitPrice, selectedOrder.currency)}
                  </dd>
                </div>
                <div className="py-2.5 flex justify-between gap-4">
                  <dt className="text-zinc-500 font-semibold">الإجمالي عند الاستلام</dt>
                  <dd className="font-mono font-bold text-teal-700 tabular-nums">
                    {formatPrice(selectedOrder.totalPrice, selectedOrder.currency)}
                  </dd>
                </div>
                {selectedOrder.notes && (
                  <div className="py-2.5 flex justify-between gap-4">
                    <dt className="text-zinc-500 shrink-0">ملاحظات العميل</dt>
                    <dd className="text-zinc-800 text-left">{selectedOrder.notes}</dd>
                  </div>
                )}
              </dl>

              <div className="pt-3 border-t border-zinc-200 flex flex-wrap items-center justify-between gap-3">
                <select
                  value={selectedOrder.status}
                  onChange={(e) =>
                    handleStatusChange(selectedOrder, e.target.value as OrderStatus)
                  }
                  className={`h-10 px-3 rounded-lg border text-xs font-semibold cursor-pointer ${
                    ORDER_STATUS_STYLES[selectedOrder.status]
                  }`}
                >
                  {ORDER_STATUSES.map((st) => (
                    <option key={st} value={st} className="bg-white text-zinc-900">
                      {ORDER_STATUS_LABELS[st]}
                    </option>
                  ))}
                </select>

                <a
                  href={buildWhatsAppOrderLink(selectedOrder)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  تأكيد الطلب عبر واتساب
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
