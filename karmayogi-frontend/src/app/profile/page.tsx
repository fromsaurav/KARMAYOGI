'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { 
  User, 
  Edit3, 
  Camera, 
  Mail, 
  Phone, 
  MapPin, 
  Briefcase,
  Calendar,
  Award,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  Activity,
  Star,
  Trophy,
  Target,
  Zap,
  LogOut,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { mockJobs, mockUsers } from '@/lib/mockData';
import { useRouter } from 'next/navigation';

interface ProfileStats {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  activeJobs: number;
  successRate: number;
  avgCompletionTime: string;
  streak: number;
  rank: string;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  earned: boolean;
  earnedDate?: string;
  color: string;
}

const achievements: Achievement[] = [
  {
    id: '1',
    title: 'First Steps',
    description: 'Complete your first job',
    icon: Trophy,
    earned: true,
    earnedDate: '2024-01-15',
    color: 'text-yellow-600'
  },
  {
    id: '2',
    title: 'Speed Demon',
    description: 'Complete 10 jobs in under 5 minutes each',
    icon: Zap,
    earned: true,
    earnedDate: '2024-02-01',
    color: 'text-blue-600'
  },
  {
    id: '3',
    title: 'Perfectionist',
    description: 'Maintain 95% success rate over 50 jobs',
    icon: Star,
    earned: false,
    color: 'text-purple-600'
  },
  {
    id: '4',
    title: 'Marathon Runner',
    description: 'Process 100 jobs successfully',
    icon: Target,
    earned: false,
    color: 'text-green-600'
  }
];

