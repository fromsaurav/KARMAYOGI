'use client';

import { useWebSocket } from '@/hooks/useWebSocket';
import { Eye, User } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Viewer {
  userId: string;
  userName: string;
  role: string;
  status: 'online' | 'away' | 'offline';
}

interface JobViewersProps {
  jobId: string;
  variant?: 'compact' | 'detailed';
}

export function JobViewers({ jobId, variant = 'compact' }: JobViewersProps) {
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const { isConnected, subscribeToJob, unsubscribeFromJob } = useWebSocket({
    onJobViewers: (data) => {
      if (data.jobId === jobId) {
        setViewers(data.viewers || []);
      }
    }
  });

  useEffect(() => {
    if (isConnected && jobId) {
      subscribeToJob(jobId);

      return () => {
        unsubscribeFromJob(jobId);
      };
    }
  }, [isConnected, jobId, subscribeToJob, unsubscribeFromJob]);

  if (!isConnected || viewers.length === 0) {
    return null;
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'MANAGER':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-500';
      case 'away':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-400';
    }
  };

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-2">
        <Eye className="w-4 h-4 text-gray-500" />
        <div className="flex -space-x-2">
          {viewers.slice(0, 3).map((viewer) => (
            <div
              key={viewer.userId}
              className="relative w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 border-2 border-white dark:border-gray-900 flex items-center justify-center"
              title={`${viewer.userName} (${viewer.role})`}
            >
              <User className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              <div
                className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-gray-900 ${getStatusColor(
                  viewer.status
                )}`}
              />
            </div>
          ))}
          {viewers.length > 3 && (
            <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 border-2 border-white dark:border-gray-900 flex items-center justify-center text-xs font-medium text-gray-700 dark:text-gray-300">
              +{viewers.length - 3}
            </div>
          )}
        </div>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {viewers.length} {viewers.length === 1 ? 'viewer' : 'viewers'}
        </span>
      </div>
    );
  }

  // Detailed variant
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Eye className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Currently Viewing ({viewers.length})
        </h3>
      </div>

      <div className="space-y-2">
        {viewers.map((viewer) => (
          <div
            key={viewer.userId}
            className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                  <User className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </div>
                <div
                  className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 ${getStatusColor(
                    viewer.status
                  )}`}
                />
              </div>

              <div>
                <div className="font-medium text-gray-900 dark:text-gray-100">
                  {viewer.userName}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${getRoleBadgeColor(
                      viewer.role
                    )}`}
                  >
                    {viewer.role}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-500 capitalize">
                    {viewer.status}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {viewers.length === 0 && (
        <div className="text-center py-4 text-gray-500 dark:text-gray-500 text-sm">
          No one is viewing this job
        </div>
      )}
    </div>
  );
}
