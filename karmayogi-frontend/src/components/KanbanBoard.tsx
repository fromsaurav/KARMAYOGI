'use client';

import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Clock, Activity, CheckCircle, XCircle, MessageSquare, Paperclip, Wifi, WifiOff, Users } from 'lucide-react';
import { Job, JobStatus } from '@/types';
import { useAuthStore } from '@/stores/authStore';
import { useWebSocket } from '@/hooks/useWebSocket';

interface KanbanJob extends Job {
  title: string;
  tags: string[];
  assignees: string[];
  comments: number;
  attachments: number;
}

interface JobsByStatus {
  QUEUED: KanbanJob[];
  PROCESSING: KanbanJob[];
  COMPLETED: KanbanJob[];
  FAILED: KanbanJob[];
}

const COLUMNS = [
  { id: 'QUEUED', title: 'Backlog Tasks', color: 'yellow' as const },
  { id: 'PROCESSING', title: 'In Progress', color: 'blue' as const },
  { id: 'COMPLETED', title: 'Done', color: 'green' as const },
  { id: 'FAILED', title: 'Failed', color: 'red' as const }
];

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

export const KanbanBoard = () => {
  const [jobs, setJobs] = useState<JobsByStatus>({
    QUEUED: [],
    PROCESSING: [],
    COMPLETED: [],
    FAILED: []
  });
  const [isLoading, setIsLoading] = useState(true);

  // Format job from backend to KanbanJob
  const formatJob = (job: any): KanbanJob => ({
    ...job,
    title: job.title || job.type?.replace(/_/g, ' ') || 'Untitled Job',
    tags: job.tags || [],
    assignees: job.assignees || [],
    comments: job.comments || 0,
    attachments: job.attachments || 0
  });

  // WebSocket integration for real-time updates
  const { isConnected, onlineUsersCount } = useWebSocket({
    onJobCreated: (data) => {
      console.log('Real-time job created:', data);
      const newJob = formatJob(data.job);
      const statusMap: { [key: string]: keyof JobsByStatus } = {
        'pending': 'QUEUED',
        'active': 'PROCESSING',
        'completed': 'COMPLETED',
        'failed': 'FAILED'
      };
      const column = statusMap[newJob.status] || 'QUEUED';

      setJobs(prev => ({
        ...prev,
        [column]: [...prev[column], newJob]
      }));
    },

    onJobStatusChanged: (data) => {
      console.log('Real-time status change:', data);
      setJobs(prev => {
        // Find the job in all columns
        let foundJob: KanbanJob | undefined;
        let oldColumn: keyof JobsByStatus | undefined;

        for (const [columnKey, columnJobs] of Object.entries(prev)) {
          const job = (columnJobs as KanbanJob[]).find((j: KanbanJob) => j.id === data.jobId);
          if (job) {
            foundJob = job;
            oldColumn = columnKey as keyof JobsByStatus;
            break;
          }
        }

        if (!foundJob || !oldColumn) return prev;

        // Map backend status to column
        const statusMap: { [key: string]: keyof JobsByStatus } = {
          'pending': 'QUEUED',
          'active': 'PROCESSING',
          'completed': 'COMPLETED',
          'failed': 'FAILED'
        };
        const newColumn = statusMap[data.newStatus] || 'QUEUED';

        // If status didn't change column, return unchanged
        if (oldColumn === newColumn) return prev;

        // Remove from old column and add to new column
        const newJobs = { ...prev };
        newJobs[oldColumn] = newJobs[oldColumn].filter(j => j.id !== data.jobId);
        newJobs[newColumn] = [...newJobs[newColumn], { ...foundJob, status: data.newStatus as JobStatus }];

        return newJobs;
      });
    },

    onJobProgress: (data) => {
      console.log('Real-time progress update:', data);
      setJobs(prev => {
        const newJobs = { ...prev };
        for (const column of Object.keys(newJobs) as (keyof JobsByStatus)[]) {
          newJobs[column] = newJobs[column].map(job =>
            job.id === data.jobId ? { ...job, progress: data.progress } : job
          );
        }
        return newJobs;
      });
    }
  });

  useEffect(() => {
    fetchJobs();
    // Refresh data every 5 minutes as backup (WebSocket handles real-time updates)
    const interval = setInterval(fetchJobs, 300000);
    return () => clearInterval(interval);
  }, []);

  const fetchJobs = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/jobs/kanban`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch jobs');
      }

      const data = await response.json();
      setJobs(data.jobs);
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
      // Set empty state on error
      setJobs({
        QUEUED: [],
        PROCESSING: [],
        COMPLETED: [],
        FAILED: []
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;

    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return; // No change
    }

    const sourceColumnId = source.droppableId as keyof JobsByStatus;
    const destColumnId = destination.droppableId as keyof JobsByStatus;

    if (source.droppableId === destination.droppableId) {
      // Reordering within same column (priority change)
      const column = Array.from(jobs[sourceColumnId]);
      const [removed] = column.splice(source.index, 1);
      column.splice(destination.index, 0, removed);

      setJobs({
        ...jobs,
        [sourceColumnId]: column
      });
    } else {
      // Moving between columns (status change)
      const sourceColumn = Array.from(jobs[sourceColumnId]);
      const destColumn = Array.from(jobs[destColumnId]);

      const [removed] = sourceColumn.splice(source.index, 1);
      destColumn.splice(destination.index, 0, removed);

      setJobs({
        ...jobs,
        [sourceColumnId]: sourceColumn,
        [destColumnId]: destColumn
      });

      // Update job status on backend
      await updateJobStatus(draggableId, destColumnId);
    }
  };

  const updateJobStatus = async (jobId: string, newStatus: string) => {
    try {
      const statusMap: Record<string, JobStatus> = {
        'QUEUED': JobStatus.PENDING,
        'PROCESSING': JobStatus.ACTIVE,
        'COMPLETED': JobStatus.COMPLETED,
        'FAILED': JobStatus.FAILED
      };

      const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ status: statusMap[newStatus] })
      });

      if (!response.ok) {
        throw new Error('Failed to update job status');
      }
    } catch (error) {
      console.error('Failed to update job status:', error);
      // Refresh jobs to get correct state
      fetchJobs();
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-yellow-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-300">Loading kanban board...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Connection Status Bar */}
      <div className="px-6 py-3 bg-slate-800/50 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* WebSocket Connection Status */}
            <div className="flex items-center gap-2">
              {isConnected ? (
                <>
                  <Wifi className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-green-400">Connected</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-red-400">Disconnected</span>
                </>
              )}
            </div>

            {/* Online Users Count */}
            <div className="flex items-center gap-2 text-slate-400">
              <Users className="h-4 w-4" />
              <span className="text-sm">
                {onlineUsersCount} {onlineUsersCount === 1 ? 'user' : 'users'} online
              </span>
            </div>
          </div>

          {/* Real-time Update Badge */}
          {isConnected && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                <div className="absolute inset-0 h-2 w-2 bg-green-500 rounded-full animate-ping"></div>
              </div>
              <span className="text-xs text-slate-400">Real-time updates enabled</span>
            </div>
          )}
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 p-6">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-4 gap-4 h-full">
            {COLUMNS.map(column => (
              <KanbanColumn
                key={column.id}
                column={column}
                jobs={jobs[column.id as keyof JobsByStatus] || []}
              />
            ))}
          </div>
        </DragDropContext>
      </div>
    </div>
  );
};

// Kanban Column Component
interface KanbanColumnProps {
  column: { id: string; title: string; color: 'yellow' | 'blue' | 'green' | 'red' };
  jobs: KanbanJob[];
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({ column, jobs }) => {
  const colorClasses = {
    yellow: 'border-yellow-500 bg-yellow-500/10',
    blue: 'border-blue-500 bg-blue-500/10',
    green: 'border-green-500 bg-green-500/10',
    red: 'border-red-500 bg-red-500/10'
  };

  return (
    <div className="flex flex-col h-full">
      {/* Column Header */}
      <div className={`flex items-center justify-between p-4 border-l-4 rounded-t-lg ${colorClasses[column.color]}`}>
        <h3 className="font-semibold text-slate-100">{column.title}</h3>
        <span className="bg-slate-700 text-slate-300 px-2 py-1 rounded-full text-sm">
          {jobs.length}
        </span>
      </div>

      {/* Droppable Area */}
      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 p-2 space-y-2 overflow-y-auto bg-slate-800/50 rounded-b-lg min-h-[200px] ${
              snapshot.isDraggingOver ? 'bg-slate-700/50' : ''
            }`}
          >
            {jobs.length > 0 ? (
              jobs.map((job, index) => (
                <JobCard key={job.id} job={job} index={index} />
              ))
            ) : (
              <div className="flex items-center justify-center h-32 text-slate-500 text-sm">
                No tasks
              </div>
            )}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
};

