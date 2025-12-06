'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import {
  Sliders,
  PlayCircle,
  PauseCircle,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  Settings,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface WorkerPoolSettings {
  minWorkers: number;
  maxWorkers: number;
  currentWorkers: number;
  autoScaling: boolean;
  scalingThreshold: number; // Queue depth threshold for auto-scaling
}

interface SystemAlert {
  id: string;
  level: 'INFO' | 'WARNING' | 'CRITICAL';
  type: string;
  message: string;
  action?: string;
  resolved: boolean;
  createdAt: string;
}

export const AdminControls = () => {
  const [settings, setSettings] = useState<WorkerPoolSettings>({
    minWorkers: 1,
    maxWorkers: 10,
    currentWorkers: 3,
    autoScaling: true,
    scalingThreshold: 50
  });

  const [pendingSettings, setPendingSettings] = useState<WorkerPoolSettings>(settings);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>('');

  useEffect(() => {
    fetchSettings();
    fetchAlerts();

    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetchSettings();
      fetchAlerts();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const fetchSettings = async () => {
    try {
      // Mock data for now - replace with actual API call
      const mockSettings: WorkerPoolSettings = {
        minWorkers: 1,
        maxWorkers: 10,
        currentWorkers: 3,
        autoScaling: true,
        scalingThreshold: 50
      };

      setSettings(mockSettings);
      setPendingSettings(mockSettings);
      setLastUpdate(new Date().toISOString());
    } catch (error) {
      console.error('Failed to fetch worker settings:', error);
    }
  };

  const fetchAlerts = async () => {
    try {
      // Mock alerts for now
      const mockAlerts: SystemAlert[] = [
        {
          id: '1',
          level: 'WARNING',
          type: 'QUEUE_DEPTH',
          message: 'Queue depth exceeding threshold (65 jobs)',
          action: 'Consider scaling up workers',
          resolved: false,
          createdAt: new Date().toISOString()
        }
      ];

      setAlerts(mockAlerts);
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    }
  };

  const handleUpdateSettings = async () => {
    try {
      setIsUpdating(true);

      // Validation
      if (pendingSettings.minWorkers > pendingSettings.maxWorkers) {
        alert('Minimum workers cannot exceed maximum workers');
        return;
      }

      if (pendingSettings.minWorkers < 1 || pendingSettings.maxWorkers > 20) {
        alert('Workers must be between 1 and 20');
        return;
      }

      // Mock API call - replace with actual API endpoint
      await new Promise(resolve => setTimeout(resolve, 1000));

      setSettings(pendingSettings);
      alert('Worker pool settings updated successfully');
    } catch (error) {
      console.error('Failed to update settings:', error);
      alert('Failed to update settings');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleScaleWorkers = async (action: 'up' | 'down') => {
    try {
      setIsUpdating(true);

      const newWorkerCount = action === 'up'
        ? Math.min(settings.currentWorkers + 1, settings.maxWorkers)
        : Math.max(settings.currentWorkers - 1, settings.minWorkers);

      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      setSettings(prev => ({ ...prev, currentWorkers: newWorkerCount }));
      setPendingSettings(prev => ({ ...prev, currentWorkers: newWorkerCount }));
    } catch (error) {
      console.error('Failed to scale workers:', error);
      alert('Failed to scale workers');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRetryFailedJobs = async () => {
    try {
      setIsUpdating(true);
      const response = await apiClient.request('/api/admin/jobs/retry-failed', {
        method: 'POST'
      });
      alert(`Retried ${response.data?.count || 0} failed jobs`);
    } catch (error) {
      console.error('Failed to retry jobs:', error);
      alert('Failed to retry failed jobs');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleResolveAlert = async (alertId: string) => {
    try {
      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 500));
      setAlerts(prev => prev.map(a =>
        a.id === alertId ? { ...a, resolved: true } : a
      ));
    } catch (error) {
      console.error('Failed to resolve alert:', error);
    }
  };

  const alertLevelColors = {
    INFO: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
    WARNING: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400',
    CRITICAL: 'border-red-500/30 bg-red-500/10 text-red-400'
  };

  const alertIcons = {
    INFO: CheckCircle,
    WARNING: AlertCircle,
    CRITICAL: AlertCircle
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <Settings className="h-7 w-7 text-yellow-500" />
          System Administration
        </h2>
        <p className="text-slate-400 mt-1">Configure worker pool and monitor system alerts</p>
      </div>

      {/* Worker Pool Controls */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sliders className="h-5 w-5 text-yellow-500" />
            Worker Pool Configuration
          </CardTitle>
          <CardDescription>
            Manage worker scaling and resource allocation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
              <div className="text-slate-400 text-sm mb-1">Active Workers</div>
              <div className="text-3xl font-bold text-slate-100">{settings.currentWorkers}</div>
              <div className="text-xs text-slate-500 mt-1">
                Range: {settings.minWorkers} - {settings.maxWorkers}
              </div>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
              <div className="text-slate-400 text-sm mb-1">Auto-Scaling</div>
              <div className={`text-2xl font-bold ${settings.autoScaling ? 'text-green-400' : 'text-red-400'}`}>
                {settings.autoScaling ? 'Enabled' : 'Disabled'}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Threshold: {settings.scalingThreshold} jobs
              </div>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
              <div className="text-slate-400 text-sm mb-1">Last Updated</div>
              <div className="text-sm font-medium text-slate-100">
                {lastUpdate ? new Date(lastUpdate).toLocaleTimeString() : 'Never'}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchSettings}
                className="mt-2 border-slate-600"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Refresh
              </Button>
            </div>
          </div>

          {/* Manual Scaling Controls */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-100">Manual Scaling</h3>
            <div className="flex gap-2">
              <Button
                onClick={() => handleScaleWorkers('down')}
                disabled={isUpdating || settings.currentWorkers <= settings.minWorkers}
                variant="outline"
                className="border-slate-600 hover:border-red-500 hover:text-red-400"
              >
                <PauseCircle className="mr-2 h-4 w-4" />
                Scale Down
              </Button>
              <Button
                onClick={() => handleScaleWorkers('up')}
                disabled={isUpdating || settings.currentWorkers >= settings.maxWorkers}
                className="bg-green-500 hover:bg-green-600"
              >
                <PlayCircle className="mr-2 h-4 w-4" />
                Scale Up
              </Button>
            </div>
          </div>

          {/* Settings Configuration */}
          <div className="space-y-4 pt-4 border-t border-slate-700">
            <h3 className="text-lg font-semibold text-slate-100">Pool Settings</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Minimum Workers
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={pendingSettings.minWorkers}
                  onChange={(e) => setPendingSettings(prev => ({
                    ...prev,
                    minWorkers: parseInt(e.target.value) || 1
                  }))}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-yellow-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Maximum Workers
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={pendingSettings.maxWorkers}
                  onChange={(e) => setPendingSettings(prev => ({
                    ...prev,
                    maxWorkers: parseInt(e.target.value) || 10
                  }))}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-yellow-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Auto-Scaling Threshold (jobs)
                </label>
                <input
                  type="number"
                  min="10"
                  max="500"
                  value={pendingSettings.scalingThreshold}
                  onChange={(e) => setPendingSettings(prev => ({
                    ...prev,
                    scalingThreshold: parseInt(e.target.value) || 50
                  }))}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-yellow-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Auto-Scaling
                </label>
                <button
                  onClick={() => setPendingSettings(prev => ({
                    ...prev,
                    autoScaling: !prev.autoScaling
                  }))}
                  className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${
                    pendingSettings.autoScaling
                      ? 'bg-green-500 text-slate-900'
                      : 'bg-slate-700 text-slate-400 border border-slate-600'
                  }`}
                >
                  {pendingSettings.autoScaling ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleUpdateSettings}
                disabled={isUpdating}
                className="bg-yellow-500 hover:bg-yellow-600"
              >
                <Zap className="mr-2 h-4 w-4" />
                Apply Settings
              </Button>
              <Button
                onClick={() => setPendingSettings(settings)}
                variant="outline"
                className="border-slate-600"
              >
                Reset
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common administrative operations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button
              onClick={handleRetryFailedJobs}
              disabled={isUpdating}
              variant="outline"
              className="border-slate-600 hover:border-blue-500 hover:text-blue-400"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry Failed Jobs
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* System Alerts */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            System Alerts
          </CardTitle>
          <CardDescription>
            Active system warnings and notifications
          </CardDescription>
        </CardHeader>
        <CardContent>
          {alerts.filter(a => !a.resolved).length > 0 ? (
            <div className="space-y-3">
              {alerts.filter(a => !a.resolved).map((alert) => {
                const AlertIcon = alertIcons[alert.level];
                return (
                  <div
                    key={alert.id}
                    className={`p-4 rounded-lg border ${alertLevelColors[alert.level]}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <AlertIcon className="h-5 w-5 mt-0.5" />
                        <div>
                          <div className="font-medium text-slate-100">{alert.message}</div>
                          {alert.action && (
                            <div className="text-sm text-slate-400 mt-1">
                              Action: {alert.action}
                            </div>
                          )}
                          <div className="text-xs text-slate-500 mt-2">
                            {new Date(alert.createdAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleResolveAlert(alert.id)}
                        className="border-slate-600"
                      >
                        Resolve
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <p className="text-slate-400">No active alerts</p>
              <p className="text-slate-500 text-sm mt-1">All systems operating normally</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
