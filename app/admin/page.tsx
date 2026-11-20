'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import AdminLogin from '@/components/admin/AdminLogin';
import AdminDashboard from '@/components/admin/AdminDashboard';

export default function AdminPage() {
  const { loading, user, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="flex items-center gap-2.5 text-sm text-zinc-600">
          <Loader2 className="w-5 h-5 animate-spin text-teal-700" />
          <span>جارٍ التحقق من الصلاحيات...</span>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return <AdminLogin />;
  }

  return <AdminDashboard />;
}
