'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';

interface HydrationProviderProps {
  children: React.ReactNode;
}

export function HydrationProvider({ children }: HydrationProviderProps) {
  const [isHydrated, setIsHydrated] = useState(false);
  const { setHydrated } = useAuthStore();

  useEffect(() => {
    // This ensures the component only renders on the client side
    // after hydration is complete
    setIsHydrated(true);
    setHydrated();
  }, [setHydrated]);

  if (!isHydrated) {
    // Return a loading state or null during hydration
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return <>{children}</>;
}