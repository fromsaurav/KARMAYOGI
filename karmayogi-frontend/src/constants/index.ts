import { JobType } from '@/types';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000/ws';

export const JOB_TYPE_LABELS = {
  [JobType.FILE_PROCESSING]: 'File Processing',
  [JobType.DATA_ANALYTICS]: 'Data Analytics',
  [JobType.EMAIL_TASK]: 'Email Task',
  [JobType.API_INTEGRATION]: 'API Integration',
  [JobType.CUSTOM_SCRIPT]: 'Custom Script'
};

export const JOB_TYPE_DESCRIPTIONS = {
  [JobType.FILE_PROCESSING]: 'Process, compress, or convert files',
  [JobType.DATA_ANALYTICS]: 'Analyze data and generate insights',
  [JobType.EMAIL_TASK]: 'Send emails and notifications',
  [JobType.API_INTEGRATION]: 'Integrate with external APIs',
  [JobType.CUSTOM_SCRIPT]: 'Execute custom JavaScript code'
};

export const NAVIGATION_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: 'BarChart3' },
  { label: 'Submit Job', href: '/jobs/submit', icon: 'Plus' },
  { label: 'Job History', href: '/jobs', icon: 'History' },
  { label: 'Analytics', href: '/analytics', icon: 'TrendingUp' },
  { label: 'System Health', href: '/health', icon: 'Activity' },
  { label: 'Settings', href: '/settings', icon: 'Settings' }
];

export const REFRESH_INTERVALS = {
  DASHBOARD: 5000,
  JOB_LIST: 3000,
  HEALTH: 10000
};