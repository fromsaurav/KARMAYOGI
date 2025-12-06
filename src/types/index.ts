// Simplified types for Karmayogi authentication system
import { JobType, JobStatus, JobPriority, LogLevel, UserRole } from '@prisma/client';

export { JobType, JobStatus, JobPriority, LogLevel, UserRole };

export interface JobData {
  id: string;
  jobId: string;
  userId: string;
  type: JobType;
  payload: any;
  priority: JobPriority;
  maxRetries: number;
  currentRetry: number;
  delay?: number;
  metadata?: Record<string, any>;
}

export interface AuthTokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface User {
  id: string;
  fullName: string;
  email: string;
  profilePic: string;
  role: UserRole;
  isActive: boolean;
  managerId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Authenticated user type (what req.user contains after auth middleware)
export interface AuthenticatedUser {
  id: string;
  userId: string;       // Add for backward compatibility
  fullName: string;
  email: string;
  profilePic: string;
  role: UserRole;       // Provide default role
}