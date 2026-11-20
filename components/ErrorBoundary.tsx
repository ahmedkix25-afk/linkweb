'use client';

import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let friendly = 'حدث خطأ غير متوقع أثناء تحميل البيانات.';
    try {
      const parsed = JSON.parse(error.message);
      if (parsed?.error?.includes('Quota exceeded')) {
        friendly = 'تم تجاوز الحد اليومي المجاني لقاعدة البيانات، يرجى المحاولة لاحقاً.';
      } else if (parsed?.error?.includes('Missing or insufficient permissions')) {
        friendly = 'لا تملك صلاحية الوصول إلى هذه البيانات.';
      }
    } catch {
      if (error?.message) {
        friendly = error.message;
      }
    }
    return { hasError: true, message: friendly };
  }

  componentDidCatch(error: Error) {
    console.error('ErrorBoundary caught error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4 py-12">
          <div className="w-full max-w-md bg-white border border-zinc-200 rounded-xl p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-700 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h1 className="text-lg font-semibold text-zinc-900 mb-2">تعذر إكمال العملية</h1>
            <p className="text-sm text-zinc-600 mb-6 leading-relaxed">{this.state.message}</p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, message: '' });
                window.location.reload();
              }}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              إعادة المحاولة
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
