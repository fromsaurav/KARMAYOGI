'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  Activity,
  Server,
  Shield,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Settings
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { SystemMetrics } from '@/types';
import { apiClient } from '@/lib/api';
import { mockSystemMetrics } from '@/lib/mockData';
import { useAuthStore } from '@/stores/authStore';
import { WorkerPoolDashboard } from '@/components/WorkerPoolDashboard';

interface AdminStats {
  totalUsers: number;
  totalManagers: number;
  systemUptime: string;
  criticalAlerts: number;
}

interface SystemAlert {
  id: string;
  type: 'warning' | 'error' | 'info';
  message: string;
  timestamp: string;
}

export function AdminDashboard() {
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [systemAlerts, setSystemAlerts] = useState<SystemAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuthStore();

  useEffect(() => {
    const fetchAdminData = async () => {
      try {
        const [metricsData] = await Promise.all([
          apiClient.getMetrics()
        ]);

        setSystemMetrics(metricsData);

        // Mock admin data (in a real app, this would come from admin APIs)
        const mockAdminStats: AdminStats = {
          totalUsers: 156,
          totalManagers: 12,
          systemUptime: '99.9%',
          criticalAlerts: 2
        };

        const mockAlerts: SystemAlert[] = [
          {
            id: '1',
            type: 'warning',
            message: 'High memory usage detected on worker node #3',
            timestamp: '2 minutes ago'
          },
          {
            id: '2',
            type: 'error',
            message: 'Database connection timeout in analytics service',
            timestamp: '15 minutes ago'
          },
          {
            id: '3',
            type: 'info',
            message: 'Scheduled maintenance completed successfully',
            timestamp: '1 hour ago'
          }
        ];

        setAdminStats(mockAdminStats);
        setSystemAlerts(mockAlerts);
      } catch (error) {
        console.error('Failed to fetch admin dashboard data:', error);

        // Fallback to mock data
        setSystemMetrics(mockSystemMetrics);
        setAdminStats({
          totalUsers: 50,
          totalManagers: 5,
          systemUptime: '99.5%',
          criticalAlerts: 1
        });
        setSystemAlerts([
          {
            id: '1',
            type: 'warning',
            message: 'Demo mode - limited functionality',
            timestamp: 'now'
          }
        ]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAdminData();

    // Refresh data every 30 seconds
    const interval = setInterval(fetchAdminData, 30000);
    return () => clearInterval(interval);
  }, [user]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-yellow-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-300">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">System Administration</h1>
          <p className="text-slate-400">Complete system overview and management</p>
        </div>
        <div className="flex space-x-2">
          <Link href="/health">
            <Button variant="outline">
              <Activity className="mr-2 h-4 w-4" />
              System Health
            </Button>
          </Link>
          <Link href="/admin/users">
            <Button>
              <Settings className="mr-2 h-4 w-4" />
              Manage Users
            </Button>
          </Link>
        </div>
      </div>

      {/* System Overview Statistics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Users"
          value={adminStats?.totalUsers || 0}
          subtitle="Registered users"
          icon={Users}
          color="blue"
        />
        <StatCard
          title="Managers"
          value={adminStats?.totalManagers || 0}
          subtitle="Team managers"
          icon={Shield}
          color="green"
        />
        <StatCard
          title="System Uptime"
          value={adminStats?.systemUptime || '0%'}
          subtitle="Past 30 days"
          icon={Server}
          color="green"
        />
        <StatCard
          title="Critical Alerts"
          value={adminStats?.criticalAlerts || 0}
          subtitle="Require attention"
          icon={AlertTriangle}
          color="red"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* System Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="h-5 w-5" />
              <span>System Performance</span>
            </CardTitle>
            <CardDescription>
              Real-time system metrics and performance
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-300">Active Jobs</span>
              <span className="text-2xl font-bold text-blue-400">
                {systemMetrics?.activeJobs || 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-300">Completed Jobs</span>
              <span className="text-2xl font-bold text-green-400">
                {systemMetrics?.completedJobs || 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-300">Failed Jobs</span>
              <span className="text-2xl font-bold text-red-400">
                {systemMetrics?.failedJobs || 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-300">Queue Length</span>
              <span className="text-2xl font-bold text-yellow-400">
                {systemMetrics?.queuedJobs || 0}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Worker Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Server className="h-5 w-5" />
              <span>Worker Status</span>
            </CardTitle>
            <CardDescription>
              Current worker health and utilization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-300">Total Workers</span>
              <span className="text-2xl font-bold text-slate-100">
                {systemMetrics?.workers?.total || 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-300">Active Workers</span>
              <span className="text-2xl font-bold text-blue-400">
                {systemMetrics?.workers?.active || 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-300">Idle Workers</span>
              <span className="text-2xl font-bold text-green-400">
                {systemMetrics?.workers?.idle || 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-300">Error Rate</span>
              <span className="text-2xl font-bold text-red-400">
                {systemMetrics?.performance?.errorRate || 0}%
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Alerts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5" />
              <span>System Alerts</span>
            </CardTitle>
            <CardDescription>
              Recent system alerts and notifications
            </CardDescription>
          </div>
          <Link href="/health">
            <Button variant="outline">View All</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {systemAlerts.length > 0 ? (
            <div className="space-y-3">
              {systemAlerts.map((alert) => (
                <AlertCard key={alert.id} alert={alert} />
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-slate-400">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
              <p>No system alerts</p>
              <p className="text-sm">All systems operating normally</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Worker Pool Dashboard */}
      <WorkerPoolDashboard />

      {/* Quick Admin Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common administrative tasks and shortcuts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <Link href="/admin/users">
              <Button variant="outline" className="w-full justify-start">
                <Users className="mr-2 h-4 w-4" />
                User Management
              </Button>
            </Link>
            <Link href="/health">
              <Button variant="outline" className="w-full justify-start">
                <Activity className="mr-2 h-4 w-4" />
                System Health
              </Button>
            </Link>
            <Link href="/analytics">
              <Button variant="outline" className="w-full justify-start">
                <TrendingUp className="mr-2 h-4 w-4" />
                Analytics
              </Button>
            </Link>
            <Link href="/settings">
              <Button variant="outline" className="w-full justify-start">
                <Settings className="mr-2 h-4 w-4" />
                System Settings
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AlertCard({ alert }: { alert: SystemAlert }) {
  const alertColors = {
    error: 'border-red-500/30 bg-red-500/10',
    warning: 'border-yellow-500/30 bg-yellow-500/10',
    info: 'border-blue-500/30 bg-blue-500/10',
  };

  const alertIcons: Record<string, React.ElementType> = {
    error: XCircle,
    warning: AlertTriangle,
    info: CheckCircle,
  };

  const alertIconColors = {
    error: 'text-red-400',
    warning: 'text-yellow-400',
    info: 'text-blue-400',
  };

  const AlertIcon = alertIcons[alert.type] || AlertTriangle;

  return (
    <div className={`flex items-start space-x-3 p-4 border rounded-lg ${alertColors[alert.type] || 'border-slate-500/30 bg-slate-500/10'}`}>
      {AlertIcon && <AlertIcon className={`h-5 w-5 mt-0.5 ${alertIconColors[alert.type] || 'text-slate-400'}`} />}
      <div className="flex-1">
        <p className="text-slate-100 font-medium">{alert.message}</p>
        <p className="text-sm text-slate-400">{alert.timestamp}</p>
      </div>
    </div>
  );
}