'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Plus, 
  Activity,
  Search,
  Filter,
  Eye,
  Trash2,
  RefreshCw
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Job, JobStatus, JobType } from '@/types';
import { JOB_TYPE_LABELS } from '@/constants';
import { useJobStore } from '@/stores/jobStore';
import DashboardLayout from '@/components/layout/DashboardLayout';

interface JobRowProps {
  job: Job;
  onCancel: (id: string) => void;
  onView: (job: Job) => void;
}

function JobRow({ job, onCancel, onView }: JobRowProps) {
  const statusColors = {
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    active: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    completed: 'bg-green-500/20 text-green-400 border-green-500/30',
    failed: 'bg-red-500/20 text-red-400 border-red-500/30',
    cancelled: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  };

  const statusIcons: Record<string, React.ElementType> = {
    pending: Clock,
    active: Activity,
    completed: CheckCircle,
    failed: XCircle,
    cancelled: AlertCircle,
  };

  const StatusIcon = statusIcons[job.status] || AlertCircle;

  return (
    <tr className="hover:bg-slate-700/50 transition-colors">
      <td className="px-6 py-4">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-full ${statusColors[job.status] || 'bg-slate-500/20 text-slate-400'}`}>
            {StatusIcon && <StatusIcon className="h-4 w-4" />}
          </div>
          <div>
            <p className="font-medium text-slate-100">
              {JOB_TYPE_LABELS[job.type]}
            </p>
            <p className="text-sm text-slate-400">ID: {job.id.slice(0, 8)}</p>
          </div>
        </div>
      </td>

      <td className="px-6 py-4">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColors[job.status]}`}>
          <StatusIcon className="mr-1 h-3 w-3" />
          {job.status}
        </span>
        {job.progress && job.status === JobStatus.ACTIVE && (
          <div className="mt-2 w-full bg-slate-700 rounded-full h-1.5">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${job.progress}%` }}
            ></div>
          </div>
        )}
      </td>

      <td className="px-6 py-4 text-sm text-slate-300">
        {new Date(job.createdAt).toLocaleString()}
      </td>

      <td className="px-6 py-4 text-sm text-slate-300">
        {job.completedAt
          ? new Date(job.completedAt).toLocaleString()
          : job.failedAt
          ? new Date(job.failedAt).toLocaleString()
          : '-'
        }
      </td>

      <td className="px-6 py-4">
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onView(job)}
            className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-slate-100"
          >
            <Eye className="h-4 w-4" />
          </Button>

          {(job.status === JobStatus.PENDING || job.status === JobStatus.ACTIVE) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCancel(job.id)}
              className="border-red-500/50 text-red-400 hover:bg-red-500/20 hover:text-red-300"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function JobsPage() {
  const { jobs, isLoading, totalJobs, fetchJobs, cancelJob } = useJobStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<JobType | 'all'>('all');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  useEffect(() => {
    fetchJobs();
    
    const interval = setInterval(() => {
      fetchJobs();
    }, 5000);
    
    return () => clearInterval(interval);
  }, [fetchJobs]);

  const handleCancel = async (id: string) => {
    if (confirm('Are you sure you want to cancel this job?')) {
      try {
        await cancelJob(id);
      } catch (error) {
        console.error('Failed to cancel job:', error);
      }
    }
  };

  const handleView = (job: Job) => {
    setSelectedJob(job);
  };

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         JOB_TYPE_LABELS[job.type].toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
    const matchesType = typeFilter === 'all' || job.type === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-100">Job History</h1>
            <p className="text-slate-400 mt-1">
              Manage and monitor your job executions
            </p>
          </div>
          <Link href="/jobs/submit">
            <Button className="bg-yellow-500 hover:bg-yellow-600 text-slate-900 font-semibold">
              <Plus className="mr-2 h-4 w-4" />
              Submit Job
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="border-b border-slate-700">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-yellow-500" />
              <CardTitle className="text-lg text-slate-100">Filters</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search jobs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-slate-900 border-slate-600 text-slate-100 placeholder:text-slate-500 focus:ring-yellow-500 focus:border-yellow-500"
                  />
                </div>
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as JobStatus | 'all')}
                className="px-4 py-2 border-2 border-slate-600 rounded-lg bg-slate-900 text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent hover:border-slate-500 transition-all cursor-pointer"
              >
                <option value="all" className="bg-slate-900 text-slate-100">All Statuses</option>
                <option value={JobStatus.PENDING} className="bg-slate-900 text-slate-100">Pending</option>
                <option value={JobStatus.ACTIVE} className="bg-slate-900 text-slate-100">Active</option>
                <option value={JobStatus.COMPLETED} className="bg-slate-900 text-slate-100">Completed</option>
                <option value={JobStatus.FAILED} className="bg-slate-900 text-slate-100">Failed</option>
                <option value={JobStatus.CANCELLED} className="bg-slate-900 text-slate-100">Cancelled</option>
              </select>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as JobType | 'all')}
                className="px-4 py-2 border-2 border-slate-600 rounded-lg bg-slate-900 text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent hover:border-slate-500 transition-all cursor-pointer"
              >
                <option value="all" className="bg-slate-900 text-slate-100">All Types</option>
                {Object.values(JobType).map(type => (
                  <option key={type} value={type} className="bg-slate-900 text-slate-100">
                    {JOB_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>

              <Button
                variant="outline"
                onClick={() => fetchJobs()}
                disabled={isLoading}
                className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-slate-100"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Jobs Table */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="border-b border-slate-700">
            <CardTitle className="text-slate-100">Jobs ({filteredJobs.length})</CardTitle>
            <CardDescription className="text-slate-400">
              {totalJobs > jobs.length && `Showing ${jobs.length} of ${totalJobs} total jobs`}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading && jobs.length === 0 ? (
              <div className="flex justify-center py-8">
                <div className="text-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-yellow-500 border-t-transparent mx-auto mb-4"></div>
                  <p className="text-slate-400">Loading jobs...</p>
                </div>
              </div>
            ) : filteredJobs.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-slate-900">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Job
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Completed
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-slate-800 divide-y divide-slate-700">
                    {filteredJobs.map((job) => (
                      <JobRow
                        key={job.id}
                        job={job}
                        onCancel={handleCancel}
                        onView={handleView}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">
                <AlertCircle className="h-12 w-12 mx-auto mb-4 text-slate-600" />
                <p>No jobs found</p>
                <Link href="/jobs/submit">
                  <Button variant="outline" className="mt-2 border-slate-600 text-slate-300 hover:bg-slate-700">
                    Submit Your First Job
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Job Detail Modal */}
        {selectedJob && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
            <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto bg-slate-800 border-slate-700">
              <CardHeader className="border-b border-slate-700">
                <CardTitle className="flex items-center justify-between text-slate-100">
                  Job Details
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedJob(null)}
                    className="text-slate-400 hover:text-slate-100 hover:bg-slate-700"
                  >
                    ×
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div>
                  <p className="text-sm font-medium text-slate-400">ID</p>
                  <p className="font-mono text-sm text-slate-100">{selectedJob.id}</p>
                </div>

                <div>
                  <p className="text-sm font-medium text-slate-400">Type</p>
                  <p className="text-slate-100">{JOB_TYPE_LABELS[selectedJob.type]}</p>
                </div>

                <div>
                  <p className="text-sm font-medium text-slate-400">Status</p>
                  <p className="text-slate-100">{selectedJob.status}</p>
                </div>

                <div>
                  <p className="text-sm font-medium text-slate-400">Data</p>
                  <pre className="bg-slate-900 border border-slate-700 p-3 rounded text-sm overflow-x-auto text-slate-100">
                    {JSON.stringify(selectedJob.data, null, 2)}
                  </pre>
                </div>

                {selectedJob.result && (
                  <div>
                    <p className="text-sm font-medium text-slate-400">Result</p>
                    <pre className="bg-slate-900 border border-slate-700 p-3 rounded text-sm overflow-x-auto text-slate-100">
                      {JSON.stringify(selectedJob.result, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedJob.error && (
                  <div>
                    <p className="text-sm font-medium text-slate-400">Error</p>
                    <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 p-3 rounded">{selectedJob.error}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}