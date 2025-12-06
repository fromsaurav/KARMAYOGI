'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { User, Settings, LogOut, ChevronDown, Shield, Users, Crown } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { UserRole } from '@/types';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
}

// Role Badge Component
function RoleBadge({ role }: { role?: UserRole }) {
  if (!role) return null;

  const roleConfig = {
    [UserRole.USER]: {
      label: 'User',
      icon: User,
      bgColor: 'bg-blue-500/20',
      textColor: 'text-blue-400',
      borderColor: 'border-blue-500/30'
    },
    [UserRole.MANAGER]: {
      label: 'Manager',
      icon: Shield,
      bgColor: 'bg-purple-500/20',
      textColor: 'text-purple-400',
      borderColor: 'border-purple-500/30'
    },
    [UserRole.ADMIN]: {
      label: 'Admin',
      icon: Crown,
      bgColor: 'bg-yellow-500/20',
      textColor: 'text-yellow-400',
      borderColor: 'border-yellow-500/30'
    }
  };

  const config = roleConfig[role];
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${config.bgColor} ${config.textColor} ${config.borderColor}`}>
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </span>
  );
}

export default function Header({ title, subtitle, children }: HeaderProps) {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get user display name
  const currentUser = user;
  const displayName = (currentUser as any)?.fullName || (currentUser as any)?.name || currentUser?.username || 'User';
  const avatarLetter = displayName.charAt(0).toUpperCase();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/auth/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const toggleDropdown = () => {
    setShowDropdown(!showDropdown);
  };

  return (
    <div className="flex justify-between items-center p-6 bg-slate-900 border-b border-slate-700">
      {/* Left side - Title or custom content */}
      <div className="flex-1">
        {title ? (
          <div>
            <h1 className="text-2xl font-bold text-slate-100">{title}</h1>
            {subtitle && <p className="text-slate-400">{subtitle}</p>}
          </div>
        ) : (
          children
        )}
      </div>

      {/* Right side - Profile dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={toggleDropdown}
          className="flex items-center space-x-3 p-2 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center text-slate-900 font-bold text-sm">
              {avatarLetter}
            </div>
            <div className="hidden md:block text-left">
              <div className="text-sm font-medium text-slate-100">{displayName}</div>
              <div className="text-xs text-slate-400">{currentUser?.username ? `@${currentUser.username}` : currentUser?.email || ''}</div>
            </div>
          </div>
          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown menu */}
        {showDropdown && (
          <div className="absolute right-0 top-full mt-2 w-64 bg-slate-800 rounded-xl shadow-lg border border-slate-700 py-2 z-50">
            {/* User info header */}
            <div className="px-4 py-3 border-b border-slate-700">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center text-slate-900 font-bold">
                  {avatarLetter}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-100 truncate">{displayName}</div>
                  <div className="text-sm text-slate-400 truncate">{currentUser?.email}</div>
                  <div className="flex items-center justify-between mt-1">
                    <div className="flex items-center">
                      <div className="h-2 w-2 bg-green-400 rounded-full mr-2"></div>
                      <span className="text-xs text-slate-400">Online</span>
                    </div>
                    <RoleBadge role={currentUser?.role} />
                  </div>
                </div>
              </div>
            </div>

            {/* Menu items */}
            <div className="py-2">
              <Link
                href="/profile"
                className="flex items-center px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-slate-100 transition-colors"
                onClick={() => setShowDropdown(false)}
              >
                <User className="h-4 w-4 mr-3" />
                Profile
              </Link>
              <Link
                href="/settings"
                className="flex items-center px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-slate-100 transition-colors"
                onClick={() => setShowDropdown(false)}
              >
                <Settings className="h-4 w-4 mr-3" />
                Settings
              </Link>
              <div className="border-t border-slate-700 my-2"></div>
              <button
                onClick={handleLogout}
                className="flex items-center w-full px-4 py-2 text-sm text-red-400 hover:bg-slate-700 hover:text-red-300 transition-colors"
              >
                <LogOut className="h-4 w-4 mr-3" />
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}