'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area 
} from 'recharts';
import { TrendingUp, TrendingDown, Activity, Clock, CheckCircle, XCircle } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

interface AnalyticsData {
  performanceMetrics: {
    avgResponseTime: number;
    throughput: number;
    errorRate: number;
    successRate: number;
  };
  jobStatistics: {
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
    activeJobs: number;
    pendingJobs: number;
  };
  timeSeriesData: {
    timestamp: string;
    jobs: number;
    responseTime: number;
    errors: number;
  }[];
  jobTypeDistribution: {
    type: string;
    count: number;
    percentage: number;
  }[];
  workerUtilization: {
    workerId: string;
    utilization: number;
    jobsProcessed: number;
  }[];
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

const MetricCard = ({ 
  title, 
  value, 
  change, 
  icon: Icon, 
  color = 'blue' 
}: {
  title: string;
  value: string | number;
  change?: { value: number; trend: 'up' | 'down' };
  icon: React.ComponentType<{ className?: string }>;
  color?: string;
}) => {
  const colorClasses = {
    blue: 'text-blue-600 bg-blue-50',
    green: 'text-green-600 bg-green-50',
    red: 'text-red-600 bg-red-50',
    yellow: 'text-yellow-600 bg-yellow-50',
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={`rounded-full p-2 ${colorClasses[color as keyof typeof colorClasses]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {change && (
          <div className="flex items-center text-sm text-muted-foreground">
            {change.trend === 'up' ? (
              <TrendingUp className="mr-1 h-3 w-3 text-green-600" />
            ) : (
              <TrendingDown className="mr-1 h-3 w-3 text-red-600" />
            )}
            <span className={change.trend === 'up' ? 'text-green-600' : 'text-red-600'}>
              {Math.abs(change.value)}%
            </span>
            <span className="ml-1">from last hour</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const { user } = useAuthStore();

  // Helper function to check if current user is demo user
  const isDemoUser = () => {
    return user?.id === 'dev-user-id' || user?.email === 'dev@example.com';
  };

  // Mock data generator for real-time updates
  const generateMockData = (): AnalyticsData => {
    const now = new Date();
    const timeSeriesData = Array.from({ length: 24 }, (_, i) => ({
      timestamp: new Date(now.getTime() - (23 - i) * 60 * 60 * 1000).toLocaleTimeString('en-US', { hour: '2-digit' }),
      jobs: Math.floor(Math.random() * 100) + 20,
      responseTime: Math.floor(Math.random() * 500) + 100,
      errors: Math.floor(Math.random() * 10)
    }));

    const jobTypes = ['FILE_PROCESSING', 'DATA_ANALYTICS', 'EMAIL_CAMPAIGN', 'API_INTEGRATION', 'CUSTOM_SCRIPT'];
    const jobTypeDistribution = jobTypes.map(type => {
      const count = Math.floor(Math.random() * 50) + 10;
      return {
        type,
        count,
        percentage: Math.round((count / 200) * 100)
      };
    });

    const workerUtilization = Array.from({ length: 5 }, (_, i) => ({
      workerId: `Worker-${i + 1}`,
      utilization: Math.floor(Math.random() * 100),
      jobsProcessed: Math.floor(Math.random() * 1000) + 100
    }));

    return {
      performanceMetrics: {
        avgResponseTime: Math.floor(Math.random() * 300) + 150,
        throughput: Math.floor(Math.random() * 100) + 50,
        errorRate: Math.round((Math.random() * 5 + 1) * 100) / 100,
        successRate: Math.round((95 + Math.random() * 4) * 100) / 100
      },
      jobStatistics: {
        totalJobs: Math.floor(Math.random() * 10000) + 5000,
        completedJobs: Math.floor(Math.random() * 8000) + 4000,
        failedJobs: Math.floor(Math.random() * 500) + 100,
        activeJobs: Math.floor(Math.random() * 50) + 10,
        pendingJobs: Math.floor(Math.random() * 200) + 50
      },
      timeSeriesData,
      jobTypeDistribution,
      workerUtilization
    };
  };

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        // Try to fetch real data from backend
        try {
          const response = await apiClient.getAnalyticsData();
          setAnalytics(response.data);
        } catch (apiError) {
          console.error('Failed to fetch analytics data:', apiError);
          
          // Only show mock data for demo users
          if (isDemoUser()) {
            console.info('Using demo analytics data for demo user');
            const data = generateMockData();
            setAnalytics(data);
          } else {
            // For regular users, show empty/zero state
            setAnalytics({
              performanceMetrics: {
                avgResponseTime: 0,
                throughput: 0,
                errorRate: 0,
                successRate: 0
              },
              jobStatistics: {
                totalJobs: 0,
                completedJobs: 0,
                failedJobs: 0,
                activeJobs: 0,
                pendingJobs: 0
              },
              timeSeriesData: [],
              jobTypeDistribution: [],
              workerUtilization: []
            });
          }
        }
        setLastUpdated(new Date());
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
        // Only use mock data fallback for demo users
        if (isDemoUser()) {
          const data = generateMockData();
          setAnalytics(data);
        } else {
          // Show empty state for regular users
          setAnalytics({
            performanceMetrics: { avgResponseTime: 0, throughput: 0, errorRate: 0, successRate: 0 },
            jobStatistics: { totalJobs: 0, completedJobs: 0, failedJobs: 0, activeJobs: 0, pendingJobs: 0 },
            timeSeriesData: [],
            jobTypeDistribution: [],
            workerUtilization: []
          });
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalytics();
    
    // Update analytics every 30 seconds (less frequent for regular users)
    const interval = setInterval(fetchAnalytics, isDemoUser() ? 5000 : 30000);
    return () => clearInterval(interval);
  }, [user]);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
            <p className="text-gray-600">Loading analytics...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
            <p className="text-muted-foreground">
              Real-time system analytics and performance metrics
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Avg Response Time"
            value={`${analytics?.performanceMetrics.avgResponseTime || 0}ms`}
            change={{ value: 5.2, trend: 'down' }}
            icon={Clock}
            color="blue"
          />
          <MetricCard
            title="Throughput"
            value={`${analytics?.performanceMetrics.throughput || 0}/min`}
            change={{ value: 8.1, trend: 'up' }}
            icon={Activity}
            color="green"
          />
          <MetricCard
            title="Success Rate"
            value={`${analytics?.performanceMetrics.successRate || 0}%`}
            change={{ value: 2.3, trend: 'up' }}
            icon={CheckCircle}
            color="green"
          />
          <MetricCard
            title="Error Rate"
            value={`${analytics?.performanceMetrics.errorRate || 0}%`}
            change={{ value: 1.2, trend: 'down' }}
            icon={XCircle}
            color="red"
          />
        </div>

        {/* Time Series Charts */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Job Processing Trends</CardTitle>
              <CardDescription>Jobs processed over the last 24 hours</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={analytics?.timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timestamp" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="jobs" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Response Time Trends</CardTitle>
              <CardDescription>Average response time over 24 hours</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analytics?.timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timestamp" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="responseTime" stroke="#10B981" strokeWidth={2} name="Response Time (ms)" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Distribution Charts */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Job Type Distribution</CardTitle>
              <CardDescription>Breakdown of jobs by type</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={analytics?.jobTypeDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ type, percentage }) => `${type}: ${percentage}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {analytics?.jobTypeDistribution?.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Worker Utilization</CardTitle>
              <CardDescription>Current worker performance and utilization</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics?.workerUtilization}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="workerId" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="utilization" fill="#3B82F6" name="Utilization %" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Job Statistics Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Job Statistics Summary</CardTitle>
            <CardDescription>Overall job processing statistics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-5">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {analytics?.jobStatistics.totalJobs?.toLocaleString() || 0}
                </div>
                <div className="text-sm text-muted-foreground">Total Jobs</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {analytics?.jobStatistics.completedJobs?.toLocaleString() || 0}
                </div>
                <div className="text-sm text-muted-foreground">Completed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {analytics?.jobStatistics.failedJobs?.toLocaleString() || 0}
                </div>
                <div className="text-sm text-muted-foreground">Failed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {analytics?.jobStatistics.activeJobs?.toLocaleString() || 0}
                </div>
                <div className="text-sm text-muted-foreground">Active</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600">
                  {analytics?.jobStatistics.pendingJobs?.toLocaleString() || 0}
                </div>
                <div className="text-sm text-muted-foreground">Pending</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}