// Job Card Component
interface JobCardProps {
  job: KanbanJob;
  index: number;
}

const JobCard: React.FC<JobCardProps> = ({ job, index }) => {
  const priorityColors = {
    1: 'text-blue-400 bg-blue-500/20',
    2: 'text-yellow-400 bg-yellow-500/20',
    3: 'text-red-400 bg-red-500/20'
  };

  const priorityLabels = {
    1: 'LOW',
    2: 'MEDIUM',
    3: 'HIGH'
  };

  return (
    <Draggable draggableId={job.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`bg-slate-800 rounded-lg p-4 border border-slate-700 cursor-grab ${
            snapshot.isDragging ? 'shadow-xl rotate-2 ring-2 ring-yellow-500' : ''
          }`}
        >
          {/* Job Title */}
          <h4 className="font-medium text-slate-100 mb-2 line-clamp-2">{job.title}</h4>

          {/* Job ID and Priority */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-slate-400">#{job.id.slice(0, 8)}</span>
            <span className={`text-xs px-2 py-1 rounded ${priorityColors[job.priority as keyof typeof priorityColors] || 'text-slate-400 bg-slate-700'}`}>
              {priorityLabels[job.priority as keyof typeof priorityLabels] || 'NORMAL'}
            </span>
          </div>

          {/* Tags */}
          {job.tags && job.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {job.tags.slice(0, 3).map((tag, idx) => (
                <span key={idx} className="text-xs px-2 py-1 bg-slate-700 text-slate-300 rounded">
                  {tag}
                </span>
              ))}
              {job.tags.length > 3 && (
                <span className="text-xs px-2 py-1 bg-slate-700 text-slate-400 rounded">
                  +{job.tags.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Progress Bar for Active Jobs */}
          {job.status === JobStatus.ACTIVE && job.progress !== undefined && (
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-400">Progress</span>
                <span className="text-xs text-slate-300">{job.progress}%</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-1.5">
                <div
                  className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${job.progress}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Footer: Assignees and Metadata */}
          <div className="flex items-center justify-between">
            <div className="flex -space-x-2">
              {job.assignees && job.assignees.length > 0 && job.assignees.slice(0, 3).map((assignee, idx) => (
                <div
                  key={idx}
                  className="w-6 h-6 rounded-full bg-yellow-500 border-2 border-slate-800 flex items-center justify-center text-xs font-medium text-slate-900"
                  title={assignee}
                >
                  {assignee[0]?.toUpperCase()}
                </div>
              ))}
              {job.assignees && job.assignees.length > 3 && (
                <div className="w-6 h-6 rounded-full bg-slate-700 border-2 border-slate-800 flex items-center justify-center text-xs text-slate-400">
                  +{job.assignees.length - 3}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 text-slate-400 text-xs">
              {job.comments > 0 && (
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  {job.comments}
                </span>
              )}
              {job.attachments > 0 && (
                <span className="flex items-center gap-1">
                  <Paperclip className="h-3 w-3" />
                  {job.attachments}
                </span>
              )}
            </div>
          </div>

          {/* Created Date */}
          <div className="mt-2 pt-2 border-t border-slate-700">
            <p className="text-xs text-slate-400">
              {new Date(job.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>
        </div>
      )}
    </Draggable>
  );
};
