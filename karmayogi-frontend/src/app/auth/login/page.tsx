'use client';

import { useState } from 'react';
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
  AlertCircle
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

interface LoginFormData {
  email: string;
  password: string;
}

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  
  const { login, isLoading } = useAuthStore();
  const router = useRouter();
  
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>();

  const onSubmit = async (data: LoginFormData) => {
    try {
      setError('');
      await login(data.email, data.password);
      // Redirect to role-based dashboard
      const dashboardRoute = useAuthStore.getState().getDashboardRoute();
      router.push(dashboardRoute);
    } catch (error: unknown) {
      setError((error as Error).message || 'Login failed. Please try again.');
    }
  };



  return (
    <div className="min-h-screen bg-gray-900 flex relative">
      {/* Professional dark background */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-black"></div>
      
      {/* Left Side - Login Form */}
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
              <p className="text-lg text-gray-300">Welcome Back</p>
            </div>
          </div>

          {/* Login Form */}
          <Card className="bg-gray-800/50 backdrop-blur border border-gray-700 shadow-xl rounded-lg">
            <CardHeader className="space-y-1 pb-6">
              <CardTitle className="text-2xl font-bold text-center text-white">
                Sign In
              </CardTitle>
              <CardDescription className="text-gray-400 text-center">
                Enter your credentials to access your account
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
                  <Label htmlFor="password" className="text-gray-200 font-medium">Password</Label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-yellow-400 transition-colors" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      className="pl-12 pr-12 h-12 bg-gray-900 border-gray-600 text-white placeholder:text-gray-500 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 rounded-md transition-all"
                      {...register('password', { required: 'Password is required' })}
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

                <div className="flex items-center justify-between pt-2">
                  <label className="flex items-center space-x-3 text-sm text-gray-300 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-yellow-500 focus:ring-2 focus:ring-yellow-400/20 focus:ring-offset-0 transition-all" 
                    />
                    <span className="group-hover:text-gray-200 transition-colors">Remember me</span>
                  </label>
                  <Link 
                    href="/auth/forgot-password" 
                    className="text-sm text-yellow-400 hover:text-yellow-300 font-medium hover:underline transition-all"
                  >
                    Forgot password?
                  </Link>
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
                      <span>Sign In</span>
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  )}
                </Button>
              </form>

              <div className="text-center pt-4">
                <p className="text-sm text-gray-400">
                  Don&apos;t have an account?{' '}
                  <Link 
                    href="/auth/signup" 
                    className="text-yellow-400 hover:text-yellow-300 font-semibold hover:underline transition-all"
                  >
                    Create Account
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
                Enterprise Task Management
              </p>
            </div>

            {/* Description */}
            <p className="text-lg text-gray-300 leading-relaxed">
              Streamline your workflow with our powerful distributed task queue management platform.
              Built for scalability, reliability, and real-time monitoring.
            </p>

            {/* Features List */}
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-400/20 flex items-center justify-center mt-1">
                  <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                </div>
                <div>
                  <h3 className="text-white font-semibold">99.9% Uptime Guaranteed</h3>
                  <p className="text-gray-400 text-sm">Enterprise-grade reliability for mission-critical tasks</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-400/20 flex items-center justify-center mt-1">
                  <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                </div>
                <div>
                  <h3 className="text-white font-semibold">Advanced Analytics</h3>
                  <p className="text-gray-400 text-sm">Real-time insights and performance metrics</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-400/20 flex items-center justify-center mt-1">
                  <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                </div>
                <div>
                  <h3 className="text-white font-semibold">Email Notifications</h3>
                  <p className="text-gray-400 text-sm">Stay informed with automated alerts and updates</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}