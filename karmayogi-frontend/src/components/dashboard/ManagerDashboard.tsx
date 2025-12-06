'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  TrendingUp,
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  BarChart3,
  Shield,
  AlertTriangle
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { SystemMetrics, Job } from '@/types';
import { apiClient } from '@/lib/api';
import { mockJobs, mockSystemMetrics } from '@/lib/mockData';
import { useAuthStore } from '@/stores/authStore';

interface TeamStats {
  totalTeamMembers: number;
  activeTeamJobs: number;
  teamCompletionRate: number;
  pendingReviews: number;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  activeJobs: number;
  completedJobs: number;
  successRate: number;
  lastActivity: string;
}

export function ManagerDashboard() {
  const [teamStats, setTeamStats] = useState<TeamStats | null>(null);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamJobs, setTeamJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuthStore();

  // Helper function to check if current user is demo user
  const isDemoUser = () => {
    return user?.id === 'dev-user-id' || user?.email === 'dev@example.com';
  };

  useEffect(() => {
    const fetchManagerData = async () => {
      try {
        // Use manager-specific dashboard endpoint instead of system metrics
        const jobsData = await apiClient.getJobs(1, 10);

        // Calculate metrics from jobs data
        const metricsData = {
          activeJobs: jobsData.jobs.filter(j => j.status === 'active').length,
          completedJobs: jobsData.jobs.filter(j => j.status === 'completed').length,
          failedJobs: jobsData.jobs.filter(j => j.status === 'failed').length,
          queuedJobs: jobsData.jobs.filter(j => j.status === 'pending').length,
        };

        setSystemMetrics(metricsData as any);

        // Mock team data (in a real app, this would come from a team API)
        const mockTeamStats: TeamStats = {
          totalTeamMembers: 8,
          activeTeamJobs: metricsData.activeJobs,
          teamCompletionRate: 94,
          pendingReviews: 3
        };

        const mockTeamMembers: TeamMember[] = [
          {
            id: '1',
            name: 'John Doe',
            email: 'john@company.com',
            activeJobs: 2,
            completedJobs: 45,
            successRate: 96,
            lastActivity: '2 hours ago'
          },
          {
            id: '2',
            name: 'Sarah Smith',
            email: 'sarah@company.com',
            activeJobs: 1,
            completedJobs: 38,
            successRate: 92,
            lastActivity: '1 hour ago'
          },
          {
            id: '3',
            name: 'Mike Johnson',
            email: 'mike@company.com',
            activeJobs: 3,
            completedJobs: 52,
            successRate: 89,
            lastActivity: '30 minutes ago'
          },
          {
            id: '4',
            name: 'Emily Davis',
            email: 'emily@company.com',
            activeJobs: 0,
            completedJobs: 41,
            successRate: 98,
            lastActivity: '4 hours ago'
          }
        ];

        setTeamStats(mockTeamStats);
        setTeamMembers(mockTeamMembers);
        setTeamJobs(jobsData.jobs.slice(0, 5));
      } catch (error) {
        console.error('Failed to fetch manager dashboard data:', error);

        // Show mock data for demo users or fallback
        const demoMetrics = mockSystemMetrics;
        setSystemMetrics(demoMetrics);

        setTeamStats({
          totalTeamMembers: 4,
          activeTeamJobs: 3,
          teamCompletionRate: 92,
          pendingReviews: 2
        });

        setTeamMembers([
          {
            id: '1',
            name: 'Team Member 1',
            email: 'member1@company.com',
            activeJobs: 1,
            completedJobs: 25,
            successRate: 94,
            lastActivity: '1 hour ago'
          },
          {
            id: '2',
            name: 'Team Member 2',
            email: 'member2@company.com',
            activeJobs: 2,
            completedJobs: 30,
            successRate: 88,
            lastActivity: '3 hours ago'
          }
        ]);

        setTeamJobs(mockJobs.slice(0, 5));
      } finally {
        setIsLoading(false);
      }
    };

    fetchManagerData();

    // Refresh data every 30 seconds
    const interval = setInterval(fetchManagerData, 30000);
    return () => clearInterval(interval);
  }, [user]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-yellow-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-300">Loading team dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Team Management Dashboard</h1>
          <p className="text-slate-400">Overview of your team performance and system metrics</p>
        </div>
        <div className="flex space-x-2">
          <Link href="/team">
            <Button variant="outline">
              <Users className="mr-2 h-4 w-4" />
              Manage Team
            </Button>
          </Link>
          <Link href="/analytics">
            <Button>
              <BarChart3 className="mr-2 h-4 w-4" />
              View Analytics
            </Button>
          </Link>
        </div>
      </div>

      {/* Team Overview Statistics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Team Members"
          value={teamStats?.totalTeamMembers || 0}
          subtitle="Active team size"
          icon={Users}
          color="blue"
        />
        <StatCard
          title="Active Team Jobs"
          value={teamStats?.activeTeamJobs || 0}
          subtitle="Currently processing"
          icon={Activity}
          color="green"
        />
        <StatCard
          title="Completion Rate"
          value={`${teamStats?.teamCompletionRate || 0}%`}
          subtitle="Team success rate"
          icon={TrendingUp}
          color="green"
        />
        <StatCard
          title="Pending Reviews"
          value={teamStats?.pendingReviews || 0}
          subtitle="Awaiting approval"
          icon={Shield}
          color="yellow"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* System Performance Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5" />
              <span>System Performance</span>
            </CardTitle>
            <CardDescription>
              Current system metrics and performance indicators
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-300">Total Active Jobs</span>
              <span className="text-2xl font-bold text-slate-100">
                {systemMetrics?.activeJobs || 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-300">Completed Today</span>
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

        {/* Team Members Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>Team Status</span>
            </CardTitle>
            <CardDescription>
              Current status of your team members
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {teamMembers.slice(0, 4).map((member) => (
                <div key={member.id} className="flex items-center justify-between p-3 border border-slate-700 rounded-lg bg-slate-800/50">
                  <div className="flex items-center space-x-3">
                    <div className="h-8 w-8 rounded-full bg-slate-600 flex items-center justify-center text-sm font-medium text-slate-200">
                      {member.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <p className="font-medium text-slate-100">{member.name}</p>
                      <p className="text-sm text-slate-400">{member.activeJobs} active jobs</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-slate-100">{member.successRate}%</p>
                    <p className="text-xs text-slate-400">success rate</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <Link href="/team">
                <Button variant="outline" className="w-full">
                  View All Team Members
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Team Activity */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Team Activity</CardTitle>
            <CardDescription>
              Latest job submissions and completions from your team
            </CardDescription>
          </div>
          <Link href="/jobs">
            <Button variant="outline">View All Jobs</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {teamJobs.length > 0 ? (
            <div className="space-y-3">
              {teamJobs.map((job) => (
                <TeamJobCard key={job.id} job={job} />
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-slate-400">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-slate-500" />
              <p>No recent team activity</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TeamJobCard({ job }: { job: Job }) {
  const statusColors = {
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    active: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    completed: 'bg-green-500/20 text-green-400 border-green-500/30',
    failed: 'bg-red-500/20 text-red-400 border-red-500/30',
    cancelled: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  };

  return (
    <div className="flex items-center justify-between p-4 border border-slate-700 rounded-lg bg-slate-800/50">
      <div className="flex items-center space-x-3">
        <div className="h-8 w-8 rounded-full bg-slate-600 flex items-center justify-center text-sm font-medium text-slate-200">
          TM
        </div>
        <div>
          <p className="font-medium text-slate-100">{job.type ? job.type.replace('_', ' ').toUpperCase() : 'UNKNOWN'}</p>
          <p className="text-sm text-slate-400">
            {new Date(job.createdAt).toLocaleDateString()} • Team Member
          </p>
        </div>
      </div>
      <div className="text-right">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColors[job.status]}`}>
          {job.status}
        </span>
        {job.progress && job.status === 'active' && (
          <div className="mt-1 w-20 bg-slate-700 rounded-full h-1.5">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${job.progress}%` }}
            ></div>
          </div>
        )}
      </div>
    </div>
  );
}