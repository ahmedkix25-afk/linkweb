'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Banknote,
  Truck,
  RotateCcw,
  Star,
  ChevronDown,
  Clock,
  Flame,
  MessageCircle,
} from 'lucide-react';
import { ProductFaq, ProductReview } from '@/lib/types';
import { buildMerchantWhatsAppUrl } from '@/lib/helpers';
import LiquidGlassCard from './LiquidGlassCard';

/* 1. Optional Scarcity + Offer Countdown Strip */
export function OfferScarcityBar({
  stockRemaining,
  showCountdown,
  countdownMinutes,
  productSlug,
}: {
  stockRemaining?: number;
  showCountdown?: boolean;
  countdownMinutes?: number;
  productSlug: string;
}) {
  const [secondsLeft, setSecondsLeft] = useState<number>(0);

  useEffect(() => {
    if (!showCountdown || !countdownMinutes || countdownMinutes <= 0) return;

    const storageKey = `offer_end_${productSlug}_${countdownMinutes}`;
    let endTime = 0;
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved && Number(saved) > Date.now()) {
        endTime = Number(saved);
      } else {
        endTime = Date.now() + countdownMinutes * 60 * 1000;
        window.localStorage.setItem(storageKey, String(endTime));
      }
    } catch {
      endTime = Date.now() + countdownMinutes * 60 * 1000;
    }

    const update = () => {
      const diff = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
      setSecondsLeft(diff);
    };
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [showCountdown, countdownMinutes, productSlug]);

  const hasStock = Boolean(stockRemaining && stockRemaining > 0);
  const hasTimer = Boolean(showCountdown && countdownMinutes && countdownMinutes > 0 && secondsLeft > 0);

  if (!hasStock && !hasTimer) return null;

  const hrs = String(Math.floor(secondsLeft / 3600)).padStart(2, '0');
  const mins = String(Math.floor((secondsLeft % 3600) / 60)).padStart(2, '0');
  const secs = String(secondsLeft % 60).padStart(2, '0');

  return (
    <div className="liquid-glass-subtle rounded-[20px] px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
      {hasStock && (
        <div className="flex items-center gap-2 font-medium text-amber-800 dark:text-amber-300">
          <Flame className="w-4 h-4 shrink-0" />
          <span>
            الكمية المتبقية في العرض:{' '}
            <strong className="font-mono tabular-nums">{stockRemaining}</strong> قطع فقط
          </span>
        </div>
      )}

      {hasTimer && (
        <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-200">
          <Clock className="w-4 h-4 shrink-0" style={{ color: 'var(--accent-primary)' }} />
          <span>ينتهي العرض خلال</span>
          <span
            dir="ltr"
            className="font-mono font-bold tabular-nums tracking-wide text-zinc-950 dark:text-white"
          >
            {hrs}:{mins}:{secs}
          </span>
        </div>
      )}
    </div>
  );
}

/* 2. Trust Pillars Strip */
export function TrustStrip() {
  const items = [
    {
      icon: Banknote,
      title: 'الدفع عند الاستلام',
      subtitle: 'عاين طلبك قبل الدفع نقداً',
    },
    {
      icon: Truck,
      title: 'شحن سريع ومؤمّن',
      subtitle: 'توصيل لباب المنزل لكل المحافظات',
    },
    {
      icon: RotateCcw,
      title: 'ضمان الاستبدال',
      subtitle: 'استرجاع أو استبدال خلال 14 يوماً',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <LiquidGlassCard key={item.title} className="p-4" specular={false}>
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-[14px] flex items-center justify-center shrink-0 bg-white/75 dark:bg-white/10"
                style={{ color: 'var(--accent-primary)' }}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-zinc-950 dark:text-white">
                  {item.title}
                </div>
                <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5 leading-5">
                  {item.subtitle}
                </div>
              </div>
            </div>
          </LiquidGlassCard>
        );
      })}
    </div>
  );
}

