'use client';

import React, { useEffect, useState, useRef, useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'motion/react';
import { Box, Images, ChevronRight, ChevronLeft, Package, Rotate3d } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

const ProductCanvas3D = dynamic(() => import('./ProductCanvas3D'), {
  ssr: false,
  loading: () => null,
});

function subscribeReducedMotion(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  mq.addEventListener('change', onStoreChange);
  return () => mq.removeEventListener('change', onStoreChange);
}

function getReducedMotionSnapshot(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function getServerReducedMotionSnapshot(): boolean {
  return false;
}

interface ProductStage3DProps {
  productName: string;
  images: string[];
  model3dUrl?: string;
  accentHex: string;
}

/**
 * Interactive 3D & Multi-Layer Parallax Product Stage.
 * - Lazy-loads Three.js WebGL on capable devices (with full GLB support + 3D sculpted card).
 * - Automatically degrades gracefully to an ultra-lightweight Multi-Layer Parallax/Tilt Card
 *   on weak devices, software WebGL, or when prefers-reduced-motion is enabled.
 */
export default function ProductStage3D({
  productName,
  images,
  model3dUrl,
  accentHex,
}: ProductStage3DProps) {
  const { theme } = useTheme();
  const [activeIdx, setActiveIdx] = useState(0);
  const [failedImages, setFailedImages] = useState<Record<number, boolean>>({});
  const [viewMode, setViewMode] = useState<'3d' | 'gallery'>('3d');
  const [webglAllowed, setWebglAllowed] = useState(false);
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getServerReducedMotionSnapshot
  );
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, mx: 50, my: 50 });

  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (reducedMotion) return;

    // Lightweight device capability check to protect weak mobile GPUs
    const cores = navigator.hardwareConcurrency || 4;
    const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory || 4;
    const isLowPowerDevice = cores <= 2 || mem <= 2;

    if (!isLowPowerDevice) {
      // Delay WebGL mount slightly after first paint so mobile load stays < 3s
      const timer = window.setTimeout(() => setWebglAllowed(true), 120);
      return () => {
        window.clearTimeout(timer);
      };
    }
  }, [reducedMotion]);

  const currentImage = images[activeIdx] || '';
  const showThreeCanvas = viewMode === '3d' && webglAllowed && !reducedMotion;

  const handlePrev = () => {
    if (images.length <= 1) return;
    setActiveIdx((i) => (i === 0 ? images.length - 1 : i - 1));
  };

  const handleNext = () => {
    if (images.length <= 1) return;
    setActiveIdx((i) => (i === images.length - 1 ? 0 : i + 1));
  };

  const handleParallaxMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reducedMotion || showThreeCanvas || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    setTilt({
      rx: (0.5 - py) * 14,
      ry: (px - 0.5) * 16,
      mx: px * 100,
      my: py * 100,
    });
  };

  const handleParallaxLeave = () => {
    setTilt({ rx: 0, ry: 0, mx: 50, my: 50 });
  };

  return (
    <section aria-label="عرض المنتج التفاعلي" className="space-y-4">
      {/* Main Interactive Stage Container (Never places backdrop-filter over WebGL canvas) */}
      <div
        ref={cardRef}
        onPointerMove={handleParallaxMove}
        onPointerLeave={handleParallaxLeave}
        className="relative aspect-[4/3] w-full rounded-[30px] overflow-hidden border border-white/70 dark:border-white/15 bg-gradient-to-br from-white/75 via-white/45 to-zinc-100/70 dark:from-slate-900/85 dark:via-slate-900/65 dark:to-slate-950/85 shadow-[0_24px_60px_-24px_rgba(15,23,42,0.22)] dark:shadow-[0_28px_68px_-24px_rgba(0,0,0,0.72)]"
        style={{ perspective: '1100px' }}
      >
        {showThreeCanvas ? (
          <div className="w-full h-full relative">
            <ProductCanvas3D
              imageUrl={currentImage}
              model3dUrl={model3dUrl}
              accentHex={accentHex}
              isDark={theme === 'dark'}
              reducedMotion={reducedMotion}
              onFallback={() => setWebglAllowed(false)}
            />
            {/* Minimal solid translucent hint chip (no backdrop-filter over WebGL!) */}
            <div className="pointer-events-none absolute bottom-3.5 right-3.5 px-3 py-1.5 rounded-full bg-zinc-950/70 text-white text-[11px] font-medium flex items-center gap-1.5">
              <Rotate3d className="w-3.5 h-3.5" />
              <span>{model3dUrl ? 'اسحب لتدوير المجسم 360°' : 'حرّك للتفاعل 3D'}</span>
            </div>
          </div>
        ) : (
          /* Lightweight Multi-Layer Parallax / Tilt 3D Card (Fallback + Gallery Mode) */
          <div
            className="w-full h-full flex items-center justify-center p-3 sm:p-4 transition-transform duration-300 ease-out"
            style={{
              transform: reducedMotion
                ? undefined
                : `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
              transformStyle: 'preserve-3d',
            }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={activeIdx}
                initial={reducedMotion ? false : { opacity: 0.4, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reducedMotion ? undefined : { opacity: 0.4, scale: 0.98 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="relative w-full h-full rounded-[22px] overflow-hidden shadow-lg"
                style={{ transform: 'translateZ(24px)' }}
              >
                {currentImage && !failedImages[activeIdx] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={currentImage}
                    alt={`${productName} — صورة ${activeIdx + 1}`}
                    referrerPolicy="no-referrer"
                    onError={() => setFailedImages((prev) => ({ ...prev, [activeIdx]: true }))}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-100 dark:bg-slate-800 text-zinc-500 dark:text-zinc-400 p-6 text-center">
                    <Package className="w-12 h-12 mb-3 opacity-60" />
                    <span className="text-sm font-medium">{productName}</span>
                  </div>
                )}

                {/* Dynamic Specular Sheen Layer */}
                {!reducedMotion && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 transition-opacity duration-300"
                    style={{
                      background: `radial-gradient(360px circle at ${tilt.mx}% ${tilt.my}%, rgba(255,255,255,0.22), transparent 60%)`,
                    }}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        )}

        {/* Navigation Arrows (Solid translucent surfaces, no backdrop-filter over WebGL) */}
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              aria-label="الصورة السابقة"
              className="absolute right-3.5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/90 dark:bg-slate-900/90 hover:bg-white dark:hover:bg-slate-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200/80 dark:border-white/15 flex items-center justify-center shadow-md transition-transform duration-300 hover:scale-105 cursor-pointer"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              aria-label="الصورة التالية"
              className="absolute left-3.5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/90 dark:bg-slate-900/90 hover:bg-white dark:hover:bg-slate-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200/80 dark:border-white/15 flex items-center justify-center shadow-md transition-transform duration-300 hover:scale-105 cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          </>
        )}
      </div>

      {/* Below-Stage Controls Bar: Mode Switcher + Image Thumbnails */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {images.length > 1 ? (
          <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
            {images.map((imgUrl, idx) => (
              <button
                key={`${imgUrl}-${idx}`}
                type="button"
                onClick={() => setActiveIdx(idx)}
                aria-label={`عرض الصورة رقم ${idx + 1}`}
                className={`relative shrink-0 w-20 aspect-[4/3] rounded-[16px] overflow-hidden border-2 transition-all duration-300 cursor-pointer ${
                  activeIdx === idx
                    ? 'scale-[1.03] shadow-md'
                    : 'border-transparent opacity-70 hover:opacity-100'
                }`}
                style={{
                  borderColor: activeIdx === idx ? accentHex : 'transparent',
                }}
              >
                {!failedImages[idx] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imgUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    onError={() => setFailedImages((prev) => ({ ...prev, [idx]: true }))}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-zinc-200 dark:bg-slate-800 flex items-center justify-center">
                    <Package className="w-4 h-4 text-zinc-400" />
                  </div>
                )}
              </button>
            ))}
          </div>
        ) : (
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            {model3dUrl ? 'مجسم ثلاثي الأبعاد تفاعلي' : 'عرض تفاعلي عالي الدقة'}
          </div>
        )}

        {/* Segmented 3D / Photo Switcher */}
        {!reducedMotion && (
          <div className="inline-flex items-center gap-1 p-1 rounded-full liquid-glass-subtle shrink-0">
            <button
              type="button"
              onClick={() => {
                setViewMode('3d');
                setWebglAllowed(true);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors duration-300 cursor-pointer whitespace-nowrap ${
                viewMode === '3d'
                  ? 'bg-white dark:bg-slate-800 text-zinc-950 dark:text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              عرض 3D
            </button>
            <button
              type="button"
              onClick={() => setViewMode('gallery')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors duration-300 cursor-pointer whitespace-nowrap ${
                viewMode === 'gallery'
                  ? 'bg-white dark:bg-slate-800 text-zinc-950 dark:text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
              }`}
            >
              <Images className="w-3.5 h-3.5" />
              الصور
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
