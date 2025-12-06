'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  Settings,
  User,
  Bell,
  Shield,
  Palette,
  Moon,
  Sun,
  Monitor,
  Save,
  Eye,
  EyeOff,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  LogOut,
  Trash2
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

interface UserSettings {
  profile: {
    name: string;
    email: string;
    phone: string;
    location: string;
    department: string;
    bio: string;
    avatar: string;
  };
  notifications: {
    emailNotifications: boolean;
    pushNotifications: boolean;
    jobCompletions: boolean;
    systemAlerts: boolean;
    weeklyReports: boolean;
  };
  privacy: {
    profileVisibility: 'public' | 'private' | 'team';
    showOnlineStatus: boolean;
    allowDirectMessages: boolean;
  };
  theme: {
    mode: 'light' | 'dark' | 'system';
    primaryColor: string;
  };
}

const SettingCard = ({ 
  title, 
  description, 
  icon: Icon, 
  children 
}: { 
  title: string; 
  description: string; 
  icon: any; 
  children: React.ReactNode;
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          <Icon className="w-5 h-5 mr-2" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {children}
      </CardContent>
    </Card>
  );
};

const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();
  
  const themes = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor }
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {themes.map(({ value, label, icon: Icon }) => (
        <Button
          key={value}
          variant={theme === value ? 'default' : 'outline'}
          className={`flex flex-col items-center p-4 h-auto ${
            theme === value ? 'bg-blue-600 text-white hover:bg-blue-700' : ''
          }`}
          onClick={() => setTheme(value as 'light' | 'dark' | 'system')}
        >
          <Icon className="w-6 h-6 mb-2" />
          <span className="text-sm">{label}</span>
        </Button>
      ))}
    </div>
  );
};

