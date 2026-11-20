'use client';

import React, { useEffect, useState } from 'react';
import {
  Volume2,
  VolumeX,
  Send,
  Mail,
  Webhook,
  CheckCircle2,
  XCircle,
  Loader2,
  BellRing,
} from 'lucide-react';
import { playOrderNotificationSound } from '@/lib/helpers';

interface NotificationsSettingsProps {
  soundEnabled: boolean;
  onToggleSound: () => void;
}

interface ChannelStatus {
  telegram: boolean;
  email: boolean;
  webhook: boolean;
}

export default function NotificationsSettings({
  soundEnabled,
  onToggleSound,
}: NotificationsSettingsProps) {
  const [status, setStatus] = useState<ChannelStatus | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/notify')
      .then((r) => r.json())
      .then((data: ChannelStatus) => {
        if (active) setStatus(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const handleTestExternal = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: 'ORD-TEST01',
          customerName: 'عميل تجريبي',
          phone: '01012345678',
          governorate: 'القاهرة',
          address: 'مدينة نصر — شارع عباس العقاد',
          productName: 'منتج تجريبي لاختبار الإشعارات',
          productSlug: 'demo-test',
          quantity: 1,
          totalPrice: 1500,
          currency: 'ج.م',
          isTest: true,
        }),
      });
      const data = await res.json();
      const sentList: string[] = [];
      const errorsList: string[] = [];

      if (data?.results?.telegram?.sent) {
        sentList.push('تليجرام');
      } else if (data?.results?.telegram?.configured && data?.results?.telegram?.error) {
        errorsList.push(`تليجرام: ${data.results.telegram.error}`);
      }

      if (data?.results?.email?.sent) {
        sentList.push('الإيميل');
      } else if (data?.results?.email?.configured && data?.results?.email?.error) {
        errorsList.push(`الإيميل: ${data.results.email.error}`);
      }

      if (data?.results?.webhook?.sent) {
        sentList.push('Webhook');
      } else if (data?.results?.webhook?.configured && data?.results?.webhook?.error) {
        errorsList.push(`Webhook: ${data.results.webhook.error}`);
      }

      if (sentList.length > 0 && errorsList.length === 0) {
        setTestResult(`تم إرسال الإشعار التجريبي بنجاح عبر: ${sentList.join('، ')}. راجع محادثة البوت في تليجرام الآن.`);
      } else if (errorsList.length > 0) {
        setTestResult(`حدث خطأ أثناء الإرسال — ${errorsList.join(' | ')}`);
      } else {
        setTestResult(
          'لا توجد قنوات خارجية مفعّلة في متغيرات البيئة بعد. أضف TELEGRAM_BOT_TOKEN و TELEGRAM_CHAT_ID ثم أعد التشغيل.'
        );
      }
    } catch {
      setTestResult('تعذر الاتصال بنقطة الإشعارات حالياً.');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-lg font-bold text-zinc-950">إعدادات الإشعارات</h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          تحكم في التنبيهات الصوتية الفورية وقنوات إرسال الطلبات الخارجية (تليجرام، إيميل، واتساب
          Webhook)
        </p>
      </div>

      {/* In-App Realtime Sound Alert */}
      <section className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
              {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-950">
                التنبيه الصوتي الفوري في لوحة التحكم
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                إصدار صوت تنبيه وإشعار مرئي فوري فور تسجيل أي عميل لطلب جديد
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => playOrderNotificationSound()}
              className="px-3 py-2 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-xs font-medium text-zinc-800 transition-colors cursor-pointer"
            >
              تجربة الصوت
            </button>
            <button
              type="button"
              onClick={onToggleSound}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                soundEnabled
                  ? 'bg-teal-700 hover:bg-teal-800 text-white'
                  : 'bg-zinc-200 hover:bg-zinc-300 text-zinc-800'
              }`}
            >
              {soundEnabled ? 'مفعّل' : 'مكتوم'}
            </button>
          </div>
        </div>
      </section>

      {/* External Server Channels */}
      <section className="bg-white border border-zinc-200 rounded-xl p-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-zinc-100">
          <div>
            <h3 className="text-sm font-semibold text-zinc-950">قنوات الإشعارات الخارجية</h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              تُرسل تلقائياً من السيرفر فور كل طلب جديد عبر متغيرات البيئة الآمنة
            </p>
          </div>
          <button
            type="button"
            onClick={handleTestExternal}
            disabled={testing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white text-xs font-medium transition-colors cursor-pointer"
          >
            {testing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <BellRing className="w-3.5 h-3.5" />
            )}
            إرسال إشعار تجريبي
          </button>
        </div>

        <div className="divide-y divide-zinc-100">
          <div className="py-3.5 flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Send className="w-4 h-4 text-sky-600 mt-0.5 shrink-0" />
              <div>
                <div className="text-sm font-medium text-zinc-950">تليجرام (Telegram Bot)</div>
                <div className="text-xs text-zinc-500 mt-0.5">
                  متغيرات البيئة:{' '}
                  <span className="font-mono text-zinc-700" dir="ltr">
                    TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
                  </span>
                </div>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-medium shrink-0">
              {status?.telegram ? (
                <span className="inline-flex items-center gap-1 text-emerald-700">
                  <CheckCircle2 className="w-4 h-4" />
                  متصل
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-zinc-500">
                  <XCircle className="w-4 h-4" />
                  غير مفعّل
                </span>
              )}
            </span>
          </div>

          <div className="py-3.5 flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Mail className="w-4 h-4 text-teal-700 mt-0.5 shrink-0" />
              <div>
                <div className="text-sm font-medium text-zinc-950">البريد الإلكتروني (Resend)</div>
                <div className="text-xs text-zinc-500 mt-0.5">
                  متغيرات البيئة:{' '}
                  <span className="font-mono text-zinc-700" dir="ltr">
                    RESEND_API_KEY, ADMIN_NOTIFICATION_EMAIL
                  </span>
                </div>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-medium shrink-0">
              {status?.email ? (
                <span className="inline-flex items-center gap-1 text-emerald-700">
                  <CheckCircle2 className="w-4 h-4" />
                  متصل
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-zinc-500">
                  <XCircle className="w-4 h-4" />
                  غير مفعّل
                </span>
              )}
            </span>
          </div>

          <div className="py-3.5 flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Webhook className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
              <div>
                <div className="text-sm font-medium text-zinc-950">
                  واتساب / Webhook خارجي (Make / Zapier)
                </div>
                <div className="text-xs text-zinc-500 mt-0.5">
                  متغير البيئة:{' '}
                  <span className="font-mono text-zinc-700" dir="ltr">
                    ORDER_WEBHOOK_URL
                  </span>
                </div>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-medium shrink-0">
              {status?.webhook ? (
                <span className="inline-flex items-center gap-1 text-emerald-700">
                  <CheckCircle2 className="w-4 h-4" />
                  متصل
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-zinc-500">
                  <XCircle className="w-4 h-4" />
                  غير مفعّل
                </span>
              )}
            </span>
          </div>
        </div>

        {testResult && (
          <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200 text-xs text-zinc-700 leading-5">
            {testResult}
          </div>
        )}
      </section>
    </div>
  );
}
