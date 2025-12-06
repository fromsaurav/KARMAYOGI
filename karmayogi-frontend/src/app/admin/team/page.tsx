'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Users,
  Mail,
  Calendar,
  Eye,
  UserPlus,
  Briefcase,
  Activity,
  CheckCircle,
  TrendingUp,
  Loader2,
  X
} from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface TeamMember {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  createdAt: string;
  stats: {
    totalJobs: number;
    activeJobs: number;
    completedJobs: number;
    failedJobs: number;
    totalComments: number;
  };
  recentJobs: Array<{
    id: string;
    status: string;
    createdAt: string;
  }>;
}

interface TeamMemberDetails {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  createdAt: string;
  jobs: Array<{ id: string; type: string; status: string; createdAt: string }>;
  comments: Array<{ id: string; content: string; createdAt: string }>;
  _count: {
    jobs: number;
    comments: number;
    watchedJobs: number;
  };
}

export default function AdminTeamPage() {
  const { user, isLoading } = useAuthStore();
  const router = useRouter();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [memberDetails, setMemberDetails] = useState<TeamMemberDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Form states
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingTime, setMeetingTime] = useState('');
  const [meetingSubject, setMeetingSubject] = useState('');
  const [taskDescription, setTaskDescription] = useState('');

  useEffect(() => {
    if (!isLoading && user) {
      if (user.role !== UserRole.ADMIN && user.role !== UserRole.MANAGER) {
        router.push('/dashboard');
        return;
      }
      fetchTeamMembers();
    }
  }, [user, isLoading, router]);

  const fetchTeamMembers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE_URL}/api/admin/team`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch team members');
      }

      const data = await response.json();
      setTeamMembers(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load team');
      console.error('Error fetching team:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMemberDetails = async (memberId: string) => {
    setLoadingDetails(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/team/${memberId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch member details');
      }

      const data = await response.json();
      setMemberDetails(data.data);
    } catch (err) {
      alert('Failed to load member details');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleViewDetails = async (member: TeamMember) => {
    setSelectedMember(member);
    setShowDetailsModal(true);
    await fetchMemberDetails(member.id);
  };

  const handleContact = (member: TeamMember) => {
    // Open default email client with pre-filled email
    const mailtoLink = `mailto:${member.email}?subject=${encodeURIComponent('Regarding Your Work at KarmaYogi')}`;

    // Use anchor element for better compatibility
    const link = document.createElement('a');
    link.href = mailtoLink;
    link.target = '_blank';
    link.click();
  };

  const handleScheduleMeet = (member: TeamMember) => {
    setSelectedMember(member);
    setShowScheduleModal(true);
  };

  const handleAssignTask = (member: TeamMember) => {
    setSelectedMember(member);
    setShowAssignModal(true);
  };

  const submitScheduleMeet = () => {
    if (!selectedMember || !meetingDate || !meetingTime) {
      alert('Please fill in all required fields');
      return;
    }

    const subject = meetingSubject || 'Team Meeting';
    const dateTime = `${meetingDate}T${meetingTime}`;
    const formattedDate = new Date(dateTime).toLocaleString();

    // Create mailto link with meeting details
    const body = `Hi ${selectedMember.fullName},\n\nI'd like to schedule a meeting with you.\n\nSubject: ${subject}\nDate & Time: ${formattedDate}\n\nPlease confirm your availability.\n\nBest regards`;
    const mailtoLink = `mailto:${selectedMember.email}?subject=${encodeURIComponent(`Meeting Request: ${subject}`)}&body=${encodeURIComponent(body)}`;

    // Use both methods for maximum compatibility
    const link = document.createElement('a');
    link.href = mailtoLink;
    link.target = '_blank';
    link.click();

    setShowScheduleModal(false);
    setMeetingDate('');
    setMeetingTime('');
    setMeetingSubject('');
  };

  const submitAssignTask = () => {
    if (!selectedMember || !taskDescription) {
      alert('Please provide a task description');
      return;
    }

    // Create mailto link with task assignment
    const body = `Hi ${selectedMember.fullName},\n\nI'm assigning you the following task:\n\n${taskDescription}\n\nPlease confirm receipt and let me know if you have any questions.\n\nBest regards`;
    const mailtoLink = `mailto:${selectedMember.email}?subject=${encodeURIComponent('Task Assignment')}&body=${encodeURIComponent(body)}`;

    // Use both methods for maximum compatibility
    const link = document.createElement('a');
    link.href = mailtoLink;
    link.target = '_blank';
    link.click();

    setShowAssignModal(false);
    setTaskDescription('');
  };

  if (isLoading || !user) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-yellow-500 border-t-transparent mx-auto mb-4"></div>
            <p className="text-slate-300">Loading...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (user.role !== UserRole.ADMIN && user.role !== UserRole.MANAGER) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center">
          <p className="text-red-400">Access Denied</p>
        </div>
      </DashboardLayout>
    );
  }

  const getRoleBadgeClass = (role: UserRole) => {
    switch (role) {
      case UserRole.ADMIN:
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case UserRole.MANAGER:
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case UserRole.USER:
      default:
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    }
  };

  const getSuccessRate = (member: TeamMember) => {
    if (member.stats.totalJobs === 0) return 0;
    return Math.round((member.stats.completedJobs / member.stats.totalJobs) * 100);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Team Management</h1>
            <p className="text-slate-400">View and manage your team members</p>
          </div>
          {user.role === UserRole.ADMIN && (
            <Button
              type="button"
              onClick={() => router.push('/admin/users')}
              className="bg-yellow-500 hover:bg-yellow-600 text-slate-900 cursor-pointer"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Add Team Member
            </Button>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Total Members</p>
                  <p className="text-2xl font-bold text-slate-100">{teamMembers.length}</p>
                </div>
                <Users className="h-8 w-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Active Jobs</p>
                  <p className="text-2xl font-bold text-slate-100">
                    {teamMembers.reduce((sum, m) => sum + m.stats.activeJobs, 0)}
                  </p>
                </div>
                <Activity className="h-8 w-8 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Completed</p>
                  <p className="text-2xl font-bold text-slate-100">
                    {teamMembers.reduce((sum, m) => sum + m.stats.completedJobs, 0)}
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Avg Success Rate</p>
                  <p className="text-2xl font-bold text-slate-100">
                    {teamMembers.length > 0
                      ? Math.round(
                          teamMembers.reduce((sum, m) => sum + getSuccessRate(m), 0) /
                            teamMembers.length
                        )
                      : 0}
                    %
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-yellow-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Team Members Table */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-slate-100">Team Members ({teamMembers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-yellow-500 border-t-transparent mx-auto mb-4"></div>
                <p className="text-slate-400">Loading team members...</p>
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <p className="text-red-400">{error}</p>
                <Button onClick={fetchTeamMembers} className="mt-4 cursor-pointer">Retry</Button>
              </div>
            ) : teamMembers.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-slate-400">No team members found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left p-4 text-slate-300 font-medium">Member</th>
                      <th className="text-left p-4 text-slate-300 font-medium">Role</th>
                      <th className="text-left p-4 text-slate-300 font-medium">Activity</th>
                      <th className="text-left p-4 text-slate-300 font-medium">Success Rate</th>
                      <th className="text-left p-4 text-slate-300 font-medium">Joined</th>
                      <th className="text-right p-4 text-slate-300 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamMembers.map((member) => (
                      <tr key={member.id} className="border-b border-slate-700 hover:bg-slate-700/50">
                        <td className="p-4">
                          <div>
                            <p className="font-medium text-slate-100">{member.fullName}</p>
                            <p className="text-sm text-slate-400">{member.email}</p>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getRoleBadgeClass(member.role)}`}>
                            {member.role}
                          </span>
                        </td>
                        <td className="p-4">
                          <div>
                            <div className="flex items-center gap-2 text-sm">
                              <Activity className="h-4 w-4 text-green-400" />
                              <span className="text-slate-300">{member.stats.activeJobs} active</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm mt-1">
                              <CheckCircle className="h-4 w-4 text-blue-400" />
                              <span className="text-slate-400">{member.stats.completedJobs} completed</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="text-slate-300 font-medium">
                            {getSuccessRate(member)}%
                          </div>
                          <div className="text-xs text-slate-500">
                            {member.stats.totalJobs} total jobs
                          </div>
                        </td>
                        <td className="p-4 text-slate-400">
                          {new Date(member.createdAt).toLocaleDateString()}
                        </td>
                        <td className="p-4">
                          <div className="flex justify-end gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                handleViewDetails(member);
                              }}
                              className="p-2 rounded-md text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 cursor-pointer transition-colors"
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                handleContact(member);
                              }}
                              className="p-2 rounded-md text-slate-400 hover:text-green-400 hover:bg-green-500/10 cursor-pointer transition-colors"
                              title="Contact"
                            >
                              <Mail className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                handleScheduleMeet(member);
                              }}
                              className="p-2 rounded-md text-slate-400 hover:text-purple-400 hover:bg-purple-500/10 cursor-pointer transition-colors"
                              title="Schedule Meet"
                            >
                              <Calendar className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                handleAssignTask(member);
                              }}
                              className="p-2 rounded-md text-slate-400 hover:text-yellow-400 hover:bg-yellow-500/10 cursor-pointer transition-colors"
                              title="Assign Task"
                            >
                              <Briefcase className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* View Details Modal */}
        {showDetailsModal && selectedMember && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-lg p-6 w-full max-w-2xl border border-slate-700 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-slate-100">Member Details</h2>
                <button
                  type="button"
                  onClick={() => setShowDetailsModal(false)}
                  className="text-slate-400 hover:text-slate-300 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {loadingDetails ? (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-yellow-500" />
                  <p className="text-slate-400">Loading details...</p>
                </div>
              ) : memberDetails ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-slate-400">Name</label>
                      <p className="text-slate-100 font-medium">{memberDetails.fullName}</p>
                    </div>
                    <div>
                      <label className="text-sm text-slate-400">Email</label>
                      <p className="text-slate-100">{memberDetails.email}</p>
                    </div>
                    <div>
                      <label className="text-sm text-slate-400">Role</label>
                      <p className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getRoleBadgeClass(memberDetails.role)}`}>
                        {memberDetails.role}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm text-slate-400">Joined</label>
                      <p className="text-slate-100">{new Date(memberDetails.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <div className="border-t border-slate-700 pt-4">
                    <h3 className="text-sm font-semibold text-slate-300 mb-2">Statistics</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-3 bg-slate-700/50 rounded-lg">
                        <p className="text-2xl font-bold text-green-400">{memberDetails._count.jobs}</p>
                        <p className="text-xs text-slate-400">Total Jobs</p>
                      </div>
                      <div className="text-center p-3 bg-slate-700/50 rounded-lg">
                        <p className="text-2xl font-bold text-blue-400">{memberDetails._count.comments}</p>
                        <p className="text-xs text-slate-400">Comments</p>
                      </div>
                      <div className="text-center p-3 bg-slate-700/50 rounded-lg">
                        <p className="text-2xl font-bold text-purple-400">{memberDetails._count.watchedJobs}</p>
                        <p className="text-xs text-slate-400">Watching</p>
                      </div>
                    </div>
                  </div>

                  {memberDetails.jobs && memberDetails.jobs.length > 0 && (
                    <div className="border-t border-slate-700 pt-4">
                      <h3 className="text-sm font-semibold text-slate-300 mb-2">Recent Jobs</h3>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {memberDetails.jobs.slice(0, 5).map((job) => (
                          <div key={job.id} className="flex items-center justify-between p-2 bg-slate-700/30 rounded">
                            <div>
                              <p className="text-sm text-slate-300">{job.type}</p>
                              <p className="text-xs text-slate-500">{new Date(job.createdAt).toLocaleString()}</p>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded ${
                              job.status === 'COMPLETED' ? 'bg-green-500/20 text-green-400' :
                              job.status === 'FAILED' ? 'bg-red-500/20 text-red-400' :
                              job.status === 'ACTIVE' ? 'bg-blue-500/20 text-blue-400' :
                              'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              {job.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-center py-8 text-slate-400">No details available</p>
              )}
            </div>
          </div>
        )}

        {/* Schedule Meet Modal */}
        {showScheduleModal && selectedMember && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-slate-100">Schedule Meeting</h2>
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="text-slate-400 hover:text-slate-300 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <p className="text-sm text-slate-400 mb-4">
                Schedule a meeting with <strong className="text-slate-200">{selectedMember.fullName}</strong>
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Meeting Subject</label>
                  <input
                    type="text"
                    value={meetingSubject}
                    onChange={(e) => setMeetingSubject(e.target.value)}
                    placeholder="Team Meeting"
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Date*</label>
                  <input
                    type="date"
                    value={meetingDate}
                    onChange={(e) => setMeetingDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Time*</label>
                  <input
                    type="time"
                    value={meetingTime}
                    onChange={(e) => setMeetingTime(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    onClick={submitScheduleMeet}
                    className="flex-1 bg-purple-500 hover:bg-purple-600 text-white cursor-pointer"
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Send Meeting Request
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setShowScheduleModal(false)}
                    variant="outline"
                    className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700 cursor-pointer"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Assign Task Modal */}
        {showAssignModal && selectedMember && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-slate-100">Assign Task</h2>
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="text-slate-400 hover:text-slate-300 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <p className="text-sm text-slate-400 mb-4">
                Assign a task to <strong className="text-slate-200">{selectedMember.fullName}</strong>
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Task Description*</label>
                  <textarea
                    value={taskDescription}
                    onChange={(e) => setTaskDescription(e.target.value)}
                    required
                    rows={5}
                    placeholder="Describe the task in detail..."
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    onClick={submitAssignTask}
                    className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-slate-900 cursor-pointer"
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Send Task Assignment
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setShowAssignModal(false)}
                    variant="outline"
                    className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700 cursor-pointer"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