export default function SettingsPage() {
  const { user, logout } = useAuthStore();
  const { theme } = useTheme();
  
  const [settings, setSettings] = useState<UserSettings>({
    profile: {
      name: user?.fullName || user?.username || '',
      email: user?.email || '',
      phone: '',
      location: '',
      department: '',
      bio: '',
      avatar: ''
    },
    notifications: {
      emailNotifications: true,
      pushNotifications: true,
      jobCompletions: true,
      systemAlerts: true,
      weeklyReports: false
    },
    privacy: {
      profileVisibility: 'team',
      showOnlineStatus: true,
      allowDirectMessages: true
    },
    theme: {
      mode: theme,
      primaryColor: '#3B82F6'
    }
  });

  const [isDirty, setIsDirty] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSettingChange = (section: keyof UserSettings, key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    try {
      // Here you would save settings to your backend
      console.log('Saving settings:', settings);
      setIsDirty(false);
      // Show success message
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  // Update settings when theme changes from the provider
  useEffect(() => {
    setSettings(prev => ({
      ...prev,
      theme: { ...prev.theme, mode: theme }
    }));
  }, [theme]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
            <p className="text-muted-foreground">
              Manage your account preferences and application settings
            </p>
          </div>
          {isDirty && (
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
          )}
        </div>

        <div className="grid gap-6">
          {/* Profile Settings */}
          <SettingCard
            title="Profile Settings"
            description="Update your personal information and profile details"
            icon={User}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={settings.profile.name}
                  onChange={(e) => handleSettingChange('profile', 'name', e.target.value)}
                  placeholder="Enter your full name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={settings.profile.email}
                  onChange={(e) => handleSettingChange('profile', 'email', e.target.value)}
                  placeholder="Enter your email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    className="pl-10"
                    value={settings.profile.phone}
                    onChange={(e) => handleSettingChange('profile', 'phone', e.target.value)}
                    placeholder="Enter your phone number"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="location"
                    className="pl-10"
                    value={settings.profile.location}
                    onChange={(e) => handleSettingChange('profile', 'location', e.target.value)}
                    placeholder="Enter your location"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="department"
                    className="pl-10"
                    value={settings.profile.department}
                    onChange={(e) => handleSettingChange('profile', 'department', e.target.value)}
                    placeholder="Enter your department"
                  />
                </div>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <textarea
                id="bio"
                className="w-full min-h-[100px] px-3 py-2 text-sm border border-input rounded-md bg-background"
                value={settings.profile.bio}
                onChange={(e) => handleSettingChange('profile', 'bio', e.target.value)}
                placeholder="Tell us about yourself..."
              />
            </div>
          </SettingCard>

          {/* Theme Settings */}
          <SettingCard
            title="Appearance"
            description="Customize the look and feel of your application"
            icon={Palette}
          >
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Theme Mode</Label>
                <p className="text-sm text-muted-foreground mb-3">
                  Choose your preferred theme or use system preference
                </p>
                <ThemeToggle />
              </div>
              <div>
                <Label htmlFor="primaryColor" className="text-sm font-medium">Primary Color</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Choose your preferred accent color
                </p>
                <div className="flex items-center space-x-2">
                  <input
                    id="primaryColor"
                    type="color"
                    value={settings.theme.primaryColor}
                    onChange={(e) => handleSettingChange('theme', 'primaryColor', e.target.value)}
                    className="w-12 h-10 rounded border border-input"
                  />
                  <Input
                    value={settings.theme.primaryColor}
                    onChange={(e) => handleSettingChange('theme', 'primaryColor', e.target.value)}
                    className="flex-1"
                    placeholder="#3B82F6"
                  />
                </div>
              </div>
            </div>
          </SettingCard>

          {/* Notification Settings */}
          <SettingCard
            title="Notifications"
            description="Control how and when you receive notifications"
            icon={Bell}
          >
            <div className="space-y-4">
              {Object.entries(settings.notifications).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium">
                      {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {key === 'emailNotifications' && 'Receive notifications via email'}
                      {key === 'pushNotifications' && 'Receive push notifications in browser'}
                      {key === 'jobCompletions' && 'Get notified when jobs complete'}
                      {key === 'systemAlerts' && 'Receive system maintenance alerts'}
                      {key === 'weeklyReports' && 'Get weekly performance reports'}
                    </div>
                  </div>
                  <Button
                    variant={value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleSettingChange('notifications', key, !value)}
                  >
                    {value ? 'On' : 'Off'}
                  </Button>
                </div>
              ))}
            </div>
          </SettingCard>

          {/* Privacy Settings */}
          <SettingCard
            title="Privacy & Security"
            description="Manage your privacy preferences and security settings"
            icon={Shield}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">Profile Visibility</div>
                  <div className="text-sm text-muted-foreground">
                    Control who can see your profile information
                  </div>
                </div>
                <select
                  value={settings.privacy.profileVisibility}
                  onChange={(e) => handleSettingChange('privacy', 'profileVisibility', e.target.value)}
                  className="px-3 py-2 text-sm border border-input rounded-md bg-background"
                >
                  <option value="public">Public</option>
                  <option value="team">Team Only</option>
                  <option value="private">Private</option>
                </select>
              </div>
              
              {Object.entries(settings.privacy).filter(([key]) => key !== 'profileVisibility').map(([key, value]) => (
                <div key={key} className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium">
                      {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {key === 'showOnlineStatus' && 'Let others see when you\'re online'}
                      {key === 'allowDirectMessages' && 'Allow team members to message you directly'}
                    </div>
                  </div>
                  <Button
                    variant={value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleSettingChange('privacy', key, !value)}
                  >
                    {value ? 'On' : 'Off'}
                  </Button>
                </div>
              ))}

              <div className="pt-4 border-t">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <div className="relative">
                    <Input
                      id="currentPassword"
                      type={showPassword ? 'text' : 'password'}
                      className="pr-10"
                      placeholder="Enter current password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input
                      id="newPassword"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter new password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Confirm new password"
                    />
                  </div>
                </div>
                <Button variant="outline" className="mt-4">
                  Update Password
                </Button>
              </div>
            </div>
          </SettingCard>

          {/* Account Actions Section */}
          <SettingCard
            title="Account Actions"
            description="Manage your account and session"
            icon={Settings}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border border-yellow-200 bg-yellow-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <LogOut className="h-5 w-5 text-yellow-600" />
                  <div>
                    <div className="text-sm font-medium text-yellow-800">Sign Out</div>
                    <div className="text-sm text-yellow-600">
                      End your current session and return to login
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (confirm('Are you sure you want to sign out?')) {
                      logout();
                    }
                  }}
                  className="border-yellow-300 text-yellow-700 hover:bg-yellow-100"
                >
                  Sign Out
                </Button>
              </div>

              <div className="flex items-center justify-between p-4 border border-red-200 bg-red-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Trash2 className="h-5 w-5 text-red-600" />
                  <div>
                    <div className="text-sm font-medium text-red-800">Delete Account</div>
                    <div className="text-sm text-red-600">
                      Permanently delete your account and all data
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => alert('Account deletion is not available in demo mode')}
                  className="border-red-300 text-red-700 hover:bg-red-100"
                >
                  Delete Account
                </Button>
              </div>
            </div>
          </SettingCard>
        </div>
      </div>
    </DashboardLayout>
  );
}