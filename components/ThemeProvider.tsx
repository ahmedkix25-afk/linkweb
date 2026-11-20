'use client';

import React, { createContext, useContext, useEffect, useCallback, useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';

type ThemeMode = 'light' | 'dark';

interface ThemeContextValue {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

const THEME_STORAGE_KEY = 'app_theme_mode';
const THEME_EVENT_NAME = 'app-theme-change';

function readThemeSnapshot(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function subscribeTheme(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const onChange = () => onStoreChange();
  window.addEventListener(THEME_EVENT_NAME, onChange);
  window.addEventListener('storage', onChange);
  mq.addEventListener('change', onChange);
  return () => {
    window.removeEventListener(THEME_EVENT_NAME, onChange);
    window.removeEventListener('storage', onChange);
    mq.removeEventListener('change', onChange);
  };
}

function getServerThemeSnapshot(): ThemeMode {
  return 'light';
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribeTheme, readThemeSnapshot, getServerThemeSnapshot);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const setTheme = useCallback((mode: ThemeMode) => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // Ignore storage errors
    }
    document.documentElement.classList.toggle('dark', mode === 'dark');
    window.dispatchEvent(new Event(THEME_EVENT_NAME));
  }, []);

  const toggleTheme = useCallback(() => {
    const current = readThemeSnapshot();
    const next: ThemeMode = current === 'dark' ? 'light' : 'dark';
    setTheme(next);
  }, [setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }
  return ctx;
}

export function ThemeToggleButton({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'التبديل للوضع الفاتح' : 'التبديل للوضع الداكن'}
      title={theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}
      className={`w-10 h-10 rounded-full liquid-glass flex items-center justify-center text-zinc-700 dark:text-zinc-200 hover:scale-[1.03] active:scale-[0.97] transition-transform duration-300 cursor-pointer shrink-0 ${className}`}
    >
      {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}
