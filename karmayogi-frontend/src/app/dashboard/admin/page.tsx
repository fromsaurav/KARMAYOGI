'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { AdminDashboard } from '@/components/dashboard/AdminDashboard';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types';

export default function AdminDashboardPage() {
  const { user, isLoading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      // Redirect if user doesn't have ADMIN role
      if (user.role !== UserRole.ADMIN) {
        if (user.role === UserRole.USER) {
          router.push('/dashboard/user');
        } else if (user.role === UserRole.MANAGER) {
          router.push('/dashboard/manager');
        }
      }
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-yellow-500 border-t-transparent mx-auto mb-4"></div>
            <p className="text-slate-300">Loading dashboard...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Only show dashboard if user has correct role
  if (user.role !== UserRole.ADMIN) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <p className="text-red-400">Access Denied: You don&apos;t have permission to view this page</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <AdminDashboard />
    </DashboardLayout>
  );
}
