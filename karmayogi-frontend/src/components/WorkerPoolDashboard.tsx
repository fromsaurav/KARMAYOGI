'use client';

import React, { useState } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Activity, Clock, CheckCircle, XCircle, TrendingUp, AlertTriangle } from 'lucide-react';

interface Worker {
  id: string;
  name: string;
  status: 'idle' | 'busy' | 'paused' | 'failed';
  currentJob?: string;
  jobsProcessed: number;
  jobsFailed: number;
  avgProcessingTime: number;
  lastActive: Date;
  startedAt: Date;
}

interface QueueDepth {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  total: number;
}

interface WorkerStats {
  workers: Worker[];
  queueDepth: QueueDepth;
  totalProcessed: number;
  totalFailed: number;
  activeWorkers: number;
  idleWorkers: number;
  totalWorkers: number;
  timestamp: string;
}

export const WorkerPoolDashboard = () => {
  const [stats, setStats] = useState<WorkerStats | null>(null);

  const { isConnected } = useWebSocket({
    onWorkerStats: (data: WorkerStats) => {
      setStats(data);
    }
  });

  if (!stats) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-yellow-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-400">Loading worker pool data...</p>
        </div>
      </div>
    );
  }

  const successRate = stats.totalProcessed > 0
    ? (((stats.totalProcessed - stats.totalFailed) / stats.totalProcessed) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Worker Pool Dashboard</h2>
          <p className="text-slate-400">Real-time distributed processing engine status</p>
        </div>
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
          isConnected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
        }`}>
          <div className={`w-2 h-2 rounded-full ${
            isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
          }`} />
          <span className="text-sm font-medium">
            {isConnected ? 'Live Updates' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Overview Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Workers"
          value={stats.totalWorkers}
          subtitle={`${stats.activeWorkers} active · ${stats.idleWorkers} idle`}
          icon={Activity}
          color="blue"
        />
        <StatCard
          title="Queue Depth"
          value={stats.queueDepth.total}
          subtitle={`${stats.queueDepth.waiting} waiting · ${stats.queueDepth.active} processing`}
          icon={Clock}
          color="yellow"
        />
        <StatCard
          title="Jobs Processed"
          value={stats.totalProcessed}
          subtitle={`${successRate}% success rate`}
          icon={CheckCircle}
          color="green"
        />
        <StatCard
          title="Failed Jobs"
          value={stats.totalFailed}
          subtitle={stats.totalFailed > 0 ? 'Requires attention' : 'All systems normal'}
          icon={stats.totalFailed > 0 ? AlertTriangle : CheckCircle}
          color={stats.totalFailed > 0 ? 'red' : 'green'}
        />
      </div>

      {/* Queue Status Visualization */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-yellow-500" />
          Queue Status
        </h3>
        <div className="space-y-3">
          <QueueBar
            label="Waiting"
            count={stats.queueDepth.waiting}
            total={stats.queueDepth.total || 1}
            color="yellow"
          />
          <QueueBar
            label="Processing"
            count={stats.queueDepth.active}
            total={stats.queueDepth.total || 1}
            color="blue"
          />
          <QueueBar
            label="Failed"
            count={stats.queueDepth.failed}
            total={stats.queueDepth.total || 1}
            color="red"
          />
          <QueueBar
            label="Delayed"
            count={stats.queueDepth.delayed}
            total={stats.queueDepth.total || 1}
            color="purple"
          />
        </div>
      </div>

      {/* Worker Grid */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">Active Workers</h3>
        {stats.workers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stats.workers.map(worker => (
              <WorkerCard key={worker.id} worker={worker} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Activity className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">No workers currently active</p>
            <p className="text-slate-500 text-sm mt-2">Workers will appear here when they start processing jobs</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Stat Card Component
interface StatCardProps {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ElementType;
  color: 'blue' | 'yellow' | 'green' | 'red';
}

const StatCard: React.FC<StatCardProps> = ({ title, value, subtitle, icon: Icon, color }) => {
  const colorClasses = {
    blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    green: 'bg-green-500/20 text-green-400 border-green-500/30',
    red: 'bg-red-500/20 text-red-400 border-red-500/30'
  };

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-slate-400 text-sm font-medium mb-1">{title}</p>
          <p className="text-3xl font-bold text-slate-100">{value.toLocaleString()}</p>
        </div>
        <div className={`p-3 rounded-lg border ${colorClasses[color]}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
      <p className="text-slate-400 text-sm">{subtitle}</p>
    </div>
  );
};

// Worker Card Component
const WorkerCard: React.FC<{ worker: Worker }> = ({ worker }) => {
  const statusColors = {
    idle: 'bg-green-500/20 text-green-400 border-green-500/30',
    busy: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    paused: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    failed: 'bg-red-500/20 text-red-400 border-red-500/30'
  };

  const statusDots = {
    idle: 'bg-green-500',
    busy: 'bg-blue-500 animate-pulse',
    paused: 'bg-yellow-500',
    failed: 'bg-red-500'
  };

  const successRate = worker.jobsProcessed > 0
    ? (((worker.jobsProcessed - worker.jobsFailed) / worker.jobsProcessed) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600 hover:border-slate-500 transition-colors">
      {/* Worker Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${statusDots[worker.status]}`} />
          <span className="font-medium text-slate-100">{worker.name}</span>
        </div>
        <span className={`text-xs px-2 py-1 rounded border ${statusColors[worker.status]}`}>
          {worker.status.toUpperCase()}
        </span>
      </div>

      {/* Current Job */}
      {worker.currentJob && (
        <div className="mb-3 p-2 bg-slate-800 rounded text-xs">
          <div className="text-slate-400 mb-1">Processing:</div>
          <div className="text-slate-300 font-mono truncate" title={worker.currentJob}>
            #{worker.currentJob.slice(0, 12)}...
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between text-slate-300">
          <span>Processed:</span>
          <span className="font-medium">{worker.jobsProcessed}</span>
        </div>
        <div className="flex justify-between text-slate-300">
          <span>Success Rate:</span>
          <span className={`font-medium ${
            parseFloat(successRate) >= 90 ? 'text-green-400' :
            parseFloat(successRate) >= 70 ? 'text-yellow-400' :
            'text-red-400'
          }`}>
            {successRate}%
          </span>
        </div>
        <div className="flex justify-between text-slate-300">
          <span>Avg Time:</span>
          <span className="font-medium">{(worker.avgProcessingTime / 1000).toFixed(2)}s</span>
        </div>
      </div>

      {/* Uptime */}
      <div className="mt-3 pt-3 border-t border-slate-600 text-xs text-slate-400">
        Uptime: {getUptime(worker.startedAt)}
      </div>
    </div>
  );
};

// Queue Bar Component
interface QueueBarProps {
  label: string;
  count: number;
  total: number;
  color: 'yellow' | 'blue' | 'red' | 'green' | 'purple';
}

const QueueBar: React.FC<QueueBarProps> = ({ label, count, total, color }) => {
  const percentage = total > 0 ? (count / total) * 100 : 0;

  const colors = {
    yellow: 'bg-yellow-500',
    blue: 'bg-blue-500',
    red: 'bg-red-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500'
  };

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-slate-300">{label}</span>
        <span className="text-slate-400">{count} jobs ({percentage.toFixed(1)}%)</span>
      </div>
      <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
        <div
          className={`h-3 rounded-full transition-all duration-300 ${colors[color]}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
};

// Utility function to calculate uptime
const getUptime = (startedAt: Date): string => {
  const diff = Date.now() - new Date(startedAt).getTime();
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};
