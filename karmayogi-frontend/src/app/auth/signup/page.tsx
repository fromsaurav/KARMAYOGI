'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  User,
  AlertCircle,
  Check,
  X,
  AtSign,
  Crown,
  UserCog,
  Users
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/lib/api';
import { UserRole } from '@/types';

interface SignupFormData {
  fullName: string;
  username: string;
  email: string;
  password: string;
  role: UserRole;
}

export default function SignUpPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [usernameDebounceTimer, setUsernameDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  const { signup, isLoading } = useAuthStore();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignupFormData>();

  const watchedUsername = watch('username');

  // Username availability checking with debounce
  useEffect(() => {
    if (usernameDebounceTimer) {
      clearTimeout(usernameDebounceTimer);
    }

    if (!watchedUsername || watchedUsername.length < 3) {
      setUsernameStatus('idle');
      return;
    }

    const timer = setTimeout(async () => {
      setUsernameStatus('checking');
      try {
        const isAvailable = await apiClient.checkUsernameAvailability(watchedUsername);
        setUsernameStatus(isAvailable ? 'available' : 'taken');
      } catch (error) {
        console.error('Error checking username:', error);
        // When API fails, we should allow the user to proceed (graceful degradation)
        setUsernameStatus('available');
      }
    }, 500);

    setUsernameDebounceTimer(timer);

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [watchedUsername]);

  const onSubmit = async (data: SignupFormData) => {
    try {
      setError('');
      await signup(data);
      // Redirect to role-based dashboard
      const dashboardRoute = useAuthStore.getState().getDashboardRoute();
      router.push(dashboardRoute);
    } catch (error: unknown) {
      setError((error as Error).message || 'Signup failed. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex relative">
      {/* Professional dark background */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-black"></div>
      
      {/* Left Side - Signup Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 relative z-10">
        <div className="w-full max-w-md space-y-8">
          {/* Logo */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-800 border border-gray-700 rounded-xl mb-6 shadow-lg">
              <div className="text-2xl font-bold text-yellow-400">KY</div>
            </div>
            <div className="mb-6">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-yellow-400 to-yellow-500 bg-clip-text text-transparent mb-2 tracking-tight">
                KarmaYogi
              </h1>
              <p className="text-lg text-gray-300">Join the Platform</p>
              <p className="text-sm text-slate-400 mt-2">
                Distributed Task Queue Management · Real-time · Enterprise-grade
              </p>
            </div>
          </div>

          {/* Signup Form */}
          <Card className="bg-gray-800/50 backdrop-blur border border-gray-700 shadow-xl rounded-lg">
            <CardHeader className="space-y-1 pb-6">
              <CardTitle className="text-2xl font-bold text-center text-white">
                Create Account
              </CardTitle>
              <CardDescription className="text-gray-400 text-center">
                Enter your details to get started
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 px-8 pb-8">
              {error && (
                <div className="flex items-center space-x-2 text-red-400 bg-red-500/10 p-4 rounded-xl border border-red-500/20 backdrop-blur-sm">
                  <AlertCircle className="h-5 w-5 flex-shrink-0" />
                  <p className="text-sm font-medium">{error}</p>
                </div>
              )}
              
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div className="space-y-3">
                  <Label htmlFor="fullName" className="text-gray-200 font-medium">Full Name</Label>
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-yellow-400 transition-colors" />
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="Enter your full name"
                      className="pl-12 h-12 bg-gray-900 border-gray-600 text-white placeholder:text-gray-500 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 rounded-md transition-all"
                      {...register('fullName', { required: 'Full name is required' })}
                    />
                  </div>
                  {errors.fullName && (
                    <p className="text-red-400 text-sm font-medium flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" />
                      {errors.fullName.message}
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                  <Label htmlFor="username" className="text-gray-200 font-medium">Username</Label>
                  <div className="relative group">
                    <AtSign className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-yellow-400 transition-colors" />
                    <Input
                      id="username"
                      type="text"
                      placeholder="Choose a username"
                      className={`pl-12 pr-12 h-12 bg-gray-900 border-gray-600 text-white placeholder:text-gray-500 focus:ring-2 focus:ring-yellow-400/20 rounded-md transition-all ${
                        usernameStatus === 'available'
                          ? 'border-green-500 focus:border-green-500'
                          : usernameStatus === 'taken'
                          ? 'border-red-500 focus:border-red-500'
                          : 'focus:border-yellow-400'
                      }`}
                      {...register('username', {
                        required: 'Username is required',
                        minLength: {
                          value: 3,
                          message: 'Username must be at least 3 characters'
                        },
                        pattern: {
                          value: /^[a-zA-Z0-9_]+$/,
                          message: 'Username can only contain letters, numbers, and underscores'
                        }
                      })}
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      {usernameStatus === 'checking' && (
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-400 border-t-transparent" />
                      )}
                      {usernameStatus === 'available' && (
                        <Check className="h-4 w-4 text-green-500" />
                      )}
                      {usernameStatus === 'taken' && (
                        <X className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                  </div>
                  {errors.username && (
                    <p className="text-red-400 text-sm font-medium flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" />
                      {errors.username.message}
                    </p>
                  )}
                  {usernameStatus === 'taken' && (
                    <p className="text-red-400 text-sm font-medium flex items-center gap-1">
                      <X className="h-4 w-4" />
                      This username is already taken
                    </p>
                  )}
                  {usernameStatus === 'available' && (
                    <p className="text-green-400 text-sm font-medium flex items-center gap-1">
                      <Check className="h-4 w-4" />
                      Username is available
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                  <Label htmlFor="email" className="text-gray-200 font-medium">Email Address</Label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-yellow-400 transition-colors" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email address"
                      className="pl-12 h-12 bg-gray-900 border-gray-600 text-white placeholder:text-gray-500 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 rounded-md transition-all"
                      {...register('email', { 
                        required: 'Email is required',
                        pattern: {
                          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                          message: "Invalid email address"
                        }
                      })}
                    />
                  </div>
                  {errors.email && (
                    <p className="text-red-400 text-sm font-medium flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" />
                      {errors.email.message}
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                  <Label htmlFor="role" className="text-gray-200 font-medium">Account Type</Label>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="relative">
                      <input
                        id="role-user"
                        type="radio"
                        value={UserRole.USER}
                        {...register('role', { required: 'Please select an account type' })}
                        className="peer sr-only"
                      />
                      <label
                        htmlFor="role-user"
                        className="flex items-center p-4 bg-gray-800/50 border border-gray-600 rounded-lg cursor-pointer transition-all hover:bg-gray-700/50 peer-checked:border-yellow-400 peer-checked:bg-yellow-400/10"
                      >
                        <Users className="h-5 w-5 text-gray-400 mr-3" />
                        <div>
                          <div className="font-medium text-white">Regular User</div>
                          <div className="text-sm text-gray-400">Submit and track your own tasks</div>
                        </div>
                      </label>
                    </div>

                    <div className="relative">
                      <input
                        id="role-manager"
                        type="radio"
                        value={UserRole.MANAGER}
                        {...register('role', { required: 'Please select an account type' })}
                        className="peer sr-only"
                      />
                      <label
                        htmlFor="role-manager"
                        className="flex items-center p-4 bg-gray-800/50 border border-gray-600 rounded-lg cursor-pointer transition-all hover:bg-gray-700/50 peer-checked:border-yellow-400 peer-checked:bg-yellow-400/10"
                      >
                        <UserCog className="h-5 w-5 text-gray-400 mr-3" />
                        <div>
                          <div className="font-medium text-white">Manager</div>
                          <div className="text-sm text-gray-400">Oversee team tasks and track progress</div>
                        </div>
                      </label>
                    </div>

                    <div className="relative">
                      <input
                        id="role-admin"
                        type="radio"
                        value={UserRole.ADMIN}
                        {...register('role', { required: 'Please select an account type' })}
                        className="peer sr-only"
                      />
                      <label
                        htmlFor="role-admin"
                        className="flex items-center p-4 bg-gray-800/50 border border-gray-600 rounded-lg cursor-pointer transition-all hover:bg-gray-700/50 peer-checked:border-yellow-400 peer-checked:bg-yellow-400/10"
                      >
                        <Crown className="h-5 w-5 text-gray-400 mr-3" />
                        <div>
                          <div className="font-medium text-white">Administrator</div>
                          <div className="text-sm text-gray-400">Full system access and control</div>
                        </div>
                      </label>
                    </div>
                  </div>
                  {errors.role && (
                    <p className="text-red-400 text-sm font-medium flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" />
                      {errors.role.message}
                    </p>
                  )}
                </div>

                {/* Feature Badges */}
                <div className="flex items-center justify-center gap-3 py-2">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/50 rounded-full">
                    <span className="text-xs text-yellow-400">⚡</span>
                    <span className="text-xs text-slate-300">Real-time</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/50 rounded-full">
                    <span className="text-xs text-blue-400">📊</span>
                    <span className="text-xs text-slate-300">Analytics</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/50 rounded-full">
                    <span className="text-xs text-green-400">🔒</span>
                    <span className="text-xs text-slate-300">Secure</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="password" className="text-gray-200 font-medium">Password</Label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-yellow-400 transition-colors" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Create a strong password"
                      className="pl-12 pr-12 h-12 bg-gray-900 border-gray-600 text-white placeholder:text-gray-500 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 rounded-md transition-all"
                      {...register('password', { 
                        required: 'Password is required',
                        minLength: {
                          value: 6,
                          message: 'Password must be at least 6 characters'
                        }
                      })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 text-gray-400 hover:text-yellow-400 hover:bg-gray-700 rounded-md transition-all"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {errors.password && (
                    <p className="text-red-400 text-sm font-medium flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" />
                      {errors.password.message}
                    </p>
                  )}
                </div>

                <div className="flex items-start space-x-3 pt-2">
                  <input 
                    type="checkbox" 
                    id="terms"
                    className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-yellow-500 focus:ring-2 focus:ring-yellow-400/20 focus:ring-offset-0 transition-all mt-1" 
                    required 
                  />
                  <label htmlFor="terms" className="text-sm text-gray-300 leading-relaxed cursor-pointer hover:text-gray-200 transition-colors">
                    I agree to the{' '}
                    <Link href="/terms" className="text-yellow-400 hover:text-yellow-300 font-medium hover:underline transition-all">
                      Terms of Service
                    </Link>{' '}
                    and{' '}
                    <Link href="/privacy" className="text-yellow-400 hover:text-yellow-300 font-medium hover:underline transition-all">
                      Privacy Policy
                    </Link>
                  </label>
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-12 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold rounded-md shadow-lg transition-all duration-200"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-black border-t-transparent" />
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <span>Create Account</span>
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  )}
                </Button>
              </form>

              <div className="text-center pt-4">
                <p className="text-sm text-gray-400">
                  Already have an account?{' '}
                  <Link 
                    href="/auth/login" 
                    className="text-yellow-400 hover:text-yellow-300 font-semibold hover:underline transition-all"
                  >
                    Sign In
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Right Side - Static Content */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-gray-800 via-gray-900 to-black">
        <div className="flex items-center justify-center w-full p-12">
          <div className="max-w-lg space-y-8">
            {/* Heading */}
            <div className="space-y-4">
              <h2 className="text-5xl font-bold text-white leading-tight">
                KarmaYogi
              </h2>
              <p className="text-xl text-yellow-400 font-semibold">
                Distributed Task Queue Management
              </p>
            </div>

            {/* Description */}
            <p className="text-lg text-gray-300 leading-relaxed">
              Join thousands of teams managing their workflows efficiently with our powerful
              distributed task queue platform. Scale your operations with confidence.
            </p>

            {/* Features List */}
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-400/20 flex items-center justify-center mt-1">
                  <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                </div>
                <div>
                  <h3 className="text-white font-semibold">Scalable Task Processing</h3>
                  <p className="text-gray-400 text-sm">Handle millions of tasks with ease</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-400/20 flex items-center justify-center mt-1">
                  <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                </div>
                <div>
                  <h3 className="text-white font-semibold">Real-time Monitoring</h3>
                  <p className="text-gray-400 text-sm">Track your tasks in real-time with advanced analytics</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-400/20 flex items-center justify-center mt-1">
                  <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                </div>
                <div>
                  <h3 className="text-white font-semibold">Enterprise Security</h3>
                  <p className="text-gray-400 text-sm">Bank-level security for your critical operations</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}