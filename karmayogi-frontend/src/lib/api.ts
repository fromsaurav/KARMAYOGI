// Simple API client following Chatty pattern
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface User {
  id: string;
  fullName: string;
  username: string;
  email: string;
  profilePic: string;
}

interface SignupData {
  fullName: string;
  username: string;
  email: string;
  password: string;
}

interface AuthResponse {
  user: User;
}

interface SystemMetrics {
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

interface Job {
  id: string;
  type: string;
  data: Record<string, unknown>;
  status: 'pending' | 'active' | 'completed' | 'failed' | 'cancelled';
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

interface JobsResponse {
  jobs: Job[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

class ApiClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include', // Important for cookies
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage;
        
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorJson.error || `HTTP error! status: ${response.status}`;
        } catch {
          errorMessage = errorText || `HTTP error! status: ${response.status}`;
        }
        
        throw new Error(errorMessage);
      }

      return response.json();
    } catch (error) {
      if (error instanceof Error) {
        console.warn(`API Error for ${endpoint}:`, error.message);
      }
      throw error;
    }
  }

  // Simple Authentication (following Chatty pattern)
  async signup(data: SignupData): Promise<AuthResponse> {
    return this.request<AuthResponse>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    return this.request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async logout(): Promise<void> {
    return this.request<void>('/api/auth/logout', {
      method: 'POST',
    });
  }

  async checkAuth(): Promise<AuthResponse> {
    return this.request<AuthResponse>('/api/auth/check');
  }

  // Job management methods
  async getJobs(page: number = 1, limit: number = 10): Promise<JobsResponse> {
    const offset = (page - 1) * limit;
    const response = await this.request<{
      success: boolean;
      data: {
        jobs: Job[];
        pagination: {
          total: number;
          limit: number;
          offset: number;
          pages: number;
        };
      };
    }>(`/api/jobs?limit=${limit}&offset=${offset}`);

    // Transform backend response to frontend format
    return {
      jobs: response.data.jobs,
      total: response.data.pagination.total,
      page: page,
      limit: limit,
      totalPages: response.data.pagination.pages
    };
  }

  async getJob(jobId: string): Promise<Job> {
    const response = await this.request<{
      success: boolean;
      data: {
        job: Job;
      };
    }>(`/api/jobs/${jobId}`);

    return response.data.job;
  }

  async createJob(jobData: { type: string; data: Record<string, unknown>; priority?: number }): Promise<Job> {
    // Transform data to match backend schema
    const backendJobData = {
      type: jobData.type,
      payload: jobData.data,  // Backend expects 'payload', not 'data'
      priority: jobData.priority === 1 ? 'HIGH' : jobData.priority === 2 ? 'MEDIUM' : 'LOW'  // Convert number to string
    };

    return this.request<Job>('/api/jobs', {
      method: 'POST',
      body: JSON.stringify(backendJobData),
    });
  }

  async cancelJob(jobId: string): Promise<void> {
    return this.request<void>(`/api/jobs/${jobId}/cancel`, {
      method: 'POST',
    });
  }

  // Metrics and analytics methods
  async getMetrics(): Promise<SystemMetrics> {
    return this.request<SystemMetrics>('/api/jobs/metrics');
  }

  async getHealth(): Promise<{ status: string; timestamp: string; uptime: number; version: string }> {
    return this.request<{ status: string; timestamp: string; uptime: number; version: string }>('/health');
  }

  // Username availability check
  async checkUsernameAvailability(username: string): Promise<boolean> {
    try {
      const response = await this.request<{ available: boolean }>(`/api/auth/check-username?username=${encodeURIComponent(username)}`);
      return response.available;
    } catch (error) {
      console.error('Username availability check failed:', error);
      // Graceful degradation: if we can't check availability, assume it's available
      // The backend will still validate during actual signup
      throw error; // Let the calling code handle the error
    }
  }

  // Alias for createJob to match frontend expectations
  async submitJob(jobData: {
    type: string;
    priority: number | string;
    data: any;
  }): Promise<Job> {
    // Convert priority to backend format
    let backendPriority: string;
    if (typeof jobData.priority === 'number') {
      // Frontend sends 1-10, map to LOW/MEDIUM/HIGH
      if (jobData.priority >= 7) {
        backendPriority = 'HIGH';
      } else if (jobData.priority >= 4) {
        backendPriority = 'MEDIUM';
      } else {
        backendPriority = 'LOW';
      }
    } else {
      // Already a string (high/medium/low)
      backendPriority = jobData.priority.toUpperCase();
    }

    // Backend expects 'payload', not 'data'
    const backendJobData = {
      type: jobData.type,
      payload: jobData.data,
      priority: backendPriority
    };

    const response = await this.request<{
      success: boolean;
      message: string;
      data: {
        job: Job;
      };
    }>('/api/jobs', {
      method: 'POST',
      body: JSON.stringify(backendJobData),
    });

    // Extract job from backend response
    return response.data.job;
  }

  // Analytics data method
  async getAnalyticsData(): Promise<{
    data: {
      avgResponseTime: number;
      throughput: number;
      successRate: number;
      errorRate: number;
      jobProcessingTrends: Array<{ time: string; value: number }>;
      responseTimeTrends: Array<{ time: string; value: number }>;
      jobTypeDistribution: Record<string, number>;
      workerUtilization: {
        total: number;
        active: number;
        idle: number;
      };
    };
  }> {
    return this.request<{
      data: {
        avgResponseTime: number;
        throughput: number;
        successRate: number;
        errorRate: number;
        jobProcessingTrends: Array<{ time: string; value: number }>;
        responseTimeTrends: Array<{ time: string; value: number }>;
        jobTypeDistribution: Record<string, number>;
        workerUtilization: {
          total: number;
          active: number;
          idle: number;
        };
      };
    }>('/api/analytics/data');
  }

  // Team management methods (for MANAGER and ADMIN roles)
  async getTeamData(): Promise<{
    members: Array<{
      id: string;
      name: string;
      email: string;
      role: string;
      activeJobs: number;
      completedJobs: number;
      successRate: number;
      lastActivity: string;
    }>;
    stats: {
      totalMembers: number;
      activeMembers: number;
      totalActiveJobs: number;
      avgSuccessRate: number;
    };
  }> {
    return this.request<{
      members: Array<{
        id: string;
        name: string;
        email: string;
        role: string;
        activeJobs: number;
        completedJobs: number;
        successRate: number;
        lastActivity: string;
      }>;
      stats: {
        totalMembers: number;
        activeMembers: number;
        totalActiveJobs: number;
        avgSuccessRate: number;
      };
    }>('/api/team');
  }

  async getTeamMember(memberId: string): Promise<{
    id: string;
    name: string;
    email: string;
    role: string;
    activeJobs: number;
    completedJobs: number;
    failedJobs: number;
    successRate: number;
    lastActivity: string;
    joinDate: string;
    recentJobs: Job[];
  }> {
    return this.request<{
      id: string;
      name: string;
      email: string;
      role: string;
      activeJobs: number;
      completedJobs: number;
      failedJobs: number;
      successRate: number;
      lastActivity: string;
      joinDate: string;
      recentJobs: Job[];
    }>(`/api/team/member/${memberId}`);
  }

  async assignJobToTeamMember(memberId: string, jobData: {
    type: string;
    data: Record<string, unknown>;
    priority: number;
    description?: string;
  }): Promise<Job> {
    return this.request<Job>(`/api/team/member/${memberId}/assign`, {
      method: 'POST',
      body: JSON.stringify(jobData),
    });
  }

  // System health for ADMIN (role-protected on backend)
  async getSystemHealth(): Promise<{
    overall: 'healthy' | 'degraded' | 'down';
    services: Array<{
      name: string;
      status: 'up' | 'down' | 'degraded';
      responseTime: number;
      lastCheck: string;
    }>;
    uptime: number;
    version: string;
    alerts: Array<{
      id: string;
      type: 'warning' | 'error' | 'info';
      message: string;
      timestamp: string;
    }>;
  }> {
    return this.request<{
      overall: 'healthy' | 'degraded' | 'down';
      services: Array<{
        name: string;
        status: 'up' | 'down' | 'degraded';
        responseTime: number;
        lastCheck: string;
      }>;
      uptime: number;
      version: string;
      alerts: Array<{
        id: string;
        type: 'warning' | 'error' | 'info';
        message: string;
        timestamp: string;
      }>;
    }>('/api/health/system');
  }

  // User management for ADMIN (role-protected on backend)
  async getAllUsers(): Promise<{
    users: Array<{
      id: string;
      fullName: string;
      username: string;
      email: string;
      role: string;
      isActive: boolean;
      createdAt: string;
      lastLogin?: string;
      jobCount: number;
    }>;
    total: number;
    page: number;
    limit: number;
  }> {
    return this.request<{
      users: Array<{
        id: string;
        fullName: string;
        username: string;
        email: string;
        role: string;
        isActive: boolean;
        createdAt: string;
        lastLogin?: string;
        jobCount: number;
      }>;
      total: number;
      page: number;
      limit: number;
    }>('/api/admin/users');
  }

  async updateUserRole(userId: string, newRole: string): Promise<void> {
    return this.request<void>(`/api/admin/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role: newRole }),
    });
  }

  async deactivateUser(userId: string): Promise<void> {
    return this.request<void>(`/api/admin/users/${userId}/deactivate`, {
      method: 'POST',
    });
  }

  async activateUser(userId: string): Promise<void> {
    return this.request<void>(`/api/admin/users/${userId}/activate`, {
      method: 'POST',
    });
  }

  // Helper method to handle permissions gracefully
  async safeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    fallback: T
  ): Promise<T> {
    try {
      return await this.request<T>(endpoint, options);
    } catch (error) {
      // If it's a 403 Forbidden error, return fallback data
      if (error instanceof Error && error.message.includes('403')) {
        console.warn(`Access denied to ${endpoint}. Using fallback data.`);
        return fallback;
      }
      throw error;
    }
  }

  // Additional job management methods for compatibility
  async getJobHistory(): Promise<JobsResponse> {
    return this.getJobs();
  }

  async getJobDetails(jobId: string): Promise<Job> {
    return this.getJob(jobId);
  }

  // Template management methods (Phase 4)
  async getTemplates(params?: {
    search?: string;
    jobType?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    success: boolean;
    data: Array<{
      id: string;
      name: string;
      description?: string;
      jobType: string;
      priority: string;
      config: any;
      tags: string[];
      isPublic: boolean;
      usageCount: number;
      isFavorite: boolean;
      user: {
        id: string;
        fullName: string;
        email: string;
      };
      createdAt: string;
      updatedAt: string;
    }>;
    count: number;
  }> {
    const queryParams = new URLSearchParams();
    if (params?.search) queryParams.append('search', params.search);
    if (params?.jobType) queryParams.append('jobType', params.jobType);
    if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder);

    const queryString = queryParams.toString();
    const url = `/api/templates${queryString ? `?${queryString}` : ''}`;

    return this.request(url);
  }

  async getTemplate(templateId: string): Promise<{
    success: boolean;
    data: any;
  }> {
    return this.request(`/api/templates/${templateId}`);
  }

  async createTemplate(templateData: {
    name: string;
    description?: string;
    jobType: string;
    priority?: string;
    config: any;
    tags?: string[];
    isPublic?: boolean;
  }): Promise<{
    success: boolean;
    data: any;
  }> {
    return this.request('/api/templates', {
      method: 'POST',
      body: JSON.stringify(templateData)
    });
  }

  async updateTemplate(templateId: string, templateData: {
    name?: string;
    description?: string;
    jobType?: string;
    priority?: string;
    config?: any;
    tags?: string[];
    isPublic?: boolean;
  }): Promise<{
    success: boolean;
    data: any;
  }> {
    return this.request(`/api/templates/${templateId}`, {
      method: 'PUT',
      body: JSON.stringify(templateData)
    });
  }

  async deleteTemplate(templateId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    return this.request(`/api/templates/${templateId}`, {
      method: 'DELETE'
    });
  }

  async addTemplateToFavorites(templateId: string): Promise<{
    success: boolean;
    data: any;
  }> {
    return this.request(`/api/templates/${templateId}/favorite`, {
      method: 'POST'
    });
  }

  async removeTemplateFromFavorites(templateId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    return this.request(`/api/templates/${templateId}/favorite`, {
      method: 'DELETE'
    });
  }

  async createJobFromTemplate(templateId: string, customPayload?: any): Promise<{
    success: boolean;
    data: Job;
  }> {
    return this.request(`/api/templates/${templateId}/use`, {
      method: 'POST',
      body: JSON.stringify({ customPayload })
    });
  }

  async getFavoriteTemplates(): Promise<{
    success: boolean;
    data: any[];
    count: number;
  }> {
    return this.request('/api/templates/favorites');
  }
}

export const apiClient = new ApiClient(API_BASE_URL);