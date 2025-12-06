'use client';

import { useAuthStore } from '@/stores/authStore';
import { useEffect } from 'react';

export function RoleDebug() {
  const { user } = useAuthStore();

  useEffect(() => {
    console.log('🔍 [RoleDebug] Current user:', user);
    console.log('🔍 [RoleDebug] User role:', user?.role);
    console.log('🔍 [RoleDebug] User role type:', typeof user?.role);
  }, [user]);

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white p-4 rounded-lg text-xs font-mono z-50 max-w-sm">
      <div className="font-bold mb-2">🔍 Role Debug</div>
      <div>User: {user?.fullName || 'Not loaded'}</div>
      <div>Email: {user?.email || 'N/A'}</div>
      <div>Role: {user?.role || 'NO ROLE'}</div>
      <div>Role Type: {typeof user?.role}</div>
      <div>Is Authenticated: {useAuthStore.getState().isAuthenticated ? 'Yes' : 'No'}</div>
    </div>
  );
}