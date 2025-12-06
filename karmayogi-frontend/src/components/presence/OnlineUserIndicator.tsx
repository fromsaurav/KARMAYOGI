'use client';

import { useWebSocket } from '@/hooks/useWebSocket';
import { Users, Circle } from 'lucide-react';
import { useEffect, useState } from 'react';

interface OnlineUserIndicatorProps {
  variant?: 'compact' | 'detailed';
  showByRole?: boolean;
}

export function OnlineUserIndicator({
  variant = 'compact',
  showByRole = false
}: OnlineUserIndicatorProps) {
  const { isConnected, onlineUsersCount, onlineCount } = useWebSocket();
  const [pulse, setPulse] = useState(false);

  // Pulse animation when count changes
  useEffect(() => {
    if (onlineUsersCount > 0) {
      setPulse(true);
      const timer = setTimeout(() => setPulse(false), 500);
      return () => clearTimeout(timer);
    }
  }, [onlineUsersCount]);

  if (!isConnected) {
    return (
      <div className="flex items-center gap-2 text-gray-400 text-sm">
        <Circle className="w-2 h-2 fill-gray-400" />
        <span>Offline</span>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-2">
        <div className="relative">
          <Users className="w-5 h-5 text-green-500" />
          <Circle
            className={`absolute -top-1 -right-1 w-2 h-2 fill-green-500 transition-all ${
              pulse ? 'scale-150' : 'scale-100'
            }`}
          />
        </div>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {onlineUsersCount} online
        </span>
      </div>
    );
  }

  // Detailed variant
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="relative">
          <Users className="w-6 h-6 text-green-500" />
          <Circle
            className={`absolute -top-1 -right-1 w-3 h-3 fill-green-500 animate-pulse`}
          />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Online Users
        </h3>
      </div>

      {showByRole && onlineCount ? (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">Total</span>
            <span className="text-lg font-bold text-green-600 dark:text-green-400">
              {onlineCount.total}
            </span>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-2 space-y-1">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600 dark:text-gray-400">Users</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {onlineCount.USER}
              </span>
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600 dark:text-gray-400">Managers</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {onlineCount.MANAGER}
              </span>
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600 dark:text-gray-400">Admins</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {onlineCount.ADMIN}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex justify-between items-center">
          <span className="text-gray-600 dark:text-gray-400">Total Online</span>
          <span className="text-2xl font-bold text-green-600 dark:text-green-400">
            {onlineUsersCount}
          </span>
        </div>
      )}

      <div className="mt-3 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-500">
        <Circle className="w-2 h-2 fill-green-500" />
        <span>Connected to server</span>
      </div>
    </div>
  );
}
