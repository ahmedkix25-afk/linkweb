import Link from 'next/link';
import { ArrowLeft, Link2, BellRing, Box, ShieldCheck } from 'lucide-react';
import { ThemeToggleButton } from '@/components/ThemeProvider';

export default function HomePage() {
  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden">
      {/* Ambient Liquid Mesh Background */}
      <div aria-hidden="true" className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-28 -right-24 w-[440px] h-[440px] rounded-full blur-[95px] animate-blob-a"
          style={{ background: 'var(--blob-1)' }}
        />
        <div
          className="absolute top-[40%] -left-24 w-[400px] h-[400px] rounded-full blur-[100px] animate-blob-b"
          style={{ background: 'var(--blob-2)' }}
        />
      </div>

      {/* Clean 3-Zone Top Bar */}
      <header className="w-full sticky top-0 z-20 liquid-glass border-b border-white/60 dark:border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          <Link
            href="/"
            className="text-lg font-bold tracking-tight text-zinc-950 dark:text-white whitespace-nowrap shrink-0"
          >
            صفحة بيع
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-zinc-600 dark:text-zinc-300">
            <a
              href="#how-it-works"
              className="hover:text-zinc-950 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              آلية العمل
            </a>
            <a
              href="#capabilities"
              className="hover:text-zinc-950 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              المميزات
            </a>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <ThemeToggleButton />
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full liquid-cta text-white text-sm font-semibold whitespace-nowrap shrink-0"
            >
              لوحة التحكم
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Focused Gateway Hero */}
      <main className="flex-1">
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="max-w-3xl">
            <h1 className="text-3xl sm:text-5xl font-bold text-zinc-950 dark:text-white leading-tight text-balance mb-5">
              صفحات بيع بتصميم Liquid Glass وعرض 3D تفاعلي لكل منتج
            </h1>
            <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-300 leading-8 max-w-2xl mb-8">
              أنشئ صفحة بيع مستقلة لكل منتج برابط خاص، مع عرض ثلاثي الأبعاد، ودفع عند الاستلام،
              وتحقق ذكي من رقم الموبايل، وإشعارات طلبات لحظية عبر لوحة التحكم وتليجرام.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/admin"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-[20px] liquid-cta text-white text-sm font-bold whitespace-nowrap shrink-0"
              >
                الدخول إلى لوحة التحكم
                <ArrowLeft className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* Unified Liquid Glass Feature Pillars */}
        <section id="capabilities" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
          <h2 id="how-it-works" className="text-xl font-bold text-zinc-950 dark:text-white mb-6">
            كل ما تحتاجه لإدارة حملات البيع المباشر
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="liquid-glass rounded-[28px] p-6 space-y-2.5">
              <Box className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
              <h3 className="text-base font-bold text-zinc-950 dark:text-white">
                عرض 3D و Liquid Glass
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-6">
                مشهد ثلاثي الأبعاد تفاعلي للمنتج (مع دعم ملفات GLB) وأسطح زجاجية تدعم الوضع الفاتح
                والداكن بسلاسة.
              </p>
            </div>

            <div className="liquid-glass rounded-[28px] p-6 space-y-2.5">
              <Link2 className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
              <h3 className="text-base font-bold text-zinc-950 dark:text-white">
                رابط مستقل لكل منتج
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-6">
                صفحة بيع مركّزة على{' '}
                <span className="font-mono text-xs text-zinc-800 dark:text-zinc-200" dir="ltr">
                  /p/slug
                </span>{' '}
                بدون قوائم مشتتة، مع آراء العملاء والأسئلة الشائعة وزر واتساب عائم.
              </p>
            </div>

            <div className="liquid-glass rounded-[28px] p-6 space-y-2.5">
              <BellRing className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
              <h3 className="text-base font-bold text-zinc-950 dark:text-white">
                إشعارات فورية وتليجرام
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-6">
                تنبيه صوتي وعداد حي داخل لوحة التحكم مع إشعار فوري على تليجرام فور كل طلب جديد.
              </p>
            </div>

            <div className="liquid-glass rounded-[28px] p-6 space-y-2.5">
              <ShieldCheck className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
              <h3 className="text-base font-bold text-zinc-950 dark:text-white">
                حماية ضد التكرار والسبام
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-6">
                تحقق ذكي من رقم الموبايل المصري، ومنع الطلبات المكررة، وحماية Honeypot ضد السبام.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
