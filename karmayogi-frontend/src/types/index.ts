export interface User {
  id: string;
  email: string;
  name?: string;
  username: string;
  role: UserRole;
  createdAt: string;
}

export interface Job {
  id: string;
  type: JobType;
  data: Record<string, unknown>;
  status: JobStatus;
  priority: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  failedAt?: string;
  error?: string;
  progress?: number;
  result?: Record<string, unknown>;
  userId: string;
}

export enum JobType {
  FILE_PROCESSING = 'FILE_PROCESSING',
  DATA_ANALYTICS = 'DATA_ANALYTICS',
  EMAIL_TASK = 'EMAIL_TASK',
  API_INTEGRATION = 'API_INTEGRATION',
  CUSTOM_SCRIPT = 'CUSTOM_SCRIPT'
}

export enum JobStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum UserRole {
  USER = 'USER',
  MANAGER = 'MANAGER',
  ADMIN = 'ADMIN'
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'down';
  services: {
    database: boolean;
    redis: boolean;
    workers: boolean;
  };
  timestamp: string;
}

export interface SystemMetrics {
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  queuedJobs: number;
  workers: {
    active: number;
    idle: number;
    total: number;
  };
  performance: {
    avgResponseTime: number;
    throughput: number;
    errorRate: number;
  };
}

export interface JobSubmissionData {
  type: JobType;
  data: Record<string, unknown>;
  priority?: number;
}

export interface AuthResponse {
  token: string;
  user: User;
  expiresIn: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  name?: string;
}

// Analytics interfaces
export interface AnalyticsData {
  totalJobs: number;
  jobsByType: Record<string, number>;
  jobsByStatus: Record<string, number>;
  dailyStats: Array<{
    date: string;
    completed: number;
    failed: number;
    total: number;
  }>;
  topUsers: Array<{
    userId: string;
    userName: string;
    jobCount: number;
  }>;
}

export interface PerformanceMetrics {
  avgExecutionTime: number;
  avgQueueTime: number;
  throughput: number;
  errorRate: number;
  successRate: number;
  peakHours: Array<{
    hour: number;
    jobCount: number;
  }>;
  memoryUsage: {
    current: number;
    peak: number;
    average: number;
  };
  cpuUsage: {
    current: number;
    peak: number;
    average: number;
  };
}

export interface WorkerAnalytics {
  totalWorkers: number;
  activeWorkers: number;
  idleWorkers: number;
  workers: Array<{
    id: string;
    status: 'active' | 'idle' | 'busy';
    currentJob?: string;
    completedJobs: number;
    uptime: number;
  }>;
  workloadDistribution: Record<string, number>;
}

export interface SystemHealthStatus {
  overall: 'healthy' | 'degraded' | 'down';
  services: Array<{
    name: string;
    status: 'up' | 'down' | 'degraded';
    responseTime: number;
    lastCheck: string;
  }>;
  uptime: number;
  version: string;
}

export interface ServiceHealth {
  name: string;
  status: 'up' | 'down' | 'degraded';
  responseTime: number;
  lastCheck: string;
  details: Record<string, unknown>;
}