/* 3. Customer Reviews Section */
export function CustomerReviewsSection({ reviews }: { reviews: ProductReview[] }) {
  if (!reviews || reviews.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 18, scale: 0.99 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-4"
    >
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-xl font-bold text-zinc-950 dark:text-white">آراء العملاء</h2>
        <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono tabular-nums">
          {reviews.length} تقييمات موثّقة
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reviews.map((rev) => {
          const stars = Math.max(1, Math.min(5, Math.round(rev.rating || 5)));
          return (
            <LiquidGlassCard key={rev.id} className="p-5">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  {rev.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={rev.imageUrl}
                      alt={rev.author}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-full object-cover border border-white/60 dark:border-white/15 shrink-0"
                    />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                      style={{ backgroundColor: 'var(--accent-primary)' }}
                    >
                      {rev.author.trim().slice(0, 1)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-zinc-950 dark:text-white truncate">
                      {rev.author}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      {rev.city ? `${rev.city} · شراء مؤكد` : 'شراء مؤكد'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-0.5 text-amber-500 shrink-0" aria-label={`تقييم ${stars} من 5`}>
                  {Array.from({ length: stars }).map((_, idx) => (
                    <Star key={idx} className="w-3.5 h-3.5 fill-current" />
                  ))}
                </div>
              </div>

              <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-7">{rev.comment}</p>
            </LiquidGlassCard>
          );
        })}
      </div>
    </motion.section>
  );
}

/* 4. Liquid Glass FAQ Accordion Section */
export function FaqAccordionSection({ faqs }: { faqs: ProductFaq[] }) {
  const [openId, setOpenId] = useState<string | null>(faqs[0]?.id ?? null);

  if (!faqs || faqs.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 18, scale: 0.99 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-4"
    >
      <h2 className="text-xl font-bold text-zinc-950 dark:text-white">الأسئلة الشائعة</h2>

      <LiquidGlassCard className="divide-y divide-zinc-200/60 dark:divide-white/10" specular={false}>
        {faqs.map((faq) => {
          const isOpen = openId === faq.id;
          return (
            <div key={faq.id}>
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : faq.id)}
                aria-expanded={isOpen}
                className="w-full px-5 sm:px-6 py-4 flex items-center justify-between gap-4 text-right cursor-pointer hover:bg-white/30 dark:hover:bg-white/5 transition-colors duration-300"
              >
                <span className="text-sm sm:text-[15px] font-semibold text-zinc-950 dark:text-white leading-6">
                  {faq.question}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-zinc-500 dark:text-zinc-400 shrink-0 transition-transform duration-300 ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 sm:px-6 pb-5 pt-0.5 text-sm text-zinc-600 dark:text-zinc-300 leading-7">
                      {faq.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </LiquidGlassCard>
    </motion.section>
  );
}

/* 5. Floating WhatsApp Direct Contact Button */
export function FloatingWhatsAppButton({
  whatsappNumber,
  productName,
  offsetForStickyBar,
}: {
  whatsappNumber?: string;
  productName: string;
  offsetForStickyBar: boolean;
}) {
  if (!whatsappNumber || !whatsappNumber.trim()) return null;

  return (
    <motion.a
      href={buildMerchantWhatsAppUrl(whatsappNumber, productName)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="تواصل معنا عبر واتساب"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
      className={`fixed left-4 sm:left-6 z-40 inline-flex items-center gap-2 px-4 py-3 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold shadow-[0_14px_32px_-8px_rgba(5,150,105,0.55)] border border-white/25 transition-[bottom] duration-300 ${
        offsetForStickyBar ? 'bottom-20 lg:bottom-6' : 'bottom-5 sm:bottom-6'
      }`}
    >
      <MessageCircle className="w-4 h-4 shrink-0" />
      <span className="hidden sm:inline">استفسر عبر واتساب</span>
    </motion.a>
  );
}
