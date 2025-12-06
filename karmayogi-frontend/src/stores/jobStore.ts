import { create } from 'zustand';
import { Job, JobSubmissionData } from '@/types';
import { apiClient } from '@/lib/api';

interface JobState {
  jobs: Job[];
  currentJob: Job | null;
  isLoading: boolean;
  totalJobs: number;
  
  // Actions
  fetchJobs: (page?: number, limit?: number) => Promise<void>;
  fetchJob: (id: string) => Promise<void>;
  submitJob: (jobData: JobSubmissionData) => Promise<Job>;
  cancelJob: (id: string) => Promise<void>;
  updateJob: (job: Job) => void;
  setCurrentJob: (job: Job | null) => void;
  reset: () => void;
}

export const useJobStore = create<JobState>((set, get) => ({
  jobs: [],
  currentJob: null,
  isLoading: false,
  totalJobs: 0,

  fetchJobs: async (page = 1, limit = 20) => {
    try {
      set({ isLoading: true });
      const response = await apiClient.getJobs(page, limit);
      
      set({
        jobs: response.jobs,
        totalJobs: response.total,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  fetchJob: async (id: string) => {
    try {
      set({ isLoading: true });
      const job = await apiClient.getJob(id);
      
      set({
        currentJob: job,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  submitJob: async (jobData: JobSubmissionData): Promise<Job> => {
    try {
      set({ isLoading: true });
      const job = await apiClient.submitJob(jobData);
      
      const { jobs } = get();
      set({
        jobs: [job, ...jobs],
        isLoading: false,
      });
      
      return job;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  cancelJob: async (id: string) => {
    try {
      await apiClient.cancelJob(id);
      
      const { jobs } = get();
      set({
        jobs: jobs.map(job => 
          job.id === id 
            ? { ...job, status: 'cancelled' as any }
            : job
        ),
      });
    } catch (error) {
      throw error;
    }
  },

  updateJob: (updatedJob: Job) => {
    const { jobs } = get();
    set({
      jobs: jobs.map(job => 
        job.id === updatedJob.id ? updatedJob : job
      ),
      currentJob: get().currentJob?.id === updatedJob.id ? updatedJob : get().currentJob,
    });
  },

  setCurrentJob: (job: Job | null) => {
    set({ currentJob: job });
  },

  reset: () => {
    set({
      jobs: [],
      currentJob: null,
      isLoading: false,
      totalJobs: 0,
    });
  },
}));