import { Job, JobType, JobStatus, User } from '@/types';

// Mock users
export const mockUsers: User[] = [
  {
    id: 'user-1',
    email: 'john.doe@company.com',
    name: 'John Doe',
    username: 'johndoe',
    createdAt: '2024-01-15T08:30:00Z'
  },
  {
    id: 'user-2',
    email: 'sarah.smith@company.com',
    name: 'Sarah Smith',
    username: 'sarahsmith',
    createdAt: '2024-02-20T10:15:00Z'
  },
  {
    id: 'dev-user-id',
    email: 'dev@example.com',
    name: 'Development User',
    username: 'devuser',
    createdAt: new Date().toISOString()
  }
];

// Mock jobs with realistic data
export const mockJobs: Job[] = [
  {
    id: 'job-1',
    type: JobType.FILE_PROCESSING,
    data: { fileName: 'customer_data_export.csv', size: '2.3MB' },
    status: JobStatus.COMPLETED,
    priority: 1,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    updatedAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString(),
    completedAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString(),
    progress: 100,
    result: { processedRows: 12847, outputFile: 'processed_customer_data.csv' },
    userId: 'user-1'
  },
  {
    id: 'job-2',
    type: JobType.DATA_ANALYTICS,
    data: { dataset: 'sales_q4_2024', analysisType: 'trend_analysis' },
    status: JobStatus.ACTIVE,
    priority: 2,
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 mins ago
    updatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    progress: 67,
    userId: 'user-2'
  },
  {
    id: 'job-3',
    type: JobType.EMAIL_CAMPAIGN,
    data: { campaign: 'Monthly Newsletter', recipients: 15420 },
    status: JobStatus.COMPLETED,
    priority: 3,
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
    updatedAt: new Date(Date.now() - 3.5 * 60 * 60 * 1000).toISOString(),
    completedAt: new Date(Date.now() - 3.5 * 60 * 60 * 1000).toISOString(),
    progress: 100,
    result: { sent: 15420, delivered: 15301, opened: 8734, clicked: 2156 },
    userId: 'user-1'
  },
  {
    id: 'job-4',
    type: 'API_INTEGRATION' as JobType,
    data: { service: 'Salesforce CRM', operation: 'sync_contacts' },
    status: 'pending' as JobStatus,
    priority: 2,
    createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 mins ago
    updatedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    userId: 'user-2'
  },
  {
    id: 'job-5',
    type: 'CUSTOM_SCRIPT' as JobType,
    data: { script: 'backup_database.js', environment: 'production' },
    status: 'failed' as JobStatus,
    priority: 1,
    createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
    updatedAt: new Date(Date.now() - 5.5 * 60 * 60 * 1000).toISOString(),
    failedAt: new Date(Date.now() - 5.5 * 60 * 60 * 1000).toISOString(),
    error: 'Connection timeout: Unable to connect to database server',
    userId: 'user-1'
  },
  {
    id: 'job-6',
    type: 'FILE_PROCESSING' as JobType,
    data: { fileName: 'product_images.zip', size: '150MB', operation: 'resize_optimize' },
    status: JobStatus.ACTIVE,
    priority: 3,
    createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(), // 45 mins ago
    updatedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    progress: 23,
    userId: 'dev-user-id'
  },
  {
    id: 'job-7',
    type: JobType.DATA_ANALYTICS,
    data: { dataset: 'user_behavior_logs', analysisType: 'funnel_analysis' },
    status: JobStatus.COMPLETED,
    priority: 2,
    createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(), // 8 hours ago
    updatedAt: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(),
    completedAt: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(),
    progress: 100,
    result: { insights: 'Conversion rate improved by 12%', charts: 3, recommendations: 5 },
    userId: 'user-2'
  }
];

// Mock system metrics with realistic values
export const mockSystemMetrics = {
  activeJobs: mockJobs.filter(j => j.status === 'active').length,
  completedJobs: mockJobs.filter(j => j.status === 'completed').length,
  failedJobs: mockJobs.filter(j => j.status === 'failed').length,
  queuedJobs: mockJobs.filter(j => j.status === 'pending').length,
  workers: {
    active: 4,
    idle: 2, 
    total: 6
  },
  performance: {
    avgResponseTime: 234,
    throughput: 147,
    errorRate: 2.1
  }
};

// Generate real-time updates for jobs
export const updateJobProgress = (jobs: Job[]): Job[] => {
  return jobs.map(job => {
    if (job.status === 'active' && job.progress !== undefined) {
      const increment = Math.random() * 5; // 0-5% progress increment
      const newProgress = Math.min(job.progress + increment, 100);
      
      return {
        ...job,
        progress: Math.round(newProgress),
        updatedAt: new Date().toISOString(),
        ...(newProgress >= 100 && {
          status: JobStatus.COMPLETED,
          completedAt: new Date().toISOString(),
          result: generateMockResult(job.type)
        })
      };
    }
    return job;
  });
};

// Generate mock results based on job type
const generateMockResult = (type: JobType) => {
  switch (type) {
    case JobType.FILE_PROCESSING:
      return { processedFiles: Math.floor(Math.random() * 100) + 50, outputSize: '1.2MB' };
    case JobType.DATA_ANALYTICS:
      return { insights: Math.floor(Math.random() * 10) + 5, accuracy: '94.2%' };
    case JobType.EMAIL_CAMPAIGN:
      return { sent: Math.floor(Math.random() * 1000) + 500, opened: Math.floor(Math.random() * 300) + 200 };
    case JobType.API_INTEGRATION:
      return { recordsSynced: Math.floor(Math.random() * 500) + 200, errors: 0 };
    case JobType.CUSTOM_SCRIPT:
      return { executionTime: `${Math.floor(Math.random() * 60) + 10}s`, status: 'success' };
    default:
      return { status: 'completed' };
  }
};

// Mock recent activity for dashboard
export const mockRecentActivity = [
  {
    id: 'activity-1',
    type: 'job_completed',
    message: 'File processing job completed successfully',
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    user: 'John Doe',
    jobId: 'job-1'
  },
  {
    id: 'activity-2', 
    type: 'job_started',
    message: 'Data analytics job started processing',
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    user: 'Sarah Smith',
    jobId: 'job-2'
  },
  {
    id: 'activity-3',
    type: 'user_login',
    message: 'User logged in from new device',
    timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    user: 'Development User'
  },
  {
    id: 'activity-4',
    type: 'job_failed',
    message: 'Database backup script failed',
    timestamp: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
    user: 'John Doe',
    jobId: 'job-5'
  }
];