export default function ProfilePage() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    phone: '',
    location: '',
    department: '',
    bio: '',
    joinDate: ''
  });

  // Fix hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Helper function to check if current user is demo user
  const isDemoUser = () => {
    return user?.id === 'dev-user-id' || user?.email === 'dev@example.com';
  };

  // Mock profile stats (only for demo users)
  const currentUser = user || mockUsers.find(u => u.id === 'dev-user-id') || mockUsers[0];
  const userJobs = isDemoUser() ? mockJobs.filter(job => job.userId === currentUser?.id) : [];
  const completedJobs = userJobs.filter(job => job.status === 'completed');
  const failedJobs = userJobs.filter(job => job.status === 'failed');
  const activeJobs = userJobs.filter(job => job.status === 'active');

  const stats: ProfileStats = {
    totalJobs: userJobs.length,
    completedJobs: completedJobs.length,
    failedJobs: failedJobs.length,
    activeJobs: activeJobs.length,
    successRate: userJobs.length > 0 ? Math.round((completedJobs.length / userJobs.length) * 100) : 0,
    avgCompletionTime: '4.2 mins',
    streak: 12,
    rank: 'Expert'
  };

  useEffect(() => {
    if (currentUser) {
      setProfileData({
        name: (currentUser as any).fullName || (currentUser as any).name || currentUser.username || '',
        email: currentUser.email || '',
        phone: '+1 (555) 123-4567',
        location: 'San Francisco, CA',
        department: 'Engineering',
        bio: 'Passionate about distributed systems and task automation. Love solving complex problems and optimizing workflows.',
        joinDate: currentUser.createdAt
          ? (typeof currentUser.createdAt === 'string'
              ? currentUser.createdAt.split('T')[0]
              : new Date(currentUser.createdAt).toISOString().split('T')[0])
          : new Date().toISOString().split('T')[0]
      });
    }
  }, [currentUser]);

  const handleSave = () => {
    setIsEditing(false);
    // Here you would save the data to your backend
  };

  const handleSignOut = () => {
    logout();
    router.push('/auth/login');
  };

  const handleDeleteAccount = async () => {
    if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      try {
        // Here you would call the delete account API
        // await authService.deleteAccount();
        logout();
        router.push('/auth/signup');
      } catch (error) {
        console.error('Failed to delete account:', error);
        alert('Failed to delete account. Please try again.');
      }
    }
  };

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-yellow-500 border-t-transparent mx-auto mb-4"></div>
            <p className="text-slate-300">Loading profile...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight dark:text-white">Profile</h1>
            <p className="text-muted-foreground dark:text-gray-400">
              Manage your personal information and view your performance
            </p>
          </div>
          <Button 
            onClick={() => setIsEditing(!isEditing)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Edit3 className="w-4 h-4 mr-2" />
            {isEditing ? 'Cancel' : 'Edit Profile'}
          </Button>
        </div>

        {/* Profile Header Card */}
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="p-6">
            <div className="flex items-center space-x-6">
              <div className="relative">
                <div className="w-24 h-24 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-3xl font-bold">
                  {(currentUser?.fullName || currentUser?.name || currentUser?.username)?.charAt(0).toUpperCase() || 'U'}
                </div>
                <button className="absolute -bottom-1 -right-1 bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 transition-colors">
                  <Camera className="w-4 h-4" />
                </button>
                <div className="absolute -top-1 -right-1 bg-green-500 border-4 border-white dark:border-gray-800 rounded-full w-6 h-6"></div>
              </div>
              
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h2 className="text-2xl font-bold dark:text-white">{profileData.name || currentUser?.fullName || currentUser?.name || currentUser?.username}</h2>
                  <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-sm font-medium rounded-full">
                    {stats.rank}
                  </span>
                  <div className="flex items-center text-yellow-500">
                    <Star className="w-4 h-4 fill-current" />
                    <span className="ml-1 font-medium">{stats.successRate}%</span>
                  </div>
                </div>
                <p className="text-gray-600 dark:text-gray-400 mb-2">{profileData.bio}</p>
                <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 space-x-4">
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 mr-1" />
                    Joined {new Date(profileData.joinDate).toLocaleDateString()}
                  </div>
                  <div className="flex items-center">
                    <Award className="w-4 h-4 mr-1" />
                    {achievements.filter(a => a.earned).length} achievements
                  </div>
                  <div className="flex items-center">
                    <TrendingUp className="w-4 h-4 mr-1" />
                    {stats.streak} day streak
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium dark:text-white">Total Jobs</CardTitle>
              <Briefcase className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold dark:text-white">{stats.totalJobs}</div>
              <p className="text-xs text-muted-foreground dark:text-gray-400">
                All time submissions
              </p>
            </CardContent>
          </Card>

          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium dark:text-white">Success Rate</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold dark:text-white">{stats.successRate}%</div>
              <p className="text-xs text-muted-foreground dark:text-gray-400">
                {stats.completedJobs} completed
              </p>
            </CardContent>
          </Card>

          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium dark:text-white">Avg Time</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold dark:text-white">{stats.avgCompletionTime}</div>
              <p className="text-xs text-muted-foreground dark:text-gray-400">
                Per job completion
              </p>
            </CardContent>
          </Card>

          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium dark:text-white">Active Now</CardTitle>
              <Activity className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold dark:text-white">{stats.activeJobs}</div>
              <p className="text-xs text-muted-foreground dark:text-gray-400">
                Currently processing
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Personal Information */}
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center dark:text-white">
                <User className="w-5 h-5 mr-2" />
                Personal Information
              </CardTitle>
              <CardDescription className="dark:text-gray-400">
                Your profile details and contact information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name" className="dark:text-gray-300">Full Name</Label>
                  <Input
                    id="name"
                    value={profileData.name}
                    onChange={(e) => setProfileData({...profileData, name: e.target.value})}
                    disabled={!isEditing}
                    className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="dark:text-gray-300">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground dark:text-gray-400" />
                    <Input
                      id="email"
                      className="pl-10 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      value={profileData.email}
                      onChange={(e) => setProfileData({...profileData, email: e.target.value})}
                      disabled={!isEditing}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="dark:text-gray-300">Phone</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground dark:text-gray-400" />
                    <Input
                      id="phone"
                      className="pl-10 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      value={profileData.phone}
                      onChange={(e) => setProfileData({...profileData, phone: e.target.value})}
                      disabled={!isEditing}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location" className="dark:text-gray-300">Location</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground dark:text-gray-400" />
                    <Input
                      id="location"
                      className="pl-10 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      value={profileData.location}
                      onChange={(e) => setProfileData({...profileData, location: e.target.value})}
                      disabled={!isEditing}
                    />
                  </div>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="department" className="dark:text-gray-300">Department</Label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-3 h-4 w-4 text-muted-foreground dark:text-gray-400" />
                    <Input
                      id="department"
                      className="pl-10 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      value={profileData.department}
                      onChange={(e) => setProfileData({...profileData, department: e.target.value})}
                      disabled={!isEditing}
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bio" className="dark:text-gray-300">Bio</Label>
                <textarea
                  id="bio"
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  value={profileData.bio}
                  onChange={(e) => setProfileData({...profileData, bio: e.target.value})}
                  disabled={!isEditing}
                  placeholder="Tell us about yourself..."
                />
              </div>
              {isEditing && (
                <div className="flex space-x-2 pt-4">
                  <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700">
                    Save Changes
                  </Button>
                  <Button variant="outline" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Achievements */}
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center dark:text-white">
                <Trophy className="w-5 h-5 mr-2" />
                Achievements
              </CardTitle>
              <CardDescription className="dark:text-gray-400">
                Your milestones and accomplishments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {achievements.map((achievement) => {
                  const Icon = achievement.icon;
                  return (
                    <div 
                      key={achievement.id}
                      className={`flex items-center p-4 rounded-lg border transition-all ${
                        achievement.earned 
                          ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200 dark:from-yellow-900/20 dark:to-orange-900/20 dark:border-yellow-700' 
                          : 'bg-gray-50 border-gray-200 dark:bg-gray-700 dark:border-gray-600 opacity-60'
                      }`}
                    >
                      <div className={`p-2 rounded-full mr-4 ${achievement.earned ? 'bg-yellow-100 dark:bg-yellow-800' : 'bg-gray-200 dark:bg-gray-600'}`}>
                        <Icon className={`w-5 h-5 ${achievement.earned ? achievement.color : 'text-gray-400'}`} />
                      </div>
                      <div className="flex-1">
                        <h4 className={`font-medium ${achievement.earned ? 'dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                          {achievement.title}
                        </h4>
                        <p className={`text-sm ${achievement.earned ? 'text-gray-600 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}`}>
                          {achievement.description}
                        </p>
                        {achievement.earned && achievement.earnedDate && (
                          <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                            Earned on {new Date(achievement.earnedDate).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      {achievement.earned && (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center dark:text-white">
              <Activity className="w-5 h-5 mr-2" />
              Recent Activity
            </CardTitle>
            <CardDescription className="dark:text-gray-400">
              Your latest job submissions and completions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {userJobs.length > 0 ? (
                userJobs.slice(0, 5).map((job) => {
                  const statusColors = {
                    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
                    active: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
                    completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
                    failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
                    cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
                  };

                  const statusIcons: Record<string, React.ElementType> = {
                    pending: Clock,
                    active: Activity,
                    completed: CheckCircle,
                    failed: XCircle,
                    cancelled: XCircle,
                  };

                  const StatusIcon = statusIcons[job.status] || XCircle;

                  return (
                    <div key={job.id} className="flex items-center justify-between p-4 border rounded-lg dark:border-gray-700">
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-full ${statusColors[job.status] || 'bg-slate-500/20 text-slate-400'}`}>
                          {StatusIcon && <StatusIcon className="h-4 w-4" />}
                        </div>
                        <div>
                          <p className="font-medium dark:text-white">
                            {job.type.replace('_', ' ').toUpperCase()}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {new Date(job.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[job.status]}`}>
                          {job.status}
                        </span>
                        {job.progress && job.status === 'active' && (
                          <div className="mt-1 w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                            <div 
                              className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${job.progress}%` }}
                            ></div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Activity className="h-12 w-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                  <p>No recent activity</p>
                  <p className="text-sm">Submit your first job to see activity here</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Account Management */}
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center text-red-600 dark:text-red-400">
              <AlertTriangle className="w-5 h-5 mr-2" />
              Account Management
            </CardTitle>
            <CardDescription className="dark:text-gray-400">
              Manage your account settings and preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Sign Out Section */}
            <div className="flex items-center justify-between p-4 border rounded-lg border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900">
                  <LogOut className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">Sign Out</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Sign out of your account on this device
                  </p>
                </div>
              </div>
              <Button
                onClick={handleSignOut}
                variant="outline"
                className="border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-900/50"
              >
                Sign Out
              </Button>
            </div>

            {/* Delete Account Section */}
            <div className="flex items-center justify-between p-4 border rounded-lg border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-full bg-red-100 dark:bg-red-900">
                  <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h4 className="font-medium text-red-900 dark:text-red-200">Delete Account</h4>
                  <p className="text-sm text-red-600 dark:text-red-400">
                    Permanently delete your account and all associated data
                  </p>
                  <p className="text-xs text-red-500 dark:text-red-500 mt-1">
                    ⚠️ This action cannot be undone
                  </p>
                </div>
              </div>
              <Button
                onClick={handleDeleteAccount}
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-100 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/50"
              >
                Delete Account
              </Button>
            </div>

            {/* Additional Security Info */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-start space-x-3">
                <div className="p-1 rounded-full bg-blue-100 dark:bg-blue-900 mt-0.5">
                  <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <h5 className="font-medium text-blue-900 dark:text-blue-200 mb-1">Security Information</h5>
                  <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                    <li>• Your data is encrypted and stored securely</li>
                    <li>• Account deletion removes all personal information</li>
                    <li>• Job history and analytics are permanently removed</li>
                    <li>• You can re-create an account using the same email</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}