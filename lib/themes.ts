import { ProductThemeId } from './types';

export interface ProductThemePalette {
  id: ProductThemeId;
  label: string;
  primary: string;
  primaryHover: string;
  secondary: string;
  glow: string;
  blobOneLight: string;
  blobTwoLight: string;
  blobThreeLight: string;
  blobOneDark: string;
  blobTwoDark: string;
  blobThreeDark: string;
  swatch: string;
}

export const PRODUCT_THEMES: Record<ProductThemeId, ProductThemePalette> = {
  emerald: {
    id: 'emerald',
    label: 'زمردي هادئ',
    primary: '#0f766e',
    primaryHover: '#115e59',
    secondary: '#0ea5e9',
    glow: 'rgba(15, 118, 110, 0.34)',
    blobOneLight: 'rgba(20, 184, 166, 0.22)',
    blobTwoLight: 'rgba(56, 189, 248, 0.18)',
    blobThreeLight: 'rgba(16, 185, 129, 0.14)',
    blobOneDark: 'rgba(20, 184, 166, 0.24)',
    blobTwoDark: 'rgba(14, 165, 233, 0.20)',
    blobThreeDark: 'rgba(5, 150, 105, 0.18)',
    swatch: '#0f766e',
  },
  sapphire: {
    id: 'sapphire',
    label: 'أزرق ياقوتي',
    primary: '#1d4ed8',
    primaryHover: '#1e40af',
    secondary: '#06b6d4',
    glow: 'rgba(29, 78, 216, 0.34)',
    blobOneLight: 'rgba(59, 130, 246, 0.22)',
    blobTwoLight: 'rgba(6, 182, 212, 0.18)',
    blobThreeLight: 'rgba(99, 102, 241, 0.14)',
    blobOneDark: 'rgba(59, 130, 246, 0.26)',
    blobTwoDark: 'rgba(6, 182, 212, 0.22)',
    blobThreeDark: 'rgba(79, 70, 229, 0.18)',
    swatch: '#1d4ed8',
  },
  amber: {
    id: 'amber',
    label: 'عنبر دافئ',
    primary: '#b45309',
    primaryHover: '#92400e',
    secondary: '#d97706',
    glow: 'rgba(180, 83, 9, 0.32)',
    blobOneLight: 'rgba(245, 158, 11, 0.22)',
    blobTwoLight: 'rgba(251, 146, 60, 0.18)',
    blobThreeLight: 'rgba(217, 119, 6, 0.13)',
    blobOneDark: 'rgba(245, 158, 11, 0.22)',
    blobTwoDark: 'rgba(234, 88, 12, 0.18)',
    blobThreeDark: 'rgba(180, 83, 9, 0.18)',
    swatch: '#b45309',
  },
  rose: {
    id: 'rose',
    label: 'وردي أنيق',
    primary: '#be123c',
    primaryHover: '#9f1239',
    secondary: '#f43f5e',
    glow: 'rgba(190, 18, 60, 0.32)',
    blobOneLight: 'rgba(244, 63, 94, 0.20)',
    blobTwoLight: 'rgba(251, 113, 133, 0.16)',
    blobThreeLight: 'rgba(236, 72, 153, 0.13)',
    blobOneDark: 'rgba(244, 63, 94, 0.24)',
    blobTwoDark: 'rgba(219, 39, 119, 0.20)',
    blobThreeDark: 'rgba(159, 18, 57, 0.18)',
    swatch: '#be123c',
  },
  violet: {
    id: 'violet',
    label: 'بنفسجي ملكي',
    primary: '#6d28d9',
    primaryHover: '#5b21b6',
    secondary: '#38bdf8',
    glow: 'rgba(109, 40, 217, 0.34)',
    blobOneLight: 'rgba(139, 92, 246, 0.22)',
    blobTwoLight: 'rgba(56, 189, 248, 0.16)',
    blobThreeLight: 'rgba(168, 85, 247, 0.14)',
    blobOneDark: 'rgba(139, 92, 246, 0.26)',
    blobTwoDark: 'rgba(56, 189, 248, 0.18)',
    blobThreeDark: 'rgba(109, 40, 217, 0.22)',
    swatch: '#6d28d9',
  },
  slate: {
    id: 'slate',
    label: 'رمادي تيتانيوم',
    primary: '#27272a',
    primaryHover: '#18181b',
    secondary: '#0f766e',
    glow: 'rgba(39, 39, 42, 0.28)',
    blobOneLight: 'rgba(113, 113, 122, 0.18)',
    blobTwoLight: 'rgba(20, 184, 166, 0.15)',
    blobThreeLight: 'rgba(161, 161, 170, 0.16)',
    blobOneDark: 'rgba(161, 161, 170, 0.18)',
    blobTwoDark: 'rgba(20, 184, 166, 0.20)',
    blobThreeDark: 'rgba(82, 82, 91, 0.22)',
    swatch: '#27272a',
  },
};

export const THEME_OPTIONS: ProductThemePalette[] = Object.values(PRODUCT_THEMES);

/**
 * Picks the product's explicit theme or deterministically assigns a curated palette from its slug.
 */
export function resolveProductTheme(slug: string, explicit?: ProductThemeId): ProductThemePalette {
  if (explicit && PRODUCT_THEMES[explicit]) {
    return PRODUCT_THEMES[explicit];
  }
  const keys = Object.keys(PRODUCT_THEMES) as ProductThemeId[];
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return PRODUCT_THEMES[keys[hash % keys.length]];
}
