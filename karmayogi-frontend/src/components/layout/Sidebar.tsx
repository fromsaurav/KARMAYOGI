'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  BarChart3,
  Plus,
  History,
  TrendingUp,
  Activity,
  Settings,
  Users,
  Shield,
  UserCog
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types';

// Define navigation items by role
const getNavigationItems = (userRole: UserRole) => {
  // Role-specific dashboard routes
  const dashboardRoute = userRole === UserRole.ADMIN ? '/dashboard/admin'
    : userRole === UserRole.MANAGER ? '/dashboard/manager'
    : '/dashboard/user';

  const allNavigationItems = [
    // Role-specific dashboard
    { label: 'Dashboard', href: dashboardRoute, icon: BarChart3, roles: [UserRole.USER, UserRole.MANAGER, UserRole.ADMIN] },

    // Job management - available to all roles
    { label: 'Submit Job', href: '/jobs/submit', icon: Plus, roles: [UserRole.USER, UserRole.MANAGER, UserRole.ADMIN] },
    { label: 'My Jobs', href: '/jobs', icon: History, roles: [UserRole.USER, UserRole.MANAGER, UserRole.ADMIN] },

    // Manager-specific features
    { label: 'Team Analytics', href: '/analytics', icon: TrendingUp, roles: [UserRole.MANAGER, UserRole.ADMIN] },
    { label: 'Team Management', href: '/team', icon: Users, roles: [UserRole.MANAGER, UserRole.ADMIN] },

    // Admin-specific features
    { label: 'System Health', href: '/health', icon: Activity, roles: [UserRole.ADMIN] },
    { label: 'User Management', href: '/admin/users', icon: UserCog, roles: [UserRole.ADMIN] },

    // Settings available to all
    { label: 'Settings', href: '/settings', icon: Settings, roles: [UserRole.USER, UserRole.MANAGER, UserRole.ADMIN] }
  ];

  // Filter navigation items based on user role
  return allNavigationItems.filter(item => item.roles.includes(userRole));
};

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuthStore();

  if (!user) return null;

  const navigationItems = getNavigationItems(user.role);

  return (
    <div className="bg-slate-800 border-r border-slate-700 min-h-screen w-64">
      <div className="p-6">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-slate-700 border border-slate-600 rounded-xl mb-4 shadow-lg">
          <div className="text-xl font-bold text-yellow-400">KY</div>
        </div>
        <div className="text-xl font-bold text-yellow-500">KarmaYogi</div>
      </div>

      <nav className="px-4 space-y-2">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant="ghost"
                className={`w-full justify-start ${
                  isActive
                    ? 'bg-yellow-500 text-slate-900 hover:bg-yellow-600 font-medium'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-slate-100'
                }`}
              >
                <Icon className="mr-3 h-5 w-5" />
                {item.label}
              </Button>
            </Link>
          );
        })}
      </nav>

    </div>
  );
}