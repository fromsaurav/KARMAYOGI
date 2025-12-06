'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Users,
  Plus,
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Mail,
  Calendar,
  ArrowRight
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  successRate: number;
  lastActivity: string;
  joinDate: string;
}

export default function TeamManagementPage() {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuthStore();
  const router = useRouter();

  // Redirect if user doesn't have manager or admin role
  useEffect(() => {
    if (user && user.role !== UserRole.MANAGER && user.role !== UserRole.ADMIN) {
      router.push('/dashboard');
      return;
    }
  }, [user, router]);

  useEffect(() => {
    const fetchTeamData = async () => {
      try {
        // Mock team data - in a real app, this would come from an API
        const mockTeamMembers: TeamMember[] = [
          {
            id: '1',
            name: 'John Doe',
            email: 'john.doe@company.com',
            role: UserRole.USER,
            activeJobs: 2,
            completedJobs: 45,
            failedJobs: 3,
            successRate: 94,
            lastActivity: '2 hours ago',
            joinDate: '2024-01-15'
          },
          {
            id: '2',
            name: 'Sarah Smith',
            email: 'sarah.smith@company.com',
            role: UserRole.USER,
            activeJobs: 1,
            completedJobs: 38,
            failedJobs: 4,
            successRate: 90,
            lastActivity: '1 hour ago',
            joinDate: '2024-02-01'
          },
          {
            id: '3',
            name: 'Mike Johnson',
            email: 'mike.johnson@company.com',
            role: UserRole.USER,
            activeJobs: 3,
            completedJobs: 52,
            failedJobs: 2,
            successRate: 96,
            lastActivity: '30 minutes ago',
            joinDate: '2023-12-10'
          },
          {
            id: '4',
            name: 'Emily Davis',
            email: 'emily.davis@company.com',
            role: UserRole.USER,
            activeJobs: 0,
            completedJobs: 41,
            failedJobs: 1,
            successRate: 98,
            lastActivity: '4 hours ago',
            joinDate: '2024-03-05'
          },
          {
            id: '5',
            name: 'Alex Wilson',
            email: 'alex.wilson@company.com',
            role: UserRole.USER,
            activeJobs: 2,
            completedJobs: 29,
            failedJobs: 5,
            successRate: 85,
            lastActivity: '6 hours ago',
            joinDate: '2024-04-12'
          }
        ];

        setTeamMembers(mockTeamMembers);
      } catch (error) {
        console.error('Failed to fetch team data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (user && (user.role === UserRole.MANAGER || user.role === UserRole.ADMIN)) {
      fetchTeamData();
    }
  }, [user]);

  if (!user || (user.role !== UserRole.MANAGER && user.role !== UserRole.ADMIN)) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <p className="text-slate-300">Access denied. Manager or Admin role required.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-yellow-500 border-t-transparent mx-auto mb-4"></div>
            <p className="text-slate-300">Loading team data...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const teamStats = {
    totalMembers: teamMembers.length,
    activeMembers: teamMembers.filter(member => member.activeJobs > 0).length,
    totalActiveJobs: teamMembers.reduce((sum, member) => sum + member.activeJobs, 0),
    avgSuccessRate: Math.round(teamMembers.reduce((sum, member) => sum + member.successRate, 0) / teamMembers.length)
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Team Management</h1>
            <p className="text-slate-400">Manage and monitor your team members</p>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Add Team Member
            </Button>
            <Link href="/analytics">
              <Button>
                <TrendingUp className="mr-2 h-4 w-4" />
                Team Analytics
              </Button>
            </Link>
          </div>
        </div>

        {/* Team Overview Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="flex items-center space-x-3 p-6">
              <div className="p-2 rounded-full bg-blue-500/20">
                <Users className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-100">{teamStats.totalMembers}</p>
                <p className="text-sm text-slate-400">Total Members</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center space-x-3 p-6">
              <div className="p-2 rounded-full bg-green-500/20">
                <Activity className="h-6 w-6 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-100">{teamStats.activeMembers}</p>
                <p className="text-sm text-slate-400">Active Members</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center space-x-3 p-6">
              <div className="p-2 rounded-full bg-yellow-500/20">
                <Clock className="h-6 w-6 text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-100">{teamStats.totalActiveJobs}</p>
                <p className="text-sm text-slate-400">Active Jobs</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center space-x-3 p-6">
              <div className="p-2 rounded-full bg-purple-500/20">
                <TrendingUp className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-100">{teamStats.avgSuccessRate}%</p>
                <p className="text-sm text-slate-400">Avg Success Rate</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Team Members Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>Team Members</span>
            </CardTitle>
            <CardDescription>
              Overview of all team members and their performance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 px-4 font-medium text-slate-300">Member</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-300">Role</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-300">Active Jobs</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-300">Completed</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-300">Success Rate</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-300">Last Activity</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {teamMembers.map((member) => (
                    <tr key={member.id} className="border-b border-slate-700/50 hover:bg-slate-800/50">
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="h-8 w-8 rounded-full bg-slate-600 flex items-center justify-center text-sm font-medium text-slate-200">
                            {member.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <p className="font-medium text-slate-100">{member.name}</p>
                            <p className="text-sm text-slate-400">{member.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
                          {member.role}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <Activity className="h-4 w-4 text-blue-400" />
                          <span className="text-slate-100">{member.activeJobs}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-green-400" />
                          <span className="text-slate-100">{member.completedJobs}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <div className={`h-2 w-16 rounded-full bg-slate-700`}>
                            <div
                              className="h-2 rounded-full bg-green-400"
                              style={{ width: `${member.successRate}%` }}
                            ></div>
                          </div>
                          <span className="text-slate-100">{member.successRate}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-400">{member.lastActivity}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <Button variant="outline" size="sm">
                            <ArrowRight className="h-4 w-4" />
                            View
                          </Button>
                          <Button variant="outline" size="sm">
                            <Mail className="h-4 w-4" />
                            Contact
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Assign Task</CardTitle>
              <CardDescription>
                Assign a new task to a team member
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">
                <Plus className="mr-2 h-4 w-4" />
                Create Assignment
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Team Performance</CardTitle>
              <CardDescription>
                View detailed team analytics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/analytics">
                <Button variant="outline" className="w-full">
                  <TrendingUp className="mr-2 h-4 w-4" />
                  View Analytics
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Team Meeting</CardTitle>
              <CardDescription>
                Schedule a team meeting
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">
                <Calendar className="mr-2 h-4 w-4" />
                Schedule Meeting
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}