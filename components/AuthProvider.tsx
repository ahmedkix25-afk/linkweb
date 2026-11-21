'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import {
  User,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  setPersistence,
  browserLocalPersistence,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, BOOTSTRAP_ADMIN_EMAIL, testConnection } from '@/lib/firebase';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  needsEmailVerification: boolean;
  authError: string | null;
  clearAuthError: () => void;
  signInWithGoogle: () => Promise<void>;
  signInWithGoogleRedirect: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function createGoogleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.addScope('email');
  provider.addScope('profile');
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

function formatGoogleAuthError(err: unknown): string {
  const firebaseErr = err as { code?: string; message?: string };
  const code = firebaseErr?.code || '';
  const host = typeof window !== 'undefined' ? window.location.hostname : '';

  if (code === 'auth/unauthorized-domain') {
    return `الدومين الحالي (${host}) غير مضاف في Firebase Authorized Domains. افتح Firebase Console ← Authentication ← Settings ← Authorized domains وأضف: ${host}`;
  }
  if (code === 'auth/popup-blocked') {
    return 'المتصفح منع فتح نافذة تسجيل الدخول المنبثقة (Popup Blocked). اسمح بالنوافذ المنبثقة أو استخدم زر «الدخول بإعادة التوجيه» بالأسفل.';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'تسجيل الدخول عبر Google غير مفعّل في Firebase Console. فعّله من Authentication ← Sign-in method ← Google.';
  }
  if (code === 'auth/network-request-failed') {
    return 'تعذر الاتصال بخوادم Google. تحقق من اتصال الإنترنت وحاول مجدداً.';
  }
  if (code === 'auth/invalid-api-key' || code === 'auth/app-not-authorized') {
    return `إعدادات Firebase OAuth غير مصرح لها على هذا الدومين (${code}).`;
  }
  return `تعذر تسجيل الدخول عبر Google${code ? ` (${code})` : ''}. تأكد من تفعيل Google في Firebase وإضافة الدومين (${host}) في Authorized domains.`;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [needsEmailVerification, setNeedsEmailVerification] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const authRequestSeqRef = useRef(0);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const resolveUserAccess = useCallback(async (currentUser: User | null, forceTokenRefresh = false) => {
    const seq = ++authRequestSeqRef.current;

    if (!currentUser) {
      setUser(null);
      setIsAdmin(false);
      setNeedsEmailVerification(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setUser(currentUser);

    try {
      // Inspect authoritative OIDC JWT claims (matching what Firestore security rules evaluate)
      const tokenResult = await currentUser.getIdTokenResult(forceTokenRefresh);
      if (seq !== authRequestSeqRef.current) return;

      const claimEmail =
        typeof tokenResult.claims.email === 'string' ? tokenResult.claims.email : '';
      const providerEmail =
        currentUser.providerData.find((p) => Boolean(p?.email))?.email || '';
      const resolvedEmail = (claimEmail || currentUser.email || providerEmail)
        .trim()
        .toLowerCase();

      const claimVerified = tokenResult.claims.email_verified === true;
      const isEmailVerified = Boolean(currentUser.emailVerified || claimVerified);

      const isBootstrapEmail = resolvedEmail === BOOTSTRAP_ADMIN_EMAIL.trim().toLowerCase();

      if (!isEmailVerified) {
        setIsAdmin(false);
        setNeedsEmailVerification(isBootstrapEmail);
        setLoading(false);
        return;
      }

      setNeedsEmailVerification(false);

      if (isBootstrapEmail) {
        setIsAdmin(true);
        setAuthError(null);
        setLoading(false);
        return;
      }

      const adminSnap = await getDoc(doc(db, 'admins', currentUser.uid));
      if (seq !== authRequestSeqRef.current) return;

      setIsAdmin(adminSnap.exists());
      setAuthError(null);
    } catch {
      if (seq !== authRequestSeqRef.current) return;
      setIsAdmin(false);
    } finally {
      if (seq === authRequestSeqRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    testConnection();
    auth.languageCode = 'ar';

    let active = true;

    // Ensure local persistence so mobile/popup sessions survive OAuth round-trips
    setPersistence(auth, browserLocalPersistence).catch(() => {
      // Fallback to default persistence in restricted private contexts
    });

    // Process any pending OAuth redirect callback cleanly
    getRedirectResult(auth)
      .then((result) => {
        if (!active) return;
        if (result?.user) {
          void resolveUserAccess(result.user, true);
        }
      })
      .catch((err) => {
        if (!active) return;
        const code = (err as { code?: string })?.code || '';
        if (code && code !== 'auth/no-auth-event') {
          setAuthError(formatGoogleAuthError(err));
        }
      });

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!active) return;
      void resolveUserAccess(currentUser, false);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [resolveUserAccess]);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      await setPersistence(auth, browserLocalPersistence);
    } catch {
      // Ignore persistence fallback in sandboxed frames
    }
    const provider = createGoogleProvider();
    const cred = await signInWithPopup(auth, provider);
    if (cred.user) {
      // Explicitly trigger post-sign-in callback resolution with fresh OIDC claims
      await resolveUserAccess(cred.user, true);
    }
  }, [resolveUserAccess]);

  const signInWithGoogleRedirect = useCallback(async () => {
    setAuthError(null);
    try {
      await setPersistence(auth, browserLocalPersistence);
    } catch {
      // Ignore persistence fallback
    }
    const provider = createGoogleProvider();
    await signInWithRedirect(auth, provider);
  }, []);

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      setAuthError(null);
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      if (cred.user) {
        await resolveUserAccess(cred.user, true);
      }
    },
    [resolveUserAccess]
  );

  const registerWithEmail = useCallback(async (email: string, password: string) => {
    setAuthError(null);
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    if (cred.user && !cred.user.emailVerified) {
      await sendEmailVerification(cred.user);
    }
  }, []);

  const resendVerificationEmail = useCallback(async () => {
    if (auth.currentUser && !auth.currentUser.emailVerified) {
      await sendEmailVerification(auth.currentUser);
    }
  }, []);

  const refreshAuth = useCallback(async () => {
    if (!auth.currentUser) return;
    await auth.currentUser.reload();
    await resolveUserAccess(auth.currentUser, true);
  }, [resolveUserAccess]);

  const signOutUser = useCallback(async () => {
    setAuthError(null);
    await signOut(auth);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
