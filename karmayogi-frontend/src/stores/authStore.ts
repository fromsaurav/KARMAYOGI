import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient } from '@/lib/api';
import { UserRole } from '@/types';

interface User {
  id: string;
  fullName: string;
  username: string;
  email: string;
  profilePic: string;
  role: UserRole;
}

interface SignupData {
  fullName: string;
  username: string;
  email: string;
  password: string;
  role: UserRole;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isHydrated: boolean;

  // Simplified auth methods (following Chatty pattern)
  signup: (data: SignupData) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<User | null>;
  setUser: (user: User) => void;
  initialize: () => Promise<void>;
  setHydrated: () => void;

  // Role-based helpers
  isUser: () => boolean;
  isManager: () => boolean;
  isAdmin: () => boolean;
  hasRole: (role: UserRole) => boolean;
  canAccessAnalytics: () => boolean;
  canSubmitJobs: () => boolean;
  getDashboardRoute: () => string;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      isHydrated: false,

      signup: async (data: SignupData) => {
        try {
          set({ isLoading: true });
          const response = await apiClient.signup(data);
          
          set({
            user: response.user,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      login: async (email: string, password: string) => {
        try {
          set({ isLoading: true });
          const response = await apiClient.login(email, password);
          
          set({
            user: response.user,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        try {
          await apiClient.logout();
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          set({
            user: null,
            isAuthenticated: false,
          });
        }
      },

      checkAuth: async () => {
        try {
          const response = await apiClient.checkAuth();
          const user = response.user;
          
          set({
            user,
            isAuthenticated: true,
          });
          
          return user;
        } catch (error) {
          set({
            user: null,
            isAuthenticated: false,
          });
          return null;
        }
      },

      setUser: (user: User) => {
        set({ user, isAuthenticated: true });
      },

      initialize: async () => {
        try {
          const user = await get().checkAuth();
          if (user) {
            set({
              user,
              isAuthenticated: true,
            });
          }
        } catch (error) {
          console.error('Auth initialization failed:', error);
          set({
            user: null,
            isAuthenticated: false,
          });
        }
      },

      setHydrated: () => {
        set({ isHydrated: true });
      },

      // Role-based helpers
      isUser: () => {
        const { user } = get();
        return user?.role === UserRole.USER;
      },

      isManager: () => {
        const { user } = get();
        return user?.role === UserRole.MANAGER;
      },

      isAdmin: () => {
        const { user } = get();
        return user?.role === UserRole.ADMIN;
      },

      hasRole: (role: UserRole) => {
        const { user } = get();
        return user?.role === role;
      },

      canAccessAnalytics: () => {
        const { user } = get();
        return user?.role === UserRole.MANAGER || user?.role === UserRole.ADMIN;
      },

      canSubmitJobs: () => {
        const { user } = get();
        return user?.role === UserRole.USER || user?.role === UserRole.MANAGER || user?.role === UserRole.ADMIN;
      },

      getDashboardRoute: () => {
        const { user } = get();
        if (!user) return '/dashboard';

        switch (user.role) {
          case UserRole.ADMIN:
            return '/dashboard/admin';
          case UserRole.MANAGER:
            return '/dashboard/manager';
          case UserRole.USER:
          default:
            return '/dashboard/user';
        }
      },
    }),
    {
      name: 'karmayogi-auth',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    }
  )
);