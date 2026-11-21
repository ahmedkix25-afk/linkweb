'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Lock,
  Mail,
  KeyRound,
  AlertCircle,
  Loader2,
  LogOut,
  CheckCircle2,
  ArrowRight,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { BOOTSTRAP_ADMIN_EMAIL } from '@/lib/firebase';

export default function AdminLogin() {
  const {
    user,
    isAdmin,
    needsEmailVerification,
    authError,
    clearAuthError,
    signInWithGoogle,
    signInWithGoogleRedirect,
    signInWithEmail,
    registerWithEmail,
    resendVerificationEmail,
    refreshAuth,
    signOutUser,
  } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [showRedirectFallback, setShowRedirectFallback] = useState(false);
  const [unauthorizedHost, setUnauthorizedHost] = useState<string | null>(null);
  const [copiedHost, setCopiedHost] = useState(false);

  const displayedError = errorMsg || authError;

  const isTopLevelWindow =
    typeof window !== 'undefined' &&
    (() => {
      try {
        return window.self === window.top;
      } catch {
        return false;
      }
    })();

  const handleCopyHost = async (host: string) => {
    try {
      await navigator.clipboard.writeText(host);
      setCopiedHost(true);
      setTimeout(() => setCopiedHost(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setUnauthorizedHost(null);
    clearAuthError();
    setBusy(true);
    try {
      if (mode === 'login') {
        await signInWithEmail(email, password);
      } else {
        await registerWithEmail(email, password);
        setInfoMsg(
          'تم إنشاء الحساب وإرسال رابط التفعيل إلى بريدك الإلكتروني. يرجى تأكيد البريد ثم تسجيل الدخول.'
        );
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/operation-not-allowed') {
        setErrorMsg(
          'تسجيل الدخول بالإيميل والباسورد غير مفعّل بعد في Firebase Console. يمكنك تفعيله من Authentication > Sign-in method > Email/Password، أو الدخول مباشرة عبر حساب Google أدناه.'
        );
      } else if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found'
      ) {
        setErrorMsg('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
      } else if (code === 'auth/email-already-in-use') {
        setErrorMsg('هذا البريد الإلكتروني مسجل بالفعل. يرجى تسجيل الدخول.');
      } else if (code === 'auth/weak-password') {
        setErrorMsg('كلمة المرور يجب أن تكون 6 أحرف على الأقل.');
      } else if (code === 'auth/too-many-requests') {
        setErrorMsg('تم تجاوز عدد المحاولات المسموح بها. يرجى الانتظار قليلاً ثم المحاولة.');
      } else {
        setErrorMsg('تعذر تسجيل الدخول. يرجى التحقق من البيانات أو استخدام الدخول عبر Google.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setUnauthorizedHost(null);
    clearAuthError();
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      const firebaseErr = err as { code?: string };
      const code = firebaseErr?.code || '';
      const host = typeof window !== 'undefined' ? window.location.hostname : '';

      if (code === 'auth/unauthorized-domain') {
        setUnauthorizedHost(host);
        setErrorMsg(
          `الدومين الحالي (${host}) غير مضاف في Firebase Authorized Domains. أضفه من Firebase Console ← Authentication ← Settings ← Authorized domains.`
        );
      } else if (code === 'auth/popup-blocked') {
        setShowRedirectFallback(isTopLevelWindow);
        setErrorMsg(
          'المتصفح منع فتح نافذة تسجيل الدخول المنبثقة (Popup Blocked). اسمح بالنوافذ المنبثقة أو استخدم الدخول بإعادة التوجيه.'
        );
      } else if (code === 'auth/popup-closed-by-user') {
        setShowRedirectFallback(isTopLevelWindow);
        setInfoMsg(
          'تم إغلاق نافذة تسجيل الدخول قبل إتمام العملية. لو أُغلقت تلقائياً على الموبايل، جرّب زر «الدخول بإعادة التوجيه» بالأسفل.'
        );
      } else if (code === 'auth/operation-not-allowed') {
        setErrorMsg(
          'تسجيل الدخول عبر Google غير مفعّل في Firebase Console. فعّله من Authentication ← Sign-in method ← Google.'
        );
      } else if (code === 'auth/network-request-failed') {
        setErrorMsg('تعذر الاتصال بخوادم Google. تحقق من اتصال الإنترنت وحاول مجدداً.');
      } else if (code !== 'auth/cancelled-popup-request') {
        setShowRedirectFallback(isTopLevelWindow);
        setErrorMsg(
          `تعذر تسجيل الدخول عبر Google${code ? ` (${code})` : ''}. تأكد من تفعيل Google في Firebase وإضافة الدومين (${host}) في Authorized domains.`
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleRedirect = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    clearAuthError();
    setBusy(true);
    try {
      await signInWithGoogleRedirect();
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      setErrorMsg(`تعذر التحويل لتسجيل الدخول عبر Google${code ? ` (${code})` : ''}.`);
      setBusy(false);
    }
  };

  const handleResend = async () => {
    setBusy(true);
    setErrorMsg(null);
    try {
      await resendVerificationEmail();
      setInfoMsg('تم إرسال رابط التفعيل إلى بريدك الإلكتروني. افتح الرابط ثم اضغط «تحديث الصلاحيات».');
    } catch {
      setErrorMsg('تعذر إعادة إرسال رابط التفعيل حالياً. انتظر دقيقة وحاول مرة أخرى.');
    } finally {
      setBusy(false);
    }
  };

  const handleRefreshVerification = async () => {
    setBusy(true);
    setErrorMsg(null);
    try {
      await refreshAuth();
    } catch {
      window.location.reload();
    } finally {
      setBusy(false);
    }
  };

  // Signed in with bootstrap email, awaiting email verification
  if (user && needsEmailVerification) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-slate-950 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-zinc-200 dark:border-slate-800 rounded-2xl p-8 space-y-5">
          <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center">
            <Mail className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-950 dark:text-white mb-1.5">
              تأكيد البريد الإلكتروني مطلوب
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-6">
              تم تسجيل الدخول بالبريد{' '}
              <span className="font-mono text-zinc-900 dark:text-white">{user.email}</span> ولكنه غير
              مفعّل بعد. لحماية بيانات العملاء، يرجى تأكيد البريد الإلكتروني أو الدخول مباشرة بحساب
              Google.
            </p>
          </div>

          {infoMsg && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{infoMsg}</span>
            </div>
          )}
          {displayedError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{displayedError}</span>
            </div>
          )}

          <div className="space-y-2.5 pt-2">
            <button
              type="button"
              onClick={handleResend}
              disabled={busy}
              className="w-full h-11 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium transition-colors cursor-pointer"
            >
              إرسال رابط التفعيل مجدداً
            </button>
            <button
              type="button"
              onClick={handleRefreshVerification}
              disabled={busy}
              className="w-full h-11 rounded-lg border border-zinc-300 dark:border-slate-700 hover:bg-zinc-50 dark:hover:bg-slate-800 text-zinc-800 dark:text-zinc-100 text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} />
              لقد قمت بالتفعيل — تحديث الصلاحيات
            </button>
            <button
              type="button"
              onClick={signOutUser}
              className="w-full h-10 text-zinc-500 hover:text-zinc-900 dark:hover:text-white text-xs font-medium cursor-pointer"
            >
              تسجيل الخروج
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Signed in with an unauthorized account
  if (user && !isAdmin) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-slate-950 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-zinc-200 dark:border-slate-800 rounded-2xl p-8 text-center space-y-5">
          <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-950 dark:text-white mb-1.5">
              غير مصرح لك بالدخول
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-6">
              الحساب المسجل حالياً (
              <span className="font-mono text-zinc-900 dark:text-white">{user.email}</span>) لا يملك
              صلاحية الأدمن. سجّل الدخول بحساب الأدمن المعتمد (
              <span className="font-mono text-zinc-900 dark:text-white">{BOOTSTRAP_ADMIN_EMAIL}</span>
              ).
            </p>
          </div>
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={signOutUser}
              className="w-full h-11 rounded-lg bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              تسجيل الخروج وتبديل الحساب
            </button>
            <button
              type="button"
              onClick={handleRefreshVerification}
              disabled={busy}
              className="w-full h-10 rounded-lg border border-zinc-300 dark:border-slate-700 text-zinc-700 dark:text-zinc-200 text-xs font-medium inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
              إعادة التحقق من الصلاحيات
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-slate-950 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            العودة للصفحة الرئيسية
          </Link>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-zinc-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-teal-700 text-white flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-zinc-950 dark:text-white">لوحة تحكم الأدمن</h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                تسجيل دخول محمي لإدارة المنتجات والطلبات
              </p>
            </div>
          </div>

          {displayedError && (
            <div
              role="alert"
              className="mb-4 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/70 text-rose-700 dark:text-rose-300 text-xs leading-5 space-y-2"
            >
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{displayedError}</span>
              </div>
              {unauthorizedHost && (
                <button
                  type="button"
                  onClick={() => handleCopyHost(unauthorizedHost)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-[11px] font-mono cursor-pointer"
                >
                  {copiedHost ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copiedHost ? 'تم نسخ الدومين' : `نسخ الدومين: ${unauthorizedHost}`}
                </button>
              )}
            </div>
          )}

          {infoMsg && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/70 text-emerald-800 dark:text-emerald-300 text-xs leading-5 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{infoMsg}</span>
            </div>
          )}

          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div>
              <label
                htmlFor="admin-email"
                className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1.5"
              >
                البريد الإلكتروني
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="admin-email"
                  type="email"
                  required
                  dir="ltr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="w-full h-11 pr-10 pl-3.5 rounded-xl border border-zinc-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-zinc-950 dark:text-white text-sm text-right placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="admin-password"
                className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1.5"
              >
                كلمة المرور
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-zinc-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="admin-password"
                  type="password"
                  required
                  minLength={6}
                  dir="ltr"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 pr-10 pl-3.5 rounded-xl border border-zinc-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-zinc-950 dark:text-white text-sm text-right placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full h-11 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:bg-teal-700/60 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : mode === 'login' ? (
                'تسجيل الدخول'
              ) : (
                'إنشاء حساب أدمن بالبريد'
              )}
            </button>
          </form>

          <div className="mt-3 text-center">
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setErrorMsg(null);
                setInfoMsg(null);
                clearAuthError();
              }}
              className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              {mode === 'login'
                ? 'أول مرة تستخدم البريد وكلمة المرور؟ إنشاء حساب'
                : 'لديك حساب بالفعل؟ تسجيل الدخول'}
            </button>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-200 dark:border-slate-800" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white dark:bg-slate-900 px-3 text-zinc-400">أو الدخول السريع</span>
            </div>
          </div>

          <div className="space-y-2.5">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={busy}
              className="w-full h-11 rounded-xl border border-zinc-300 dark:border-slate-700 bg-white dark:bg-slate-950 hover:bg-zinc-50 dark:hover:bg-slate-800 text-zinc-900 dark:text-white text-sm font-medium flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>الدخول بحساب Google المعتمد</span>}
            </button>

            {showRedirectFallback && isTopLevelWindow && (
              <button
                type="button"
                onClick={handleGoogleRedirect}
                disabled={busy}
                className="w-full h-10 rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50/70 dark:bg-teal-950/40 hover:bg-teal-100/70 dark:hover:bg-teal-900/40 text-teal-800 dark:text-teal-200 text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <span>الدخول بحساب Google عبر إعادة التوجيه (مناسب للموبايل)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
