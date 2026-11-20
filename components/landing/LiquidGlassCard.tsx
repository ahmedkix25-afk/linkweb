'use client';

import React, { useRef } from 'react';

interface LiquidGlassCardProps {
  children: React.ReactNode;
  className?: string;
  strong?: boolean;
  specular?: boolean;
}

/**
 * iOS 26-inspired Liquid Glass surface with subtle cursor-reactive edge specular reflection.
 * Automatically stays calm and zero-overhead on touch/reduced-motion devices.
 */
export default function LiquidGlassCard({
  children,
  className = '',
  strong = false,
  specular = true,
}: LiquidGlassCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const sheenRef = useRef<HTMLDivElement | null>(null);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!specular || e.pointerType !== 'mouse') return;
    const el = cardRef.current;
    const sheen = sheenRef.current;
    if (!el || !sheen) return;

    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    sheen.style.opacity = '1';
    sheen.style.background = `radial-gradient(420px circle at ${x}% ${y}%, rgba(255,255,255,0.22), transparent 62%)`;
  };

  const handlePointerLeave = () => {
    if (sheenRef.current) {
      sheenRef.current.style.opacity = '0';
    }
  };

  return (
    <div
      ref={cardRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={`relative overflow-hidden rounded-[28px] ${
        strong ? 'liquid-glass-strong' : 'liquid-glass'
      } ${className}`}
    >
      {specular && (
        <div
          ref={sheenRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 motion-reduce:hidden"
        />
      )}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
