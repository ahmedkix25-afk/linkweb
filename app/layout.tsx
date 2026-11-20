import type { Metadata } from 'next';
import { IBM_Plex_Sans_Arabic, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import ErrorBoundary from '@/components/ErrorBoundary';
import { AuthProvider } from '@/components/AuthProvider';
import { ThemeProvider } from '@/components/ThemeProvider';

const ibmArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ibm-arabic',
  display: 'swap',
});

const ibmMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-ibm-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'صفحة بيع — نظام صفحات البيع المباشر',
  description:
    'نظام مستقل لإنشاء صفحات بيع سريعة لكل منتج برابط خاص مع الدفع عند الاستلام ولوحة تحكم محمية وإشعارات طلبات لحظية.',
  openGraph: {
    title: 'صفحة بيع — نظام صفحات البيع المباشر',
    description:
      'نظام مستقل لإنشاء صفحات بيع سريعة لكل منتج برابط خاص مع الدفع عند الاستلام ولوحة تحكم محمية وإشعارات طلبات لحظية.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'صفحة بيع — نظام صفحات البيع المباشر',
    description:
      'نظام مستقل لإنشاء صفحات بيع سريعة لكل منتج برابط خاص مع الدفع عند الاستلام ولوحة تحكم محمية وإشعارات طلبات لحظية.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${ibmArabic.variable} ${ibmMono.variable}`}>
      <body
        suppressHydrationWarning
        className="min-h-screen bg-[var(--surface-canvas)] text-zinc-950 dark:text-zinc-100 antialiased"
      >
        <ErrorBoundary>
          <ThemeProvider>
            <AuthProvider>{children}</AuthProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
