'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UserRole } from '@/types';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuthStore } from '@/stores/authStore';

export default function DashboardPage() {
  const { user, isLoading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    console.log('📊 [Dashboard] User loaded:', user);
    console.log('📊 [Dashboard] User role:', user?.role);

    // Redirect to role-specific dashboard
    if (!isLoading && user) {
      switch (user.role) {
        case UserRole.ADMIN:
          router.push('/dashboard/admin');
          break;
        case UserRole.MANAGER:
          router.push('/dashboard/manager');
          break;
        case UserRole.USER:
        default:
          router.push('/dashboard/user');
          break;
      }
    }
  }, [user, isLoading, router]);

  // Show loading state while redirecting
  return (
    <DashboardLayout>
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-yellow-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-300">Redirecting to your dashboard...</p>
        </div>
      </div>
    </DashboardLayout>
  );
}